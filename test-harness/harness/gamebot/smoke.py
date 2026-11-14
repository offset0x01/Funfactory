"""Layer 1: smoke tests. Does the game load, draw, take keyboard input, and follow the hook spec?"""
from __future__ import annotations

import io
import json
import pathlib
import random
import tempfile
import time

from .browser import GameSession
from .scores import inject_into_html, MARK_START, MARK_END

STATUSES = {"playing", "won", "lost", "timeout"}
STATE_KEYS = ["status", "score", "lives", "livesLost", "level", "levelsCompleted", "progress", "steps", "player"]


class Checks:
    def __init__(self):
        self.items: list[dict] = []

    def add(self, name: str, ok: bool, detail: str = "", severity: str = "error"):
        self.items.append({"name": name, "ok": bool(ok), "detail": detail, "severity": "ok" if ok else severity})
        return ok

    @property
    def failed(self):
        return [c for c in self.items if not c["ok"] and c["severity"] == "error"]


def _validate_info(info: dict, c: Checks) -> bool:
    ok = True
    ok &= c.add("info.spec is 1", info.get("spec") == 1, f"spec={info.get('spec')}")
    for k, typ in [("title", str), ("stepsPerSecond", (int, float)), ("levelCount", int), ("maxSteps", int), ("actions", list), ("keys", dict)]:
        ok &= c.add(f"info.{k} present", isinstance(info.get(k), typ), repr(info.get(k))[:80])
    acts = info.get("actions") or []
    ids = [a.get("id") for a in acts if isinstance(a, dict)]
    ok &= c.add("3 to 10 actions", 3 <= len(ids) <= 10, f"{len(ids)} actions")
    ok &= c.add("first action is 'idle'", bool(ids) and ids[0] == "idle", f"first={ids[:1]}")
    ok &= c.add("every action has a desc", all(isinstance(a.get("desc"), str) and a["desc"] for a in acts))
    ok &= c.add("action ids are unique", len(set(ids)) == len(ids))
    keys = info.get("keys") or {}
    missing = [i for i in ids[1:] if not all(part in keys for part in i.split("_"))]
    c.add("every action maps to real keys", not missing, f"no keys for: {missing}" if missing else "", severity="warn")
    ok &= c.add("smokeAction is a real action", info.get("smokeAction") in ids, f"smokeAction={info.get('smokeAction')}")
    return ok


def _validate_state(s: dict, c: Checks, label: str) -> bool:
    missing = [k for k in STATE_KEYS if k not in s]
    ok = c.add(f"{label}: state has all fields", not missing, f"missing {missing}" if missing else "")
    ok &= c.add(f"{label}: status is valid", s.get("status") in STATUSES, f"status={s.get('status')}")
    p = s.get("progress")
    ok &= c.add(f"{label}: progress in 0..1", isinstance(p, (int, float)) and 0 <= p <= 1, f"progress={p}")
    return ok


def _canvas_drawn(png: bytes) -> tuple[bool, str]:
    from PIL import Image
    import numpy as np
    img = np.asarray(Image.open(io.BytesIO(png)).convert("RGB")).astype(float)
    std = float(img.std())
    colors = len(np.unique(img.reshape(-1, 3)[:: max(1, img.size // 3 // 20000)], axis=0))
    return std > 8 and colors > 12, f"pixel std {std:.1f}, ~{colors} colors"


def run_smoke(game_path: str, out_dir: pathlib.Path) -> dict:
    c = Checks()
    html = pathlib.Path(game_path).read_text(encoding="utf-8", errors="replace")
    c.add("BOT-SCORES markers in file", MARK_START in html and MARK_END in html, "add the markers from spec section 8")

    with GameSession(game_path) as g:
        g.page.wait_for_timeout(1500)
        c.add("loads without console errors", not g.errors, "; ".join(g.errors[:3]))
        if not c.add("window.GAME_TEST_HOOK exists", g.has_hook()):
            return {"checks": c.items, "passed": False}
        ver = g.page.evaluate("window.GAME_TEST_HOOK.version")
        c.add("hook.version is 1", ver == 1, f"version={ver}")
        fns = g.page.evaluate("['info','reset','step','getState','observe'].filter(k => typeof window.GAME_TEST_HOOK[k] !== 'function')")
        if not c.add("required hook methods exist", not fns, f"missing {fns}" if fns else ""):
            return {"checks": c.items, "passed": False}
        info = g.info()
        if not _validate_info(info, c):
            return {"checks": c.items, "passed": False, "info": info}
        sps = info["stepsPerSecond"]

        # bot mode: real-time clock frozen, step() is exact
        s0 = g.reset(seed=1)
        _validate_state(s0, c, "after reset")
        c.add("reset gives score 0, steps 0", s0["score"] == 0 and s0["steps"] == 0, f"score={s0['score']} steps={s0['steps']}")
        g.page.wait_for_timeout(500)
        s1 = g.state()
        c.add("bot mode freezes the game clock", s1["steps"] == 0 and s1["player"] == s0["player"], "game moved by itself during bot mode")
        s2 = g.step("idle", 10)
        c.add("step('idle', 10) advances exactly 10 steps", s2["steps"] == 10, f"steps={s2['steps']}")
        _validate_state(s2, c, "after step")
        try:
            g.step("not_an_action", 1)
            c.add("unknown action is rejected", False, "step() accepted a bogus action", severity="warn")
        except Exception:
            c.add("unknown action is rejected", True)
        obs = g.observe()
        c.add("observe() gives text", isinstance(obs.get("text"), str) and 0 < len(obs["text"]) <= 1500, f"{len(obs.get('text') or '')} chars")

        # determinism: same seed + same random actions = same result
        rnd = random.Random(7)
        ids = list(range(len(info["actions"])))
        genome = [[rnd.choice(ids), rnd.randint(10, 60)] for _ in range(60)]
        a = g.rollout(genome, seed=3)
        b = g.rollout(genome, seed=3)
        keys = ["status", "score", "lives", "steps", "progress", "player"]
        c.add("same seed + same inputs = same run", all(a[k] == b[k] for k in keys), f"run A {a['score']}/{a['progress']:.3f} vs B {b['score']}/{b['progress']:.3f}")

        # speed: a full idle run must simulate quickly
        t = time.time()
        g.rollout([[0, info["maxSteps"]]], seed=1, stall_steps=10**9, chunk=600)
        dt = time.time() - t
        c.add("full-length run simulates in < 5 s", dt < 5, f"{dt:.2f} s for {info['maxSteps']} steps", severity="warn")

        # real keyboard: compare idle vs holding the smoke action's keys, in real time
        def realtime_run(press: bool):
            g.reset(seed=1, realtime=True)
            g.page.mouse.click(5, 5)  # focus the page
            keys_ = [k for part in info["smokeAction"].split("_") for k in info["keys"].get(part, [])[:1]]
            if press:
                for k in keys_:
                    g.page.keyboard.down(k)
            g.page.wait_for_timeout(1000)
            if press:
                for k in keys_:
                    g.page.keyboard.up(k)
            return g.state()
        idle_s, key_s = realtime_run(False), realtime_run(True)
        pi, pk = idle_s.get("player") or {}, key_s.get("player") or {}
        moved = (abs((pk.get("x") or 0) - (pi.get("x") or 0)) > 0.5 or abs((pk.get("y") or 0) - (pi.get("y") or 0)) > 0.5
                 or abs(key_s["progress"] - idle_s["progress"]) > 1e-3 or key_s["score"] != idle_s["score"])
        c.add(f"real keyboard works ({info['smokeAction']})", moved, f"idle player {pi} vs keys {pk}")

        # canvas actually draws
        g.reset(seed=1, realtime=True)
        g.page.wait_for_timeout(800)
        out_dir.mkdir(parents=True, exist_ok=True)
        shot = g.page.screenshot(path=str(out_dir / "smoke-gameplay.png"))
        drawn, detail = _canvas_drawn(shot)
        c.add("game screen is drawn (not blank)", drawn, detail)
        c.add("no console errors while playing", not g.errors, "; ".join(g.errors[:3]))

    # title screen shows a bot's best when BOT_SCORES is set
    if MARK_START in html:
        fake = {"game": "smoke", "updated": "", "champion": {"bot": "test", "label": "Test Bot", "score": 98765, "won": True}, "bots": {}}
        with tempfile.TemporaryDirectory() as td:
            tmp = pathlib.Path(td) / "index.html"
            tmp.write_text(inject_into_html(html, fake), encoding="utf-8")
            with GameSession(str(tmp)) as g2:
                g2.page.wait_for_timeout(800)
                shown = "98765" in g2.page.inner_text("body")
                g2.page.screenshot(path=str(out_dir / "smoke-title-with-bot-score.png"))
        c.add("title screen shows the bot's best", shown, "set window.BOT_SCORES and the number did not appear")

    return {"checks": c.items, "passed": not c.failed, "info": info}
