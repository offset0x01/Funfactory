# Game Test Hook: spec v1

Every game built from the Kids Game Builder Prompt **must** expose this hook. The test harness (`harness/run_tests.py`) drives the game only through it. A game without a valid hook fails the build.

The hook does three jobs:

1. **Lets a bot play deterministically.** The harness stops the game's own clock and advances the simulation itself, a fixed number of physics steps at a time. A slow AI bot (Jev, an LLM) can take 500 ms to decide and the game simply waits.
2. **Reports state** the harness can score: status, score, lives, level and progress.
3. **Shows the bot's best score** to the kids on the title screen, so they know what to beat.

It is harmless for players: nothing changes until something calls `reset()`.

---

## 1. Where it lives

```js
window.GAME_TEST_HOOK = {
  version: 1,
  info()            { ... },   // static description of the game
  reset(options)    { ... },   // start a fresh run, skipping menus
  step(action, n)   { ... },   // hold an action for n physics steps, return getState()
  getState()        { ... },   // current status, score, progress
  observe()         { ... },   // what a bot can "see" right now
  selfCheck()       { ... },   // OPTIONAL: game-specific design checks
};
```

Define it at the end of the main script, after the game objects exist. Keep it in one clearly marked block (`// ---------- TEST HOOK (spec v1) ----------`) so kids and agents can find it.

## 2. `info()`

Returns a plain object. It must not change during a run.

```js
{
  spec: 1,
  title: "Lost Luggage of the Cosmos",
  stepsPerSecond: 120,          // physics steps per game second
  levelCount: 3,                // 1 for games with no levels
  scoreName: "Bolts",           // what the score is called on screen
  maxSteps: 28800,              // a run longer than this is a fail (here 4 minutes)
  actions: [                    // the ONLY things a bot can do. 3 to 10 entries.
    { id: "idle",       desc: "Do nothing" },
    { id: "right",      desc: "Walk right" },
    { id: "left",       desc: "Walk left" },
    { id: "jump",       desc: "Jump straight up (press again in the air to double jump)" },
    { id: "right_jump", desc: "Walk right and jump" },
    { id: "left_jump",  desc: "Walk left and jump" }
  ],
  keys: {                       // real keyboard keys behind each action (KeyboardEvent.code)
    right: ["ArrowRight"], left: ["ArrowLeft"], jump: ["Space"]
  },
  smokeAction: "right"          // an action that visibly changes getState() within 1 second
}
```

Rules for `actions`:

- `idle` must exist and must be first.
- Each action is a **held** input for as long as the bot keeps choosing it. If an action includes a button press (jump, fire), the hook turns "not held last step, held now" into a single press, exactly as a key-down would.
- `desc` is read by the AI bots. Write it for a smart 10-year-old: what it does, not how.
- Touch- or tilt-only games still declare actions; the hook feeds them into the same input object the touch buttons or tilt feed.

`keys` lists keyboard codes for each part of an action (`right_jump` = `right` + `jump`). The smoke test presses these real keys to prove the keyboard is wired, so it must match the game.

## 3. `reset(options)`

```js
reset({ seed = 1, level = 0, realtime = false } = {})
```

- Starts a brand-new run from `level` with full lives and score 0. It skips the title, intro and any "press start" screens, and stops any demo.
- **Seeds every random number that affects gameplay** from `seed` (enemy spawns, item drops, level generation). Randomness that only affects looks (particles, screen shake) may keep using `Math.random`. Same seed + same actions must give exactly the same run. The harness checks this.
- `realtime: false` (bot mode): the game's own loop **must stop advancing the simulation**. It keeps drawing. Only `step()` moves time. Sound stays off.
- `realtime: true` (smoke-test mode): the game runs normally on its own clock with real keyboard input. Used to prove the keys work.
- Between levels in bot mode, the hook loads the next level immediately; no "level complete" screen waits for a click. Level-complete bonuses still count.
- Saving a player's best score to localStorage is skipped during test runs, so bots never overwrite the kids' high score.

## 4. `step(action, n = 1)`

- `action` is one of the ids from `info().actions`.
- Advances exactly `n` fixed physics steps, synchronously, holding that action.
- Stops early if the run ends (`won`, `lost`, or `maxSteps` reached).
- Returns `getState()`.

It must be fast: no rendering, no waiting. A whole 4-minute run should simulate in well under a second.

## 5. `getState()`

```js
{
  status: "playing",       // "playing" | "won" | "lost" | "timeout"
  score: 230,              // the number shown to players
  lives: 4,                // null if the game has no lives
  livesLost: 1,            // count since reset
  level: 1,                // 0-based index of the current level
  levelsCompleted: 1,
  progress: 0.47,          // 0..1 across the WHOLE game (see below)
  steps: 5120,             // physics steps since reset
  player: { x: 41.2, y: 11.0, vx: 7.2, vy: 0, onGround: true }   // world units; any extra fields welcome
}
```

`progress` is the most important number for the bots. It must:

- go from 0 at the start of the game to 1 when the game is won;
- mostly increase as the player gets closer to winning;
- for a multi-level game, be `(levelsCompleted + progressInThisLevel) / levelCount`.

Pick the honest measure for the genre: distance to the goal for a platformer or racer, fraction of enemies cleared for a shooter, fraction of pellets eaten for a maze game, survival time over target time for a survival game.

## 6. `observe()`

What an AI bot sees each time it decides. Return:

```js
{
  text: "....",          // <= 1,500 characters. A small ASCII map around the player plus a few facts.
  facts: { gravity: "normal", doubleJump: "ready" }   // short key/value facts
}
```

Good `text` for a 2D game is an ASCII window around the player with a legend, for example:

```
Legend: @ you, # solid, ^ spikes, R robot, J jelly, * bolt, D goal, G flipped-gravity zone
Columns 38..54, you face right
...............
.....*.........
..@......R.....
###########.###
```

Keep it to what a person would see on screen. Do not include hidden information (future random spawns, secret routes).

## 7. `selfCheck()` (optional)

Returns a list of problems the game can detect about its own design, which the harness prints in the fairness report:

```js
[ { level: 2, severity: "error", message: "Gap at column 64 is 6 tiles; a jump clears 4." } ]
```

Return `[]` when there is nothing to report.

## 8. Showing the bot's best score

The harness writes the bots' scores into the game file between these two markers. Put them **before** the main game script, inside the page content:

```html
<!-- BOT-SCORES-START -->
<script>window.BOT_SCORES = null;</script>
<!-- BOT-SCORES-END -->
```

After a test run they hold something like:

```js
window.BOT_SCORES = {
  game: "Lost Luggage of the Cosmos",
  updated: "2026-11-14T16:05:00Z",
  champion: { bot: "evolutionary", label: "Evolution Bot", score: 540, won: true },
  bots: {
    evolutionary: { label: "Evolution Bot", start: 120, mid: 380, best: 540, won: true, passes: [120, 380, 540] }
  }
};
```

The game must:

- On the title screen, when `window.BOT_SCORES?.champion` exists, show **"Bot's best: 540. Can you beat it?"** (use the game's own score name).
- When the player finishes or loses a run with a score above `champion.score`, celebrate it ("You beat the bot!").
- Show nothing extra when `BOT_SCORES` is `null`.

The same numbers are saved next to the game as `bot-scores.json`.

## 9. Checklist for the coding agent

- [ ] `window.GAME_TEST_HOOK` with `version: 1` and all required methods.
- [ ] `info().actions` starts with `idle`; `keys` match the real controls.
- [ ] Bot mode freezes the real-time loop; `step()` is the only clock.
- [ ] Gameplay randomness is seeded by `reset({seed})`.
- [ ] Level transitions are automatic in bot mode.
- [ ] `progress` goes 0 → 1 and reaches 1 exactly when `status` becomes `won`.
- [ ] Test runs don't save to the player's high score.
- [ ] `BOT-SCORES` markers present; title screen shows the bot's best when set.
- [ ] `python3 harness/run_tests.py smoke path/to/index.html` passes.

A complete worked example is `examples/lost-luggage/index.html` (search for `TEST HOOK`).
