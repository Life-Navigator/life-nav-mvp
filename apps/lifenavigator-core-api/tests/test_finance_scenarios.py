"""Deterministic finance scenario engine — exact arithmetic, no fabrication (matches the sprint JSON example)."""
import pytest
from app.models.common import UserContext
from app.services.finance_scenarios import FinanceScenarioEngine

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")

# Terrance-style summary (the sprint's known_facts)
SUMMARY = {
    "cash_balance": 203200, "investment_balance": 920000, "retirement_accounts_total": 410000,
    "total_assets": 1533200, "total_liabilities": 1243120, "net_worth": 290080,
    "accounts_count": 5, "source": "Synthetic beta persona",
}


class _Resolver:
    def __init__(self, summary):
        self._s = summary
    async def summary(self, ctx):
        return self._s


def _engine(summary=SUMMARY):
    return FinanceScenarioEngine(None, _Resolver(summary))


@pytest.mark.asyncio
async def test_net_worth_is_deterministic_from_summary():
    out = await _engine().compute(CTX)
    nw = out["net_worth"]
    assert nw["value"] == 290080
    assert nw["total_assets"] == 1533200
    assert nw["total_liabilities"] == 1243120
    assert nw["available"] is True


@pytest.mark.asyncio
async def test_down_payment_scenarios_match_home_price_goal():
    out = await _engine().compute(CTX, home_price_goal=500000)
    tiers = out["down_payment"]["tiers"]
    assert tiers["pct_5"]["amount"] == 25000
    assert tiers["pct_10"]["amount"] == 50000
    assert tiers["pct_20"]["amount"] == 100000
    assert tiers["pct_5"]["pmi_likely"] is True   # <20% → PMI
    assert tiers["pct_20"]["pmi_likely"] is False
    assert tiers["pct_5"]["cash_remaining_after"] == 203200 - 25000


@pytest.mark.asyncio
async def test_no_fabrication_when_expenses_missing():
    out = await _engine().compute(CTX)  # no monthly_expenses
    ef = out["emergency_fund"]
    assert ef["needs_expense_budget"] is True
    assert ef["target_low"] is None and ef["target_high"] is None  # NOT a guessed default
    assert ef["current_cash"] == 203200
    cf = out["cash_flow"]
    assert cf["needs_expense_budget"] is True and cf["monthly_surplus"] is None
    assert out["down_payment"] == {"needs_home_price_goal": True}  # honest gap, no goal given
    assert out["affordability_band"] == {"needs_income": True}


@pytest.mark.asyncio
async def test_emergency_fund_range_when_expenses_known():
    out = await _engine().compute(CTX, monthly_expenses=8000)
    ef = out["emergency_fund"]
    assert ef["target_low"] == 24000 and ef["target_high"] == 48000  # 3–6 months
    assert ef["months_covered"] == round(203200 / 8000, 2)
    assert ef["needs_expense_budget"] is False


@pytest.mark.asyncio
async def test_debt_payoff_and_savings_target_arithmetic():
    out = await _engine({**SUMMARY, "total_liabilities": 32000}).compute(
        CTX, monthly_debt_payment=1000, savings_goal_amount=24000, savings_goal_months=12)
    assert out["debt_payoff"]["months_to_payoff"] == 32  # 32000/1000
    assert out["savings_target"]["monthly_required"] == 2000  # 24000/12


@pytest.mark.asyncio
async def test_allowed_numbers_include_computed_figures():
    out = await _engine().compute(CTX, home_price_goal=500000)
    an = set(out["allowed_numbers"])
    assert "290080" in an and "25000" in an and "100000" in an  # net worth + down-payment tiers grounded
    assert any("advice" in c.lower() for c in out["constraints"])


@pytest.mark.asyncio
async def test_no_finance_data_degrades_cleanly():
    out = await _engine({}).compute(CTX)
    assert out["available"] is False
    assert out["net_worth"]["value"] is None  # nothing invented


# ---- context grounding helpers ----
def test_parse_money_and_finance_detection():
    from app.services.advisor_context import _parse_money, _mentions_finance
    assert _parse_money("Can I afford a $500K house?") == 500000
    assert _parse_money("thinking about a 750,000 home") == 750000
    assert _parse_money("what is a 529?") is None   # no housing word → no home price
    assert _parse_money("explain PMI") is None
    assert _mentions_finance("what should my emergency fund be?") is True
    assert _mentions_finance("how's my workout plan?") is False


def test_prompt_dict_exposes_finance_scenarios():
    from app.services.advisor_context import AdvisorContext
    c = AdvisorContext(
        user_id="u", user_message="m", current_stage="complete", life_vision=None, primary_objective=None,
        candidate_goals=[], rejected_goals=[], risks=[], opportunities=[], constraints=[], domains_touched=[],
        missing_areas=[], discovery_pct=0, allowed_numbers=set(),
        finance_scenarios={"net_worth": {"value": 290080}, "available": True},
    )
    pd = c.prompt_dict()
    assert pd["finance_scenarios"]["net_worth"]["value"] == 290080
