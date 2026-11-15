#!/usr/bin/env python3
"""Kids game test harness.

  python3 test-harness/harness/run_tests.py smoke  path/to/index.html
  python3 test-harness/harness/run_tests.py all    path/to/index.html                 # smoke + evolution bot + fairness + any AI bots configured
  python3 test-harness/harness/run_tests.py bots   path/to/index.html --bots jev,enum  # just these bots
  python3 test-harness/harness/run_tests.py all    path/to/index.html --bots evolutionary,jev,enum,llm --passes 3

`all` writes the report to commit, <game folder>/TEST_REPORT.md. Working files (smoke-report.md, bots-report.md,
report.json, screenshots, the bot's best run) go to <game folder>/test-results/, which git ignores.
Bot scores go to <game folder>/bot-scores.json and into the game file between the BOT-SCORES markers
(use --no-inject to leave the game file alone). Exit code 1 means the game failed a required check.
"""
from __future__ import annotations

import argparse
import json
import os
import pathlib
import sys
import time

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from gamebot.agents import AgentBot  # noqa: E402
from gamebot.browser import GameSession  # noqa: E402
from gamebot.evolve import EvolutionaryBot  # noqa: E402
from gamebot.fairness import run_fairness  # noqa: E402
from gamebot.providers import ProviderError, load_dotenv  # noqa: E402
from gamebot.scores import LABELS, bot_entry, inject_file, merge_scores, summarize_passes  # noqa: E402
from gamebot.smoke import run_smoke  # noqa: E402

AI_BOTS = ["jev", "enum", "llm"]
CONFIGURED = {"jev": ["JEV_API_KEY"], "enum": ["ENUM_MODEL"], "llm": ["LLM_DECIDE_MODEL", "ENUM_MODEL"]}


def configured(bot: str) -> bool:
    return any(os.environ.get(k) for k in CONFIGURED[bot])


def icon(ok, severity):
    return "PASS" if ok else ("FAIL" if severity == "error" else "WARN")


def write_report(out: pathlib.Path, report: dict, md: pathlib.Path) -> pathlib.Path:
    """Write the report as Markdown to `md`, and as JSON next to the other working files in `out`."""
    out.mkdir(parents=True, exist_ok=True)
    (out / (md.stem.lower().replace("_", "-") + ".json")).write_text(json.dumps(report, indent=2) + "\n")
    L = [f"# Test report: {report.get('title', report['game'])}", "", f"Run at {report['started']} · seed {report['seed']}", ""]
    if "smoke" in report:
        L += ["## Smoke tests", "", "| Result | Check | Detail |", "| --- | --- | --- |"]
        L += [f"| {icon(c['ok'], c['severity'])} | {c['name']} | {c['detail'].replace('|', '/')} |" for c in report["smoke"]["checks"]]
        L.append("")
    if report.get("bots"):
        L += ["## Bots", "", "| Bot | Start | Mid | Best | Won? | Passes |", "| --- | --- | --- | --- | --- | --- |"]
        for k, b in report["bots"].items():
            if "error" in b:
                L.append(f"| {LABELS.get(k, k)} | – | – | – | – | {b['error']} |")
                continue
            s = summarize_passes([p["score"] for p in b["passes"]])
            L.append(f"| {LABELS.get(k, k)} | {s['start']} | {s['mid']} | {s['best']} | {'yes' if b['won'] else 'no'} | "
                     + ", ".join(f"{p['score']} ({p['status']}, {p['progress']:.0%})" for p in b["passes"]) + " |")
        L.append("")
        for k, b in report["bots"].items():
            if b.get("usage"):
                for part, u in b["usage"].items():
                    L.append(f"- **{LABELS.get(k, k)} ({part})** model `{b.get('model')}`: {u['calls']} calls, {u['errors']} errors, "
                             f"p50 {u['latency_ms_p50']} ms, p90 {u['latency_ms_p90']} ms, {u['input_tokens']} in / {u['output_tokens']} out tokens"
                             + (f", ${u['reported_cost_usd']}" if u.get("reported_cost_usd") else ""))
            if b.get("strategies"):
                L += ["", f"Final strategy written by the Thinking Bot's reviewer:", "", "> " + b["strategies"][-1].replace("\n", "\n> ")]
        L.append("")
    if "fairness" in report:
        L += ["## Fairness", "", "| Result | Check | Detail |", "| --- | --- | --- |"]
        L += [f"| {icon(f['ok'], f['severity'])} | {f['name']} | {f['detail'].replace('|', '/')} |" for f in report["fairness"]["findings"]]
        L.append("")
    if report.get("scoreboard"):
        c = report["scoreboard"].get("champion")
        L += ["## Scoreboard", "", f"Bot to beat: **{c['label']} with {c['score']}**" if c else "No bot scores yet.", ""]
    L += [f"**Overall: {'PASS' if report['passed'] else 'FAIL'}**", ""]
    md.write_text("\n".join(L))
    return md


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", choices=["smoke", "bots", "all"])
    ap.add_argument("game", help="path to the game's index.html")
    ap.add_argument("--bots", default=None, help="comma list from: evolutionary, jev, enum, llm (default: evolutionary + configured AI bots)")
    ap.add_argument("--passes", type=int, default=3, help="passes per bot (at least 3)")
    ap.add_argument("--rollouts", type=int, default=1000, help="evolution bot: tries per pass")
    ap.add_argument("--extra-passes", type=int, default=2, help="evolution bot: extra passes allowed if it hasn't won yet")
    ap.add_argument("--require-win", action="store_true", help="fail the build if no bot proves the game can be won")
    ap.add_argument("--decision-seconds", type=float, default=0.25, help="AI bots: game time each chosen move is held")
    ap.add_argument("--max-decisions", type=int, default=600, help="AI bots: move limit per pass (caps cost)")
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--no-inject", action="store_true", help="don't write bot scores into the game file")
    ap.add_argument("--env", default=None, help="path to a .env file with model settings")
    a = ap.parse_args()

    load_dotenv(a.env, str(HERE.parent / ".env"), ".env")
    game = pathlib.Path(a.game).resolve()
    out = game.parent / "test-results"
    passes = max(3, a.passes)
    # Only a full `all` run replaces the committed report; quick smoke and bots-only runs write beside it.
    md = {"smoke": out / "smoke-report.md", "bots": out / "bots-report.md", "all": game.parent / "TEST_REPORT.md"}[a.command]
    report = {"game": str(game), "seed": a.seed, "started": time.strftime("%Y-%m-%d %H:%M:%S"), "passed": True}
    log = lambda m: print(m, flush=True)

    if a.command in ("smoke", "all"):
        log(f"Smoke tests: {game.name}")
        sm = run_smoke(str(game), out)
        report["smoke"] = sm
        report["title"] = (sm.get("info") or {}).get("title", game.name)
        for c in sm["checks"]:
            log(f"  [{icon(c['ok'], c['severity'])}] {c['name']}" + (f"  ({c['detail']})" if not c["ok"] and c["detail"] else ""))
        if not sm["passed"]:
            report["passed"] = False
            write_report(out, report, out / "smoke-report.md")
            log(f"\nSmoke tests failed. See {out / 'smoke-report.md'}")
            sys.exit(1)
        if a.command == "smoke":
            write_report(out, report, md)
            log(f"\nAll smoke tests passed. Report: {md}")
            return

    bots = [b.strip() for b in a.bots.split(",")] if a.bots else ["evolutionary"] + [b for b in AI_BOTS if configured(b)]
    unknown = [b for b in bots if b not in ["evolutionary"] + AI_BOTS]
    if unknown:
        sys.exit(f"Unknown bot(s): {unknown}")
    if not a.bots:
        skipped = [b for b in AI_BOTS if not configured(b)]
        if skipped:
            log(f"(AI bots not configured, skipping: {', '.join(skipped)}. See .env.example.)")

    report["bots"] = {}
    entries = {}
    with GameSession(str(game)) as g:
        info = g.info()
        report["title"] = info["title"]
        evo_best = evo_full = None
        for bot in bots:
            log(f"\n{LABELS.get(bot, bot)} ({bot}), {passes} passes")
            t = time.time()
            try:
                if bot == "evolutionary":
                    r = EvolutionaryBot(g, info, seed=a.seed, rollouts_per_pass=a.rollouts, log=log).run(passes, a.extra_passes)
                    evo_best = r.pop("best_genome")
                    out.mkdir(parents=True, exist_ok=True)
                    (out / "evolutionary-best-run.json").write_text(json.dumps({"seed": a.seed, "actions": [x["id"] for x in info["actions"]],
                                                                                "genome": evo_best}) + "\n")
                    evo_full = g.rollout(evo_best, seed=a.seed, stall_steps=info["maxSteps"])
                else:
                    r = AgentBot(bot, g, info, seed=a.seed, decision_seconds=a.decision_seconds, max_decisions=a.max_decisions, log=log).run(passes)
            except (ProviderError, RuntimeError) as e:
                log(f"  skipped: {e}")
                report["bots"][bot] = {"error": str(e)[:300]}
                continue
            r["seconds"] = round(time.time() - t, 1)
            report["bots"][bot] = r
            extra = {"model": r["model"]} if r.get("model") else None
            entries[bot] = bot_entry(bot, [p["score"] for p in r["passes"]], r["won"], extra)

        if a.command == "all":
            log("\nFairness checks")
            fr = run_fairness(g, info, evo_best, evo_full, seed=a.seed, require_win=a.require_win)
            report["fairness"] = fr
            for f in fr["findings"]:
                log(f"  [{icon(f['ok'], f['severity'])}] {f['name']}  ({f['detail']})")
            if any(not f["ok"] and f["severity"] == "error" for f in fr["findings"]):
                report["passed"] = False

    if entries:
        data = merge_scores(game.parent / "bot-scores.json", report["title"], entries)
        report["scoreboard"] = data
        if not a.no_inject:
            if inject_file(game, data):
                log(f"\nBot scores written into {game.name} (title screen shows the bot to beat).")
            else:
                log(f"\n{game.name} has no BOT-SCORES markers; scores saved only to bot-scores.json.")
        c = data.get("champion")
        if c:
            log(f"Bot to beat: {c['label']} with {c['score']}")

    write_report(out, report, md)
    log(f"\n{'PASS' if report['passed'] else 'FAIL'}. Report: {md}")
    sys.exit(0 if report["passed"] else 1)


if __name__ == "__main__":
    main()
