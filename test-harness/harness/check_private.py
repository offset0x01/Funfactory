#!/usr/bin/env python3
"""Before pushing: check that nothing personal is about to be published.

  python3 test-harness/harness/check_private.py

The repo and the site are public. This scans every file in the repo, and every commit that is
not on origin/main yet (who made it, and its message), for:

  - email addresses, home-folder paths, keys and tokens, phone numbers
  - links to private chat or agent sessions (for example a "Claude-Session:" line)
  - commits made under a real name or email, not the neutral builder identity
  - any word listed in `.private-words` at the repo root (optional; one per line: names, school,
    town). That file is git-ignored, so the list is never published.

Exit code 0 = clean, 1 = something to fix (each problem is listed with how to fix it).
`--all-commits` checks the whole history, not only the commits waiting to be pushed.
"""
from __future__ import annotations

import argparse
import pathlib
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from gamebot.privacy import OK_EMAIL, private_words, scan_folder, scan_text  # noqa: E402

ROOT = HERE.parents[1]
IDENTITY = 'git config user.name "Funfactory Builder" && git config user.email "builder@funfactory.invalid"'


def git(*args: str) -> str:
    return subprocess.run(["git", "-C", str(ROOT), *args], capture_output=True, text=True).stdout


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--all-commits", action="store_true", help="check every commit, not only the unpushed ones")
    a = ap.parse_args()
    words = private_words(ROOT)
    problems = [f"file {line}" for line in scan_folder(ROOT, words)]

    has_origin = bool(git("rev-parse", "--verify", "-q", "origin/main").strip())
    rng = ["HEAD"] if a.all_commits or not has_origin else ["origin/main..HEAD"]
    bad_identity = False
    for rec in git("log", "--format=%h%x1f%an%x1f%ae%x1f%cn%x1f%ce%x1f%B%x1e", *rng).split("\x1e"):
        if not rec.strip():
            continue
        h, an, ae, cn, ce, msg = rec.strip().split("\x1f")
        for who, email in ((an, ae), (cn, ce)):
            if not OK_EMAIL.search(email):
                problems.append(f"commit {h}: made as {who} <{email}>, which would be public")
                bad_identity = True
        for what, bit in scan_text(msg, words):
            problems.append(f"commit {h} message: {what} ({bit})")

    # the identity the NEXT commit would use
    email = git("config", "user.email").strip()
    if email and not OK_EMAIL.search(email):
        problems.append(f"git is set to commit as {git('config', 'user.name').strip()} <{email}>")
        bad_identity = True

    if not problems:
        print(f"Privacy check passed ({'with' if words else 'no'} .private-words list).")
        return
    print("PRIVACY CHECK FAILED. Fix these before pushing:")
    for p in dict.fromkeys(problems):
        print("  " + p)
    print("\nHow to fix:")
    print("  - In files: replace the detail with something made up, or delete it.")
    if bad_identity:
        print(f"  - Identity: run  {IDENTITY}")
        print('    then redo the commit:  git commit --amend --reset-author --no-edit')
    print('  - Commit messages: git commit --amend, and delete the line (session links, names, emails).')
    sys.exit(1)


if __name__ == "__main__":
    main()
