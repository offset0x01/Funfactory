# Changelog

Dated changes to the build spec (`AGENTS.md`) and the scaffolding around it. Newest first. Add a line here whenever you change how games are built or integrated.

## 2026-11-14

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
