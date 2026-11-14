"""Bot v1: the cheap evolutionary bot.

It knows nothing about the game except the action list. A run is a "genome": a list of
(action, hold-for-N-steps) segments replayed from the same seed, so the same genome always
gives the same run. Each pass it:

  1. replays its best run so far,
  2. cuts it a little before the point where it died or got stuck,
  3. tries new random moves from there (biased toward moves that worked before),
  4. keeps whichever version gets further / scores more.

Holds are never shorter than ~150 ms of game time, roughly how fast a person can change input,
so whatever it finds is something a quick human could also do.
"""
from __future__ import annotations

import random
import time
from collections import Counter

from .browser import GameSession


def fitness(r: dict, info: dict) -> float:
    f = 10000.0 * r["progress"] + r["score"]
    if r["status"] == "won":
        f += 5000 + 0.01 * (info["maxSteps"] - r["steps"])
    return f


def steps_of(genome) -> int:
    return sum(f for _, f in genome)


def truncate(genome, at_step: int):
    out, t = [], 0
    for a, f in genome:
        if t >= at_step:
            break
        take = min(f, at_step - t)
        if take > 0:
            out.append([a, take])
        t += take
    return out


class EvolutionaryBot:
    name = "evolutionary"

    def __init__(self, session: GameSession, info: dict, seed: int = 1, rollouts_per_pass: int = 250,
                 rng_seed: int = 12345, log=print):
        self.g, self.info, self.seed = session, info, seed
        self.R = rollouts_per_pass
        self.rng = random.Random(rng_seed)
        self.log = log
        sps = info["stepsPerSecond"]
        self.min_hold = max(1, round(0.15 * sps))   # ~150 ms: human-speed input changes
        self.max_hold = max(self.min_hold + 1, round(0.9 * sps))
        self.tail = round(2.0 * sps)                 # explore ~2 s of new moves at a time
        self.stall = round(4.0 * sps)                # no progress for 4 s = stuck
        self.n_actions = len(info["actions"])
        self.elite: list[tuple[float, list, dict]] = []   # (fitness, genome, search result)
        self.stuck = 0

    # --- search ---------------------------------------------------------
    def _search_eval(self, genome):
        return self.g.rollout(genome, seed=self.seed, stop_on_life_lost=True, stall_steps=self.stall)

    def _full_eval(self, genome):
        """The real run: normal lives, used for the reported score."""
        return self.g.rollout(genome, seed=self.seed, stop_on_life_lost=False, stall_steps=self.info["maxSteps"])

    def _rand_segment(self, bias: Counter):
        if bias and self.rng.random() < 0.5:
            acts, w = zip(*bias.items())
            a = self.rng.choices(acts, weights=w)[0]
        else:
            a = self.rng.randrange(self.n_actions)
        return [a, self.rng.randint(self.min_hold, self.max_hold)]

    def _mutate(self, genome, result):
        bias = Counter()
        for a, f in genome:
            bias[a] += f
        g = [list(s) for s in genome]
        if not g or self.rng.random() < 0.75:
            # tail mutation: back up from where it failed and try something new
            fail = result.get("failStep") or steps_of(g)
            backoff = self.rng.randint(0, round(self.info["stepsPerSecond"] * (0.5 + 0.5 * min(self.stuck, 8))))
            g = truncate(g, max(0, fail - backoff))
            while steps_of(g) < (fail - backoff) + self.tail:
                g.append(self._rand_segment(bias))
        else:
            # point mutation in the last part of the run
            lo = int(len(g) * 0.6)
            for _ in range(self.rng.randint(1, 3)):
                i = self.rng.randrange(lo, len(g))
                if self.rng.random() < 0.5:
                    g[i][0] = self._rand_segment(bias)[0]
                else:
                    g[i][1] = max(self.min_hold, min(self.max_hold, g[i][1] + self.rng.randint(-12, 12)))
        return g

    def _consider(self, genome, r):
        f = fitness(r, self.info)
        improved = not self.elite or f > self.elite[0][0] + 1e-6
        self.elite.append((f, genome, r))
        self.elite.sort(key=lambda e: -e[0])
        self.elite = self.elite[:6]
        return improved

    def run(self, passes: int = 3, extra_passes_for_win: int = 0) -> dict:
        if not self.elite:
            g0 = [self._rand_segment(Counter()) for _ in range(6)]
            self._consider(g0, self._search_eval(g0))
        pass_results = []
        t0 = time.time()
        p = 0
        while p < passes or (p < passes + extra_passes_for_win and not any(r["status"] == "won" for r in pass_results)):
            for _ in range(self.R):
                parent = self.elite[0] if self.rng.random() < 0.7 else self.rng.choice(self.elite)
                child = self._mutate(parent[1], parent[2])
                r = self._search_eval(child)
                if self._consider(child, r):
                    self.stuck = 0
                else:
                    self.stuck += 1
            best_f, best_g, _ = self.elite[0]
            full = self._full_eval(best_g)
            status = "stopped" if full["status"] == "playing" else full["status"]
            pass_results.append({"pass": p + 1, "score": full["score"], "status": status, "progress": round(full["progress"], 4),
                                 "livesLost": full["livesLost"], "steps": full["steps"], "fitness": round(best_f, 1)})
            self.log(f"  evolutionary pass {p + 1}{'' if p < passes else ' (extra, looking for a win)'}: score {full['score']}, {status}, "
                     f"progress {full['progress']:.0%}, lives lost {full['livesLost']} ({time.time() - t0:.0f}s)")
            p += 1
        best_genome = self.elite[0][1]
        return {"bot": self.name, "passes": pass_results, "best_genome": best_genome,
                "won": any(r["status"] == "won" for r in pass_results),
                "settings": {"rollouts_per_pass": self.R, "min_hold_steps": self.min_hold, "seed": self.seed}}
