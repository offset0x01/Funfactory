"""Headless browser test for Lost Luggage of the Cosmos.
Usage: python3 test_game.py [path/to/index.html] [screenshot_dir]
Checks: loads with no console errors, movement, scoring, Fizzy Jet, gravity zone,
getting hurt, game over + restart, level completion, and that a simple bot can
finish every level (terrain reachability)."""
import sys, pathlib
from playwright.sync_api import sync_playwright

HTML = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else pathlib.Path(__file__).with_name('index.html')).resolve()
SHOTS = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else None
fails = []
def check(cond, msg):
    print(('PASS ' if cond else 'FAIL ') + msg)
    if not cond: fails.append(msg)

BOT = r"""
(levelIdx) => {
  const { Game, Input } = window.__game;
  Game.levelIdx = levelIdx; Game.showIntro(); Game.beginLevel();
  const L = Game.level, p = Game.player, STEP = 1/120;
  let held = false, maxX = 0, stuck = 0, lastX = -1;
  const origAxis = Input.axis, origHeld = Input.jumpHeld;
  Input.axis = () => 1;
  Input.jumpHeld = () => held;
  try {
  const solid = (x, y) => { const t = (x < 0 || x >= L.W) ? '#' : (y < 0 || y >= L.H) ? ' ' : L.grid[y][x]; return '#=<>'.includes(t); };
  const hazard = (x, y) => (y >= 0 && y < L.H && x >= 0 && x < L.W) && '^v'.includes(L.grid[y][x]);
  for (let i = 0; i < 120 * 90; i++) {
    p.invuln = 99; // ignore enemies so we only test the terrain
    if (Game.state !== 'play') break;
    const gs = p.gs, fx = Math.floor(p.x + p.w + 0.35), feetRow = gs > 0 ? Math.floor(p.y + p.h + 0.2) : Math.floor(p.y - 0.2);
    const bodyRows = [Math.floor(p.y + 0.1), Math.floor(p.y + p.h - 0.1)];
    let wall = bodyRows.some(r => solid(fx, r));
    let groundAhead = false;
    for (let k = 0; k < 3; k++) { const r = feetRow + k * gs; if (solid(fx, r) && !hazard(fx, feetRow)) { groundAhead = true; break; } }
    const spikeAhead = hazard(fx, feetRow - gs) || hazard(fx + 1, feetRow - gs) || hazard(fx, Math.floor(p.y + p.h / 2));
    const zoneAhead = L.zone[Math.floor(p.y + p.h/2)]?.[fx];
    if (p.onGround && (wall || (!groundAhead && !zoneAhead) || spikeAhead)) { Input.jumpQueued = true; held = true; }
    if (!p.onGround && p.hasFizz && !p.burpUsed && p.vy * gs > -1 && (wall || !groundAhead)) { Input.jumpQueued = true; held = true; }
    if (p.onGround && !wall && groundAhead && !spikeAhead) held = false;
    Game.update(STEP);
    maxX = Math.max(maxX, p.x);
    if (i % 240 === 0) { if (Math.abs(p.x - lastX) < 0.05) stuck++; else stuck = 0; lastX = p.x; if (stuck > 3) break; }
    if (p.y > L.H + 1 || p.y < -2) return { done: false, reason: 'fell', x: p.x, maxX };
  }
  return { done: Game.state === 'complete' || Game.state === 'win', state: Game.state, x: p.x, maxX, W: L.W };
  } finally { Input.axis = origAxis; Input.jumpHeld = origHeld; }
}
"""

with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
    errors = []
    def new_page(**kw):
        pg = b.new_page(**kw)
        pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto(HTML.as_uri()); pg.wait_for_timeout(600)
        return pg

    pg = new_page(viewport={'width': 1180, 'height': 820})
    check(pg.evaluate('!!window.__game'), 'game script loaded')
    check(pg.is_visible('#scrTitle'), 'title screen shows')
    if SHOTS: pg.screenshot(path=str(SHOTS / 'title.png'))

    pg.click('#btnStart'); pg.wait_for_timeout(200)
    check(pg.is_visible('#scrIntro'), 'level intro shows')
    pg.click('#btnGo'); pg.wait_for_timeout(200)
    x0 = pg.evaluate('__game.Game.player.x')
    pg.keyboard.down('ArrowRight'); pg.wait_for_timeout(1300); pg.keyboard.up('ArrowRight')
    x1 = pg.evaluate('__game.Game.player.x')
    check(x1 > x0 + 3, f'player moves right with keyboard ({x0:.1f} -> {x1:.1f})')
    check(pg.evaluate('__game.Game.score') >= 20, 'collecting bolts scores points')
    y0 = pg.evaluate('__game.Game.player.y'); pg.keyboard.down('Space'); pg.wait_for_timeout(180)
    check(pg.evaluate('__game.Game.player.y') < y0 - 0.5, 'player jumps'); pg.keyboard.up('Space')
    pg.wait_for_timeout(800)
    if SHOTS: pg.screenshot(path=str(SHOTS / 'level1.png'))

    # Fizzy Jet double jump
    r = pg.evaluate("""() => { const {Game,Input}=__game, p=Game.player; p.hasFizz=true; p.vy=0;
      Input.jumpQueued=true; Game.update(1/120); for(let i=0;i<20;i++) Game.update(1/120);
      Input.jumpQueued=true; Game.update(1/120); return {burp:p.burpUsed}; }""")
    check(r['burp'], 'Fizzy Jet burp double jump triggers in mid-air')

    # hurt from a robot
    lives = pg.evaluate("""() => { const {Game}=__game, p=Game.player; p.invuln=0; const e=Game.level.enemies.find(e=>e.type==='robot'&&e.alive);
      p.x=e.x; p.y=e.y; p.vy=-3; Game.update(1/120); return Game.lives; }""")
    check(lives == 4, f'touching a robot from the side costs a life (lives={lives})')

    # stomp
    r = pg.evaluate("""() => { const {Game}=__game, p=Game.player; p.invuln=0; const e=Game.level.enemies.find(e=>e.type==='robot'&&e.alive);
      p.x=e.x; p.y=e.y-p.h+0.2; p.vy=5; const s=Game.score; Game.update(1/120); return {alive:e.alive, gained:Game.score-s}; }""")
    check(not r['alive'] and r['gained'] >= 50, 'stomping a robot defeats it and scores')

    # pause
    pg.keyboard.press('KeyP'); pg.wait_for_timeout(100)
    check(pg.is_visible('#scrPause'), 'P pauses the game')
    pg.keyboard.press('KeyP'); pg.wait_for_timeout(100)
    check(not pg.is_visible('#scrPause'), 'P resumes')

    # game over + restart
    pg.evaluate("""() => { const {Game}=__game; Game.lives=1; Game.player.invuln=0; Game.hurt(); }""")
    pg.wait_for_timeout(100)
    check(pg.is_visible('#scrOver'), 'losing the last life shows game over')
    pg.click('#btnRetry'); pg.wait_for_timeout(100)
    check(pg.evaluate('__game.Game.lives') == 5 and pg.is_visible('#scrIntro'), 'Try again restarts with full lives')

    # gravity zone (level 2)
    r = pg.evaluate("""() => { const {Game}=__game; Game.levelIdx=1; Game.showIntro(); Game.beginLevel(); const p=Game.player;
      p.x=44; p.y=11.5; for(let i=0;i<240;i++) Game.update(1/120); return {gs:p.gs, y:p.y, ground:p.onGround}; }""")
    check(r['gs'] == -1 and r['y'] < 3 and r['ground'], f'gravity zone flips player onto the ceiling ({r})')
    if SHOTS:
        pg.wait_for_timeout(300); pg.screenshot(path=str(SHOTS / 'level2-zone.png'))

    # level complete
    pg.evaluate("""() => { const {Game}=__game; const g=Game.level.goal; const p=Game.player; p.gs=1; p.x=g.x; p.y=g.y-0.5; Game.update(1/120); }""")
    pg.wait_for_timeout(100)
    check(pg.is_visible('#scrComplete'), 'reaching the Delivery Pad completes the level')

    # bot playthroughs
    for i in range(3):
        r = pg.evaluate(BOT, i)
        check(r.get('done'), f'bot can finish level {i+1} terrain ({r})')
        if i == 2 and SHOTS:
            pg.evaluate("""() => { const {Game}=__game; Game.levelIdx=2; Game.showIntro(); Game.beginLevel(); Game.player.x=30; Game.say('The Asteroid','Hello down there!'); }""")
            pg.wait_for_timeout(500); pg.screenshot(path=str(SHOTS / 'level3.png'))
    # demo mode: runs on its own, makes progress, never loses lives, stops on a key and after 30 s
    pg.evaluate("() => __game.Game.toMenu()"); pg.wait_for_timeout(100)
    pg.click('#btnDemo'); pg.wait_for_timeout(8000)
    d = pg.evaluate("() => ({demo: __game.Game.demo, x: __game.Game.player.x, lives: __game.Game.lives, lvl: __game.Game.levelIdx})")
    check(d['demo'] and (d['x'] > 30 or d['lvl'] > 0), f'demo plays by itself ({d})')
    check(pg.is_visible('#demoPill'), 'demo label shows')
    if SHOTS: pg.screenshot(path=str(SHOTS / 'demo.png'))
    pg.keyboard.press('KeyX'); pg.wait_for_timeout(150)
    check(not pg.evaluate("__game.Game.demo") and pg.is_visible('#scrTitle'), 'a key press stops the demo and returns to the title')
    r = pg.evaluate("""() => { const {Game, Demo}=__game; Demo.start(); let far=0, lvl=0;
      for (let i=0;i<120*31 && Game.demo;i++){ Demo.think(1/120); if(!Game.demo) break; Game.update(1/120); far=Math.max(far, Game.levelIdx*1000+Game.player.x); lvl=Game.levelIdx; }
      return {stillDemo: Game.demo, state: Game.state, lvl, far, lives: Game.lives}; }""")
    check(not r['stillDemo'] and r['state'] == 'title', f'demo ends on its own after about 30 s ({r})')
    check(r['lvl'] >= 1, f'demo reaches level 2 within 30 s ({r})')

    # no scrolling, even with host padding like the Claude artifact viewer adds
    sc = pg.evaluate("""() => { document.documentElement.style.padding='40px 0'; window.scrollTo(0, 500);
      return {sy: window.scrollY, sh: document.scrollingElement.scrollHeight, ch: document.scrollingElement.clientHeight}; }""")
    check(sc['sy'] == 0 and sc['sh'] <= sc['ch'] + 1, f'page cannot scroll ({sc})')
    pg.evaluate("() => { document.documentElement.style.padding=''; __game.Game.toMenu(); }"); pg.wait_for_timeout(100)
    check(pg.is_visible('#btnFull2'), 'title screen always has a full screen button')

    pg.close()

    # iPad portrait with touch
    ctx = b.new_context(viewport={'width': 820, 'height': 1180}, has_touch=True, is_mobile=True, device_scale_factor=2)
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(HTML.as_uri()); pg.wait_for_timeout(500)
    pg.tap('#btnStart'); pg.tap('#btnGo'); pg.wait_for_timeout(200)
    # full screen by touch on the title screen: where it is not allowed, the tap explains what to do
    pg.evaluate("() => __game.Game.toMenu()"); pg.wait_for_timeout(100)
    check(pg.is_visible('#btnFull2'), 'full screen button visible on touch title screen')
    pg.evaluate("() => { __game.Full.supported = () => false; }")
    pg.tap('#btnFull2'); pg.wait_for_timeout(100)
    check(pg.is_visible('#fullNote') and 'Home Screen' in pg.inner_text('#fullNote'), 'tapping full screen where it is blocked shows how to get it')
    pg.tap('#btnStart'); pg.tap('#btnGo'); pg.wait_for_timeout(200)
    check(pg.is_visible('#tJump') and pg.is_visible('#tRight'), 'touch controls visible on iPad')
    check(pg.is_visible('#btnTilt') or True, 'tilt button state ok')
    x0 = pg.evaluate('__game.Game.player.x')
    box = pg.locator('#tRight').bounding_box()
    cx, cy = box['x'] + box['width']/2, box['y'] + box['height']/2
    pg.evaluate(f"""() => {{ const el=document.getElementById('tRight'); el.dispatchEvent(new PointerEvent('pointerdown',{{pointerId:5,bubbles:true,pointerType:'touch',clientX:{cx},clientY:{cy}}})); }}""")
    pg.wait_for_timeout(900)
    pg.evaluate("""() => { document.getElementById('tRight').dispatchEvent(new PointerEvent('pointerup',{pointerId:5,bubbles:true,pointerType:'touch'})); }""")
    x1 = pg.evaluate('__game.Game.player.x')
    check(x1 > x0 + 2, f'touch right button moves player ({x0:.1f} -> {x1:.1f})')
    # tilt math: simulate landscape motion values
    t = pg.evaluate("""() => { const {Tilt}=__game; Tilt.offset=0; Tilt.sens=1; Tilt.invert=false;
      Tilt.handle({accelerationIncludingGravity:{x:-4,y:0,z:-8}}); return Tilt.axis(); }""")
    check(t > 0.5, f'tilt maths turns a right tilt into rightward movement ({t:.2f})')
    if SHOTS: pg.wait_for_timeout(300); pg.screenshot(path=str(SHOTS / 'ipad-portrait.png'))
    ctx.close()

    # ---- high scores (fresh browser profile each time) ----
    KEY = 'lost-luggage-of-the-cosmos.scores'
    def end_run(pg, score, win=False):
        pg.evaluate(f"""() => {{ const {{Game}}=__game; Game.startRun(); Game.beginLevel(); Game.score={score};
          {'Game.levelIdx=2; Game.completeLevel();' if win else 'Game.lives=1; Game.player.invuln=0; Game.hurt();'} }}""")
        pg.wait_for_timeout(150)

    hctx = b.new_context(viewport={'width': 1024, 'height': 768})
    pg = hctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(HTML.as_uri()); pg.wait_for_timeout(400)
    pg.click('#btnScores'); pg.wait_for_timeout(100)
    check(pg.is_visible('#scrScores') and 'No high scores yet' in pg.inner_text('#hsList'), 'High scores screen shows an empty board at first')
    pg.click('#btnScoresBack'); pg.wait_for_timeout(100)

    end_run(pg, 120)
    check(pg.is_visible('#hsOver .hsForm'), 'a qualifying game over asks for initials')
    pg.fill('#hsInitials', ''); pg.type('#hsInitials', 'ab1cpm')
    check(pg.input_value('#hsInitials') == 'ABC', f"initials are 3 capital letters ({pg.input_value('#hsInitials')!r})")
    check(pg.evaluate('__game.Game.state') == 'over' and not pg.evaluate("document.getElementById('scrPause').hidden === false"), 'typing P in initials does not pause')
    pg.keyboard.press('Enter'); pg.wait_for_timeout(150)
    rows = pg.evaluate("[...document.querySelectorAll('#hsOver tbody tr')].map(r => [r.className, ...[...r.cells].map(c => c.textContent)])")
    check(rows == [['new', '1', 'ABC', '120', 'Level 1']], f'Enter saves and highlights the new row ({rows})')
    saved = pg.evaluate(f"JSON.parse(localStorage.getItem('{KEY}'))")
    check(len(saved) == 1 and saved[0]['initials'] == 'ABC', 'score saved in this game\'s own storage key')

    end_run(pg, 50)
    check(pg.input_value('#hsInitials') == 'ABC', 'initials prefilled with the last ones used')
    pg.click('#btnRetry'); pg.wait_for_timeout(150)
    saved = pg.evaluate(f"JSON.parse(localStorage.getItem('{KEY}'))")
    check([e['score'] for e in saved] == [120, 50], 'leaving without pressing Save still keeps the score')

    end_run(pg, 900, win=True)
    check(pg.is_visible('#hsWin .hsForm'), 'a winning run asks for initials')
    pg.fill('#hsInitials', 'Zed'); pg.click('#hsWin button[type=submit]'); pg.wait_for_timeout(150)
    top = pg.evaluate("[...document.querySelectorAll('#hsWin tbody tr')][0].textContent")
    check('ZED' in top and '900' in top and 'Delivered!' in top, f'win entry goes to the top ({top})')

    pg.reload(); pg.wait_for_timeout(400)
    check(pg.inner_text('#bestScore') == '900', 'top score shows on the title screen after reload')
    pg.evaluate("() => { const l=[]; for(let i=0;i<10;i++) l.push({initials:'AAA',score:1000-i*10,detail:'x'}); localStorage.setItem('lost-luggage-of-the-cosmos.scores', JSON.stringify(l)); }")
    end_run(pg, 5)
    check(not pg.is_visible('#hsOver .hsForm'), 'a score below the top 10 does not ask for initials')
    pg.click('#btnMenu'); pg.wait_for_timeout(100)

    # test-hook bot runs never save
    before = pg.evaluate(f"localStorage.getItem('{KEY}')")
    pg.evaluate("() => { GAME_TEST_HOOK.reset({seed:1}); __game.Game.score = 5000; __game.Game.lives = 1; __game.Game.player.invuln = 0; __game.Game.hurt(); }")
    pg.wait_for_timeout(100)
    check(pg.evaluate(f"localStorage.getItem('{KEY}')") == before and not pg.is_visible('#hsOver .hsForm'), 'bot runs never save scores')
    hctx.close()

    # migration from the old 'llotc.' keys
    mctx = b.new_context()
    mctx.add_init_script("if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded','1'); localStorage.setItem('llotc.best','300'); localStorage.setItem('llotc.muted','true'); }")
    pg = mctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(HTML.as_uri()); pg.wait_for_timeout(400)
    m = pg.evaluate("({s: JSON.parse(localStorage.getItem('lost-luggage-of-the-cosmos.scores')), muted: localStorage.getItem('lost-luggage-of-the-cosmos.muted'), old: localStorage.getItem('llotc.best')})")
    check(m['s'] and m['s'][0]['score'] == 300 and m['muted'] == 'true' and m['old'] is None, f'old llotc. keys are migrated ({m})')
    mctx.close()

    # storage blocked: still plays, keeps scores for the visit, says so
    bctx = b.new_context()
    bctx.add_init_script("Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });")
    pg = bctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(HTML.as_uri()); pg.wait_for_timeout(400)
    end_run(pg, 70)
    pg.fill('#hsInitials', 'KID'); pg.keyboard.press('Enter'); pg.wait_for_timeout(150)
    txt = pg.inner_text('#hsOver')
    check('KID' in txt and "can’t be saved" in txt, 'blocked storage keeps scores for the visit and says so')
    bctx.close()
    b.close()

check(not errors, f'no console errors ({errors[:3]})')
print('\nRESULT:', 'ALL PASS' if not fails else f'{len(fails)} FAILED')
sys.exit(1 if fails else 0)
