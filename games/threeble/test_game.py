#!/usr/bin/env python3
"""Threeble's own browser test. Run it from the repo root after every change:

  python3 games/threeble/test_game.py

The shared harness (test-harness/harness/run_tests.py) checks what every game must do. This
file tests what is special to Threeble:
  1. the rules: words along x, y and z, read either way, sideways words, bonus squares, holes,
     the +50 bonus, the word list (and no rude words)
  2. the word builder with real taps: tap a tile face, add tiles on both sides, Swing, Space over
     a board tile, Play; Hint
  3. the camera: one finger spins, two fingers pinch and twist, the peel slider hides layers
     (and hidden tiles can't be tapped), Lock
  4. computer players (1 to 3, each level), Swap, Pass, the end of the game and high scores
  5. friends passing one device (racks hidden until Ready)
  6. online play between four tabs over real WebRTC through a fake local MQTT broker
"""
import math
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "test-harness" / "harness"))
sys.path.insert(0, str(ROOT / "test-harness" / "tests"))
from gamebot.browser import GameSession  # noqa: E402
from fake_mqtt_broker import FakeBroker  # noqa: E402

GAME = HERE / "index.html"
FOLDER = HERE.name
fails = []


def check(ok, msg):
    print(("PASS " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)


def wait_for(page, js, ms=8000):
    try:
        page.wait_for_function(js, timeout=ms)
        return True
    except Exception:
        return False


# Lay out a board: {(x, y, z): letter}. The middle cell is (4, 4, 4). Also sets player 0's rack.
SET = """([cells, rack]) => { const { Game, idx, N } = __game;
  Game.board = new Array(N ** 3).fill(''); Game.owner = new Array(N ** 3).fill(-1);
  for (const [x, y, z, L] of cells) Game.board[idx(x, y, z)] = L;
  if (rack) Game.players[Game.turn].rack = rack.split('');
  Game.turn = 0; __game.Builder.close(); __game.UI.key = ''; }"""
EVAL = "(placed) => { const r = __game.Rules.evaluate(__game.Game.board, placed.map(([x, y, z, L]) => ({ i: __game.idx(x, y, z), L }))); return { ok: r.ok, msg: r.msg || '', score: r.score || 0, main: r.main || '', words: (r.words || []).map(w => w.w) }; }"
CENTER = (4, 4, 4)
# screen spot of the middle of a cell's face: [x, y, z] cell, face axis, face sign
FACE = "([c, a, s]) => { const p = __game.pos(__game.idx(...c)); p[a] += 0.47 * s; return __game.project(p); }"

with GameSession(str(GAME)) as g:
    pg = g.page
    js = pg.evaluate

    # ---------- 1. the rules ----------
    check(js("__game.Dict.size") > 50000, f"the word list is loaded ({js('__game.Dict.size')} words)")
    check(js("['CAT','ZEBRA','QUIZ','JUMPED'].every(w => __game.Dict.has(w))"), "everyday words are in the list")
    check(js("!__game.Dict.has('SHIT') && !__game.Dict.has('FUCKED') && !__game.Dict.has('BITCH')"), "rude words are not words in this game")
    pg.keyboard.press("Enter")
    check(js("__game.Game.mode") == "solo" and js("__game.Game.players.length") == 2 and js("__game.Game.state") == "play",
          "Enter starts a game against one computer")
    check(js("__game.Game.board.filter(Boolean).length") == 1 and js(f"!!__game.Game.board[__game.idx({CENTER[0]},{CENTER[1]},{CENTER[2]})]"),
          "the game starts with one tile in the middle of the cube")
    js(SET, [[[4, 4, 4, "A"]], None])
    r = js(EVAL, [[3, 4, 4, "C"], [5, 4, 4, "T"]])
    check(r["ok"] and r["main"] == "CAT" and r["score"] == 5, f"CAT along x scores 3+1+1 = 5 ({r})")
    r = js(EVAL, [[3, 4, 4, "T"], [5, 4, 4, "C"]])
    check(r["ok"] and r["main"] == "CAT", f"a word counts read either way along its line (TAC reads CAT backwards) ({r})")
    r = js(EVAL, [[4, 3, 4, "C"], [4, 5, 4, "T"]])
    check(r["ok"] and r["score"] == 5, f"words run up and down (y) ({r})")
    r = js(EVAL, [[4, 4, 5, "T"], [4, 4, 6, "E"]])
    check(r["ok"] and r["main"] == "ATE", f"words run front to back (z) ({r})")
    r = js(EVAL, [[3, 4, 4, "X"], [5, 4, 4, "Q"]])
    check(not r["ok"] and "isn't a word" in r["msg"], f"a made-up word is rejected ({r['msg']})")
    r = js(EVAL, [[2, 4, 4, "C"], [5, 4, 4, "T"]])
    check(not r["ok"] and "hole" in r["msg"], f"tiles with a gap between them are rejected ({r['msg']})")
    r = js(EVAL, [[3, 4, 4, "C"], [4, 3, 4, "T"]])
    check(not r["ok"] and "straight line" in r["msg"], f"tiles must be in one straight line ({r['msg']})")
    r = js(EVAL, [[0, 0, 0, "Z"], [1, 0, 0, "O"]])
    check(not r["ok"] and "touch" in r["msg"], f"a word must touch the tiles already on the board ({r['msg']})")
    # sideways words in two directions at once: T next to A (x) and under O (y)
    js(SET, [[[4, 4, 4, "A"], [5, 5, 4, "O"]], None])
    r = js(EVAL, [[5, 4, 4, "T"]])
    check(r["ok"] and sorted(r["words"]) == ["AT", "TO"] and r["score"] == 4, f"one tile can make words along two axes at once, and both score ({r})")
    mult = js("[[0,0,0],[4,0,0],[3,3,3],[4,4,0],[2,2,4],[4,4,1],[4,4,4]].map(c => __game.MULT[__game.idx(...c)])")
    check(mult == ["TW", "TW", "DW", "DW", "DL", "", ""], f"bonus squares: corners and edge middles 3x word, face middles 2x word, the middle plain ({mult})")
    js(SET, [[[1, 0, 0, "A"]], None])
    r = js(EVAL, [[0, 0, 0, "T"]])
    check(r["ok"] and r["score"] == 6, f"a corner is 3x word: TA = (1+1) x 3 = 6 ({r})")
    dl = js("(() => { for (let i = 0; i < __game.N ** 3; i++) if (__game.MULT[i] === 'DL') return __game.xyz(i); })()")
    nb = [dl[0] + (1 if dl[0] < 8 else -1), dl[1], dl[2]]
    js(SET, [[[*nb, "A"]], None])
    r = js(EVAL, [[*dl, "X"]])
    check(r["ok"] and r["score"] == 17, f"a 2x letter square doubles the new tile: AX = 8x2 + 1 = 17 ({r})")
    # +50 for using all 7 tiles: QUESTION through a board T (8 letters = 7 tiles + 1 board tile)
    js(SET, [[[4, 4, 4, "T"]], None])
    r = js(EVAL, [[0, 4, 4, "Q"], [1, 4, 4, "U"], [2, 4, 4, "E"], [3, 4, 4, "S"], [5, 4, 4, "I"], [6, 4, 4, "O"], [7, 4, 4, "N"]])
    six = js(EVAL, [[1, 4, 4, "U"], [2, 4, 4, "E"], [3, 4, 4, "S"], [5, 4, 4, "I"], [6, 4, 4, "O"], [7, 4, 4, "N"]])
    check(r["ok"] and r["main"] == "QUESTION" and r["score"] >= 50 + 2 * (10 + 1 + 2 + 1 + 1 + 1 + 2 + 1), f"using all 7 tiles in one word adds 50 (QUESTION: {r['score']})")

    # ---------- 2. the word builder, with real taps on a phone ----------
    g.open(viewport=(390, 844), touch=True)
    pg = g.page
    js = pg.evaluate
    pg.tap("#btnPlay"); pg.tap("#btnSoloGo")
    js(SET, [[[4, 4, 4, "A"], [5, 4, 4, "T"]], "CXRSONE"])
    pg.wait_for_timeout(200)
    # a face of the middle tile that faces the camera
    face = js("() => { const e = __game.Cam.eye(); let a = 0; for (let k = 1; k < 3; k++) if (Math.abs(e[k]) > Math.abs(e[a])) a = k; return [a, Math.sign(e[a])]; }")
    pt = js(FACE, [list(CENTER), face[0], face[1]])
    pg.touchscreen.tap(pt[0], pt[1])
    b = js("__game.Builder.b")
    check(b is not None and b["anchor"] == js("__game.idx(4,4,4)") and pg.is_visible("#builder"), "tapping a tile opens the word builder with that tile as the anchor")
    check(b is not None and b["dir"] % 3 == face[0], f"the word starts out of the face you tapped (axis {face[0]}, builder {b and b['dir']})")
    js("() => { __game.Builder.b.dir = 0; __game.UI.key = ''; }")  # run along +x for the rest
    pg.wait_for_timeout(100)
    pg.tap("#slots .plus[data-side='-1']")
    pg.tap("#rack .tile[data-r='0']")   # C on the left
    pg.tap("#slots .plus[data-side='1']")
    pg.tap("#rack .tile[data-r='0']")   # tapping a used tile does nothing
    pg.tap("#bGap")                     # a Space lines up with the T on the board
    pg.wait_for_timeout(100)
    c = js("(() => { const c = __game.Builder.check(); return { ok: c.ok, score: c.score, words: (c.words || []).map(w => w.w), placed: c.placed.length }; })()")
    check(c["ok"] and c["words"] == ["CAT"] and c["placed"] == 1, f"tiles go on either side of the anchor, and a Space crosses a board tile: C + A + (T) = CAT ({c})")
    check("CAT" in pg.inner_text("#bInfo") and not pg.is_disabled("#bPlay"), f"the builder shows the word and its score ({pg.inner_text('#bInfo')})")
    # swing: six directions, each puts the word somewhere else
    seen = set()
    for _ in range(6):
        pg.tap("#bSwing"); pg.wait_for_timeout(60)
        seen.add(tuple(js("__game.Builder.check().cells.map(c => c.i).join()").split(",")))
    check(len(seen) == 6 and js("__game.Builder.b.dir") == 0, "Swing turns the word through all six directions out of the anchor and back")
    js("() => { __game.Builder.b.dir = 1; __game.UI.key = ''; }")
    pg.wait_for_timeout(100)
    check("line up with a tile" in pg.inner_text("#bInfo") and pg.is_disabled("#bPlay"), f"swung so the Space is over an empty cell, it can't be played ({pg.inner_text('#bInfo')})")
    js("() => { __game.Builder.b.dir = 0; __game.UI.key = ''; }")
    pg.wait_for_timeout(100)
    pg.tap("#bPlay")
    check(wait_for(pg, "__game.Game.players[0].score === 5 && __game.Game.board[__game.idx(3,4,4)] === 'C' && __game.Game.turn === 1", 2000),
          "Play puts the tile on the board, scores CAT for 5 and passes the turn")
    check(js("__game.Game.players[0].rack.length") == 7 and not pg.is_visible("#builder"), "your rack is filled back up to 7 and the builder closes")
    check(wait_for(pg, "__game.Game.turn === 0 && __game.Game.players[1].score > 0", 5000), "the computer plays its word and it's your turn again")
    # blocked tile and edges
    js(SET, [[[4, 4, 4, "A"], [5, 4, 4, "T"]], "CXRSONE"])
    js("() => __game.Builder.open(__game.idx(4,4,4), [0, 1])")
    js("() => { __game.Builder.addRack(0); }")
    check("in the way" in js("__game.Builder.check().msg"), "a tile can't go where a board tile already is (use a Space)")
    js("() => { const B = __game.Builder; B.clear(); B.b.anchor = __game.idx(8,4,4); B.addRack(0); }")
    check("edge" in js("__game.Builder.check().msg"), "a word can't stick out of the cube")
    js("() => __game.Builder.close()")
    # hint
    pg.tap("#btnHint")
    pg.wait_for_timeout(300)
    h = js("(() => { const c = __game.Builder.check(); return c && { ok: c.ok, score: c.score }; })()")
    check(h and h["ok"] and h["score"] > 0 and "Hint" in pg.inner_text("#msg"), f"Hint puts a playable word in the builder ({h})")
    # a tap on a computer's turn
    check(not js("(() => { __game.Game.turn = 1; return __game.Game.canAct(); })()"), "you can't build on the computer's turn")
    js("__game.Game.turn = 0")

    # ---------- 3. camera, fingers and the peel ----------
    js(SET, [[[4, 4, 4, "A"]], None])
    cdp = pg.context.new_cdp_session(pg)
    touch = lambda t, pts: cdp.send("Input.dispatchTouchEvent", {"type": t, "touchPoints": [{"x": x, "y": y, "id": i} for i, (x, y) in enumerate(pts)]})
    rot0 = js("__game.Cam.rot.slice()")
    touch("touchStart", [(100, 200)])
    for k in range(1, 8):
        touch("touchMove", [(100 + 15 * k, 200 + 5 * k)]); pg.wait_for_timeout(16)
    touch("touchEnd", [])
    rot1 = js("__game.Cam.rot.slice()")
    check(max(abs(a - b) for a, b in zip(rot0, rot1)) > 0.3 and js("__game.Builder.b") is None, "one finger spins the cube (and a drag doesn't open the builder)")
    d0 = js("__game.Cam.dist")
    touch("touchStart", [(150, 300), (250, 300)])
    for k in range(1, 8):
        touch("touchMove", [(150 - 8 * k, 300), (250 + 8 * k, 300)]); pg.wait_for_timeout(16)
    touch("touchEnd", [])
    d1 = js("__game.Cam.dist")
    check(d1 < d0 * 0.8, f"pinching apart zooms in ({d0:.1f} -> {d1:.1f})")
    r0 = js("__game.Cam.rot.slice()")
    touch("touchStart", [(150, 300), (250, 300)])
    for k in range(1, 8):
        a = k * 0.1
        touch("touchMove", [(200 - 50 * math.cos(a), 300 - 50 * math.sin(a)), (200 + 50 * math.cos(a), 300 + 50 * math.sin(a))]); pg.wait_for_timeout(16)
    touch("touchEnd", [])
    r1 = js("__game.Cam.rot.slice()")
    check(max(abs(a - b) for a, b in zip(r0, r1)) > 0.3 and abs(js("__game.Cam.dist") - d1) < 1.5, "twisting two fingers turns the cube")
    # peel: drag the slider knob down
    js("__game.Cam.reset()")
    js(SET, [[[4, 4, 4, "A"]] + [[x, y, z, "E"] for x in range(9) for y in range(9) for z in range(9) if (x + y + z) % 7 == 0], None])
    box = pg.locator("#peelTrack").bounding_box()
    pg.touchscreen.tap(box["x"] + 22, box["y"] + 17 + (box["height"] - 34) * 3 / 8)
    pg.wait_for_timeout(500)
    st = js("({ peel: __game.Cam.peel, axis: __game.Cam.axis, sign: __game.Cam.sign, thumb: document.querySelector('#peelThumb').textContent })")
    check(st["peel"] == 3 and st["thumb"] == "3", f"dragging the peel slider down peels layers off ({st})")
    hid = js("""() => { const { Cam, idx, N, Game } = __game; let shown = 0, hidden = 0;
      for (let i = 0; i < N ** 3; i++) if (Game.board[i]) Cam.hidden(i) ? hidden++ : shown++; return [shown, hidden]; }""")
    check(hid[0] > 0 and hid[1] > 0, f"the peel hides the layers nearest you and keeps the rest ({hid[0]} shown, {hid[1]} hidden)")
    front = js("""() => { const { Cam, N, Game, xyz } = __game; for (let i = 0; i < N ** 3; i++) {
        const p = xyz(i); if (Game.board[i] && (p[Cam.axis] - 4) * Cam.sign === 4) return i; } return -1; }""")
    hit = js("([i]) => { const { project, pos, pickFace } = __game; const s = project(pos(i)); const h = pickFace(s[0], s[1]); return h && h.i; }", [front])
    check(front >= 0 and hit != front, "a peeled-away tile can't be tapped: the tap goes to a tile inside")
    (HERE / "test-results").mkdir(exist_ok=True)
    pg.screenshot(path=str(HERE / "test-results" / "peel.png"))
    ax0 = js("__game.Cam.axis")
    pg.tap("#peelLock")
    js("() => { __game.Cam.turn(1, Math.PI / 2); __game.Cam.turn(0, 0.3); }")
    pg.wait_for_timeout(100)
    check(js("__game.Cam.axis") == ax0 and js("__game.Cam.locked"), "Lock keeps the peel on the same side while you spin")
    pg.tap("#peelLock")
    pg.wait_for_timeout(100)
    check(js("__game.Cam.axis") != ax0, "unlocked, the peel follows the side facing you")
    js("__game.Cam.setPeel(0)")
    check(not g.errors, f"no console errors ({g.errors[:2]})")

    # ---------- 4. computers, Swap, Pass, the end and high scores ----------
    g.open()
    pg = g.page
    js = pg.evaluate
    pg.click("#btnPlay")
    pg.click("#cpuCount button[data-n='3']"); pg.click("#cpuLevel button[data-l='hard']"); pg.click("#btnSoloGo")
    check(js("__game.Game.players.map(p => p.cpu)") == [None, "hard", "hard", "hard"], "you can play 3 computers on Hard")
    pg.click("#btnPass")
    check(wait_for(pg, "__game.Game.turn === 0 && __game.Game.players.slice(1).every(p => p.score > 0)", 8000), "each computer takes its turn and plays a word")
    rack0 = js("__game.Game.players[0].rack.join('')")
    pg.click("#btnSwap")
    pg.click("#rack .tile[data-r='0']"); pg.click("#rack .tile[data-r='1']")
    check(js("[...__game.Swap.pick].length") == 2, "Swap lets you pick tiles")
    pg.click("#btnSwapGo")
    check(wait_for(pg, "__game.Game.turn !== 0 || /swapped 2/.test(__game.Game.log)", 2000) and "swapped 2" in js("__game.Game.log"), f"Swap trades the picked tiles and ends your turn ({js('__game.Game.log')})")
    # easy computers only play common words
    easy = js("""() => { const { Game, findMoves } = __game; const m = findMoves(Game.board, Game.players[0].rack, true);
       const common = w => { let n = __game.Dict.root; for (const ch of w) n = n && n.k[ch]; return !!(n && (n.w & 2)); };
       return m.length > 0 && m.every(x => __game.Rules.evaluate(Game.board, x.placed).words.some(w => common(w.raw) || common([...w.raw].reverse().join('')))); }""")
    check(easy, "Easy and Medium computers only play common words")
    # the end: the last tile out of the bag ends the game
    js("""() => { const G = __game.Game; G.turn = 0; G.bag = []; G.players[0].rack = ['T'];
        G.board = new Array(729).fill(''); G.board[__game.idx(4,4,4)] = 'A'; G.players[0].score = 999; __game.Builder.close(); }""")
    js("() => { __game.Builder.open(__game.idx(4,4,4), [0, 1]); __game.Builder.addRack(0); }")
    pg.keyboard.press("Enter")
    check(wait_for(pg, "__game.Game.state === 'over'", 3000) and "you win" in pg.inner_text("#endTitle").lower(),
          "using your last tile with the bag empty ends the game, highest score wins")
    check(pg.is_visible("#endForm"), "a winning score asks for initials")
    pg.fill("#initials", "abc"); pg.keyboard.press("Enter")
    saved = js(f"JSON.parse(localStorage.getItem('{FOLDER}.scores'))")
    check(bool(saved) and saved[0]["initials"] == "ABC" and saved[0]["score"] > 999 and "3 hard" in saved[0]["detail"], f"score saved under {FOLDER}.scores ({saved[:1]})")
    pg.click("#btnMenu")
    check("Top score" in pg.inner_text("#titleTop"), "the title shows the top score")
    # everyone passing twice ends the game
    pg.click("#btnPlay"); pg.click("#cpuCount button[data-n='1']"); pg.click("#btnSoloGo")
    js("() => { const G = __game.Game; G.scoreless = 3; }")
    pg.click("#btnPass")
    check(wait_for(pg, "__game.Game.state === 'over'", 2000), "when every player passes twice in a row, the game ends")
    pg.click("#btnMenu")

    # ---------- 5. friends passing one device ----------
    pg.click("#btnShared"); pg.click("#btnShared3")
    check(js("__game.Game.players.length") == 3 and pg.is_visible("#scrHandoff") and "Green" in pg.inner_text("#handTitle"), "3 friends: the game asks Green to take the device")
    check(js("[...document.querySelectorAll('#rack .tile')].every(t => t.classList.contains('hidden'))"), "racks are hidden until the player taps Ready")
    pg.click("#btnReady")
    check(not pg.is_visible("#scrHandoff") and js("[...document.querySelectorAll('#rack .tile.hidden')].length") == 0, "Ready shows Green's tiles")
    pg.click("#btnPass")
    check(wait_for(pg, "!document.querySelector('#scrHandoff').hidden", 2000) and "Blue" in pg.inner_text("#handTitle"), "after a turn the device goes to Blue")
    pg.keyboard.press("KeyP")
    check(js("__game.Game.state") == "paused", "P pauses")
    pg.keyboard.press("KeyP")
    check(pg.is_visible("#scrHandoff"), "unpausing goes back to the hand-over screen")
    pg.click("#btnReady")
    pg.click("#btnPause"); pg.click("#btnQuit")
    check(not g.errors, f"no console errors ({g.errors[:2]})")

    # ---------- 6. online, four tabs ----------
    with FakeBroker() as broker:
        def tab(extra=""):
            ctx = g.browser.new_context(viewport={"width": 700, "height": 700})
            ctx.add_init_script(f"window.NET_TEST_CONFIG = {{ brokers: ['{broker.url}'], ice: [] {extra} }};")
            p = ctx.new_page()
            p.on("pageerror", lambda e: g.errors.append(f"pageerror: {e}"))
            p.goto(GAME.as_uri())
            p.wait_for_timeout(300)
            return p

        def join(p, code):
            p.click("#btnOnline"); p.fill("#joinCode", code); p.click("#btnJoin")

        host = tab()
        host.click("#btnOnline"); host.click("#btnHost")
        code = host.inner_text("#roomCode").strip()
        check(len(code) == 5 and host.is_disabled("#btnStart"), f"hosting shows a room code ({code})")
        guests = [tab() for _ in range(3)]
        for i, gp in enumerate(guests):
            join(gp, code.lower())
            wait_for(host, f"__game.Net.count === {i + 1}", 15000)
        check(wait_for(host, "__game.Net.count === 3", 15000) and not host.is_disabled("#btnStart"), "three friends join with the code")
        extra = tab()
        join(extra, code)
        check(wait_for(extra, "/full/i.test(document.querySelector('#onlineStatus').textContent)", 10000), "a fifth player is told the game is full")
        host.click("#btnStart")
        ok = all(wait_for(gp, "__game.Game.state === 'play' && __game.Game.players.length === 4 && __game.Game.players[__game.Game.me].rack.length === 7", 8000) for gp in guests)
        check(ok, "Start: every friend sees the cube, four players and their own 7 tiles")
        if ok:
            check([gp.evaluate("__game.Game.me") for gp in guests] == [1, 2, 3], "friends get seats 1, 2, 3 in join order")
            racks = [gp.evaluate("__game.Game.players.map(p => p.rack.length)") for gp in guests]
            check(all(r.count(7) == 1 for r in racks), f"each friend only knows their own tiles ({racks})")
            plain = " ".join(broker.stats["payloads"])
            check("sdp" not in plain and "candidate" not in plain, "the broker only saw scrambled messages")
            # host (seat 0) plays with Hint + Enter
            host.keyboard.press("KeyH"); host.wait_for_timeout(200); host.keyboard.press("Enter")
            check(all(wait_for(p, "__game.Game.turn === 1 && __game.Game.board.filter(Boolean).length > 1", 4000) for p in guests), "the host's word shows up on every tab, and it's seat 1's turn")
            check(not guests[1].evaluate("__game.Game.canAct()") and guests[0].evaluate("__game.Game.canAct()"), "only the player whose turn it is can build")
            # a cheating message from seat 1 (tiles it doesn't have) is refused
            guests[0].evaluate("__game.Net.send({ t: 'move', p: [[0, 'Q'], [1, 'Q']] })")
            check(wait_for(guests[0], "/not in the rack|isn't|edge|touch/i.test(document.querySelector('#msg').textContent)", 3000)
                  and host.evaluate("__game.Game.turn") == 1, "the host checks every move: a bad one is refused and the turn stays")
            guests[0].keyboard.press("KeyH"); guests[0].wait_for_timeout(300); guests[0].keyboard.press("Enter")
            check(wait_for(host, "__game.Game.turn === 2 && __game.Game.players[1].score > 0", 4000), "a friend plays with Hint + Enter; the host scores it")
            check(wait_for(guests[2], "__game.Game.players[1].score > 0 && __game.Game.turn === 2", 3000), "every tab sees the new score")
            guests[2].click("#btnPause")
            check(all(wait_for(p, "__game.Game.state === 'paused'", 3000) for p in [host] + guests), "a friend's pause pauses everyone")
            guests[2].click("#btnResume")
            check(wait_for(host, "__game.Game.state === 'play'", 3000), "Keep playing resumes everyone")
            # seat 2 leaves on its turn: the game skips them
            guests[1].evaluate("__game.Game.toTitle()")
            check(wait_for(host, "__game.Game.players[2].gone && __game.Game.turn === 3", 5000), "a friend who leaves is skipped and the game goes on")
            late = tab(", timeoutSeconds: 4")
            join(late, code)
            check(wait_for(late, "/couldn't connect/i.test(document.querySelector('#onlineStatus').textContent)", 9000), "nobody can join after Start")
            host.evaluate("() => { const G = __game.Game; G.players[0].score = 500; G.end(-1); }")
            check(wait_for(guests[0], "__game.Game.state === 'over'", 3000) and "you win" in host.inner_text("#endTitle").lower()
                  and "green wins" in guests[0].inner_text("#endTitle").lower(), "the end shows on every tab")
            guests[0].click("#btnAgain")
            check(wait_for(host, "__game.Game.state === 'play' && __game.Game.players.length === 3", 3000), "a friend's Play again starts a new game with everyone still here")
            host.evaluate("__game.Game.toTitle()")
            check(wait_for(guests[0], "/host left/i.test(document.querySelector('#endTitle').textContent)", 5000), "when the host leaves, friends are told")
        # the network blocks the direct link (this host's WebRTC never answers): the game falls back to
        # the relay through the brokers, and plays on
        blocked = tab(", linkSeconds: 3")
        blocked.evaluate("RTCPeerConnection.prototype.setRemoteDescription = function () { return Promise.resolve(); }")
        blocked.click("#btnOnline"); blocked.click("#btnHost")
        bcode = blocked.inner_text("#roomCode").strip()
        wait_for(blocked, "__game.Net.brokers.length > 0", 8000)
        jp = tab(", linkSeconds: 3")
        join(jp, bcode)
        check(wait_for(jp, "/found the game/i.test(document.querySelector('#onlineStatus').textContent)", 10000), "a friend who finds the game is told so while the devices link up")
        check(wait_for(jp, "/through the relay/i.test(document.querySelector('#onlineStatus').textContent)", 15000)
              and wait_for(blocked, "__game.Net.count === 1 && /through the relay/i.test(document.querySelector('#onlineStatus').textContent)", 5000),
              "when the network blocks the direct link, both devices switch to the relay and say so")
        blocked.click("#btnStart")
        relay_ok = wait_for(jp, "__game.Game.state !== 'title' && __game.Game.mode === 'online' && !document.querySelector('#scrOnline').offsetParent", 8000)
        check(relay_ok and blocked.evaluate("__game.Net.brokers.length") > 0, "Start works through the relay (and the host keeps the brokers, which now carry the game)")
        if relay_ok:
            check(wait_for(jp, "__game.Game.players.length === 2 && __game.Game.players[1].rack.length === 7", 5000), "the friend gets their tiles through the relay")
            blocked.keyboard.press("KeyH"); blocked.wait_for_timeout(300); blocked.keyboard.press("Enter")
            check(wait_for(jp, "__game.Game.turn === 1 && __game.Game.board.filter(Boolean).length > 1", 6000), "the host's word reaches the friend through the relay")
            jp.keyboard.press("KeyH"); jp.wait_for_timeout(400); jp.keyboard.press("Enter")
            check(wait_for(blocked, "__game.Game.turn === 0 && __game.Game.players[1].score > 0", 6000), "the friend's word reaches the host through the relay and scores")
            blocked.evaluate("__game.Game.toTitle()")
            check(wait_for(jp, "/host left/i.test(document.querySelector('#endTitle').textContent)", 8000), "through the relay too, the friend is told when the host leaves")
        # the host never agrees to the relay (an older build, say): the friend is told, not left looking joined
        deaf = tab(", linkSeconds: 3")
        deaf.evaluate("RTCPeerConnection.prototype.setRemoteDescription = function () { return Promise.resolve(); }; __game.Net.toRelay = () => {};")
        deaf.click("#btnOnline"); deaf.click("#btnHost")
        dcode = deaf.inner_text("#roomCode").strip()
        wait_for(deaf, "__game.Net.brokers.length > 0", 8000)
        dj = tab(", linkSeconds: 3, relayWaitSeconds: 4")
        join(dj, dcode)
        check(wait_for(dj, "/didn't answer/i.test(document.querySelector('#onlineStatus').textContent)", 20000) and not dj.evaluate("__game.Net.connected"),
              "if the host never agrees to the relay, the friend is told to check the Build numbers (and isn't shown as joined)")
        # different builds: both devices say so
        old = tab()
        old.evaluate("window.GAME_BUILD = '2000.01.01-0000'")
        hb = tab()
        hb.evaluate("window.GAME_BUILD = '2000.01.02-0000'")
        hb.click("#btnOnline"); hb.click("#btnHost")
        hcode = hb.inner_text("#roomCode").strip()
        wait_for(hb, "__game.Net.brokers.length > 0", 8000)
        join(old, hcode)
        check(wait_for(old, "/different version/i.test(document.querySelector('#onlineStatus').textContent)", 15000)
              and wait_for(hb, "/different version/i.test(document.querySelector('#onlineStatus').textContent)", 5000),
              "a friend on a different build is told to reload, and so is the host")
        offline = g.browser.new_context()
        offline.add_init_script("window.NET_TEST_CONFIG = { brokers: ['ws://127.0.0.1:9'], ice: [] };")
        op = offline.new_page(); op.goto(GAME.as_uri()); op.wait_for_timeout(300)
        op.click("#btnOnline"); op.click("#btnHost")
        check(wait_for(op, "/matchmaking servers/i.test(document.querySelector('#onlineStatus').textContent)", 12000), "no internet: hosting says it can't reach the matchmaking servers")
    check(not g.errors, f"no page errors in any tab ({g.errors[:2]})")

print("\nRESULT:", "ALL PASS" if not fails else f"{len(fails)} FAILED")
sys.exit(1 if fails else 0)
