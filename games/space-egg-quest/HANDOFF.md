# Space Egg Quest: handoff

A first-person 3D exploring game on an alien planet: find 8 glowing eggs that hatch into buddies who follow you and fight, blast the Gloomlings, then beat the giant boss MEGA GLOOM. Designed by a young player in a voice chat and built from the Funfactory starter. Read this before changing anything.

**Status (2026-11-15):** v1 complete. Smoke, `test_game.py` and `all` pass; the Evolution Bot won on its first pass. Played through in the headless browser with the keyboard and on a phone-sized touch screen (start, walk, hatch, blast, pause, lose, restart, win). Not yet tried on a real iPad or iPhone (see Open items).

**Build time:** estimated 75 minutes; actual 14 minutes (started 13:28, pushed 13:42, 2026-11-15, US Eastern).

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole game (about 64 KB, all drawn and synthesized in code). |
| `test_game.py` | This game's own browser test (eggs and buddies, blaster, hearts, rocks, boss, screens, touch stick and FIRE). |
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

## Decisions

| Decision | Why |
| --- | --- |
| Name "Space Egg Quest", planet "Wobblor", enemies "Gloomlings", boss "MEGA GLOOM", buddy names Pip, Zuzu, Blink, Mopo, Fizz, Noodle, Tock, Wiggy | The player didn't pick names; these are made up and kid-friendly. |
| Plain WebGL with a tiny 3D renderer (matrices, four unit meshes, flat shading, fog), no library | A low-poly look needs only a few hundred lines; Three.js would add ~600 KB for no new feature. |
| Flat ground with rocks, mushrooms, crystals and a ring of mountains at the edge | Easy to read while walking; the mountains show where the map ends. |
| Every egg hatches into a buddy right away (8 buddies) | The player chose "collect them and they hatch into buddies". Buddies follow in a line and zap Gloomlings within 14 m, and the boss within 26 m. Buddies can't be hurt. |
| A tall colored light beam on every egg, plus a radar arrow at the top that points to the nearest egg | Exploring on a big map with no help gets frustrating for kids; the beams and arrow keep it fun. Similar to how collect-a-buddy games (Pikmin, Tinykin) make collectibles easy to spot. |
| Hearts (5) instead of lives; a Gloomling that touches you costs a heart and pops | Simple and forgiving. 1.3 s of safety after each hit. |
| Auto-aim: shots bend toward a monster within about 12 degrees of the crosshair | Aiming with a thumb stick on a phone is hard. |
| Gloomlings float (they ignore rocks) and get faster and more numerous with each egg | "Lots of enemies" that ramp up as you go, without trapping them behind rocks. |
| MEGA GLOOM lands about 16 m in front of you once the 8th egg hatches | No long walk back to the middle of the map, and the fight starts face to face. Boss: 60 health, throws three slow orbs, calls Gloomlings now and then. |
| Touch: a stick (up/down walks, left/right turns), drag anywhere to look, a big FIRE button. Keyboard: W/Up, S/Down, A/D/Left/Right turn, Q/E step sideways, Space fires, drag the mouse to look, M mutes | AGENTS.md: touch and keyboard always. Bots use walk, turn and fire only. |
| All sound synthesized with WebAudio; all art drawn in code | No outside assets needed for this low-poly style. |

What was cut or simplified: no hills to climb (the ground is flat), no health pickups, buddies can't be lost or hurt, one map (a new layout every game from the seed).

## Architecture

Sections inside `index.html`, in order:

1. **CONFIG**: every tuning number in `CFG`, plus egg colors and buddy names.
2. **Seeded random numbers** (`rand()`), **saved data** (`store`, `Scores`), **Sound** (named sound effects built from `tone()`).
3. **Input**: one object. The game reads `move()`, `strafe()`, `turn()`, `fire()` and `takeLook()` (pixels dragged). Keyboard, mouse drag, the touch stick, FIRE and the test hook all feed it.
4. **Game**: `start(seed)`, `makeWorld()` (rocks and eggs from the seed), `update(dt)` in this order: walking and turning, blaster, eggs, buddies, Gloomlings, boss, flying things. `progress()`, `end()`.
5. **Renderer**: `M4` (matrices), `MESH` (sphere, ico, octa, cone, box), `put()` puts a stretched, turned mesh into a vertex list. `buildWorld()` makes the never-moving parts once per run; `draw()` draws sky, world, moving things, see-through glow (egg beams, shots, sparkles) and the blaster.
6. **Screens and HUD**: `UI` (hearts, eggs, radar arrow, boss bar, messages, high scores).
7. **Full screen**, **main loop**, **hosting extras**, **TEST HOOK**.

Things a newcomer might trip on:

- Forward is `(sin yaw, cos yaw)`; turning right makes `yaw` smaller. `bearing(p, x, z)` gives the angle to something (+ is to your right) and its distance.
- Sparkles (`Game.fx`) use `Math.random` and are skipped in bot mode; they never change gameplay. Anything that does must use `rand()`.
- The title screen shows a demo planet (seed 7) with a slowly turning camera.

## Common changes

- **Feel:** `CFG.WALK`, `CFG.TURN`, `CFG.FIRE_EVERY`, `CFG.AIM_HELP` (auto-aim strength).
- **Harder or easier:** `CFG.HEARTS`, `GLOOM_SPEED` / `GLOOM_SPEEDUP`, `maxGlooms` in the Gloomling section, `BOSS_HP`, `BOSS_FIRE_EVERY`, `BUDDY_FIRE_EVERY`, `BUDDY_RANGE`.
- **More eggs:** `CFG.EGGS` (add colors to `EGG_COLORS` and names to `BUDDY_NAMES`); maybe raise `WORLD_R`.
- **A new enemy:** add a list next to `Game.glooms`, spawn and move it in `update`, check it in the shots loop, draw it in `draw()`, add a letter in `observe()`.
- **A new kind of buddy power:** in the buddies section of `update`.

## Testing

```
python3 test-harness/harness/run_tests.py smoke games/space-egg-quest/index.html   # after every change
python3 games/space-egg-quest/test_game.py
python3 test-harness/harness/run_tests.py all games/space-egg-quest/index.html     # before committing
python3 test-harness/harness/check_private.py                                      # before pushing
python3 test-harness/harness/check_live.py games/space-egg-quest                   # after pushing
```

- **`progress`:** eggs fill the first 60% (eggs found, plus how close you are to the nearest egg compared with when the last one hatched); boss damage fills the last 40%; 1 exactly when MEGA GLOOM is beaten. `stallSeconds` is 5 (turning to find the next egg can take a moment). `maxSteps` is 21,600 (6 minutes at 60 steps a second); the bot wins in well under that.
- **Bot scores:** Evolution Bot start 4400, mid 4400, best 4400; won on pass 1 with no hearts lost; no extra flags needed.
- **Tight moments** (timing check, 21% of 40 ms nudges did as well): 2.6 s, 5.8 s, 10.6 s, 15.8 s. In a 3D game a tiny change in when you turn changes your whole path afterward, so a low score here is expected; it is not a single unfair jump. Still worth playtesting the first Gloomling (about 6 s in).

## Sources and credits

All art and sound are made in code by the Funfactory builder; no downloaded assets.

Design research (ideas only, nothing copied):

- "How Tinykin Keeps the Fun Flowing", https://jboger.substack.com/p/tinykin (creatures you collect who follow you and help)
- "How Tinykin makes curious players feel like completionists", https://www.vice.com/en/article/how-tinykin-makes-curious-players-feel-like-completionists (making collectibles easy to spot)
- "How to Make Catchy Collectibles", https://www.gamedeveloper.com/design/how-to-make-catchy-collectibles

## Open items

- Not tried on a real iPad or iPhone yet: check the stick, drag-to-look and frame rate there.
- Real icons from the game's art (an egg) instead of the letter tiles.
- Ideas the player could ask for next: hills and caves to explore, buddies with different powers by color, a second planet, an egg that's hidden somewhere tricky.
