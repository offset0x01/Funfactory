# Space Egg Quest: handoff

A first-person 3D exploring game on a big alien planet: search hills, mountains, alien forests and two underground dungeons for 10 eggs that hatch into buddies who follow you and fight, blast four kinds of monsters, then beat the giant three-phase boss MEGA GLOOM. Designed by a young player in a voice chat and built from the Funfactory starter. Read this before changing anything.

**Status (2026-11-15):** v2: bigger hilly map with mountains and alien trees, two underground dungeons, four monster kinds, a tougher boss that teleports, slams shockwaves and flies, and no more sky beams on the eggs. Smoke, `test_game.py` and `all` pass (the Evolution Bot won on pass 7 with no hearts lost). Played through in the headless browser with the keyboard and on a phone-sized touch screen. Not yet tried on a real iPad or iPhone (see Open items).

**Build time:**

| Version | Estimated | Actual |
| --- | --- | --- |
| v1 (first build) | 75 min | 14 min (13:28 to 13:42, 2026-11-15, US Eastern) |
| v2 (bigger map, dungeons, monsters, boss) | 60 min | 31 min (13:52 to 14:23, 2026-11-15, US Eastern) |

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole game (about 95 KB, all drawn and synthesized in code). |
| `test_game.py` | This game's own browser test (walking, mountains/trees/rocks, eggs and buddies, egg sensor, each monster kind, hearts, dungeons, boss and its tricks, screens, touch stick and FIRE). |
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

## Decisions

| Decision | Why |
| --- | --- |
| Names: planet Wobblor; monsters Gloomling, Zapbug, Goo Spitter, Rockback; boss MEGA GLOOM; dungeons "the Crystal Caves" and "the Gloom Tunnels"; buddies Pip, Zuzu, Blink, Mopo, Fizz, Noodle, Tock, Wiggy, Bop, Lumo | The player didn't pick names; these are made up and kid-friendly. |
| Plain WebGL with a tiny 3D renderer (matrices, five unit meshes, flat shading, fog), no library | A low-poly look needs only a few hundred lines; Three.js would add ~600 KB for no new feature. |
| v2 map: radius 110 m (was 54), rolling hills, 7 big mountains, 46 alien trees (puffy "bloom" trees with hanging glowing pods, and twisty spires), 50 rocks, a ring of mountains at the edge | "Bigger map, bigger terrain". Mountains, trunks and rocks block you; you walk around them. |
| Hills only change how things look; the rules run on a flat map underneath | Keeps movement, aiming and the bots simple; you still walk up and down the hills on screen. |
| Two underground dungeons, each a stone stairway on the surface leading to a torch-lit maze (drawn as ASCII maps in `DUNGEONS`, so they're easy to redraw). Each holds one egg, some guard monsters, and an exit portal next to the egg. The stairs seal once that egg is found | "Structures like underground dungeons." Dungeons sit far away from the planet (x from 1000) so they never overlap it. |
| 10 eggs: 8 on the surface, 1 in each dungeon. Each hatches into a buddy right away | More map, more to find. |
| No sky beams on eggs or stairways (v1 had them). The arrow at the top became an "egg sensor" that only points at an egg or stairway within 40 m (`CFG.SENSOR_RANGE`); underground it always points the way, and it points at the boss in the fight | The player said the beams made eggs too easy to find. The short-range sensor keeps the search a search, but stops a kid getting stuck right next to an egg they can't see. Raise or lower `SENSOR_RANGE` to make it easier or harder. |
| Four monster kinds (`KINDS`): Gloomling (wiggly chaser, 2 hits), Zapbug (circles, then dashes at you, 1 hit), Goo Spitter (keeps 10 to 16 m away and spits goo, 3 hits), Rockback (big, slow, 6 hits, knocks you back, drops a heart fruit worth +1 heart) | "More enemies and different kinds." New kinds unlock as you find eggs (Zapbugs after 1, Spitters after 2, Rockbacks after 4); up to 12 at once on the surface. |
| MEGA GLOOM: 250 health (was 60), three phases. Phase 1: orb sprays, orb rings, calls helpers. Phase 2 (below 2/3): adds teleporting (vanishes and pops up near you with an orb ring) and the shockwave slam (a ring of spikes rushing outward). Phase 3 (below 1/3): adds flying (bat wings, circles over you dropping goo bombs with a red warning circle) | "More attacks and abilities, like flying or teleporting, and more health." Every attack is dodgeable: walk out of the red circle, keep moving away from the shockwave. |
| If the last egg is in a dungeon, the boss waits until you're back on the surface | The fight only happens up top. |
| Hearts (5), auto-aim, buddies can't be hurt | Unchanged from v1: forgiving for kids. |
| Touch: a stick (up/down walks, left/right turns), drag anywhere to look, a big FIRE button. Keyboard: W/Up, S/Down, A/D/Left/Right turn, Q/E step sideways, Space fires, drag the mouse to look, M mutes | AGENTS.md: touch and keyboard always. Bots use walk, turn and fire only. |
| All sound synthesized with WebAudio; all art drawn in code | No outside assets needed for this low-poly style. |

What was cut or simplified: hills are looks only (no jumping or climbing), buddies can't be lost or hurt, one planet (a new layout every game from the seed; the dungeon mazes are fixed).

## Architecture

Sections inside `index.html`, in order:

1. **CONFIG**: every tuning number in `CFG`; `KINDS` (monsters); `DUNGEONS` (maze maps); egg colors and buddy names.
2. **Seeded random numbers** (`rand()`), **saved data** (`store`, `Scores`), **Sound** (named sound effects built from `tone()`).
3. **Input**: one object. The game reads `move()`, `strafe()`, `turn()`, `fire()` and `takeLook()` (pixels dragged). Keyboard, mouse drag, the touch stick, FIRE and the test hook all feed it.
4. **The world**: `ground(x, z)` (hill height, looks only), `bearing()`, and `Dun` (dungeon helpers: building one from its map, wall checks, "distance maps" that measure walking distance around walls, pushing things out of walls).
5. **Game**: `start(seed)`, `makeWorld()` (mountains, stairways, rocks, trees, eggs from the seed), `navigate()` / `resetNav()` (where to go next), `enterDungeon()` / `leaveDungeon()`, `update(dt)` in this order: walking, stairs and portals, blaster, eggs, heart fruit, buddies, new monsters, monsters, boss (`updateBoss()`), flying things. `progress()`, `end()`.
6. **Renderer**: `M4` (matrices), `MESH` (sphere, ico, octa, cone, box), `put()` puts a stretched, turned mesh into a vertex list. `buildSurface()` and `buildDungeons()` make the never-moving parts once per run; `draw()` draws sky, world, moving things, see-through glow and the blaster.
7. **Screens and HUD**: `UI` (hearts, eggs, egg sensor, boss bar, messages, high scores).
8. **Full screen**, **main loop**, **hosting extras**, **TEST HOOK**.

Things a newcomer might trip on:

- Forward is `(sin yaw, cos yaw)`; turning right makes `yaw` smaller. `bearing(p, x, z)` gives the angle to something (+ is to your right) and its distance.
- Everything has a `zone`: -1 is the surface, 0 and 1 are the dungeons. Only things in your zone move, hit or get drawn.
- Sparkles (`Game.fx`) use `Math.random` and are skipped in bot mode; they never change gameplay. Anything that does must use `rand()`.
- The title screen shows a demo planet (seed 7) with a slowly turning camera.

## Common changes

- **Feel:** `CFG.WALK`, `CFG.TURN`, `CFG.FIRE_EVERY`, `CFG.AIM_HELP` (auto-aim strength).
- **Eggs easier or harder to find:** `CFG.SENSOR_RANGE`.
- **Harder or easier fights:** `CFG.HEARTS`, the numbers in `KINDS`, the spawn rules under "new monsters on the surface", `BOSS_HP`, the attack lists in `updateBoss()`, `BUDDY_FIRE_EVERY`, `BUDDY_RANGE`.
- **Bigger or smaller planet:** `CFG.WORLD_R`, `ROCKS`, `TREES`, `MOUNTAINS`, `SURFACE_EGGS` (add colors to `EGG_COLORS` and names to `BUDDY_NAMES`).
- **A new or redrawn dungeon:** add or edit an entry in `DUNGEONS` (keep a path from S to E and an X next to the egg). The game's self-check reports a maze that can't be finished.
- **A new monster:** add it to `KINDS` and a letter to `MAP_LETTER`, give it a movement rule in the monsters section of `update`, a look in `draw()`, a letter in `observe()`, and add it to the spawn rules.
- **A new boss trick:** add a move name to the attack lists in `updateBoss()` and handle it there (use a `mode` if it lasts a while).

## Testing

```
python3 test-harness/harness/run_tests.py smoke games/space-egg-quest/index.html   # after every change
python3 games/space-egg-quest/test_game.py
python3 test-harness/harness/run_tests.py all games/space-egg-quest/index.html     # before committing
python3 test-harness/harness/check_private.py                                      # before pushing
python3 test-harness/harness/check_live.py games/space-egg-quest                   # after pushing
```

- **`progress`:** eggs fill the first 60%. For each egg: walking toward a surface egg counts from 0 to 0.9 of an egg; for a dungeon egg, reaching the stairs counts 0 to 0.45 and walking the maze (measured around walls) 0.45 to 0.9; heading for the exit portal afterward counts 0 to 0.3 of the next egg. After all 10 eggs it's 60 to 62% (getting out of a dungeon), then boss damage fills 62 to 100%. `stallSeconds` is 6. `maxSteps` is 36,000 (10 minutes at 60 steps a second).
- **Bot scores:** Evolution Bot start 2415, mid 2415, best 6945 (passes: 2415, 2415, 2765, 4855, 4855, 4860, 6945); won on pass 7 with no hearts lost, searched from scratch with `--fresh --extra-passes 10` because v2 is a whole new map (about 19 minutes). Its passes stalled around 6 eggs at first; a simple steer-toward-the-sensor autopilot collected all 10 eggs in 74 s and beat the boss at 102 s with 2 hearts left, so the game is winnable at human speed and the slow start was the bot's random search going around mountains. The win is saved in `bot-best-run.json`, so the next `all` on an unchanged game replays it in seconds.
- **Tight moments:** the timing check kept 26% of 40 ms nudged replays, with tight moments at 5.8 s, 11.7 s and 24.2 s (the first monsters). In a 3D game a tiny change in when you turn changes your whole path afterward, so a low timing-tolerance number is expected rather than a sign of one unfair jump.

## Build log

One row per build or change. The next session's time estimate is made from these.

| Date | What was built | Expected | Actual |
| --- | --- | --- | --- |
| 2026-11-15 | First version | not recorded | not recorded |

## Sources and credits

All art and sound are made in code by the Funfactory builder; no downloaded assets.

Design research (ideas only, nothing copied):

- "How Tinykin Keeps the Fun Flowing", https://jboger.substack.com/p/tinykin (creatures you collect who follow you and help)
- "How Tinykin makes curious players feel like completionists", https://www.vice.com/en/article/how-tinykin-makes-curious-players-feel-like-completionists (making collectibles easy to spot)
- "How to Make Catchy Collectibles", https://www.gamedeveloper.com/design/how-to-make-catchy-collectibles

## Open items

- Not tried on a real iPad or iPhone yet: check the stick, drag-to-look and frame rate (the v2 world has many more triangles).
- Is 40 m the right egg sensor range? Playtest and adjust `SENSOR_RANGE`.
- Real icons from the game's art (an egg) instead of the letter tiles.
- Ideas the player could ask for next: buddies with different powers by color, a dungeon boss, climbing the mountains, a second planet.
