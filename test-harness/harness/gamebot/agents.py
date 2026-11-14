"""AI bots that look at the screen (observe()) and pick a move every ~quarter second of game time.

  jev   Jev picks from the action list.                      Learns via "lessons" from earlier deaths.
  enum  A cheap DeepInfra model, forced to answer an enum.   Same lessons, so it's a fair A/B with Jev.
  llm   "Thinking bot" (v2). Same per-move picker, plus after every pass a reviewer model reads
        what happened and rewrites the bot's strategy for the next pass. That strategy text is
        what GEPA would later evolve (see test-harness/LLM_GUIDED_BOT.md).

The game clock is frozen while the model thinks, so a 500 ms answer costs nothing in-game.
"""
from __future__ import annotations

import json
import time
from collections import Counter

from .browser import GameSession
from .providers import ChatProvider, JevProvider, ProviderError


def _death_lesson(pass_no: int, state_before: dict, action: str, obs_before: dict, why: str) -> str:
    view = obs_before.get("text", "").splitlines()
    grid = [l for l in view if l and set(l) - set(".")][-6:]  # the lower, non-empty part of the view
    lvl = state_before.get("level", 0) + 1
    return (f"Try {pass_no}: {why} on level {lvl} at {state_before.get('progress', 0):.0%} of the game "
            f"right after choosing '{action}'. The view then was: " + " / ".join(grid)[:300])


class AgentBot:
    def __init__(self, kind: str, session: GameSession, info: dict, seed: int = 1, decision_seconds: float = 0.25,
                 max_decisions: int = 600, log=print):
        self.kind, self.g, self.info, self.seed, self.log = kind, session, info, seed, log
        self.frames = max(1, round(decision_seconds * info["stepsPerSecond"]))
        self.max_decisions = max_decisions
        self.actions = info["actions"]
        if kind == "jev":
            self.picker = JevProvider()
        elif kind == "enum":
            self.picker = ChatProvider("ENUM_MODEL", label="enum")
        elif kind == "llm":
            self.picker = ChatProvider("LLM_DECIDE_MODEL", "ENUM_MODEL", label="llm-decide")
            self.reviewer = ChatProvider("LLM_REFLECT_MODEL", "LLM_DECIDE_MODEL", "ENUM_MODEL", label="llm-reflect")
        else:
            raise ValueError(kind)
        self.lessons: list[str] = []
        self.strategy: str | None = None

    def _play_pass(self, pass_no: int) -> dict:
        s = self.g.reset(seed=self.seed)
        last_action, n, errors = "idle", 0, 0
        counts: Counter = Counter()
        deaths = []
        best_prog, stall = s["progress"], 0
        while s["status"] == "playing" and n < self.max_decisions:
            obs = self.g.observe()
            try:
                action, _meta = self.picker.decide(self.actions, obs, self.lessons[-4:], self.strategy)
            except ProviderError as e:
                errors += 1
                self.picker.usage.errors += 1
                action = last_action
                if errors == 1 or errors % 10 == 0:
                    self.log(f"    {self.kind}: provider error ({errors}): {str(e)[:160]}")
                if errors > max(5, n // 5):
                    raise RuntimeError(f"{self.kind}: too many provider errors, stopping this bot") from e
            before = s
            s = self.g.step(action, self.frames)
            counts[action] += 1
            n += 1
            last_action = action
            if s["livesLost"] > before["livesLost"]:
                deaths.append({"level": before["level"], "progress": round(before["progress"], 3), "action": action,
                               "view": obs.get("text", "")[-700:]})
                self.lessons.append(_death_lesson(pass_no, before, action, obs, "lost a life"))
            if s["progress"] > best_prog + 1e-4:
                best_prog, stall = s["progress"], 0
            else:
                stall += 1
            if stall * self.frames > 8 * self.info["stepsPerSecond"] and n % 20 == 0:
                self.lessons.append(_death_lesson(pass_no, s, action, obs, "got stuck for 8 s"))
                stall = 0
        status = "out of moves" if s["status"] == "playing" else s["status"]
        return {"pass": pass_no, "score": s["score"], "status": status, "progress": round(s["progress"], 4),
                "livesLost": s["livesLost"], "steps": s["steps"], "decisions": n, "provider_errors": errors,
                "action_counts": dict(counts), "deaths": deaths[:12]}

    def _reflect(self, result: dict):
        """Thinking bot only: a reviewer rewrites the strategy from what just happened."""
        prompt = (
            f"Game: {self.info['title']}. Actions: " + ", ".join(f"{a['id']} ({a['desc']})" for a in self.actions)
            + f"\n\nCurrent strategy:\n{self.strategy or '(none yet)'}"
            + f"\n\nLast try: status {result['status']}, score {result['score']}, progress {result['progress']:.0%}, "
              f"lives lost {result['livesLost']}, moves used {json.dumps(result['action_counts'])}."
            + "\n\nWhat the screen looked like just before each life was lost:\n"
            + "\n---\n".join(f"(level {d['level'] + 1}, chose {d['action']})\n{d['view']}" for d in result["deaths"][:4])
            + "\n\nWrite an improved strategy for the next try: at most 120 words of short, concrete rules "
              "(when to jump, what to avoid, how to handle the hazards seen above). Output only the strategy."
        )
        try:
            text = self.reviewer.chat([{"role": "user", "content": prompt}], max_tokens=600, temperature=0.3)
            text = text.strip()
            if text:
                self.strategy = text[:1200]
        except ProviderError as e:
            self.log(f"    llm: reviewer failed, keeping old strategy ({str(e)[:120]})")

    def run(self, passes: int = 3) -> dict:
        results, strategies = [], []
        for p in range(1, passes + 1):
            t = time.time()
            r = self._play_pass(p)
            results.append(r)
            self.log(f"  {self.kind} pass {p}/{passes}: score {r['score']}, {r['status']}, progress {r['progress']:.0%}, "
                     f"lives lost {r['livesLost']}, {r['decisions']} moves ({time.time() - t:.0f}s)")
            if self.kind == "llm" and p < passes:
                self._reflect(r)
                strategies.append(self.strategy)
        usage = {"decide": self.picker.usage.summary()}
        if self.kind == "llm":
            usage["reflect"] = self.reviewer.usage.summary()
        return {"bot": self.kind, "passes": results, "won": any(r["status"] == "won" for r in results),
                "model": getattr(self.picker, "model", None), "usage": usage,
                "strategies": strategies, "lessons": self.lessons[-8:],
                "settings": {"decision_seconds": self.frames / self.info["stepsPerSecond"], "max_decisions": self.max_decisions, "seed": self.seed}}
