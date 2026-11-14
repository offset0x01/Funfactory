# Funfactory

Browser games designed by kids and built with an AI coding agent. Each game is one self-contained HTML file that runs offline on desktops, Chromebooks, iPads and iPhones.

**Play:** https://offset0x01.github.io/Funfactory/

| Game | Folder |
| --- | --- |
| Lost Luggage of the Cosmos | [`games/lost-luggage-of-the-cosmos/`](games/lost-luggage-of-the-cosmos/) |

## How it works

- `index.html` (root) is the game picker. Its `GAMES` list names each game folder.
- `games/<name>/` holds one game: `index.html`, a `HANDOFF.md` for the next coding session, a browser test, and the Home Screen files (manifest, offline helper, icons).
- GitHub Pages publishes `main` automatically, a minute or two after each push.
- `AGENTS.md` is the instruction set for coding agents (OpenCode, Claude Code). `CLAUDE.md` points Claude Code at it.

## Making a new game

Start a coding session on this repo and send:

> Read AGENTS.md and follow it exactly. Build the game below in one pass in a new folder under games/, test it, add it to the home page, commit it, and give me the summary.
>
> [filled-in Game Card from AGENTS.md]

## Playing on iPad or iPhone

Open the game, tap Share, then **Add to Home Screen**, and launch it from the new icon. That gives full screen, tilt controls and offline play. iPhones never let a web page go full screen inside the browser, so the Home Screen icon is the way.

## Testing a game locally

```
pip install playwright
python3 games/<name>/test_game.py games/<name>/index.html
```
