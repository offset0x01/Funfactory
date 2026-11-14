# Kids Games Test Harness

> **Status (2026-11-14):** these documents describe the harness and the test-hook contract. The harness code itself (`harness/`, `tests/`, `examples/`, `requirements.txt`, `.env.example`) was built in a separate Claude chat and **has not been committed to this repo yet**. Until it is, each game's own browser test (for example `games/lost-luggage-of-the-cosmos/test_game.py`) is the required check. When the code lands, put it in this folder and update this note and `AGENTS.md`.

Proves each game is **playable, winnable and fair**, then has bots play it so the kids have a score to beat.

```
test-harness/
  GAME_TEST_HOOK_SPEC.md     the contract every game implements (give this to the coding agent)
  LLM_GUIDED_BOT.md          the Thinking Bot (v2) and the GEPA upgrade path
  harness/run_tests.py       the test runner                                   (not committed yet)
  harness/gamebot/           smoke tests, fairness checks, bots, scoreboard    (not committed yet)
  examples/lost-luggage/     Lost Luggage with the hook added                  (not committed yet)
  tests/mock_ai_server.py    offline fake LiteLLM + Jev endpoint               (not committed yet)
  .env.example               model settings for the AI bots                    (not committed yet)
  requirements.txt                                                             (not committed yet)
```

The builder-prompt addendum that used to live here (`PROMPT_ADDENDUM.md`) is now part of `AGENTS.md` ("Test hook").

## Quick start

```bash
pip install -r test-harness/requirements.txt   # playwright, pillow, numpy
python3 -m playwright install chromium         # only if there is no Chromium/Chrome
python3 test-harness/harness/run_tests.py all games/<game>/index.html
```

`all` runs, in order:

1. **Smoke tests** (about 10 s). The page loads with no console errors, the hook follows the spec, the real keyboard moves the player, the screen is actually drawn, the same seed gives the same run, and the title screen shows the bot's best. If these fail, nothing else runs.
2. **Evolution Bot** (about 2 to 3 min). At least 3 passes, getting better each pass.
3. **AI bots** that are configured in `.env` (Jev, Quick-Pick, Thinking). Skipped if not configured.
4. **Fairness checks.** Standing still at the start is safe; doing nothing or button-mashing doesn't win; a human-speed bot can win; and a timing-tolerance test (nudge one input 40 ms early or late and see if the run still works).
5. **Scoreboard.** Writes `bot-scores.json` and puts the scores into the game file so the title screen says "Bot's best: 1375 bolts. Can you beat it?"

Results land in `<game folder>/test-results/`: `report.md`, `report.json`, screenshots, and `evolutionary-best-run.json` (the exact inputs of the bot's best run). Exit code 1 means a required check failed.

Other commands:

```bash
python3 test-harness/harness/run_tests.py smoke games/<game>/index.html             # fast check after every change
python3 test-harness/harness/run_tests.py bots  games/<game>/index.html --bots jev,enum,llm
python3 test-harness/harness/run_tests.py all   games/<game>/index.html --bots evolutionary,jev,enum,llm --passes 5
```

Useful flags: `--passes` (minimum and default 3), `--rollouts` (Evolution Bot tries per pass, default 1000), `--extra-passes` (extra Evolution passes allowed while it hasn't won, default 2), `--require-win` (fail the build if no bot proves a win), `--max-decisions` (AI bot move limit per pass, caps cost), `--decision-seconds` (how long each AI move is held, default 0.25), `--no-inject` (don't touch the game file), `--seed`.

## The bots

| Bot | Key | How it plays | How it improves pass over pass | Cost |
| --- | --- | --- | --- | --- |
| Evolution Bot (v1) | `evolutionary` | Replays its best run, backs up from where it died or got stuck, tries new moves from there | Keeps whatever gets further or scores more | Free (runs in the browser) |
| Jev Bot | `jev` | Jev picks one action from the list every 0.25 s of game time | "Lessons": what the screen looked like before each earlier death | Pennies per game |
| Quick-Pick Bot | `enum` | A cheap DeepInfra model through LiteLLM, forced to answer one action id | Same lessons as Jev, so it's a fair A/B | Pennies per game |
| Thinking Bot (v2) | `llm` | Same per-move picker | After each pass a reviewer model reads the deaths and rewrites a strategy | A bit more; see `LLM_GUIDED_BOT.md` |

The game's clock is **frozen while an AI bot thinks**, so Jev's 70 to 500 ms latency doesn't matter. Every Evolution Bot input is held at least 150 ms, roughly how fast a person can change input, so a run it finds is one a quick human could do.

**Scores.** For each bot: `start` = pass 1 score, `mid` = the middle pass, `best` = best in any pass. The champion (highest `best` across bots) is what the title screen shows. Running only some bots keeps the other bots' last scores in `bot-scores.json`.

## Setting up the AI bots

Copy `.env.example` to `.env` (in this folder, or pass `--env`) and fill in:

- `LITELLM_BASE_URL`, `LITELLM_API_KEY`: your LiteLLM proxy (DeepInfra behind it).
- `ENUM_MODEL`: the LiteLLM model name for the Quick-Pick Bot. Pick a small, fast model. If the model "thinks" before answering, turn that off with `CHAT_EXTRA_BODY`.
- `LLM_DECIDE_MODEL` / `LLM_REFLECT_MODEL`: Thinking Bot per-move model (defaults to `ENUM_MODEL`) and its between-pass reviewer (can be a stronger model; it is only called twice per test).
- `JEV_URL`, `JEV_API_KEY`, `JEV_MODEL`: Jev isn't on DeepInfra. The default URL is OpenRouter's SystemOne endpoint (`https://openrouter.ai/api/v1/systemone`) with an OpenRouter key. Jev uses a different API shape from chat models (state + typed questions), so it is called directly rather than through LiteLLM's chat endpoint. To keep everything behind LiteLLM, set up a LiteLLM pass-through route for `/systemone` and point `JEV_URL` at it.

Never commit `.env`; it holds keys. The report lists calls, errors, p50/p90 latency and tokens per bot, which is the Jev vs DeepInfra comparison.

To test the plumbing without spending anything:

```bash
python3 test-harness/tests/mock_ai_server.py 8765 &
LITELLM_BASE_URL=http://127.0.0.1:8765/v1 ENUM_MODEL=mock JEV_URL=http://127.0.0.1:8765/api/v1/systemone JEV_API_KEY=x \
  python3 test-harness/harness/run_tests.py bots games/<game>/index.html --bots jev,enum,llm --no-inject
```

## Adding the hook to an existing game

Hand the agent the spec plus this instruction:

> Read test-harness/GAME_TEST_HOOK_SPEC.md and add the test hook to `games/<game>/index.html`. Use `test-harness/examples/lost-luggage/index.html` (search for "TEST HOOK", "Hook.mode" and "BOT-SCORES") as the worked example. Then run the smoke test and fix everything until it passes, then run `all`.

## What it found on Lost Luggage (in the other chat)

All smoke tests passed. The Evolution Bot scored 760, then 1165, then won on pass 3 with 1375 bolts and no lives lost. Every fairness check passed. Timing tolerance was 70%; the tightest moments were around 6 s, 26 s and 38–39 s into a run, which are the spots to playtest if anything feels unfair. The repo's copy of Lost Luggage does not have the hook yet.
