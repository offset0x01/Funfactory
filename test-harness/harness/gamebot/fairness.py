"""Layer 3: is it fair for a kid? Uses the hook plus the evolutionary bot's best run."""
from __future__ import annotations

import random

from .browser import GameSession


def run_fairness(g: GameSession, info: dict, best_genome=None, best_result=None, seed: int = 1, samples: int = 24,
                 require_win: bool = True) -> dict:
    sps = info["stepsPerSecond"]
    findings = []

    def add(name, ok, detail, severity="warn"):
        findings.append({"name": name, "ok": bool(ok), "detail": detail, "severity": "ok" if ok else severity})

    # 1. You don't die just by standing still at the start.
    r = g.rollout([[0, 3 * sps]], seed=seed, stall_steps=10**9)
    add("standing still for 3 s is safe", r["livesLost"] == 0 and r["status"] != "lost",
        f"lives lost in the first 3 s without touching anything: {r['livesLost']}", "error")

    # 2. Doing nothing does not win.
    r = g.rollout([[0, min(info["maxSteps"], 30 * sps)]], seed=seed, stall_steps=10**9, chunk=300)
    add("doing nothing does not win", r["status"] != "won", f"after 30 s of standing still: {r['status']}, progress {r['progress']:.0%}", "error")

    # 3. Mashing random buttons does not win (the game is not trivial).
    rnd = random.Random(99)
    wins = 0
    for _ in range(5):
        gen = [[rnd.randrange(len(info["actions"])), rnd.randint(6, 60)] for _ in range(info["maxSteps"] // 30)]
        wins += g.rollout(gen, seed=seed, stall_steps=10**9, chunk=60)["status"] == "won"
    add("random button mashing does not win", wins == 0, f"{wins}/5 random runs won")

    # 4. Game's own design checks.
    sc = g.self_check()
    if sc is None:
        add("game self-check", True, "game has no selfCheck() (optional)")
    else:
        errs = [x for x in sc if x.get("severity") == "error"]
        add("game self-check", not errs, "; ".join(f"L{x.get('level')}: {x.get('message')}" for x in sc[:5]) or "no problems",
            "error" if errs else "warn")

    # 5. Winnable by a human-speed bot.
    # A game no bot can win fails, unless the run was started with --allow-no-win.
    if best_result is not None:
        won = best_result["status"] == "won"
        detail = (f"won with score {best_result['score']}, lives lost {best_result['livesLost']}" if won else
                  f"not proven: best run reached {best_result['progress']:.0%} (level {best_result['level'] + 1}). "
                  "Either that spot is too hard or the bot needs more tries (--extra-passes 10, once, if the last run was short).")
        add("a human-speed bot can win", won, detail, "error" if require_win else "warn")

    # 6. Timing tolerance: nudge one input change ~40 ms early or late. Does the run still succeed?
    if best_genome and len(best_genome) > 2 and best_result is not None:
        rnd = random.Random(5)
        nudge = max(1, round(0.04 * sps))
        base_prog, base_lost = best_result["progress"], best_result["livesLost"]
        tight = []
        trials = min(samples, len(best_genome) - 1)
        idxs = sorted(rnd.sample(range(len(best_genome) - 1), trials))
        ok_count = 0
        for i in idxs:
            for d in (-nudge, nudge):
                gen = [list(s) for s in best_genome]
                if gen[i][1] + d < 1 or gen[i + 1][1] - d < 1:
                    continue
                gen[i][1] += d
                gen[i + 1][1] -= d
                r = g.rollout(gen, seed=seed, stall_steps=info["maxSteps"])
                good = r["progress"] >= base_prog - 0.02 and r["livesLost"] <= base_lost
                ok_count += good
                if not good:
                    at = sum(f for _, f in best_genome[: i + 1])
                    tight.append({"at_seconds": round(at / sps, 1), "shift_ms": round(1000 * d / sps), "progress": round(r["progress"], 3),
                                  "livesLost": r["livesLost"]})
        total = ok_count + len(tight)
        rate = ok_count / total if total else 1.0
        # Open-loop replays are harsher than a person, who reacts to what they see, so the bar is low.
        add("timing tolerance (40 ms nudges)", rate >= 0.5,
            f"{ok_count}/{total} nudged replays still did as well ({rate:.0%}); tight moments at "
            + (", ".join(f"{t['at_seconds']}s" for t in tight[:6]) or "none"))
        return {"findings": findings, "timing": {"tolerance": round(rate, 3), "tight_moments": tight[:20]}}

    return {"findings": findings}
