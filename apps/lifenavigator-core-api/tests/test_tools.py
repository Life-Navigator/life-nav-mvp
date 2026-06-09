"""Sprint 38 — deterministic tool platform: same input = same output, cited assumptions, no fabrication."""
from __future__ import annotations

import pytest

from app.models.common import UserContext
from app.services.tools import REGISTRY, ToolRunner, emergency_fund, debt_payoff, home_affordability, retirement_projection, k401_match, degree_roi
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
    assert emergency_fund({})["confidence"] < 0.5  # no inputs -> low confidence, not a fake number
    assert debt_payoff({"debts": []})["outputs"]["available"] is False


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
