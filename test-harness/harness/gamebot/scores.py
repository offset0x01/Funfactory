"""Bot scoreboard: start / mid / best per bot, saved to bot-scores.json and injected into the game file."""
from __future__ import annotations

import datetime as dt
import json
import pathlib

MARK_START = "<!-- BOT-SCORES-START -->"
MARK_END = "<!-- BOT-SCORES-END -->"

LABELS = {
    "evolutionary": "Evolution Bot",
    "jev": "Jev Bot",
    "enum": "Quick-Pick Bot",
    "llm": "Thinking Bot",
}


def summarize_passes(pass_scores: list[int]) -> dict:
    """start = pass 1, mid = the middle pass, best = best score in any pass."""
    if not pass_scores:
        return {"start": None, "mid": None, "best": None}
    mid_i = (len(pass_scores) + 1) // 2 - 1
    return {"start": pass_scores[0], "mid": pass_scores[mid_i], "best": max(pass_scores)}


def bot_entry(bot: str, pass_scores: list[int], won: bool, extra: dict | None = None) -> dict:
    e = {"label": LABELS.get(bot, bot), **summarize_passes(pass_scores), "won": bool(won), "passes": list(pass_scores)}
    if extra:
        e.update(extra)
    return e


def old_entry(path: pathlib.Path, game_title: str, bot: str):
    """This bot's entry from an earlier run of the same game, or None."""
    try:
        old = json.loads(path.read_text())
        return old["bots"].get(bot) if old.get("game") == game_title else None
    except Exception:
        return None


def merge_scores(path: pathlib.Path, game_title: str, new_bots: dict) -> dict:
    """Merge this run's bots into bot-scores.json (bots not run this time keep their old entry)."""
    data = {"game": game_title, "bots": {}}
    if path.exists():
        try:
            old = json.loads(path.read_text())
            if old.get("game") == game_title:
                data["bots"] = old.get("bots", {})
        except Exception:
            pass
    data["bots"].update(new_bots)
    data["updated"] = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    champ = None
    for key, b in data["bots"].items():
        if b.get("best") is None:
            continue
        if champ is None or b["best"] > champ["score"]:
            champ = {"bot": key, "label": b.get("label", key), "score": b["best"], "won": b.get("won", False)}
    data["champion"] = champ
    path.write_text(json.dumps(data, indent=2) + "\n")
    return data


def inject_into_html(html: str, data: dict) -> str:
    if MARK_START not in html or MARK_END not in html:
        raise ValueError("Game file has no BOT-SCORES markers (see GAME_TEST_HOOK_SPEC.md section 8).")
    payload = json.dumps(data, separators=(",", ":")).replace("</", "<\\/")
    a = html.index(MARK_START) + len(MARK_START)
    b = html.index(MARK_END)
    return html[:a] + f"\n<script>window.BOT_SCORES = {payload};</script>\n" + html[b:]


def inject_file(game_path: pathlib.Path, data: dict) -> bool:
    html = game_path.read_text(encoding="utf-8")
    try:
        new = inject_into_html(html, data)
    except ValueError:
        return False
    game_path.write_text(new, encoding="utf-8")
    return True
