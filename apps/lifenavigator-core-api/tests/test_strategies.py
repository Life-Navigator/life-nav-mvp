"""Phase F strategies — ledger readouts (Milestone 2).

Property-based, like the Monte Carlo tests: these compare whole-lifetime projections, so the honest
assertions are about ORDERING, CONSERVATION and whether the comparison can discriminate at all —
not about a specific dollar outcome, which would lock in an implementation detail.
"""
from __future__ import annotations

import pytest

from app.services.planning import (
    ROTH,
    TAXABLE,
    TAX_DEFERRED,
    Account,
    Expense,
    Household,
    IncomeSource,
    Person,
    claiming_factor,
    project,
    roth_conversion_ladder,
    social_security_claiming,
    withdrawal_sequencing,
)
from app.services.planning.household import PlanningError

Y = 2024


def _retiree(**kw):
    return Household(
        people=[Person("Alex", 62, None, kw.pop("life", 92), 0)], filing_status="single",
        accounts=[Account("IRA", kw.pop("ira", 1_400_000), TAX_DEFERRED, "Alex"),
                  Account("Brokerage", kw.pop("taxable", 400_000), TAXABLE, basis=250_000),
                  Account("Roth", kw.pop("roth", 200_000), ROTH, "Alex")],
        expenses=[Expense("Living", kw.pop("spend", 85_000))], **kw)


# ── The gross-up bug this phase exposed ──────────────────────────────────────────────────────────
def test_a_large_conversion_is_always_actually_funded():
    """REGRESSION. The gross-up loop ended each non-converging pass with `_undo()`, so when it
    exhausted its iterations the withdrawals had been REVERSED while `drawn` still held the stale
    amount. The year's tax was treated as funded from money that had been put back — assets ROSE and
    the shortfall read zero. It silently created money.

    It surfaced only as a non-monotonic strategy ranking: converting MORE paid more tax and somehow
    ended with $1.69M more assets. Conservation is the real check.
    """
    h = _retiree()
    big = {t: 191_950.0 for t in range(8)}
    r = project(h, tax_year=Y, conversions=big)
    for y in r.years:
        if y.roth_conversion > 0 and y.total_tax > 0 and y.wage_income == 0:
            funded = y.total_withdrawn + y.other_income + y.rmd
            needed = y.expenses + y.total_tax + y.goal_outflows
            assert funded >= needed - y.shortfall - 1.0, (
                f"year {y.year_offset}: ${needed:,.0f} needed, only ${funded:,.0f} funded and no "
                f"shortfall recorded — the tax was paid from money that was put back")


def test_conservation_holds_through_a_conversion():
    """With no growth and no spending, assets must fall by EXACTLY the tax paid."""
    h = Household(
        people=[Person("A", 70, None, 72, 0)], filing_status="single",
        accounts=[Account("IRA", 500_000, TAX_DEFERRED, "A", annual_return=0.0),
                  Account("Roth", 0, ROTH, "A", annual_return=0.0)],
        expenses=[])
    r = project(h, tax_year=Y, inflation=0.0, conversions={0: 100_000})
    assert r.terminal_assets == pytest.approx(500_000 - r.lifetime_tax, abs=2.0)


def test_conversion_benefit_is_single_peaked_not_monotonic():
    """THE ACTUAL ECONOMICS, and worth stating because the naive expectation is wrong in both
    directions.

    Converting is not uniformly good or uniformly bad — there is an interior optimum. A modest
    conversion fills cheap brackets that would otherwise go unused and removes balance from future
    RMDs, so it HELPS. A large one pays today's higher rate on money that would have been taxed at a
    lower rate later, so it HURTS. Measured here: $759k with no conversions, $849k at $50k/yr,
    $553k at $120k/yr, $293k at $200k/yr.

    This matters for the tests as much as the product: my first version of this asserted monotonic
    decline and failed, which is how the shape got pinned down. Past the peak the decline MUST be
    monotonic, and that is the part a bug would break — it is what exposed the gross-up
    money-creation bug.
    """
    h = _retiree()
    totals = {}
    for annual in (0, 30_000, 120_000, 200_000):
        conv = {t: float(annual) for t in range(8)} if annual else None
        totals[annual] = project(h, tax_year=Y, conversions=conv).terminal_assets

    assert totals[30_000] > totals[0], "a modest ladder fills cheap brackets and pays off"
    # Past the peak, strictly decreasing — more tax paid earlier at higher rates.
    assert totals[30_000] > totals[120_000] > totals[200_000]


def test_a_conversion_shrinks_the_later_rmd():
    """The mechanism the strategy exists for: money moved out of tax-deferred is not there to be
    forced out at 73."""
    h = Household(
        people=[Person("Alex", 62, None, 92, 0)], filing_status="single",
        accounts=[Account("IRA", 1_500_000, TAX_DEFERRED, "Alex"), Account("Roth", 0, ROTH, "Alex")],
        expenses=[Expense("Living", 60_000)])
    base = project(h, tax_year=Y)
    conv = project(h, tax_year=Y, conversions={t: 60_000 for t in range(11)})
    rmd_year = next(i for i, y in enumerate(base.years) if y.rmd > 0)
    assert conv.years[rmd_year].rmd < base.years[rmd_year].rmd


def test_the_conversion_is_taxed_in_its_own_year():
    h = _retiree()
    r = project(h, tax_year=Y, conversions={3: 100_000})
    assert r.years[3].roth_conversion == 100_000
    assert r.years[3].federal_tax > r.years[2].federal_tax
    assert any("Roth conversion" in e for e in r.years[3].events)


# ── 2.1 Withdrawal sequencing ────────────────────────────────────────────────────────────────────
def test_sequencing_compares_every_order_and_names_a_winner():
    r = withdrawal_sequencing(_retiree(), tax_year=Y)
    assert len(r.candidates) == 4
    labels = {c.label for c in r.candidates}
    assert "taxable first (conventional)" in labels and "Roth first" in labels
    assert r.best.label in labels and r.verdict


def test_the_conventional_order_is_not_always_best():
    """THE REASON TO MEASURE. Which order wins is not predictable from a rule of thumb — it depends
    on the balances, the brackets, the RMDs and the growth rate interacting over a lifetime.

    NOTE this conclusion CHANGED when capital gains on taxable withdrawals started being taxed, as
    it had to: taxable-first was previously drawing from an account whose gains were free. That is
    exactly why the gap mattered — sequencing is the output most exposed to it.
    """
    r = withdrawal_sequencing(_retiree(), tax_year=Y)
    assert r.best.label != "taxable first (conventional)"
    assert r.margin > 0
    assert r.material is True


def test_more_lifetime_tax_means_fewer_assets_ONLY_without_growth():
    """A bad invariant, worth recording because I used it as a sanity check and it is false.

    With zero growth, more tax must mean fewer assets — and it does. WITH growth it does not: a
    strategy can pay more total tax and still end richer, because the tax was paid LATER on a larger
    base that compounded in the meantime. Any "more tax is always worse" check would report a bug
    where the finance is simply non-obvious.
    """
    flat = Household(
        people=[Person("A", 62, None, 72, 0)], filing_status="single",
        accounts=[Account("IRA", 600_000, TAX_DEFERRED, "A", annual_return=0.0),
                  Account("Brokerage", 300_000, TAXABLE, basis=150_000, annual_return=0.0),
                  Account("Roth", 200_000, ROTH, "A", annual_return=0.0)],
        expenses=[Expense("Living", 70_000, inflation_adjusted=False)])
    r = withdrawal_sequencing(flat, tax_year=Y)
    ranked = r.ranked
    for a, b in zip(ranked, ranked[1:]):
        if abs(a.lifetime_tax - b.lifetime_tax) > 100:
            assert a.lifetime_tax <= b.lifetime_tax, (
                "without growth, the better-ranked order must not pay more tax")


def test_the_ledger_conserves_across_every_withdrawal_order():
    """THE CHECK THAT ACTUALLY PROVES CORRECTNESS. Ending assets + lifetime tax + total spending
    must equal the starting balance when nothing grows. Any order that violates it is creating or
    destroying money — which both the gross-up bugs did."""
    def flat():
        return Household(
            people=[Person("A", 62, None, 72, 0)], filing_status="single",
            accounts=[Account("IRA", 600_000, TAX_DEFERRED, "A", annual_return=0.0),
                      Account("Brokerage", 300_000, TAXABLE, basis=150_000, annual_return=0.0),
                      Account("Roth", 200_000, ROTH, "A", annual_return=0.0)],
            expenses=[Expense("Living", 70_000, inflation_adjusted=False)])

    from app.services.planning.strategies import _ORDERS, _with_order
    for label, order in _ORDERS.items():
        r = project(_with_order(flat(), order), tax_year=Y, inflation=0.0)
        total = r.terminal_assets + r.lifetime_tax + sum(y.expenses for y in r.years)
        assert total == pytest.approx(1_100_000, abs=5.0), f"{label}: ${total:,.2f}"


def test_each_candidate_starts_from_the_same_balances():
    """The ledger MUTATES account balances, so sharing accounts between runs would make each
    candidate start from the previous one's ending position — and the ranking would depend on
    dict order."""
    h = _retiree()
    before = [a.balance for a in h.accounts]
    withdrawal_sequencing(h, tax_year=Y)
    assert [a.balance for a in h.accounts] == before


def test_sequencing_states_what_it_does_not_score():
    r = withdrawal_sequencing(_retiree(), tax_year=Y)
    joined = " ".join(r.notes)
    assert "heirs" in joined and "10%" in joined


# ── 2.2 Roth conversion ladder ───────────────────────────────────────────────────────────────────
def test_the_ladder_window_is_the_years_before_rmds():
    """The gap the strategy exploits: wages have stopped, RMDs have not started, brackets are at
    their emptiest."""
    r = roth_conversion_ladder(_retiree(), tax_year=Y)
    filled = next(c for c in r.candidates if c.label != "no conversions")
    assert filled.detail["window_years"] == 73 - 62


def test_an_aggressive_ladder_is_worse_than_doing_nothing():
    """The nuanced answer a single recommendation cannot give. Filling the 24% bracket pays today's
    higher rate on money that would have been taxed lower later, so it is WORSE than not converting
    at all — while a modest ladder can pay off (see the sweep test below for the shape).

    The optimum moved once capital gains on taxable withdrawals started being taxed, because the
    ladder's tax is funded partly from the brokerage. That is the correct sensitivity, not noise.
    """
    r = roth_conversion_ladder(_retiree(), tax_year=Y)
    by = {c.label: c for c in r.candidates}
    assert by["fill the 24% bracket"].terminal_assets < by["no conversions"].terminal_assets
    assert by["fill the 22% bracket"].terminal_assets < by["no conversions"].terminal_assets


def test_a_higher_ceiling_converts_more():
    r = roth_conversion_ladder(_retiree(), tax_year=Y)
    totals = {c.label: c.detail.get("converted_total", 0.0) for c in r.candidates}
    assert totals["fill the 12% bracket"] < totals["fill the 22% bracket"]
    assert totals["no conversions"] == 0.0


def test_the_ladder_refuses_when_there_is_no_window():
    """Converting after RMDs begin stacks income on top of a forced distribution — the opposite of
    the strategy."""
    h = Household(
        people=[Person("Ray", 75, None, 92, 0)], filing_status="single",
        accounts=[Account("IRA", 800_000, TAX_DEFERRED, "Ray"), Account("Roth", 0, ROTH, "Ray")],
        expenses=[Expense("Living", 50_000)])
    with pytest.raises(PlanningError, match="no conversion window"):
        roth_conversion_ladder(h, tax_year=Y)


def test_the_ladder_states_what_it_does_not_model():
    r = roth_conversion_ladder(_retiree(), tax_year=Y)
    joined = " ".join(r.notes)
    assert "5-year rule" in joined and "IRMAA" in joined


# ── 2.3 Social Security claiming ─────────────────────────────────────────────────────────────────
@pytest.mark.parametrize("age,expected", [(62, 0.70), (63, 0.75), (67, 1.00), (70, 1.24)])
def test_claiming_factors_match_the_statutory_formula(age, expected):
    """5/9 of 1% per month for the first 36 months early, 5/12 beyond; 2/3 of 1% per month delayed.
    At 62 against an FRA of 67 that is exactly a 30% reduction; at 70, a 24% increase."""
    assert claiming_factor(age) == pytest.approx(expected, abs=0.005)


def test_no_credit_accrues_after_seventy():
    assert claiming_factor(71) == claiming_factor(70)
    assert claiming_factor(75) == claiming_factor(70)


def test_claiming_before_sixty_two_is_refused():
    with pytest.raises(PlanningError, match="cannot be claimed before 62"):
        claiming_factor(60)


def test_each_claiming_age_uses_an_actuarially_adjusted_benefit():
    """Comparing ages at the SAME benefit would be meaningless."""
    h = _retiree(ira=900_000, taxable=0, roth=0, spend=70_000)
    r = social_security_claiming(h, owner="Alex", primary_insurance_amount=36_000, tax_year=Y)
    by = {c.label: c.detail["annual_benefit"] for c in r.candidates}
    assert by["claim at 62"] == pytest.approx(36_000 * 0.70, abs=1)
    assert by["claim at 70"] == pytest.approx(36_000 * 1.24, abs=1)


def test_claiming_replaces_any_existing_social_security_source():
    """Otherwise each candidate would receive TWO benefits and every answer would be wrong."""
    h = _retiree(ira=900_000, taxable=0, roth=0, spend=70_000)
    h.income_sources = [IncomeSource("Social Security", 20_000, "Alex", 62)]
    r = social_security_claiming(h, owner="Alex", primary_insurance_amount=36_000, tax_year=Y)
    assert r.best.detail["annual_benefit"] != pytest.approx(20_000, abs=1)


def test_a_zero_benefit_is_refused():
    with pytest.raises(PlanningError, match="greater than zero"):
        social_security_claiming(_retiree(), owner="Alex", primary_insurance_amount=0, tax_year=Y)


# ── Ranking must discriminate even when every candidate fails ────────────────────────────────────
def test_a_failing_plan_is_still_ranked_by_how_badly_it_fails():
    """THE BUG THIS FIXES. When every candidate depletes, terminal assets is $0 for all of them, so
    the comparison collapsed and the strategy reported "$0 margin — either is defensible" for
    options that differed by hundreds of thousands in unfunded spending. The underfunded household
    is the one that needs the advice most."""
    h = _retiree(ira=900_000, taxable=0, roth=0, spend=70_000, life=90)
    r = social_security_claiming(h, owner="Alex", primary_insurance_amount=36_000, tax_year=Y)
    assert all(c.depleted_year is not None for c in r.candidates), "fixture must fail everywhere"
    assert r.material is True
    assert r.best.label == "claim at 70", "more lifetime benefit for someone living to 90"
    assert r.best.total_shortfall < r.baseline.total_shortfall
    assert "unfunded" in r.verdict


def test_surviving_always_beats_depleting_whatever_the_dollar_margin():
    h = _retiree()
    r = withdrawal_sequencing(h, tax_year=Y)
    survivors = [c for c in r.ranked if c.depleted_year is None]
    failures = [c for c in r.ranked if c.depleted_year is not None]
    if survivors and failures:
        assert r.ranked.index(survivors[-1]) < r.ranked.index(failures[0])


def test_an_immaterial_margin_says_so_rather_than_implying_precision():
    """A small lifetime difference is noise against the return and longevity assumptions. Saying
    "pick either" is the true and useful answer, and one no planning tool volunteers."""
    r = withdrawal_sequencing(_retiree(), tax_year=Y,
                              orders={"taxable first (conventional)": (TAXABLE, TAX_DEFERRED, ROTH, "hsa"),
                                      "same again": (TAXABLE, TAX_DEFERRED, ROTH, "hsa")})
    assert r.material is False
    assert "inside the noise" in r.verdict or "already the best" in r.verdict


# ── Reporting ────────────────────────────────────────────────────────────────────────────────────
def test_every_strategy_result_is_json_serializable():
    import json
    h = _retiree()
    for r in (withdrawal_sequencing(h, tax_year=Y),
              roth_conversion_ladder(h, tax_year=Y),
              social_security_claiming(h, owner="Alex", primary_insurance_amount=30_000,
                                       tax_year=Y)):
        d = r.as_dict()
        json.dumps(d)
        assert d["ranked"] and d["verdict"] and d["question"]
        assert "material" in d and d["notes"]


def test_the_tax_basis_propagates_to_every_strategy():
    h = _retiree()
    r = withdrawal_sequencing(h, tax_year=2026)
    assert r.tax_year == 2024 and r.tax_basis_is_current_year is False
