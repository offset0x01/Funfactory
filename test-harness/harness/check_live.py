#!/usr/bin/env python3
"""After pushing: check that the live site is serving exactly what is in the repo.

  python3 test-harness/harness/check_live.py games/<name>

GitHub Pages takes a minute or two to publish a push, so this keeps trying (5 minutes by default)
until the live copy of every file in the game's folder that the site serves matches the local
one, and the game is listed on the home page. Exit codes:

  0  live and up to date
  1  the site answered, but a file is missing or still old after waiting (publishing is stuck,
     or the push didn't happen)
  2  the site could not be reached from here at all (many sandboxes block it). Not a failure of
     the game: say so in the summary and ask the player to open the link.
"""
from __future__ import annotations

import argparse
import pathlib
import sys
import time
import urllib.error
import urllib.request

BASE = "https://offset0x01.github.io/Funfactory"
SERVED = ["index.html", "manifest.webmanifest", "sw.js", "icon-192.png", "icon-512.png", "apple-touch-icon.png"]


def fetch(url: str):
    """Returns (bytes, None), or (None, 'missing') for a 404, or (None, 'unreachable: why')."""
    req = urllib.request.Request(f"{url}?nocache={time.time_ns()}", headers={"Cache-Control": "no-cache", "User-Agent": "funfactory-check"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.read(), None
    except urllib.error.HTTPError as e:
        return None, "missing" if e.code == 404 else f"unreachable: HTTP {e.code}"
    except Exception as e:  # DNS, proxy, TLS, timeout
        return None, f"unreachable: {e}"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("game", help="the game's folder, e.g. games/lost-luggage-of-the-cosmos")
    ap.add_argument("--base", default=BASE, help="site address (default: the Funfactory GitHub Pages site)")
    ap.add_argument("--wait", type=int, default=300, help="seconds to keep trying (default 300)")
    a = ap.parse_args()

    folder = pathlib.Path(a.game).resolve()
    if folder.is_file():
        folder = folder.parent
    root = folder.parents[1]
    name, base = folder.name, a.base.rstrip("/")
    todo = {f"games/{name}/{f}": folder / f for f in SERVED if (folder / f).exists()}
    deadline = time.time() + a.wait
    problems = {}
    while True:
        problems = {}
        for path, local in todo.items():
            data, err = fetch(f"{base}/{path}")
            if err and err.startswith("unreachable"):
                print(f"Could not reach {base} from here ({err[13:][:120]}).\nThe game may still be live: open {base}/games/{name}/ to check.")
                sys.exit(2)
            if err or data != local.read_bytes():
                problems[path] = err or "old version"
        home, err = fetch(f"{base}/")
        if home is None or f"'{name}'".encode() not in home and f'"{name}"'.encode() not in home:
            problems["home page"] = f"'{name}' is not in the GAMES list on the live home page"
        if not problems or time.time() > deadline:
            break
        print(f"  not live yet ({', '.join(problems)}); trying again in 15 s")
        time.sleep(15)

    if problems:
        print(f"NOT LIVE after {a.wait} s:")
        for path, why in problems.items():
            print(f"  {path}: {why}")
        print("Check that the push reached main (git status, git log origin/main) and the repo's Pages build.")
        sys.exit(1)
    print(f"LIVE and up to date: {base}/games/{name}/  ({len(todo)} files match, listed on the home page)")


if __name__ == "__main__":
    main()
