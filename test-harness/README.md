# Kids Games Test Harness

Proves each game is **playable, winnable and fair**, then has bots play it so the kids have a score to beat.

```
test-harness/
  GAME_TEST_HOOK_SPEC.md     the contract every game implements (give this to the coding agent)
  LLM_GUIDED_BOT.md          the Thinking Bot (v2) and the GEPA upgrade path
  harness/run_tests.py       the test runner (run it from the repo root)
  harness/gamebot/           smoke tests, fairness checks, bots, scoreboard
  harness/check_live.py      after pushing: is the live site serving what is in the repo?
  tests/mock_ai_server.py    offline fake LiteLLM + Jev endpoint for testing the plumbing for free
  .env.example               model settings for the AI bots (copy to .env; never commit .env)
  requirements.txt           playwright, pillow, numpy
```

How and when a coding agent runs all this is in `AGENTS.md` ("Test hook and harness"). The starter game in `templates/game/` already passes it.

## Quick start

```bash
pip install -r test-harness/requirements.txt   # playwright, pillow, numpy
python3 -m playwright install chromium         # only if there is no Chromium/Chrome
python3 test-harness/harness/run_tests.py all games/<game>/index.html
```

`all` runs, in order:

1. **Smoke tests** (about 20 s). The page loads with no console errors, the hook follows the spec, the real keyboard moves the player, the screen is actually drawn, the same seed gives the same run, and the title screen shows the bot's best. Then the site rules every game must follow: P pauses, the page never scrolls, bot runs save nothing, storage keys start with the folder name, nothing is fetched from the network, and the game loads and draws on a phone-sized touch screen (spec section 10). If these fail, nothing else runs.
2. **Evolution Bot** (about 2 to 3 min for a short game, the first time). At least 3 passes, getting better each pass. It starts from its saved best run when there is one (see "The bot remembers").
3. **AI bots** that are configured in `.env` (Jev, Quick-Pick, Thinking). Skipped if not configured.
4. **Fairness checks.** Standing still at the start is safe; doing nothing or button-mashing doesn't win; **a human-speed bot can win (the run fails if none can, unless `--allow-no-win`)**; and a timing-tolerance test (nudge one input 40 ms early or late and see if the run still works).
5. **Scoreboard.** Writes `bot-scores.json` and puts the scores into the game file so the title screen says "Bot's best: 6045 bolts. Can you beat it?"

Files to commit, all in the game folder: `TEST_REPORT.md` (written by `all` only), `bot-scores.json`, `bot-best-run.json` (the exact inputs of the Evolution Bot's best run) and the game file with the scores written into it. Working files land in `<game folder>/test-results/`, which git ignores: `report.json`, screenshots, and the reports of quick runs (`smoke-report.md`, `bots-report.md`), so a quick run never overwrites the committed report. Exit code 1 means a required check failed.

Other commands:

```bash
python3 test-harness/harness/run_tests.py smoke games/<game>/index.html             # fast check after every change
python3 test-harness/harness/run_tests.py bots  games/<game>/index.html --bots jev,enum,llm
python3 test-harness/harness/run_tests.py all   games/<game>/index.html --bots evolutionary,jev,enum,llm --passes 5
```

Useful flags: `--passes` (minimum and default 3), `--rollouts` (Evolution Bot tries per pass, default 1000), `--extra-passes` (extra Evolution passes allowed while it hasn't won, default 2), `--fresh` (ignore the saved best run and search from scratch), `--allow-no-win` (don't fail when no bot can win), `--max-decisions` (AI bot move limit per pass, caps cost), `--decision-seconds` (how long each AI move is held, default 0.25), `--no-inject` (don't touch the game file), `--seed`.

## The bots

| Bot | Key | How it plays | How it improves pass over pass | Cost |
| --- | --- | --- | --- | --- |
| Evolution Bot (v1) | `evolutionary` | Replays its best run, backs up from where it died or got stuck, tries new moves from there | Keeps whatever gets further or scores more | Free (runs in the browser) |
| Jev Bot | `jev` | Jev picks one action from the list every 0.25 s of game time | "Lessons": what the screen looked like before each earlier death | Pennies per game |
| Quick-Pick Bot | `enum` | A cheap DeepInfra model through LiteLLM, forced to answer one action id | Same lessons as Jev, so it's a fair A/B | Pennies per game |
| Thinking Bot (v2) | `llm` | Same per-move picker | After each pass a reviewer model reads the deaths and rewrites a strategy | A bit more; see `LLM_GUIDED_BOT.md` |

The game's clock is **frozen while an AI bot thinks**, so Jev's 70 to 500 ms latency doesn't matter. Every Evolution Bot input is held at least 150 ms, roughly how fast a person can change input, so a run it finds is one a quick human could do.

**The bot remembers.** The Evolution Bot saves its best run in `<game folder>/bot-best-run.json` (commit it). The next run replays it first:

- It still wins exactly as before: nothing is searched, the run takes seconds, and the scores stay as they were.
- It plays out as before but hadn't won yet: the search carries on from it, and the new passes are added to the old ones.
- It plays out differently (the game changed): the search starts from the old run, which usually still gets most of the way, and the score history starts again.

`--fresh` ignores the file. A saved run for a different seed or action list is ignored too.

**Scores.** For each bot: `start` = pass 1 score, `mid` = the middle pass, `best` = best in any pass. The champion (highest `best` across bots) is what the title screen shows. Running only some bots keeps the other bots' last scores in `bot-scores.json`.

## Setting up the AI bots

Copy `test-harness/.env.example` to `test-harness/.env` (or pass `--env`) and fill in:

- `LITELLM_BASE_URL`, `LITELLM_API_KEY`: your LiteLLM proxy (DeepInfra behind it).
- `ENUM_MODEL`: the LiteLLM model name for the Quick-Pick Bot. Pick a small, fast model. If the model "thinks" before answering, turn that off with `CHAT_EXTRA_BODY`.
- `LLM_DECIDE_MODEL` / `LLM_REFLECT_MODEL`: Thinking Bot per-move model (defaults to `ENUM_MODEL`) and its between-pass reviewer (can be a stronger model; it is only called twice per test).
- `JEV_URL`, `JEV_API_KEY`, `JEV_MODEL`: Jev isn't on DeepInfra. The default URL is OpenRouter's SystemOne endpoint (`https://openrouter.ai/api/v1/systemone`) with an OpenRouter key. Jev uses a different API shape from chat models (state + typed questions), so it is called directly rather than through LiteLLM's chat endpoint. To keep everything behind LiteLLM, set up a LiteLLM pass-through route for `/systemone` and point `JEV_URL` at it.

Never commit `.env`; it holds keys (the root `.gitignore` ignores it). The report lists calls, errors, p50/p90 latency and tokens per bot, which is the Jev vs DeepInfra comparison.

To test the plumbing without spending anything:

```bash
python3 test-harness/tests/mock_ai_server.py 8765 &
LITELLM_BASE_URL=http://127.0.0.1:8765/v1 ENUM_MODEL=mock JEV_URL=http://127.0.0.1:8765/api/v1/systemone JEV_API_KEY=x \
  python3 test-harness/harness/run_tests.py bots games/<game>/index.html --bots jev,enum,llm --no-inject
```

## Adding the hook to an existing game

Hand the agent the spec plus this instruction:

> Read test-harness/GAME_TEST_HOOK_SPEC.md and add the test hook to `games/<game>/index.html`. Use `templates/game/index.html` (search for "TEST HOOK", "Hook.mode" and "BOT-SCORES") as the worked example. Then run the smoke test and fix everything until it passes, then run `all`.

New games start from `templates/game/`, which already has the hook, so this is only for games built another way.

## After pushing: is it live?

```bash
python3 test-harness/harness/check_live.py games/<game>
```

Keeps trying for up to 5 minutes (`--wait`) until the live copies of the game's files match the repo and the game is in the home page's list. Exit code 0 = live and current, 1 = the site answered but something is missing or old, 2 = the site can't be reached from this machine (common in sandboxes; not a problem with the game). `--base` points it at another copy of the site.

## What it found on Lost Luggage

`games/lost-luggage-of-the-cosmos/` (ten levels and a boss): all smoke tests pass. From nothing, the Evolution Bot needed `--extra-passes 12` and won on pass 10 (20 to 25 minutes) with 6045 bolts and no lives lost. With that run saved in `bot-best-run.json`, `all` now takes about 30 seconds. Every fairness check passes; timing tolerance was 57%. The current numbers are in that game's `TEST_REPORT.md`. The starter game (`templates/game/`) wins on pass 1 in under a minute.
