# Comet Catcher: handoff

An arcade catching game: a cartoon space dog with a net runs along a moon-park floor, catching 30 glowing falling comets in 60 seconds while dodging space rocks. Built from the Funfactory starter for a young player's Game Card. Read this before changing anything.

**Status (2026-11-15):** first version complete and passing: smoke, `test_game.py` (21 checks) and `all` (Evolution Bot won; see Testing). Played through in the headless browser with the keyboard and on a phone-sized touch screen, and touch-verified again under real WebKit (the Safari engine) at iPhone and iPad sizes. Not yet played on a real iPad or iPhone (see Open items).

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole game (all code, art and sound in one file). |
| `test_game.py` | This game's own browser test (catching, missing, rocks, magnet, life-backs, timer, win/lose, touch buttons). |
| `TEST_REPORT.md`, `bot-scores.json`, `bot-best-run.json` | Written by the harness `all` run. Don't edit by hand. |
| `manifest.webmanifest`, `sw.js`, icons | Add to Home Screen, full screen and offline play. Icons are a comet drawn in PIL. |

Live: https://offset0x01.github.io/Funfactory/games/comet-catcher/

## The Game Card it was built from

From a Game Studio request (2026-11-15):

- **Game name:** Comet Catcher
- **Kind:** arcade catching game
- **I play as:** a little space dog holding a net
- **Goal:** catch 30 falling comets in 60 seconds
- **Lose:** miss 5 comets
- **Controls:** left and right (touch buttons on phones)
- **Obstacles:** space rocks to dodge, touching one costs a life
- **Power-up:** a magnet bone that pulls comets toward you for 5 seconds
- **Looks:** bright cartoon, dark blue space, glowing comets
- **Sounds:** cheerful bleeps and a woof when you catch one
- **Like:** Fruit Ninja meets Space Invaders
- **Coolest thing:** comets leave sparkly trails

## Decisions

| Decision | Why |
| --- | --- |
| Missed comets and rock bumps share one pool of 5 lives | The card says "miss 5 comets" and rocks "cost a life"; one pool keeps both rules and the HUD simple. `Game.hits` counts them for the hook; `Game.lives` can go back up (next row). |
| Every 10 catches in a row win a life back (up to 5) | With comets landing every ~1.3 s, 5 total misses is brutal for kids; streak life-backs forgive early slips without changing the card's numbers. It also gives losing runs a comeback story. |
| **Fairness rule in `spawnComet()`:** no comet may reach the net sooner than `MIN_GAP` (1.4 s) after the last one still in the air (its fall speed is lowered if needed) | Without it, two comets can demand positions 14 units apart within 1 s — impossible even for a perfect player. One dog crosses the field in 1.33 s (`DOG_SPEED` 12 over 16 units), so 1.4 s spacing makes every catch reachable. |
| Rocks never spawn within `ROCK_AWAY` (2.6 units) of the dog's current x, and none before t=3.4 s | Rocks are dodgeable, never ambush a player who stands still (the harness checks the first 3 s), and the dog must move into danger itself. |
| Win = 30 caught; lose = 5th pool hit or time up at 60 s | Exactly the card. Win bonuses: +5 points per second left, +25 per life left, so finishing fast and flawlessly pays. |
| Catch scores 10 + 2 per streak step (max +20); bone +25 | Streaks reward clean play; the score table then spreads 300–1100+. |
| Magnet bone: 5 s pull, strength 2.6 u/s, range 6.5 u, falls ~every 10 s (first at 6.5 s) | The card's power-up. Pull is proportional (no overshoot), affects comets and bones above the net line. A "Magnet: 4.2s" chip shows in the HUD. |
| The dog only runs left/right; the net is fixed just above its head | The card's controls. Keyboard arrows/A-D, two big touch buttons (104x84) bottom corners, P/Esc + pause button. |
| Comets: icy cyan and warm gold, glowing heads, 15-point sparkly trails; rocks: craggy gray octagons that spin | The card's "bright cartoon, dark blue space, glowing comets" and "coolest thing: sparkly trails". Rocks are instantly readable as danger. |
| All sound synthesized in WebAudio; a two-bark "woof" plus a rising bleep per catch | The card's sounds. Pitch rises with the streak; last-5-second ticks; win fanfare / lose slide. |
| Plain WebGL, no library; all art drawn in code, icons drawn in PIL | A 2D scene of quads and triangle fans is a few hundred lines; nothing here needs a library. No outside assets, so nothing to license. |

What was cut or simplified: nothing from the card. The dog has no vertical movement (the card says left/right only), and tilt was not requested so it is not offered.

## Architecture

Sections inside `index.html`, in order:

1. **CONFIG**: every tuning number in `CFG` (`GAME_ID` must equal the folder name; `SCORE_NAME` is "points").
2. **Seeded random numbers** (`rand()`), **saved data** (`store`, `Scores`), **Sound** (beeps, slides, woof, fanfares — all from `tone()`).
3. **Input**: one object; the game reads only `Input.x()`. Keyboard, two touch buttons and the test hook feed it.
4. **Game**: `start(seed)`, spawners (`spawnComet` with the MIN_GAP fairness rule, `spawnRock`, `spawnBone`), `update(dt)` in this order: clock and last-5 ticks, dog, magnet timer, spawns, comets (drift, magnet pull, catch, miss), rocks (fall, bump, shatter), bones, sparkle/dust fx. `progress()`, `end()`, `loseLife()`, `burst()`.
5. **Renderer**: `tri/rect` in screen pixels; `wrect`, `wcirc`, `wring`, `wline`, `wrock` in world units (world y grows downward, row 0 is the top). `draw()` paints space, ringed planet, floor band, comet trails, rocks, bones, dog + net, fx.
6. **Screens and HUD**: `UI` (comets/score/time/lives-dots/magnet chip, "+12" popups over the net, high scores, initials).
7. **Full screen**, **main loop** (fixed 1/60 s steps), **hosting extras**, **TEST HOOK**.

Things a newcomer might trip on:

- World y is 0 at the top and 9 at the bottom (screen convention). Comets fall from y = -0.6 to the net line y = 6.9; the floor is y = 8.55; the dog stands at y = 8.15.
- Everything that changes gameplay uses the seeded `rand()`. Sparkles/dust (`fx`, `burst()`) use `Math.random` and never touch the rules, so the same seed always plays the same.
- `spawnComet` lowers a comet's `vy` when landings would crowd: comets each carry their own fall speed.
- `Game.lives` can grow back (streaks); use `Game.hits` for "lives lost since reset" (the hook reports it as `livesLost`).

## Common changes

- **Feel:** `DOG_SPEED`, `NET_HALF` (catch width), `NET_BAND` (catch height), `COMET_FALL0/1`, `COMET_EVERY0/1`, `MIN_GAP`.
- **Easier or harder:** `LIVES`, `ROCK_EVERY0/1` (rock traffic), `LIFE_BACK` (set it to 99 to switch life-backs off), `TIME_LIMIT`, `WIN_AT`.
- **The magnet:** `MAGNET_SECONDS`, `MAGNET_PULL`, `MAGNET_RANGE`, `BONE_EVERY`.
- **A new falling thing:** add a spawner + an array like `bones`, give it a fall/catch/miss branch in `update`, a look in `draw`, a letter in `observe()`, and checks in `test_game.py`.
- **New look for the dog:** everything is in the `if (d.safe <= 0 || ...)` block in `draw()`, in world units, so edits are easy to eyeball.

## Testing

```
python3 test-harness/harness/run_tests.py smoke games/comet-catcher/index.html   # after every change
python3 games/comet-catcher/test_game.py
python3 test-harness/harness/run_tests.py all games/comet-catcher/index.html     # before committing
python3 test-harness/harness/check_private.py                                   # before pushing
python3 test-harness/harness/check_live.py games/comet-catcher                    # after pushing
```

- **`progress`:** caught comets fill it (1/30 each), plus up to 0.9 of one comet for how far the *aligned* next comet (within the net's x reach) has fallen toward the net, so it grows with every real step forward. `stallSeconds` is 5 (the first comet needs ~3 s to reach the net). `maxSteps` is 3960 (66 s at 60 steps/s; the 60-second timer ends a run first).
- **Winnability proof:** a closed-loop autopilot that decides every 150 ms (the harness's fastest human input) through the hook wins flawlessly on seed 1 — 30/30 caught, no misses, no rock bumps, 17.6 s left — and on seeds 2-5 with at most 3 pool hits.
- **Bot scores:** Evolution Bot — start 1040, mid 1065, best 1065 (passes: 1040, 1065, 1065), won on pass 1 with 0 lives lost; searched from scratch in about 2 minutes (111 s for all three passes).
- **Tight moments:** the timing check kept 43/48 (90%) of 40 ms nudged replays — the wide net and the arrival spacing make catching tolerant; the tight ones were at 25.1 s and 42.0 s (dense mid-game comets). All fairness checks pass (standing still is safe, idling and mashing don't win).

## Build log

One row per build or change. The next session's time estimate is made from these.

| Date | What was built | Expected | Actual |
| --- | --- | --- | --- |
| 2026-11-15 | First version (dog + net, comets with trails, rocks, magnet bone, streak life-backs, sounds, hook, tests, icons, home page entry) | 60 min | 18 min |

For estimates: the first bot search from nothing took about 2 minutes (won on pass 1). While the saved best run still wins, `all` takes well under a minute.

## Sources and credits

All art, icons and sound are made in code by the Funfactory builder (plain WebGL shapes, WebAudio oscillators, PIL icons); no downloaded assets.

Design research (ideas only, nothing copied):

- "How to increase difficulty of a catching game", https://gamedev.stackexchange.com/questions/203522/how-to-increase-difficulty-of-a-catching-game — punish misses, ramp speed and frequency, add angled falls (the card's ramp, drift and the miss pool).
- The card's own touchstones: Fruit Ninja (fast catching streaks) and Space Invaders (things raining from the sky).

## Open items

- Not played on a real iPad or iPhone yet. WebKit emulation (Playwright WebKit 27.2, installed in that sandbox: `playwright install webkit && playwright install-deps webkit`) already passed at iPhone size (390x844), iPad portrait (820x1180) and iPad landscape (1180x820): WebGL draws on all three, real touches fire the full pointer chain into the buttons, touch-holds move the dog, the pause/resume buttons work, the page never scrolls, and there are no console errors when served over HTTP. Still worth a human check on hardware: finger feel, edge swipes, audio through speakers, Add to Home Screen. (Note: opening the file over `file://` in WebKit logs one harmless console error — it eagerly fetches `manifest.webmanifest` with a `null` origin; served from the site this does not happen.)
- **Cloud device testing (BrowserStack) was tried and ruled out** for this build, for two independent reasons:
  1. It needs an account and an API access key. None exists in this environment (no credentials in env vars, no config files; the API at `api-cloud.browserstack.com` answers `401 HTTP Basic: Access denied` without them), and creating an online account is outside what this build job may do (AGENTS.md: no online accounts; a signup also needs a person's email).
  2. While the game is unreviewed and unpushed there is no public URL for a cloud device to load — GitHub Pages serves `main`, and the game lives on an unpushed branch. BrowserStack's own docs route localhost/private content through their "Local Testing" tunnel binary, which also authenticates with the account's access key.
  If someone with a BrowserStack (or similar) account wants to run it after publishing, the public URL https://offset0x01.github.io/Funfactory/games/comet-catcher/ opens directly in Live testing on any iOS device, with no tunnel needed.
- Is 1.4 s the right `MIN_GAP`? Playtest: lower it (harder, denser) only after watching a real kid play.
- Ideas the player could ask for next: a golden comet that's worth double, a second dog (two thumbs, two dogs), rock combos that shatter into harmless pebbles, a hard mode with 45 seconds.
