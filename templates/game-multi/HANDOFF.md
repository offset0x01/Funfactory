# <Game name>: handoff

One or two sentences: what the game is and who asked for it. Read this before changing anything.

**Status (YYYY-MM-DD):** what works, what was tested, what is not done.

This game was copied from the multiplayer starter (`templates/game-multi/`, "Paddle Party"). The section "How multiplayer works" below describes the parts it came with; keep it current if you change them.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole game, including the online code (`NET` section). |
| `test_game.py` | This game's own browser test: rules, one-screen play with four fingers at once, and online play between four tabs through a fake local broker. |
| `TEST_REPORT.md`, `bot-scores.json`, `bot-best-run.json` | Written by the harness `all` run. Don't edit by hand. |
| `manifest.webmanifest`, `sw.js`, icons | Add to Home Screen, full screen and offline play. |

Live: https://offset0x01.github.io/Funfactory/games/<folder>/

## The Game Card it was built from

(paste the card, then each later change request with its date; swap any real names, schools or places for made-up ones first, because this file is public)

## How multiplayer works

- **Modes** (`Game.mode`): `solo` (you at the bottom against the computer; high scores; the test hook and bots use this), `shared` (2 to 4 friends around one device), `online` (2 to 4 devices).
- **Seats:** 0 bottom, 1 top, 2 left, 3 right (`SEATS`). `Game.seats[s]` is `null` for an empty side, or `{ lives, out, cpu }`. Empty sides and players who are out are walls. `Game.me` is the seat this device controls, and `R.view` turns the drawing (and finger positions, via `toView`/`fromView`) so that seat is at the bottom of this screen.
- **Input:** `Input.dir(s)` (keys) and `Input.target(s)` (a finger or held mouse button) for each seat, along the seat's axis. 1 player and online: your arrows (or A/D) mean left and right as you see them (`RIGHT`). One shared keyboard: arrows, A/D, T/G and I/K, as seen on the screen. On a shared screen, a finger belongs to the nearest side still playing, and every finger is tracked by its `pointerId`. On the online host, each friend's input is whatever they last sent (`Input.remote[seat]`).
- **Online:** a star. The host runs the only simulation and sends everyone `{ t: 's', ... }` (ball, paddles, hearts, state) 20 times a second; each friend moves its own paddle at once, sends `{ t: 'i', d, x }`, and draws the host's state in between. The host's lobby lists who joined; Start gives seats in join order (`{ t: 'seat' }`) and locks the room. Pause, resume, play again and leaving are messages, so every screen matches. A friend who leaves becomes a wall; if the host leaves, everyone is told. Nothing is fetched until a player taps Play online.
- **Matchmaking (`NET`):** devices join a topic on free public MQTT brokers (named in `NET_CONFIG`), swap WebRTC handshakes encrypted with a key made from the 5-letter room code (one offer and one answer, each sent only after the browser has gathered all its addresses, `Net.gathered()`), then each friend talks directly to the host. The online screen shows each step: how many matchmaking servers it reached, "Found the game! Linking up...", and whether a friend joined directly or through the relay. **Relay:** if two devices can't link directly within `NET_CONFIG.linkSeconds` (12 s), they switch to sending their game messages through the brokers (`Net.toRelay`), still encrypted, numbered so they're handled in order (`relayIn`), with a ping every 4 s (silence for 20 s = gone) and a goodbye on leaving. The device that gives up asks for the relay every 2 s; the link only counts once the other device answers (`relayWaitSeconds`, 10 s, else the friend is told to check the Build numbers). The host keeps the brokers after Start when anyone is on the relay. **Builds:** a friend's hello carries `window.GAME_BUILD`; a mismatch tells both devices to reload until the Build numbers match. Found on real devices on home Wi-Fi (2026-11-21). Measured over the real public brokers (2026-11-21, home internet, US East): about 100 ms each way through the relay (90% under 220 ms); the first of the three brokers' copies to arrive is used. At this starter's 20 updates a second, one broker (EMQX) dropped about 4 in 10 messages, so if a fast game feels jumpy on the relay, send state to relay friends about 10 times a second and smooth the movement in between. `CFG.MAX_PLAYERS` caps the room (a full room says so). The brokers are dropped when the host taps Start. A TURN server can be added to `NET_CONFIG.ice` if strict networks become a problem.

## Decisions

| Decision | Why |
| --- | --- |
| | |

Include: assumptions made where the card was vague, what was cut, any library added and why plain WebGL wasn't enough.

## Architecture

The order of the sections inside `index.html`, and what each one owns. Note anything a newcomer would trip on.

## Common changes

- **Feel:** which `CFG` numbers to edit (the computer's skill is `CPU_SPEED` and `CPU_AIM_ERROR`; hearts are `LIVES`; room size is `MAX_PLAYERS`).
- **New thing on the field:** add it to the `Game` state, to `sendState()` (host) and `onNet()` (friends), and draw it in `draw()` with `wbox()` so it turns with the view.
- **New input (a button):** add it to `Input`, to the friend's `{ t: 'i' }` message, and to the `'i'` case in `onNet()` on the host.

## Testing

```
python3 test-harness/harness/run_tests.py smoke games/<folder>/index.html   # after every change
python3 games/<folder>/test_game.py                                         # rules, one screen, online with 4 tabs (no internet needed)
python3 test-harness/harness/run_tests.py all games/<folder>/index.html     # before committing
python3 test-harness/harness/check_private.py                                # before pushing
python3 test-harness/harness/check_live.py games/<folder>                    # after pushing
```

- How `progress` is measured (points won, plus a little for each return), and `maxSteps`.
- **Bot scores:** start, mid, best; did it win; any flags it needed.
- **Tight moments** from the timing-tolerance check, as places to playtest.
- **Not tested here:** the real public brokers and STUN servers (the sandbox has no internet). Try a game between two real devices on different networks after publishing. Checked from a real computer (2026-11-21): the three brokers connect and pass messages. The Claude desktop app's built-in browser can't make WebRTC links (not even to itself), so it can't stand in for a second device.

## Build log

One row per build or change. The next session's time estimate is made from these.

| Date | What was built | Expected | Actual |
| --- | --- | --- | --- |
| | | | |

## Sources and credits

Research sources, and every downloaded asset (art, music, sound) with where it came from.

## Open items

- Things not tried on a real device, known rough spots, ideas for next time.
- **Online rejoin (idea, not built):** today a dropped link (a phone locking, a network blip) turns that friend into a wall (or ends the game if the host drops), and coming back needs a new room code. If that gets annoying: keep the room code open for a few minutes after a drop, let the friend tap back into their old seat, and carry on. Build it in `templates/game-multi/` first, with a test that drops and restores a link.
