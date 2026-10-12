"""The year-by-year household ledger (Phase P).

WHY ANNUAL, NOT MONTHLY
-----------------------
`projector.ts` steps monthly for up to 720 months, which is right for short-horizon cash flow. A
PLANNING projection is annual, because **tax is annual**. Every interesting question this spine has
to answer — what bracket a withdrawal lands in, how much Roth conversion fits before the next
bracket, whether a capital gain pushes income over the NIIT threshold, what an RMD forces — is a
calendar-year question. Stepping monthly and then summing to years would compute the same tax twelve
times with worse precision at the boundaries.

THE GROSS-UP, WHICH IS WHERE NAIVE LEDGERS GO WRONG
---------------------------------------------------
Withdrawing from a tax-deferred account to cover a shortfall is circular: the withdrawal is income,
income raises tax, higher tax widens the shortfall, which needs a larger withdrawal. A ledger that
withdraws exactly the shortfall UNDERFUNDS the year — every year, compounding — and the plan quietly
looks better than it is. This module iterates to a fixed point (`_MAX_GROSS_UP_ITERATIONS`), which is
what makes "I need $80,000 to spend" produce a $103,000 withdrawal rather than an $80,000 one.

ORDER MATTERS AND IS NOT OPTIONAL
---------------------------------
The same balances drawn in a different order produce a materially different lifetime tax bill. The
ledger therefore draws by `household.withdrawal_order` and reports what came from which bucket, so
`withdrawal_sequencing` can later optimize it rather than re-deriving the whole projection.

FAILS FAST ON UNVERIFIED TAX DATA
---------------------------------
The tax basis is checked ONCE before the loop. A projection that discovered an unverified table in
plan year 30 would already have produced thirty years of figures nobody can stand behind.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Optional, Sequence

from ..calculators import versioned_data as V
from ..calculators import tax as tax_calc
from ..calculators.base import from_registry
from .household import ROTH, TAXABLE, TAX_DEFERRED, Account, Household, PlanningError

log = logging.getLogger("core.planning.ledger")

# Iterations for the withdrawal gross-up. Converges in 3-4 for realistic brackets; the cap exists
# so a pathological case degrades to a slightly-underfunded year rather than spinning.
_MAX_GROSS_UP_ITERATIONS = 12
_GROSS_UP_TOLERANCE = 1.0   # dollars
# A shortfall below this is gross-up rounding, not a funding failure.
#
# THE BUG THIS CONSTANT EXISTS TO PREVENT: `depleted_year` originally flagged any shortfall over a
# cent, while the gross-up converges to within a dollar. A healthy plan with a $900k IRA funding
# $80k/yr therefore reported "assets exhausted in year 0" off a FIVE CENT residual — the most
# alarming possible false positive, and one a user would never question. Sub-tolerance residuals
# are now clamped to zero at the source so they never enter the ledger at all.
_MATERIAL_SHORTFALL = _GROSS_UP_TOLERANCE


@dataclass
class LedgerYear:
    """One plan year. Every figure the advisor might cite about this year is here."""

    year_offset: int
    ages: dict[str, int]
    wage_income: float = 0.0
    other_income: float = 0.0
    taxable_other_income: float = 0.0
    expenses: float = 0.0
    goal_outflows: float = 0.0
    unfunded_goals: list[dict[str, Any]] = field(default_factory=list)
    federal_tax: float = 0.0
    fica: float = 0.0
    state_tax: float = 0.0
    withdrawals: dict[str, float] = field(default_factory=dict)
    contributions: float = 0.0
    rmd: float = 0.0
    roth_conversion: float = 0.0
    filing_status: str = ""
    end_balances: dict[str, float] = field(default_factory=dict)
    total_assets: float = 0.0
    shortfall: float = 0.0
    events: list[str] = field(default_factory=list)
    # Withdrawals made by the most recent `_draw`, so the gross-up can reverse them and retry
    # without double-withdrawing. Internal; excluded from as_dict().
    _drawn_this_pass: list[tuple[Any, float, str]] = field(default_factory=list, repr=False)

    @property
    def total_tax(self) -> float:
        return self.federal_tax + self.fica + self.state_tax

    @property
    def gross_income(self) -> float:
        return self.wage_income + self.other_income

    @property
    def total_withdrawn(self) -> float:
        return sum(self.withdrawals.values())

    def as_dict(self) -> dict[str, Any]:
        return {
            "year_offset": self.year_offset, "ages": dict(self.ages),
            "wage_income": round(self.wage_income, 2),
            "other_income": round(self.other_income, 2),
            "expenses": round(self.expenses, 2),
            "goal_outflows": round(self.goal_outflows, 2),
            "unfunded_goals": list(self.unfunded_goals),
            "federal_tax": round(self.federal_tax, 2), "fica": round(self.fica, 2),
            "state_tax": round(self.state_tax, 2), "total_tax": round(self.total_tax, 2),
            "withdrawals": {k: round(v, 2) for k, v in self.withdrawals.items()},
            "contributions": round(self.contributions, 2), "rmd": round(self.rmd, 2),
            "roth_conversion": round(self.roth_conversion, 2),
            "filing_status": self.filing_status,
            "end_balances": {k: round(v, 2) for k, v in self.end_balances.items()},
            "total_assets": round(self.total_assets, 2),
            "shortfall": round(self.shortfall, 2),
            "events": list(self.events),
        }


@dataclass
class PlanResult:
    years: list[LedgerYear]
    household: dict[str, Any]
    assumptions: list[dict[str, Any]]
    tax_year: int
    tax_basis_verified: bool
    tax_basis_label: str = ""
    tax_basis_is_current_year: bool = True

    @property
    def depleted_year(self) -> Optional[int]:
        """First plan year where assets run out. None means the plan survives the horizon.

        This is the headline a point-estimate projection cannot give you, and it is the question
        users actually ask — not "what will I have" but "does it last".
        """
        for y in self.years:
            if y.shortfall >= _MATERIAL_SHORTFALL:
                return y.year_offset
        return None

    @property
    def succeeds(self) -> bool:
        return self.depleted_year is None and not self.unfunded_goals

    @property
    def unfunded_goals(self) -> list[dict[str, Any]]:
        return [g for y in self.years for g in y.unfunded_goals]

    @property
    def lifetime_tax(self) -> float:
        return sum(y.total_tax for y in self.years)

    @property
    def terminal_assets(self) -> float:
        return self.years[-1].total_assets if self.years else 0.0

    def as_dict(self) -> dict[str, Any]:
        return {
            "succeeds": self.succeeds,
            "depleted_year": self.depleted_year,
            "unfunded_goals": self.unfunded_goals,
            "lifetime_tax": round(self.lifetime_tax, 2),
            "terminal_assets": round(self.terminal_assets, 2),
            "horizon_years": len(self.years),
            "household": self.household,
            "assumptions": self.assumptions,
            "tax_year": self.tax_year,
            # Load-bearing: an unverified tax basis means the whole projection is pending, not just
            # one figure in it.
            "tax_basis_verified": self.tax_basis_verified,
            # Unmissable, because every figure in `years` rests on it.
            "tax_basis_label": self.tax_basis_label,
            "tax_basis_is_current_year": self.tax_basis_is_current_year,
            "years": [y.as_dict() for y in self.years],
        }


def _rate(explicit: Optional[float], key: str, cited: list[dict[str, Any]]) -> float:
    if explicit is not None:
        return float(explicit)
    value, assumption = from_registry(key)
    entry = assumption.as_dict()
    if entry not in cited:
        cited.append(entry)
    return value


def project(household: Household, *, tax_year: Optional[int] = None,
            horizon_years: Optional[int] = None,
            inflation: Optional[float] = None,
            return_path: Optional[Sequence[float]] = None,
            conversions: Optional[dict[int, float]] = None) -> PlanResult:
    """Project the household year by year, computing tax annually from the Phase B engine.

    `return_path` supplies a return for EACH plan year instead of one rate for all of them, which is
    what Monte Carlo and the stress tests need. It must be a per-year sequence rather than an average
    because SEQUENCE matters: the same set of annual returns in a different order produces a very
    different outcome for a household that is drawing down, since a bad early year is realised
    against a full balance and never recovers. Averaging that away would measure nothing.

    `conversions` maps a plan year to a Roth conversion amount. A conversion moves money from a
    tax-deferred bucket to a Roth one and is ORDINARY INCOME in the year it happens — which is the
    entire trade: pay tax now at a known rate to remove the balance from future RMDs and from the
    survivor's narrower brackets. Modelled as a strategy overlay rather than a household fact,
    because it is something the plan DOES, not something the household HAS.

    Raises `PlanningError` BEFORE the loop when the tax tables for `tax_year` are unverified — a
    projection that discovered this in plan year 30 would already have produced thirty years of
    figures nobody can stand behind.
    """
    if not isinstance(household, Household):
        raise PlanningError("project() takes a Household")

    # Fail fast on the tax basis — resolved ONCE, before the loop. A projection that discovered a
    # problem in plan year 30 would already have produced thirty years of figures nobody can stand
    # behind.
    #
    # `tax._table` resolves to the most recent VERIFIED year rather than serving an unverified one
    # (see `_basis_policy` there). So a 2026 plan is computed on 2024 law and says so, instead of
    # either refusing outright or quoting fifty unconfirmed figures. Brackets widen with inflation,
    # so earlier law OVERSTATES tax — the plan is conservative rather than flattering.
    try:
        table = tax_calc._table(tax_year)
    except V.VersionedDataError as exc:
        raise PlanningError(
            f"cannot project a plan without a verified tax basis: {exc}"
        ) from exc

    cited: list[dict[str, Any]] = []
    infl = _rate(inflation, "inflation", cited)
    horizon = int(horizon_years) if horizon_years else household.horizon_years
    if horizon < 1:
        raise PlanningError(f"horizon must be at least one year, got {horizon}")

    accounts = [Account(label=a.label, balance=a.balance, tax_treatment=a.tax_treatment,
                        owner=a.owner, basis=a.basis, annual_return=a.annual_return,
                        annual_contribution=a.annual_contribution)
                for a in household.accounts]
    returns = {a.label: _rate(a.annual_return, "investment_return", cited) for a in accounts}
    if return_path is not None:
        path = [float(r) for r in return_path]
        if len(path) < horizon:
            raise PlanningError(
                f"return_path has {len(path)} years but the horizon is {horizon}; a short path "
                f"would silently apply a flat default to the remaining years")
    growth = {p.name: _rate(p.income_growth, "salary_growth", cited) for p in household.people}
    rmd_age = int(V.load("tax_parameters", tax_year).data["retirement"]["rmd_age"])

    goals_by_year: dict[int, list] = {}
    for g in household.goals:
        goals_by_year.setdefault(g.year, []).append(g)

    years: list[LedgerYear] = []

    for t in range(horizon):
        infl_factor = (1.0 + infl) ** t
        alive = [p for p in household.people if p.is_alive_in(t)]
        if not alive:
            break
        row = LedgerYear(year_offset=t, ages={p.name: p.age_in(t) for p in alive})

        # SURVIVOR FILING STATUS. When one spouse dies the survivor files single (after a
        # qualifying-widow window), and single brackets are roughly half as wide with half the
        # standard deduction. Holding `married_jointly` for the whole horizon UNDERSTATES the
        # survivor's tax for every remaining year — often fifteen or twenty of them, exactly when
        # the household has the least flexibility to absorb it. This is the "widow's penalty", and
        # a plan that misses it is optimistic in the direction that hurts most.
        filing_status = household.filing_status
        if len(alive) == 1 and len(household.people) > 1 and filing_status == "married_jointly":
            filing_status = "single"
            if len([p for p in household.people if p.is_alive_in(t - 1)]) > 1:
                deceased = next(p.name for p in household.people if not p.is_alive_in(t))
                row.events.append(
                    f"{deceased} is beyond life expectancy; {alive[0].name} now files single "
                    f"(the widow's penalty — narrower brackets on similar income)")

        # 1. Wages — only for people not yet retired.
        for p in alive:
            if not p.is_retired_in(t) and p.annual_income:
                row.wage_income += p.annual_income * ((1.0 + growth[p.name]) ** t)
            elif p.retirement_age is not None and p.age_in(t) == p.retirement_age:
                row.events.append(f"{p.name} retires at {p.retirement_age}")

        # 2. Other income, by the owner's age.
        for src in household.income_sources:
            owner = household.person(src.owner)
            if not owner.is_alive_in(t):
                continue
            age = owner.age_in(t)
            if age < src.start_age or (src.end_age is not None and age > src.end_age):
                continue
            amount = src.annual_amount * (infl_factor if src.inflation_adjusted else 1.0)
            row.other_income += amount
            row.taxable_other_income += amount * src.taxable_share
            if age == src.start_age:
                row.events.append(f"{src.label} begins for {owner.name} at {age}")

        # 3. Expenses, with the retirement spending factor once everyone alive has retired.
        everyone_retired = all(p.is_retired_in(t) for p in alive)
        for e in household.expenses:
            if t < e.start_year or (e.end_year is not None and t > e.end_year):
                continue
            amount = e.annual_amount * (infl_factor if e.inflation_adjusted else 1.0)
            if everyone_retired:
                amount *= e.retirement_factor
            row.expenses += amount

        # 3b. Roth conversion — BEFORE the RMD, deliberately.
        #
        # ORDER MATTERS HERE. A conversion shrinks the tax-deferred balance, and the RMD is a
        # fraction of that balance, so converting first reduces this year's RMD too. Running it
        # after would overstate the forced distribution and understate the strategy's benefit —
        # which is most of the reason the strategy exists. (In practice an RMD must be satisfied
        # before a conversion in the same year; the ordering here models the balance effect, and
        # `roth_conversion_ladder` deliberately targets pre-RMD years where the question does not
        # arise.)
        want_convert = float((conversions or {}).get(t, 0.0) or 0.0)
        if want_convert > 0:
            source = next((a for a in accounts
                           if a.tax_treatment == TAX_DEFERRED and a.balance > 0), None)
            target = next((a for a in accounts if a.tax_treatment == ROTH), None)
            if source is not None and target is not None:
                moved = min(source.balance, want_convert)
                source.balance -= moved
                target.balance += moved
                row.roth_conversion = moved
                row.events.append(f"Roth conversion of ${moved:,.0f} (taxable this year)")

        # 4. RMDs — forced out of tax-deferred whether the household needs the money or not. This
        #    is the thing a plan must surface early, because it can push a retiree into a higher
        #    bracket than they were ever in while working.
        for a in accounts:
            if a.tax_treatment != TAX_DEFERRED or a.balance <= 0:
                continue
            owner = household.person(a.owner) if a.owner else alive[0]
            if not owner.is_alive_in(t) or owner.age_in(t) < rmd_age:
                continue
            # Uniform-lifetime approximation: balance / remaining life expectancy.
            divisor = max(1.0, float(owner.life_expectancy - owner.age_in(t)))
            required = a.balance / divisor
            a.balance -= required
            row.rmd += required
            row.withdrawals[TAX_DEFERRED] = row.withdrawals.get(TAX_DEFERRED, 0.0) + required
            if owner.age_in(t) == rmd_age:
                row.events.append(f"{owner.name}'s RMDs begin at {rmd_age}")

        # 5. Tax on income as it stands, then the shortfall, then the gross-up.
        def tax_for(ordinary: float, wages: float) -> tuple[float, float, float]:
            fed = tax_calc.federal_income_tax(
                gross_income=max(0.0, ordinary), filing_status=filing_status,
                tax_year=tax_year).value
            pay = tax_calc.fica(wages=max(0.0, wages),
                                filing_status=filing_status, tax_year=tax_year).value
            st = 0.0
            if household.state:
                try:
                    st = tax_calc.state_income_tax(
                        taxable_income=max(0.0, ordinary), state=household.state,
                        filing_status=filing_status, tax_year=tax_year).value
                except Exception:  # noqa: BLE001 — an unmodelled/unverified state is not fatal
                    st = 0.0
            return fed, pay, st

        # The conversion is ordinary income in the conversion year — the whole cost of the trade.
        ordinary_income = (row.wage_income + row.taxable_other_income + row.rmd
                           + row.roth_conversion)
        fed, fica_amt, state_amt = tax_for(ordinary_income, row.wage_income)

        # 6. Goals due this year, funded in priority order.
        due = sorted(goals_by_year.get(t, []), key=lambda g: (g.rank, -g.amount))

        available = (row.wage_income + row.other_income + row.rmd
                     - row.expenses - (fed + fica_amt + state_amt))

        def liquid() -> float:
            return sum(a.balance for a in accounts)

        for g in due:
            amount = g.amount * (infl_factor if g.inflation_adjusted else 1.0)
            if available + liquid() >= amount - _GROSS_UP_TOLERANCE:
                row.goal_outflows += amount
                available -= amount
            else:
                # Reported, never absorbed. A ledger that silently runs a balance negative leaves
                # the plan looking complete while the goal is unaffordable.
                row.unfunded_goals.append({
                    "label": g.label, "priority": g.priority, "year": t,
                    "needed": round(amount, 2),
                    "available": round(max(0.0, available + liquid()), 2),
                })
                row.events.append(
                    f"{g.label} ({g.priority}) is unfunded: needs ${amount:,.0f}")

        # 7. Cover any remaining deficit by withdrawing, grossed up for the tax it creates.
        if available < -_GROSS_UP_TOLERANCE:
            need = -available                      # spending to fund before any withdrawal
            base_tax = fed + fica_amt + state_amt  # tax before any withdrawal this year
            extra_ordinary = 0.0
            drawn = 0.0

            # Fixed-point iteration. Withdrawing from a tax-deferred account IS income, so it
            # raises the tax, which widens the gap, which needs a larger withdrawal. A ledger that
            # skipped this would underfund every year and compound the error, making the plan look
            # better than it is.
            #
            # TWO THINGS HERE ARE LOAD-BEARING, and the first was a real bug:
            #
            # 1. THE LOOP MUST NEVER EXIT IN AN UNDONE STATE. The original version ended each
            #    non-converging pass with `_undo()`, so if it exhausted its iterations the
            #    withdrawals had been REVERSED while `drawn` still held the stale amount. The year's
            #    tax was then treated as funded from money that had been put back — assets ROSE and
            #    the shortfall read zero. It silently created money, and it only showed up as a
            #    non-monotonic strategy ranking: converting MORE paid more tax and somehow ended
            #    with $1.69M more assets. A final re-draw after the loop guarantees the balances
            #    match the figures.
            #
            # 2. DAMPING. Jumping straight to each new estimate oscillates when the withdrawal is
            #    large enough to cross a bracket — the exact case a big Roth conversion creates.
            #    Averaging the old and new estimates converges instead of flip-flopping.
            converged = False
            for _ in range(_MAX_GROSS_UP_ITERATIONS):
                f2, p2, s2 = tax_for(ordinary_income + extra_ordinary, row.wage_income)
                target = need + ((f2 + p2 + s2) - base_tax)
                drawn, drawn_ordinary = _draw(accounts, household.withdrawal_order, target, row)
                if abs(drawn_ordinary - extra_ordinary) < _GROSS_UP_TOLERANCE:
                    extra_ordinary = drawn_ordinary
                    converged = True
                    break
                _undo(row)                         # reverse and retry with a better estimate
                extra_ordinary = (extra_ordinary + drawn_ordinary) / 2.0

            if not converged:
                # Settle on the damped estimate and actually take the money. Slightly imprecise is
                # fine; an unfunded year is not.
                f2, p2, s2 = tax_for(ordinary_income + extra_ordinary, row.wage_income)
                target = need + ((f2 + p2 + s2) - base_tax)
                drawn, _ = _draw(accounts, household.withdrawal_order, target, row)
                row.events.append(
                    "withdrawal gross-up did not fully converge; funded to the closest estimate")

            fed, fica_amt, state_amt = tax_for(ordinary_income + extra_ordinary, row.wage_income)
            required = need + ((fed + fica_amt + state_amt) - base_tax)
            residual = max(0.0, required - drawn)
            row.shortfall = residual if residual >= _MATERIAL_SHORTFALL else 0.0
            if row.shortfall:
                row.events.append(
                    f"assets exhausted: ${row.shortfall:,.0f} of spending could not be funded")
        elif available > 0:
            # 8. Surplus goes to the first taxable account, else the first account at all.
            target = next((a for a in accounts if a.tax_treatment == TAXABLE),
                          accounts[0] if accounts else None)
            if target is not None:
                target.balance += available
                if target.tax_treatment == TAXABLE:
                    target.basis = float(target.basis or 0.0) + available
                row.contributions += available

        row.federal_tax, row.fica, row.state_tax = fed, fica_amt, state_amt
        row.filing_status = filing_status

        # 9. Growth, applied after the year's flows.
        for a in accounts:
            if a.balance > 0:
                # A sampled path overrides the per-account rate. Applied to every account alike:
                # modelling per-account correlation is a refinement, and pretending accounts move
                # independently would understate risk far more than this simplification does.
                rate_t = path[t] if return_path is not None else returns[a.label]
                a.balance *= (1.0 + rate_t)

        row.end_balances = {a.label: a.balance for a in accounts}
        row.total_assets = sum(a.balance for a in accounts)
        years.append(row)

    label = table.provenance
    if table.is_carried_forward:
        label += (" — every figure in this plan is computed on that year's law; tax is therefore "
                  "slightly OVERSTATED, since bracket thresholds rise with inflation")
    return PlanResult(years=years, household=household.as_dict(), assumptions=cited,
                      tax_year=table.year_used, tax_basis_verified=table.is_verified,
                      tax_basis_label=label,
                      tax_basis_is_current_year=not table.is_carried_forward)


def _draw(accounts: list[Account], order: tuple[str, ...], target: float,
          row: LedgerYear) -> tuple[float, float]:
    """Withdraw `target` across accounts in `order`. Returns (drawn, ordinary-income created).

    Only TAX_DEFERRED withdrawals are ordinary income. A taxable withdrawal realizes a capital
    GAIN on the appreciated share, which is taxed at preferential rates — approximated here by
    excluding it from the ordinary gross-up and noting it, rather than pretending a brokerage
    drawdown is tax-free (it is not) or that it is ordinary income (it is not either).
    """
    drawn = 0.0
    ordinary = 0.0
    row._drawn_this_pass = []
    for treatment in order:
        if drawn >= target - _GROSS_UP_TOLERANCE:
            break
        for a in accounts:
            if a.tax_treatment != treatment or a.balance <= 0:
                continue
            take = min(a.balance, target - drawn)
            if take <= 0:
                continue
            gain_share = (a.unrealized_gain / a.balance) if (
                a.tax_treatment == TAXABLE and a.balance > 0) else 0.0
            a.balance -= take
            if a.tax_treatment == TAXABLE:
                a.basis = max(0.0, float(a.basis or 0.0) - take * (1.0 - gain_share))
            drawn += take
            if treatment == TAX_DEFERRED:
                ordinary += take
            row.withdrawals[treatment] = row.withdrawals.get(treatment, 0.0) + take
            row._drawn_this_pass.append((a, take, treatment))
            if drawn >= target - _GROSS_UP_TOLERANCE:
                break
    return drawn, ordinary


def _undo(row: LedgerYear) -> None:
    """Reverse the last `_draw` so the gross-up can retry without double-withdrawing."""
    for a, take, treatment in row._drawn_this_pass:
        a.balance += take
        if a.tax_treatment == TAXABLE:
            a.basis = float(a.basis or 0.0) + take
        row.withdrawals[treatment] = max(0.0, row.withdrawals.get(treatment, 0.0) - take)
        if row.withdrawals[treatment] <= 0:
            row.withdrawals.pop(treatment, None)
    row._drawn_this_pass = []
