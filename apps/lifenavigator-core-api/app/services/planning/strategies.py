"""Phase F strategies — READOUTS of the ledger, not new formulas (Milestone 2).

WHY THESE ARE NOT CALCULATORS
-----------------------------
"Should I draw from the IRA or the brokerage first?", "how much should I convert to Roth?" and
"when should I claim Social Security?" have no closed form. Each is a question about a WHOLE
LIFETIME: the answer depends on this year's bracket, next decade's RMDs, the survivor's narrower
brackets after one spouse dies, and how the three interact. A formula cannot express that.

So each strategy here runs the ledger several times — once per candidate — and compares the
outcomes. That is why Phase P had to come first, and why these cost almost nothing to add now: the
annual tax, the gross-up, RMDs, goal priority and the widow's penalty already happen inside every
run.

WHAT THEY REPORT, AND WHY IT IS NOT JUST A WINNER
-------------------------------------------------
Each returns the full ranking plus the MARGIN. A winner alone is a false precision: these
projections rest on a return assumption and a life expectancy, and a $2,000 lifetime difference
between two withdrawal orders is noise dressed as a decision. `material` says whether the gap is
large enough to act on, so the advisor can say "it barely matters, pick either" — which is often the
true and useful answer, and one no planning tool volunteers.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

from ..calculators import tax as tax_calc
from .household import (
    HSA,
    ROTH,
    TAXABLE,
    TAX_DEFERRED,
    Household,
    IncomeSource,
    PlanningError,
)
from .ledger import PlanResult, project

# A lifetime difference below this is noise against the return and longevity assumptions, not a
# decision. Expressed as a share of the baseline rather than a dollar figure so it scales with the
# household — $5,000 matters to a $400k plan and is invisible in a $10M one.
MATERIAL_SHARE = 0.01


@dataclass
class Candidate:
    label: str
    lifetime_tax: float
    terminal_assets: float
    depleted_year: Optional[int]
    succeeds: bool
    # Total spending the plan could not fund across the whole horizon. The ONLY thing that separates
    # two failing candidates that run out in the same year — and failing households are the ones
    # that need the advice most.
    total_shortfall: float = 0.0
    detail: dict[str, Any] = field(default_factory=dict)

    @property
    def score(self) -> float:
        """Terminal assets — the honest single number when the plan survives, because it absorbs
        both the tax saved and the growth forgone by paying it earlier."""
        return self.terminal_assets

    @property
    def sort_key(self) -> tuple:
        """Ranking, which CANNOT be terminal assets alone.

        THE BUG THIS FIXES: when every candidate depletes, terminal assets is $0 for all of them,
        so the comparison collapses and the strategy reported "$0 margin — either is defensible"
        for options that differed by years of solvency. For an underfunded household — exactly the
        one that needs the advice most — the whole readout was useless.

        So: surviving beats depleting; among depleting candidates, LASTING LONGER is better; and
        only then does terminal value decide. Lifetime tax breaks the final tie, lower being better.
        """
        return (self.depleted_year is None,
                self.depleted_year if self.depleted_year is not None else 0,
                -self.total_shortfall,     # less unfunded spending is better
                self.terminal_assets,
                -self.lifetime_tax)

    def as_dict(self) -> dict[str, Any]:
        return {"label": self.label, "lifetime_tax": round(self.lifetime_tax, 2),
                "terminal_assets": round(self.terminal_assets, 2),
                "depleted_year": self.depleted_year, "succeeds": self.succeeds,
                "total_shortfall": round(self.total_shortfall, 2),
                **({"detail": self.detail} if self.detail else {})}


@dataclass
class StrategyResult:
    strategy: str
    question: str
    candidates: list[Candidate]
    baseline_label: str
    tax_year: int
    tax_basis_is_current_year: bool
    assumptions: list[dict[str, Any]] = field(default_factory=list)
    notes: tuple[str, ...] = ()

    @property
    def ranked(self) -> list[Candidate]:
        return sorted(self.candidates, key=lambda c: c.sort_key, reverse=True)

    @property
    def best(self) -> Candidate:
        return self.ranked[0]

    @property
    def baseline(self) -> Candidate:
        return next(c for c in self.candidates if c.label == self.baseline_label)

    @property
    def margin(self) -> float:
        """Advantage of the best candidate over the baseline, in terminal assets."""
        return self.best.score - self.baseline.score

    @property
    def years_of_solvency_gained(self) -> Optional[int]:
        """Extra years before the money runs out. The only meaningful margin when both deplete —
        and the figure the household actually cares about."""
        if self.best.depleted_year is None and self.baseline.depleted_year is None:
            return None
        if self.best.depleted_year is None:
            return None            # the best candidate survives; `verdict` says so instead
        if self.baseline.depleted_year is None:
            return None
        return self.best.depleted_year - self.baseline.depleted_year

    @property
    def material(self) -> bool:
        # Surviving when the baseline does not is always material, whatever the dollar margin.
        if (self.best.depleted_year is None) != (self.baseline.depleted_year is None):
            return True
        gained = self.years_of_solvency_gained
        if gained:
            return abs(gained) >= 1
        # Same depletion year: severity decides.
        if self.best.depleted_year is not None:
            base_short = abs(self.baseline.total_shortfall) or 1.0
            return abs(self.baseline.total_shortfall - self.best.total_shortfall) / base_short \
                >= MATERIAL_SHARE
        base = abs(self.baseline.score) or 1.0
        return abs(self.margin) / base >= MATERIAL_SHARE

    @property
    def verdict(self) -> str:
        if self.best.label == self.baseline_label:
            return f"The default ({self.baseline_label}) is already the best of the options tested."
        # Solvency first: for a plan that runs out, "lasts four years longer" is the whole answer and
        # a dollar margin of $0 says nothing.
        if self.baseline.depleted_year is not None and self.best.depleted_year is None:
            return (f"{self.best.label} makes the plan last the full horizon, where "
                    f"{self.baseline_label} runs out in year {self.baseline.depleted_year}.")
        gained = self.years_of_solvency_gained
        if gained:
            return (f"{self.best.label} pushes the money running out from year "
                    f"{self.baseline.depleted_year} to year {self.best.depleted_year} — "
                    f"{gained} more year(s) of solvency. Neither option funds the whole plan.")
        # Same year, different severity: the gap in unfunded spending is the real comparison.
        gap = self.baseline.total_shortfall - self.best.total_shortfall
        if self.best.depleted_year is not None and abs(gap) > 1.0:
            return (f"Neither option funds the whole plan — both run out in year "
                    f"{self.best.depleted_year} — but {self.best.label} leaves "
                    f"${self.best.total_shortfall:,.0f} of spending unfunded against "
                    f"${self.baseline.total_shortfall:,.0f} for {self.baseline_label}, "
                    f"${abs(gap):,.0f} less.")
        if not self.material:
            return (f"{self.best.label} edges out {self.baseline_label} by only "
                    f"${self.margin:,.0f} over the whole plan — inside the noise of the return and "
                    f"longevity assumptions. Either is defensible; pick on other grounds.")
        return (f"{self.best.label} beats {self.baseline_label} by ${self.margin:,.0f} in assets at "
                f"the end of the plan, and ${self.baseline.lifetime_tax - self.best.lifetime_tax:,.0f} "
                f"in lifetime tax.")

    def as_dict(self) -> dict[str, Any]:
        return {"strategy": self.strategy, "question": self.question,
                "ranked": [c.as_dict() for c in self.ranked],
                "baseline": self.baseline_label,
                "margin": round(self.margin, 2), "material": self.material,
                "verdict": self.verdict,
                "tax_year": self.tax_year,
                "tax_basis_is_current_year": self.tax_basis_is_current_year,
                "assumptions": self.assumptions, "notes": list(self.notes)}


def _candidate(label: str, r: PlanResult, **detail: Any) -> Candidate:
    return Candidate(label=label, lifetime_tax=r.lifetime_tax, terminal_assets=r.terminal_assets,
                     depleted_year=r.depleted_year, succeeds=r.succeeds,
                     total_shortfall=sum(y.shortfall for y in r.years), detail=detail)


# ── 2.1 Withdrawal sequencing ─────────────────────────────────────────────────────────────────────
_ORDERS: dict[str, tuple[str, ...]] = {
    "taxable first (conventional)": (TAXABLE, TAX_DEFERRED, ROTH, HSA),
    "tax-deferred first": (TAX_DEFERRED, TAXABLE, ROTH, HSA),
    "Roth first": (ROTH, TAXABLE, TAX_DEFERRED, HSA),
    "tax-deferred before Roth, taxable last": (TAX_DEFERRED, ROTH, TAXABLE, HSA),
}


def withdrawal_sequencing(household: Household, *, tax_year: Optional[int] = None,
                          orders: Optional[dict[str, tuple[str, ...]]] = None) -> StrategyResult:
    """Which account to draw from first, measured rather than assumed.

    THE CONVENTIONAL ORDER IS NOT ALWAYS RIGHT, which is the whole reason to measure. "Taxable,
    then tax-deferred, then Roth" defers tax longest — and that is exactly how a large pre-tax
    balance survives untouched into the RMD years, where it is forced out at a HIGHER rate than the
    household was ever in while working, and then taxed again in the survivor's narrower single
    brackets. Drawing some pre-tax early, deliberately, can cost less over a lifetime.

    The ledger already models every piece of that interaction, so this is four runs and a sort.
    """
    candidates = [
        _candidate(label,
                   project(_with_order(household, order), tax_year=tax_year),
                   order=list(order))
        for label, order in (orders or _ORDERS).items()
    ]
    first = project(household, tax_year=tax_year)
    return StrategyResult(
        strategy="withdrawal_sequencing",
        question="Which accounts should I draw from first?",
        candidates=candidates,
        baseline_label="taxable first (conventional)",
        tax_year=first.tax_year,
        tax_basis_is_current_year=first.tax_basis_is_current_year,
        assumptions=first.assumptions,
        notes=("Ranked on assets at the end of the plan, which absorbs both the tax saved and the "
               "growth forgone by paying tax earlier.",
               "Ignores two real constraints: a Roth's value to heirs (it passes tax-free, so "
               "spending it last has a benefit this plan does not score) and the 10% penalty on "
               "pre-59.5 tax-deferred withdrawals.",),
    )


def _with_order(h: Household, order: tuple[str, ...]) -> Household:
    """A copy of the household with a different withdrawal order. Accounts are rebuilt because the
    ledger mutates balances — sharing them between runs would make each candidate start from the
    previous one's ending position."""
    from .household import Account
    return Household(
        people=list(h.people), filing_status=h.filing_status,
        accounts=[Account(label=a.label, balance=a.balance, tax_treatment=a.tax_treatment,
                          owner=a.owner, basis=a.basis, annual_return=a.annual_return,
                          annual_contribution=a.annual_contribution) for a in h.accounts],
        income_sources=list(h.income_sources), expenses=list(h.expenses), goals=list(h.goals),
        state=h.state, withdrawal_order=order)


# ── 2.2 Roth conversion ladder ────────────────────────────────────────────────────────────────────
def roth_conversion_ladder(household: Household, *, tax_year: Optional[int] = None,
                           ceiling_rates: tuple[float, ...] = (0.12, 0.22, 0.24),
                           start_year: int = 0,
                           years: Optional[int] = None) -> StrategyResult:
    """How much to convert each year, filling brackets to a chosen ceiling.

    THE TRADE: pay tax now at a known rate to remove the balance from future RMDs, from the
    survivor's narrower single brackets, and from the heirs' 10-year distribution window. The
    question is never "should I convert" but "up to which bracket", and that is what is compared
    here — one ledger run per ceiling.

    The conversion window defaults to the years between now and RMDs, because that is the gap the
    strategy exploits: wages have stopped, RMDs have not started, and the brackets are at their
    emptiest. Converting while still working usually just stacks income on top of a salary.
    """
    first = project(household, tax_year=tax_year)
    window = int(years) if years else _default_window(household, tax_year)
    if window <= 0:
        raise PlanningError(
            "no conversion window: RMDs have already begun or are about to, so there are no years "
            "with empty brackets to fill. Converting now would stack on top of a forced "
            "distribution.")

    candidates = [_candidate("no conversions", first, converted_total=0.0)]
    for ceiling in ceiling_rates:
        plan = _ladder_for(household, ceiling, start_year, window, tax_year)
        r = project(_with_order(household, household.withdrawal_order),
                    tax_year=tax_year, conversions=plan)
        candidates.append(_candidate(
            f"fill the {ceiling:.0%} bracket",
            r,
            converted_total=round(sum(plan.values()), 2),
            per_year={str(k): round(v, 2) for k, v in sorted(plan.items())},
            window_years=window))

    return StrategyResult(
        strategy="roth_conversion_ladder",
        question="How much should I convert to Roth, and up to which bracket?",
        candidates=candidates, baseline_label="no conversions",
        tax_year=first.tax_year,
        tax_basis_is_current_year=first.tax_basis_is_current_year,
        assumptions=first.assumptions,
        notes=(f"Conversions are planned for the {window} year(s) before RMDs begin — the window "
               f"where wages have stopped and forced distributions have not started.",
               "Each conversion is ordinary income in its year; the ledger pays that tax from the "
               "plan, so the cost is already reflected in the ranking.",
               "Not modelled: the 5-year rule on each conversion's earnings, IRMAA Medicare "
               "surcharges triggered by the spike in income, and state tax on the conversion.",),
    )


def _default_window(h: Household, tax_year: Optional[int]) -> int:
    """Years until the first RMD — the gap the ladder exploits."""
    from ..calculators import versioned_data as V
    rmd_age = int(V.load("tax_parameters", tax_year).data["retirement"]["rmd_age"])
    return max(0, min(rmd_age - p.current_age for p in h.people))


def _ladder_for(h: Household, ceiling: float, start: int, window: int,
                tax_year: Optional[int]) -> dict[int, float]:
    """Conversion amounts that fill each year's brackets up to `ceiling`.

    Computed from a BASELINE run, so each year's headroom is measured against the income that year
    would have had anyway — wages, Social Security, the RMD. Using a flat estimate instead would
    overshoot in high-income years (pushing the household into a higher bracket than intended, the
    exact mistake the strategy is meant to avoid) and undershoot in the empty ones.
    """
    base = project(h, tax_year=tax_year)
    deferred = sum(a.balance for a in h.accounts if a.tax_treatment == TAX_DEFERRED)
    plan: dict[int, float] = {}
    remaining = deferred
    for t in range(start, min(start + window, len(base.years))):
        if remaining <= 0:
            break
        y = base.years[t]
        income = y.wage_income + y.taxable_other_income + y.rmd
        try:
            room = tax_calc.bracket_headroom(
                ordinary_income=income, filing_status=y.filing_status or h.filing_status,
                ceiling_rate=ceiling, tax_year=tax_year).value
        except Exception:  # noqa: BLE001 — an unusable year contributes nothing rather than failing
            continue
        amount = min(room, remaining)
        if amount > 0:
            plan[t] = amount
            remaining -= amount
    return plan


# ── 2.3 Social Security claiming ──────────────────────────────────────────────────────────────────
# Statutory, in the benefit formula rather than in any indexed table:
#   early  — 5/9 of 1% per month for the first 36 months before FRA, 5/12 of 1% per month beyond
#   late   — 2/3 of 1% per month from FRA to 70 (the delayed retirement credit)
# At 62 against an FRA of 67 that is a 30% reduction; at 70, a 24% increase.
FULL_RETIREMENT_AGE = 67        # born 1960 or later
EARLIEST_CLAIM_AGE = 62
LATEST_CREDIT_AGE = 70


def claiming_factor(claim_age: float, *, fra: int = FULL_RETIREMENT_AGE) -> float:
    """Share of the primary insurance amount payable at `claim_age`."""
    if claim_age < EARLIEST_CLAIM_AGE:
        raise PlanningError(f"Social Security cannot be claimed before {EARLIEST_CLAIM_AGE}")
    capped = min(claim_age, LATEST_CREDIT_AGE)   # no further credit accrues after 70
    months = round((capped - fra) * 12)
    if months >= 0:
        return 1.0 + months * (2.0 / 3.0) / 100.0
    early = -months
    first = min(early, 36)
    beyond = max(0, early - 36)
    return 1.0 - (first * (5.0 / 9.0) + beyond * (5.0 / 12.0)) / 100.0


def social_security_claiming(household: Household, *, owner: str, primary_insurance_amount: float,
                             tax_year: Optional[int] = None,
                             claim_ages: tuple[int, ...] = (62, 67, 70)) -> StrategyResult:
    """When to claim, with the benefit actuarially adjusted for each age.

    THE ADJUSTMENT IS THE POINT. Comparing claiming ages at the SAME benefit is meaningless —
    claiming at 62 pays 70% of the full amount for life, and at 70 it pays 124%. The break-even is
    usually in the early eighties, so the honest answer turns on longevity and on what else the
    household is drawing in the meantime: claiming later means spending more portfolio first, which
    this ledger charges properly, including the tax on those withdrawals.
    """
    person = household.person(owner)
    if primary_insurance_amount <= 0:
        raise PlanningError("primary_insurance_amount must be greater than zero")

    candidates = []
    for age in claim_ages:
        factor = claiming_factor(age)
        benefit = primary_insurance_amount * factor
        h = _with_order(household, household.withdrawal_order)
        h.income_sources = [s for s in h.income_sources
                            if not (s.owner == owner and "social security" in s.label.lower())]
        h.income_sources.append(IncomeSource(
            label="Social Security", annual_amount=benefit, owner=owner,
            start_age=age, taxable_share=0.85))
        r = project(h, tax_year=tax_year)
        candidates.append(_candidate(
            f"claim at {age}", r,
            annual_benefit=round(benefit, 2),
            pct_of_full=round(factor, 4),
            lifetime_benefit_if_alive_to_le=round(
                benefit * max(0, person.life_expectancy - age), 2)))

    first = project(household, tax_year=tax_year)
    return StrategyResult(
        strategy="social_security_claiming",
        question=f"When should {owner} claim Social Security?",
        candidates=candidates,
        baseline_label=f"claim at {FULL_RETIREMENT_AGE}",
        tax_year=first.tax_year,
        tax_basis_is_current_year=first.tax_basis_is_current_year,
        assumptions=first.assumptions,
        notes=(f"Benefits are actuarially adjusted: {claiming_factor(62):.0%} of the full amount at "
               f"62, {claiming_factor(70):.0%} at 70. Comparing ages at the same benefit would be "
               f"meaningless.",
               f"The answer depends heavily on living to {person.life_expectancy} — the break-even "
               f"between early and late claiming usually falls in the early eighties.",
               "85% of the benefit is treated as taxable, which is the maximum; for lower-income "
               "households less is taxable and this overstates the tax.",
               "Not modelled: spousal and survivor benefits, the earnings test before FRA, and "
               "IRMAA surcharges.",),
    )


# ── 2.5 Spending guardrails ───────────────────────────────────────────────────────────────────────
@dataclass
class GuardrailResult:
    """What flexibility is worth, and what it costs."""

    fixed_success: float
    flexible_success: float
    paths: int
    lower_threshold: float
    upper_threshold: float
    planned_spending: float
    worst_cut_modelled: float
    years_below_plan_p50: int
    years_below_plan_worst: int
    rule: dict[str, Any]
    tax_year: int
    assumptions: list[dict[str, Any]] = field(default_factory=list)

    @property
    def improvement(self) -> float:
        return self.flexible_success - self.fixed_success

    @property
    def summary(self) -> str:
        return (
            f"A fixed-spending plan succeeds {self.fixed_success:.0%} of the time. Being willing to "
            f"adjust takes that to {self.flexible_success:.0%}. "
            f"The rule: if the portfolio falls below about ${self.lower_threshold:,.0f}, cut "
            f"spending roughly {self.rule['adjustment']:.0%}; above about "
            f"${self.upper_threshold:,.0f} you could raise it."
        )

    @property
    def honest_cost(self) -> str:
        """WHAT THE SUCCESS NUMBER HIDES.

        Reporting "flexibility takes you from 68% to 91%" without saying what the flexible paths
        actually felt like would oversell it badly. In the worst paths the rule demands living on a
        materially smaller budget for years, and a household entitled to the upside number is
        entitled to that one too.
        """
        if self.worst_cut_modelled <= 0.001:
            return "No path required a cut — the flexibility was never called on."
        return (
            f"That improvement is not free. In the worst simulated paths the rule asks for a "
            f"{self.worst_cut_modelled:.0%} cut, and spending sits below plan for "
            f"{self.years_below_plan_worst} years (median {self.years_below_plan_p50}). "
            f"Flexibility is only worth modelling if the household would actually accept that."
        )

    def as_dict(self) -> dict[str, Any]:
        return {"fixed_success": round(self.fixed_success, 4),
                "flexible_success": round(self.flexible_success, 4),
                "improvement": round(self.improvement, 4), "paths": self.paths,
                "lower_threshold": round(self.lower_threshold, 2),
                "upper_threshold": round(self.upper_threshold, 2),
                "planned_spending": round(self.planned_spending, 2),
                "worst_cut_modelled": round(self.worst_cut_modelled, 4),
                "years_below_plan_p50": self.years_below_plan_p50,
                "years_below_plan_worst": self.years_below_plan_worst,
                "rule": self.rule, "summary": self.summary, "honest_cost": self.honest_cost,
                "tax_year": self.tax_year, "assumptions": self.assumptions}


def spending_guardrails(household: Household, *, tax_year: Optional[int] = None,
                        guardrail: Optional[Any] = None,
                        paths: int = 300, seed: int = 20261012) -> GuardrailResult:
    """How much is a willingness to adjust spending worth?

    MEASURED UNDER MONTE CARLO, because that is the only place flexibility shows up. On a single
    deterministic path a guardrail either fires or it does not, and the answer is an artefact of one
    return sequence. The value of flexibility IS its effect on the distribution — it converts some
    of the failing paths into surviving ones — so the comparison has to be a probability.

    Reports the rule in DOLLARS as well as rates, because "cut spending when the withdrawal rate
    exceeds 5.5%" is not something a household can act on, while "if the portfolio drops below
    $1.1M, cut about 10%" is. The app never moves money; this is a rule the user chooses to follow.
    """
    import math
    import random

    from ..calculators.base import from_registry
    from .household import Guardrail
    from .monte_carlo import _lognormal_params

    rail = guardrail or Guardrail()
    planned = sum(e.annual_amount for e in household.expenses)
    if planned <= 0:
        raise PlanningError("spending_guardrails needs at least one expense to adjust")

    mean, mean_cited = from_registry("investment_return")
    vol, vol_cited = from_registry("return_volatility")
    mu, sigma = _lognormal_params(mean, vol)
    horizon = household.horizon_years
    rng = random.Random(seed)

    fixed_ok = flex_ok = 0
    worst_cut = 0.0
    years_below: list[int] = []

    for _ in range(paths):
        draws = [math.exp(rng.gauss(mu, sigma)) - 1.0 for _ in range(horizon)]
        if project(_with_order(household, household.withdrawal_order),
                   tax_year=tax_year, return_path=draws).succeeds:
            fixed_ok += 1
        flexible = project(_with_order(household, household.withdrawal_order),
                           tax_year=tax_year, return_path=draws, guardrail=rail)
        if flexible.succeeds:
            flex_ok += 1
        factors = [y.spending_factor for y in flexible.years]
        if factors:
            worst_cut = max(worst_cut, 1 - min(factors))
            years_below.append(sum(1 for f in factors if f < 0.999))

    years_below.sort()
    median = years_below[len(years_below) // 2] if years_below else 0

    return GuardrailResult(
        fixed_success=fixed_ok / paths, flexible_success=flex_ok / paths, paths=paths,
        # Thresholds restated in today's dollars against the planned spend — the actionable form.
        lower_threshold=planned / rail.upper_rate,
        upper_threshold=planned / rail.lower_rate,
        planned_spending=planned,
        worst_cut_modelled=worst_cut,
        years_below_plan_p50=median,
        years_below_plan_worst=max(years_below) if years_below else 0,
        rule={"upper_rate": rail.upper_rate, "lower_rate": rail.lower_rate,
              "adjustment": rail.adjustment, "max_cut": rail.max_cut,
              "max_raise": rail.max_raise},
        tax_year=project(_with_order(household, household.withdrawal_order),
                         tax_year=tax_year).tax_year,
        assumptions=[mean_cited.as_dict(), vol_cited.as_dict()],
    )


# ── 2.3 Spousal and survivor Social Security ──────────────────────────────────────────────────────
# Statutory, verified against SSA sources 2026-10-12:
#
#   OWN benefit      early: 5/9 of 1%/month for 36 months, then 5/12 of 1%/month
#                    late:  2/3 of 1%/month to 70 (delayed retirement credits)
#   SPOUSAL benefit  up to 50% of the worker's PIA at the SPOUSE's FRA
#                    early: 25/36 of 1%/month for 36 months, then 5/12 of 1%/month
#                    -> 32.5% of PIA at 62 against an FRA of 67 (a 35% reduction from the 50%)
#                    NO delayed retirement credits — waiting past FRA adds nothing
#   SURVIVOR benefit up to 100% of what the deceased was receiving (or their PIA, plus any DRCs
#                    they earned), claimable from 60, maximum reduction 28.5%
#                    -> 71.5% at 60 against an FRA of 67
#
# THE ASYMMETRY IS THE WHOLE PLANNING POINT. A spousal benefit earns NO credit for waiting, but a
# survivor benefit INHERITS the credits the deceased earned. So the higher earner delaying to 70 is
# not just a bet on their own longevity — it permanently raises the income of whichever spouse lives
# longer. That is survivor insurance, and it compounds with the widow's penalty the ledger already
# models: the survivor files single, on narrower brackets, for every remaining year.

SPOUSAL_MAX_SHARE = 0.50
SURVIVOR_MAX_REDUCTION = 0.285
SURVIVOR_EARLIEST_AGE = 60


def spousal_factor(claim_age: float, *, fra: int = FULL_RETIREMENT_AGE) -> float:
    """Share of the WORKER's PIA payable as a spousal benefit at `claim_age`.

    Caps at 50% — the one place where "wait longer" is simply wrong advice, because unlike an own
    benefit a spousal benefit earns no delayed retirement credits. A tool that applied the own-
    benefit uplift here would tell a spouse to wait past their FRA for nothing.
    """
    if claim_age < EARLIEST_CLAIM_AGE:
        raise PlanningError(f"a spousal benefit cannot start before {EARLIEST_CLAIM_AGE}")
    months_early = max(0, round((fra - claim_age) * 12))
    if months_early == 0:
        return SPOUSAL_MAX_SHARE
    first = min(months_early, 36)
    beyond = max(0, months_early - 36)
    reduction = (first * (25.0 / 36.0) + beyond * (5.0 / 12.0)) / 100.0
    return SPOUSAL_MAX_SHARE * (1.0 - reduction)


def survivor_factor(claim_age: float, *, fra: int = FULL_RETIREMENT_AGE) -> float:
    """Share of the DECEASED's benefit payable to a surviving spouse at `claim_age`.

    The maximum reduction is fixed at 28.5% regardless of the FRA, so the per-month rate is derived
    from the window rather than hardcoded — that is how the statute keeps the 28.5% constant as the
    FRA moves.
    """
    if claim_age < SURVIVOR_EARLIEST_AGE:
        raise PlanningError(
            f"a survivor benefit cannot start before {SURVIVOR_EARLIEST_AGE}")
    if claim_age >= fra:
        return 1.0
    window_months = (fra - SURVIVOR_EARLIEST_AGE) * 12
    months_early = round((fra - claim_age) * 12)
    return 1.0 - SURVIVOR_MAX_REDUCTION * (months_early / window_months)


def effective_spouse_benefit(*, own_pia: float, worker_pia: float, claim_age: float,
                             fra: int = FULL_RETIREMENT_AGE) -> dict[str, Any]:
    """What the lower earner actually receives: the GREATER of their own benefit or the spousal one.

    NOT the sum. Social Security pays the higher of the two, which people routinely misunderstand as
    stacking — and the misunderstanding inflates a household's expected income by thousands a year.
    """
    own = own_pia * claiming_factor(claim_age, fra=fra)
    spousal = worker_pia * spousal_factor(claim_age, fra=fra)
    return {
        "own_benefit": round(own, 2),
        "spousal_benefit": round(spousal, 2),
        "received": round(max(own, spousal), 2),
        "basis": "own record" if own >= spousal else "spousal top-up",
        "top_up": round(max(0.0, spousal - own), 2),
        "note": ("Social Security pays the HIGHER of the two, not the sum — a spousal benefit tops "
                 "an own benefit up to the spousal amount, it does not add to it."),
    }


def household_claiming(household: Household, *, pias: dict[str, float],
                       tax_year: Optional[int] = None,
                       claim_ages: tuple[int, ...] = (62, 67, 70)) -> StrategyResult:
    """Compare claiming-age PAIRS for a couple, with the spousal top-up and the survivor step-up.

    WHY PAIRS AND NOT TWO SEPARATE DECISIONS. The two claims interact three ways, and optimising
    them independently gets all three wrong:

      * the lower earner's benefit may be a spousal top-up off the HIGHER earner's PIA;
      * whoever survives steps up to the larger of the two benefits for life, INHERITING any delayed
        credits the deceased earned; and
      * when one dies the survivor files single, so the same income is taxed on narrower brackets —
        which the ledger already models as the widow's penalty.

    The practical consequence, and the thing this function exists to show: **delaying the HIGHER
    earner's claim is survivor insurance.** It raises the floor under whichever spouse lives longer,
    and it is usually worth more than optimising the lower earner's date.

    `pias` maps each person's name to their primary insurance amount — the benefit at their own FRA,
    which is what an SSA statement reports. Required, never estimated: a household's claiming answer
    turns entirely on the relative size of the two records.
    """
    if len(household.people) != 2:
        raise PlanningError(
            "household_claiming compares a COUPLE's two claims; use social_security_claiming for "
            "one person")
    names = [p.name for p in household.people]
    missing = [n for n in names if n not in pias or pias[n] < 0]
    if missing:
        raise PlanningError(
            f"a primary insurance amount is required for {missing} — the answer turns entirely on "
            f"the relative size of the two records, so it cannot be estimated")

    higher = max(names, key=lambda n: pias[n])
    lower = next(n for n in names if n != higher)

    candidates: list[Candidate] = []
    for age_hi in claim_ages:
        for age_lo in claim_ages:
            h = _with_order(household, household.withdrawal_order)
            h.income_sources = [s for s in h.income_sources
                                if "social security" not in s.label.lower()]

            hi_benefit = pias[higher] * claiming_factor(age_hi)
            lo = effective_spouse_benefit(own_pia=pias[lower], worker_pia=pias[higher],
                                          claim_age=age_lo)
            h.income_sources.append(IncomeSource(
                label="Social Security", annual_amount=hi_benefit, owner=higher,
                start_age=age_hi, taxable_share=0.85))
            # A SPOUSAL TOP-UP CANNOT BE PAID BEFORE THE WORKER FILES. The lower earner may claim
            # their own record at 62, but the top-up to half the worker's PIA only begins once the
            # higher earner has actually claimed. Modelling the top-up from the lower earner's own
            # claim date pays it years early and makes "she claims early, he delays" look free.
            lower_person = next(p for p in household.people if p.name == lower)
            higher_person = next(p for p in household.people if p.name == higher)
            lower_age_at_hi_claim = lower_person.current_age + (age_hi - higher_person.current_age)
            top_up_from = max(age_lo, lower_age_at_hi_claim)
            lo_own = pias[lower] * claiming_factor(age_lo) if pias[lower] > 0 else 0.0

            if lo["top_up"] > 0 and top_up_from > age_lo:
                # Own record first, then the topped-up amount once the worker has filed.
                if lo_own > 0:
                    h.income_sources.append(IncomeSource(
                        label="Social Security", annual_amount=lo_own, owner=lower,
                        start_age=age_lo, end_age=top_up_from - 1, taxable_share=0.85))
                h.income_sources.append(IncomeSource(
                    label="Social Security", annual_amount=lo["received"], owner=lower,
                    start_age=top_up_from, taxable_share=0.85))
            else:
                h.income_sources.append(IncomeSource(
                    label="Social Security", annual_amount=lo["received"], owner=lower,
                    start_age=age_lo, taxable_share=0.85))

            # SURVIVOR STEP-UP. Whoever outlives the other keeps the LARGER benefit, including the
            # deceased's delayed credits. Modelled as the survivor's own stream ending and a
            # stepped-up one beginning at the first death.
            # WHO GOES FIRST IS A DATE, NOT AN AGE. Picking the lower life EXPECTANCY is wrong
            # whenever the two spouses are different ages: an 80-year-old expected to reach 85 dies
            # five years out, long before a 62-year-old expected to reach 84. Rank by years
            # remaining.
            first_to_go = min(household.people,
                              key=lambda p: p.life_expectancy - p.current_age)
            survivor = next(p for p in household.people if p.name != first_to_go.name)
            survivor_stream = 0.0
            if (survivor.life_expectancy - survivor.current_age
                    > first_to_go.life_expectancy - first_to_go.current_age):
                deceased_benefit = (hi_benefit if first_to_go.name == higher
                                    else lo["received"])
                survivor_own = (lo["received"] if first_to_go.name == higher else hi_benefit)
                # OFF-BY-ONE THAT DOUBLE-PAID. `Person.is_alive_in` keeps someone alive while
                # age <= life_expectancy, so the deceased is still collecting IN the year they
                # reach that age — the first year they are gone is one later. Starting the survivor
                # stream at `life_expectancy - current_age` paid the deceased's benefit AND the
                # survivor's step-up in the same year, inflating household income by a full
                # benefit for twelve months.
                first_gone_offset = (first_to_go.life_expectancy
                                     - first_to_go.current_age) + 1
                survivor_age_at_death = survivor.current_age + first_gone_offset
                stepped = max(survivor_own,
                              deceased_benefit * survivor_factor(
                                  max(SURVIVOR_EARLIEST_AGE, survivor_age_at_death)))
                if stepped > survivor_own and survivor_age_at_death < survivor.life_expectancy:
                    survivor_stream = round(stepped, 2)
                    # End the survivor's own stream at the first death and replace it.
                    # THE SURVIVOR'S OWN STREAM KEEPS ITS OWN START DATE. This read
                    # `min(age_lo, age_hi)`, which moved the lower earner's benefit EARLIER than
                    # they claimed it — paying a 67-year-old's benefit from 62 whenever the higher
                    # earner claimed at 62, and making early claiming win at every funding level.
                    kept = [s for s in h.income_sources
                            if s.owner == survivor.name and s.start_age is not None]
                    own_start = min(s.start_age for s in kept) if kept else (
                        age_lo if survivor.name == lower else age_hi)
                    # If the survivor's own claim date falls AT OR AFTER the first death, there is
                    # no "own benefit first" segment to model — they go straight onto the survivor
                    # benefit. Emitting the segment anyway built an IncomeSource whose end_age
                    # preceded its start_age.
                    own_segment = ([IncomeSource(
                        label="Social Security", annual_amount=survivor_own,
                        owner=survivor.name, start_age=own_start,
                        end_age=survivor_age_at_death - 1, taxable_share=0.85)]
                        if own_start < survivor_age_at_death else [])
                    h.income_sources = [
                        s for s in h.income_sources if s.owner != survivor.name
                    ] + own_segment + [
                        IncomeSource(label="Social Security (survivor)", annual_amount=stepped,
                                     owner=survivor.name, start_age=survivor_age_at_death,
                                     taxable_share=0.85),
                    ]

            r = project(h, tax_year=tax_year)
            candidates.append(_candidate(
                f"{higher} at {age_hi}, {lower} at {age_lo}", r,
                higher_earner=higher, higher_benefit=round(hi_benefit, 2),
                lower_benefit=lo["received"], lower_basis=lo["basis"],
                spousal_top_up=lo["top_up"], survivor_benefit=survivor_stream,
                survivor_name=survivor.name if survivor_stream else None))

    first = project(_with_order(household, household.withdrawal_order), tax_year=tax_year)
    return StrategyResult(
        strategy="household_claiming",
        question=f"When should {names[0]} and {names[1]} each claim Social Security?",
        candidates=candidates,
        baseline_label=f"{higher} at {FULL_RETIREMENT_AGE}, {lower} at {FULL_RETIREMENT_AGE}",
        tax_year=first.tax_year,
        tax_basis_is_current_year=first.tax_basis_is_current_year,
        assumptions=first.assumptions,
        notes=(f"{higher} is the higher earner (PIA ${pias[higher]:,.0f} vs "
               f"${pias[lower]:,.0f}).",
               "A spousal benefit caps at 50% of the worker's PIA at the spouse's FRA and earns NO "
               "delayed credits — waiting past FRA for a spousal benefit adds nothing.",
               "A SURVIVOR benefit inherits the deceased's delayed credits, so delaying the higher "
               f"earner's claim permanently raises the income of whichever spouse lives longer. "
               f"That is usually worth more than optimising {lower}'s date.",
               "Social Security pays the HIGHER of an own and a spousal benefit, never the sum.",
               "Not modelled: the RIB-LIM cap when the deceased claimed early, the earnings test "
               "before FRA, divorced-spouse and child benefits, the family maximum, and WEP/GPO."),
    )
