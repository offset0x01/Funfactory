"""Privacy check: the repo and the site are public, so nothing personal may be committed.

Looks for things that are personal whatever the game is: email addresses, home-folder paths,
keys and tokens, phone numbers, and links to private chat or agent sessions. It also reads an
optional list of words to block (names, school, town) from `.private-words` at the repo root,
one per line. That file is git-ignored, so the list itself is never published.
"""
from __future__ import annotations

import pathlib
import re

OK_EMAIL = re.compile(r"(noreply@anthropic\.com|@users\.noreply\.github\.com|@example\.(com|org)|\.invalid|@2x\.|@3x\.)$", re.I)
PATTERNS = [
    ("email address", re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}")),
    ("home-folder path", re.compile(r"(?:/Users/|/home/|[A-Za-z]:\\Users\\)[A-Za-z0-9._-]+")),
    ("key or token", re.compile(r"sk-[A-Za-z0-9]{20,}|sk-(?:or|ant|proj)-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{12,}|BEGIN [A-Z ]*PRIVATE KEY|Bearer [A-Za-z0-9._-]{20,}")),
    ("phone number", re.compile(r"(?<![\w-])(?:\(\d{3}\) ?|\d{3}[-.])\d{3}[-.]\d{4}(?![\w-])")),
    ("link to a private chat or agent session", re.compile(r"claude\.ai/(?:code|chat|share)/[A-Za-z0-9_-]+|chatgpt\.com/(?:c|share)/[A-Za-z0-9-]+|Claude-Session:", re.I)),
]
SKIP_DIRS = {".git", "test-results", "__pycache__", "node_modules"}
SELF = {"privacy.py", "check_private.py"}   # these two files spell out the patterns


def private_words(root: pathlib.Path) -> list[str]:
    f = root / ".private-words"
    if not f.exists():
        return []
    return [w.strip() for w in f.read_text(encoding="utf-8", errors="replace").splitlines() if w.strip() and not w.startswith("#")]


def scan_text(text: str, words: list[str] = ()) -> list[tuple[str, str]]:
    """Returns [(what, the offending bit)] for one piece of text."""
    found = []
    for what, rx in PATTERNS:
        for m in rx.finditer(text):
            if what == "email address" and OK_EMAIL.search(m.group(0)):
                continue
            found.append((what, m.group(0)[:60]))
    low = text.lower()
    for w in words:
        if re.search(r"(?<![a-z0-9])" + re.escape(w.lower()) + r"(?![a-z0-9])", low):
            found.append(("word from .private-words", w))
    return found


def scan_folder(folder: pathlib.Path, words: list[str] = ()) -> list[str]:
    """Scans every text file under `folder`. Returns lines like 'path: what (bit)'."""
    out = []
    for p in sorted(folder.rglob("*")):
        if not p.is_file() or SKIP_DIRS & set(p.relative_to(folder).parts) or p.name in SELF or p.name == ".private-words":
            continue
        try:
            text = p.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue   # images and other binary files
        seen = set()
        for what, bit in scan_text(text, words):
            if (what, bit) not in seen:
                seen.add((what, bit))
                out.append(f"{p.relative_to(folder)}: {what} ({bit})")
    return out
