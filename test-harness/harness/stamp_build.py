#!/usr/bin/env python3
"""Stamp a game with its build number, right before the commit that publishes it.

  python3 test-harness/harness/stamp_build.py games/<name>
  python3 test-harness/harness/stamp_build.py games/<name> --at 2026-11-16T15:01:00Z   # a past build

The build number is the US Eastern date and time of the build: 2026.11.16-1101 for 11:01 on Nov 16.
It is written in two places, so players can tell when an update has come through:
  games/<name>/index.html  between the BUILD markers, as window.GAME_BUILD (the title screen shows it)
  games/<name>/build.json  {"build": "..."} (the home page shows it on the game's card)
The markers are added before the BOT-SCORES markers if the game doesn't have them yet.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import pathlib
import re
import sys

START, END = "<!-- BUILD-START -->", "<!-- BUILD-END -->"


def eastern(t: dt.datetime) -> dt.datetime:
    """UTC to US Eastern without tzdata: daylight time from 2 a.m. on the second Sunday of March
    to 2 a.m. on the first Sunday of November (local time)."""
    t = t.astimezone(dt.timezone.utc).replace(tzinfo=None)
    y = t.year
    sunday = lambda month, n: dt.datetime(y, month, 1) + dt.timedelta(days=(6 - dt.date(y, month, 1).weekday()) % 7 + 7 * (n - 1))
    dst_start = sunday(3, 2) + dt.timedelta(hours=2 + 5)  # 2 a.m. EST in UTC
    dst_end = sunday(11, 1) + dt.timedelta(hours=2 + 4)  # 2 a.m. EDT in UTC
    return t - dt.timedelta(hours=4 if dst_start <= t < dst_end else 5)


def build_number(t: dt.datetime) -> str:
    return eastern(t).strftime("%Y.%m.%d-%H%M")


def stamp(folder: pathlib.Path, build: str) -> None:
    page = folder / "index.html"
    html = page.read_text()
    block = f'{START}\n<script>window.GAME_BUILD = "{build}";</script>\n{END}'
    if START in html:
        html = re.sub(re.escape(START) + r".*?" + re.escape(END), lambda _: block, html, count=1, flags=re.S)
    elif "<!-- BOT-SCORES-START -->" in html:
        html = html.replace("<!-- BOT-SCORES-START -->", f"<!-- The build number, written by stamp_build.py right before publishing. -->\n{block}\n<!-- BOT-SCORES-START -->", 1)
    else:
        sys.exit(f"{page}: no BUILD or BOT-SCORES markers to put the build number next to")
    page.write_text(html)
    (folder / "build.json").write_text(json.dumps({"build": build}) + "\n")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("folder", help="the game's folder, games/<name>")
    ap.add_argument("--at", help="ISO time of the build (default: now)")
    a = ap.parse_args()
    t = dt.datetime.fromisoformat(a.at.replace("Z", "+00:00")) if a.at else dt.datetime.now(dt.timezone.utc)
    build = build_number(t)
    stamp(pathlib.Path(a.folder), build)
    print(f"Build {build}")


if __name__ == "__main__":
    main()
