"""Household inputs for the planning spine (Phase P).

HOUSEHOLD, NOT PERSON — AND WHY THAT IS A STRUCTURAL CHOICE
-----------------------------------------------------------
Everything built before this phase is single-person: one age, one income, one retirement date. That
cannot be retrofitted to a couple, because the things that matter most about a couple are
interactions, not sums — two retirement dates, two Social Security claiming decisions, a survivor
scenario, and a filing status that changes when one of them dies. Most clients of a planning tool
are couples, so single-person math is not a simplification, it is a different product.

ACCOUNTS CARRY A TAX TREATMENT, WHICH IS THE WHOLE POINT
--------------------------------------------------------
A balance is not a balance. $500,000 in a traditional 401(k), a Roth IRA and a taxable brokerage
account fund very different amounts of spending, and the ORDER they are drawn in changes the
lifetime tax bill substantially. Withdrawal sequencing is inexpressible unless the ledger knows
which bucket each dollar is in — which is why `tax_treatment` is required rather than optional.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

# Tax treatment of an account. These four behave differently on the way in, during growth, and on
# the way out — and the differences are what a planning engine exists to exploit.
TAXABLE = "taxable"              # basis tracked; growth taxed as realized; withdrawals partly gain
TAX_DEFERRED = "tax_deferred"    # deductible in, taxed as ordinary income out, RMDs apply
ROTH = "roth"                    # after tax in, tax-free out, no RMDs for the owner
HSA = "hsa"                      # the only triple-advantaged bucket: excluded in, tax-free out
TAX_TREATMENTS = (TAXABLE, TAX_DEFERRED, ROTH, HSA)

# Default drawdown order. Conventional wisdom, and deliberately a DEFAULT rather than a rule:
# optimizing the order is its own calculator, and for some households the conventional order is
# wrong (a large pre-tax balance left untouched until RMDs can force a higher bracket later than
# drawing some of it early would have).
DEFAULT_WITHDRAWAL_ORDER = (TAXABLE, TAX_DEFERRED, ROTH, HSA)

# Goal priority tiers, in the vocabulary planning software uses. The tiers matter because a plan
# that cannot fund everything must fail in a stated order rather than arbitrarily.
NEED = "need"
WANT = "want"
WISH = "wish"
PRIORITIES = (NEED, WANT, WISH)
_PRIORITY_RANK = {NEED: 0, WANT: 1, WISH: 2}


class PlanningError(ValueError):
    """Invalid household input. Raised, never defaulted — a planning projection built on an assumed
    age or an assumed filing status is a projection about somebody else."""


@dataclass(frozen=True)
class Person:
    """One member of the household."""

    name: str
    current_age: int
    retirement_age: Optional[int] = None
    life_expectancy: int = 95
    annual_income: float = 0.0
    income_growth: Optional[float] = None       # None -> registry salary_growth

    def __post_init__(self) -> None:
        if not self.name.strip():
            raise PlanningError("every person needs a name — the ledger reports per-person events")
        if not 0 < self.current_age < 120:
            raise PlanningError(f"{self.name}: current_age {self.current_age} is not plausible")
        if self.life_expectancy <= self.current_age:
            raise PlanningError(
                f"{self.name}: life_expectancy {self.life_expectancy} must exceed current_age "
                f"{self.current_age}")
        if self.retirement_age is not None and self.retirement_age < self.current_age:
            raise PlanningError(
                f"{self.name}: retirement_age {self.retirement_age} is already past — pass None for "
                f"someone already retired rather than a date behind them")
        if self.annual_income < 0:
            raise PlanningError(f"{self.name}: annual_income must not be negative")

    def age_in(self, year_offset: int) -> int:
        return self.current_age + year_offset

    def is_retired_in(self, year_offset: int) -> bool:
        if self.retirement_age is None:
            return True
        return self.age_in(year_offset) >= self.retirement_age

    def is_alive_in(self, year_offset: int) -> bool:
        return self.age_in(year_offset) <= self.life_expectancy


@dataclass
class Account:
    """An investment or savings account, with the tax treatment that decides how it is drawn."""

    label: str
    balance: float
    tax_treatment: str
    owner: Optional[str] = None            # person name; None = joint
    basis: Optional[float] = None          # taxable only; None -> assume basis == balance
    annual_return: Optional[float] = None  # None -> registry investment_return
    annual_contribution: float = 0.0

    def __post_init__(self) -> None:
        if self.tax_treatment not in TAX_TREATMENTS:
            raise PlanningError(
                f"{self.label}: tax_treatment must be one of {TAX_TREATMENTS}, got "
                f"{self.tax_treatment!r}. It cannot be defaulted — the treatment decides how much "
                f"spending the balance actually funds.")
        if self.balance < 0:
            raise PlanningError(f"{self.label}: balance must not be negative")
        if self.basis is not None and self.basis < 0:
            raise PlanningError(f"{self.label}: basis must not be negative")
        if self.tax_treatment == TAXABLE and self.basis is None:
            # Assuming basis == balance means assuming zero unrealized gain, which understates the
            # tax on a drawdown. Recorded as a default rather than silently applied.
            self.basis = self.balance

    @property
    def unrealized_gain(self) -> float:
        if self.tax_treatment != TAXABLE:
            return 0.0
        return max(0.0, self.balance - float(self.basis or 0.0))


@dataclass(frozen=True)
class IncomeSource:
    """Income that is not wages — Social Security, a pension, an annuity, rental income.

    `start_age` and `end_age` are per-PERSON ages rather than plan years, because that is how these
    decisions are actually made ("claim at 67", "the pension starts at 65").
    """

    label: str
    annual_amount: float
    owner: str
    start_age: int
    end_age: Optional[int] = None
    taxable_share: float = 1.0        # Social Security is partially taxable; a Roth annuity is not
    inflation_adjusted: bool = True

    def __post_init__(self) -> None:
        if self.annual_amount < 0:
            raise PlanningError(f"{self.label}: annual_amount must not be negative")
        if not 0.0 <= self.taxable_share <= 1.0:
            raise PlanningError(f"{self.label}: taxable_share must be between 0 and 1")
        if self.end_age is not None and self.end_age < self.start_age:
            raise PlanningError(f"{self.label}: end_age is before start_age")


@dataclass(frozen=True)
class Expense:
    """A recurring household expense, inflated annually unless told otherwise."""

    label: str
    annual_amount: float
    start_year: int = 0
    end_year: Optional[int] = None
    inflation_adjusted: bool = True
    # Spending usually falls at retirement; modelling it as flat overstates the required nest egg.
    retirement_factor: float = 1.0

    def __post_init__(self) -> None:
        if self.annual_amount < 0:
            raise PlanningError(f"{self.label}: annual_amount must not be negative")
        if self.end_year is not None and self.end_year < self.start_year:
            raise PlanningError(f"{self.label}: end_year is before start_year")


@dataclass(frozen=True)
class SpendItem:
    """One line inside a planned outlay — flights, the hotel, the venue, the caterer.

    WHY A GOAL IS DECOMPOSED RATHER THAN A SINGLE NUMBER. When a plan cannot fund something, "your
    $45,000 wedding is unfunded" is a dead end. "The venue is $22,000 of it" is a decision the
    household can act on, and it is the same computation — the breakdown is already how people hold
    the number in their heads, so throwing it away at the door makes the advice worse for no gain.

    `optional` marks a line the household would drop first. It lets the ledger answer "what fits"
    rather than only "does it fit", which is the difference between a plan that says no and a plan
    that says what to change.
    """

    label: str
    amount: float
    optional: bool = False

    def __post_init__(self) -> None:
        if not self.label.strip():
            raise PlanningError("every spend item needs a label — the breakdown is the point")
        if self.amount <= 0:
            raise PlanningError(f"{self.label}: amount must be greater than zero")


@dataclass(frozen=True)
class Goal:
    """A planned outlay — a house, a wedding, tuition, a sabbatical, a trip in March.

    PRIORITY IS LOAD-BEARING. When a plan cannot fund everything, it must fail in a stated order:
    needs before wants before wishes. A ledger that silently absorbs an unfundable goal into a
    negative balance is the single most misleading thing a planning engine can do, because the plan
    still looks complete.

    TIMING. `year` is a plan-year offset and `month` (1-12) is optional. The ledger steps ANNUALLY
    because tax is annual, so a month does NOT buy sub-year cash-flow precision — what it does is
    order competing outlays inside the same year (a January wedding is funded before a November
    trip, which is how the money would actually be spent) and carry the date through to the user.
    Pretending an annual ledger resolves months would be worse than being clear that it does not.

    COMPOSITION. Either give an `amount`, or give `items` and let it sum. Both must agree if both
    are supplied — a mismatch means the breakdown shown to the user does not add up to the figure
    the plan was built on, which is exactly the kind of quiet inconsistency that destroys trust in a
    plan document.
    """

    label: str
    amount: float = 0.0
    year: int = 0
    priority: str = WANT
    inflation_adjusted: bool = True
    month: Optional[int] = None
    items: tuple[SpendItem, ...] = ()
    note: str = ""

    def __post_init__(self) -> None:
        if self.priority not in PRIORITIES:
            raise PlanningError(
                f"{self.label}: priority must be one of {PRIORITIES}, got {self.priority!r}")
        if self.year < 0:
            raise PlanningError(f"{self.label}: year must be a non-negative plan-year offset")
        if self.month is not None and not 1 <= self.month <= 12:
            raise PlanningError(f"{self.label}: month must be 1-12, got {self.month}")

        if self.items:
            total = round(sum(i.amount for i in self.items), 2)
            if self.amount and round(self.amount, 2) != total:
                raise PlanningError(
                    f"{self.label}: amount ${self.amount:,.2f} does not match its items "
                    f"(${total:,.2f}). A breakdown that does not add up to the figure the plan was "
                    f"built on is the kind of inconsistency that destroys trust in a plan.")
            object.__setattr__(self, "amount", total)

        if self.amount <= 0:
            raise PlanningError(
                f"{self.label}: amount must be greater than zero (give `amount` or `items`)")

    @property
    def rank(self) -> int:
        return _PRIORITY_RANK[self.priority]

    @property
    def essential_amount(self) -> float:
        """The outlay with every `optional` line dropped.

        What "cut it back" costs — so an unfundable goal can be answered with "the trip fits at
        $6,200 without the business-class upgrade" instead of simply "no".
        """
        if not self.items:
            return self.amount
        return round(sum(i.amount for i in self.items if not i.optional), 2)

    @property
    def optional_amount(self) -> float:
        return round(self.amount - self.essential_amount, 2)

    @property
    def largest_item(self) -> Optional[SpendItem]:
        """The line to question first."""
        return max(self.items, key=lambda i: i.amount) if self.items else None

    @property
    def when(self) -> str:
        return f"year {self.year}" + (f", month {self.month}" if self.month else "")


@dataclass(frozen=True)
class Guardrail:
    """A spending RULE, not an instruction — the app never moves money (see the roadmap's
    read-only constraint).

    WHAT IT MODELS AND WHY IT MATTERS. A fixed-withdrawal projection assumes the household keeps
    spending the same amount through a 2008. Nobody does that. The realistic response to a bad
    market is to spend less for a couple of years, and a model that cannot express that
    SYSTEMATICALLY UNDERSTATES the plan — it reports a failure the household would have avoided by
    doing the obvious thing.

    Expressed as withdrawal-RATE triggers rather than portfolio-value triggers, deliberately. A
    dollar threshold goes stale the moment spending inflates or the horizon shortens; the rate
    (this year's spending over the current portfolio) stays comparable across the whole plan, which
    is why the Guyton-Klinger and Kitces formulations both use it.

    The OUTPUT is the pair of dollar thresholds for the user to recognise — "if the portfolio falls
    below $1.1M, cut spending about 8%" — which is advice they act on themselves.
    """

    upper_rate: float = 0.055      # withdrawal rate above which spending is cut
    lower_rate: float = 0.035      # rate below which spending may rise
    adjustment: float = 0.10       # proportional change applied when a rail is hit
    max_cut: float = 0.30          # never model a cut deeper than this
    max_raise: float = 0.20        # nor a rise larger

    def __post_init__(self) -> None:
        if not 0 < self.lower_rate < self.upper_rate:
            raise PlanningError(
                f"guardrail rates must satisfy 0 < lower ({self.lower_rate}) < upper "
                f"({self.upper_rate})")
        if not 0 < self.adjustment < 1:
            raise PlanningError(f"adjustment must be between 0 and 1, got {self.adjustment}")
        if not 0 <= self.max_cut < 1 or not 0 <= self.max_raise < 1:
            raise PlanningError("max_cut and max_raise must be between 0 and 1")

    def factor_for(self, withdrawal_rate: float, current_factor: float) -> tuple[float, str]:
        """The new spending factor, and why it changed.

        Clamped by `max_cut`/`max_raise` because an unbounded rule will happily model a household
        cutting spending 60% for a decade, which is not flexibility — it is a different life, and
        presenting it as a plan that "works" would be dishonest.
        """
        if withdrawal_rate > self.upper_rate:
            proposed = current_factor * (1 - self.adjustment)
            floor = 1 - self.max_cut
            if proposed < floor:
                return floor, "at the spending floor"
            return proposed, "cut: withdrawal rate above the upper rail"
        if withdrawal_rate < self.lower_rate:
            proposed = current_factor * (1 + self.adjustment)
            ceiling = 1 + self.max_raise
            if proposed > ceiling:
                return ceiling, "at the spending ceiling"
            return proposed, "raise: withdrawal rate below the lower rail"
        return current_factor, ""


@dataclass
class Household:
    """Everything the ledger projects."""

    people: list[Person]
    filing_status: str
    accounts: list[Account] = field(default_factory=list)
    income_sources: list[IncomeSource] = field(default_factory=list)
    expenses: list[Expense] = field(default_factory=list)
    goals: list[Goal] = field(default_factory=list)
    state: Optional[str] = None
    withdrawal_order: tuple[str, ...] = DEFAULT_WITHDRAWAL_ORDER

    def __post_init__(self) -> None:
        if not self.people:
            raise PlanningError("a household needs at least one person")
        if len(self.people) > 2:
            raise PlanningError(
                "the ledger models one or two adults; dependents are expenses and goals, not people")
        names = [p.name for p in self.people]
        if len(set(names)) != len(names):
            raise PlanningError(f"person names must be unique, got {names}")
        from ..calculators.tax import FILING_STATUSES
        if self.filing_status not in FILING_STATUSES:
            raise PlanningError(
                f"filing_status must be one of {FILING_STATUSES}, got {self.filing_status!r}. "
                f"It cannot be defaulted: `single` halves every bracket threshold and the standard "
                f"deduction, overstating a married household's lifetime tax by a wide margin.")
        if set(self.withdrawal_order) - set(TAX_TREATMENTS):
            raise PlanningError(
                f"withdrawal_order may only contain {TAX_TREATMENTS}, got {self.withdrawal_order}")
        for src in self.income_sources:
            if src.owner not in names:
                raise PlanningError(
                    f"{src.label}: owner {src.owner!r} is not in the household ({names})")
        for acct in self.accounts:
            if acct.owner is not None and acct.owner not in names:
                raise PlanningError(
                    f"{acct.label}: owner {acct.owner!r} is not in the household ({names})")

    @property
    def horizon_years(self) -> int:
        """Plan length: to the last survivor's life expectancy."""
        return max(p.life_expectancy - p.current_age for p in self.people)

    def person(self, name: str) -> Person:
        for p in self.people:
            if p.name == name:
                return p
        raise PlanningError(f"no person named {name!r}")

    def as_dict(self) -> dict[str, Any]:
        return {
            "people": [{"name": p.name, "current_age": p.current_age,
                        "retirement_age": p.retirement_age,
                        "life_expectancy": p.life_expectancy,
                        "annual_income": p.annual_income} for p in self.people],
            "filing_status": self.filing_status, "state": self.state,
            "accounts": [{"label": a.label, "balance": a.balance,
                          "tax_treatment": a.tax_treatment, "owner": a.owner} for a in self.accounts],
            "goals": [{"label": g.label, "amount": g.amount, "year": g.year,
                       "priority": g.priority} for g in self.goals],
            "horizon_years": self.horizon_years,
            "withdrawal_order": list(self.withdrawal_order),
        }
