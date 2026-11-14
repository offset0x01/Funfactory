# Lost Luggage of the Cosmos: handoff

A three-level 2D platformer built from a Game Card as the first test of the kids' game-builder prompt. Read this before changing anything; it covers what exists, why it was built this way, and where to make common changes.

**Status (2026-11-14):** test hook added and the harness passes; v1.1 complete and playable, with a 30-second demo mode and a full-screen button. All automated tests pass. Tilt has not been tried on a real iPad yet (see Open items).

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole game. Source of truth. Open it directly, or serve the folder over HTTPS. |
| `test_game.py` | Headless Chrome test (Playwright). Run after every change. |
| `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | Add to Home Screen: name, icon, full screen, landscape, and offline play. `sw.js` serves the saved copy first and downloads updates in the background; bump `CACHE` when the file list changes. |
| `HANDOFF.md` | This file. |

Live site: https://offset0x01.github.io/Funfactory/games/lost-luggage-of-the-cosmos/ (GitHub Pages from the `offset0x01/Funfactory` repo, listed on the root game picker).

Published copy: a Claude artifact titled "Lost Luggage of the Cosmos". It is `index.html` with the wrapper stripped (see "Publishing as a Claude artifact").

## The Game Card it was built from

- **Name:** Lost Luggage of the Cosmos
- **Kind:** 2D platformer, three short levels
- **Device:** mobile game for iPad (touch, plus tilt where it makes sense)
- **Player:** a space courier in fuzzy slippers
- **Goal:** deliver a mystery parcel across a junkyard planet, a malfunctioning cruise ship and a talking asteroid
- **Bad guys:** grumpy vending-machine robots and bouncing space jellies
- **Obstacles:** gravity-flip zones and conveyor belts that push you backward
- **Coolest thing:** a jetpack burp that gives you a double jump ("Fizzy Jet")

## Decisions

| Decision | Why |
| --- | --- |
| One self-contained `index.html`, no libraries, no network at runtime | The baseline prompt requires it. It plays offline, works from GitHub Pages, any static host, or a Claude artifact, and keeps working for years. |
| Plain WebGL (a ~60-line batched triangle renderer) instead of Phaser or Three.js | It was built in a session with no package installs, and the prompt says a no-build-tools session writes plain WebGL. It also keeps the file small (about 65 KB). Swapping in Phaser later is fine if a session can bundle it inline. |
| All art is drawn in code from rectangles, triangles and circles | No asset files to embed; easy to recolor. Characters are original. |
| All sound is synthesized with WebAudio | Same reason. Audio starts only after the first tap or key (iOS rule). |
| HTML overlays for HUD, menus and touch buttons; WebGL only for the world | Text and buttons are far easier and more accessible in HTML. |
| Levels are ASCII maps in the `LEVELS` array | Kids can edit levels in a text editor and see the shape of the level. |
| Fixed 1/120 s physics step, render every frame | Same game feel at 60 Hz and 120 Hz (ProMotion iPads). |
| Tilt uses `devicemotion` gravity, not `deviceorientation` angles | Works whether the iPad is flat or held upright like a steering wheel; orientation angles break when the device is upright. |
| Keyboard always works, touch buttons appear on touch devices, tilt is opt-in | Prompt rule: keyboard by default, touch for mobile, tilt where it makes sense with touch fallback. |
| Forgiving controls: coyote time, jump buffer, short hop on early release, stomp bounce | Kids are the players. |
| Enemies only hurt from the side; landing on them defeats them | Classic, readable rule. |
| Fizzy Jet ability is per level and survives respawns | Each level hands out a can before the first wall that needs it. |
| Body pinned with `position: fixed; inset: 0`, and `html` uses `box-sizing: border-box` | The Claude artifact viewer pads the page for phone safe areas; without this the page grew taller than the screen and scrolled. The test checks for it. |
| Title-screen full-screen button is always shown; the HUD one only where supported | Fullscreen works in desktop browsers and iPad Safari, not on iPhone or in some app views. On iPad, Add to Home Screen also gives a full-screen game (the page has the `apple-mobile-web-app-capable` meta). |
| Demo mode never loses lives | It exists so people can watch the game where they cannot play it (for example inside the Claude artifact viewer); it should always look like a clean run. |

## Architecture (inside `index.html`)

The page content sits between the `GAME-START` and `GAME-END` comments. The script is one block, in this order:

1. **CONFIG** (`CFG`): every tuning number. Units are tiles and seconds. Jump height ≈ `JUMP_V² / (2·GRAVITY)` ≈ 2.4 tiles; Fizzy Jet adds ≈ 2 tiles.
2. **LEVELS**: array of level objects (format below).
3. **Helpers**: color helpers (`hex`, `shade`), seeded `rng`, `store` (localStorage wrapped in try/catch, keys prefixed `llotc.`).
4. **Sound**: `unlock()`, `sfx(name)`, and a tiny step sequencer (`startMusic(song)`) driven by each level's `music`.
5. **Input**: one object fed by keyboard, touch buttons (`bindHold`) and `Tilt`. The game reads only `Input.axis()`, `Input.jumpHeld()` and `Input.consumeJump()`.
6. **Tilt**: permission request (must be called straight from a tap), screen-rotation-aware tilt angle, calibration offset, sensitivity and invert, all saved to localStorage. If no motion events arrive within 1.5 s it turns itself off and shows the touch buttons.
7. **Renderer** (`R`, `srect`, `tri`, `scircle`): one shader with per-vertex color, a big dynamic buffer, `flush()` when full. Screen units are device pixels.
8. **Camera** (`Cam`, `wrect`, `wtri`, `wcircle`): world-to-screen in tiles. The tile size fits 15 rows (or 13 columns on narrow screens). On tall screens the ground stays near the bottom, lifted above the touch buttons, and the bottom row of ground is extended downward.
9. **Level loading** (`loadLevel`): parses the map into a tile grid, a gravity-zone grid, and lists of enemies, items, checkpoints, start and goal. Also computes each jelly's travel range.
10. **Physics** (`moveBox`): axis-separated box versus tile collision. The world has solid side walls and is open above and below.
11. **Game** (`Game`): state machine (`title → intro → play ⇄ paused → complete / over / win`), `update(dt)` with player, enemies, items, spikes, checkpoints, messages and goal.
12. **Drawing**: background per level (`bgDecor`: `junk`, `ship`, `asteroid`), tiles, items, enemies, player, particles.
13. **UI**: shows and hides the `<section class="screen">` overlays, HUD, message banner and settings buttons.
14. **Test hook** (`Hook` near the top, `window.GAME_TEST_HOOK` at the end): see Testing.
15. **Hosting extras** (end of the script): when the page is served from a `games/<name>/` folder it shows an **All games** link back to the picker, and when it has its manifest link and a secure origin it registers `sw.js`. The artifact copy has neither, so both stay off there.
16. **Full screen** (`Full`): a tappable **Full screen** button at the top of the title card (always shown), a small HUD button (only where full screen works) and the F key. Uses the Fullscreen API with the `webkit` prefix for Safari. Where full screen is not allowed (iPhone, the Claude app's artifact view), tapping the title button shows a note explaining how to get it: open the game's own page, or use Add to Home Screen on iPad.
17. **Demo** (`Demo`): the title screen's **Watch demo** button. A scripted bot holds right and presses jump at walls, gaps, spikes and nearby enemies, and burps when a jump falls short. It plays about 30 seconds (`Demo.LENGTH`), which covers level 1 and most of level 2, then returns to the title. Any key or tap stops it. During the demo the input functions read `Demo.axis` / `Demo.held`, getting hit only bounces the courier (`Demo.oops`, no lives lost), finishing a level loads the next one without a screen, and the best score is not saved.
18. **Main loop and boot**: `requestAnimationFrame` loop, WebGL failure screen, Claude `hot` snapshot hook, and `window.__game` for tests.

### Gravity zones

`G` tiles are not solid. While the center of the courier is in a zone, gravity points up (`p.gs = -1`): the courier falls to the ceiling, "jump" pushes away from the ceiling, and the sprite is drawn upside down. Items and spikes written inside a run of `G` count as part of the zone. Every zone needs a solid ceiling above it and somewhere safe to land when the courier walks out.

## Level format

Each map has 15 rows (row 0 is the top). Rows can be different lengths.

| Char | Meaning |
| --- | --- |
| ` ` | empty |
| `#` | rock (solid) |
| `=` | metal (solid) |
| `>` / `<` | conveyor pushing right / left (solid) |
| `^` / `v` | floor spikes / ceiling spikes |
| `G` | gravity-flip zone |
| `P` | player start (one per level) |
| `*` | bolt, +10 |
| `B` | Fizzy Jet can, +25, enables the burp double jump |
| `R` | vending-machine robot (walks, turns at walls and ledges) |
| `J` | space jelly (floats up and down between the nearest solid tiles, max 3 tiles each way) |
| `C` | checkpoint flag |
| `D` | Delivery Pad (finish, +100) |

Other level fields: `name`, `intro`, `sky` (top and bottom colors), `rock` and `metal` (base and edge colors), `bgDecor`, `music` (`root` MIDI note, `scale` intervals, `tempo` seconds per step) and `messages` (`{x, who, text}` shown once when the courier passes column `x`).

**Design limits for new levels:** a single jump rises about 2.4 tiles and clears about 4 tiles of gap on flat ground. Walls 3 tiles high need the Fizzy Jet, so put a `B` before them. Run the test afterwards: its bot checks that every level can be finished.

## Common changes

- **Feel:** edit `CFG` (gravity, jump, speed, conveyor, lives).
- **New level:** add an object to `LEVELS`; the HUD, intro and "Level X of Y" update automatically.
- **New enemy type:** add a letter in `loadLevel`, movement in `Game.update` (enemies loop), and a `drawX` function in DRAWING.
- **New sound:** add a case to `Sound.sfx`.
- **Words on screens:** in the HTML sections near the top; level text lives in `LEVELS`.
- **Tilt feel:** `CFG.TILT_DEADZONE` and `CFG.TILT_FULL`; players can also change sensitivity and invert in the pause menu.

## Testing

Run both from the repo root before every commit:

```
pip install -r test-harness/requirements.txt    # once
python3 games/lost-luggage-of-the-cosmos/test_game.py games/lost-luggage-of-the-cosmos/index.html
python3 test-harness/harness/run_tests.py all games/lost-luggage-of-the-cosmos/index.html
```

The **test harness** (`test-harness/`, spec in `test-harness/GAME_TEST_HOOK_SPEC.md`) drives the game only through `window.GAME_TEST_HOOK` (the `TEST HOOK (spec v1)` block at the end of the script, plus the `Hook` state object near the top). Bot mode freezes the real-time loop, skips level-complete screens (`Hook.levelDone`), turns sound off and never saves the player's best score. `progress` is the courier's distance from start to the Delivery Pad in the current level, plus levels completed, divided by 3. The harness writes the bot scores between the `BOT-SCORES` markers, and the title screen shows "Bot's best: N bolts. Can you beat it?"; beating it on the win or game-over screen shows "You beat the bot!".

**Latest results (2026-11-14):** all smoke tests pass. Evolution Bot scores start 760, mid 1165, best 1375 (won, no lives lost). All fairness checks pass. Timing tolerance 70%; the tight moments are around 6 s, 26 s and 38 to 39 s into a run, which are the spots to playtest if anything feels unfair. Full report: `test-results/report.md`; scores: `bot-scores.json`.

The game's own test:

`test_game.py` launches Chrome from `/usr/bin/google-chrome` with SwiftShader WebGL; change `executable_path` if Chrome lives elsewhere. It checks: loads without console errors; title and intro screens; keyboard movement, jumping and scoring; Fizzy Jet; robot hurt and stomp; pause; game over and restart; gravity zone flip; Delivery Pad completion; a bot finishing all three levels (terrain only, enemies ignored); the demo (plays by itself, stops on a key, ends after 30 s and reaches level 2); no page scrolling even with host padding; a full-screen button always on the title screen that explains itself where full screen is blocked; iPad-portrait touch controls; and the tilt maths. The test drives the game through `window.__game`.

## Publishing as a Claude artifact

The artifact viewer adds its own `<!doctype>`, `<head>` and `<body>`, so publish only the part between `<!-- GAME-START ... -->` and `<!-- GAME-END -->`:

```
python3 -c "s=open('index.html').read(); a=s.index('-->', s.index('<!-- GAME-START'))+3; b=s.index('<!-- GAME-END'); open('artifact.html','w').write(s[a:b].strip()+'\n')"
```

Inside the Claude artifact viewer, keyboard and touch work but tilt does not (the viewer blocks motion sensors). For tilt, host `index.html` on HTTPS: GitHub Pages, or Tailscale HTTPS at home.

## Open items

- **Full screen** is blocked inside the shared Claude artifact viewer (confirmed on iPhone Chrome: the frame does not allow it), and iPhones never allow web pages to go full screen in any browser. On iPhone and iPad the way to get a full-screen game is to host `index.html` and use Share › Add to Home Screen. The title-screen note says this, tailored for iPhone, and ends with a Details line explaining why the request failed.
- **Tilt on a real iPad is untested.** iOS and Android have historically reported opposite signs for motion. If the courier walks the wrong way, use **Invert tilt** in the pause menu, or flip the default in `Tilt.invert`.
- Levels were checked by the test bot with enemies ignored; difficulty has not been playtested with the boys yet.
- Ideas for next time: a level select, a timer and medals, more enemy types, a boss at the asteroid, or a "parcel opens" ending animation.
