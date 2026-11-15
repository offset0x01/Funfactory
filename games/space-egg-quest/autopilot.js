// Plays a whole game using only GAME_TEST_HOOK actions. It reads the game to decide where to look, like a player watching the screen.
(seed) => {
  const h = window.GAME_TEST_HOOK, { Game, CFG, KINDS, ground, bearing } = __game;
  h.reset({ seed });
  const causes = {}; const realHurt = Game.hurt.bind(Game);
  Game.hurt = () => { const p = Game.player; if (p.safe > 0) return false;
    let why = 'other', bd = 3; for (const e of Game.enemies) { const d = Math.hypot(e.x - p.x, e.z - p.z); if (e.zone === p.zone && d < bd) { bd = d; why = e.kind; } }
    if (Game.orbs.some(o => Math.hypot(o.x - p.x, o.z - p.z) < 1.5)) why = 'orb/goo';
    causes[why] = (causes[why] || 0) + 1; return realHurt(); };
  const log = [], wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  let s = h.getState(), lastEggs = 0; const ignore = new Set(); let aimAt = null, aimSince = 0, aimHp = 0;
  const act = (a, n) => { s = h.step(a, Math.max(1, Math.min(n, 12))); };
  while (s.status === 'playing') {
    const p = Game.player, o = Game.eye(), B = Game.boss;
    // 1. what to shoot: the nearest monster in sight (or the boss)
    let tgt = null, best = 1e9;
    for (const e of Game.enemies) if (e.zone === p.zone && e.hp > 0 && !ignore.has(e)) {
      const d = Math.hypot(e.x - p.x, e.z - p.z); if (d > 30) continue;
      const a = { x: e.x - o.x, y: Game.enemyY(e) - o.y, z: e.z - o.z }, L = Math.hypot(a.x, a.y, a.z);
      if (Game.ray(o, { x: a.x / L, y: a.y / L, z: a.z / L }, 45).hit !== e) continue;
      const score = d - (e.kind === 'zapbug' ? 6 : e.kind === 'spitter' ? 10 : 0); if (score < best) { best = score; tgt = e; }
    }
    if (!tgt && B && B.landed && B.mode !== 'tele' && p.zone === -1) tgt = B;
    // dodge: a boss orb or goo bomb on its way to you? step sideways out of its path
    let dodge = null;
    for (const ob of Game.orbs) if (!ob.goo && ob.zone === p.zone) {
      const rx = p.x - ob.x, rz = p.z - ob.z, vv = ob.vx * ob.vx + ob.vz * ob.vz, tt = (rx * ob.vx + rz * ob.vz) / vv;
      if (tt <= 0 || tt > 1.6) continue;
      const mx = rx - ob.vx * tt, mz = rz - ob.vz * tt, miss = Math.hypot(mx, mz);
      if (miss < 1.7) { const side = miss > 0.05 ? Math.atan2(mx, mz) : Math.atan2(ob.vz, -ob.vx); dodge = side; break; }
    }
    if (!dodge) for (const bm of Game.bombs) if (Math.hypot(bm.x - p.x, bm.z - p.z) < 3.2) { dodge = Math.atan2(p.x - bm.x, p.z - bm.z) || 0.01; break; }
    if (dodge !== null) {
      const dy = wrap(dodge - p.yaw);
      if (Math.abs(dy) > 0.5) { act(dy > 0 ? 'turnleft' : 'turnright', Math.ceil((Math.abs(dy) - 0.3) / (CFG.TURN / 60))); continue; }
      act('forward', 12); continue;
    }
    // an egg or a heart fruit close by comes first, unless a monster is right on top of you
    const near = [...Game.eggs.filter(e => !e.found), ...(p.safe <= 0 && s.lives < 5 ? Game.pickups : [])].filter(e => e.zone === p.zone && Math.hypot(e.x - p.x, e.z - p.z) < 35)
      .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
    if (near && !(tgt && tgt !== B && best < 7)) tgt = null;
    // jump over a shockwave that's about to reach you
    const gooComing = Game.orbs.some(o => o.goo && o.zone === p.zone && Math.hypot(o.x - p.x, o.z - p.z) < 3 && (o.vx * (p.x - o.x) + o.vz * (p.z - o.z)) > 0);
    if ((gooComing || Game.waves.some(w => { const d = Math.hypot(w.x - p.x, w.z - p.z) - w.r; return d > 0.8 && d < 3.5; })) && p.h === 0) { act('jump', 2); continue; }
    if (tgt && tgt !== aimAt) { aimAt = tgt; aimSince = s.steps; aimHp = tgt.hp; }
    if (tgt && tgt !== B && s.steps - aimSince > 300) { if (tgt.hp >= aimHp) ignore.add(tgt); aimSince = s.steps; aimHp = tgt.hp; } // can't hit it from here: move on
    if (tgt && !ignore.has(tgt)) {
      const ty = tgt === B ? ground(B.x, B.z) + B.y : Game.enemyY(tgt);
      const yawWant = Math.atan2(tgt.x - p.x, tgt.z - p.z), dyaw = wrap(yawWant - p.yaw);
      const pitchWant = Math.atan2(ty - o.y, Math.hypot(tgt.x - p.x, tgt.z - p.z)) - (Game.weapon === 'grenade' ? 0.15 : 0), dp = pitchWant - p.pitch;
      const d = Math.hypot(tgt.x - p.x, tgt.z - p.z);
      if (Math.abs(dyaw) > 0.05) { act(dyaw > 0 ? 'turnleft' : 'turnright', Math.ceil(Math.abs(dyaw) / (CFG.TURN / 60))); continue; }
      if (Math.abs(dp) > 0.035) { act(dp > 0 ? 'lookup' : 'lookdown', Math.ceil(Math.abs(dp) / (CFG.LOOK_SPEED / 60))); continue; }
      act(d > 18 && tgt !== B ? 'forward_fire' : 'fire', 4); continue;
    }
    // 2. nothing to shoot: walk to the egg, the weapon cave, or the way out; else wander to find monsters
    const n = Game.navigate();
    let goal = near || (n ? n.next : null);
    if (n && n.label === 'weapon cave') goal = null; // caves are optional, and bots can't switch weapons: win with the blaster alone
    if (!goal) goal = { x: -p.x * 0.5 + Math.sin(Game.time * 0.05) * 40, z: -p.z * 0.5 + Math.cos(Game.time * 0.05) * 40 };
    const dyaw = wrap(Math.atan2(goal.x - p.x, goal.z - p.z) - p.yaw);
    if (Math.abs(p.pitch) > 0.05) { act(p.pitch > 0 ? 'lookdown' : 'lookup', Math.ceil(Math.abs(p.pitch) / (CFG.LOOK_SPEED / 60))); continue; }
    if (Math.abs(dyaw) > 0.12) { act(dyaw > 0 ? 'turnleft' : 'turnright', Math.ceil(Math.abs(dyaw) / (CFG.TURN / 60))); continue; }
    act('forward', 6);
    if (s.eggs !== lastEggs) { lastEggs = s.eggs; }
    if (s.steps % 3600 < 6) log.push(`t=${(s.steps / 60).toFixed(0)}s eggs=${s.eggs} kills=${s.kills} hearts=${s.lives} weapons=${s.weapons.length} zone=${p.zone}`);
  }
  log.push(`END ${s.status} t=${(s.steps / 60).toFixed(0)}s eggs=${s.eggs} kills=${s.kills} hearts=${s.lives} score=${s.score} bossHp=${s.bossHp} weapons=${s.weapons}`);
  Game.hurt = realHurt; log.push(JSON.stringify(causes));
  return { status: s.status, seconds: Math.round(s.steps / 60), log };
}
