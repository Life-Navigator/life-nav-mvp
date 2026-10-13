"""The tax- and planning-critical resolver inputs (2026-10-12).

Each resolves from a REAL column that already existed. The tests that matter most are the ones
about what happens when data is INCOMPLETE, because the whole value of this resolver is that it
names a gap instead of deducting, deducting zero, or quietly halving someone's obligations.
"""
from __future__ import annotations

import pytest

from app.models.common import UserContext
from app.services.financial_resolver import FinancialInputResolver

from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")
U = CTX.user_id


async def _resolve(**tables):
    return await FinancialInputResolver(FakeSupabase(tables)).resolve(CTX)


# ── Monthly debt service: the direction of error that matters ────────────────────────────────────
@pytest.mark.asyncio
async def test_monthly_debts_sums_all_three_debt_tables():
    """Asset-backed loans, non-asset debts and liabilities each live in their own table, and a
    borrower's obligations are the sum. Reading one would understate them."""
    r = await _resolve(
        asset_loans=[{"user_id": U, "loan_type": "mortgage", "current_balance": 300_000,
                      "monthly_payment": 1_900, "interest_rate": 0.065}],
        debts=[{"user_id": U, "debt_name": "card", "current_balance": 8_000,
                "minimum_payment": 200, "interest_rate": 0.2199}],
        liabilities=[{"user_id": U, "name": "student loan", "balance": 20_000,
                      "minimum_payment": 250, "interest_rate": 0.055}],
    )
    assert r["inputs"]["monthly_debts"]["present"] is True
    assert r["inputs"]["monthly_debts"]["value"] == pytest.approx(2_350)


@pytest.mark.asyncio
async def test_a_debt_with_an_UNKNOWN_payment_makes_the_whole_input_missing():
    """THE DIRECTION OF ERROR THIS GUARDS. `monthly_debts` is SUBTRACTED from borrowing capacity,
    so omitting a debt OVERSTATES how much house someone can afford — the one error a buyer never
    catches, because the answer is flattering. A partial sum is therefore not reported at all.
    """
    r = await _resolve(
        debts=[{"user_id": U, "debt_name": "card", "current_balance": 8_000,
                "minimum_payment": 200},
               {"user_id": U, "debt_name": "medical", "current_balance": 4_000}],
    )
    f = r["inputs"]["monthly_debts"]
    assert f["present"] is False, "a partial total must not be presented as a total"
    assert "medical" in f["prompt"]
    assert "overstate" in f["prompt"]
    assert r["caveats"]["debts_missing_payment"] == ["medical"]


@pytest.mark.asyncio
async def test_being_DEBT_FREE_is_a_known_answer_not_a_missing_one():
    """Zero is real and knowable, and `_field` treats 0 as absent — so `present` is passed
    explicitly. Without that, the borrower in the BEST position would be told their debt figure
    was missing and home affordability would never compute."""
    r = await _resolve(
        financial_accounts=[{"user_id": U, "account_type": "checking", "current_balance": 9_000}],
        debts=[{"user_id": U, "debt_name": "paid off card", "current_balance": 0,
                "minimum_payment": None}],
    )
    f = r["inputs"]["monthly_debts"]
    assert f["present"] is True and f["value"] == 0.0
    assert r["caveats"]["debts_missing_payment"] == [], "a cleared debt owes no payment"


@pytest.mark.asyncio
async def test_no_debt_data_at_all_is_missing_rather_than_zero():
    """Distinct from debt-free: we have nothing to go on, so we ask."""
    r = await _resolve()
    assert r["inputs"]["monthly_debts"]["present"] is False


@pytest.mark.asyncio
async def test_both_spellings_of_the_debts_table_are_read():
    """`finance.debts` is defined TWICE in the migrations: 062 uses (current_balance,
    interest_rate) and 117 — whose comment says 062 "was never applied to prod" — uses (balance,
    apr). Both are CREATE TABLE IF NOT EXISTS, so which one production has is not knowable from the
    repo. Reading one spelling would return nothing and, because `_rows` swallows errors, would do
    so SILENTLY: a user with real debt would look debt-free.
    """
    old = await _resolve(debts=[{"user_id": U, "debt_name": "card",
                                 "current_balance": 8_000, "interest_rate": 0.22,
                                 "minimum_payment": 200}])
    new = await _resolve(debts=[{"user_id": U, "debt_name": "card",
                                 "balance": 8_000, "apr": 0.22,
                                 "minimum_payment": 200}])
    assert old["inputs"]["monthly_debts"]["value"] == new["inputs"]["monthly_debts"]["value"] == 200
    for r in (old, new):
        row = r["inputs"]["debt_minimum_payments"]["value"][0]
        assert row["balance"] == 8_000 and row["apr"] == pytest.approx(0.22)


@pytest.mark.asyncio
async def test_an_inactive_debt_is_excluded():
    r = await _resolve(debts=[{"user_id": U, "debt_name": "closed", "current_balance": 5_000,
                               "minimum_payment": 100, "is_active": False}],
                       liabilities=[{"user_id": U, "name": "open", "balance": 1_000,
                                     "minimum_payment": 50}])
    assert r["inputs"]["monthly_debts"]["value"] == 50


# ── Capital gain: unrealized, and split by holding period ────────────────────────────────────────
@pytest.mark.asyncio
async def test_capital_gain_is_value_minus_basis_split_long_and_short():
    """Long-term gain is taxed at 0/15/20% and short-term as ordinary income up to 37%, so the
    split is not cosmetic — blending them understates the tax on recent purchases by up to 22
    percentage points."""
    r = await _resolve(investment_holdings=[
        {"user_id": U, "symbol": "VTI", "current_value": 50_000, "cost_basis": 20_000,
         "purchase_date": "2015-03-01"},
        {"user_id": U, "symbol": "NVDA", "current_value": 15_000, "cost_basis": 10_000,
         "purchase_date": "2026-08-01"},
    ])
    i = r["inputs"]
    assert i["capital_gain"]["value"] == pytest.approx(35_000)
    assert i["capital_gain_long_term"]["value"] == pytest.approx(30_000)
    assert i["capital_gain_short_term"]["value"] == pytest.approx(5_000)


@pytest.mark.asyncio
async def test_a_holding_with_no_cost_basis_is_EXCLUDED_and_named():
    """Treating a missing basis as zero would report the entire position as gain — the largest
    possible overstatement of the tax on a sale."""
    r = await _resolve(investment_holdings=[
        {"user_id": U, "symbol": "VTI", "current_value": 50_000, "cost_basis": 20_000,
         "purchase_date": "2015-03-01"},
        {"user_id": U, "symbol": "MYSTERY", "current_value": 90_000},
    ])
    assert r["inputs"]["capital_gain"]["value"] == pytest.approx(30_000)
    assert r["caveats"]["holdings_missing_cost_basis"] == ["MYSTERY"]


@pytest.mark.asyncio
async def test_an_unusable_purchase_date_is_not_assumed_long_term():
    """Long-term is the flattering assumption, so it is never the default: the gain is counted in
    the total and reported separately as unknown-term."""
    r = await _resolve(investment_holdings=[
        {"user_id": U, "symbol": "OLD", "current_value": 10_000, "cost_basis": 4_000,
         "purchase_date": "sometime in 2015"},
    ])
    assert r["inputs"]["capital_gain"]["value"] == pytest.approx(6_000)
    assert r["inputs"]["capital_gain_long_term"]["value"] in (None, 0.0)
    assert r["caveats"]["capital_gain_unknown_term"] == pytest.approx(6_000)


@pytest.mark.asyncio
async def test_a_loss_is_reported_as_a_negative_gain():
    r = await _resolve(investment_holdings=[
        {"user_id": U, "symbol": "DOWN", "current_value": 4_000, "cost_basis": 10_000,
         "purchase_date": "2015-01-01"},
    ])
    assert r["inputs"]["capital_gain"]["value"] == pytest.approx(-6_000)


@pytest.mark.asyncio
async def test_the_gain_is_labelled_unrealized():
    """It is what a sale TODAY would trigger, not what has been realized this year — a distinction
    that decides whether the figure answers a tax question or a planning one."""
    r = await _resolve(investment_holdings=[
        {"user_id": U, "symbol": "VTI", "current_value": 5_000, "cost_basis": 1_000,
         "purchase_date": "2015-01-01"}])
    assert r["caveats"]["capital_gain_is_unrealized"] is True


# ── Savings and expenses ─────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_annual_savings_prefers_MEASURED_cash_flow_over_the_onboarding_figure():
    r = await _resolve(
        cash_flow_snapshots=[{"user_id": U, "period_end": "2026-09-30", "net_cash_flow": 2_000,
                              "total_expenses": 6_000}],
        user_financial_profile=[{"user_id": U, "monthly_discretionary_income": 500,
                                 "monthly_expenses": 9_999}],
    )
    assert r["inputs"]["annual_savings"]["value"] == pytest.approx(24_000)
    assert "cash_flow_snapshots" in r["inputs"]["annual_savings"]["origin"]


@pytest.mark.asyncio
async def test_the_most_recent_cash_flow_period_wins():
    r = await _resolve(cash_flow_snapshots=[
        {"user_id": U, "period_end": "2025-01-31", "net_cash_flow": 100},
        {"user_id": U, "period_end": "2026-09-30", "net_cash_flow": 2_000},
    ])
    assert r["inputs"]["annual_savings"]["value"] == pytest.approx(24_000)


@pytest.mark.asyncio
async def test_savings_falls_back_to_the_stated_discretionary_income():
    r = await _resolve(user_financial_profile=[{"user_id": U,
                                                "monthly_discretionary_income": 1_500}])
    assert r["inputs"]["annual_savings"]["value"] == pytest.approx(18_000)
    assert "user_financial_profile" in r["inputs"]["annual_savings"]["origin"]


@pytest.mark.asyncio
async def test_monthly_expenses_is_now_resolved_so_it_need_not_be_re_asked():
    r = await _resolve(user_financial_profile=[{"user_id": U, "monthly_expenses": 5_200}])
    assert r["inputs"]["monthly_expenses"]["value"] == pytest.approx(5_200)


# ── VA disability, parsed since Sprint 20 and never carried ──────────────────────────────────────
@pytest.mark.asyncio
async def test_the_va_rating_comes_off_the_award_letter():
    """`military.py` has read this field since Sprint 20 and nothing carried it to the advisor, so
    the advisor could not state a veteran's largest, most certain, entirely tax-free income."""
    r = await _resolve(documents=[{"user_id": U, "doc_type": "va_award_letter",
                                   "extracted_json": {"disability_rating": 70}}])
    f = r["inputs"]["va_disability_rating"]
    assert f["present"] is True and f["value"] == 70
    assert "va_award_letter" in f["origin"]


@pytest.mark.asyncio
async def test_a_rating_stored_as_a_FRACTION_is_normalized():
    """Extractors have written both 70 and 0.70. Read literally, 0.7 is not a published rating and
    the rate lookup would refuse — so a veteran with a real award letter would get nothing."""
    r = await _resolve(documents=[{"user_id": U, "doc_type": "va_award_letter",
                                   "extracted_json": {"disability_rating": 0.70}}])
    assert r["inputs"]["va_disability_rating"]["value"] == 70


@pytest.mark.asyncio
async def test_no_award_letter_means_missing_not_zero():
    r = await _resolve()
    assert r["inputs"]["va_disability_rating"]["present"] is False


# ── Itemized components and the child split ──────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_itemized_components_are_the_amounts_PAID_not_a_capped_total():
    """Stored raw so the current year's caps apply on every run. A pre-capped total would freeze
    last year's law into the user's record with nothing downstream able to tell."""
    r = await _resolve(tax_profiles=[{
        "user_id": U, "tax_year": 2026, "filing_status": "married_filing_jointly",
        "state_local_taxes_paid": 60_000, "mortgage_interest_paid": 18_000,
        "charitable_contributions": 6_000, "adjusted_gross_income": 180_000}])
    i = r["inputs"]
    comps = i["itemized_components"]["value"]
    assert comps["state_local_taxes"] == 60_000, "uncapped at the resolver boundary"
    assert "medical_expenses" not in comps, "absent components are omitted, not zeroed"
    assert i["adjusted_gross_income"]["value"] == 180_000
    assert r["caveats"]["itemized_components_absent"] == ["medical_expenses", "other_itemized"]


@pytest.mark.asyncio
async def test_qualifying_children_is_stored_separately_from_dependents():
    """The child credit is $2,200 and the other-dependent credit $500, so treating an adult
    dependent as a child overstates the credit by $1,700 each. The split is never inferred."""
    r = await _resolve(tax_profiles=[{"user_id": U, "tax_year": 2026, "dependents": 3,
                                      "qualifying_children_under_17": 2,
                                      "filing_status": "single"}])
    assert r["inputs"]["dependents"]["value"] == 3
    assert r["inputs"]["qualifying_children"]["value"] == 2


@pytest.mark.asyncio
async def test_dependents_without_the_child_split_leaves_children_missing():
    r = await _resolve(tax_profiles=[{"user_id": U, "tax_year": 2026, "dependents": 3,
                                      "filing_status": "single"}])
    assert r["inputs"]["dependents"]["value"] == 3
    assert r["inputs"]["qualifying_children"]["present"] is False
    assert "$2,200" in r["inputs"]["qualifying_children"]["prompt"]


# ── HSA / FSA, for the tax-treatment rules ───────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_hsa_and_fsa_facts_resolve_for_the_treatment_rules():
    r = await _resolve(user_financial_profile=[{"user_id": U, "hsa_eligible": True,
                                                "hsa_current_balance": 15_000,
                                                "fsa_election_amount": 1_200}])
    i = r["inputs"]
    assert i["hsa_eligible"]["value"] is True
    assert i["hsa_balance"]["value"] == 15_000
    assert i["fsa_election"]["value"] == 1_200


@pytest.mark.asyncio
async def test_hsa_ineligible_is_a_FACT_not_an_absence():
    """False is an answer — it rules the HSA rules out — so it must not read as "we never asked"."""
    r = await _resolve(user_financial_profile=[{"user_id": U, "hsa_eligible": False}])
    assert r["inputs"]["hsa_eligible"]["present"] is True
    assert r["inputs"]["hsa_eligible"]["value"] is False


# ── Nothing regressed ────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_an_empty_profile_names_every_gap_and_invents_nothing():
    r = await _resolve()
    assert r["present_count"] == 0
    assert len(r["missing"]) == r["total"]
    assert all(v["value"] is None for v in r["inputs"].values())


@pytest.mark.asyncio
async def test_every_canonical_input_is_actually_produced_by_the_resolver():
    """Guards the coverage inventory against the resolver: a canonical input the resolver never
    emits would make every calculator that needs it permanently and invisibly unreachable."""
    from app.services.advisor_calc_coverage import CANONICAL_INPUTS

    r = await _resolve()
    missing = set(CANONICAL_INPUTS) - set(r["inputs"])
    assert not missing, f"declared canonical but never resolved: {sorted(missing)}"
