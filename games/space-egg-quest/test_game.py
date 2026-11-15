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
    check(js("__game.Game.eggs.length") == 8, "the planet has 8 eggs")

    # walking: forward moves you the way you face; turning changes which way that is
    r = js(f"""() => {{ const {{ Game, Input }} = __game; const p = Game.player; p.x = 0; p.z = 0; p.yaw = 0;
              Input.keys.add('ArrowUp'); for (let i = 0; i < 30; i++) Game.update({STEP}); Input.keys.delete('ArrowUp');
              const z = p.z; Input.keys.add('ArrowRight'); for (let i = 0; i < 30; i++) Game.update({STEP}); Input.keys.delete('ArrowRight');
              return {{ x: p.x, z, yaw: p.yaw }}; }}""")
    check(r["z"] > 3 and abs(r["x"]) < 0.01 and r["yaw"] < -1, f"Up walks forward and Right turns right ({r})")

    # eggs hatch into buddies
    r = js(f"""() => {{ const {{ Game }} = __game; const e = Game.eggs[0]; Game.player.x = e.x; Game.player.z = e.z; Game.update({STEP});
              return {{ found: Game.eggsFound, buddies: Game.buddies.length, score: Game.score }}; }}""")
    check(r == {"found": 1, "buddies": 1, "score": 100}, f"walking into an egg hatches a buddy and scores 100 ({r})")
    r = js(f"""() => {{ const {{ Game }} = __game; const p = Game.player; p.x += 10; for (let i = 0; i < 180; i++) Game.update({STEP});
              const b = Game.buddies[0]; return Math.hypot(b.x - p.x, b.z - p.z); }}""")
    check(r < 3.5, f"the buddy follows you ({r:.1f} m away)")

    # the blaster beats a Gloomling in front of you (two hits)
    r = js(f"""() => {{ const {{ Game, Input }} = __game; const p = Game.player; Game.buddies = []; Game.glooms = [];
              const f = {{ x: Math.sin(p.yaw), z: Math.cos(p.yaw) }};
              Game.glooms.push({{ x: p.x + f.x * 8, z: p.z + f.z * 8, hp: 2, phase: 0, hit: 0 }}); Game.spawnTimer = 99;
              const s0 = Game.score; Input.keys.add('Space'); for (let i = 0; i < 40; i++) Game.update({STEP}); Input.keys.delete('Space');
              return {{ left: Game.glooms.length, gained: Game.score - s0 }}; }}""")
    check(r["left"] == 0 and r["gained"] == 25, f"two blaster hits pop a Gloomling for 25 ({r})")

    # buddies zap Gloomlings on their own
    r = js(f"""() => {{ const {{ Game }} = __game; const p = Game.player; Game.buddies = [{{ x: p.x, z: p.z - 2.4, color: '#7dffd0', name: 'Pip', cd: 0, born: 0 }}];
              Game.glooms = [{{ x: p.x - 9, z: p.z - 2.4, hp: 2, phase: 0, hit: 0 }}]; Game.spawnTimer = 99; Game.player.safe = 99;
              for (let i = 0; i < 240; i++) Game.update({STEP}); return Game.glooms.length; }}""")
    check(r == 0, "a buddy zaps a nearby Gloomling by itself")

    # getting touched costs a heart, then you're safe for a moment
    r = js(f"""() => {{ const {{ Game }} = __game; const p = Game.player; p.safe = 0; Game.glooms = [{{ x: p.x + 0.5, z: p.z, hp: 2, phase: 0, hit: 0 }}];
              Game.update({STEP}); const h = Game.hearts; Game.glooms = [{{ x: p.x + 0.5, z: p.z, hp: 2, phase: 0, hit: 0 }}]; Game.update({STEP});
              return {{ h, after: Game.hearts }}; }}""")
    check(r["h"] == 4 and r["after"] == 4, f"a Gloomling bump costs one heart, then you're safe ({r})")

    # rocks block you
    r = js(f"""() => {{ const {{ Game }} = __game; const rk = Game.rocks[0]; Game.player.x = rk.x; Game.player.z = rk.z + 0.1; Game.update({STEP});
              return Math.hypot(Game.player.x - rk.x, Game.player.z - rk.z) >= rk.r + 0.49; }}""")
    check(r, "rocks push you out")

    # the last egg brings MEGA GLOOM, which lands and can be beaten
    r = js(f"""() => {{ const {{ Game }} = __game; Game.glooms = []; Game.player.safe = 99;
              for (const e of Game.eggs) if (!e.found) {{ Game.player.x = e.x; Game.player.z = e.z; Game.update({STEP}); }}
              const came = !!Game.boss; for (let i = 0; i < 180; i++) Game.update({STEP});
              return {{ came, landed: Game.boss && Game.boss.landed, eggs: Game.eggsFound, progress: Game.progress() }}; }}""")
    check(r["came"] and r["landed"] and r["eggs"] == 8 and 0.6 <= r["progress"] < 0.75, f"all 8 eggs bring MEGA GLOOM down; progress starts at 60% ({r})")
    check(pg.is_visible("#bossBar"), "the boss health bar shows")
    r = js(f"""() => {{ const {{ Game }} = __game; Game.boss.hp = 1; Game.player.safe = 99;
              Game.shots.push({{ x: Game.boss.x, z: Game.boss.z, y: 2, vx: 0, vz: 0, life: 1, buddy: false }}); Game.update({STEP});
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
