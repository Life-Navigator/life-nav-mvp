"""Stress tests — the named scenarios behind the probability (Milestone 1.2).

WHY THESE EXIST ALONGSIDE MONTE CARLO
-------------------------------------
Monte Carlo answers "how likely is this to work" with a single number. A stress test answers "what
happens if THIS happens" with a scenario the household can picture. Both are needed and they are not
substitutes:

  "82% chance of success"            -> tells you where you stand, not what to fear
  "a 2008 in your first year costs
   you nine years of solvency"       -> tells you exactly what to protect against

A probability also hides WHICH failures are in the 18%. A stress test names them, and the named ones
are the ones people act on — a cash buffer gets funded because of the second sentence, not the first.

EACH TEST IS ONE LEDGER RE-RUN WITH ONE INPUT CHANGED
-----------------------------------------------------
No new machinery: `return_path` (built for Monte Carlo), a shorter or longer life expectancy, a
higher inflation rate, a removed person, an added expense. That is why this is small, and it is the
payoff for having built the spine first.

THE SHAPE IS DELIBERATELY THE SAME AS `strategies`
--------------------------------------------------
A stress test is a what-if with an adverse variant, so it reuses `Candidate` and the solvency-first
ranking rather than inventing a parallel vocabulary. `strategies.py` now has four instances of the
same comparison — sequencing, conversions, claiming, and these — which is what makes a generic
what-if engine (1.3) a generalisation rather than a guess.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from .household import Account, Expense, Household, PlanningError, Person
from .ledger import PlanResult, project
from .strategies import Candidate, _candidate

# A crash of this depth in the first year of drawdown. Chosen to be recognisable rather than
# arbitrary: the S&P 500's 2008 total return was about -37%.
CRASH_RETURN = -0.37
# Years of weak returns for the "lost decade" test — roughly 2000-2009 for US equities.
LOST_DECADE_RETURN = 0.0
LOST_DECADE_YEARS = 10
# An inflation shock. US CPI ran near 8% in 2022.
INFLATION_SHOCK = 0.08
INFLATION_SHOCK_YEARS = 5
# A long-term-care event: duration and annual cost are the two numbers that matter, and both are
# supplied rather than assumed, because they vary by an order of magnitude by region and care level.
DEFAULT_LTC_YEARS = 3


@dataclass
class StressResult:
    baseline: Candidate
    scenarios: list[Candidate] = field(default_factory=list)
    tax_year: int = 0
    tax_basis_is_current_year: bool = True
    assumptions: list[dict[str, Any]] = field(default_factory=list)

    @property
    def worst(self) -> Candidate:
        """The scenario that hurts most, by the same solvency-first ordering strategies uses."""
        return min(self.scenarios, key=lambda c: c.sort_key) if self.scenarios else self.baseline

    @property
    def survives_all(self) -> bool:
        return all(c.depleted_year is None and not c.detail.get("unfunded") for c in self.scenarios)

    def cost_of(self, label: str) -> dict[str, Any]:
        """What one scenario costs, expressed in the terms the household feels.

        Years of solvency first, because "you run out nine years sooner" lands and "$340,000 less
        terminal wealth" does not — and for a plan that already depletes, terminal wealth is $0 in
        both cases and says nothing at all.
        """
        c = next(s for s in self.scenarios if s.label == label)
        years = None
        if c.depleted_year is not None and self.baseline.depleted_year is not None:
            years = self.baseline.depleted_year - c.depleted_year
        elif c.depleted_year is not None and self.baseline.depleted_year is None:
            years = None   # went from surviving to failing; `broke_the_plan` says so
        broke = c.depleted_year is not None and self.baseline.depleted_year is None
        lost_assets = self.baseline.terminal_assets - c.terminal_assets
        extra_unfunded = c.total_shortfall - self.baseline.total_shortfall

        # The headline, in the terms the household feels. Ordered by what matters: breaking the plan
        # beats losing years, which beats losing terminal wealth. Reporting "$1.49M of terminal
        # assets lost" for a scenario that ENDS the plan is technically true and useless — the
        # terminal value is zero because the money ran out, which is the actual finding.
        if broke:
            summary = (f"breaks the plan — it survives the full horizon today, but runs out in "
                       f"year {c.depleted_year} under this scenario"
                       + (f", leaving ${extra_unfunded:,.0f} of spending unfunded"
                          if extra_unfunded > 1 else ""))
        elif years:
            summary = (f"costs {years} year(s) of solvency — the money runs out in year "
                       f"{c.depleted_year} instead of year {self.baseline.depleted_year}")
        elif c.depleted_year is not None and extra_unfunded > 1:
            summary = (f"the plan already runs out in year {c.depleted_year}; this scenario adds "
                       f"${extra_unfunded:,.0f} of unfunded spending")
        elif lost_assets > 1:
            summary = (f"survivable — the plan still funds the full horizon, with "
                       f"${lost_assets:,.0f} less at the end")
        else:
            summary = "no material effect on this plan"

        return {
            "scenario": label,
            "summary": summary,
            "broke_the_plan": broke,
            "survivable": c.depleted_year is None,
            "years_of_solvency_lost": years,
            "depleted_year": c.depleted_year,
            "baseline_depleted_year": self.baseline.depleted_year,
            "terminal_assets_lost": round(lost_assets, 2),
            "extra_unfunded_spending": round(extra_unfunded, 2),
        }

    def as_dict(self) -> dict[str, Any]:
        return {
            "baseline": self.baseline.as_dict(),
            "scenarios": [c.as_dict() for c in self.scenarios],
            "worst": self.worst.label if self.scenarios else None,
            "survives_all": self.survives_all,
            "costs": [self.cost_of(c.label) for c in self.scenarios],
            "tax_year": self.tax_year,
            "tax_basis_is_current_year": self.tax_basis_is_current_year,
            "assumptions": self.assumptions,
        }


def _copy(h: Household, **overrides: Any) -> Household:
    """A fresh household with rebuilt accounts.

    The ledger MUTATES balances, so a stress test sharing accounts with the baseline would start
    from the baseline's ENDING position and every scenario would be wrong in the same invisible way.
    """
    fields = dict(
        people=list(h.people), filing_status=h.filing_status,
        accounts=[Account(label=a.label, balance=a.balance, tax_treatment=a.tax_treatment,
                          owner=a.owner, basis=a.basis, annual_return=a.annual_return,
                          annual_contribution=a.annual_contribution) for a in h.accounts],
        income_sources=list(h.income_sources), expenses=list(h.expenses), goals=list(h.goals),
        state=h.state, withdrawal_order=h.withdrawal_order)
    fields.update(overrides)
    return Household(**fields)


# ── The scenarios ─────────────────────────────────────────────────────────────────────────────────
def crash_at_retirement(h: Household, *, depth: float = CRASH_RETURN,
                        tax_year: Optional[int] = None, **kw: Any) -> PlanResult:
    """A market crash in year one — the single most damaging thing that can happen to a drawdown.

    SEQUENCE RISK AT ITS SHARPEST. The same crash ten years later is survivable; in the first year it
    is realised against a full balance, the withdrawal that year sells into it, and the portfolio
    never recovers the compounding it lost. This is the scenario that justifies a cash buffer, and a
    probability alone never makes that case.
    """
    horizon = kw.pop("horizon_years", None) or h.horizon_years
    from ..calculators.base import from_registry
    normal, _ = from_registry("investment_return")
    path = [depth] + [normal] * (horizon - 1)
    return project(_copy(h), tax_year=tax_year, horizon_years=horizon, return_path=path, **kw)


def lost_decade(h: Household, *, years: int = LOST_DECADE_YEARS,
                flat_return: float = LOST_DECADE_RETURN,
                tax_year: Optional[int] = None, **kw: Any) -> PlanResult:
    """A decade of flat returns from the start. Less dramatic than a crash and often worse, because
    there is no recovery to average against — withdrawals grind the balance down for ten years."""
    horizon = kw.pop("horizon_years", None) or h.horizon_years
    from ..calculators.base import from_registry
    normal, _ = from_registry("investment_return")
    path = [flat_return] * min(years, horizon) + [normal] * max(0, horizon - years)
    return project(_copy(h), tax_year=tax_year, horizon_years=horizon, return_path=path, **kw)


def longevity(h: Household, *, extra_years: int = 5,
              tax_year: Optional[int] = None, **kw: Any) -> PlanResult:
    """Living longer than planned. The risk nobody wants to call a risk, and the one that turns an
    adequate plan into an inadequate one without anything going wrong."""
    people = [Person(name=p.name, current_age=p.current_age,
                     retirement_age=p.retirement_age,
                     life_expectancy=p.life_expectancy + extra_years,
                     annual_income=p.annual_income, income_growth=p.income_growth)
              for p in h.people]
    return project(_copy(h, people=people), tax_year=tax_year, **kw)


def inflation_shock(h: Household, *, rate: float = INFLATION_SHOCK,
                    tax_year: Optional[int] = None, **kw: Any) -> PlanResult:
    """Sustained high inflation. Hits a retiree twice: spending rises every year, and the tax
    brackets the plan is built on were set in an earlier year's dollars."""
    return project(_copy(h), tax_year=tax_year, inflation=rate, **kw)


def early_death_of_spouse(h: Household, *, who: Optional[str] = None,
                          tax_year: Optional[int] = None, **kw: Any) -> PlanResult:
    """One spouse dies early. Models the real consequence rather than just the lost income: the
    survivor's filing status changes to single, which the ledger already handles as the widow's
    penalty — roughly half the bracket widths on similar income, for every remaining year."""
    if len(h.people) < 2:
        raise PlanningError(
            "early_death_of_spouse needs a two-person household; for one person the scenario is "
            "the end of the plan, not a stress on it")
    target = who or h.people[0].name
    people = []
    for p in h.people:
        if p.name == target:
            # Life expectancy just past the current age: alive for year 0, gone from year 1.
            people.append(Person(name=p.name, current_age=p.current_age,
                                 retirement_age=p.retirement_age,
                                 life_expectancy=p.current_age + 1,
                                 annual_income=p.annual_income, income_growth=p.income_growth))
        else:
            people.append(p)
    return project(_copy(h, people=people), tax_year=tax_year, **kw)


def long_term_care(h: Household, *, annual_cost: float, years: int = DEFAULT_LTC_YEARS,
                   start_year: Optional[int] = None,
                   tax_year: Optional[int] = None, **kw: Any) -> PlanResult:
    """A long-term-care event late in the plan.

    `annual_cost` is REQUIRED, not defaulted. Care costs vary by an order of magnitude between
    in-home help and a skilled nursing facility, and between regions — a default would be a
    fabricated figure driving the most alarming number in the report.
    """
    if annual_cost <= 0:
        raise PlanningError("long_term_care needs an annual_cost — it cannot be assumed")
    horizon = h.horizon_years
    start = start_year if start_year is not None else max(0, horizon - years - 1)
    expenses = list(h.expenses) + [Expense(
        label="Long-term care", annual_amount=annual_cost,
        start_year=start, end_year=start + years - 1)]
    return project(_copy(h, expenses=expenses), tax_year=tax_year, **kw)


# Registry of the scenarios that need no extra inputs, so `run_all` can be a one-liner.
STANDARD_SCENARIOS: dict[str, Callable[..., PlanResult]] = {
    "market crash in year one": crash_at_retirement,
    "a lost decade of flat returns": lost_decade,
    "living 5 years longer than planned": longevity,
    "sustained 8% inflation": inflation_shock,
}


def run_all(h: Household, *, tax_year: Optional[int] = None,
            ltc_annual_cost: Optional[float] = None) -> StressResult:
    """Every applicable scenario against the baseline.

    Scenarios that need an input the household has not supplied are SKIPPED rather than defaulted —
    long-term care without a cost, spousal death in a one-person household. A fabricated input
    would produce the most alarming figure in the report from a number nobody chose.
    """
    base = project(_copy(h), tax_year=tax_year)
    scenarios: list[Candidate] = []

    for label, fn in STANDARD_SCENARIOS.items():
        scenarios.append(_candidate(label, fn(h, tax_year=tax_year)))

    if len(h.people) > 1:
        scenarios.append(_candidate(
            f"{h.people[0].name} dies early",
            early_death_of_spouse(h, tax_year=tax_year)))

    if ltc_annual_cost:
        scenarios.append(_candidate(
            f"{DEFAULT_LTC_YEARS} years of long-term care at ${ltc_annual_cost:,.0f}/yr",
            long_term_care(h, annual_cost=ltc_annual_cost, tax_year=tax_year)))

    return StressResult(
        baseline=_candidate("baseline", base), scenarios=scenarios,
        tax_year=base.tax_year,
        tax_basis_is_current_year=base.tax_basis_is_current_year,
        assumptions=base.assumptions)
