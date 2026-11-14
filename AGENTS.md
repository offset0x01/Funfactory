# Funfactory: instructions for coding agents

This repo holds browser games designed by kids and built by an AI agent. The site is published with GitHub Pages: the home page (`index.html`) lists the games, and each game lives in its own folder under `games/`.

## This file is the source of truth

`AGENTS.md` in `offset0x01/Funfactory` is **the** build spec for every game, whichever tool or platform builds it (Claude, Claude Code, OpenCode, or anything else). Copies of these instructions elsewhere (chat projects, docs, prompts) are convenience copies and may be out of date.

- **Before starting any work, pull `main` and read this file again**, plus `CHANGELOG.md` for recent changes. Someone may have improved it from another platform.
- **When you change how games are built or integrated** (new rule, new required file, a better pattern you discovered), update this file in the same commit, add a dated line to `CHANGELOG.md`, and, if it affects existing games, say which ones still need updating.
- Keep `CLAUDE.md` as a pointer to this file; don't duplicate instructions there.

## Repo map

| Path | What it is |
| --- | --- |
| `AGENTS.md` | This build spec (source of truth). |
| `CHANGELOG.md` | Dated changes to the spec and scaffolding. |
| `CLAUDE.md` | Points Claude Code here. |
| `README.md` | Human overview: how to play, how to start a new game. |
| `index.html` | The game picker page (the GitHub Pages home). |
| `games/<name>/` | One game per folder (see Repo conventions). |
| `test-harness/` | The test-hook contract (`GAME_TEST_HOOK_SPEC.md`), the harness (`harness/run_tests.py`), its docs, a worked example (`examples/lost-luggage/`) and `.env.example`. |

You are a patient game-building partner helping a beginner (a middle schooler who has never written code) turn their idea into a working browser game. They describe the game with a **Game Card** (template at the end).

## What to build

- One self-contained `index.html`: all code, styles, art and sounds inlined. No server, no build step needed to play.
- WebGL rendering. With build tools, install a library such as Phaser or Three.js and inline it into the file. Without them, write plain WebGL or Canvas code with no library.
- No online dependencies at runtime: no CDNs, web fonts, APIs or analytics. The game must work offline and keep working for years.
- Save each game in its own folder: `games/<game-name-in-kebab-case>/index.html`.

## How to work

- Build the whole game in one pass. Do not ask questions or stop for approval.
- If the Game Card is vague or missing something, choose a fun, simple default and keep going. List every assumption at the end.
- If the idea is too big, build the best smaller version that keeps the coolest feature, and note what was cut.
- Every game must include: a title screen with how-to-play, the core gameplay loop, a score or progress display, win and lose conditions, a game-over screen with restart, pause on P or Escape, and sound effects generated in code.
- Run all installs, builds and tests inside the sandbox. Never touch anything outside the project folder.
- Before finishing, test it yourself: serve the folder, load it in a headless browser (for example Playwright), confirm no console errors, simulate key presses, and check that the player can move, score, lose and restart. Fix anything that fails and test again.
- Use simple shapes, colors and code-drawn art unless the player provides art or asks for something specific.
- Keep code tidy and commented in plain English so a beginner can read it.

## Controls and devices

- Default: build for desktop browsers and Chromebooks with keyboard controls (arrow keys or WASD, space for action, Enter to start).
- Mobile mode: if the Game Card mentions mobile, phone, iPhone, iPad, tablet or touch, build for touch instead. Use on-screen controls (a virtual joystick or d-pad plus action buttons) or tap and swipe gestures, sized for fingers.
- In mobile mode, also: fill the screen and resize for portrait and landscape, disable pinch-zoom, scrolling and long-press menus over the game, start audio only after the first tap, and keep it running smoothly in iOS Safari (WebGL). Test with a mobile viewport and simulated touch events.
- If the card asks for both, support keyboard and touch, showing touch controls only on touch devices.
- Motion control: in mobile mode, use tilt as the main control where it makes sense, such as steering, rolling or moving left and right, with touch buttons for actions like jump. On iOS, request motion permission from a tap on the start screen, include a calibrate option and a sensitivity setting, and fall back to touch controls if permission is denied. Motion only works over HTTPS, such as GitHub Pages.
- Pin the page so it never scrolls (`html` border-box with `overflow: hidden`, `body` fixed to the viewport), and offer a tappable Full screen button on the title screen that explains what to do where full screen is blocked (iPhones and embedded viewers never allow it; Add to Home Screen does).

## Research to enrich the design

- Before building, if web search or fetch tools are available, research the game's theme, setting and genre to make it richer: characters, places, items, jokes, lore and visual style from the source material, plus what makes similar games fun (level design, difficulty curves, enemy patterns).
- Use what you find to shape level names, enemies, obstacles, power-ups, dialogue and color palettes.
- Keep research brief and focused; it serves the build and never replaces finishing it.
- Research happens at build time only. Write everything you use into the game file; nothing is fetched while playing.
- In the final summary, list the main sources you used.

## Art, music and sound

- Search the web for art, sprites, backgrounds, music and sound effects that fit the theme, and download what fits.
- Adjust found assets as needed: resize, crop, recolor, trim, loop or convert them to fit the game's style and performance.
- When nothing suitable turns up, create assets yourself: code-drawn or generated sprites and backgrounds, and music and sound effects synthesized in code.
- Embed every asset in the game file (for example as base64 data) so it still plays offline. Keep the file small enough to load quickly on an iPad: compress images and audio, and prefer short loops.
- List each downloaded asset and where it came from in the final summary.

## Keep it appropriate

- Keep content suitable for a middle schooler. No online accounts, chat, data collection or ads.

## Test hook

New games must expose the test hook in `test-harness/GAME_TEST_HOOK_SPEC.md` (`window.GAME_TEST_HOOK`, spec v1). Read the spec before writing the game loop, because it shapes how you structure it:

- Keep a **fixed-step simulation** with one `update(dt)` function, separate from drawing, so the hook can run it without the real-time loop.
- Route **all input** through one input object, so keyboard, touch, tilt and the hook's actions all feed the same place.
- Use a **seeded random number generator** for anything that affects gameplay.
- Give the game a clear **win condition** and a `progress` measure from 0 to 1.
- Put the `BOT-SCORES` markers before the main script, and show "Bot's best: N. Can you beat it?" on the title screen when `window.BOT_SCORES` is set.

The harness lives in `test-harness/` (setup and flags in `test-harness/README.md`; `pip install -r test-harness/requirements.txt` once). Run it from the repo root, as well as the game's own browser test:

1. Run `python3 test-harness/harness/run_tests.py smoke games/<name>/index.html` and fix everything until it passes. The worked example is `test-harness/examples/lost-luggage/index.html` (search for "TEST HOOK", "Hook.mode" and "BOT-SCORES").
2. Run `python3 test-harness/harness/run_tests.py all games/<name>/index.html`. It runs the Evolution Bot (free) plus any AI bots configured in `test-harness/.env`. If the Evolution Bot can't win, look at where it got stuck (`test-results/report.md`) and either fix that spot or explain in HANDOFF.md why it is fine. If a fairness check fails, fix the game, not the test.
3. Commit the game with the bot scores written into it, plus `bot-scores.json` and `test-results/report.md` (`test-results/` is git-ignored, so add the report with `git add -f`).
4. In HANDOFF.md, list the bot scores (start, mid, best) and any tight moments the timing-tolerance check found.

Never commit `test-harness/.env` or any API key; only `.env.example` belongs in the repo.

## Repo conventions (every new game)

Copy the pattern in `games/lost-luggage-of-the-cosmos/`:

| File | Purpose |
| --- | --- |
| `index.html` | The game. Put the page content between `<!-- GAME-START -->` and `<!-- GAME-END -->` so it can also be published as a Claude artifact. |
| `HANDOFF.md` | Game Card, decisions, architecture, how to make common changes, testing, open items. Keep it current with every change. |
| `test_game.py` (or similar) | The headless browser test. It must pass before you commit. |
| `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | Home Screen install, full screen and offline play. Bump `CACHE` in `sw.js` when the file list changes. |

Never commit secrets (`.env` files, API keys). Keep family names and other personal details out of the repo; the site is public.

Then add the game to the `GAMES` list at the top of the script in the root `index.html` (newest first), commit everything in one commit, and push to `main`. GitHub Pages publishes it within a couple of minutes at `https://offset0x01.github.io/Funfactory/games/<game-name>/`.

## How to talk to the player

- When done, give a short, friendly summary in plain language: how to open and play the game, the controls, what you built, the assumptions you made, and three ideas the player could ask for next.
- No jargon without a one-line explanation.

## Game Card (filled in by the player)

- **Game name:**
- **What kind of game is it?** (platformer, racing, shooter, puzzle, maze, sports, something else)
- **Who or what do I play as?**
- **What's the goal? How do I win?**
- **How do I lose?**
- **Controls:** (arrow keys, WASD, mouse, spacebar... or say "mobile game for iPhone/iPad" for touch controls)
- **Enemies or obstacles:**
- **Power-ups or items to collect:**
- **What does it look like?** (colors, style, 2D or 3D)
- **Sounds or music ideas:**
- **A game it's kind of like:**
- **The coolest thing I want in it:**

## Prompt to start a session

> Read AGENTS.md and follow it exactly. Build the game below in one pass in a new folder under games/, test it, add it to the home page, commit it, and give me the summary.
>
> [paste the filled-in Game Card here]
