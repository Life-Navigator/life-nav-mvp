"""Sprint 37 — Scenario Intelligence: deterministic future comparison + objective impacts + tradeoffs."""
from __future__ import annotations

import pytest

from app.models.common import UserContext
from app.services.life_discovery import LifeDiscoveryService
from app.services.scenario_compare import SCENARIO_SETS, ScenarioComparisonEngine
from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")


def _engine(sb):
    return ScenarioComparisonEngine(readiness=None, life=LifeDiscoveryService(sb), supabase=sb)


async def _seed_family_and_fi(sb):
    life = LifeDiscoveryService(sb)
    await life.discover_goal(CTX, surface_goal="buy a house", why_chain=[{"a": "we want children and to raise a family"}])
    await life.discover_goal(CTX, surface_goal="retire early", why_chain=[{"a": "freedom and independence"}])


@pytest.mark.asyncio
async def test_housing_tradeoffs_against_user_objectives():
    sb = FakeSupabase({})
    await _seed_family_and_fi(sb)
    c = await _engine(sb).compare(CTX, "housing")
    buy = next(s for s in c["scenarios"] if s["scenario_id"] == "buy_now")
    paydebt = next(s for s in c["scenarios"] if s["scenario_id"] == "pay_debt_first")
    fam = next(i for i in buy["objective_impacts"] if i["root"] == "family_stability")
    fi_buy = next(i for i in buy["objective_impacts"] if i["root"] == "financial_independence")
    fi_pay = next(i for i in paydebt["objective_impacts"] if i["root"] == "financial_independence")
    # the D5 example: buy-now helps family, hurts FI; pay-debt helps FI most
    assert fam["score"] > 0 and fi_buy["score"] < 0 and fi_pay["score"] > fi_buy["score"]
    # D6: explicit tradeoffs, never inferred
    assert "Emergency fund" in buy["tradeoffs"]["worsens"] and buy["tradeoffs"]["improves"]


@pytest.mark.asyncio
async def test_missing_input_lowers_confidence_no_fabrication():
    sb = FakeSupabase({})
    await _seed_family_and_fi(sb)
    c = await _engine(sb).compare(CTX, "housing")
    buy = next(s for s in c["scenarios"] if s["scenario_id"] == "buy_now")
    assert "home_price" in buy["missing_inputs"] and buy["confidence"] < 0.85  # missing input -> lower confidence
    # with the home price present, confidence rises
    sb2 = FakeSupabase({"documents": [{"id": "h", "user_id": CTX.user_id, "doc_type": "home_price"}]})
    await _seed_family_and_fi(sb2)
    c2 = await _engine(sb2).compare(CTX, "housing")
    buy2 = next(s for s in c2["scenarios"] if s["scenario_id"] == "buy_now")
    assert buy2["confidence"] >= buy["confidence"]


@pytest.mark.asyncio
async def test_assumptions_are_cited_from_registry():
    sb = FakeSupabase({})
    await _seed_family_and_fi(sb)
    c = await _engine(sb).compare(CTX, "housing")
    buy = next(s for s in c["scenarios"] if s["scenario_id"] == "buy_now")
    keys = {a["key"] for a in buy["assumptions"]}
    assert "down_payment_pct" in keys and all(a.get("basis") for a in buy["assumptions"])  # cited, not bare


@pytest.mark.asyncio
async def test_deterministic_same_input_same_output():
    sb = FakeSupabase({})
    await _seed_family_and_fi(sb)
    a = await _engine(sb).compare(CTX, "housing")
    b = await _engine(sb).compare(CTX, "housing")
    assert [s["net_objective_score"] for s in a["scenarios"]] == [s["net_objective_score"] for s in b["scenarios"]]


@pytest.mark.asyncio
async def test_every_scenario_variant_is_well_formed():
    """D15: cover every variant across all sets (housing/retirement/education/debt/career) — 11 futures."""
    sb = FakeSupabase({})
    await _seed_family_and_fi(sb)
    eng = _engine(sb)
    total = 0
    for set_key in SCENARIO_SETS:
        c = await eng.compare(CTX, set_key)
        assert c["question"] and c["scenarios"]
        for s in c["scenarios"]:
            total += 1
            assert s["objective_impacts"] and s["tradeoffs"]["improves"] and s["tradeoffs"]["worsens"]
            assert 0.0 <= s["confidence"] <= 1.0
            assert isinstance(s["net_objective_score"], (int, float))
    assert total >= 11  # all competing futures across the required domains


# ---- Sprint 39: scenarios draw their numbers from the deterministic tools ----
def _engine_with_tools(sb):
    from app.services.tools import ToolRunner
    return ScenarioComparisonEngine(readiness=None, life=LifeDiscoveryService(sb), supabase=sb, tools=ToolRunner(sb), comp=None)


@pytest.mark.asyncio
async def test_retirement_scenarios_carry_tool_calculations():
    sb = FakeSupabase({"documents": [{"id": "k", "user_id": CTX.user_id, "doc_type": "401k_statement", "extracted_json": {"total_balance": "80000"}}]})
    await LifeDiscoveryService(sb).discover_goal(CTX, surface_goal="retire early", why_chain=[{"a": "freedom and independence"}])
    c = await _engine_with_tools(sb).compare(CTX, "retirement_timing")
    r55 = next(s for s in c["scenarios"] if s["scenario_id"] == "retire_55")
    r65 = next(s for s in c["scenarios"] if s["scenario_id"] == "retire_65")
    # each scenario carries a deterministic retirement_projection tool run
    assert r55["tool_calculations"] and r55["tool_calculations"][0]["tool"] == "retirement_projection"
    assert "tool_run_id" in r55["tool_calculations"][0] and r55["tool_calculations"][0]["calculation"]
    # retiring at 65 projects more assets than at 55 (deterministic, tool-derived difference)
    a55 = r55["tool_calculations"][0]["outputs"]["projected_assets"]
    a65 = r65["tool_calculations"][0]["outputs"]["projected_assets"]
    assert a65 > a55


@pytest.mark.asyncio
async def test_housing_scenario_runs_home_affordability_tool():
    sb = FakeSupabase({})
    await LifeDiscoveryService(sb).discover_goal(CTX, surface_goal="buy a house", why_chain=[{"a": "we want children"}])
    c = await _engine_with_tools(sb).compare(CTX, "housing")
    buy = next(s for s in c["scenarios"] if s["scenario_id"] == "buy_now")
    assert any(t["tool"] == "home_affordability" for t in buy["tool_calculations"])
