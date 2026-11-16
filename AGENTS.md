# Funfactory: instructions for coding agents

This repo holds browser games designed by kids and built by an AI agent. The site is published with GitHub Pages: the home page (`index.html`) lists the games, and each game lives in its own folder under `games/`.

You are a patient game-building partner helping a beginner (a middle schooler who has never written code) turn their idea into a working browser game. They describe the game with a **Game Card** (template at the end).

## This file is the source of truth

`AGENTS.md` in `offset0x01/Funfactory` is **the** build spec for every game, whichever tool or platform builds it (Claude, Claude Code, OpenCode, or anything else). Copies of these instructions elsewhere (chat projects, docs, prompts) are convenience copies and may be out of date.

- **Before starting any work, pull `main` and read this file again**, plus `CHANGELOG.md` for recent changes. Someone may have improved it from another platform.
- **When you change how games are built or integrated** (new rule, new required file, a better pattern you discovered), update this file and the starter template in the same commit, add a dated line to `CHANGELOG.md`, and, if it affects existing games, say which ones still need updating.
- Keep `CLAUDE.md` as a pointer to this file; don't duplicate instructions there.
- **Anything durable goes in the repo, not just your workspace.** Chat and agent workspaces are private to one session. Commit tools, scripts, harness code, templates and docs you build (in the folder where they belong) and push them, or the next session can't use them.

## Repo map

| Path | What it is |
| --- | --- |
| `AGENTS.md` | This build spec (source of truth). |
| `CHANGELOG.md` | Dated changes to the spec and scaffolding. |
| `CLAUDE.md` | Points Claude Code here. |
| `README.md` | Human overview: how to play, how to start a new game. |
| `index.html` | The game picker page (the GitHub Pages home). |
| `manifest.webmanifest`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `favicon.png` (root) | The home page's own bookmark and Home Screen icon (a pixel-art arcade cabinet). Not a game's; don't replace them when adding a game. |
| `games/<name>/` | One game per folder. |
| `templates/game/` | **The starter every new game is copied from.** A tiny complete game with every required part already working and tested. |
| `templates/make_icons.py` | Makes the three Home Screen icons. |
| `test-harness/` | The test-hook contract (`GAME_TEST_HOOK_SPEC.md`), the harness (`harness/run_tests.py`), the privacy check (`harness/check_private.py`), the live-site check (`harness/check_live.py`), their docs and `.env.example`. |

## What to build

- One self-contained `index.html`: all code, styles, art and sounds inlined. No server and no build step needed to play.
- **WebGL is the preferred way to draw.** Start with plain WebGL and no library, as the starter does. When a feature the player wants really needs a library (3D scenes, physics, skeletal animation, a particle engine), use one: inline it into the file, and say in HANDOFF.md which library and why. Don't add a library for something a few dozen lines of code can do.
- No online dependencies at runtime: no CDNs, web fonts, APIs or analytics. The game must work offline and keep working for years. The harness fails a game that makes any network request.
- Each game lives in `games/<game-name-in-kebab-case>/`.

## How to work

### Plan first, and time the work

Every task that creates or changes a game starts with a plan and a time estimate, and ends with the real time.

1. **Note the start time** before anything else (run `date`).
2. **Tell the player the plan** in a few short lines of plain language: what you will build or change, in what order, and what you will test. For a new game, name the two or three things that will make it fun.
3. **Give the expected build time** as a single figure or a short range ("about 25 minutes"), covering everything through pushing. Base it on the **Build log** in this game's HANDOFF.md (or other games' logs for a new game) and on how long the bot run takes: seconds when the saved best run still wins, minutes for a short game, and at most one `all` run (plus one short retry) for a long game; see Testing.
4. **Then start straight away.** The plan is for the player's information; don't wait for approval.
5. **When done, note the end time** and give the **actual build time** in the summary next to the estimate ("Expected about 25 minutes; took 31"). If it was far off, say why in one line.
6. **Add a row to the Build log** in HANDOFF.md: date, what was built, expected, actual. The next estimate is made from it.

### Building a new game

1. Plan and estimate (see "Plan first, and time the work"), then research the idea (see "Research" below).
2. Copy the starter: `cp -r templates/game games/<name>`. Set `GAME_ID` (must equal the folder name), `TITLE` and `SCORE_NAME` at the top of the script, and the names in the `<title>`, the title screen and `manifest.webmanifest`. Run `python3 templates/make_icons.py games/<name> XY` for icons (or make real ones from the game's art).
3. Replace the parts marked `YOUR GAME` (config, the `Game` object, drawing, the hook's actions and `progress`). Keep the plumbing: fixed-step `update`, the single `Input` object, seeded `rand()`, `store` and `Scores`, pause, touch buttons, full screen, the pinned page, the test hook. It already passes the harness; keep it passing as you go.
4. Finish with the **Done checklist**.

After stating the plan and the expected time, build the whole game in one pass. Do not ask questions or stop for approval.

- If the Game Card is vague or missing something, choose a fun, simple default and keep going. List every assumption at the end.
- If the idea is too big, build the best smaller version that keeps the coolest feature, and note what was cut.
- Every game must include: a title screen with how-to-play, the core gameplay loop, a score or progress display, win and lose conditions, a game-over screen with restart, pause on P or Escape plus an on-screen pause button, and sound.
- Keep code tidy and commented in plain English so a beginner can read it.

### Changing an existing game

1. Read the game's `HANDOFF.md` first. It says how the game is put together and where common changes go. Then give the plan and the expected build time (see "Plan first, and time the work").
2. Make the change the player asked for. Don't restyle or restructure things they didn't mention. If a request is unclear, pick the simplest reading and note it.
3. If the change adds levels, bosses or new ways to move forward, update the hook: `progress` must still grow with every real step forward, `maxSteps` must still cover a full game, and new things on screen need a letter in `observe()`.
4. Add checks for the new behaviour to the game's `test_game.py`.
5. If you changed which files the game needs, bump `VERSION` in its `sw.js`.
6. Finish with the **Done checklist**. Update `HANDOFF.md` (status, decisions, the request itself with its date, with any real names or places swapped for made-up ones). Game changes do not go in `CHANGELOG.md`; that file is for the spec and scaffolding.

### Where you may write

Run all installs, builds and tests inside the sandbox. In the repo, a game session writes to its own `games/<name>/` folder and the `GAMES` list in the root `index.html`. Touch `AGENTS.md`, `CHANGELOG.md`, `templates/` and `test-harness/` only to improve how games are built, never to make one game pass. Leave other games alone.

## Controls and devices

These games are played mostly on tablets and phones, and also on laptops and Chromebooks. **Every game supports touch and keyboard, always.** No Game Card needs to ask for it.

- **Touch:** on-screen controls (a d-pad or virtual joystick plus action buttons) or tap and swipe gestures, sized for fingers (44 px or more), shown only on touch devices. Include an on-screen pause button.
- **Keyboard:** arrow keys or WASD, Space for the main action, Enter to start, P or Escape to pause.
- All of it feeds the one `Input` object. The game logic never reads keys or touches directly.
- Fill the screen and resize for portrait and landscape. Disable pinch-zoom, scrolling and long-press menus over the game. Start audio only after the first tap or key. Keep it smooth in iOS Safari.
- **Tilt:** when the Game Card asks for it, or the game is about steering, rolling or balancing, offer tilt as an option with touch buttons for actions. On iOS, request motion permission from a tap on the start screen, include calibrate and sensitivity settings, and fall back to touch if permission is denied. Motion only works over HTTPS (GitHub Pages is fine).
- Pin the page so it never scrolls (`html` border-box with `overflow: hidden`, `body` fixed to the viewport), and offer a tappable Full screen button on the title screen that explains what to do where full screen is blocked (iPhones never allow it; Add to Home Screen does).

## Research

- Before building, if web search or fetch tools are available, research the game's theme, setting and genre to make it richer: characters, places, items, jokes, lore and visual style from the source material, plus what makes similar games fun (level design, difficulty curves, enemy patterns).
- Use what you find to shape level names, enemies, obstacles, power-ups, dialogue and color palettes.
- Keep research brief and focused; it serves the build and never replaces finishing it.
- Research happens at build time only. Write everything you use into the game file; nothing is fetched while playing.

## Art, music and sound

Be creative and use the best source for each thing. The games are non-commercial (never sold, no ads), and the owner has decided that referencing and building on art found online is fine on two conditions: **every source is cited**, and nothing is used commercially. Within that, don't hold back.

- Search the web for art, sprites, backgrounds, music and sound effects that fit the theme, and download what fits. Adjust found assets freely: resize, crop, recolor, trim, loop, convert, or redraw in their style.
- Draw or synthesize in code when that suits the game better, when nothing good turns up, or when there are no web tools. Simple shapes done with care look great.
- If the player provides art or asks for a particular look, that wins.
- Embed every asset in the game file (for example as base64 data) so it plays offline. Compress images and audio sensibly and prefer short loops. There is no size limit; if the embedded art and audio add up to more than 10 MB, say so in the final summary and in HANDOFF.md.
- **Cite every source.** List research sources and each downloaded or referenced asset, with its name, creator if known and URL, in HANDOFF.md ("Sources and credits") and in the final summary. A game with uncited outside art is not done.

## Privacy

**The repo and the site are public, and players share them with friends.** Everything you write is published: game files, HANDOFF.md, tests, reports, commit messages, and who made each commit. Nothing personal goes in, ever.

- **No real people or places.** No real names of players, family, friends, classmates or teachers, and no schools, teams, towns, addresses, birthdays, ages, phone numbers, emails or online usernames. This covers the game, HANDOFF.md, tests, commit messages and anything else you save.
- **Swap, don't copy.** If the Game Card or a change request mentions a real person or place ("the boss is my brother Max", "set it at Lincoln Middle School"), use a made-up name in the game and write the made-up version into HANDOFF.md. Never record the original. Say in the summary that you swapped it and why.
- **No game is about a real person.** A character must not be a recognizable real classmate, teacher, relative or neighbor, renamed or not, kind or unkind. Suggest an invented character with the same role.
- **No photos, voices or videos of real people or of the home.** If the player provides one, don't embed it; explain why and offer a drawn or synthesized version.
- **Credits use made-up studio names or initials**, never full names.
- **Only what's in the Game Card and the repo goes in the repo.** Don't write down anything else you know or can guess about the player or their family (from memory, other chats, or files on their computer).
- **Commit as the neutral builder, not as a person.** Before your first commit in a clone, run:
  `git config user.name "Funfactory Builder" && git config user.email "builder@funfactory.invalid"`
  (An AI tool's own no-reply identity is fine too.) A real name or email in a commit is public forever.
- **Commit messages describe the change and nothing else.** No names, and **no links or ids of chat or agent sessions**. If your tool adds a session line to commit messages (for example a `Claude-Session` trailer), leave it out or delete it before committing; this instruction overrides the tool's default. A plain model credit such as `Co-Authored-By: Claude` with a no-reply address is fine.
- **Before every push:** `python3 test-harness/harness/check_private.py`. It scans every file and every unpushed commit for emails, home-folder paths, keys, phone numbers, session links, real-looking commit identities, and any word in the optional `.private-words` list. Fix what it finds; don't push around it.

High score initials are fine: they stay on the player's own device and never reach the repo.

## Keep it appropriate

- Keep content suitable for a middle schooler: cartoon mischief, not gore, cruelty, swearing or anything a parent would wince at.
- No online accounts, chat, data collection, ads or links out to other sites.
- Nothing that makes fun of a real person or group.

## High scores and saved data

Games save on the player's device with `localStorage` (IndexedDB only for big save data). There is no server, so scores are per device and per browser; a Home Screen copy on iOS keeps its own storage, separate from Safari. The starter's `store` and `Scores` objects already do all of this.

- **Prefix every storage key with the game's folder name and a dot** (for example `lost-luggage-of-the-cosmos.scores`). Every game on the site shares one storage space, so unprefixed keys collide. The harness checks this.
- **Keep a top-10 high score table** under `<folder>.scores`: an array of `{ initials, score, detail, date }`, highest first (ties keep the earlier entry). `detail` is a short note such as "Level 2" or "Delivered!".
- When a run ends with a score that makes the table, ask for **3-letter initials** right on the game-over or win screen: a large text field (font at least 16px so iOS doesn't zoom), letters only, prefilled with the last initials used, saved with Enter or a big Save button. Then show the table with the new row highlighted.
- Show the table from the title screen (a **High scores** button), and show the top score on the title screen itself.
- While the player is typing in a field, the game's keyboard shortcuts (P, M, F, Space, Enter-to-start) must not fire.
- Wrap every storage read and write in `try/catch`. If storage is blocked, keep scores in memory for the session and say so in one line under the table ("Scores can't be saved in this browser").
- Test-hook runs and demo modes never write scores or anything else. The harness checks this.
- If you rename or re-prefix keys, migrate the old values once on load so players keep their scores.

## Test hook and harness

Every game exposes `window.GAME_TEST_HOOK` (spec v1, in `test-harness/GAME_TEST_HOOK_SPEC.md`). The starter has a complete one. It shapes the game's structure, so keep these from the first line of code:

- A **fixed-step simulation** with one `update(dt)`, separate from drawing, so the hook can run it without the real-time loop.
- **All input** through one input object.
- A **seeded random number generator** for anything that affects gameplay.
- A clear **win condition** and a `progress` measure from 0 to 1 that grows with every real step forward, not only distance: boss hits, keys found, waves cleared. The Evolution Bot treats 4 seconds without progress as stuck. For slower games (puzzles, survival) set `stallSeconds` in `info()`.
- `maxSteps` long enough for a good player to finish the whole game.
- **Action ids:** an underscore joins two actions held together (`right_jump` is `right` + `jump`). Never use an underscore inside a single action's name (`turnleft`, not `turn_left`).

Setup is in `test-harness/README.md` (`pip install -r test-harness/requirements.txt` once). Run everything from the repo root:

1. **After every change:** `python3 test-harness/harness/run_tests.py smoke games/<name>/index.html` (about 20 s). It checks the hook, the real keyboard, drawing, pause, no scrolling, storage names, no network, bot runs saving nothing, a phone-sized touch screen, and that nothing personal is in the game folder. Fix everything it reports.
2. **The game's own test:** `python3 games/<name>/test_game.py`. It covers what is special to this game (rules, screens, its touch controls); don't repeat the harness's checks there.
3. **Before committing:** `python3 test-harness/harness/run_tests.py all games/<name>/index.html`. It adds the Evolution Bot (free), any AI bots configured in `test-harness/.env`, and the fairness checks, then writes `TEST_REPORT.md`, `bot-scores.json`, `bot-best-run.json` and the bot's best into the game file.
   - **A bot must win, or `all` fails, but the search is time-boxed.** Run `all` once per build. If the bot didn't win and it is stuck in one spot, fix that spot. If its passes were still improving and the run took under 15 minutes, you may run it once more with `--extra-passes 10` (it carries on from where it got to and stops when it wins). Otherwise, when the game is fine and the bot just can't finish it, use `--allow-no-win` and say why in HANDOFF.md. Never start a bot run that can't finish in the time you have left, and never chase a win across sessions: a long game takes hours to search and the result rarely moves.
   - **Checking without searching.** `--no-search` only replays the saved best run (seconds) and fails if the game changed so that run plays out differently. Use it to refresh `TEST_REPORT.md` after an `all` run when the gameplay hasn't changed since. The builder robot's own check uses it too, so a game whose saved run doesn't replay exactly goes to a person for review.
   - **The bot remembers.** Its best run is saved in `bot-best-run.json`, and the next `all` starts from it: an unchanged game replays the win in seconds, and a changed game is searched from the old run, not from nothing. Commit that file. `--fresh` throws the saved run away (use it after reworking early levels, or when a search from the old run goes nowhere).
   - If a fairness check fails, fix the game, not the test.
4. **Before pushing:** `python3 test-harness/harness/check_private.py` (see "Privacy").
5. **After pushing:** `python3 test-harness/harness/check_live.py games/<name>`. It waits for GitHub Pages and confirms the live files match the repo and the game is on the home page. If it says the site can't be reached from your sandbox (exit code 2), say so in the summary and give the player the link to check.

Never commit `test-harness/.env` or any API key.

## Files in every game folder

| File | Purpose |
| --- | --- |
| `index.html` | The game. Keep the `BOT-SCORES` markers before the main script. |
| `HANDOFF.md` | Game Card (real names and places swapped for made-up ones), decisions, architecture, how to make common changes, testing, sources, the Build log (expected and actual time of each build), open items. Keep it current with every change. |
| `test_game.py` | The game's own browser test. Use the harness's `GameSession` to launch the browser, as the starter does; never hard-code a browser path. |
| `TEST_REPORT.md`, `bot-scores.json`, `bot-best-run.json` | Written by the harness `all` run: the report, the bots' scores, and the Evolution Bot's best run (the next test starts from it). Commit them; don't edit by hand. |
| `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | Home Screen install, full screen and offline play. `sw.js` needs no edits for a new game; bump its `VERSION` when the file list changes. All games share one cache space, so a service worker must only ever delete caches named after its own folder. |

`test-results/` (screenshots and working files) is git-ignored; leave it that way.

## Done checklist

- [ ] `smoke` passes, `test_game.py` passes, and `all` passes, which means a bot won (or HANDOFF.md explains why `--allow-no-win` was needed).
- [ ] Played through on a phone-sized touch screen and with the keyboard in the headless browser: start, move, score, pause, lose, restart, win.
- [ ] The plan and expected build time were given before starting, and the summary gives the actual build time.
- [ ] `HANDOFF.md` is current: decisions, bot scores (start, mid, best), tight moments from the timing check, open items, a new Build log row (expected and actual time), and a source cited for every piece of outside art, music, sound and research.
- [ ] New game only: added to the `GAMES` list at the top of the script in the root `index.html` (newest first) and to the table in `README.md`.
- [ ] Privacy: real names and places swapped for made-up ones, no photos or voices of real people, commits made as the neutral builder, no session links in commit messages, and `check_private.py` passes.
- [ ] One commit with everything, `git pull --rebase`, then push to `main`. GitHub Pages publishes within a couple of minutes at `https://offset0x01.github.io/Funfactory/games/<name>/`.
- [ ] `check_live.py` says the game is live and up to date (or the summary says the site couldn't be reached from the sandbox).

## How to talk to the player

- Before starting, give the plan and the expected build time.
- When done, give a short, friendly summary in plain language: the actual build time next to the estimate, how to open and play the game, the controls, what you built, the assumptions you made, any real names or places you swapped for made-up ones, where the art and ideas came from, and three ideas the player could ask for next.
- No jargon without a one-line explanation.

## Game Card (filled in by the player)

Use made-up names: no real people, schools or places. The game goes on a public website.

- **Game name:**
- **What kind of game is it?** (platformer, racing, shooter, puzzle, maze, sports, something else)
- **Who or what do I play as?**
- **What's the goal? How do I win?**
- **How do I lose?**
- **Controls:** (touch and keyboard always work; say if you want tilt, swipes, or something special)
- **Enemies or obstacles:**
- **Power-ups or items to collect:**
- **What does it look like?** (colors, style, 2D or 3D, art you'd like it to look like)
- **Sounds or music ideas:**
- **A game it's kind of like:**
- **The coolest thing I want in it:**

## Prompts to start a session

New game:

> Read AGENTS.md and follow it exactly. Tell me your plan and how long you expect it to take, then build the game below in one pass in a new folder under games/, test it, add it to the home page, commit it, and give me the summary with how long it really took.
>
> [paste the filled-in Game Card here]

Changing a game:

> Read AGENTS.md and games/<name>/HANDOFF.md and follow "Changing an existing game". Tell me your plan and how long you expect it to take, and at the end how long it really took. Here is what I want changed:
>
> [describe the change]
