"""Headless browser session that talks to a game's window.GAME_TEST_HOOK."""
from __future__ import annotations

import os
import pathlib

from playwright.sync_api import sync_playwright

GL_ARGS = ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"]

# Runs one open-loop rollout entirely inside the page (one round trip per rollout).
ROLLOUT_JS = """
(args) => {
  const h = window.GAME_TEST_HOOK;
  const acts = h.info().actions.map(a => a.id);
  const { genome, seed, stopOnLifeLost, stallSteps, chunk } = args;
  let s = h.reset({ seed });
  let bestProg = s.progress, bestProgStep = 0, failStep = null, failWhy = null;
  outer: for (const [a, f] of genome) {
    let left = f;
    while (left > 0) {
      const n = Math.min(chunk, left);
      s = h.step(acts[a], n); left -= n;
      if (s.progress > bestProg + 1e-5) { bestProg = s.progress; bestProgStep = s.steps; }
      if (s.status !== 'playing') break outer;
      if (stopOnLifeLost && s.livesLost > 0) { failStep = s.steps; failWhy = 'life'; break outer; }
      if (s.steps - bestProgStep > stallSteps) { failStep = s.steps; failWhy = 'stall'; break outer; }
    }
  }
  if (s.status === 'playing' && failStep === null) { failStep = s.steps; failWhy = 'end'; }
  if (s.status === 'lost' || s.status === 'timeout') { failStep = s.steps; failWhy = s.status; }
  return { ...s, bestProg, bestProgStep, failStep, failWhy };
}
"""


class GameSession:
    """One headless Chrome page with the game loaded."""

    def __init__(self, game_path: str, headless: bool = True):
        self.game_path = pathlib.Path(game_path).resolve()
        if not self.game_path.exists():
            raise FileNotFoundError(self.game_path)
        self._pw = sync_playwright().start()
        try:
            self.browser = self._pw.chromium.launch(headless=headless, args=GL_ARGS)
        except Exception:
            chrome = os.environ.get("CHROME_PATH", "/usr/bin/google-chrome")
            self.browser = self._pw.chromium.launch(headless=headless, args=GL_ARGS, executable_path=chrome)
        self.page = None
        self.errors: list[str] = []
        self.network: list[str] = []
        self.open()

    def open(self, url: str | None = None, viewport=(1280, 800), touch: bool = False):
        """Load the game. touch=True pretends to be a phone or tablet (touch screen, no mouse)."""
        if self.page:
            self.page.context.close()
        self.errors = []
        self.network = []   # anything the page asked for that is not a local file (games must work offline)
        ctx = self.browser.new_context(viewport={"width": viewport[0], "height": viewport[1]}, has_touch=touch, is_mobile=touch)
        # remember every storage key the page writes, so the smoke test can check the names
        ctx.add_init_script("window.__storageWrites = []; try { const set = Storage.prototype.setItem; "
                            "Storage.prototype.setItem = function (k, v) { window.__storageWrites.push(String(k)); return set.call(this, k, v); }; } catch (e) {}")
        self.page = ctx.new_page()
        self.page.on("request", lambda r: None if r.url.startswith(("file:", "data:", "blob:", "about:")) else self.network.append(r.url))
        self.page.on("console", lambda m: self.errors.append(m.text) if m.type == "error" else None)
        self.page.on("pageerror", lambda e: self.errors.append(f"pageerror: {e}"))
        self.page.goto(url or self.game_path.as_uri())
        self.page.wait_for_timeout(600)
        return self.page

    # --- hook calls -------------------------------------------------------
    def has_hook(self) -> bool:
        return bool(self.page.evaluate("typeof window.GAME_TEST_HOOK === 'object' && window.GAME_TEST_HOOK !== null"))

    def info(self) -> dict:
        return self.page.evaluate("window.GAME_TEST_HOOK.info()")

    def reset(self, seed: int = 1, realtime: bool = False, level: int = 0) -> dict:
        return self.page.evaluate("o => window.GAME_TEST_HOOK.reset(o)", {"seed": seed, "realtime": realtime, "level": level})

    def step(self, action: str, n: int = 1) -> dict:
        return self.page.evaluate("([a, n]) => window.GAME_TEST_HOOK.step(a, n)", [action, n])

    def state(self) -> dict:
        return self.page.evaluate("window.GAME_TEST_HOOK.getState()")

    def observe(self) -> dict:
        return self.page.evaluate("window.GAME_TEST_HOOK.observe()")

    def self_check(self) -> list:
        return self.page.evaluate("typeof window.GAME_TEST_HOOK.selfCheck === 'function' ? window.GAME_TEST_HOOK.selfCheck() : null")

    def rollout(self, genome, seed=1, stop_on_life_lost=False, stall_steps=480, chunk=4) -> dict:
        return self.page.evaluate(ROLLOUT_JS, {"genome": genome, "seed": seed, "stopOnLifeLost": stop_on_life_lost,
                                               "stallSteps": stall_steps, "chunk": chunk})

    def close(self):
        try:
            self.browser.close()
        finally:
            self._pw.stop()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()
