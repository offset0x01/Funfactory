# Changelog

Dated changes to the build spec (`AGENTS.md`) and the scaffolding around it. Newest first. Add a line here whenever you change how games are built or integrated.

## 2026-11-14

- `AGENTS.md` "Art, music and sound": outside art is fine when every source is cited and nothing is commercial; citing is now a done-checklist item. Dropped the 2 MB size target; flag it only when embedded art and audio pass 10 MB. No existing games need changes.
- **Senior review of the build spec; fixes below.** No existing games still need updating (`lost-luggage-of-the-cosmos` was updated in the same commit).
- New `templates/game/`: the starter every new game is copied from (plain WebGL, touch and keyboard, pause, high scores, full screen, offline files, a complete test hook, its own `test_game.py` and a `HANDOFF.md` outline). It passes the harness. `templates/make_icons.py` makes the Home Screen icons. `AGENTS.md` now says to copy it instead of "copy the pattern" in Lost Luggage. Removed the stale `test-harness/examples/lost-luggage/`.
- `AGENTS.md` rewritten around it: **touch and keyboard are both always on** (was keyboard by default, touch on request); WebGL preferred, plain by default, a library when a feature needs one; the two conflicting art rules merged (online art, code-drawn art and research are all open, sources listed in HANDOFF.md); "where you may write" replaces "never touch anything outside the project folder"; new **Changing an existing game** section and a single **Done checklist**; a second session prompt for changes.
- **Service worker fix:** all games share one cache space and the old `sw.js` deleted every cache but its own, so a second game would have wiped the first one's offline copy. `sw.js` now names its cache after its folder and deletes only its own old versions. Tested with three games side by side.
- Harness `smoke` now checks the site rules on every game: P pauses, the page never scrolls, bot runs save nothing, storage keys start with the folder name, no network requests, a High scores button, and a phone-sized touch screen (hook spec section 10).
- Harness reports: `all` writes `games/<name>/TEST_REPORT.md` (no more `git add -f`); `smoke` and `bots` write to the ignored `test-results/` and no longer overwrite the committed report.
- Hook spec: an underscore in an action id means "both together", so single actions can't contain one; the 4-second stuck rule is documented and adjustable with `info().stallSeconds`.
- Per-game tests launch the browser through the harness's `GameSession` instead of a hard-coded Chrome path. Stale notes fixed in `README.md`, `test-harness/README.md` and Lost Luggage's manifest and HANDOFF.
- `lost-luggage-of-the-cosmos` v2: six new levels (4 to 9) that get harder step by step, a boss fight (level 10, the Baggage Beast), three new biomes (ice comet, hot sauce moon, Lost & Found warehouse), two power-ups (Bubble Shield, Mega Fuzz) and four new monsters (Comet Hopper, Snoop Drone, Spiky Space Snail, Fire Flare). New map letters are listed in its HANDOFF.md.
- `AGENTS.md` "Test hook": `progress` must also grow with boss hits (the harness counts 4 s without progress as stuck), `maxSteps` must cover the whole game, and a still-improving Evolution Bot gets more tries with `--extra-passes`. No existing games need changes.
- New rule ("High scores and saved data"): every game keeps a per-device top-10 table with 3-letter initials, prefixes storage keys with its folder name, handles blocked storage, and never saves bot or demo runs. `lost-luggage-of-the-cosmos` updated to match (its old `llotc.` keys are migrated).
- `lost-luggage-of-the-cosmos` now implements the test hook (spec v1); the harness passes (Evolution Bot best 1375, won). No existing games still need the hook.
- Added the rule that anything durable built in a session (tools, scripts, harness code, docs) is committed to the repo, because session workspaces aren't shared between chats.
- Committed the test-harness code to `test-harness/`: `harness/run_tests.py` (smoke tests, Evolution Bot, Jev / Quick-Pick / Thinking bots, fairness checks, bot scoreboard), `tests/mock_ai_server.py`, `examples/lost-luggage/` (hooked example + `hook.patch`), `requirements.txt` and `.env.example`. Smoke test passes on the example from the new location. `.gitignore` now ignores `.env` files. `AGENTS.md` "Test hook" now requires running the harness. Existing games that still need the hook: `lost-luggage-of-the-cosmos`.

- `AGENTS.md` declared the source of truth for building games on any platform; agents pull and re-read it before working, and update it plus this changelog in the same commit as any spec change.
- Added `test-harness/`: the game test-hook contract (`GAME_TEST_HOOK_SPEC.md`), the harness README and the Thinking Bot notes. The harness code is not committed yet.
- New games must implement the test hook (spec v1). Existing games that still need it: `lost-luggage-of-the-cosmos`.
- Pages must be pinned so they never scroll, and the title screen must offer a tappable Full screen button that explains itself where full screen is blocked (found while testing on iPhone).
- Each game ships Home Screen files (`manifest.webmanifest`, `sw.js`, icons) for full screen, tilt and offline play on iPad and iPhone.
- Repo created with the game picker and Lost Luggage of the Cosmos; GitHub Pages publishes `main`.
