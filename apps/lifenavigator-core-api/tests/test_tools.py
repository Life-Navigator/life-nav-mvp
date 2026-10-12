"""Sprint 38 — deterministic tool platform: same input = same output, cited assumptions, no fabrication."""
from __future__ import annotations

import pytest

from app.models.common import UserContext
from app.services.tools import (REGISTRY, ToolInputError, ToolRunner, debt_payoff, degree_roi,
                                emergency_fund, home_affordability, k401_match,
                                retirement_projection)
from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")


def test_determinism_same_input_same_output():
    i = {"monthly_expenses": 5000, "current_cash": 12000, "target_months": 6}
    assert emergency_fund(i) == emergency_fund(i)  # pure
    r = emergency_fund(i)
    assert r["outputs"]["target"] == 30000 and r["outputs"]["gap"] == 18000 and r["deterministic"] is True


def test_k401_match_is_exact_math():
    r = k401_match({"income": 192000, "current_rate": 3, "employer_match_rate": 6})
    assert r["outputs"]["uncaptured_match_annual"] == 192000 * 3 / 100  # exact, no LLM
    assert r["outputs"]["capturing_full_match"] is False


def test_home_affordability_uses_dti_and_mortgage_math():
    r = home_affordability({"annual_income": 192000, "monthly_debts": 500, "down_payment": 40000, "rate": 6.5, "term_years": 30})
    assert r["outputs"]["max_home_price"] > 40000 and r["outputs"]["max_monthly_payment"] > 0
    assert any(a.get("key") == "mortgage_rate" or "DTI" in str(a.get("label", "")) for a in r["assumptions"])
    assert r["limitations"]  # states what it excludes (taxes/PMI/etc.)


def test_debt_payoff_avalanche_orders_by_apr():
    r = debt_payoff({"method": "avalanche", "extra_payment": 300,
                     "debts": [{"name": "card", "balance": 5000, "apr": 22, "min_payment": 100},
                               {"name": "auto", "balance": 12000, "apr": 6, "min_payment": 250}]})
    assert r["outputs"]["order"][0] == "card"  # highest APR first
    assert r["outputs"]["months_to_debt_free"] > 0


def test_degree_roi_includes_opportunity_cost():
    r = degree_roi({"tuition_total": 120000, "years_in_school": 2, "salary_before": 90000, "salary_after": 150000})
    assert r["outputs"]["lost_wages"] == 180000  # 90k x 2 years opportunity cost
    assert r["outputs"]["total_cost"] == 300000 and r["outputs"]["payback_years"] is not None


def test_retirement_projection_deterministic_and_cited():
    i = {"current_age": 40, "retirement_age": 65, "current_assets": 80000, "annual_contribution": 12000, "income": 150000}
    a, b = retirement_projection(i), retirement_projection(i)
    assert a == b and a["outputs"]["projected_assets"] > 80000
    assert any(x.get("key") == "investment_return" for x in a["assumptions"])


def test_edge_cases_no_fabrication():
    """Phase A strengthened this: no inputs now RAISES rather than returning a low-confidence zero.

    The original assertion (`confidence < 0.5`) encoded the weaker guarantee. A $0 emergency-fund
    target with "0.0 months covered" is a fabricated finding about the user whatever confidence is
    attached to it, and a low number in a `confidence` field is not something a reader of the figure
    ever sees. Refusing to answer, and naming the input needed, is the honest version.
    """
    with pytest.raises(ToolInputError, match="monthly_expenses is required"):
        emergency_fund({})
    # A present-but-unparseable value is also a question, never a zero.
    with pytest.raises(ToolInputError, match="is not a number"):
        emergency_fund({"monthly_expenses": "around 4k", "current_cash": 0})
    # An explicit empty debt list is a real answer, not a missing input — that distinction stands.
    assert debt_payoff({"debts": []})["outputs"]["available"] is False


def test_zero_is_accepted_where_it_is_a_real_answer_and_refused_where_it_is_not():
    """`allow_zero` draws the line: $0 of cash is a fact; $0 of monthly expenses is a divisor."""
    ok = emergency_fund({"monthly_expenses": 3000, "current_cash": 0})
    assert ok["outputs"]["months_covered"] == 0.0 and ok["outputs"]["gap"] == 18000.0
    with pytest.raises(ToolInputError, match="must be greater than zero"):
        emergency_fund({"monthly_expenses": 0, "current_cash": 5000})


def test_ui_decorated_values_still_parse():
    """"$4,000" and "6%" are real inputs from a form, not errors."""
    out = emergency_fund({"monthly_expenses": "$4,000", "current_cash": "12,000"})
    assert out["outputs"]["target"] == 24000.0


def test_formerly_inline_assumptions_are_now_cited():
    """R2: five values were hardcoded in this module. Each must now appear in the lineage."""
    ha = home_affordability({"annual_income": 150000, "monthly_debts": 500, "down_payment": 60000})
    keys = {a.get("key") for a in ha["assumptions"] if isinstance(a, dict)}
    assert {"dti_front_pct", "dti_back_pct", "mortgage_term_months"} <= keys

    rp = retirement_projection({"current_age": 40, "current_assets": 100000,
                                "annual_contribution": 12000, "income": 150000})
    assert "retirement_age" in {a.get("key") for a in rp["assumptions"] if isinstance(a, dict)}

    dr = degree_roi({"tuition_total": 80000, "years_in_school": 2,
                     "salary_before": 90000, "salary_after": 140000})
    assert "working_years_horizon" in {a.get("key") for a in dr["assumptions"] if isinstance(a, dict)}
    assert dr["outputs"]["horizon_years"] == 25


def test_retirement_projection_omits_the_target_when_income_is_unknown():
    """Two questions, one tool. Without income the balance still projects; the TARGET must be None
    rather than $0, which would read as 'fully funded'."""
    out = retirement_projection({"current_age": 40, "current_assets": 100000,
                                 "annual_contribution": 12000})["outputs"]
    assert out["projected_assets"] > 100000
    assert out["target_nest_egg"] is None
    assert out["funding_gap"] is None
    assert out["readiness_ratio"] is None
    assert out["on_track"] is None


@pytest.mark.asyncio
async def test_runner_persists_and_returns_run_id():
    runner = ToolRunner(FakeSupabase({}))
    out = await runner.run(CTX, "emergency_fund", {"monthly_expenses": 4000, "current_cash": 8000})
    assert out["tool_run_id"] and out["tool"] == "emergency_fund" and out["outputs"]["target"] == 24000


def test_catalog_lists_every_registered_tool():
    cat = ToolRunner.catalog()
    names = {t["name"] for t in cat}
    assert {"emergency_fund", "debt_payoff", "home_affordability", "retirement_projection", "degree_roi", "offer_comparison"} <= names
    assert len(cat) == len(REGISTRY)
