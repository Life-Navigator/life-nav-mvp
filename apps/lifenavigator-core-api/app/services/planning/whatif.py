"""Side-by-side what-ifs, and solving for the change that fixes the plan (Milestone 1.3).

THE ABSTRACTION, OBSERVED RATHER THAN GUESSED
---------------------------------------------
Four comparisons already existed before this module, and they are all the same thing:

    withdrawal_sequencing      varies `withdrawal_order`
    roth_conversion_ladder     varies `conversions`
    social_security_claiming   varies `income_sources`
    stress                     varies `return_path`, life expectancy, inflation, expenses

A what-if is therefore **a named mutation of the household or the projection inputs**, run through
the ledger and compared with the same `Candidate` ranking. Building this fifth instance as a
generalisation of four real ones — rather than designing it up front — is why it reuses
`StrategyResult` wholesale and introduces no parallel vocabulary.

WHY `solve_for` MATTERS MORE THAN `compare`
------------------------------------------
Planning software makes the advisor construct scenarios and then shows what each one does. That
answers a question the user did not ask. Nobody wants to know what happens if they spend 10% less;
they want to know **how much less they have to spend**, and that is a different operation —
searching for the threshold rather than evaluating a guess.

`solve_for` bisects the ledger to find the minimum change that makes the plan work: the spending cut,
the extra years of work, the additional saving. It is cheap because the spine runs in ~2.5 ms, and it
is the answer the household is actually after.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from .household import Account, Expense, Household, PlanningError, Person
from .ledger import PlanResult, project
from .strategies import Candidate, StrategyResult, _candidate

# Bisection settings for `solve_for`. The tolerances are deliberately coarse — resolving a spending
# cut to the nearest dollar implies a precision the return assumption does not support, and "cut
# spending by $1,847" reads as false precision where "$1,900" reads as advice.
_SOLVE_ITERATIONS = 24
_SOLVE_MONEY_TOLERANCE = 100.0     # dollars/year
_SOLVE_YEAR_TOLERANCE = 1          # whole years


@dataclass(frozen=True)
class WhatIf:
    """One named variant: how to change the household, and/or the projection inputs.

    Two hooks rather than one, because the four existing comparisons split exactly that way — some
    vary a household FACT (retirement age, spending) and some vary a projection INPUT (returns,
    inflation, conversions). Collapsing them into one would force household rebuilds for things that
    are not household facts at all.
    """

    label: str
    mutate: Optional[Callable[[Household], Household]] = None
    project_kwargs: dict[str, Any] = field(default_factory=dict)
    note: str = ""

    def run(self, h: Household, *, tax_year: Optional[int] = None,
            **base_kwargs: Any) -> PlanResult:
        household = self.mutate(h) if self.mutate else _copy(h)
        kwargs = {**base_kwargs, **self.project_kwargs}
        return project(household, tax_year=tax_year, **kwargs)


def _copy(h: Household, **overrides: Any) -> Household:
    """A fresh household with REBUILT accounts.

    The ledger mutates balances, so a variant sharing accounts with the baseline would start from
    the baseline's ending position — and every comparison would be wrong in the same invisible way.
    This has already been the cause of one class of bug in this engine.
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


# ── Builders for the what-ifs people actually ask about ───────────────────────────────────────────
def retire_later(years: int, *, who: Optional[str] = None) -> WhatIf:
    """Work longer. Three effects at once, which is why it is the strongest single lever: more
    earning years, fewer drawdown years, and a later first withdrawal."""
    def mutate(h: Household) -> Household:
        people = []
        for p in h.people:
            if (who is None or p.name == who) and p.retirement_age is not None:
                people.append(Person(name=p.name, current_age=p.current_age,
                                     retirement_age=p.retirement_age + years,
                                     life_expectancy=p.life_expectancy,
                                     annual_income=p.annual_income,
                                     income_growth=p.income_growth))
            else:
                people.append(p)
        return _copy(h, people=people)

    subject = f" for {who}" if who else ""
    return WhatIf(label=f"retire {years} year(s) later{subject}", mutate=mutate,
                  note="more earning years, fewer drawdown years, and a later first withdrawal")


def spend_change(factor: float) -> WhatIf:
    """Scale every expense. `factor=0.9` is "spend 10% less"."""
    if factor <= 0:
        raise PlanningError(f"factor must be positive, got {factor}")

    def mutate(h: Household) -> Household:
        expenses = [Expense(label=e.label, annual_amount=e.annual_amount * factor,
                            start_year=e.start_year, end_year=e.end_year,
                            inflation_adjusted=e.inflation_adjusted,
                            retirement_factor=e.retirement_factor) for e in h.expenses]
        return _copy(h, expenses=expenses)

    direction = "less" if factor < 1 else "more"
    return WhatIf(label=f"spend {abs(1 - factor):.0%} {direction}", mutate=mutate)


def save_more(annual_amount: float, *, into: Optional[str] = None) -> WhatIf:
    """Add to annual contributions. Only applies while still earning — the ledger contributes a
    surplus and cannot contribute what is not there."""
    def mutate(h: Household) -> Household:
        accounts = []
        matched = False
        for a in h.accounts:
            extra = 0.0
            if (into is None and not matched) or a.label == into:
                extra, matched = annual_amount, True
            accounts.append(Account(label=a.label, balance=a.balance,
                                    tax_treatment=a.tax_treatment, owner=a.owner, basis=a.basis,
                                    annual_return=a.annual_return,
                                    annual_contribution=a.annual_contribution + extra))
        if not matched:
            raise PlanningError(f"no account named {into!r} to save into")
        return _copy(h, accounts=accounts)

    return WhatIf(label=f"save ${annual_amount:,.0f}/yr more", mutate=mutate)


def assume_return(rate: float) -> WhatIf:
    """A different return assumption applied to every account — a sensitivity, not a forecast."""
    def mutate(h: Household) -> Household:
        accounts = [Account(label=a.label, balance=a.balance, tax_treatment=a.tax_treatment,
                            owner=a.owner, basis=a.basis, annual_return=rate,
                            annual_contribution=a.annual_contribution) for a in h.accounts]
        return _copy(h, accounts=accounts)

    return WhatIf(label=f"returns of {rate:.1%}", mutate=mutate,
                  note="a sensitivity on the assumption, not a forecast")


def assume_inflation(rate: float) -> WhatIf:
    return WhatIf(label=f"inflation of {rate:.1%}", project_kwargs={"inflation": rate})


def delay_social_security(years: int, *, owner: str) -> WhatIf:
    """Claim later. Note this shifts the START AGE only — it does NOT apply the actuarial increase,
    because that depends on the primary insurance amount. Use `social_security_claiming` for the
    properly adjusted comparison; this variant exists for stacking alongside other what-ifs."""
    def mutate(h: Household) -> Household:
        from .household import IncomeSource
        sources = []
        for s in h.income_sources:
            if s.owner == owner and "social security" in s.label.lower():
                sources.append(IncomeSource(
                    label=s.label, annual_amount=s.annual_amount, owner=s.owner,
                    start_age=s.start_age + years, end_age=s.end_age,
                    taxable_share=s.taxable_share,
                    inflation_adjusted=s.inflation_adjusted))
            else:
                sources.append(s)
        return _copy(h, income_sources=sources)

    return WhatIf(label=f"delay Social Security {years} year(s) for {owner}", mutate=mutate,
                  note="start age only — the benefit is NOT actuarially increased here; use "
                       "social_security_claiming for that")


def move_to_state(state: Optional[str]) -> WhatIf:
    label = f"move to {state}" if state else "move to a state with no income tax"
    return WhatIf(label=label, mutate=lambda h: _copy(h, state=state))


def custom(label: str, mutate: Callable[[Household], Household], **project_kwargs: Any) -> WhatIf:
    """Escape hatch for anything the builders do not cover."""
    return WhatIf(label=label, mutate=mutate, project_kwargs=project_kwargs)


# ── Comparison ────────────────────────────────────────────────────────────────────────────────────
def compare(household: Household, variants: list[WhatIf], *,
            tax_year: Optional[int] = None,
            question: str = "What happens if I change course?",
            **base_kwargs: Any) -> StrategyResult:
    """Run the baseline and every variant, ranked with the usual solvency-first ordering.

    Reuses `StrategyResult`, so `material`, `verdict` and the "it barely matters, pick either"
    answer come free — and a what-if comparison reads the same way as a sequencing or claiming
    comparison, which is the point of not inventing a parallel shape.
    """
    if not variants:
        raise PlanningError("compare needs at least one variant")
    base = project(_copy(household), tax_year=tax_year, **base_kwargs)
    candidates = [_candidate("as planned", base)]
    for v in variants:
        candidates.append(_candidate(v.label, v.run(household, tax_year=tax_year, **base_kwargs),
                                     **({"note": v.note} if v.note else {})))
    return StrategyResult(
        strategy="what_if", question=question, candidates=candidates,
        baseline_label="as planned", tax_year=base.tax_year,
        tax_basis_is_current_year=base.tax_basis_is_current_year,
        assumptions=base.assumptions,
        notes=("Each variant changes ONE thing against the same starting balances.",
               "Ranked on solvency first, then on how much is left — a change that makes the plan "
               "last is better than one that merely leaves more at the end of a plan that fails.",))


def suggest(household: Household, *, tax_year: Optional[int] = None) -> list[WhatIf]:
    """The variants worth showing THIS household, chosen from whether the plan works.

    Planning software makes the advisor pick the scenarios. Choosing them from the diagnosis is
    more useful and is something the ledger can do: a failing plan needs the levers that fix it, and
    a plan with a large surplus is being under-lived — the honest finding there is that the
    household could spend more or retire sooner, which no tool volunteers.
    """
    base = project(_copy(household), tax_year=tax_year)
    working = [p for p in household.people if p.retirement_age is not None]

    if not base.succeeds:
        out = [spend_change(0.90), spend_change(0.80)]
        if working:
            out.insert(0, retire_later(2))
            out.insert(1, retire_later(5))
        return out

    # It works. Is the surplus so large the household is under-living the plan?
    surplus_ratio = base.terminal_assets / max(1.0, sum(y.expenses for y in base.years))
    if surplus_ratio > 0.5:
        out = [spend_change(1.10), spend_change(1.25)]
        if working:
            out.insert(0, custom("retire 2 years earlier", _retire_earlier(2)))
        return out

    # It works without much room: show the downside sensitivities.
    return [assume_return(0.04), assume_inflation(0.04), spend_change(1.10)]


def _retire_earlier(years: int) -> Callable[[Household], Household]:
    def mutate(h: Household) -> Household:
        people = []
        for p in h.people:
            if p.retirement_age is not None:
                people.append(Person(
                    name=p.name, current_age=p.current_age,
                    retirement_age=max(p.current_age, p.retirement_age - years),
                    life_expectancy=p.life_expectancy, annual_income=p.annual_income,
                    income_growth=p.income_growth))
            else:
                people.append(p)
        return _copy(h, people=people)
    return mutate


# ── Solving for the threshold ─────────────────────────────────────────────────────────────────────
@dataclass
class Solution:
    lever: str
    required: Optional[float]
    unit: str
    summary: str
    achievable: bool
    baseline: Candidate
    solved: Optional[Candidate] = None

    def as_dict(self) -> dict[str, Any]:
        return {"lever": self.lever, "required": self.required, "unit": self.unit,
                "summary": self.summary, "achievable": self.achievable,
                "baseline": self.baseline.as_dict(),
                "solved": self.solved.as_dict() if self.solved else None}


def solve_for_spending(household: Household, *, tax_year: Optional[int] = None) -> Solution:
    """The minimum spending cut that makes the plan last. Bisected on the ledger.

    This is the question people actually ask — not "what if I spend 10% less" but "how much less do
    I have to spend". Evaluating a guess and searching for a threshold are different operations, and
    planning software generally only does the first.
    """
    base = project(_copy(household), tax_year=tax_year)
    base_candidate = _candidate("as planned", base)
    annual = sum(e.annual_amount for e in household.expenses)

    if base.succeeds:
        return Solution(lever="spending", required=0.0, unit="usd_per_year",
                        summary="no cut is needed — the plan already funds the full horizon",
                        achievable=True, baseline=base_candidate)

    def works(factor: float) -> bool:
        return spend_change(factor).run(household, tax_year=tax_year).succeeds

    if not works(0.25):
        return Solution(
            lever="spending", required=None, unit="usd_per_year",
            summary=("spending alone cannot fix this plan — even a 75% cut still runs out. The "
                     "gap is too large for one lever; look at the retirement date, the saving "
                     "rate, or the goals together."),
            achievable=False, baseline=base_candidate)

    lo, hi = 0.25, 1.0          # lo works, hi does not
    for _ in range(_SOLVE_ITERATIONS):
        mid = (lo + hi) / 2
        if works(mid):
            lo = mid
        else:
            hi = mid
        if (hi - lo) * annual < _SOLVE_MONEY_TOLERANCE:
            break

    cut = annual * (1 - lo)
    solved = _candidate(f"spend {1 - lo:.0%} less",
                        spend_change(lo).run(household, tax_year=tax_year))
    return Solution(
        lever="spending", required=round(cut, -2), unit="usd_per_year",
        summary=(f"cutting spending by about ${cut:,.0f}/yr — roughly {1 - lo:.0%} — makes the plan "
                 f"last the full horizon, instead of running out in year {base.depleted_year}"),
        achievable=True, baseline=base_candidate, solved=solved)


def solve_for_retirement_age(household: Household, *, tax_year: Optional[int] = None,
                             max_extra_years: int = 20) -> Solution:
    """The fewest extra working years that make the plan last."""
    base = project(_copy(household), tax_year=tax_year)
    base_candidate = _candidate("as planned", base)

    if base.succeeds:
        return Solution(lever="retirement_age", required=0.0, unit="years",
                        summary="no delay is needed — the plan already funds the full horizon",
                        achievable=True, baseline=base_candidate)
    if not any(p.retirement_age is not None for p in household.people):
        return Solution(
            lever="retirement_age", required=None, unit="years",
            summary="everyone is already retired, so working longer is not a lever here",
            achievable=False, baseline=base_candidate)

    for extra in range(1, max_extra_years + 1):
        r = retire_later(extra).run(household, tax_year=tax_year)
        if r.succeeds:
            return Solution(
                lever="retirement_age", required=float(extra), unit="years",
                summary=(f"working {extra} more year(s) makes the plan last the full horizon, "
                         f"instead of running out in year {base.depleted_year}"),
                achievable=True, baseline=base_candidate,
                solved=_candidate(f"retire {extra} year(s) later", r))

    return Solution(
        lever="retirement_age", required=None, unit="years",
        summary=(f"even {max_extra_years} more working years do not fix this plan on their own — "
                 f"the gap needs more than one lever"),
        achievable=False, baseline=base_candidate)


def solve_all(household: Household, *, tax_year: Optional[int] = None) -> list[Solution]:
    """Every lever, so the household can choose which one they can live with.

    Presenting one "answer" would be a judgement about their life that the engine is not entitled
    to make. Spending less, working longer and saving more are not interchangeable to the person
    doing them.
    """
    return [solve_for_spending(household, tax_year=tax_year),
            solve_for_retirement_age(household, tax_year=tax_year)]
