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
    check(js("__game.Game.eggs.length") == 0 and js("__game.Game.dungeons.length") == 4 and js("__game.Game.hearts") == 7,
          "no eggs lying around at the start, 4 caves (3 weapons + the Jet-Pack) and 7 hearts")

    # walking (W), turning, looking up and down (arrows), jumping
    r = js(f"""() => {{ const {{ Game, Input }} = __game; const p = Game.player; p.x = 0; p.z = 0; p.yaw = 0; p.pitch = 0;
              Input.keys.add('KeyW'); for (let i = 0; i < 30; i++) Game.update({STEP}); Input.keys.delete('KeyW');
              const z = p.z; Input.keys.add('ArrowRight'); for (let i = 0; i < 30; i++) Game.update({STEP}); Input.keys.delete('ArrowRight');
              Input.keys.add('ArrowUp'); for (let i = 0; i < 20; i++) Game.update({STEP}); Input.keys.delete('ArrowUp'); const up = p.pitch;
              Input.keys.add('ArrowDown'); for (let i = 0; i < 200; i++) Game.update({STEP}); Input.keys.delete('ArrowDown'); const down = p.pitch;
              p.pitch = 0; Input.keys.add('KeyJ'); Game.update({STEP}); Input.keys.delete('KeyJ'); let top = 0, air = 0;
              for (let i = 0; i < 90; i++) {{ Game.update({STEP}); top = Math.max(top, p.h); if (p.h > 0) air++; }}
              return {{ x: p.x, z, yaw: p.yaw, up, down, top, air, landed: p.h }}; }}""")
    check(r["z"] > 3 and abs(r["x"]) < 0.01 and r["yaw"] < -1, f"W walks forward and Right turns right ({r})")
    check(r["up"] > 0.4 and abs(r["down"] + 1.25) < 0.01, f"Up and Down arrows look up and down, as far as {r['down']:.2f} radians")
    check(1.0 < r["top"] < 1.5 and 30 < r["air"] < 60 and r["landed"] == 0, f"J jumps about 1.2 m and lands ({r['top']:.2f} m, {r['air']} steps in the air)")

    # mountains, trees and rocks block you; a jump clears a small rock
    r = js(f"""() => {{ const {{ Game }} = __game; const out = [];
              for (const o of [Game.mountains[0], Game.trees[0], Game.rocks[0]]) {{ const r = o.r * (o === Game.mountains[0] ? 0.85 : 1);
                Game.player.x = o.x; Game.player.z = o.z + 0.1; Game.player.h = 0; Game.update({STEP}); out.push(Math.hypot(Game.player.x - o.x, Game.player.z - o.z) >= r + 0.49); }}
              const small = Game.rocks.reduce((a, b) => b.h < a.h ? b : a); const p = Game.player;
              p.x = small.x; p.z = small.z - small.r - 0.6; p.yaw = 0; p.h = 1.2; p.vy = 0; Game.update({STEP}); p.x = small.x; p.z = small.z; Game.update({STEP});
              out.push(Math.hypot(p.x - small.x, p.z - small.z) < 0.5); return out; }}""")
    check(r == [True, True, True, True], f"mountains, tree trunks and rocks push you out, but you can jump over a small rock ({r})")

    # no aim assist: a shot aimed a little to the side of a monster misses; aimed right at it, hits
    r = js(f"""() => {{ const {{ Game, Input, KINDS }} = __game; const p = Game.player; Game.buddies = []; Game.spawnTimer = 999;
              const shoot = (yawOff) => {{ Game.enemies = []; Game.shots = []; p.x = 0; p.z = 0; p.h = 0; Game.addEnemy('gloom', 0, 9, -1); const e = Game.enemies[0]; e.phase = 0;
                const ey = Game.enemyY(e), eye = Game.eye(); p.yaw = yawOff; p.pitch = Math.atan2(ey - eye.y + 0.15, 9);
                Game.fireTimer = 0; Input.keys.add('Space'); Game.update({STEP}); Input.keys.delete('Space'); for (let i = 0; i < 40; i++) Game.update({STEP}); return e.hp; }};
              return {{ aside: shoot(0.14), straight: shoot(0) }}; }}""")
    check(r == {"aside": 2, "straight": 1}, f"no aim help: a shot 8 degrees to the side misses, one right on target hits ({r})")

    # a shot needs to be aimed up to hit something above you
    r = js(f"""() => {{ const {{ Game }} = __game; const o = Game.eye(); Game.enemies = []; Game.addEnemy('gloom', 0, 10, -1); const e = Game.enemies[0];
              const level = Game.ray(o, {{ x: 0, y: 0, z: 1 }}, 50).hit === e; e.x = 0; e.z = 6; const ey = Game.enemyY(e) + 5; e.phase = 0;
              const saved = Game.enemyY; Game.enemyY = () => ey; const flat = Game.ray(o, {{ x: 0, y: 0, z: 1 }}, 50).hit === e;
              const a = Math.atan2(ey - o.y, 6), up = Game.ray(o, {{ x: 0, y: Math.sin(a), z: Math.cos(a) }}, 50).hit === e; Game.enemyY = saved;
              return {{ level, flat, up }}; }}""")
    check(r == {"level": True, "flat": False, "up": True}, f"aiming in 3D: something high up is only hit by aiming up at it ({r})")

    # eggs only come from beaten monsters, about 1 in 10, and hatch into buddies
    r = js(f"""() => {{ const {{ Game, CFG }} = __game; let drops = 0; const p = Game.player; p.x = 0; p.z = 0;
              for (let i = 0; i < 400; i++) {{ Game.enemies = []; Game.addEnemy('zapbug', 20, 20, -1); const before = Game.eggs.length; Game.damage(Game.enemies[0], 5); if (Game.eggs.length > before) drops++;
                if (Game.eggs.length >= CFG.EGGS - 1) Game.eggs = []; }}
              Game.eggs = []; Game.enemies = []; Game.addEnemy('gloom', 5, 5, -1); let n = 0; while (!Game.eggs.length && n++ < 500) {{ Game.addEnemy('gloom', 5, 5, -1); Game.damage(Game.enemies[Game.enemies.length - 1], 9); }}
              const e = Game.eggs[0], s0 = Game.score; p.x = e.x; p.z = e.z; Game.update({STEP});
              return {{ drops, found: Game.eggsFound, buddies: Game.buddies.length, eggScore: Game.score - s0 >= 100 }}; }}""")
    check(25 <= r["drops"] <= 60 and r["found"] == 1 and r["buddies"] == 1 and r["eggScore"], f"about 10% of beaten monsters drop an egg ({r['drops']} of 400), and an egg hatches a buddy ({r})")

    # a dropped egg never lands inside a rock, tree or mountain
    r = js("""() => { const { Game } = __game; const bad = [];
              for (const s of Game.solids()) { Game.enemies = []; Game.addEnemy('gloom', s.x, s.z, -1); const e = { x: s.x, z: s.z }; Game.unstick(e, 1.2, -1); if (Math.hypot(e.x - s.x, e.z - s.z) < s.r) bad.push(s); }
              return bad.length; }""")
    check(r == 0, "an egg dropped inside something solid is moved out where you can reach it")

    # buddies do a quarter of the damage of your blaster
    r = js(f"""() => {{ const {{ Game, CFG }} = __game; const p = Game.player; p.x = 0; p.z = 0; Game.buddies = [{{ x: 0, z: -2.4, color: '#7dffd0', name: 'Pip', cd: 0, born: 0 }}];
              Game.enemies = []; Game.shots = []; Game.addEnemy('rockback', -8, -2.4, -1); const e = Game.enemies[0]; e.x = -8; Game.spawnTimer = 999; p.safe = 99;
              let shots = 0; for (let i = 0; i < 200; i++) {{ const before = Game.shots.filter(s => s.buddy).length; Game.update({STEP}); }}
              const dmg = 6 - e.hp; Game.buddies = []; return {{ each: CFG.BUDDY_DAMAGE, dmg }}; }}""")
    check(r["each"] == 0.25 and 0 < r["dmg"] <= 1.5, f"buddy shots do 0.25 damage each ({r})")

    # the four kinds of monsters each do their own thing
    r = js(f"""() => {{ const {{ Game }} = __game; const p = Game.player; p.x = 0; p.z = 0; p.safe = 99; Game.spawnTimer = 999; Game.buddies = [];
              Game.enemies = []; Game.orbs = []; Game.addEnemy('spitter', 0, 14, -1); Game.enemies[0].t = 0; Game.update({STEP});
              const spits = Game.orbs.filter(o => o.goo).length;
              Game.enemies = []; Game.addEnemy('zapbug', 0, 15, -1); Game.enemies[0].t = 0; Game.update({STEP}); const z0 = Game.enemies[0].z;
              for (let i = 0; i < 12; i++) Game.update({STEP}); const dashed = z0 - Game.enemies[0].z;
              Game.enemies = []; Game.pickups = []; Game.addEnemy('rockback', 0, 30, -1); const rb = Game.enemies[0], hp = rb.hp;
              for (let i = 0; i < hp - 1; i++) Game.damage(rb, 1); const alive = rb.hp > 0; Game.damage(rb, 1);
              const fruit = Game.pickups.length; Game.hearts = 3; p.x = Game.pickups[0].x; p.z = Game.pickups[0].z; Game.update({STEP});
              return {{ spits, dashed: dashed > 2.5, rockbackHp: hp, alive, fruit, hearts: Game.hearts }}; }}""")
    check(r == {"spits": 1, "dashed": True, "rockbackHp": 6, "alive": True, "fruit": 1, "hearts": 4},
          f"Goo Spitters spit, Zapbugs dash, Rockbacks take 6 hits and drop a heart fruit worth +1 heart ({r})")

    # getting touched costs a heart, then you're safe for a moment
    r = js(f"""() => {{ const {{ Game }} = __game; const p = Game.player; Game.hearts = 5; p.safe = 0; p.h = 0; Game.enemies = []; Game.addEnemy('gloom', p.x + 0.5, p.z, -1);
              Game.update({STEP}); const h = Game.hearts; Game.addEnemy('gloom', p.x + 0.5, p.z, -1); Game.update({STEP});
              return {{ h, after: Game.hearts }}; }}""")
    check(r["h"] == 4 and r["after"] == 4, f"a Gloomling bump costs one heart, then you're safe ({r})")

    # caves: new ones every game, bigger, with loops; walls block you; the weapon is at the far end; the portal takes you back up
    r = js("""() => { const { Game } = __game;
              const maps = Game.dungeons.map(d => d.g.join('\\n')); const W = Game.dungeons[0].W, H = Game.dungeons[0].H;
              const open = Game.dungeons[0].g.join('').split('').filter(c => c !== '#').length;
              return { different: new Set(maps).size === 4, W, H, open }; }""")
    check(r["different"] and r["W"] >= 25 and r["H"] >= 19 and r["open"] > 250, f"four different, bigger caves ({r})")
    r = js("""() => { const h = window.GAME_TEST_HOOK; h.reset({ seed: 5 }); const a = __game.Game.dungeons.map(d => d.g.join('')).join('|');
              h.reset({ seed: 6 }); const b = __game.Game.dungeons.map(d => d.g.join('')).join('|'); h.reset({ seed: 5 }); const c = __game.Game.dungeons.map(d => d.g.join('')).join('|');
              return { newEachGame: a !== b, sameSeedSame: a === c }; }""")
    check(r == {"newEachGame": True, "sameSeedSame": True}, f"the caves change every game (and the same seed gives the same caves) ({r})")
    js("() => { __game.Game.play(); }")  # back to a normal player game (bot mode ignores the keyboard)
    r = js("""() => { const { Game } = __game; const h = window.GAME_TEST_HOOK; let loops = 0;
              for (const d of Game.dungeons) { let edges = 0, cells = 0;
                for (let r = 0; r < d.H; r++) for (let c = 0; c < d.W; c++) { if (d.g[r][c] === '#') continue; cells++; if (c + 1 < d.W && d.g[r][c + 1] !== '#') edges++; if (r + 1 < d.H && d.g[r + 1][c] !== '#') edges++; }
                if (edges > cells) loops++; }
              return { loops, problems: h.selfCheck().filter(x => x.severity === 'error').length }; }""")
    check(r == {"loops": 4, "problems": 0}, f"every cave has loops, and the self-check finds every weapon, portal and trap in place ({r})")
    r = js(f"""() => {{ const {{ Game, Dun, CFG }} = __game; const p = Game.player, d = Game.dungeons[1]; Game.enemies = []; Game.hearts = 5;
              p.x = d.door.x; p.z = d.door.z; Game.update({STEP}); const inside = p.zone === 1, guards = Game.enemies.filter(e => e.zone === 1).length;
              p.safe = 99; const w = Dun.center(d, 1, 0); p.x = w.x; p.z = w.z + 0.3; Game.update({STEP}); const blocked = !Dun.solidAt(d, p.x, p.z);
              const [sc, sr] = Dun.cellOf(d, d.start.x, d.start.z), far = d.toWeapon[sr * d.W + sc];
              p.x = d.exit.x; p.z = d.exit.z; Game.update({STEP}); const portalShutTillWeapon = p.zone === 1;
              p.x = d.weapon.x; p.z = d.weapon.z; Game.update({STEP}); const got = Game.weapon, owned = Game.owned.slice();
              p.x = d.exit.x; p.z = d.exit.z; Game.update({STEP}); const back = p.zone === -1;
              p.x = d.door.x; p.z = d.door.z; Game.update({STEP});
              return {{ inside, guards, blocked, far, portalShutTillWeapon, got, owned, back, sealed: p.zone === -1 }}; }}""")
    check(r["inside"] and r["guards"] >= 8 and r["blocked"] and r["far"] >= 20 and r["portalShutTillWeapon"] and r["got"] == "grenade"
          and r["owned"] == ["blaster", "grenade"] and r["back"] and r["sealed"],
          f"cave stairs lead to a maze with guards; the weapon is far in; the portal opens once you have it; the stairs seal after ({r})")

    # v4: every cave hides all three trap kinds, and the Jet-Pack cave exists
    r = js("""() => { const { Game } = __game;
              return { caves: Game.dungeons.length,
                       jetCave: Game.dungeons.some(d => d.weaponKind === 'jetpack'),
                       allTrapped: Game.dungeons.every(d => ['bear', 'wire', 'axe'].every(k => d.traps.some(t => t.kind === k))),
                       trapCount: Game.dungeons.map(d => d.traps.length).join(',') }; }""")
    check(r["caves"] == 4 and r["jetCave"] and r["allTrapped"] and all(int(n) >= 6 for n in r["trapCount"].split(",")),
          f"four caves, one with the Jet-Pack, and each with bear traps, trip-wires and axe plates ({r})")

    # the traps: silent, one-shot (the axe re-arms), and the steel ones can be jumped
    r = js(f"""() => {{ const {{ Game, Dun }} = __game; const p = Game.player; const d = Game.dungeons[2];
              Game.enemies = []; p.x = d.door.x; p.z = d.door.z; Game.update({STEP});       // down the stairs of the still-open cave
              const inside = p.zone === 2;
              const bear = d.traps.find(t => t.kind === 'bear'), wire = d.traps.find(t => t.kind === 'wire'), axe = d.traps.find(t => t.kind === 'axe');
              Game.enemies = []; Game.hearts = 7; p.safe = 0; p.h = 0; p.x = bear.x; p.z = bear.z; Game.update({STEP});
              const bear1 = Game.hearts; Game.update({STEP}); const bear2 = Game.hearts;              // sprung: safe to walk over now
              p.safe = 0; bear.spent = false; p.x = bear.x; p.z = bear.z; p.h = 1.2; Game.update({STEP});
              const bearJump = Game.hearts;                                                        // a jump sails over the jaws
              Game.enemies = []; p.h = 0; p.safe = 99; p.x = wire.x; p.z = wire.z; Game.update({STEP});
              const dropped = Game.enemies.length, falling = Game.enemies[0] && Game.enemies[0].fallY > 3;    // it falls from the ceiling...
              let fell = false; for (let i = 0; i < 60; i++) {{ Game.update({STEP}); if (Game.enemies[0] && Game.enemies[0].fallY === undefined) {{ fell = true; break; }} }}
              Game.enemies = []; const h0 = Game.hearts; p.safe = 0; p.h = 0; p.x = axe.x; p.z = axe.z; Game.update({STEP});
              const started = axe.active; let axed = false;
              for (let i = 0; i < 90 && !axed; i++) {{ Game.update({STEP}); if (Game.hearts < h0) axed = true; }}   // ...and the axe blade sweeps through you
              p.x = d.start.x; p.z = d.start.z; for (let i = 0; i < 700; i++) Game.update({STEP});                     // walk away: it stops and re-arms
              const stopped = !axe.active && axe.cool <= 0;
              p.x = d.weapon.x; p.z = d.weapon.z; Game.update({STEP});                                                 // take the Sniper so the portal opens
              p.x = d.exit.x; p.z = d.exit.z; Game.update({STEP});                                                      // back out through the portal
              return {{ inside, bear1, bear2, bearJump, dropped, falling, fell, started, axed, stopped, out: p.zone === -1 }}; }}""")
    check(r["inside"] and r["bear1"] == 6 and r["bear2"] == 6 and r["bearJump"] == 6,
          f"a steel bear trap costs a heart once, then is safe; a jump sails over it ({r})")
    check(r["dropped"] == 1 and r["falling"] and r["fell"], f"a tripped rope drops a monster from the ceiling, and it lands ({r})")
    check(r["started"] and r["axed"] and r["stopped"] and r["out"], f"the axe plate starts the blade swinging, it hits, then stops and re-arms ({r})")

    # the weapons: switch with keys; the Big Laser burns while held, grenades blow up a crowd, the Sniper hits hard far away
    r = js(f"""() => {{ const {{ Game, Input }} = __game; const p = Game.player; Game.owned = ['blaster', 'laser', 'grenade', 'sniper']; Game.buddies = []; Game.spawnTimer = 999; p.safe = 999; p.h = 0;
              const face = (e) => {{ const o = Game.eye(), ey = Game.enemyY(e), d = Math.hypot(e.x - p.x, e.z - p.z); p.yaw = Math.atan2(e.x - p.x, e.z - p.z); p.pitch = Math.atan2(ey - o.y, d); }};
              const out = {{}};
              Input.weaponPick = 2; Game.update({STEP}); out.key2 = Game.weapon;
              Input.weaponPick = 'next'; Game.update({STEP}); out.next = Game.weapon;
              Input.weaponPick = 2; Game.update({STEP}); let rb = null, rx = 0, rz = 0;
              for (let k = 0; k < 72 && !rb; k++) {{ const a = k / 72 * Math.PI * 2; rx = p.x + Math.sin(a) * 15; rz = p.z + Math.cos(a) * 15; Game.enemies = []; Game.addEnemy('rockback', rx, rz, -1);
                const e = Game.enemies[0]; face(e); if (Game.ray(Game.eye(), Game.aim(), 45).hit === e) rb = e; }} // a direction with no hill in the way
              Input.keys.add('Space'); let t = 0; while (rb.hp > 0 && t < 300) {{ rb.x = rx; rb.z = rz; face(rb); Game.update({STEP}); t++; }} Input.keys.delete('Space');
              out.laserSeconds = +(t / 60).toFixed(2);
              Input.weaponPick = 4; Game.update({STEP}); Game.fireTimer = 0; Game.enemies = [];
              let sp = null; for (let k = 0; k < 72 && !sp; k++) {{ const a = k / 72 * Math.PI * 2; Game.enemies = []; Game.addEnemy('spitter', p.x + Math.sin(a) * 80, p.z + Math.cos(a) * 80, -1);
                const e = Game.enemies[0]; face(e); if (Game.ray(Game.eye(), Game.aim(), 140).hit === e) sp = e; }} // a direction with no hill in the way
              Input.keys.add('Space'); Game.update({STEP}); Input.keys.delete('Space'); out.sniperFar = !!sp && sp.hp <= 0;
              Input.weaponPick = 3; Game.update({STEP}); Game.fireTimer = 0; let ang = 0;
              for (let k = 0; k < 72; k++) {{ ang = k / 72 * Math.PI * 2; Game.enemies = []; Game.addEnemy('gloom', p.x + Math.sin(ang) * 9, p.z + Math.cos(ang) * 9, -1);
                const e = Game.enemies[0]; e.phase = 0; face(e); if (Game.ray(Game.eye(), Game.aim(), 20).hit === e) break; }} // a flat-ish direction
              const aimPitch = p.pitch; Game.enemies = [];
              for (let k = -1; k <= 1; k++) Game.addEnemy('gloom', p.x + Math.sin(ang) * 9 + Math.cos(ang) * k * 1.2, p.z + Math.cos(ang) * 9 - Math.sin(ang) * k * 1.2, -1);
              for (const e of Game.enemies) e.phase = 0; p.yaw = ang; p.pitch = aimPitch - 0.2; // grenades arc, so aim a little low
              Input.keys.add('Space'); Game.update({STEP}); Input.keys.delete('Space'); for (let i = 0; i < 120; i++) {{ for (const e of Game.enemies) {{ e.x = e.x; }} Game.update({STEP}); }}
              out.grenadeLeft = Game.enemies.length; return out; }}""")
    check(r["key2"] == "laser" and r["next"] == "grenade", f"keys 1 to 5 and X switch weapons ({r})")
    check(0.5 < r["laserSeconds"] < 1.5, f"the Big Laser melts a Rockback in about a second while you hold fire ({r['laserSeconds']} s)")
    check(r["sniperFar"], "the Sniper takes out a Goo Spitter 80 m away in one shot")
    check(r["grenadeLeft"] == 0, f"one grenade takes out a group of three Gloomlings ({r['grenadeLeft']} left)")

    # the Jet-Pack (the fourth cave's item, slot 5): hold fire to fly, let go to land
    r = js(f"""() => {{ const {{ Game, Input, CFG, WEAPONS }} = __game; const p = Game.player; Game.enemies = []; Game.boss = null; Game.bossPending = false; Game.spawnTimer = 999;
              p.x = 0; p.z = 0; p.zone = -1; p.h = 0; p.vy = 0; Game.owned = ['blaster', 'jetpack'];
              Input.weaponPick = 5; Game.update({STEP}); const got = Game.weapon, slot5 = WEAPONS.jetpack.key;
              Input.keys.add('Space'); let top = 0; for (let i = 0; i < 240; i++) {{ Game.update({STEP}); top = Math.max(top, p.h); }}
              const thrust = Game.thrust, high = +top.toFixed(2);
              Input.keys.delete('Space'); let landed = false, steps = 0; for (let i = 0; i < 400; i++) {{ Game.update({STEP}); steps++; if (p.h === 0 && p.vy === 0) {{ landed = true; break; }} }}
              return {{ got, slot5, thrust, high, landed }}; }}""")
    check(r["got"] == "jetpack" and r["slot5"] == 5 and r["thrust"] and 6.3 <= r["high"] <= 6.7 and r["landed"],
          f"key 5 takes the Jet-Pack (one inventory slot); holding fire flies you up to about 6.5 m, then you land ({r})")

    # 20 eggs bring MEGA GLOOM down; a shockwave can be jumped over
    r = js(f"""() => {{ const {{ Game, CFG }} = __game; const p = Game.player; Game.enemies = []; Game.eggs = []; p.safe = 999; p.h = 0; Game.eggsFound = CFG.EGGS - 1;
              Game.eggs.push({{ x: p.x + 1, z: p.z, zone: -1, color: '#ffffff', found: false, wobble: 0 }}); Game.update({STEP});
              const came = !!Game.boss; for (let i = 0; i < 180; i++) Game.update({STEP});
              return {{ came, landed: Game.boss && Game.boss.landed, eggs: Game.eggsFound, hp: Game.boss && Game.boss.hp, progress: Game.progress() }}; }}""")
    check(r["came"] and r["landed"] and r["eggs"] == 20 and r["hp"] > 200 and 0.62 <= r["progress"] < 0.75, f"20 eggs bring MEGA GLOOM down with lots of health ({r})")
    check(pg.is_visible("#bossBar"), "the boss health bar shows")
    r = js(f"""() => {{ const {{ Game }} = __game; const p = Game.player, B = Game.boss; Game.waves = []; Game.orbs = []; B.cd = 999; B.x = p.x + 30; B.z = p.z;
              const run = (jump) => {{ p.safe = 0; Game.hearts = 5; p.h = 0; p.vy = 0; Game.waves = [{{ x: p.x + 5, z: p.z, r: 0, max: 18, hit: false }}]; let jumped = false;
                for (let i = 0; i < 60; i++) {{ if (jump && !jumped && Game.waves[0] && Game.waves[0].r > 2.4) {{ p.vy = 7; p.h = 0.001; jumped = true; }} Game.update({STEP}); }} return Game.hearts; }};
              return {{ stood: run(false), jumped: run(true) }}; }}""")
    check(r == {"stood": 4, "jumped": 5}, f"MEGA GLOOM's shockwave hurts you unless you jump over it ({r})")
    # MEGA GLOOM's tricks: teleporting, the shockwave slam, flying with goo bombs, and getting angrier
    r = js(f"""() => {{ const {{ Game, CFG }} = __game; const B = Game.boss, p = Game.player; p.safe = 999; Game.buddies = []; B.cd = 0;
              B.mode = 'tele'; B.modeT = 0.01; const x0 = B.x; Game.update({STEP}); const teleported = B.x !== x0 && B.mode === 'walk';
              B.mode = 'slam'; B.modeT = 0.01; Game.update({STEP}); const wave = Game.waves.length > 0;
              B.mode = 'fly'; B.modeT = 3; B.bombT = 0; for (let i = 0; i < 30; i++) Game.update({STEP}); const flying = B.y > 4, bombs = Game.bombs.length > 0;
              B.hp = Math.floor(CFG.BOSS_HP * 0.3); B.mode = 'walk'; Game.update({STEP});
              return {{ teleported, wave, flying, bombs, phase: B.phase }}; }}""")
    check(r == {"teleported": True, "wave": True, "flying": True, "bombs": True, "phase": 3}, f"MEGA GLOOM teleports, slams a shockwave, flies and drops goo bombs, and reaches phase 3 ({r})")
    r = js(f"""() => {{ const {{ Game, Input, ground }} = __game; const B = Game.boss, p = Game.player; B.hp = 1; B.mode = 'walk'; B.y = 3.7; B.cd = 99; p.safe = 99;
              Game.weapon = 'blaster'; Game.waves = []; Game.orbs = []; Game.bombs = []; Game.enemies = []; B.x = p.x; B.z = p.z + 12;
              const aim = () => {{ const o = Game.eye(); p.yaw = Math.atan2(B.x - p.x, B.z - p.z); p.pitch = Math.atan2(ground(B.x, B.z) + B.y - o.y, Math.hypot(B.x - p.x, B.z - p.z)); }};
              Game.fireTimer = 0; for (let i = 0; i < 60 && Game.state === 'play'; i++) {{ aim(); B.x = p.x; B.z = p.z + 12; Input.keys.add('Space'); Game.update({STEP}); }} Input.keys.delete('Space');
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
    check(js("__game.Game.state") == "play" and js("__game.Game.hearts") == 7, "Play again starts a fresh run with 7 hearts")
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
    check(not pg.is_visible("#tSwap"), "SWAP only shows once you have a second weapon")
    pg.dispatch_event("#tJump", "pointerdown")
    pg.wait_for_timeout(150)
    h = pg.evaluate("__game.Game.player.h")
    pg.dispatch_event("#tJump", "pointerup")
    check(h > 0.2, f"the JUMP button jumps ({h:.2f} m up)")
    pg.evaluate("() => { __game.Game.owned = ['blaster', 'laser']; }")
    pg.wait_for_timeout(100)
    pg.dispatch_event("#tSwap", "pointerdown")
    pg.wait_for_timeout(100)
    check(pg.evaluate("__game.Game.weapon") == "laser", "SWAP switches to the next weapon")
    pg.tap("#btnPause")
    check(pg.evaluate("__game.Game.state") == "paused", "the pause button pauses on a touch screen")
    check(not g.errors, f"no console errors on the touch screen ({g.errors[:2]})")

# Proof the game can be won: autopilot.js plays whole games through the test hook, using only the bot's
# own actions (walk, turn, look up and down, jump, fire) and only the starting Blaster (the caves are
# optional). No aim help. It takes about 7 to 10 minutes of game time per win, simulated in seconds.
with GameSession(str(GAME)) as g:
    script = (HERE / "autopilot.js").read_text()
    for seed in (1, 3):
        r = g.page.evaluate(script, seed)
        check(r["status"] == "won", f"autopilot wins seed {seed} with the Blaster alone ({r['status']} after {r['seconds']} s: {r['log'][-2]})")

print("\nRESULT:", "ALL PASS" if not fails else f"{len(fails)} FAILED")
sys.exit(1 if fails else 0)
