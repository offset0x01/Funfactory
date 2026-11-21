# Test report: Threeble

Run at 2026-11-21 16:28:54 · seed 1

## Smoke tests

| Result | Check | Detail |
| --- | --- | --- |
| PASS | BOT-SCORES markers in file | add the markers from spec section 8 |
| PASS | nothing personal in the game folder | no emails, home paths, keys, phone numbers or session links |
| PASS | loads without console errors |  |
| PASS | window.GAME_TEST_HOOK exists |  |
| PASS | hook.version is 1 | version=1 |
| PASS | required hook methods exist |  |
| PASS | info.spec is 1 | spec=1 |
| PASS | info.title present | 'Threeble' |
| PASS | info.stepsPerSecond present | 60 |
| PASS | info.levelCount present | 1 |
| PASS | info.maxSteps present | 54000 |
| PASS | info.actions present | [{'id': 'idle', 'desc': 'Wait (the computer plays on its turn)'}, {'id': 'hint', |
| PASS | info.keys present | {'hint': ['KeyH'], 'play': ['Enter'], 'swing': ['KeyS'], 'swap': ['KeyX']} |
| PASS | 3 to 10 actions | 5 actions |
| PASS | first action is 'idle' | first=['idle'] |
| PASS | every action has a desc |  |
| PASS | action ids are unique |  |
| PASS | every action maps to real keys |  |
| PASS | smokeAction is a real action | smokeAction=hint |
| PASS | after reset: state has all fields |  |
| PASS | after reset: status is valid | status=playing |
| PASS | after reset: progress in 0..1 | progress=0.04666666666666667 |
| PASS | reset gives score 0, steps 0 | score=0 steps=0 |
| PASS | bot mode freezes the game clock | game moved by itself during bot mode |
| PASS | step('idle', 10) advances exactly 10 steps | steps=10 |
| PASS | after step: state has all fields |  |
| PASS | after step: status is valid | status=playing |
| PASS | after step: progress in 0..1 | progress=0.04666666666666667 |
| PASS | unknown action is rejected |  |
| PASS | observe() gives text | 243 chars |
| PASS | same seed + same inputs = same run | run A 20/0.408 vs B 20/0.408 |
| PASS | full-length run simulates in < 5 s | 0.05 s for 54000 steps |
| PASS | real keyboard works (hint) | idle player {'x': 0, 'y': 7, 'z': 1, 'turn': 0} vs keys {'x': 4, 'y': 7, 'z': 1, 'turn': 0} |
| PASS | game screen is drawn (not blank) | pixel std 30.1, ~1680 colors |
| PASS | no console errors while playing |  |
| PASS | P pauses and resumes | nothing may change while paused, and the smoke action must work again after the second P |
| PASS | page never scrolls | page is 0 px too wide, 0 px too tall |
| PASS | bot runs save nothing | a bot run wrote to localStorage: [] |
| PASS | storage keys start with the folder name | 1 key(s) checked |
| PASS | no network requests |  |
| PASS | title screen has a High scores button | no 'High scores' text on the title screen |
| PASS | phone touch screen: loads, draws, no scroll | pixel std 44.7, ~2161 colors; overflow [0, 0] |
| PASS | title screen shows the bot's best | set window.BOT_SCORES and the number did not appear |

## Bots

| Bot | Start | Mid | Best | Won? | Passes in this run |
| --- | --- | --- | --- | --- | --- |
| Evolution Bot | 591 | 591 | 591 | yes | 591 (won, 100%) |

- **Evolution Bot** replayed its saved best run (`bot-best-run.json`): it still wins exactly as before, so nothing was searched. Its earlier passes are in `bot-scores.json`.

## Fairness

| Result | Check | Detail |
| --- | --- | --- |
| PASS | standing still for 3 s is safe | lives lost in the first 3 s without touching anything: 0 |
| PASS | doing nothing does not win | after 30 s of standing still: playing, progress 5% |
| PASS | random button mashing does not win | 0/5 random runs won |
| PASS | game self-check | no problems |
| PASS | a human-speed bot can win | won with score 591, lives lost 0 |
| PASS | timing tolerance (40 ms nudges) | 43/46 nudged replays still did as well (93%); tight moments at 17.9s, 19.9s, 20.8s |

## Scoreboard

Bot to beat: **Evolution Bot with 591**

**Overall: PASS**
