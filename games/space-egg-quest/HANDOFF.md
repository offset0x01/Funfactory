# Space Egg Quest: handoff

A first-person 3D shooter-explorer on a big alien planet: beat monsters to make them drop eggs (10% each), collect 20 eggs that hatch into little buddies who follow you and help a bit, raid three caves (new every game) for the Big Laser, the Grenade Launcher and the Sniper, then beat the giant three-phase boss MEGA GLOOM. No aim help: you aim in 3D (left, right, up and down) and jump. Designed by a young player in a voice chat and built from the Funfactory starter. Read this before changing anything.

**Status (2026-11-15):** v3: eggs come only from beaten monsters (10% chance) and 20 are needed; the caves hold weapons instead of eggs and are generated new every game (bigger, with loops and rooms); jumping; full 3D aiming with no aim assist; buddies do a quarter of the damage. Smoke and `test_game.py` pass, including an autopilot that wins whole games using only the bot's own controls and the starting Blaster. `all`: passes with `--allow-no-win`: the fairness checks pass (standing still is safe, idling and button-mashing don't win, timing tolerance 100%), but the Evolution Bot never scored (see Testing for why and for the autopilot that does win). Played through in the headless browser with the keyboard and on a phone-sized touch screen. Not yet tried on a real iPad or iPhone (see Open items).

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole game (about 115 KB, all drawn and synthesized in code). |
| `test_game.py` | This game's own browser test (walking, looking up and down, jumping, blocking, no aim help, 3D aiming, egg drops, buddy damage, monster kinds, hearts, caves, weapons, the boss and its tricks, screens, touch controls) and the autopilot wins. |
| `autopilot.js` | A scripted player used by `test_game.py`: plays whole games through the test hook with only the bot's actions, to prove the game can be won. Not part of the game. |
| `TEST_REPORT.md`, `bot-scores.json`, `bot-best-run.json` | Written by the harness `all` run. Don't edit by hand. |
| `manifest.webmanifest`, `sw.js`, icons | Add to Home Screen, full screen and offline play. Icons are the starter's letter tiles ("SE"). |

Live: https://offset0x01.github.io/Funfactory/games/space-egg-quest/

## The Game Card it was built from

Asked for out loud, one question at a time (2026-11-15):

- **Game name:** none chosen ("the space egg game"); built as **Space Egg Quest**
- **What kind of game is it?** First person, exploring
- **Where?** Walking around on an alien planet in space
- **Items to collect:** eggs; collecting them and having them hatch into alien buddies that follow you around
- **Enemies:** lots of enemies
- **Fighting:** you have a blaster, and your alien buddies help fight
- **How do I win?** Beat a giant boss monster at the end

**v2 request (2026-11-15):** make the map bigger, with bigger terrain like mountains or alien trees; give the boss more attacks and abilities, like flying or teleporting, and more health; add structures like underground dungeons; add more enemies and different kinds of enemies. Also: don't have the eggs shoot lasers into the sky, because they make the eggs too easy to find.

**v3 request (2026-11-15):** instead of eggs in random parts of the map, each enemy has a 10 percent chance to drop an egg, and you need 20 eggs instead of 10. The caves contain weapons instead of eggs, like a big laser, a grenade launcher or a sniper. Turn off all aim assist to make it harder, and let you aim in all directions instead of just right to left. Alien helpers do a quarter of the damage they did. Then: make the caves bigger and more complex, generated so they are different every playthrough, and add jumping.

## Decisions

| Decision | Why |
| --- | --- |
| Names: planet Wobblor; monsters Gloomling, Zapbug, Goo Spitter, Rockback; boss MEGA GLOOM; caves "the Crystal Caves", "the Gloom Tunnels", "the Echo Vaults"; 20 made-up buddy names (Pip, Zuzu, Blink...) | The player didn't pick names; these are made up and kid-friendly. |
| Plain WebGL with a tiny 3D renderer (matrices, five unit meshes, flat shading, fog), no library | A low-poly look needs only a few hundred lines; Three.js would add ~600 KB for no new feature. |
| Map: radius 110 m, rolling hills, 7 big mountains, 46 alien trees, 50 rocks, a ring of mountains at the edge | v2 "bigger map, bigger terrain". Mountains, trunks and rocks block you. |
| v3: hills now matter for aiming. Shots, monsters, the boss and you all have real 3D heights; shots stop at the ground and at mountains | With full 3D aiming, the crosshair must be honest: what it's on is what you hit. Hills can hide a monster from your shot. |
| v3: eggs only come from beaten monsters: each has a 10% chance (`CFG.EGG_DROP`, rolled on the seeded dice) to drop one where it popped. 20 eggs (`CFG.EGGS`) bring the boss. A dropped egg is pushed out of any rock, tree, mountain or wall so it can always be picked up. Monsters that bump into you vanish without dropping anything | The player's request. On average about 200 monsters for 20 eggs, so up to 12 monsters roam at once and new ones arrive every 1.2 to 2.4 s. |
| v3: three caves, one per weapon (`DUNGEONS`): Big Laser (a beam you hold: 7 damage a second, 45 m), Grenade Launcher (arcing grenades, 4 damage to everything within 4.5 m), Sniper (instant, 7 damage, 140 m, one shot a second). The Blaster (1 damage, flying bolts) is always yours. Switch with keys 1 to 4 or X, or the SWAP button (shown once you have two). A new weapon goes straight into your hands | The player's request ("a big laser or a grenade launcher or a sniper"). Caves are optional: the game can be won with the Blaster alone (the autopilot proves it), but the weapons make it much easier. |
| v3: caves are generated new every game from the seed (`makeCave`): a 13 x 10 room maze (27 x 21 squares, about 108 x 84 m; v2's were 15 x 13 squares), with extra openings for loops, three open rooms, 11 guards spread out, the weapon on the floor square farthest from the stairs, and the exit portal next to it. The portal only opens once you hold the weapon; the stairs seal after | "Bigger and more complex, different every playthrough." The same seed always gives the same caves, which the test bots need. |
| v3: no aim assist anywhere. You look up and down (Up/Down arrows, or drag up and down; up to about 72 degrees) as well as turning | The player's request. Shots fly exactly along the crosshair. |
| v3: jumping (J or Shift, or the JUMP button): about 1.2 m high, 0.7 s in the air. It clears small rocks, Goo Spitter goo (which now rolls low along the ground, a little slower), and MEGA GLOOM's shockwave rings | The player asked for jumping; giving it jobs makes it matter. |
| v3: buddies do 0.25 damage a shot (`CFG.BUDDY_DAMAGE`; the Blaster does 1) | The player's request: a quarter of before. |
| v3: any beaten monster has a 4% chance to drop a heart fruit (Rockbacks always do) | A 200-monster hunt with 5 hearts and no aim help was too punishing: the autopilot kept losing to chip damage. This is the smallest change that made long games survivable. |
| Monster kinds (`KINDS`): Gloomling (wiggly chaser, 2 hits), Zapbug (circles, then dashes at you, 1 hit), Goo Spitter (keeps 10 to 16 m away and spits goo, 3 hits), Rockback (big, slow, 6 hits, knocks you back). Zapbugs join after 2 eggs, Spitters after 5, Rockbacks after 9 | Kinds unlock more slowly than in v2 because there are twice as many eggs. |
| MEGA GLOOM: 250 health, three phases. Phase 1: orb sprays, orb rings, calls helpers. Phase 2: adds teleporting and the shockwave slam (jump it). Phase 3: adds flying (aim up!) with goo bombs dropped on a red warning circle | v2's boss, now needing 3D aim when it flies. |
| No sky beams on eggs. The egg sensor at the top points to a dropped egg within 40 m (`CFG.SENSOR_RANGE`), or else to a cave with a weapon still in it within 40 m; in a cave it always points the way | v2 request: eggs shouldn't be too easy to find. |
| Hearts (5), buddies can't be hurt | Forgiving for kids. |
| Controls. Keyboard: W/S walk, A/D or Left/Right turn, Up/Down look, Q/E step sideways, Space fires (hold for the laser), J or Shift jumps, 1 to 4 or X switch weapons, drag the mouse to look. Touch: stick (walk and turn), drag anywhere to look all around, FIRE, JUMP, SWAP | AGENTS.md: touch and keyboard always. In v3 the Up/Down arrows moved from walking to looking (W/S still walk). |
| All sound synthesized with WebAudio; all art drawn in code | No outside assets needed for this low-poly style. |

What was cut or simplified: no climbing; buddies can't be lost or hurt; grenades never hurt you; the bots can't switch weapons (they keep the newest).

## Architecture

Sections inside `index.html`, in order:

1. **CONFIG**: every tuning number in `CFG`; `WEAPONS`; `KINDS` (monsters); `DUNGEONS` (cave names and their weapons); egg colors and buddy names.
2. **Seeded random numbers** (`rand()`), **saved data** (`store`, `Scores`), **Sound** (named sound effects built from `tone()`).
3. **Input**: one object. The game reads `move()`, `strafe()`, `turn()`, `pitch()`, `fire()`, `jump()`, `takeLook()` / `takeLookY()` (pixels dragged) and `takeWeapon()`. Keyboard, mouse drag, the touch stick and buttons, and the test hook all feed it.
4. **The world**: `ground(x, z)` (hill height), `bearing()`, and `Dun` (cave helpers: building one from its map, wall checks, "distance maps" that measure walking distance around walls, pushing things out of walls).
5. **Game**: `makeCave()` (the cave generator), then `Game`: `start(seed)`, `makeWorld()`, `unstick()`, `navigate()` / `resetNav()` (egg sensor), `damage()` (hits, kills, egg and heart drops), `aim()` / `eye()` / `blocked()` / `ray()` (3D aiming), `explode()`, `enterDungeon()` / `leaveDungeon()`, `update(dt)` in this order: walking/looking/jumping, stairs and portals, weapons, eggs, cave weapon pickup, heart fruit, buddies, new monsters, monsters, boss (`updateBoss()`), flying things. `progress()`, `end()`.
6. **Renderer**: `M4`, `MESH`, `put()`. `buildSurface()` and `buildDungeons()` make the never-moving parts once per run; `draw()` draws sky, world, moving things, beams and trails, see-through glow and the held weapon.
7. **Screens and HUD**: `UI` (hearts, eggs, weapon, egg sensor, boss bar, messages, high scores).
8. **Full screen**, **main loop**, **hosting extras**, **TEST HOOK**.

Things a newcomer might trip on:

- Forward is `(sin yaw, cos yaw)`; turning right makes `yaw` smaller; `pitch` above 0 looks up. `p.h` is how high you are off the ground in a jump.
- Everything has a `zone`: -1 is the surface, 0 to 2 are the caves. Only things in your zone move, hit or get drawn. `gh(x, z, zone)` is the floor height there (caves are flat).
- Monster hit points are decimals now (laser and buddy damage come in fractions).
- Sparkles (`Game.fx`) use `Math.random` and are skipped in bot mode. Anything that changes gameplay must use `rand()`, including cave generation and drops.

## Common changes

- **Feel:** `CFG.WALK`, `TURN`, `LOOK_SPEED`, `JUMP_SPEED`, `GRAVITY`.
- **More or fewer eggs:** `CFG.EGGS`, `EGG_DROP`.
- **Weapons:** the numbers in `WEAPONS`; a new weapon needs an entry there, in `WEAPON_ORDER`, a cave in `DUNGEONS`, and a look in `draw()`.
- **Harder or easier fights:** `CFG.HEARTS`, `HEART_DROP`, `MAX_MONSTERS`, the spawn timer under "new monsters on the surface", `KINDS`, `BOSS_HP`, the attack lists in `updateBoss()`, `BUDDY_DAMAGE`.
- **Bigger or twistier caves:** `CFG.CAVE_W`, `CAVE_H`; the loop chance (0.12), room count and guard count in `makeCave()`.
- **A new monster:** add it to `KINDS` and a letter to `MAP_LETTER` and `makeCave`'s guard letters, give it a movement rule in `update`, a look in `draw()`, a letter in `observe()`, and add it to the spawn rules.

## Testing

```
python3 test-harness/harness/run_tests.py smoke games/space-egg-quest/index.html   # after every change
python3 games/space-egg-quest/test_game.py                                          # includes two autopilot wins (about 1 minute)
python3 test-harness/harness/run_tests.py all games/space-egg-quest/index.html     # before committing
python3 test-harness/harness/check_private.py                                      # before pushing
python3 test-harness/harness/check_live.py games/space-egg-quest                   # after pushing
```

- **Bot actions:** idle, forward, turnleft, turnright, fire, jump, lookup, lookdown, forward_fire, forward_jump (the 10-action limit; bots can't switch weapons).
- **`progress`:** eggs fill the first 60%. Between eggs, each monster beaten (and each bit of damage) moves you toward the next egg (always growing, never quite half an egg); once an egg has dropped, walking to it fills the rest. After 20 eggs it's 60%, then boss damage fills 62 to 100%. `stallSeconds` is 8. `maxSteps` is 72,000 (20 minutes at 60 steps a second).
- **Autopilot (`autopilot.js`):** proof the game can be won. It plays through the test hook with only the bot's actions, the starting Blaster and no aim help. It shoots the nearest monster it can see (Goo Spitters and Zapbugs first), grabs dropped eggs and heart fruit, jumps goo and shockwaves, sidesteps boss orbs and goo bombs, and skips the caves. Seed 1: won in 394 s of game time (207 monsters, 5 hearts left). Seed 3: won in 612 s (271 monsters, 5 hearts left).
- **Bot scores:** Evolution Bot start 0, mid 0, best 0 (5 passes, searched fresh). Its random 150-to-900 ms button holds never line up a shot in 3D on a moving monster before its 8-second stuck limit, so it never makes progress. That's the expected price of no aim help, so `all` was run with `--allow-no-win`; the autopilot wins above are the proof the game can be won. The title screen hides a bot score of 0.
- **Tight moments:** none found (10 of 10 nudged replays did as well, but the bot's runs were short).

## Build log

One row per build or change. The next session's time estimate is made from these.

| Date | What was built | Expected | Actual |
| --- | --- | --- | --- |
| 2026-11-15 | First version (8 eggs, buddies, Gloomlings, boss) | 75 min | 14 min |
| 2026-11-15 | v2: bigger map, hills, mountains, trees, 2 dungeons, 4 monster kinds, 3-phase boss, no sky beams | 60 min | 31 min |
| 2026-11-15 | v3: eggs from monsters (10%, 20 needed), 3 weapons in procedural caves, jumping, 3D aim with no assist, weaker buddies, autopilot win test | 110 min | about 35 min (about 10 from 15:46 until a pause, then 18:04 to 18:29) |

For estimates: the v2 bot search from nothing took about 19 minutes (won on pass 7). v3 games are 7 to 10 minutes long with precise 3D aiming, so the Evolution Bot's random search is not expected to win; the autopilot in `test_game.py` is the proof of a win and takes about a minute.

## Sources and credits

All art and sound are made in code by the Funfactory builder; no downloaded assets.

Design research (ideas only, nothing copied):

- "How Tinykin Keeps the Fun Flowing", https://jboger.substack.com/p/tinykin (creatures you collect who follow you and help)
- "How Tinykin makes curious players feel like completionists", https://www.vice.com/en/article/how-tinykin-makes-curious-players-feel-like-completionists (making collectibles easy to spot)
- "How to Make Catchy Collectibles", https://www.gamedeveloper.com/design/how-to-make-catchy-collectibles
- The cave generator is the standard "recursive backtracker" maze method (a depth-first walk that knocks down walls), with extra openings for loops; general technique, no code copied.

## Open items

- Not tried on a real iPad or iPhone yet: check the stick, drag-to-look up and down, the JUMP and SWAP buttons, and frame rate.
- The game is long (about 200 monsters for 20 eggs). Playtest; if it drags, lower `CFG.EGGS` or raise `EGG_DROP`.
- The Evolution Bot can't switch weapons and has no way to strafe; an AI bot (configured in `test-harness/.env`) may do better.
- Real icons from the game's art (an egg) instead of the letter tiles.
- Ideas the player could ask for next: weapon upgrades, a mini-boss guarding each cave's weapon, buddies with different powers by color.
