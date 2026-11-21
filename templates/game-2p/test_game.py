#!/usr/bin/env python3
"""This game's own browser test. Run it from the repo root after every change:

  python3 games/<name>/test_game.py

The shared harness (test-harness/harness/run_tests.py) already checks what every game must do,
using 1 player mode. This file tests what is special to a two-player game:
  1. the rules (points, paddle bounces, winning, high scores) in 1 player mode
  2. two players on one screen: two keyboards' worth of keys, and two fingers at once
  3. online play between two browser tabs over real WebRTC, through a fake local MQTT broker
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


with GameSession(str(GAME)) as g:
    pg = g.page
    js = pg.evaluate

    # ---------- 1. the rules, in 1 player mode ----------
    check(pg.is_visible("#btnPlay") and pg.is_visible("#btnShared") and pg.is_visible("#btnOnline"), "title screen offers 1 player, one screen and online")
    pg.keyboard.press("Enter")
    check(js("__game.Game.mode") == "solo" and js("__game.Game.state") in ("serve", "play"), "Enter starts a 1 player game")
    r = js("""() => { const { Game, CFG } = __game; Game.state = 'play'; Game.ball.y = -1; Game.update(1 / 60);
              return { pts: Game.points, score: Game.score, state: Game.state }; }""")
    check(r["pts"] == [1, 0] and r["score"] == 100 and r["state"] == "serve", f"the ball going past the top paddle is your point ({r})")
    r = js("""() => { const { Game, CFG } = __game; Game.state = 'play'; Game.ball.y = CFG.H + 1; Game.update(1 / 60); return Game.points; }""")
    check(r == [1, 1], f"the ball going past your paddle is the computer's point ({r})")
    r = js("""() => { const { Game, CFG } = __game; Game.state = 'play'; const p = Game.paddles[0], y = Game.paddleY(0);
              Object.assign(Game.ball, { x: p.x + CFG.PADDLE_W / 2, y: y - 0.3, vx: 0, vy: 5 });
              const before = Game.returns; Game.update(1 / 60);
              return { up: Game.ball.vy < 0, right: Game.ball.vx > 1, returns: Game.returns - before }; }""")
    check(r["up"] and r["right"] and r["returns"] == 1, f"hitting the ball with the right edge sends it up and to the right, and counts a return ({r})")

    # losing, then winning with the high score table
    js("() => { const { Game, CFG } = __game; Game.points = [0, CFG.WIN_POINTS - 1]; Game.state = 'play'; Game.ball.y = CFG.H + 1; Game.update(1 / 60); }")
    check(js("__game.Game.state") == "over" and "game over" in pg.inner_text("#endTitle").lower(), "the computer reaching 5 points is Game over")
    pg.click("#btnAgain")
    js("() => { const { Game, CFG } = __game; Game.points = [CFG.WIN_POINTS - 1, 0]; Game.state = 'play'; Game.ball.y = -1; Game.update(1 / 60); }")
    check(js("__game.Game.winner") == 0 and "win" in pg.inner_text("#endTitle").lower() and pg.is_visible("#endForm"), "reaching 5 points wins and asks for initials")
    pg.fill("#initials", "abc")
    pg.keyboard.press("Enter")
    saved = js(f"JSON.parse(localStorage.getItem('{FOLDER}.scores'))")
    check(bool(saved) and saved[0]["initials"] == "ABC" and saved[0]["detail"].startswith("Won"), f"score saved under {FOLDER}.scores ({saved})")
    pg.click("#btnMenu")

    # ---------- 2. two players, one screen ----------
    pg.click("#btnShared")
    check(js("__game.Game.mode") == "shared", "2 players, one screen starts a shared game")
    js("() => { __game.Game.state = 'serve'; __game.Game.serveTimer = 99; }")  # hold the serve so only the paddles move
    x0 = js("__game.Game.paddles.map(p => p.x)")
    pg.keyboard.down("ArrowRight"); pg.wait_for_timeout(250); pg.keyboard.up("ArrowRight")
    x1 = js("__game.Game.paddles.map(p => p.x)")
    check(x1[0] > x0[0] + 0.5 and abs(x1[1] - x0[1]) < 1e-6, f"arrow keys move only the bottom paddle ({x0} -> {x1})")
    pg.keyboard.down("KeyA"); pg.wait_for_timeout(250); pg.keyboard.up("KeyA")
    x2 = js("__game.Game.paddles.map(p => p.x)")
    check(x2[1] < x1[1] - 0.5 and abs(x2[0] - x1[0]) < 1e-6, f"A and D move only the top paddle ({x1} -> {x2})")
    check(pg.locator("#endTitleFlip").count() == 1, "the end screen has an upside-down line for the top player")
    pg.keyboard.press("KeyP")
    check(js("__game.Game.state") == "paused", "P pauses a shared game")
    pg.keyboard.press("KeyP")
    js("() => { const { Game, CFG } = __game; Game.points = [CFG.WIN_POINTS - 1, 4]; Game.state = 'play'; Game.ball.y = -1; Game.update(1 / 60); }")
    check("green wins" in pg.inner_text("#endTitle").lower() and pg.is_visible("#endTitleFlip") and not pg.is_visible("#endForm"),
          "a shared game shows who won (both ways up) and saves no high score")
    check(not g.errors, f"no console errors ({g.errors[:2]})")

    # two fingers at once on a phone lying flat: one in each half, each moves its own paddle
    g.open(viewport=(390, 844), touch=True)
    pg = g.page
    pg.tap("#btnShared")
    pg.evaluate("() => { __game.Game.state = 'serve'; __game.Game.serveTimer = 99; }")
    cdp = pg.context.new_cdp_session(pg)
    to_screen = pg.evaluate("""() => { const { R, CFG } = __game, d = R.scale / (devicePixelRatio || 1), ox = R.ox / (devicePixelRatio || 1), oy = R.oy / (devicePixelRatio || 1);
                                       return { d, ox, oy, H: CFG.H }; }""")
    sx = lambda wx: to_screen["ox"] + wx * to_screen["d"]
    sy = lambda wy: to_screen["oy"] + wy * to_screen["d"]
    low, high = sy(to_screen["H"] - 2), sy(2)
    cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": sx(4.5), "y": low, "id": 1}, {"x": sx(4.5), "y": high, "id": 2}]})
    for k in range(1, 6):
        cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": sx(4.5 + 0.6 * k), "y": low, "id": 1}, {"x": sx(4.5 - 0.6 * k), "y": high, "id": 2}]})
        pg.wait_for_timeout(60)
    pg.wait_for_timeout(300)
    xs = pg.evaluate("__game.Game.paddles.map(p => p.x)")
    cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    check(xs[0] > 6.5 and xs[1] < 2.5, f"two fingers at once: the bottom one drags the green paddle right, the top one drags the blue paddle left ({xs})")
    pg.tap("#btnPause")
    check(pg.evaluate("__game.Game.state") == "paused", "the pause button works on a touch screen")

    # ---------- 3. online, between two tabs ----------
    with FakeBroker() as broker:
        def tab(extra=""):
            ctx = g.browser.new_context(viewport={"width": 420, "height": 800})
            ctx.add_init_script(f"window.NET_TEST_CONFIG = {{ brokers: ['{broker.url}'], ice: [] {extra} }};")
            p = ctx.new_page()
            p.on("pageerror", lambda e: g.errors.append(f"pageerror: {e}"))
            p.goto(GAME.as_uri())
            p.wait_for_timeout(300)
            return p

        host, guest = tab(), tab()
        host.click("#btnOnline"); host.click("#btnHost")
        code = host.inner_text("#roomCode").strip()
        check(len(code) == 5 and code.isalnum(), f"hosting shows a 5 letter room code ({code})")
        guest.click("#btnOnline"); guest.fill("#joinCode", code.lower()); guest.click("#btnJoin")
        both = wait_for(host, "__game.Net.connected && __game.Game.mode === 'online'", 15000) and \
            wait_for(guest, "__game.Net.connected && __game.Game.paddles && ['serve', 'play'].includes(__game.Game.state)", 15000)
        check(both, "the guest joins with the code and both tabs start the game over WebRTC")
        if both:
            check(guest.evaluate("__game.R.flip && __game.Game.me === 1") and not host.evaluate("__game.R.flip"),
                  "the guest plays the top paddle, drawn upside down so it is at the bottom of their screen")
            plain = " ".join(broker.stats["payloads"])
            check(len(broker.stats["topics"]) == 1 and code not in next(iter(broker.stats["topics"])) and "sdp" not in plain and "candidate" not in plain,
                  f"the broker only sees one scrambled topic and encrypted messages ({broker.stats['publishes']} messages)")
            host.wait_for_timeout(2000)
            check(guest.evaluate("__game.Net.brokers.length") == 0 and host.evaluate("__game.Net.brokers.length") == 0, "both tabs drop the brokers once connected")

            # the guest's keys move its paddle on the host (right on the guest's screen is left on the field)
            host.evaluate("() => { __game.Game.state = 'serve'; __game.Game.serveTimer = 99; }")
            hx = host.evaluate("__game.Game.paddles[1].x")
            guest.keyboard.down("ArrowRight"); guest.wait_for_timeout(300); guest.keyboard.up("ArrowRight")
            guest.wait_for_timeout(300)
            hx2 = host.evaluate("__game.Game.paddles[1].x")
            check(hx2 < hx - 0.5, f"the guest's right arrow moves its paddle on the host's game ({hx:.2f} -> {hx2:.2f})")

            # a point on the host shows up on the guest
            host.evaluate("() => { const { Game } = __game; Game.state = 'play'; Game.ball.y = -1; Game.ball.vy = -5; }")
            check(wait_for(guest, "__game.Game.points[0] === 1", 3000), "a point scored on the host shows up on the guest")
            labels = guest.evaluate("[__game.Game.points, document.querySelector('#scoreLow').textContent, document.querySelector('#scoreHigh').textContent]")
            check(labels[1] == f"You {labels[0][1]}" and labels[2] == f"Friend {labels[0][0]}", f"the guest's score labels are from its own side ({labels})")

            # pausing from either side pauses both
            guest.click("#btnPause")
            check(wait_for(host, "__game.Game.state === 'paused'", 3000) and wait_for(guest, "__game.Game.state === 'paused'", 3000), "the guest's pause button pauses both")
            guest.click("#btnResume")
            check(wait_for(host, "__game.Game.state !== 'paused'", 3000), "the guest's Keep playing resumes both")

            # a third tab with the right code can't barge in
            third = tab(", timeoutSeconds: 5")
            third.click("#btnOnline"); third.fill("#joinCode", code); third.click("#btnJoin")
            third.wait_for_timeout(6500)
            check(not third.evaluate("__game.Net.connected") and "couldn't connect" in third.inner_text("#onlineStatus").lower() and host.evaluate("__game.Net.connected"),
                  "a third player with the same code is turned away; the game keeps going")

            # winning on the host ends both games; the guest can ask for a rematch
            host.evaluate("() => { const { Game, CFG } = __game; Game.points = [CFG.WIN_POINTS - 1, 0]; Game.state = 'play'; Game.ball.y = -1; Game.ball.vy = -5; }")
            check(wait_for(guest, "__game.Game.state === 'over'", 3000) and "friend wins" in guest.inner_text("#endTitle").lower()
                  and "you win" in host.inner_text("#endTitle").lower(), "the end screen says who won on both devices")
            guest.click("#btnAgain")
            check(wait_for(host, "__game.Game.state === 'serve' && __game.Game.points[0] === 0", 3000)
                  and wait_for(guest, "!document.querySelector('#scrEnd').offsetParent", 3000), "the guest's Play again starts a rematch on both")

            # leaving
            guest.evaluate("__game.Game.toTitle()")
            check(wait_for(host, "__game.Game.state === 'over' && /left/i.test(document.querySelector('#endTitle').textContent)", 5000),
                  "when the guest quits, the host is told their friend left")

        # a code nobody is using, and no broker at all, both end with a clear message
        lonely = tab(", timeoutSeconds: 3")
        lonely.click("#btnOnline"); lonely.fill("#joinCode", "XXXXX"); lonely.click("#btnJoin")
        check(wait_for(lonely, "/couldn't connect/i.test(document.querySelector('#onlineStatus').textContent)", 8000), "joining a code nobody hosts gives up with a clear message")
        offline = g.browser.new_context()
        offline.add_init_script("window.NET_TEST_CONFIG = { brokers: ['ws://127.0.0.1:9'], ice: [] };")
        op = offline.new_page(); op.goto(GAME.as_uri()); op.wait_for_timeout(300)
        op.click("#btnOnline"); op.click("#btnHost")
        check(wait_for(op, "/matchmaking servers/i.test(document.querySelector('#onlineStatus').textContent)", 12000), "no internet: hosting says it can't reach the matchmaking servers")
    check(not g.errors, f"no page errors in any tab ({g.errors[:2]})")

print("\nRESULT:", "ALL PASS" if not fails else f"{len(fails)} FAILED")
sys.exit(1 if fails else 0)
