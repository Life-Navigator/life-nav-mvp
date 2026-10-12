"""Phase P — the planning spine.

Tested at TAX YEAR 2024 throughout, for the same reason the tax engine is: 2024 is historically
fixed and verified, so a projection's correctness never depends on the pending verification of the
current year's tables.

Every expectation is either hand-derivable, a relationship that must hold (monotonicity, a fixed
point, a conservation identity), or an independently simulated figure. None restate the ledger's
own arithmetic.
"""
from __future__ import annotations

import pytest

from app.services.planning import (
    HSA,
    ROTH,
    TAXABLE,
    TAX_DEFERRED,
    Account,
    Expense,
    Goal,
    Household,
    IncomeSource,
    Person,
    project,
)
from app.services.planning.household import PlanningError

Y = 2024


def _single(**kw):
    kw.setdefault("people", [Person("Alex", 40, 65, 95, 150000)])
    kw.setdefault("filing_status", "single")
    return Household(**kw)


# ── Inputs refuse to be guessed ──────────────────────────────────────────────────────────────────
def test_filing_status_cannot_be_defaulted():
    """`single` halves every bracket threshold and the standard deduction, so defaulting it
    overstates a married household's lifetime tax by a wide margin."""
    with pytest.raises(PlanningError, match="cannot be defaulted"):
        Household(people=[Person("A", 40)], filing_status="")


def test_account_tax_treatment_is_required():
    """A balance is not a balance: $500k in a 401(k), a Roth and a brokerage fund different amounts
    of spending, and the drawdown ORDER changes the lifetime tax bill."""
    with pytest.raises(PlanningError, match="cannot be defaulted"):
        Account("x", 1000, "savings")


def test_a_retirement_age_already_behind_the_person_is_refused():
    with pytest.raises(PlanningError, match="already past"):
        Person("A", 60, 50)


def test_life_expectancy_must_exceed_current_age():
    with pytest.raises(PlanningError, match="must exceed current_age"):
        Person("A", 70, None, 65)


def test_more_than_two_adults_is_refused():
    with pytest.raises(PlanningError, match="one or two adults"):
        Household(people=[Person("A", 40), Person("B", 40), Person("C", 40)],
                  filing_status="single")


def test_an_income_source_must_belong_to_someone_in_the_household():
    with pytest.raises(PlanningError, match="is not in the household"):
        _single(income_sources=[IncomeSource("SS", 30000, "Nobody", 67)])


def test_an_unverified_year_projects_on_the_last_verified_law_and_labels_it():
    """Option B. The 2026 tables are unverified model knowledge, so the plan is computed on the most
    recent year a human checked and says so — rather than refusing outright (no planning at all) or
    quoting ~50 unconfirmed figures (the fabrication this engine exists to prevent).

    Brackets widen with inflation, so earlier law OVERSTATES tax: the plan is conservative.
    """
    r = project(_single(expenses=[Expense("Living", 50000)]), tax_year=2026)
    assert r.tax_year == 2024 and r.tax_basis_verified is True
    assert r.tax_basis_is_current_year is False
    assert "computed on 2024 law" in r.tax_basis_label
    assert "OVERSTATED" in r.tax_basis_label


def test_the_label_is_unmissable_because_every_figure_rests_on_it(monkeypatch):
    r = project(_single(expenses=[Expense("Living", 50000)]), tax_year=2026)
    d = r.as_dict()
    assert d["tax_basis_label"] and d["tax_basis_is_current_year"] is False
    # And when the basis IS the requested year, no caveat is attached.
    clean = project(_single(expenses=[Expense("Living", 50000)]), tax_year=Y).as_dict()
    assert clean["tax_basis_is_current_year"] is True
    assert "OVERSTATED" not in clean["tax_basis_label"]


def test_verified_only_policy_still_refuses_before_the_loop(monkeypatch):
    """What to switch to after the CPA signs off: a fallback would then mean something is wrong
    rather than pending. And it must fail BEFORE the loop — a projection that discovered this in
    plan year 30 would already have produced thirty years of figures nobody can stand behind."""
    monkeypatch.setenv("TAX_BASIS_POLICY", "verified_only")
    with pytest.raises(PlanningError, match="verified tax basis"):
        project(_single(expenses=[Expense("Living", 50000)]), tax_year=2026)


# ── The ledger integrates the real tax engine ────────────────────────────────────────────────────
def test_year_zero_tax_matches_the_tax_engine_exactly():
    """$150,000 single, 2024: taxable 135,400, federal 25,538.50, FICA 11,475. The ledger must not
    re-derive tax with a flat rate — that is the whole point of co-locating the spine with the
    engine."""
    r = project(_single(expenses=[Expense("Living", 90000)]), tax_year=Y)
    y0 = r.years[0]
    assert y0.federal_tax == pytest.approx(25538.50, abs=0.01)
    assert y0.fica == pytest.approx(11475.0, abs=0.01)
    assert y0.wage_income == 150000.0


def test_the_horizon_runs_to_the_last_survivor():
    h = Household(people=[Person("Alex", 60, 65, 90), Person("Sam", 58, 62, 95)],
                  filing_status="married_jointly")
    assert h.horizon_years == 95 - 58
    r = project(h, tax_year=Y)
    assert len(r.years) == 37


def test_each_person_retires_on_their_own_date():
    h = Household(people=[Person("Alex", 60, 65, 90, 180000), Person("Sam", 58, 62, 95, 90000)],
                  filing_status="married_jointly",
                  expenses=[Expense("Living", 100000)],
                  accounts=[Account("401k", 2000000, TAX_DEFERRED, "Alex")])
    r = project(h, tax_year=Y)
    # Sam retires at 62 = plan year 4; Alex at 65 = plan year 5.
    assert any("Sam retires at 62" in e for e in r.years[4].events)
    assert any("Alex retires at 65" in e for e in r.years[5].events)
    assert r.years[6].wage_income == 0.0


def test_income_sources_start_at_the_owners_age():
    h = _single(accounts=[Account("IRA", 1000000, TAX_DEFERRED, "Alex")],
                income_sources=[IncomeSource("Social Security", 40000, "Alex", 67)],
                expenses=[Expense("Living", 80000)])
    r = project(h, tax_year=Y)
    assert r.years[26].other_income == 0.0           # age 66
    assert r.years[27].other_income > 0.0            # age 67
    assert any("Social Security begins" in e for e in r.years[27].events)


def test_only_the_taxable_share_of_an_income_source_is_taxed():
    """Social Security is at most 85% taxable. Treating it as fully taxable overstates retirement
    tax for most households."""
    base = dict(accounts=[Account("IRA", 500000, TAX_DEFERRED, "Alex")],
                expenses=[Expense("Living", 40000)])
    full = project(_single(income_sources=[IncomeSource("P", 50000, "Alex", 40, taxable_share=1.0)],
                           **base), tax_year=Y)
    part = project(_single(income_sources=[IncomeSource("P", 50000, "Alex", 40, taxable_share=0.85)],
                           **base), tax_year=Y)
    assert part.years[0].federal_tax < full.years[0].federal_tax


# ── The gross-up ─────────────────────────────────────────────────────────────────────────────────
def test_a_withdrawal_is_grossed_up_for_the_tax_it_creates():
    """THE THING NAIVE LEDGERS GET WRONG. Withdrawing from a tax-deferred account IS income, so
    funding $80,000 of spending requires MORE than $80,000. Withdrawing exactly the shortfall
    underfunds every year and compounds, making the plan look better than it is."""
    h = Household(people=[Person("Alex", 66, None, 95, 0)], filing_status="single",
                  accounts=[Account("IRA", 900000, TAX_DEFERRED, "Alex")],
                  expenses=[Expense("Living", 80000)])
    y0 = project(h, tax_year=Y).years[0]
    assert y0.total_withdrawn > 80000
    # The fixed point: the excess withdrawn equals the tax it generated.
    assert y0.total_withdrawn - 80000 == pytest.approx(y0.total_tax, abs=1.0)


def test_a_roth_withdrawal_needs_no_gross_up():
    """Roth withdrawals are not income, so funding $80,000 costs exactly $80,000. The contrast with
    the tax-deferred case is the entire argument for withdrawal sequencing."""
    h = Household(people=[Person("Alex", 66, None, 95, 0)], filing_status="single",
                  accounts=[Account("Roth", 900000, ROTH, "Alex")],
                  expenses=[Expense("Living", 80000)])
    y0 = project(h, tax_year=Y).years[0]
    assert y0.total_withdrawn == pytest.approx(80000, abs=1.0)
    assert y0.federal_tax == 0.0


def test_drawing_from_a_roth_costs_less_lifetime_tax_than_drawing_from_a_traditional():
    """The same balance, the same spending, a different bucket — and a materially different
    lifetime tax bill. This is what the ledger exists to make visible."""
    common = dict(people=[Person("Alex", 66, None, 90, 0)], filing_status="single",
                  expenses=[Expense("Living", 70000)])
    trad = project(Household(accounts=[Account("IRA", 1200000, TAX_DEFERRED, "Alex")], **common),
                   tax_year=Y)
    roth = project(Household(accounts=[Account("Roth", 1200000, ROTH, "Alex")], **common),
                   tax_year=Y)
    assert roth.lifetime_tax < trad.lifetime_tax
    assert roth.terminal_assets > trad.terminal_assets


# ── Withdrawal order ─────────────────────────────────────────────────────────────────────────────
def test_withdrawals_follow_the_declared_order():
    h = Household(people=[Person("Alex", 66, None, 95, 0)], filing_status="single",
                  accounts=[Account("Brokerage", 100000, TAXABLE, basis=100000),
                            Account("IRA", 500000, TAX_DEFERRED, "Alex"),
                            Account("Roth", 200000, ROTH, "Alex")],
                  expenses=[Expense("Living", 60000)])
    y0 = project(h, tax_year=Y).years[0]
    assert TAXABLE in y0.withdrawals
    assert TAX_DEFERRED not in y0.withdrawals, "taxable is first in the default order"


def test_a_custom_order_changes_which_bucket_is_drawn():
    accounts = [Account("Brokerage", 100000, TAXABLE, basis=100000),
                Account("Roth", 200000, ROTH, "Alex")]
    common = dict(people=[Person("Alex", 66, None, 95, 0)], filing_status="single",
                  expenses=[Expense("Living", 60000)])
    default = project(Household(accounts=[Account(**vars(a)) for a in accounts], **common),
                      tax_year=Y)
    roth_first = project(Household(accounts=[Account(**vars(a)) for a in accounts],
                                   withdrawal_order=(ROTH, TAXABLE, TAX_DEFERRED, HSA),
                                   **common), tax_year=Y)
    assert TAXABLE in default.years[0].withdrawals
    assert ROTH in roth_first.years[0].withdrawals


# ── RMDs ─────────────────────────────────────────────────────────────────────────────────────────
def test_rmds_begin_at_the_statutory_age_and_are_forced():
    """Forced out whether the household needs the money or not — which can push a retiree into a
    higher bracket than they were ever in while working. A plan must surface it early."""
    h = Household(people=[Person("Ray", 72, None, 95, 0)], filing_status="single",
                  accounts=[Account("IRA", 1000000, TAX_DEFERRED, "Ray")],
                  expenses=[Expense("Living", 20000)])
    r = project(h, tax_year=Y)
    assert r.years[0].rmd == 0.0
    assert r.years[1].rmd > 0.0
    assert any("RMDs begin at 73" in e for e in r.years[1].events)


def test_an_rmd_is_taken_even_when_spending_is_already_covered():
    h = Household(people=[Person("Ray", 73, None, 95, 0)], filing_status="single",
                  accounts=[Account("IRA", 1000000, TAX_DEFERRED, "Ray")],
                  income_sources=[IncomeSource("Pension", 200000, "Ray", 73)],
                  expenses=[Expense("Living", 20000)])
    y0 = project(h, tax_year=Y).years[0]
    assert y0.rmd > 0.0, "the RMD is not optional just because the pension covers spending"


def test_a_roth_has_no_rmd():
    h = Household(people=[Person("Ray", 80, None, 95, 0)], filing_status="single",
                  accounts=[Account("Roth", 1000000, ROTH, "Ray")],
                  expenses=[Expense("Living", 20000)])
    assert project(h, tax_year=Y).years[0].rmd == 0.0


# ── The widow's penalty ──────────────────────────────────────────────────────────────────────────
def test_the_survivor_files_single_and_the_tax_jumps():
    """THE WIDOW'S PENALTY. When one spouse dies the survivor files single — roughly half the
    bracket widths on similar income. Holding married_jointly for the whole horizon understates the
    survivor's tax for every remaining year, which is optimistic in the direction that hurts most.
    """
    h = Household(people=[Person("Alex", 60, 62, 75, 0), Person("Sam", 58, 62, 95, 0)],
                  filing_status="married_jointly",
                  accounts=[Account("IRA", 2000000, TAX_DEFERRED, "Sam")],
                  expenses=[Expense("Living", 100000)])
    r = project(h, tax_year=Y)
    before = next(y for y in r.years if len(y.ages) == 2 and y.year_offset > 10)
    after = next(y for y in r.years if len(y.ages) == 1)
    assert before.filing_status == "married_jointly"
    assert after.filing_status == "single"
    assert after.federal_tax > before.federal_tax
    assert any("widow's penalty" in e for e in after.events)


def test_a_single_person_household_is_unaffected():
    r = project(_single(expenses=[Expense("Living", 50000)]), tax_year=Y)
    assert all(y.filing_status == "single" for y in r.years)


# ── Goals ────────────────────────────────────────────────────────────────────────────────────────
def test_a_need_is_funded_before_a_wish():
    """When a plan cannot fund everything it must fail in a STATED order."""
    h = _single(accounts=[Account("Cash", 100000, TAXABLE, basis=100000)],
                expenses=[Expense("Living", 80000)],
                goals=[Goal("Boat", 90000, 1, "wish"), Goal("Tuition", 90000, 1, "need")])
    y = project(h, tax_year=Y).years[1]
    assert y.goal_outflows > 0
    assert [g["label"] for g in y.unfunded_goals] == ["Boat"]


def test_an_unfundable_goal_is_reported_not_absorbed():
    """The single most misleading thing a planning engine can do is silently run a balance negative
    — the plan still looks complete while the goal is unaffordable."""
    h = _single(accounts=[Account("Cash", 10000, TAXABLE, basis=10000)],
                expenses=[Expense("Living", 140000)],
                goals=[Goal("Second home", 900000, 2, "wish")])
    r = project(h, tax_year=Y)
    assert r.unfunded_goals
    assert r.succeeds is False
    assert all(y.total_assets >= 0 for y in r.years), "no balance may go negative"


def test_goals_inflate_by_default():
    h = _single(accounts=[Account("Cash", 2000000, TAXABLE, basis=2000000)],
                expenses=[Expense("Living", 50000)],
                goals=[Goal("Wedding", 100000, 10)])
    y = project(h, tax_year=Y).years[10]
    assert y.goal_outflows > 100000, "a 10-year-out goal costs more than today's price"


# ── Depletion ────────────────────────────────────────────────────────────────────────────────────
def test_an_underfunded_plan_names_the_year_it_runs_out():
    """The question users actually ask is not "what will I have" but "does it last"."""
    h = Household(people=[Person("Bo", 66, None, 95, 0)], filing_status="single",
                  accounts=[Account("IRA", 200000, TAX_DEFERRED, "Bo")],
                  expenses=[Expense("Living", 80000)])
    r = project(h, tax_year=Y)
    assert r.depleted_year is not None and r.depleted_year < 5
    assert r.succeeds is False
    assert any("assets exhausted" in e for e in r.years[r.depleted_year].events)


def test_a_sub_dollar_rounding_residual_is_not_reported_as_depletion():
    """THE BUG THIS GUARDS. `depleted_year` once flagged any shortfall over a cent while the
    gross-up converges to within a dollar — so a healthy plan reported "assets exhausted in year 0"
    off a FIVE CENT residual. The most alarming possible false positive, and one no user would
    question."""
    h = Household(people=[Person("Alex", 66, None, 80, 0)], filing_status="single",
                  accounts=[Account("IRA", 5000000, TAX_DEFERRED, "Alex")],
                  expenses=[Expense("Living", 80000)])
    r = project(h, tax_year=Y)
    assert r.depleted_year is None
    assert all(y.shortfall == 0.0 for y in r.years)


def test_more_assets_never_depletes_sooner():
    """Monotonicity — a scale-free check that the drawdown logic is coherent."""
    def depletes_at(balance):
        h = Household(people=[Person("Alex", 66, None, 95, 0)], filing_status="single",
                      accounts=[Account("IRA", balance, TAX_DEFERRED, "Alex")],
                      expenses=[Expense("Living", 80000)])
        r = project(h, tax_year=Y)
        return r.depleted_year if r.depleted_year is not None else 10**6

    assert depletes_at(200000) < depletes_at(600000) < depletes_at(1500000)


# ── Reporting ────────────────────────────────────────────────────────────────────────────────────
def test_the_result_is_json_serializable_with_the_tax_basis_flagged():
    import json
    r = project(_single(expenses=[Expense("Living", 90000)]), tax_year=Y)
    d = r.as_dict()
    json.dumps(d)
    assert d["tax_year"] == Y and d["tax_basis_verified"] is True
    assert len(d["years"]) == len(r.years)
    assert "assumptions" in d and d["assumptions"], "registry assumptions must be cited"


def test_registry_assumptions_are_cited_once_each():
    h = _single(accounts=[Account("IRA", 500000, TAX_DEFERRED, "Alex")],
                expenses=[Expense("Living", 90000)])
    r = project(h, tax_year=Y)
    keys = [a["key"] for a in r.assumptions]
    assert len(keys) == len(set(keys)), "no duplicate citations"
    assert {"inflation", "investment_return", "salary_growth"} <= set(keys)


def test_only_the_assumptions_actually_used_are_cited():
    """A household with no accounts never applies an investment return, so citing one would be
    listing an assumption the projection did not make — which is exactly what the registry's
    provenance discipline exists to prevent."""
    r = project(_single(expenses=[Expense("Living", 90000)]), tax_year=Y)
    keys = {a["key"] for a in r.assumptions}
    assert "investment_return" not in keys
    assert "inflation" in keys


def test_lifetime_tax_is_the_sum_of_the_years():
    r = project(_single(expenses=[Expense("Living", 90000)]), tax_year=Y)
    assert r.lifetime_tax == pytest.approx(sum(y.total_tax for y in r.years), abs=0.01)


def test_expenses_fall_at_retirement_when_a_factor_is_given():
    h = _single(accounts=[Account("IRA", 3000000, TAX_DEFERRED, "Alex")],
                expenses=[Expense("Living", 100000, retirement_factor=0.8)])
    r = project(h, tax_year=Y)
    working = r.years[20].expenses      # age 60
    retired = r.years[26].expenses      # age 66
    # Despite six more years of inflation, the factor makes retired spending lower.
    assert retired < working
