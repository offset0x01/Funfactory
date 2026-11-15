# Lost Luggage of the Cosmos: handoff

A ten-level 2D platformer with a boss fight, built from a Game Card as the first test of the kids' game-builder prompt. Read this before changing anything; it covers what exists, why it was built this way, and where to make common changes.

**Status (2026-11-14):** v2: six new levels (4 to 9), a boss fight (level 10, the Baggage Beast), three new biomes (ice, hot sauce, Lost & Found warehouse), two power-ups (Bubble Shield, Mega Fuzz) and four new monsters (Comet Hopper, Snoop Drone, Spiky Space Snail, Fire Flare). Before that: top-10 high score table added; test hook added and the harness passes; v1.1 complete and playable, with a 30-second demo mode and a full-screen button. All automated tests pass. Tilt has not been tried on a real iPad yet (see Open items).

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole game (about 130 KB). Source of truth. Open it directly, or serve the folder over HTTPS. |
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

**v2 request (2026-11-14):** add 2 kinds of power-ups and more types of monsters, build 6 more levels and a boss fight, at least two new biomes, and make levels get slightly harder leading up to the boss.

| Level | Name | Biome (`bgDecor`) | New things | Enemy speed |
| --- | --- | --- | --- | --- |
| 1 to 3 | Junkyard Planet, Wobbly Cruise Ship, Talking Asteroid | `junk`, `ship`, `asteroid` | (original) | 1.0 |
| 4 | The Frosty Comet | `ice` | slippery ice, Comet Hoppers, Bubble Shield | 1.0 |
| 5 | The Icicle Caves | `ice` | Spiky Space Snails, Snoop Drones, ice-cave gravity zone | 1.05 |
| 6 | Hot Sauce Moon | `lava` | hot sauce pits, Fire Flares, Mega Fuzz | 1.1 |
| 7 | The Magma Mall | `lava` | sauce + backward conveyors + drones together | 1.15 |
| 8 | The Lost & Found Warehouse | `claim` | everything mixed, a gravity room, 4-tile gaps | 1.2 |
| 9 | The Luggage Carousel | `claim` | hardest mix: longest level, most enemies, flares on the carousel | 1.3 |
| 10 | The Baggage Beast | `claim` | boss arena; the Delivery Pad is locked until the Beast is beaten | 1.3 |

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
| Top-10 high scores with 3-letter initials, saved per device | Follows AGENTS.md "High scores and saved data". There is no server, so scores live in the browser; a Home Screen copy keeps its own list. Leaving the screen without pressing Save still keeps the score, using the last initials (or ???). |
| Storage keys start with `lost-luggage-of-the-cosmos.` | Every game on the site shares one storage space. Older `llotc.` keys are moved over once on load, and an old best score becomes a "YOU" entry. |
| Two power-ups: Bubble Shield (`S`) and Mega Fuzz (`M`) | A shield is the friendliest power-up for kids (one free mistake). Mega Fuzz is the "star" power: 8 s of running 30% faster and smashing anything, which turns a crowded stretch into a fun moment. Neither saves you from falling out of the world. |
| Spiky Space Snails and Fire Flares can't be stomped | Every earlier enemy could be stomped; these teach "jump over, don't land on". Mega Fuzz still smashes them. |
| Difficulty ramp: per-level `speed`, more enemies, longer levels, 4-tile gaps late | "Slightly harder" each level without new rules. Every level keeps two checkpoints and a Fizzy Jet can before its tall wall. |
| Boss: stomp the Beast 5 times; it speeds up each hit, hops, and throws suitcases | Classic and readable. It flashes and backs off for 1.3 s after each stomp so the courier can get clear. Suitcases can be stomped for 20 bolts. |
| Getting hurt in the boss fight resets the Beast to its spot (asleep) but it keeps its damage | Respawning at the checkpoint never drops you next to the boss, and progress isn't lost. |
| Camera frames the courier and the Beast together during the fight | Otherwise the Beast sits off-screen on wide maps. The courier always stays on screen. |
| Boss-level `progress` grows with each stomp | The test harness counts "no progress for 4 s" as stuck; walking back and forth in an arena doesn't move a distance-based measure. |
| Demo mode never loses lives | It exists so people can watch the game where they cannot play it (for example inside the Claude artifact viewer); it should always look like a clean run. |

## Architecture (inside `index.html`)

The page content sits between the `GAME-START` and `GAME-END` comments. The script is one block, in this order:

1. **CONFIG** (`CFG`): every tuning number. Units are tiles and seconds. Jump height ≈ `JUMP_V² / (2·GRAVITY)` ≈ 2.4 tiles; Fizzy Jet adds ≈ 2 tiles.
2. **LEVELS**: array of level objects (format below).
3. **Helpers and saved data**: color helpers (`hex`, `shade`), seeded `rng`, `store` (localStorage with keys prefixed `lost-luggage-of-the-cosmos.`, falling back to memory when storage is blocked; `store.ok` says which), the one-time `llotc.` migration, and `Scores` (top-10 list under `scores`: `{ initials, score, detail, date }`, highest first).
4. **Sound**: `unlock()`, `sfx(name)`, and a tiny step sequencer (`startMusic(song)`) driven by each level's `music`.
5. **Input**: one object fed by keyboard, touch buttons (`bindHold`) and `Tilt`. The game reads only `Input.axis()`, `Input.jumpHeld()` and `Input.consumeJump()`.
6. **Tilt**: permission request (must be called straight from a tap), screen-rotation-aware tilt angle, calibration offset, sensitivity and invert, all saved to localStorage. If no motion events arrive within 1.5 s it turns itself off and shows the touch buttons.
7. **Renderer** (`R`, `srect`, `tri`, `scircle`): one shader with per-vertex color, a big dynamic buffer, `flush()` when full. Screen units are device pixels.
8. **Camera** (`Cam`, `wrect`, `wtri`, `wcircle`): world-to-screen in tiles. The tile size fits 15 rows (or 13 columns on narrow screens). On tall screens the ground stays near the bottom, lifted above the touch buttons, and the bottom row of ground is extended downward.
9. **Level loading** (`loadLevel`): parses the map into a tile grid, a gravity-zone grid, and lists of enemies, items, checkpoints, start and goal; also the boss (`L.boss`), the boss fence (`L.fenceX`), thrown suitcases (`L.shots`) and the level's enemy `speed`. Also computes each jelly's travel range. `SOLID` and `HAZARD` sets say which tiles block and which hurt.
10. **Physics** (`moveBox`): axis-separated box versus tile collision. The world has solid side walls and is open above and below.
11. **Game** (`Game`): state machine (`title → intro → play ⇄ paused → complete / over / win`), `update(dt)` with player, power-ups, enemies (one branch per type), items, spikes and hot sauce, checkpoints, messages and goal. `hurt(fell)` handles Mega Fuzz and the Bubble Shield first. `updateBoss(dt)` runs the Baggage Beast and its suitcases. `BOSS_SONG`, `SUITCASE_COLORS`, `FOE_COLOR` and `RAINBOW` sit just after `Game`.
12. **Drawing**: background per level (`bgDecor`: `junk`, `ship`, `asteroid`, `ice`, `lava`, `claim`), tiles (including `~` ice and `%` hot sauce), items, enemies (`drawEnemy` picks `drawRobot`, `drawJelly`, `drawHopper`, `drawDrone`, `drawSnail`, `drawFlare`), the boss (`drawBoss`), suitcases (`drawShots`), player (with shield bubble and rainbow glow), particles.
13. **UI** (including high scores: `UI.endRun` when a run ends, `UI.renderScores` draws the initials form and table, `UI.savePending` saves; the High scores button opens `scrScores`): shows and hides the `<section class="screen">` overlays, HUD, message banner and settings buttons.
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
| `~` | slippery ice (solid; low grip, so you slide) |
| `%` | hot sauce (not solid; touching it costs a life) |
| `S` | Bubble Shield, +25 (blocks the next hit, then pops) |
| `M` | Mega Fuzz, +25 (8 s: faster, can't be hurt, smash enemies by touching them) |
| `H` | Comet Hopper (waits, then hops toward the courier when within 9 tiles; stompable) |
| `U` | Snoop Drone (flies left and right up to 5 tiles from home, turning at walls; stompable) |
| `K` | Spiky Space Snail (walks like a robot, slower; **not** stompable) |
| `F` | Fire Flare (put it in a hot sauce pit; it leaps about 4 tiles up every 2.6 s; **not** stompable) |
| `X` | the Baggage Beast (boss). Put it on the floor row; it is 2.4 tiles wide and 2 tall |
| `!` | boss fence (invisible). The Beast can't go left of it, and wakes up when the courier passes it |

Other level fields: `name`, `intro`, `sky` (top and bottom colors), `rock` and `metal` (base and edge colors), `bgDecor`, `music` (`root` MIDI note, `scale` intervals, `tempo` seconds per step), `messages` (`{x, who, text}` shown once when the courier passes column `x`), `speed` (enemy speed multiplier, default 1) and `boss: true` (locks the Delivery Pad until the Beast is beaten; the intro says "Boss fight!").

**Design limits for new levels:** a single jump rises about 2.4 tiles and clears about 4 tiles of gap on flat ground. Walls 3 tiles high need the Fizzy Jet, so put a `B` before them. Hot sauce pits work like gaps: keep them 4 tiles or less, with solid ground under the sauce row. Leave at least 10 tiles of floor after the bottom of a tall cliff before the next gap or pit (a running jump off the top carries you 7 or 8 tiles), and at least 4 tiles of island between two pits. Run the test afterwards: its bot checks that every level can be finished.

## Common changes

- **Feel:** edit `CFG` (gravity, jump, speed, conveyor, lives).
- **New level:** add an object to `LEVELS`; the HUD, intro and "Level X of Y" update automatically.
- **New enemy type:** add a letter in `loadLevel` (set `spiky: true` if it can't be stomped), movement in `Game.update` (enemies loop), a `drawX` function in DRAWING added to `drawEnemy`, a color in `FOE_COLOR`, and a letter in the test hook's `observe()`.
- **New power-up:** add a letter in `loadLevel` (an item `type`), what it does in the items loop of `Game.update`, a drawing in `drawItems`, and a HUD chip in `UI.syncHud`.
- **Boss tuning:** `CFG.BOSS_HP`, and in `updateBoss`: walk speed (`1.9 * anger`), hop timer (`2.8 / anger`), throw timer (`3.4 / anger`) and suitcase speed.
- **Difficulty of a level:** its `speed` field (enemy speed) and how many enemies the map has.
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

The **test harness** (`test-harness/`, spec in `test-harness/GAME_TEST_HOOK_SPEC.md`) drives the game only through `window.GAME_TEST_HOOK` (the `TEST HOOK (spec v1)` block at the end of the script, plus the `Hook` state object near the top). Bot mode freezes the real-time loop, skips level-complete screens (`Hook.levelDone`), turns sound off and never saves the player's best score. `progress` is the courier's distance from start to the Delivery Pad in the current level, plus levels completed, divided by 10. On the boss level it is 25% for reaching the arena, 60% for the stomps (12% each) and 15% for walking to the pad. `MAX_STEPS` is 12 minutes of game time. The harness writes the bot scores between the `BOT-SCORES` markers, and the title screen shows "Bot's best: N bolts. Can you beat it?"; beating it on the win or game-over screen shows "You beat the bot!".

**Latest results (2026-11-14, v2 with ten levels):** all smoke tests pass. Evolution Bot scores start 895, mid 3080, best 6045 (won, beat the Baggage Beast, no lives lost). It needed extra passes (`--extra-passes 12`; it won on pass 10, about 19 minutes) because the game is long. All fairness checks pass. Timing tolerance 57%; the tight moments are around 11 s, 25 s, 44 s, 87 s and 99 s into a run (roughly levels 1, 2, 3 and 6), which are the spots to playtest if anything feels unfair. Full report: `test-results/report.md`; scores: `bot-scores.json`. The terrain check in `test_game.py` now fails a level if the bot touches hot sauce, or spikes from level 4 on; that caught an 8-tile sauce pit, a 5-tile spike strip and too-short landings while building v2.

The game's own test:

`test_game.py` launches Chrome from `/usr/bin/google-chrome` with SwiftShader WebGL; change `executable_path` if Chrome lives elsewhere. It checks: loads without console errors; title and intro screens; keyboard movement, jumping and scoring; Fizzy Jet; robot hurt and stomp; pause; game over and restart; gravity zone flip; Delivery Pad completion; power-ups (the shield blocks one hit; Mega Fuzz smashes a spiky snail), ice sliding, hot sauce costing a life, spiky snails hurting when stomped, flares leaping and hiding, drones patrolling and hoppers hopping, the boss (locked pad, waking in the arena, 5 stomps, win, throwing suitcases, resetting after a hit); a bot finishing all ten levels (terrain only, enemies and the boss ignored); the demo (plays by itself, stops on a key, ends after 30 s and reaches level 2); no page scrolling even with host padding; a full-screen button always on the title screen that explains itself where full screen is blocked; iPad-portrait touch controls; the tilt maths; and high scores (empty board, initials entry and cleanup, P not pausing while typing, Enter and Save, keeping an unsaved score, ordering and the top-10 cut-off, reload, bot runs never saving, `llotc.` migration, and blocked storage). The test drives the game through `window.__game`.

## Publishing as a Claude artifact

The artifact viewer adds its own `<!doctype>`, `<head>` and `<body>`, so publish only the part between `<!-- GAME-START ... -->` and `<!-- GAME-END -->`:

```
python3 -c "s=open('index.html').read(); a=s.index('-->', s.index('<!-- GAME-START'))+3; b=s.index('<!-- GAME-END'); open('artifact.html','w').write(s[a:b].strip()+'\n')"
```

Inside the Claude artifact viewer, keyboard and touch work but tilt does not (the viewer blocks motion sensors). For tilt, host `index.html` on HTTPS: GitHub Pages, or Tailscale HTTPS at home.

## Open items

- **Full screen** is blocked inside the shared Claude artifact viewer (confirmed on iPhone Chrome: the frame does not allow it), and iPhones never allow web pages to go full screen in any browser. On iPhone and iPad the way to get a full-screen game is to host `index.html` and use Share › Add to Home Screen. The title-screen note says this, tailored for iPhone, and ends with a Details line explaining why the request failed.
- **Tilt on a real iPad is untested.** iOS and Android have historically reported opposite signs for motion. If the courier walks the wrong way, use **Invert tilt** in the pause menu, or flip the default in `Tilt.invert`.
- Levels were checked by the test bot with enemies ignored, and the Evolution Bot plays the whole game with enemies; difficulty has not been playtested by the players yet. Levels 8 and 9 are long (about 180 and 200 tiles); if they feel like a slog, cut a section.
- The demo still covers only levels 1 and 2.
- Ideas for next time: a level select (ten levels is a lot to replay), a timer and medals, a second boss phase, or a "parcel opens" ending animation.
