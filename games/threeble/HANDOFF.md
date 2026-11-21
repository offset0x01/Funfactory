# Threeble: handoff

A 3D word game in the style of the classic crossword tile game, played inside a 9×9×9 cube of cells. Tiles are cubes with their letter on every face; words run along x, y or z. You play 1 to 3 computer players, pass one device between 2 to 4 friends, or play online with a room code. Read this before changing anything.

**Status (2026-11-21):** first version complete. Harness `smoke` passes, `test_game.py` passes (rules, builder with real taps, camera and peel with real multi-touch, computers, swap, pass, end and high scores, pass-the-device, online with four tabs over WebRTC through the fake broker), and `all` ran (see Testing). Not yet played on a real iPhone or iPad, and online play has not been tried between real devices (see Open items).

This game was copied from the multiplayer starter (`templates/game-multi/`). The `NET` section is the starter's, unchanged; "How multiplayer works" below describes how Threeble uses it.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole game: word list (between the `WORDS` markers), rules, move finder, word builder, 3D drawing, menus, online code, test hook. |
| `tools/build_words.py` | Rebuilds the word list and writes it into `index.html`. See "Word list". |
| `tools/blocked_hashes.txt` | Hashes of rude words and slurs that are removed from the word list (hashed so the list isn't readable in this public repo). |
| `test_game.py` | This game's own browser test. |
| `TEST_REPORT.md`, `bot-scores.json`, `bot-best-run.json` | Written by the harness `all` run. Don't edit by hand. |
| `manifest.webmanifest`, `sw.js`, icons | Add to Home Screen, full screen and offline play. The icon (a letter cube) is drawn with PIL. |

Live: https://offset0x01.github.io/Funfactory/games/threeble/

## The request it was built from

From the owner (2026-11-21), in short:

- **Game name:** Threeble, a multiplayer 3D version of the classic crossword tile game.
- **Board:** the play field is a cube; tiles are cubes with the letter on all sides. Words can go along any line in x, y or z.
- **Controls:** standard 3D viewer: one finger presses and moves to spin; two fingers zoom or twist.
- **Playing a word:** touching a face of a tile already played starts a word building out from that face. A word builder pops up with that tile in the middle; the player adds tiles on either side. When ready, they swing (pivot) the word around the anchor tile; crossing other tiles is allowed where the crossing lines up with a blank in the drafted word.
- **Bonus squares:** color-coded like the classic game and shown in the cube as light translucent blocks.
- **Seeing inside:** an intuitive way to move a clipping plane through the cube, hiding everything in front of it.
- **Players:** one or more computer opponents when playing alone (also used for testing); multiplayer.

## Decisions

| Decision | Why |
| --- | --- |
| **9×9×9 cube** (the first try was 7×7×7) | A word through one anchor tile in a 7-cell line can use at most 6 rack tiles, so the "use all 7 tiles, +50" bonus could never happen. At 9 a word can be 8 letters (7 tiles + the anchor). Also gives the peel more to do. |
| **Words count read either way along their line** | A spinning cube has no front, so "left to right" means nothing. A line of tiles is fine if it reads as a word forwards or backwards; scores are the same either way. |
| **Every word grows out of a tile on the board** (the anchor), for players and computers | That's the requested builder. The computer's move finder only offers words whose main line passes through a board tile, so computers can't make plays (side-by-side "parallel" plays) that players can't. |
| **The game starts with one tile in the middle** (drawn from the bag, a vowel or common consonant) | You can only build from a tile, so the first player needs one. It belongs to nobody. |
| **"Space" in the builder** = the requested blank | A Space must land on a board tile when the word is placed; that's how a word crosses other tiles. A rack tile can't land on an occupied cell. |
| **Swing** steps through the six directions out of the anchor (+x, +y, +z, −x, −y, −z) | Simple to tap, and it covers every way the row can pivot around the anchor. The draft shows in the cube as see-through tiles: green = playable, yellow = in place but not a word, red = blocked or off the edge. The tapped face sets the first direction. |
| **The peel** (clipping plane): a slider on the right; drag it down to hide 0 to 8 layers. It cuts from the cube side that faces you, picked automatically as you spin, whole layers at a time; an orange square outlines the cut. **Lock** keeps the cut on one side while you spin. Keyboard `[` `]` and `L`. | Cutting from "the side you're looking at" is what people expect, whole layers keep tiles whole, and snapping to the cube's own axes keeps it readable. Peeled tiles can't be tapped (taps go to the tile behind). |
| Scoring and tiles: the classic 98 letter tiles and values; **no blank tiles** | Blank wild tiles would need a letter picker and would be confusing next to the builder's "Space". Left as an idea. |
| Bonus squares by distance from the middle on each axis: 3× word at corners and edge middles, 2× word at face middles and on the diagonals, 3× letter and 2× letter in rings; about 19% of cells | Same on every side, so the cube is symmetrical however you hold it. Drawn as small glass blocks in the classic colors (light blue 2× letter, dark blue 3× letter, pink 2× word, red 3× word) with a legend at the top. |
| Game end: a player uses their last tile with the bag empty (they get everyone's leftover tile values), or every player passes or swaps twice in a row; leftover tiles are subtracted. Highest score wins; a tie is a tie. | The classic rules. |
| **Computer levels:** Easy plays a middling word from common words, Medium picks one of its 3 best common words, Hard always plays the best word from the full list | "Common" words come from `popular.txt` (below), so Easy and Medium play words kids know. The Hint button gives the best move from the full list. |
| **Friends on one screen = pass the device**, not "a side of the screen each" (the starter's default) | A word game is turn-based and racks are secret, so each player gets the whole screen on their turn; racks stay hidden behind an "I'm ready" screen while the device changes hands. |
| **Online:** the host's device keeps the bag and every rack, checks every move, and sends each friend only their own rack | Nobody can peek or cheat by sending a made-up move (the test sends one). Friends send moves, swaps and passes only. |
| Plain WebGL, no 3D library | Cubes with a letter texture, simple lighting, a clip plane in the shader and see-through blocks sorted back to front are a few hundred lines. |
| Camera, peel and the builder draft are per device | They're how you look at the game, not the game, so online friends spin and peel their own views. |

What was cut: blank tiles, and a "challenge a word" rule (the word list decides).

## How to play (what's on the title screen)

- One finger spins the cube, pinch zooms, two-finger twist turns it. Mouse: drag, wheel. Keys: arrows spin, Q/E twist, +/− zoom.
- Tap a tile: the builder opens with it as the anchor (yellow). Tap the left or right **+** to pick a side, then tap rack tiles to add them. **Space** adds a gap for a board tile. Tap a tile in the builder to take it back. **Swing** turns the word. **Play** when it's green.
- **Hint**, **Swap** (pick the tiles to trade), **Pass**.
- Keys in the builder: 1–7 add a rack tile, Tab switches side, G Space, Backspace takes one back, S swings, Enter or Space plays, C closes. H hint, X swap all. P or Esc pauses.

## How multiplayer works

- **Modes** (`Game.mode`): `solo` (you are seat 0 against 1 to 3 computers; high scores; the hook uses it with one Medium computer), `shared` (2 to 4 friends take turns on one device; `Game.handoff` shows the "I'm ready" screen), `online` (2 to 4 devices).
- **Turns:** `Game.turn` is the seat playing. `Game.canAct()` says whether this device may act now. Commands (`hint`, `play`, `swing`, `swap`, `pass`, `move`) go through `Input.push()` and are handled in `Game.update()`.
- **Online messages.** Host to everyone: `{ t: 's' }` with the board (a 729-letter string), owners, scores, rack counts, turn, last move and the log line, after every change; host to each friend: `{ t: 'rack', r }` (only their own tiles); `{ t: 'seat' }` at Start; `{ t: 'bad', msg }` when a friend's move is refused. Friend to host: `{ t: 'move', p: [[cell, letter], ...] }`, `{ t: 'swap', r }`, `{ t: 'pass' }`, `pause`, `resume`, `again`. The host checks moves with the same `Game.doMove()` it uses for itself.
- A friend who leaves is marked `gone`, their tiles go back in the bag and their turns are skipped. If the host leaves, everyone is told.

## Architecture

Sections inside `index.html`, in order:

1. **Markup and CSS:** HUD (score chips, bag count, pause), the peel slider, the bottom panel (message line, word builder, rack, Hint/Swap/Pass), menus. On a phone held sideways the panel docks on the left (CSS media query).
2. **WORDS / BUILD / BOT-SCORES markers.**
3. **CONFIG** (`CFG.N` is the cube size), letter counts and values (`LETTERS`), cell helpers (`idx`, `xyz`), the bonus squares (`MULT`).
4. **Random, saved data, sound.**
5. **Dict:** unpacks the word list into a `Set` (to check words) and a letter tree (for the move finder). Bit 1 = a word, bit 2 = a common word.
6. **Rules.evaluate(board, placed):** checks a move (one straight line, no holes, touches the board, every new word valid either way) and scores it.
7. **findMoves(board, rack, commonOnly):** every playable move, best first. Works out which letters each empty cell allows from its sideways words, then walks every line of the cube in both directions through the letter tree. `pickMove()` is how each computer level chooses.
8. **Input** (commands and keys), **Game** (start, turns, moves, swap, pass, end, progress, online state).
9. **Builder** (the word builder draft, `check()` shows where it lands and what it scores, `hint()`, `load()` turns a move into a builder row) and **Swap**.
10. **NET / Online:** from the starter.
11. **M4** (4×4 matrices), **Cam** (spin, zoom, the peel and its axis), **renderer** (`draw()`: tiles, glass blocks, the draft, the cube edges, the cut outline; `fitView()` fits the cube into the space the panels leave), `pickFace()` (which tile face is under a finger), touch handlers, the peel slider.
12. **UI** (HUD redrawn only when something changed), buttons, full screen, main loop, test hook.

## Common changes

- **Cube size:** `CFG.N` (keep it odd). Words are at most N−1 letters long, so rebuild the word list with that length (`tools/build_words.py`, the `{2,8}` pattern). Bonus-square table: `MULT` (keys are the distances from the middle, biggest first).
- **Tile counts or values:** `LETTERS`. **Rack size:** `CFG.RACK`. **Bonus:** `CFG.BINGO`.
- **Computer speed and skill:** `CFG.CPU_THINK`, `pickMove()`.
- **Word list:** run `python3 games/threeble/tools/build_words.py enable1.txt popular.txt` (get both from the source below). To block another word, add `w:<hash>` or `p:<hash>` to `tools/blocked_hashes.txt` (the script's docstring says how to make the hash) and rebuild.

## Word list

80,096 words of 2 to 8 letters from the ENABLE list (17,867 marked common), with 272 rude words and slurs removed. Packed (about 227 KB) inside `index.html`; unpacked on load in about 50 ms. Rude words are not valid for anyone, so nobody can play them.

## Testing

```
python3 test-harness/harness/run_tests.py smoke games/threeble/index.html
python3 games/threeble/test_game.py
python3 test-harness/harness/run_tests.py all games/threeble/index.html
python3 test-harness/harness/check_private.py
python3 test-harness/harness/check_live.py games/threeble
```

- **Hook:** actions `idle`, `hint` (H: load the best word into the builder), `play` (Enter), `swing` (S), `swap` (X: swap all tiles, or pass when the bag is low). Each is a press when the bot starts holding it. The bot plays seat 0 against one Medium computer. `progress` = 85% tiles on the board (every play by anyone moves it on) + 14% how far ahead you are; 1 on a win. `stallSeconds` is 12 (a computer turn takes 0.9 s). `maxSteps` = 15 minutes; a whole game usually takes under a minute of game time. `getState().player` = `{ x: tiles in the builder, y: tiles in your rack, z: tiles on the board, turn }`.
- **Bot scores (2026-11-21):** Evolution Bot won on its first pass with 591 points (pass 1: 591 won; pass 2: 591 won; the search was time-boxed with `--max-minutes 20` and stopped during pass 3). The Medium computer scored about half that. Fairness checks all pass: standing still is safe, doing nothing and button mashing don't win, a human-speed bot wins.
- **Tight moments** from the timing check: 17.9 s, 19.9 s and 20.8 s into the bot's run (43 of 46 nudged replays did as well). In a turn-based game these are just moves where pressing Hint a moment later meant the builder wasn't loaded yet; nothing to playtest.
- **Online on real devices (2026-11-21):** the first play test between two real devices never connected. Checked from the owner's computer: all three public matchmaking servers connect and pass messages, and two tabs found each other and swapped their handshakes completely, so matchmaking works. The direct device-to-device link is the step that failed. (The Claude desktop app's built-in browser can't make a direct link even to itself, so it can't be used to test this.) After the first fix, the joining phone reached "Found the game" and then "couldn't link up": the home network blocks the direct link. Second fix: the **relay** (from the starter's `NET`, copied here whole): when the direct link fails within 12 s, the game messages go through the brokers instead, still encrypted. A turn-based word game sends very little, so it plays the same. Tested here with a host whose direct link is blocked on purpose (join, Start, both players' words, host leaving). Still needs the real two-device try.
- Not yet tried on a real iPhone or iPad (multi-touch twist and the docked landscape panel deserve a real-device check).

## Build log

| Date | What was built | Expected | Actual |
| --- | --- | --- | --- |
| 2026-11-21 | First version: 9×9×9 cube, word builder with Swing and Space, peel slider, 1–3 computers (3 levels), pass-the-device, online, tests | 2½–3 hours | about 50 minutes (20 of them the bot search) |
| 2026-11-21 | Fix: online joining never connected on real devices. Offer and answer now carry all of a device's addresses in one message (no more address messages that could arrive before the offer and be lost); the online screen shows each step (servers reached, game found, linking up) and says clearly when the network blocks the direct link (25 s limit). Same fix in the multiplayer starter. Bot: saved run still wins (591). | about 45 minutes | about 20 minutes |
| 2026-11-21 | Fix 2: the real phones found each other but their home Wi-Fi blocked the direct link. Added the relay (in the starter and here): game messages go through the brokers, encrypted, when the direct link fails. Tests play a whole relay game. Bot: saved run still wins. | about 30 minutes | about 25 minutes |

## Sources and credits

- **Word list:** ENABLE (Enhanced North American Benchmark Lexicon), public domain, from https://github.com/dolph/dictionary (`enable1.txt`). Common-word marks from `popular.txt` in the same repo (ENABLE words also found in Wiktionary's TV and movie word-frequency lists).
- **Rude-word filter:** a hand-made list (stored only as hashes in `tools/blocked_hashes.txt`).
- **Tile counts and letter values:** the classic English set of the crossword tile game, as listed at https://en.wikipedia.org/wiki/Scrabble_letter_distributions (game rules and numbers only; no names, art or logos used).
- **Code:** the multiplayer starter (`templates/game-multi/`). All art (the tile faces, glass blocks, icons) is drawn in code; all sound is synthesized.

## Open items

- Try it on a real iPhone and iPad: two-finger twist, the peel slider under a thumb, the landscape panel.
- Try online between two real devices.
- Ideas: blank wild tiles; a "show me the empty spots next to tiles" helper for beginners; a slow auto-spin when idle; letting the peel cut at any angle (not just the cube's sides); online rejoin after a dropped link (see the starter's HANDOFF).
