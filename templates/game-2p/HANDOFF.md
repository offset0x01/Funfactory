# <Game name>: handoff

One or two sentences: what the game is and who asked for it. Read this before changing anything.

**Status (YYYY-MM-DD):** what works, what was tested, what is not done.

This game was copied from the two-player starter (`templates/game-2p/`, "Paddle Duel"). The section "How two-player works" below describes the parts it came with; keep it current if you change them.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole game, including the online code (`NET` section). |
| `test_game.py` | This game's own browser test: rules, one-screen play with two fingers, and online play between two tabs through a fake local broker. |
| `TEST_REPORT.md`, `bot-scores.json`, `bot-best-run.json` | Written by the harness `all` run. Don't edit by hand. |
| `manifest.webmanifest`, `sw.js`, icons | Add to Home Screen, full screen and offline play. |

Live: https://offset0x01.github.io/Funfactory/games/<folder>/

## The Game Card it was built from

(paste the card, then each later change request with its date; swap any real names, schools or places for made-up ones first, because this file is public)

## How two-player works

- **Modes** (`Game.mode`): `solo` (you at the bottom against the computer; high scores; the test hook and bots use this), `shared` (two people, one device), `online` (two devices).
- **Players:** paddle 0 is at the bottom of the field, paddle 1 at the top. `Game.me` is the one this device controls. The online guest is player 1 and its screen is drawn upside down (`R.flip`), so everyone sees themselves at the bottom.
- **Input:** `Input.dir(i)` (keys) and `Input.target(i)` (a finger or held mouse button) for each player. Shared screen: the bottom half of the screen and the arrow keys are player 0; the top half and A/D are player 1. Every finger is tracked by its `pointerId`, so two players can drag at once. On the online host, player 1's input is whatever the guest last sent (`Input.remote`).
- **Online:** the host runs the only simulation. It sends `{ t: 's', ... }` with the ball, paddles, points and state 20 times a second; the guest moves its own paddle at once, sends `{ t: 'i', d, x }`, and draws the host's state in between. Pause, resume, play again and quit are sent as messages, so both screens always match. Nothing is fetched until a player taps Play online.
- **Matchmaking (`NET`):** both devices join a topic on free public MQTT brokers (named in `NET_CONFIG`), swap a WebRTC handshake encrypted with a key made from the 5-letter room code, then talk directly. The brokers are dropped once connected. One friend per room. A TURN server can be added to `NET_CONFIG.ice` if strict networks become a problem.

## Decisions

| Decision | Why |
| --- | --- |
| | |

Include: assumptions made where the card was vague, what was cut, any library added and why plain WebGL wasn't enough.

## Architecture

The order of the sections inside `index.html`, and what each one owns. Note anything a newcomer would trip on.

## Common changes

- **Feel:** which `CFG` numbers to edit (the computer's skill is `CPU_SPEED` and `CPU_AIM_ERROR`).
- **New thing on the field:** add it to the `Game` state, to `sendState()` (host) and `onNet()` (guest), and draw it in `draw()`.
- **New input (a button):** add it to `Input`, to the guest's `{ t: 'i' }` message, and to `Game.remote()` on the host.

## Testing

```
python3 test-harness/harness/run_tests.py smoke games/<folder>/index.html   # after every change
python3 games/<folder>/test_game.py                                         # rules, one screen, online (no internet needed)
python3 test-harness/harness/run_tests.py all games/<folder>/index.html     # before committing
python3 test-harness/harness/check_private.py                                # before pushing
python3 test-harness/harness/check_live.py games/<folder>                    # after pushing
```

- How `progress` is measured (points won, plus a little for each return), and `maxSteps`.
- **Bot scores:** start, mid, best; did it win; any flags it needed.
- **Tight moments** from the timing-tolerance check, as places to playtest.
- **Not tested here:** the real public brokers and STUN servers (the sandbox has no internet). Try a game between two real devices on different networks after publishing.

## Build log

One row per build or change. The next session's time estimate is made from these.

| Date | What was built | Expected | Actual |
| --- | --- | --- | --- |
| | | | |

## Sources and credits

Research sources, and every downloaded asset (art, music, sound) with where it came from.

## Open items

- Things not tried on a real device, known rough spots, ideas for next time.
