#!/usr/bin/env python3
"""This game's own browser test. Run it from the repo root after every change:

  python3 games/<name>/test_game.py

The shared harness (test-harness/harness/run_tests.py) already checks what every game must do,
using 1 player mode. This file tests what is special to a multiplayer game:
  1. the rules (hearts, paddle bounces, walls, winning, high scores) in 1 player mode
  2. friends on one screen: keys for each player, and four fingers at once
  3. online play between four browser tabs over real WebRTC, through a fake local MQTT broker
     (test-harness/tests/fake_mqtt_broker.py), so it needs no internet
"""
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "test-harness" / "harness"))
sys.path.insert(0, str(ROOT / "test-harness" / "tests"))
from gamebot.browser import GameSession  # noqa: E402  (finds Chrome for you; never hard-code its path)
from fake_mqtt_broker import FakeBroker  # noqa: E402

GAME = HERE / "index.html"
FOLDER = HERE.name
fails = []


def check(ok, msg):
    print(("PASS " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)


def wait_for(page, js, ms=8000):
    """Wait until a JS expression is true in the page. Returns True if it became true in time."""
    try:
        page.wait_for_function(js, timeout=ms)
        return True
    except Exception:
        return False


HOLD = "() => { __game.Game.state = 'serve'; __game.Game.serveTimer = 99; }"  # hold the serve so only paddles move
PADDLES = "__game.Game.paddles.map(p => +p.t.toFixed(2))"

with GameSession(str(GAME)) as g:
    pg = g.page
    js = pg.evaluate

    # ---------- 1. the rules, in 1 player mode ----------
    check(pg.is_visible("#btnPlay") and pg.is_visible("#btnShared") and pg.is_visible("#btnOnline"), "title screen offers 1 player, one screen and online")
    pg.keyboard.press("Enter")
    check(js("__game.Game.mode") == "solo" and js("__game.Game.seats.map(s => !!s)") == [True, True, False, False], "Enter starts a 1 player game: you, the computer, and two walls")
    r = js("""() => { const { Game, CFG } = __game; Game.state = 'play'; Game.ball.y = -1; Game.update(1 / 60);
              return { cpu: Game.seats[1].lives, score: Game.score, state: Game.state }; }""")
    check(r["cpu"] == 4 and r["score"] == 100 and r["state"] == "serve", f"the ball going past the computer costs it a heart and scores 100 ({r})")
    r = js("""() => { const { Game, CFG } = __game; Game.state = 'play'; Game.ball.y = CFG.S + 1; Game.update(1 / 60); return Game.seats[0].lives; }""")
    check(r == 4, f"the ball going past your paddle costs you a heart ({r})")
    r = js("""() => { const { Game, CFG } = __game; Game.state = 'play'; Object.assign(Game.ball, { x: 0.1, y: 6, vx: -5, vy: 0 }); Game.update(1 / 60);
              return { vx: Game.ball.vx, hearts: Game.seats.map(s => s && s.lives) }; }""")
    check(r["vx"] > 0 and r["hearts"][:2] == [4, 4], f"an empty side is a wall the ball bounces off ({r})")
    r = js("""() => { const { Game, CFG } = __game; Game.state = 'play'; const p = Game.paddlePos(0);
              Object.assign(Game.ball, { x: p.x + CFG.PADDLE_W / 2, y: p.y - 0.3, vx: 0, vy: 5 });
              const before = Game.returns; Game.update(1 / 60);
              return { up: Game.ball.vy < 0, right: Game.ball.vx > 1, returns: Game.returns - before }; }""")
    check(r["up"] and r["right"] and r["returns"] == 1, f"hitting the ball with the right edge sends it up and to the right ({r})")
    js("() => { const { Game, CFG } = __game; Game.seats[0].lives = 1; Game.state = 'play'; Game.ball.y = CFG.S + 1; Game.update(1 / 60); }")
    check(js("__game.Game.state") == "over" and "game over" in pg.inner_text("#endTitle").lower(), "losing your last heart is Game over")
    pg.click("#btnAgain")
    js("() => { const { Game } = __game; Game.seats[1].lives = 1; Game.state = 'play'; Game.ball.y = -1; Game.update(1 / 60); }")
    check(js("__game.Game.winner") == 0 and "win" in pg.inner_text("#endTitle").lower() and pg.is_visible("#endForm"), "knocking out the computer wins and asks for initials")
    pg.fill("#initials", "abc")
    pg.keyboard.press("Enter")
    saved = js(f"JSON.parse(localStorage.getItem('{FOLDER}.scores'))")
    check(bool(saved) and saved[0]["initials"] == "ABC" and saved[0]["detail"].startswith("Won"), f"score saved under {FOLDER}.scores ({saved[:1]})")
    pg.click("#btnMenu")

    # ---------- 2. friends on one screen ----------
    pg.click("#btnShared")
    check(pg.is_visible("#scrShared"), "Friends, one screen asks how many players")
    pg.click("#btnShared4")
    check(js("__game.Game.mode") == "shared" and js("__game.Game.seats.every(s => !!s)"), "picking 4 fills all four sides")
    js(HOLD)
    before = js(PADDLES)
    for keys in (["ArrowRight"], ["KeyA"], ["KeyG"], ["KeyI"]):
        for k in keys:
            pg.keyboard.down(k)
    pg.wait_for_timeout(250)
    for k in ("ArrowRight", "KeyA", "KeyG", "KeyI"):
        pg.keyboard.up(k)
    after = js(PADDLES)
    check(after[0] > before[0] + 0.5 and after[1] < before[1] - 0.5 and after[2] > before[2] + 0.5 and after[3] < before[3] - 0.5,
          f"one keyboard: arrows, A/D, T/G and I/K each move their own paddle ({before} -> {after})")
    check(js("[0,1,2,3].every(s => !document.querySelector('#lab' + s).hidden)"), "each player has a label by their side")
    pg.keyboard.press("KeyP")
    check(js("__game.Game.state") == "paused", "P pauses everyone")
    pg.keyboard.press("KeyP")
    js("() => { const { Game } = __game; Game.state = 'play'; Game.seats[2].lives = 1; Object.assign(Game.ball, { x: -1, y: 6 }); Game.update(1 / 60); }")
    check(js("__game.Game.seats[2].out") and js("__game.Game.state") == "serve", "a player who loses their last heart is out, and the game goes on")
    js("() => { const { Game, CFG } = __game; Game.seats[1].out = true; Game.seats[3].lives = 1; Game.state = 'play'; Object.assign(Game.ball, { x: CFG.S + 1, y: 6 }); Game.update(1 / 60); }")
    check("green wins" in pg.inner_text("#endTitle").lower() and pg.is_visible("#endTitleFlip") and not pg.is_visible("#endForm"),
          "the last one standing wins (shown both ways up), and no high score is saved")
    check(not g.errors, f"no console errors ({g.errors[:2]})")

    # four fingers at once on a tablet lying flat: each finger moves the paddle on its own side
    g.open(viewport=(800, 800), touch=True)
    pg = g.page
    pg.tap("#btnShared"); pg.tap("#btnShared4")
    pg.evaluate(HOLD)
    cdp = pg.context.new_cdp_session(pg)
    f = pg.evaluate("() => { const { R } = __game, d = devicePixelRatio || 1; return { k: R.scale / d, ox: R.ox / d, oy: R.oy / d }; }")
    sc = lambda x, y: {"x": f["ox"] + x * f["k"], "y": f["oy"] + y * f["k"]}
    # bottom drags right, top drags left, left drags down, right drags up
    path = lambda k: [{**sc(6 + k, 11), "id": 1}, {**sc(6 - k, 1), "id": 2}, {**sc(1, 6 + k), "id": 3}, {**sc(11, 6 - k), "id": 4}]
    cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": path(0)})
    for k in range(1, 6):
        cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": path(k * 0.7)})
        pg.wait_for_timeout(60)
    pg.wait_for_timeout(300)
    xs = pg.evaluate(PADDLES)
    cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    check(xs[0] > 8.5 and xs[1] < 3.5 and xs[2] > 8.5 and xs[3] < 3.5, f"four fingers at once: each drags the paddle on its own side ({xs})")
    pg.tap("#btnPause")
    check(pg.evaluate("__game.Game.state") == "paused", "the pause button works on a touch screen")

    # ---------- 3. online, four tabs ----------
    with FakeBroker() as broker:
        def tab(extra=""):
            ctx = g.browser.new_context(viewport={"width": 600, "height": 600})
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
        check(len(code) == 5 and host.is_disabled("#btnStart"), f"hosting shows a room code; Start waits for a friend ({code})")
        guests = [tab() for _ in range(3)]
        for i, gp in enumerate(guests):
            join(gp, code.lower())
            wait_for(host, f"__game.Net.count === {i + 1}", 15000)  # join one at a time, so seats follow join order
        check(wait_for(host, "__game.Net.count === 3 && /4 of 4/.test(document.querySelector('#roomPlayers').textContent)", 15000) and not host.is_disabled("#btnStart"),
              "three friends join with the same code; the host sees 4 of 4 players")
        extra = tab()
        join(extra, code)
        check(wait_for(extra, "/full/i.test(document.querySelector('#onlineStatus').textContent)", 10000), "a fifth player is told the game is full")

        host.click("#btnStart")
        ok = all(wait_for(gp, "['serve', 'play'].includes(__game.Game.state)", 8000) for gp in guests)
        check(ok, "the host taps Start and the game starts on every tab")
        if ok:
            seats = [gp.evaluate("[__game.Game.me, __game.R.view]") for gp in guests]
            check(seats == [[1, 1], [2, 2], [3, 3]], f"friends get seats 1, 2, 3 in join order, each turned to see their own side at the bottom ({seats})")
            check(host.evaluate("__game.Net.brokers.length") == 0, "Start locks the room: the host drops the brokers")
            plain = " ".join(broker.stats["payloads"])
            check(len(broker.stats["topics"]) == 1 and "sdp" not in plain and "candidate" not in plain, f"the broker only saw scrambled messages ({broker.stats['publishes']})")

            # each friend's "right" moves their paddle to the right as they see it
            host.evaluate(HOLD)
            before = host.evaluate(PADDLES)
            for gp in guests:
                gp.keyboard.down("ArrowRight")
            guests[0].wait_for_timeout(300)
            for gp in guests:
                gp.keyboard.up("ArrowRight")
            host.wait_for_timeout(300)
            after = host.evaluate(PADDLES)
            check(after[1] < before[1] - 0.5 and after[2] > before[2] + 0.5 and after[3] < before[3] - 0.5 and abs(after[0] - before[0]) < 1e-6,
                  f"each friend's right arrow moves their own paddle on the host ({before} -> {after})")

            # hearts lost on the host show up everywhere
            host.evaluate("() => { const { Game } = __game; Game.state = 'play'; Object.assign(Game.ball, { x: -1, y: 6, vx: -5, vy: 0 }); }")
            check(all(wait_for(gp, "__game.Game.seats[2].lives === 4", 3000) for gp in guests), "a heart lost on the host shows up on every tab")
            check("You" in guests[1].inner_text("#lab2") and "Orange" in guests[0].inner_text("#lab2"), "each tab calls its own player You")

            # a friend's pause pauses everyone
            guests[2].click("#btnPause")
            check(all(wait_for(p, "__game.Game.state === 'paused'", 3000) for p in [host] + guests), "a friend's pause button pauses everyone")
            guests[2].click("#btnResume")
            check(wait_for(host, "__game.Game.state !== 'paused'", 3000), "Keep playing resumes everyone")

            # someone leaves mid-game: their side becomes a wall, the rest play on
            guests[2].evaluate("__game.Game.toTitle()")
            check(wait_for(host, "__game.Game.seats[3].out && ['serve', 'play'].includes(__game.Game.state)", 5000)
                  and wait_for(guests[0], "__game.Game.seats[3].out", 3000), "a friend who leaves becomes a wall and the game goes on")

            # a latecomer can't join a game that has started
            host.evaluate(HOLD)
            late = tab(", timeoutSeconds: 4")
            join(late, code)
            check(wait_for(late, "/couldn't connect/i.test(document.querySelector('#onlineStatus').textContent)", 9000), "nobody can join after Start")

            # last one standing
            host.evaluate("() => { const { Game, CFG } = __game; Game.seats[0] = { lives: CFG.LIVES, out: false }; Game.seats[1].out = true; Game.seats[2] = { lives: 1, out: false }; Game.state = 'play'; Object.assign(Game.ball, { x: -1, y: 6, vx: -5, vy: 0 }); }")
            check(wait_for(guests[0], "__game.Game.state === 'over'", 3000) and "you win" in host.inner_text("#endTitle").lower()
                  and "green wins" in guests[1].inner_text("#endTitle").lower(), "the last one standing wins, on every tab")
            guests[1].click("#btnAgain")
            check(wait_for(host, "__game.Game.state === 'serve' && __game.Game.filled.join() === '0,1,2'", 3000)
                  and wait_for(guests[0], "!document.querySelector('#scrEnd').offsetParent", 3000), "a friend's Play again starts a rematch with everyone still here")

            # the host leaves: everyone is told
            host.evaluate("__game.Game.toTitle()")
            check(all(wait_for(gp, "/host left/i.test(document.querySelector('#endTitle').textContent)", 5000) for gp in guests[:2]), "when the host leaves, every friend is told")

        lonely = tab(", timeoutSeconds: 3")
        join(lonely, "XXXXX")
        check(wait_for(lonely, "/couldn't connect/i.test(document.querySelector('#onlineStatus').textContent)", 8000), "joining a code nobody hosts gives up with a clear message")
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
            blocked.evaluate(HOLD)
            before = blocked.evaluate(PADDLES)
            jp.keyboard.down("ArrowRight"); jp.wait_for_timeout(600); jp.keyboard.up("ArrowRight")
            check(wait_for(blocked, f"__game.Game.paddles[1].t < {before[1] - 0.5}", 4000), "the friend's paddle moves on the host through the relay")
            blocked.evaluate("__game.Game.toTitle()")
            check(wait_for(jp, "/host left/i.test(document.querySelector('#endTitle').textContent)", 8000), "through the relay too, friends are told when the host leaves")
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
