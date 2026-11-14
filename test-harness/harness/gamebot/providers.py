"""Decision providers for the AI bots. Standard library only (urllib), so nothing to install.

Settings come from environment variables (or a .env file, see .env.example):

  LITELLM_BASE_URL    e.g. http://litellm:4000/v1   (OpenAI-compatible; DeepInfra models behind it)
  LITELLM_API_KEY     LiteLLM key
  ENUM_MODEL          model for the Quick-Pick bot, e.g. a DeepInfra Qwen3.5-9B alias in LiteLLM
  LLM_DECIDE_MODEL    per-move model for the Thinking bot (defaults to ENUM_MODEL)
  LLM_REFLECT_MODEL   between-pass reviewer for the Thinking bot (defaults to LLM_DECIDE_MODEL)
  CHAT_EXTRA_BODY     optional JSON merged into every chat request (e.g. to turn off "thinking")
  JEV_URL             SystemOne endpoint, default https://openrouter.ai/api/v1/systemone
  JEV_API_KEY         key for that endpoint
  JEV_MODEL           default jev-latest
"""
from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.request


def load_dotenv(*paths):
    for p in paths:
        if p and os.path.exists(p):
            for line in open(p, encoding="utf-8"):
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


class ProviderError(RuntimeError):
    pass


def _post(url: str, key: str | None, body: dict, timeout: float = 30, retries: int = 2) -> dict:
    data = json.dumps(body).encode()
    headers = {"Content-Type": "application/json"}
    if key:
        headers["Authorization"] = f"Bearer {key}"
    last = None
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, data=data, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            last = f"HTTP {e.code}: {e.read().decode(errors='replace')[:300]}"
            if e.code not in (408, 409, 429, 500, 502, 503, 504, 524, 529):
                break
        except Exception as e:  # network errors, timeouts, bad JSON
            last = str(e)
        time.sleep(0.6 * (attempt + 1))
    raise ProviderError(f"{url}: {last}")


class Usage:
    def __init__(self):
        self.calls = 0
        self.errors = 0
        self.latencies: list[float] = []
        self.input_tokens = 0
        self.output_tokens = 0
        self.cost = 0.0

    def record(self, latency: float, usage: dict | None):
        self.calls += 1
        self.latencies.append(latency)
        if usage:
            self.input_tokens += int(usage.get("input_tokens") or usage.get("prompt_tokens") or 0)
            self.output_tokens += int(usage.get("output_tokens") or usage.get("completion_tokens") or 0)
            self.cost += float(usage.get("cost") or 0)

    def summary(self) -> dict:
        lat = sorted(self.latencies)
        pct = lambda q: round(1000 * lat[min(len(lat) - 1, int(q * len(lat)))]) if lat else None
        return {"calls": self.calls, "errors": self.errors, "latency_ms_p50": pct(0.5), "latency_ms_p90": pct(0.9),
                "input_tokens": self.input_tokens, "output_tokens": self.output_tokens, "reported_cost_usd": round(self.cost, 6)}


GOAL = ("You are playing a video game for a kid's test harness. Pick the action that makes progress toward winning "
        "(see 'goal' in the facts) without losing a life. The action is held for a fraction of a second, then you choose again.")


class JevProvider:
    """Jev (TypeSafe AI) through a SystemOne endpoint: one 'choice' question per move."""

    label = "jev"

    def __init__(self):
        self.url = os.environ.get("JEV_URL", "https://openrouter.ai/api/v1/systemone")
        self.key = os.environ.get("JEV_API_KEY")
        self.model = os.environ.get("JEV_MODEL", "jev-latest")
        self.usage = Usage()
        if not self.key:
            raise ProviderError("JEV_API_KEY is not set")

    def decide(self, actions: list[dict], obs: dict, lessons: list[str], strategy: str | None = None) -> tuple[str, dict]:
        body = {
            "model": self.model,
            "state": {"task": GOAL, "screen": obs.get("text", ""), "facts": obs.get("facts", {}),
                      "lessons_from_earlier_tries": lessons or ["none yet"]},
            "questions": {"action": {"type": "choice",
                                     "instructions": "Which action should the player take right now?",
                                     "criteria": {a["id"]: a["desc"] for a in actions}}},
        }
        t = time.time()
        r = _post(self.url, self.key, body)
        self.usage.record(time.time() - t, r.get("usage"))
        ans = (r.get("answers") or {}).get("action") or {}
        choice = ans.get("choice")
        if choice not in {a["id"] for a in actions}:
            raise ProviderError(f"Jev returned no valid choice: {str(r)[:200]}")
        return choice, {"confidence": ans.get("confidence"), "probabilities": ans.get("probabilities")}


class ChatProvider:
    """Any OpenAI-compatible chat model through LiteLLM (DeepInfra behind it)."""

    def __init__(self, *model_envs: str, label: str = "chat"):
        self.base = os.environ.get("LITELLM_BASE_URL", "http://localhost:4000/v1").rstrip("/")
        self.key = os.environ.get("LITELLM_API_KEY")
        self.model = next((os.environ[e] for e in model_envs if os.environ.get(e)), None)
        self.label = label
        self.usage = Usage()
        try:
            self.extra = json.loads(os.environ.get("CHAT_EXTRA_BODY", "{}") or "{}")
        except json.JSONDecodeError:
            self.extra = {}
        if not self.model:
            raise ProviderError(f"{model_envs[0]} is not set")

    def chat(self, messages: list[dict], max_tokens: int = 400, response_format: dict | None = None, temperature: float = 0) -> str:
        body = {"model": self.model, "messages": messages, "max_tokens": max_tokens, "temperature": temperature, **self.extra}
        if response_format:
            body["response_format"] = response_format
        t = time.time()
        r = _post(self.base + "/chat/completions", self.key, body, timeout=60)
        self.usage.record(time.time() - t, r.get("usage"))
        try:
            return r["choices"][0]["message"]["content"] or ""
        except (KeyError, IndexError, TypeError):
            raise ProviderError(f"unexpected chat response: {str(r)[:200]}")

    def decide(self, actions: list[dict], obs: dict, lessons: list[str], strategy: str | None = None) -> tuple[str, dict]:
        ids = [a["id"] for a in actions]
        sys = GOAL + " Answer only with JSON like {\"action\": \"<id>\"}."
        user = ("Actions:\n" + "\n".join(f"- {a['id']}: {a['desc']}" for a in actions)
                + (f"\n\nYour strategy:\n{strategy}" if strategy else "")
                + ("\n\nLessons from earlier tries:\n" + "\n".join(f"- {l}" for l in lessons) if lessons else "")
                + f"\n\nFacts: {json.dumps(obs.get('facts', {}))}\n\nScreen:\n{obs.get('text', '')}\n\nWhich action now?")
        fmt = {"type": "json_schema", "json_schema": {"name": "move", "strict": True, "schema": {
            "type": "object", "properties": {"action": {"type": "string", "enum": ids}}, "required": ["action"], "additionalProperties": False}}}
        text = self.chat([{"role": "system", "content": sys}, {"role": "user", "content": user}], max_tokens=40, response_format=fmt)
        try:
            choice = json.loads(text).get("action")
        except Exception:
            m = re.search(r"\b(" + "|".join(map(re.escape, sorted(ids, key=len, reverse=True))) + r")\b", text)
            choice = m.group(1) if m else None
        if choice not in ids:
            raise ProviderError(f"model gave no valid action: {text[:120]!r}")
        return choice, {}
