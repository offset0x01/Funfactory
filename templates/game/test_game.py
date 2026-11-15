#!/usr/bin/env python3
"""This game's own browser test. Run it from the repo root after every change:

  python3 games/<name>/test_game.py

The shared harness (test-harness/harness/run_tests.py) already checks the things every game
must do: loading, the test hook, keyboard, pause, no scrolling, saved-data names, offline, and
whether a bot can win. Test only what is special to THIS game here: its rules, its screens,
its touch controls. It drives the game through window.__game.
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

    # YOUR GAME: the rules. Set things up directly, step the game, check what happened.
    r = js("""() => { const { Game } = __game; Game.star.x = Game.player.x; Game.star.y = Game.player.y; Game.update(1 / 60);
              return { stars: Game.stars, score: Game.score }; }""")
    check(r["stars"] == 1 and r["score"] == 10, f"catching a star scores 10 ({r})")
    r = js("""() => { const { Game } = __game; Game.time = 99; Game.player.safe = 0; Game.foe.x = Game.player.x; Game.foe.y = Game.player.y;
              Game.update(1 / 60); const hit = Game.lives; Game.update(1 / 60); return { hit, after: Game.lives }; }""")
    check(r["hit"] == 2 and r["after"] == 2, f"touching the foe costs one life, then you are safe for a moment ({r})")

    # losing: game over screen, initials, high score table, play again
    js("() => { const { Game } = __game; Game.lives = 1; Game.player.safe = 0; Game.foe.x = Game.player.x; Game.foe.y = Game.player.y; Game.update(1 / 60); }")
    check(js("__game.Game.state") == "lost" and pg.is_visible("#scrEnd") and pg.is_visible("#endForm"), "losing shows Game over and asks for initials")
    pg.fill("#initials", "p1q")
    pg.keyboard.press("KeyP")
    check(js("__game.Game.state") == "lost", "typing P in the initials box does not pause")
    pg.keyboard.press("Enter")
    saved = js(f"JSON.parse(localStorage.getItem('{FOLDER}.scores'))")
    check(bool(saved) and saved[0]["initials"] == "PQP", f"score saved under {FOLDER}.scores ({saved})")
    check(pg.locator("#endTable tr.new").count() == 1, "the new score is highlighted in the table")
    pg.click("#btnAgain")
    check(js("__game.Game.state") == "play" and js("__game.Game.lives") == 3, "Play again starts a fresh run")

    # winning
    js("() => { const { Game, CFG } = __game; Game.stars = CFG.STARS_TO_WIN - 1; Game.star.x = Game.player.x; Game.star.y = Game.player.y; Game.update(1 / 60); }")
    check(js("__game.Game.state") == "won" and "win" in pg.inner_text("#endTitle").lower(), "catching the last star wins")
    check(not g.errors, f"no console errors ({g.errors[:2]})")

    # touch screen: the on-screen arrows show up and move the player
    g.open(viewport=(844, 390), touch=True)
    pg = g.page
    pg.tap("#btnPlay")
    x0 = pg.evaluate("__game.Game.player.x")
    box = pg.locator("#tRight").bounding_box()
    pg.dispatch_event("#tRight", "pointerdown")
    pg.wait_for_timeout(400)
    pg.dispatch_event("#tRight", "pointerup")
    check(box is not None and pg.evaluate("__game.Game.player.x") > x0 + 0.5, "the on-screen right arrow moves the player")
    pg.tap("#btnPause")
    check(pg.evaluate("__game.Game.state") == "paused", "the pause button pauses on a touch screen")

print("\nRESULT:", "ALL PASS" if not fails else f"{len(fails)} FAILED")
sys.exit(1 if fails else 0)
