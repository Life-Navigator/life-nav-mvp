"""Probability of success — Monte Carlo over the planning ledger (Milestone 1).

WHY THIS IS THE SIGNATURE OUTPUT
--------------------------------
"You will have $2.1M" and "there is an 82% chance of funding your goals" are not the same claim, and
only the second one is honest. A single deterministic projection is one draw from a distribution,
presented as a fact. It is also systematically optimistic for a household in drawdown, because the
average path hides the ones that fail early and never recover.

This is a WRAPPER, not new arithmetic. It re-runs `ledger.project()` with a sampled return sequence
and counts outcomes. All the hard work — annual tax from the Phase B engine, the withdrawal
gross-up, RMDs, goal priority, the widow's penalty — already happens inside each path.

SEQUENCE MATTERS, SO WE SAMPLE PER YEAR
---------------------------------------
Sampling one average return per path would measure almost nothing. The same set of annual returns in
a different ORDER produces a very different outcome for a household drawing down: a bad early year is
realised against a full balance and the portfolio never recovers. Measured on the ledger with
identical returns reordered, depletion moved from year 20 to year 11.

REPRODUCIBILITY IS A FEATURE, NOT A DETAIL
------------------------------------------
`seed` is required and defaults to a fixed value. A plan that reports 82% today and 79% tomorrow on
the same inputs is not trustworthy, and the user cannot tell the difference between "the market
assumption changed" and "you re-rolled the dice". The seed is reported in the result so any figure
can be reproduced exactly.

WHAT THE PROBABILITY IS NOT
---------------------------
It is not a measured frequency. It is a function of the assumed return distribution, and a different
volatility assumption produces a different number from the same portfolio. The result therefore
carries `mean_return`, `volatility` and their citations, and `probability_caveat` says so in words —
because a bare "82%" reads as empirical and is not.
"""
from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from typing import Any, Optional

from ..calculators.base import from_registry
from .household import Household, PlanningError
from .ledger import PlanResult, project

# Default path count. 500 is ~1.1s of CPU at the ledger's measured 2.2 ms/path, which is the most
# that fits a request on Fly's shared-cpu-1x without throttling. More paths narrow the confidence
# interval on the probability itself, not the spread of outcomes — at 500 the standard error on an
# 80% result is about 1.8 points, which is finer than the input assumptions justify.
DEFAULT_PATHS = 500
DEFAULT_SEED = 20261012

# Years treated as the "early" window for sequence-risk attribution. Retirement research puts the
# vulnerability in roughly the first decade of drawdown.
EARLY_WINDOW_YEARS = 10


@dataclass
class MonteCarloResult:
    paths: int
    seed: int
    success_probability: float
    not_depleted_probability: float
    goals_funded_probability: float
    terminal_assets_percentiles: dict[str, float]
    depletion_year_percentiles: dict[str, Optional[int]]
    assets_band_by_year: list[dict[str, float]]
    mean_return: float
    volatility: float
    assumptions: list[dict[str, Any]]
    tax_year: int
    tax_basis_is_current_year: bool
    tax_basis_label: str
    sequence_risk: dict[str, Any] = field(default_factory=dict)
    median_path: Optional[PlanResult] = None

    @property
    def probability_caveat(self) -> str:
        return (
            f"This is a modelled probability, not a measured one. It assumes a {self.mean_return:.1%} "
            f"average annual return with {self.volatility:.0%} volatility; a different assumption "
            f"produces a different number from the same portfolio. "
            f"{self.paths} simulated paths, seed {self.seed} — the same inputs always give the same "
            f"answer."
        )

    def as_dict(self) -> dict[str, Any]:
        return {
            "paths": self.paths, "seed": self.seed,
            "success_probability": round(self.success_probability, 4),
            "not_depleted_probability": round(self.not_depleted_probability, 4),
            "goals_funded_probability": round(self.goals_funded_probability, 4),
            "terminal_assets_percentiles": {k: round(v, 2)
                                            for k, v in self.terminal_assets_percentiles.items()},
            "depletion_year_percentiles": dict(self.depletion_year_percentiles),
            "assets_band_by_year": self.assets_band_by_year,
            "mean_return": self.mean_return, "volatility": self.volatility,
            "assumptions": self.assumptions,
            "tax_year": self.tax_year,
            "tax_basis_is_current_year": self.tax_basis_is_current_year,
            "tax_basis_label": self.tax_basis_label,
            "sequence_risk": self.sequence_risk,
            "probability_caveat": self.probability_caveat,
        }


def _lognormal_params(mean: float, volatility: float) -> tuple[float, float]:
    """Moment-match a lognormal to an arithmetic mean and standard deviation of simple returns.

    WHY LOGNORMAL AND NOT NORMAL. A normal draw can produce a return below -100%, which is a balance
    below zero — impossible, and it corrupts the tail the simulation exists to measure. Sampling
    `1 + r = exp(N(mu, sigma))` keeps every path above -100% while preserving the stated mean and
    volatility, so the result is comparable to the deterministic projection rather than quietly on
    a different footing.
    """
    if volatility <= 0:
        return math.log1p(mean), 0.0
    sigma_sq = math.log(1.0 + (volatility ** 2) / ((1.0 + mean) ** 2))
    mu = math.log1p(mean) - sigma_sq / 2.0
    return mu, math.sqrt(sigma_sq)


def _percentile(sorted_values: list[float], q: float) -> float:
    """Linear-interpolated percentile. `sorted_values` must be sorted ascending."""
    if not sorted_values:
        return 0.0
    if len(sorted_values) == 1:
        return sorted_values[0]
    pos = q * (len(sorted_values) - 1)
    lo = int(math.floor(pos))
    hi = min(lo + 1, len(sorted_values) - 1)
    frac = pos - lo
    return sorted_values[lo] * (1.0 - frac) + sorted_values[hi] * frac


def simulate(household: Household, *, paths: int = DEFAULT_PATHS, seed: int = DEFAULT_SEED,
             tax_year: Optional[int] = None, horizon_years: Optional[int] = None,
             mean_return: Optional[float] = None,
             volatility: Optional[float] = None,
             inflation: Optional[float] = None) -> MonteCarloResult:
    """Run `paths` sampled projections and summarise the distribution of outcomes."""
    if paths < 1:
        raise PlanningError(f"paths must be at least 1, got {paths}")
    if paths > 10_000:
        # CPU-bound at ~2.2 ms/path; beyond this it belongs in a background job, and the extra
        # precision is far below what the input assumptions support.
        raise PlanningError(
            f"paths={paths} exceeds the in-request ceiling of 10,000 — run it as a background job")

    cited: list[dict[str, Any]] = []
    if mean_return is None:
        mean_return, a = from_registry("investment_return")
        cited.append(a.as_dict())
    if volatility is None:
        volatility, a = from_registry("return_volatility")
        cited.append(a.as_dict())

    horizon = int(horizon_years) if horizon_years else household.horizon_years
    mu, sigma = _lognormal_params(float(mean_return), float(volatility))
    rng = random.Random(seed)

    results: list[PlanResult] = []
    early_returns: list[float] = []
    for _ in range(paths):
        draws = [math.exp(rng.gauss(mu, sigma)) - 1.0 for _ in range(horizon)]
        r = project(household, tax_year=tax_year, horizon_years=horizon,
                    inflation=inflation, return_path=draws)
        results.append(r)
        window = draws[:min(EARLY_WINDOW_YEARS, len(draws))]
        early_returns.append(sum(window) / len(window) if window else 0.0)

    successes = [r.succeeds for r in results]
    not_depleted = [r.depleted_year is None for r in results]
    goals_funded = [not r.unfunded_goals for r in results]

    terminals = sorted(r.terminal_assets for r in results)
    depletions = sorted(r.depleted_year for r in results if r.depleted_year is not None)

    # Per-year percentile band — the chart planning software is bought for.
    band: list[dict[str, float]] = []
    for t in range(horizon):
        year_assets = sorted(r.years[t].total_assets for r in results if t < len(r.years))
        if not year_assets:
            break
        band.append({"year": t,
                     "p10": round(_percentile(year_assets, 0.10), 2),
                     "p50": round(_percentile(year_assets, 0.50), 2),
                     "p90": round(_percentile(year_assets, 0.90), 2)})

    first = results[0]
    return MonteCarloResult(
        paths=paths, seed=seed,
        success_probability=sum(successes) / paths,
        not_depleted_probability=sum(not_depleted) / paths,
        goals_funded_probability=sum(goals_funded) / paths,
        terminal_assets_percentiles={
            "p10": _percentile(terminals, 0.10), "p25": _percentile(terminals, 0.25),
            "p50": _percentile(terminals, 0.50), "p75": _percentile(terminals, 0.75),
            "p90": _percentile(terminals, 0.90),
        },
        depletion_year_percentiles={
            "earliest": depletions[0] if depletions else None,
            "p10": int(_percentile([float(d) for d in depletions], 0.10)) if depletions else None,
            "p50": int(_percentile([float(d) for d in depletions], 0.50)) if depletions else None,
            "paths_depleting": len(depletions),
        },
        assets_band_by_year=band,
        mean_return=float(mean_return), volatility=float(volatility),
        assumptions=cited + [a for a in first.assumptions if a not in cited],
        tax_year=first.tax_year,
        tax_basis_is_current_year=first.tax_basis_is_current_year,
        tax_basis_label=first.tax_basis_label,
        sequence_risk=_sequence_risk(successes, early_returns, mean_return),
        median_path=None,
    )


def _sequence_risk(successes: list[bool], early_returns: list[float],
                   mean_return: float) -> dict[str, Any]:
    """Do the failing paths differ from the succeeding ones in their EARLY returns?

    THIS IS THE OUTPUT A BARE PROBABILITY CANNOT GIVE. "82%" tells a user where they stand and
    nothing about what to do. If the failures cluster in paths with poor returns in the first decade,
    the plan is not underfunded — it is exposed to sequence risk, and the remedies are specific and
    different: hold more cash entering retirement, keep spending flexible in the early years, delay
    the first withdrawal, or glide the allocation down before the date rather than after it.

    Reported only when there is something to report: with no failures, or no successes, the
    comparison is undefined and saying so beats inventing a driver.
    """
    failed = [r for r, ok in zip(early_returns, successes) if not ok]
    worked = [r for r, ok in zip(early_returns, successes) if ok]
    if not failed or not worked:
        return {
            "measurable": False,
            "reason": ("every path succeeded" if not failed else "every path failed")
            + " — there is no contrast to attribute, so no driver is claimed",
        }
    avg_failed = sum(failed) / len(failed)
    avg_worked = sum(worked) / len(worked)
    gap = avg_worked - avg_failed
    return {
        "measurable": True,
        "early_window_years": EARLY_WINDOW_YEARS,
        "avg_early_return_when_plan_failed": round(avg_failed, 4),
        "avg_early_return_when_plan_worked": round(avg_worked, 4),
        "gap": round(gap, 4),
        # A material gap means the FIRST DECADE decided the outcome, not the long-run average.
        "driven_by_early_returns": gap > 0.01,
        "interpretation": (
            f"Failures cluster in paths with weak early returns: {avg_failed:.1%} average over the "
            f"first {EARLY_WINDOW_YEARS} years versus {avg_worked:.1%} in the paths that worked, "
            f"against a {mean_return:.1%} assumption. The first decade decides this plan, so the "
            f"useful levers are early-years flexibility — a cash buffer, adjustable early spending, "
            f"or a later first withdrawal — not a higher long-run return."
            if gap > 0.01 else
            f"Early returns do not separate the failing paths from the successful ones "
            f"({avg_failed:.1%} vs {avg_worked:.1%}). The outcome turns on the long-run average or "
            f"on spending rather than on sequence, so a cash buffer would not move it much."
        ),
    }
