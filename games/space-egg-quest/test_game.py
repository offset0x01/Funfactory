#!/usr/bin/env python3
"""Space Egg Quest's own browser test. Run it from the repo root after every change:

  python3 games/space-egg-quest/test_game.py

The shared harness (test-harness/harness/run_tests.py) already checks the things every game
must do. This file tests what is special to THIS game: eggs hatch into buddies, buddies and the
blaster beat Gloomlings, MEGA GLOOM shows up after the last egg, hearts, the screens, and the touch
stick and FIRE button. It drives the game through window.__game.
"""
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / "test-harness" / "harness"))
from gamebot.browser import GameSession  # noqa: E402  (finds Chrome for you; never hard-code its path)

GAME = HERE / "index.html"
FOLDER = HERE.name
fails = []
STEP = "1 / 60"


def check(ok, msg):
    print(("PASS " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)


with GameSession(str(GAME)) as g:
    pg = g.page
    js = pg.evaluate

    # title screen, then Enter starts a run
    check(pg.is_visible("#scrTitle") and pg.is_visible("#btnScores"), "title screen shows with a High scores button")
    pg.keyboard.press("Enter")
    check(js("__game.Game.state") == "play" and pg.is_visible("#hud") and pg.is_visible("#cross"), "Enter starts the game and shows the HUD and crosshair")
    check(js("__game.Game.eggs.length") == 10 and js("__game.Game.dungeons.length") == 2, "the planet has 10 eggs and 2 dungeons")

    # walking: forward moves you the way you face; turning changes which way that is
    r = js(f"""() => {{ const {{ Game, Input }} = __game; const p = Game.player; p.x = 0; p.z = 0; p.yaw = 0;
              Input.keys.add('ArrowUp'); for (let i = 0; i < 30; i++) Game.update({STEP}); Input.keys.delete('ArrowUp');
              const z = p.z; Input.keys.add('ArrowRight'); for (let i = 0; i < 30; i++) Game.update({STEP}); Input.keys.delete('ArrowRight');
              return {{ x: p.x, z, yaw: p.yaw }}; }}""")
    check(r["z"] > 3 and abs(r["x"]) < 0.01 and r["yaw"] < -1, f"Up walks forward and Right turns right ({r})")

    # mountains, trees and rocks block you
    r = js(f"""() => {{ const {{ Game }} = __game; const out = [];
              for (const o of [Game.mountains[0], Game.trees[0], Game.rocks[0]]) {{ const r = o.r * (o === Game.mountains[0] ? 0.85 : 1);
                Game.player.x = o.x; Game.player.z = o.z + 0.1; Game.update({STEP}); out.push(Math.hypot(Game.player.x - o.x, Game.player.z - o.z) >= r + 0.49); }}
              return out; }}""")
    check(r == [True, True, True], f"mountains, tree trunks and rocks push you out ({r})")

    # eggs hatch into buddies
    r = js(f"""() => {{ const {{ Game }} = __game; const e = Game.eggs[0]; Game.player.x = e.x; Game.player.z = e.z; Game.update({STEP});
              return {{ found: Game.eggsFound, buddies: Game.buddies.length, score: Game.score }}; }}""")
    check(r == {"found": 1, "buddies": 1, "score": 100}, f"walking into an egg hatches a buddy and scores 100 ({r})")
    r = js(f"""() => {{ const {{ Game }} = __game; const p = Game.player; p.x += 10; for (let i = 0; i < 180; i++) Game.update({STEP});
              const b = Game.buddies[0]; return Math.hypot(b.x - p.x, b.z - p.z); }}""")
    check(r < 3.5, f"the buddy follows you ({r:.1f} m away)")

    # no beams in the sky: the egg sensor only points at eggs within its range
    r = js("""() => { const { Game, CFG, UI } = __game; const p = Game.player; const e = Game.eggs.find(e => !e.found && e.zone < 0);
              p.x = e.x + CFG.SENSOR_RANGE + 30; p.z = e.z; Game.resetNav(); UI.syncHud(); const far = document.getElementById('radarArrow').style.visibility;
              p.x = e.x + 10; Game.resetNav(); UI.syncHud(); return { far, near: document.getElementById('radarArrow').style.visibility }; }""")
    check(r == {"far": "hidden", "near": ""}, f"the egg sensor only shows the way when an egg is close ({r})")

    # the blaster beats a Gloomling in front of you (two hits)
    r = js(f"""() => {{ const {{ Game, Input }} = __game; const p = Game.player; Game.buddies = []; Game.enemies = []; Game.spawnTimer = 99;
              p.x = 0; p.z = 0; p.yaw = 0; Game.addEnemy('gloom', 0, 8, -1);
              const s0 = Game.score; Input.keys.add('Space'); for (let i = 0; i < 40; i++) Game.update({STEP}); Input.keys.delete('Space');
              return {{ left: Game.enemies.length, gained: Game.score - s0 }}; }}""")
    check(r["left"] == 0 and r["gained"] == 25, f"two blaster hits pop a Gloomling for 25 ({r})")

    # buddies zap monsters on their own
    r = js(f"""() => {{ const {{ Game }} = __game; const p = Game.player; Game.buddies = [{{ x: p.x, z: p.z - 2.4, color: '#7dffd0', name: 'Pip', cd: 0, born: 0 }}];
              Game.enemies = []; Game.addEnemy('gloom', p.x - 9, p.z - 2.4, -1); Game.spawnTimer = 99; p.safe = 99;
              for (let i = 0; i < 240; i++) Game.update({STEP}); Game.buddies = []; return Game.enemies.length; }}""")
    check(r == 0, "a buddy zaps a nearby Gloomling by itself")

    # the four kinds of monsters each do their own thing
    r = js(f"""() => {{ const {{ Game }} = __game; const p = Game.player; p.x = 0; p.z = 0; p.safe = 99; Game.spawnTimer = 99;
              Game.enemies = []; Game.orbs = []; Game.addEnemy('spitter', 0, 14, -1); Game.enemies[0].t = 0; Game.update({STEP});
              const spits = Game.orbs.filter(o => o.goo).length;
              Game.enemies = []; Game.addEnemy('zapbug', 0, 15, -1); Game.enemies[0].t = 0; Game.update({STEP}); const z0 = Game.enemies[0].z;
              for (let i = 0; i < 12; i++) Game.update({STEP}); const dashed = z0 - Game.enemies[0].z;
              Game.enemies = []; Game.addEnemy('rockback', 0, 30, -1); const rb = Game.enemies[0], hp = rb.hp;
              for (let i = 0; i < hp; i++) Game.shots.push({{ x: rb.x, z: rb.z, y: 1, vy: 0, vx: 0, vz: 0, life: 1, buddy: false, zone: -1 }});
              Game.update({STEP}); const fruit = Game.pickups.length; Game.hearts = 3; p.x = Game.pickups[0].x; p.z = Game.pickups[0].z; Game.update({STEP});
              return {{ spits, dashed: dashed > 2.5, rockbackHp: hp, fruit, hearts: Game.hearts }}; }}""")
    check(r == {"spits": 1, "dashed": True, "rockbackHp": 6, "fruit": 1, "hearts": 4},
          f"Goo Spitters spit, Zapbugs dash, Rockbacks take 6 hits and drop a heart fruit worth +1 heart ({r})")

    # getting touched costs a heart, then you're safe for a moment
    r = js(f"""() => {{ const {{ Game }} = __game; const p = Game.player; Game.hearts = 5; p.safe = 0; Game.enemies = []; Game.addEnemy('gloom', p.x + 0.5, p.z, -1);
              Game.update({STEP}); const h = Game.hearts; Game.addEnemy('gloom', p.x + 0.5, p.z, -1); Game.update({STEP});
              return {{ h, after: Game.hearts }}; }}""")
    check(r["h"] == 4 and r["after"] == 4, f"a Gloomling bump costs one heart, then you're safe ({r})")

    # dungeons: walk onto the stairs, walls block you, the egg is inside, the portal takes you back up
    r = js(f"""() => {{ const {{ Game, Dun }} = __game; const p = Game.player, d = Game.dungeons[0]; Game.enemies = [];
              p.x = d.door.x; p.z = d.door.z; Game.update({STEP}); const inside = p.zone === 0, guards = Game.enemies.filter(e => e.zone === 0).length;
              p.safe = 99; const wall = [...Array(d.W).keys()].map(c => c).find(c => Dun.solidCell(d, c, 0)); const w = Dun.center(d, 1, 0);
              p.x = w.x; p.z = w.z + 0.3; Game.update({STEP}); const blocked = !Dun.solidAt(d, p.x, p.z);
              const before = Game.progress(); p.x = d.egg.x; p.z = d.egg.z; Game.update({STEP}); const gotEgg = Game.eggsFound;
              const n = Game.navigate(); p.x = d.exit.x; p.z = d.exit.z; Game.update({STEP});
              const back = p.zone === -1; p.x = d.door.x; p.z = d.door.z; Game.update({STEP});
              return {{ inside, guards: guards > 0, blocked, gotEgg, nextIs: n.label, back, sealed: p.zone === -1 }}; }}""")
    check(r == {"inside": True, "guards": True, "blocked": True, "gotEgg": 2, "nextIs": "exit portal", "back": True, "sealed": True},
          f"stairs lead into a dungeon with guards and walls; its egg sends you to the exit portal; the stairs seal after ({r})")

    # the last egg brings MEGA GLOOM, which lands and can be beaten
    r = js(f"""() => {{ const {{ Game }} = __game; const p = Game.player; Game.enemies = []; p.safe = 999;
              for (const e of Game.eggs) if (!e.found) {{
                if (e.zone >= 0) {{ const d = Game.dungeons[e.zone]; p.x = d.door.x; p.z = d.door.z; Game.update({STEP}); }}
                p.x = e.x; p.z = e.z; Game.update({STEP});
                if (p.zone >= 0) {{ const d = Game.zoneOf(); p.x = d.exit.x; p.z = d.exit.z; Game.update({STEP}); }} }}
              const came = !!Game.boss; for (let i = 0; i < 180; i++) Game.update({STEP});
              return {{ came, landed: Game.boss && Game.boss.landed, eggs: Game.eggsFound, hp: Game.boss && Game.boss.hp, progress: Game.progress() }}; }}""")
    check(r["came"] and r["landed"] and r["eggs"] == 10 and r["hp"] > 200 and 0.62 <= r["progress"] < 0.75, f"all 10 eggs bring MEGA GLOOM down with lots of health ({r})")
    check(pg.is_visible("#bossBar"), "the boss health bar shows")
    # MEGA GLOOM's tricks: teleporting, the shockwave slam, flying with goo bombs, and getting angrier
    r = js(f"""() => {{ const {{ Game, CFG }} = __game; const B = Game.boss, p = Game.player; p.safe = 999; Game.buddies = [];
              B.mode = 'tele'; B.modeT = 0.01; const x0 = B.x; Game.update({STEP}); const teleported = B.x !== x0 && B.mode === 'walk';
              B.mode = 'slam'; B.modeT = 0.01; Game.update({STEP}); const wave = Game.waves.length > 0;
              B.mode = 'fly'; B.modeT = 3; B.bombT = 0; for (let i = 0; i < 30; i++) Game.update({STEP}); const flying = B.y > 4, bombs = Game.bombs.length > 0;
              B.hp = Math.floor(CFG.BOSS_HP * 0.3); B.mode = 'walk'; Game.update({STEP});
              return {{ teleported, wave, flying, bombs, phase: B.phase }}; }}""")
    check(r == {"teleported": True, "wave": True, "flying": True, "bombs": True, "phase": 3}, f"MEGA GLOOM teleports, slams a shockwave, flies and drops goo bombs, and reaches phase 3 ({r})")
    r = js(f"""() => {{ const {{ Game }} = __game; const B = Game.boss; B.hp = 1; B.mode = 'walk'; B.y = 3.7; Game.player.safe = 99;
              Game.shots.push({{ x: B.x, z: B.z, y: 2, vy: 0, vx: 0, vz: 0, life: 1, buddy: false, zone: -1 }}); Game.update({STEP});
              return {{ state: Game.state, progress: Game.progress() }}; }}""")
    check(r == {"state": "won", "progress": 1}, f"the last hit on MEGA GLOOM wins ({r})")
    check(pg.is_visible("#scrEnd") and "win" in pg.inner_text("#endTitle").lower(), "the win screen shows")
    pg.fill("#initials", "egg")
    pg.keyboard.press("Enter")
    saved = js(f"JSON.parse(localStorage.getItem('{FOLDER}.scores'))")
    check(bool(saved) and saved[0]["initials"] == "EGG", f"score saved under {FOLDER}.scores ({saved})")
    check(pg.locator("#endTable tr.new").count() == 1, "the new score is highlighted in the table")

    # losing all hearts: game over, P in the initials box doesn't pause, play again
    pg.click("#btnAgain")
    check(js("__game.Game.state") == "play" and js("__game.Game.hearts") == 5, "Play again starts a fresh run with 5 hearts")
    js("""() => { const { Game } = __game; Game.score = 10; Game.hearts = 1; Game.player.safe = 0; Game.hurt(); }""")
    check(js("__game.Game.state") == "lost" and pg.is_visible("#scrEnd") and "over" in pg.inner_text("#endTitle").lower(), "losing the last heart shows Game over")
    pg.fill("#initials", "p1q")
    pg.keyboard.press("KeyP")
    check(js("__game.Game.state") == "lost", "typing P in the initials box does not pause")
    check(not g.errors, f"no console errors ({g.errors[:2]})")

    # touch screen: the stick walks, FIRE shoots, the pause button pauses
    g.open(viewport=(844, 390), touch=True)
    pg = g.page
    pg.tap("#btnPlay")
    check(pg.is_visible("#stick") and pg.is_visible("#tFire"), "the touch stick and FIRE button show on a touch screen")
    z0 = pg.evaluate("__game.Game.player.z")
    box = pg.locator("#stick").bounding_box()
    cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    pg.dispatch_event("#stick", "pointerdown", {"pointerId": 7, "clientX": cx, "clientY": cy - 60, "bubbles": True})
    pg.wait_for_timeout(500)
    pg.dispatch_event("#stick", "pointerup", {"pointerId": 7, "clientX": cx, "clientY": cy - 60, "bubbles": True})
    check(pg.evaluate("__game.Game.player.z") > z0 + 1, "pushing the stick up walks forward")
    pg.dispatch_event("#tFire", "pointerdown")
    pg.wait_for_timeout(120)
    shots = pg.evaluate("__game.Game.shots.length")
    pg.dispatch_event("#tFire", "pointerup")
    check(shots >= 1, f"the FIRE button shoots ({shots} shots)")
    pg.tap("#btnPause")
    check(pg.evaluate("__game.Game.state") == "paused", "the pause button pauses on a touch screen")
    check(not g.errors, f"no console errors on the touch screen ({g.errors[:2]})")

print("\nRESULT:", "ALL PASS" if not fails else f"{len(fails)} FAILED")
sys.exit(1 if fails else 0)
