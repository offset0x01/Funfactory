# Funfactory

Browser games designed by kids and built with an AI coding agent. Each game is one self-contained HTML file that runs offline on iPads, iPhones, Chromebooks and desktops, with touch and keyboard controls.

**Play:** https://offset0x01.github.io/Funfactory/

| Game | Folder |
| --- | --- |
| Comet Catcher | [`games/comet-catcher/`](games/comet-catcher/) |
| Space Egg Quest | [`games/space-egg-quest/`](games/space-egg-quest/) |
| Lost Luggage of the Cosmos | [`games/lost-luggage-of-the-cosmos/`](games/lost-luggage-of-the-cosmos/) |

## How it works

- `index.html` (root) is the game picker. Its `GAMES` list names each game folder.
- `games/<name>/` holds one game: `index.html`, a `HANDOFF.md` for the next coding session, its own browser test, the harness's files (`TEST_REPORT.md`, `bot-scores.json`, `bot-best-run.json`), and the Home Screen files (manifest, offline helper, icons).
- `classics/<name>/` holds free, openly licensed games made by other people, each with its `LICENSE` and a `NOTICE.md` (source, author, what we changed). They show on the home page's Classics shelf (`CLASSICS` list). Game sessions, the Game Studio and the test harness leave them alone.
- GitHub Pages publishes `main` automatically, a minute or two after each push.
- `AGENTS.md` is the build spec and the **source of truth** for making games on any platform (Claude, Claude Code, OpenCode). `CLAUDE.md` points Claude Code at it, and `CHANGELOG.md` records changes to it.
- `templates/game/` is the starter every new game is copied from: a tiny complete game with touch and keyboard controls, high scores, offline play and the test hook already working. `templates/game-2p/` is the two-player starter: against the computer, two players on one screen, or two players online with a room code.
- `test-harness/` holds the game test-hook contract and the test harness: quick checks of the rules every game follows, bots that prove a game can be won, fairness checks, a privacy check, and a check that a pushed game is live.

## Making a new game

Start a coding session on this repo and send:

> Read AGENTS.md and follow it exactly. Tell me your plan and how long you expect it to take, then build the game below in one pass in a new folder under games/, test it, add it to the home page, commit it, and give me the summary with how long it really took.
>
> [filled-in Game Card from AGENTS.md]

To change a game, send:

> Read AGENTS.md and games/<name>/HANDOFF.md and follow "Changing an existing game". Tell me your plan and how long you expect it to take, and at the end how long it really took. Here is what I want changed: ...

Either way the agent states its plan and expected build time first, starts without waiting, and reports the actual time at the end. Each game's HANDOFF.md keeps a Build log of both.

## Privacy

This repo and the site are public. The rules are in `AGENTS.md` ("Privacy"): no real names, schools or places, no photos or voices of real people, commits made under a neutral identity, and no chat-session links in commit messages. `check_private.py` enforces what a script can.

To have it also block specific words (family names, a school, a town), list them one per line in a file called `.private-words` at the repo root on your own computer. Git ignores that file, so the list is never published. Sessions on other machines won't have the list, so the written rules still matter.

Every page asks search engines not to list it (`noindex`). That keeps the site out of search results; it does not hide it from anyone who has the link.

## Playing on iPad or iPhone

Open the game, tap Share, then **Add to Home Screen**, and launch it from the new icon. That gives full screen, tilt controls and offline play. iPhones never let a web page go full screen inside the browser, so the Home Screen icon is the way.

## Testing a game locally

Run from the repo root:

```
pip install -r test-harness/requirements.txt                               # once
python3 test-harness/harness/run_tests.py smoke games/<name>/index.html   # quick check, about 20 s
python3 games/<name>/test_game.py                                          # the game's own test
python3 test-harness/harness/run_tests.py all games/<name>/index.html     # bots and fairness, before committing
python3 test-harness/harness/check_private.py                              # before pushing: nothing personal?
python3 test-harness/harness/check_live.py games/<name>                    # after pushing: is it live?
```

`all` fails unless a bot can win the game. Details and flags: `test-harness/README.md`.
