#!/usr/bin/env python3
"""Build Threeble's word list and write it into index.html (between the WORDS markers).

  python3 games/threeble/tools/build_words.py <enable1.txt> <popular.txt>

Sources (both free to use):
  enable1.txt  - the ENABLE word list (public domain), via https://github.com/dolph/dictionary
  popular.txt  - the common-words subset of ENABLE from the same repo (words found in
                 Wiktionary's TV and movie frequency lists). The computer players on Easy and
                 Medium only play these, so they play words a kid knows.

Only words of 2 to 8 letters are kept (the cube is 9 cells across, and the longest play is
7 rack tiles through 1 board tile). Rude words and slurs are
removed using blocked_hashes.txt: each line is "w:<hash>" (that exact word) or "p:<hash>" (every
word starting with it), hashed as sha256("threeble:" + word)[:16] so the list itself isn't
readable in this public repo. Rude words are never valid, for players or the computer.

The packed format: words sorted, each one written as a digit (how many letters it shares with the
word before) plus the rest of its letters; common words have their letters in UPPER case.
"""
import hashlib
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
GAME = HERE.parent / "index.html"


def h(w: str) -> str:
    return hashlib.sha256(("threeble:" + w).encode()).hexdigest()[:16]


def main(enable_path: str, popular_path: str) -> None:
    words = {w.strip().lower() for w in open(enable_path) if re.fullmatch(r"[a-z]{2,8}", w.strip().lower())}
    common = {w.strip().lower() for w in open(popular_path)} & words
    exact, prefix = set(), set()
    for line in (HERE / "blocked_hashes.txt").read_text().split():
        kind, hv = line.split(":")
        (exact if kind == "w" else prefix).add(hv)
    def blocked(w: str) -> bool:
        return h(w) in exact or any(h(w[:n]) in prefix for n in range(2, len(w) + 1))
    keep = sorted(w for w in words if not blocked(w))
    dropped = len(words) - len(keep)
    out, prev = [], ""
    for w in keep:
        n = 0
        while n < min(len(w), len(prev)) and w[n] == prev[n]:
            n += 1
        rest = w[n:]
        out.append(str(n) + (rest.upper() if w in common else rest))
        prev = w
    packed = "".join(out)
    html = GAME.read_text(encoding="utf-8")
    block = f'<script id="words" type="text/plain">{packed}</script>'
    html, k = re.subn(r"(<!-- WORDS-START -->\n).*?(\n<!-- WORDS-END -->)", lambda m: m.group(1) + block + m.group(2), html, flags=re.S)
    if k != 1:
        sys.exit("WORDS markers not found in index.html")
    GAME.write_text(html, encoding="utf-8")
    print(f"{len(keep)} words ({sum(1 for w in keep if w in common)} common), {dropped} rude words removed, {len(packed) // 1024} KB")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
