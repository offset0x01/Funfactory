# Job notes: Comet Catcher (Studio request 5023c83b)

## Plan
- Build new game `games/comet-catcher/` from `templates/game/` per AGENTS.md "Building a new game".
- Catching arcade: space dog + net, 30 comets in 60 s, 5-miss pool shared with rock bumps,
  magnet bone power-up, sparkly trails, woof sounds. Test: smoke, test_game.py, all (bot must win),
  check_private. Commit on studio/5023c83b (no push per Studio rules). result.json + DONE.md.
- Start: 20:25 UTC. Expected: ~60 min.

## Key facts found
- Harness venv: /opt/ff/bin/python3 (playwright, PIL, numpy). System python3 lacks them.
- Evolution Bot search (`_search_eval`) cuts runs at the FIRST life lost => the game must be
  (near-)flawlessly winnable; late hits can still win via `_full_eval` + life-backs.
- Fairness checks: 3 s standing still must lose 0 lives; 30 s idle must not win; random mash no win.
- Timing-tolerance <50% is only a warn, not a fail.

## Tuning decisions (all in CFG)
- MIN_GAP 1.4 s arrival spacing in spawnComet (slows a comet if needed) => no impossible
  double-catches; dog crosses field in 1.33 s (DOG_SPEED 12).
- Rocks: spawn >=2.6 u from dog, none before t=3.4 s, ~6.0->3.6 s apart (about 9-10 per run).
- Life-back every 10-catch streak (kid cushion, keeps card's numbers).
- Verified with closed-loop 150 ms autopilot: seed 1 flawless win 30/30, 0 hits, 17.6 s left;
  seeds 2-5 win with <=3 pool hits.

## Progress / status
- [x] Read spec/changelog/starter/harness (evolve.py, fairness.py, smoke.py, browser.py).
- [x] Game file written (fixed 2 self-caught bugs: unbalanced quote, degenerate collar line;
      dog needed a y property for observe()).
- [x] Icons: custom PIL comet (can't preview images in this session; verified via pixel probe:
      dog tan, net ring white, floor band, comet cyan, planet, bg all present at expected coords).
- [x] test_game.py: 21/21 PASS. smoke: all PASS.
- [x] `all` PASS: Evolution Bot won pass 1 (1040, 0 lives lost), best 1065; fairness all PASS;
      timing tolerance 90% (43/48); BOT-SCORES champion written in; title shows it.
- [x] GAMES entry (root index.html, newest first) + README row.
- [x] HANDOFF.md complete with real bot numbers; build log 60 expected / 18 actual.
- [x] check_private: only pre-existing untracked .scaf/setup.log flagged (not mine, not committed).
- [x] Committed: 339afe0 (game + home page) + 1985d3e (build-log time), author Funfactory Builder.
- [x] result.json + DONE.md written. Critic re-ran all checks: ACCEPT on all 8 items.

## WebKit emulation results (challenger request)
- Installed Playwright WebKit 27.2 (94.7 MB download to ~/.cache/ms-playwright/webkit-2388) + system
  deps via `playwright install-deps webkit` (GTK4, gstreamer etc.). Launches headless with a Safari UA.
- iPhone 390x844 / iPad portrait 820x1180 / iPad landscape 1180x820, touch+mobile contexts:
  loads, WebGL draws (pixel std 26-36), tap-to-start, touch buttons visible.
- Real tap event chain on #tLeft: pointerdown:touch -> touchstart -> pointerup:touch -> touchend;
  no stuck held buttons (Input.touch.size 0 after). Playwright tap() lasts ~0 ms of game time so the
  dog moves 0 units on a zero-length tap; a 300 ms touch-hold moves -3.8 units. Press-and-hold works.
- file:// load logs ONE console error: WebKit eagerly fetches manifest.webmanifest with origin null
  -> Access-Control-Allow-Origin failure. Served over http://127.0.0.1 (like GitHub Pages): zero
  console errors, zero failed requests. Environment quirk, not a game bug; no game change made.
- Keyboard under WebKit: arrows 8.00 -> 13.00, KeyA back to 8.60, P pauses, Esc resumes, no pageerrors.
- Conclusion: touch controls verified on the WebKit engine; only physical-device feel remains untested.
- HANDOFF Status + Open items updated with these results (commit 3 of this job).

## BrowserStack probe (challenger request 2)
- No BrowserStack credentials anywhere: env vars empty, no ~/.browserstack, nothing in .env/.scaf.
- Service reachable (browserstack.com HTTP 200) but API without auth: 401 "HTTP Basic: Access denied"
  (https://api-cloud.browserstack.com/app-automate/sessions).
- Creating an account is outside the job's rules (AGENTS.md "no online accounts"; signup needs an
  email; the Studio job is a repo build).
- Even with an account: the game is unpublished (3 unpushed commits on studio/5023c83b; GitHub Pages
  serves main) -> no public URL for a cloud device; BrowserStack Local Testing tunnel binary also
  needs the account's access key (their docs: /docs/local-testing/overview).
- No other cloud credentials (Sauce/LambdaTest/Google/AWS absent); iOS Simulator is macOS-only,
  this container is Linux.
- Conclusion: cloud device testing infeasible for this job; documented in HANDOFF.md Open items,
  DONE.md updated with evidence + the post-publish URL for a human with an account.

## Timing
Start 20:25:39 UTC, end 20:43:54 UTC => 18 min 15 s (estimate was 60 min; fast because the game
is small, the autopilot proved the tuning on the first try, and the bot won on pass 1).

## Dead ends
- Autopilot v2 (simple flee) took 3-5 rock hits/run: fixed by arrival spacing + predictive dodge,
  then softened rock traffic instead of over-fitting the autopilot.
