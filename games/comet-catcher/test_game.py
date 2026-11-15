#!/usr/bin/env python3
"""Comet Catcher's own browser test. Run it from the repo root after every change:

  python3 games/comet-catcher/test_game.py

The shared harness (test-harness/harness/run_tests.py) already checks the things every game
must do: loading, the test hook, keyboard, pause, no scrolling, saved-data names, offline, a
phone-sized touch screen, and whether a bot can win. Test only what is special to THIS game:
its rules (catching, missing, rocks, magnet bones, the timer, life-backs), its screens and its
touch controls. It drives the game through window.__game.
"""
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / "test-harness" / "harness"))
from gamebot.browser import GameSession  # noqa: E402  (finds Chrome for you; never hard-code its path)

GAME = HERE / "index.html"
FOLDER = HERE.name
fails = []


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
    check(js("__game.Game.state") == "play" and pg.is_visible("#hud"), "Enter starts the game and shows the HUD")

    # catching a comet scores points and builds a streak
    r = js("""() => { const { Game } = __game; Game.comets = []; Game.dog.x = 8;
              Game.comets.push({ x: 8, y: 6.9, spawnY: -0.6, vy: 2.5, vx: 0, col: 0, hist: [], h2: 0 });
              Game.update(1 / 60); return { caught: Game.caught, score: Game.score, streak: Game.streak }; }""")
    check(r["caught"] == 1 and r["score"] >= 10 and r["streak"] == 1, f"catching a comet scores at least 10 and starts a streak ({r})")

    # a comet that reaches the floor has been missed: one life out of the pool of 5
    r = js("""() => { const { Game } = __game; Game.comets = []; Game.comets.push({ x: 1, y: 8.6, spawnY: -0.6, vy: 2.5, vx: 0, col: 0, hist: [], h2: 0 });
              Game.streak = 4; Game.update(1 / 60); return { lives: Game.lives, hits: Game.hits, streak: Game.streak }; }""")
    check(r["lives"] == 4 and r["hits"] == 1 and r["streak"] == 0, f"a missed comet costs one life and resets the streak ({r})")

    # bumping a space rock costs a life too, and you are safe for a moment afterwards
    r = js("""() => { const { Game } = __game; Game.rocks = []; Game.dog.safe = 0; Game.comets = [];
              Game.rocks.push({ x: Game.dog.x, y: 8.0, vy: 3.5, rot: 0, spin: 1, shape: 0 });
              Game.update(1 / 60); const hit = Game.lives; const safe = Game.dog.safe;
              Game.rocks.push({ x: Game.dog.x, y: 8.0, vy: 3.5, rot: 0, spin: 1, shape: 0 });
              Game.update(1 / 60); return { hit, safe: +safe.toFixed(2), after: Game.lives }; }""")
    check(r["hit"] == 3 and r["after"] == 3 and r["safe"] > 0, f"a rock bump costs one life, then you are safe for a moment ({r})")

    # the magnet bone pulls comets toward the dog while it lasts
    r = js("""() => { const { Game, CFG } = __game; Game.comets = []; Game.magnet = 5;
              const c = { x: Game.dog.x - 4, y: 3.0, spawnY: -0.6, vy: 2.5, vx: 0, col: 0, hist: [], h2: 0 };
              Game.comets.push(c); for (let i = 0; i < 30; i++) Game.update(1 / 60);
              return { moved: +(c.x - (Game.dog.x - 4)).toFixed(2), magnet: +Game.magnet.toFixed(2) }; }""")
    check(r["moved"] > 0.5 and 4 < r["magnet"] < 5, f"the magnet pulls a comet toward the dog and runs down ({r})")

    # catching a bone turns the magnet on and is worth 25 points
    r = js("""() => { const { Game } = __game; Game.comets = []; Game.bones = []; Game.magnet = 0; const s0 = Game.score;
              Game.bones.push({ x: Game.dog.x, y: 6.9, vy: 2.6 });
              Game.update(1 / 60); return { magnet: +Game.magnet.toFixed(2), pts: Game.score - s0 }; }""")
    check(4.9 < r["magnet"] <= 5 and r["pts"] >= 25, f"catching a magnet bone gives 5 seconds of magnet ({r})")

    # ten catches in a row win a life back
    r = js("""() => { const { Game } = __game; Game.comets = []; Game.lives = 3; Game.streak = 9;
              Game.comets.push({ x: Game.dog.x, y: 6.9, spawnY: -0.6, vy: 2.5, vx: 0, col: 0, hist: [], h2: 0 });
              Game.update(1 / 60); return { lives: Game.lives, streak: Game.streak }; }""")
    check(r["lives"] == 4 and r["streak"] == 10, f"the 10th catch in a row wins a life back ({r})")

    # the timer: 60 seconds, and running out ends the game
    r = js("""() => { const { Game } = __game; Game.comets = []; Game.rocks = []; Game.bones = []; Game.score = 50;
              Game.timeLeft = 0.01; Game.update(1 / 60);
              return { state: Game.state, why: document.getElementById('endWhy').textContent }; }""")
    check(r["state"] == "lost" and "time" in r["why"].lower(), f"running out of time loses the game ({r})")

    # game over screen, initials, high score table, play again
    check(pg.is_visible("#scrEnd") and pg.is_visible("#endForm"), "losing shows Game over and asks for initials")
    pg.fill("#initials", "p1q")
    pg.keyboard.press("KeyP")
    check(js("__game.Game.state") == "lost", "typing P in the initials box does not pause")
    pg.keyboard.press("Enter")
    saved = js(f"JSON.parse(localStorage.getItem('{FOLDER}.scores'))")
    check(bool(saved) and saved[0]["initials"] == "PQP" and saved[0]["score"] == 50, f"score saved under {FOLDER}.scores ({saved})")
    check(pg.locator("#endTable tr.new").count() == 1, "the new score is highlighted in the table")
    pg.click("#btnAgain")
    check(js("__game.Game.state") == "play" and js("__game.Game.lives") == 5 and js("__game.Game.caught") == 0,
          "Play again starts a fresh run")

    # winning: catch the 30th comet
    r = js("""() => { const { Game, CFG } = __game; Game.comets = []; Game.rocks = []; Game.bones = [];
              Game.caught = CFG.WIN_AT - 1; Game.streak = 0; Game.timeLeft = 12; Game.lives = 4;
              const before = Game.score;
              Game.comets.push({ x: Game.dog.x, y: 6.9, spawnY: -0.6, vy: 2.5, vx: 0, col: 0, hist: [], h2: 0 });
              Game.update(1 / 60);
              return { state: Game.state, gained: Game.score - before }; }""")
    check(js("__game.Game.state") == "won" and "win" in pg.inner_text("#endTitle").lower(),
          "catching the 30th comet wins the game")
    # the 30th catch is worth 12, the time bonus 5 x 12s = 60 and the life bonus 25 x 4 = 100
    check(r["gained"] == 172, f"winning adds the catch, time and life bonuses ({r})")
    check(not g.errors, f"no console errors ({g.errors[:2]})")

    # touch screen: the big left/right buttons work, and so does the pause button
    g.open(viewport=(844, 390), touch=True)
    pg = g.page
    pg.tap("#btnPlay")
    x0 = pg.evaluate("__game.Game.dog.x")
    box = pg.locator("#tRight").bounding_box()
    pg.dispatch_event("#tRight", "pointerdown")
    pg.wait_for_timeout(400)
    pg.dispatch_event("#tRight", "pointerup")
    check(box is not None and pg.evaluate("__game.Game.dog.x") > x0 + 0.5, "the on-screen right button moves the dog")
    x0 = pg.evaluate("__game.Game.dog.x")
    pg.dispatch_event("#tLeft", "pointerdown")
    pg.wait_for_timeout(300)
    pg.dispatch_event("#tLeft", "pointerup")
    check(pg.evaluate("__game.Game.dog.x") < x0 - 0.5, "the on-screen left button moves the dog")
    pg.tap("#btnPause")
    check(pg.evaluate("__game.Game.state") == "paused", "the pause button pauses on a touch screen")

print("\nRESULT:", "ALL PASS" if not fails else f"{len(fails)} FAILED")
sys.exit(1 if fails else 0)
