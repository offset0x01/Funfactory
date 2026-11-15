# <Game name>: handoff

One or two sentences: what the game is and who asked for it. Read this before changing anything.

**Status (YYYY-MM-DD):** what works, what was tested, what is not done.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole game. |
| `test_game.py` | This game's own browser test (rules, screens, touch). |
| `TEST_REPORT.md`, `bot-scores.json` | Written by the harness `all` run. Don't edit by hand. |
| `manifest.webmanifest`, `sw.js`, icons | Add to Home Screen, full screen and offline play. |

Live: https://offset0x01.github.io/Funfactory/games/<folder>/

## The Game Card it was built from

(paste the card, then each later change request with its date)

## Decisions

| Decision | Why |
| --- | --- |
| | |

Include: assumptions made where the card was vague, what was cut, any library added and why plain WebGL wasn't enough.

## Architecture

The order of the sections inside `index.html`, and what each one owns. Note anything a newcomer would trip on.

## Common changes

- **Feel:** which `CFG` numbers to edit.
- **New level / enemy / item:** the places to touch, in order.

## Testing

```
python3 test-harness/harness/run_tests.py smoke games/<folder>/index.html   # after every change
python3 games/<folder>/test_game.py
python3 test-harness/harness/run_tests.py all games/<folder>/index.html     # before committing
```

- How `progress` is measured, and `maxSteps`.
- **Bot scores:** start, mid, best; did it win; any flags it needed (`--extra-passes`).
- **Tight moments** from the timing-tolerance check, as places to playtest.

## Sources and credits

Research sources, and every downloaded asset (art, music, sound) with where it came from.

## Open items

- Things not tried on a real device, known rough spots, ideas for next time.
