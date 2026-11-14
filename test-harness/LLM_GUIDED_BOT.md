# Thinking Bot (v2) and the upgrade path

The plan is to start with the cheap Evolution Bot (v1) and keep the LLM-guided bot ready to switch on. It is already built (`--bots llm`); this note explains how it works and where to take it next.

## How it works today

Each pass:

1. **Play.** Every 0.25 s of game time the bot reads `observe()` (an ASCII view plus facts) and a small, fast model picks one action id. The answer is forced to the action list with a JSON-schema enum. The game clock is frozen while the model thinks.
2. **Review.** After the pass, a reviewer model gets the result (status, score, progress, lives lost, moves used) and the screen just before each lost life. It writes a new **strategy**: at most 120 words of concrete rules.
3. **Next pass.** The strategy goes into every per-move prompt.

Two models, set in `.env`:

- `LLM_DECIDE_MODEL`, called hundreds of times per pass, so keep it cheap and fast.
- `LLM_REFLECT_MODEL`, called once between passes, so it can be a stronger model at almost no extra cost.

Rough cost per game with the defaults (600-move cap, 3 passes): about 1,800 move calls at about 600 input tokens each, roughly 1M input tokens, plus 2 reviewer calls. On a small DeepInfra model that is cents.

## Compared with Jev and Quick-Pick

All three AI bots share the same loop, view and action list, so they can be compared head to head:

| | Picks moves with | Learns between passes from |
| --- | --- | --- |
| Jev Bot | Jev, a `choice` question (calibrated probabilities, no text) | auto-written "lessons" (screen before each death) |
| Quick-Pick Bot | small chat model, enum answer | the same lessons |
| Thinking Bot | small chat model, enum answer | a reviewer model's rewritten strategy |

So Jev against Quick-Pick tests the **picker**, and Quick-Pick against Thinking tests **reflection**. The report includes latency and tokens for each.

Jev can't write text, so it can't be the reviewer. A natural hybrid to try later is Jev as the per-move picker plus a chat model as the reviewer, which puts the strategy text into Jev's `state`.

## Upgrade: GEPA

The strategy text is a prompt, and the game score is a clean number to optimize, which is exactly what GEPA needs. GEPA (reflective prompt evolution) keeps a pool of candidate prompts, runs them, has an LLM read the traces and propose edits, and keeps the ones that score better.

Mapping:

| GEPA piece | In this harness |
| --- | --- |
| Program / prompt to evolve | the Thinking Bot's strategy (plus, optionally, the system prompt in `providers.ChatProvider.decide`) |
| Evaluation | one pass: `AgentBot._play_pass()` returns score and progress |
| Metric | `10000 * progress + score` (the same `fitness()` the Evolution Bot uses) |
| Feedback text for reflection | the per-pass summary and the death views, as already built in `AgentBot._reflect()` |
| Train / validation sets | different `--seed` values, and different levels via `reset({level})` |

Steps when you're ready:

1. Wrap `AgentBot._play_pass` as an evaluation function that takes a strategy string and returns `(fitness, feedback_text)`.
2. Feed that to GEPA's optimizer with `LLM_REFLECT_MODEL` as the reflection model. Use a small budget first (20 to 40 evaluations).
3. Save the winning strategy per game, or across games as a general "how to play platformers" prompt, and load it as the Thinking Bot's starting strategy.
4. Hold out one seed or level to check it generalizes and isn't just memorizing one run.

One caveat: GEPA's budget is counted in full game runs, so costs scale with evaluations times moves. Keep `--max-decisions` low while tuning.
