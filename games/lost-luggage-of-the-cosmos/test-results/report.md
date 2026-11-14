# Test report: Lost Luggage of the Cosmos

Run at 2026-11-14 18:12:13 · seed 1

## Smoke tests

| Result | Check | Detail |
| --- | --- | --- |
| PASS | BOT-SCORES markers in file | add the markers from spec section 8 |
| PASS | loads without console errors |  |
| PASS | window.GAME_TEST_HOOK exists |  |
| PASS | hook.version is 1 | version=1 |
| PASS | required hook methods exist |  |
| PASS | info.spec is 1 | spec=1 |
| PASS | info.title present | 'Lost Luggage of the Cosmos' |
| PASS | info.stepsPerSecond present | 120 |
| PASS | info.levelCount present | 3 |
| PASS | info.maxSteps present | 28800 |
| PASS | info.actions present | [{'id': 'idle', 'desc': 'Do nothing'}, {'id': 'right', 'desc': 'Walk right'}, {' |
| PASS | info.keys present | {'right': ['ArrowRight'], 'left': ['ArrowLeft'], 'jump': ['Space']} |
| PASS | 3 to 10 actions | 6 actions |
| PASS | first action is 'idle' | first=['idle'] |
| PASS | every action has a desc |  |
| PASS | action ids are unique |  |
| PASS | every action maps to real keys |  |
| PASS | smokeAction is a real action | smokeAction=right |
| PASS | after reset: state has all fields |  |
| PASS | after reset: status is valid | status=playing |
| PASS | after reset: progress in 0..1 | progress=0 |
| PASS | reset gives score 0, steps 0 | score=0 steps=0 |
| PASS | bot mode freezes the game clock | game moved by itself during bot mode |
| PASS | step('idle', 10) advances exactly 10 steps | steps=10 |
| PASS | after step: state has all fields |  |
| PASS | after step: status is valid | status=playing |
| PASS | after step: progress in 0..1 | progress=0 |
| PASS | unknown action is rejected |  |
| PASS | observe() gives text | 528 chars |
| PASS | same seed + same inputs = same run | run A 100/0.055 vs B 100/0.055 |
| PASS | full-length run simulates in < 5 s | 0.07 s for 28800 steps |
| PASS | real keyboard works (right) | idle player {'x': 2.15, 'y': 12.099, 'vx': 0, 'vy': 0, 'onGround': True, 'gravity': 'normal', 'fizzyJet': 'none'} vs keys {'x': 9.282, 'y': 12.099, 'vx': 5.7, 'vy': 0, 'onGround': True, 'gravity': 'normal', 'fizzyJet': 'none'} |
| PASS | game screen is drawn (not blank) | pixel std 32.6, ~638 colors |
| PASS | no console errors while playing |  |
| PASS | title screen shows the bot's best | set window.BOT_SCORES and the number did not appear |

## Bots

| Bot | Start | Mid | Best | Won? | Passes |
| --- | --- | --- | --- | --- | --- |
| Evolution Bot | 760 | 1165 | 1375 | yes | 760 (stopped, 59%), 1165 (stopped, 88%), 1375 (won, 100%) |


## Fairness

| Result | Check | Detail |
| --- | --- | --- |
| PASS | standing still for 3 s is safe | lives lost in the first 3 s without touching anything: 0 |
| PASS | doing nothing does not win | after 30 s of standing still: playing, progress 0% |
| PASS | random button mashing does not win | 0/5 random runs won |
| PASS | game self-check | no problems |
| PASS | a human-speed bot can win | won with score 1375, lives lost 0 |
| PASS | timing tolerance (40 ms nudges) | 33/47 nudged replays still did as well (70%); tight moments at 6.1s, 26.1s, 38.1s, 38.1s, 39.1s, 39.1s |

## Scoreboard

Bot to beat: **Evolution Bot with 1375**

**Overall: PASS**
