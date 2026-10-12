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
    assert r65["tool_calculations"][0]["skipped"] is True
    # Each scenario still reaches for retirement_projection...
    assert r55["tool_calculations"] and r55["tool_calculations"][0]["tool"] == "retirement_projection"
    # ...but this fixture has no current_age, so the run is SKIPPED and says which input it needs.
    # Phase A: it previously "succeeded" against a hardcoded age of 40 — a stranger's retirement
    # horizon presented as this user's. An honest ask beats a confident wrong number.
    skipped = r55["tool_calculations"][0]
    assert skipped["skipped"] is True
    assert skipped["needs_input"] == "current_age is required"
    assert skipped["tool_run_id"] is None and skipped["calculation"] is None
    # No numbers at all, for either variant — so nothing can be compared, and nothing is invented.
    assert all(t["outputs"] == {} for s_ in c["scenarios"] for t in s_["tool_calculations"])


@pytest.mark.asyncio
async def test_housing_scenario_runs_home_affordability_tool():
    sb = FakeSupabase({})
    await LifeDiscoveryService(sb).discover_goal(CTX, surface_goal="buy a house", why_chain=[{"a": "we want children"}])
    c = await _engine_with_tools(sb).compare(CTX, "housing")
    buy = next(s for s in c["scenarios"] if s["scenario_id"] == "buy_now")
    assert any(t["tool"] == "home_affordability" for t in buy["tool_calculations"])


@pytest.mark.asyncio
async def test_retirement_scenarios_compute_real_numbers_once_age_is_known():
    """The positive half of the Phase A change: with the user's real age present, the deterministic
    run happens for real — a persisted tool_run_id and a stated calculation, no assumed horizon."""
    class _Comp:
        async def analyze(self, _ctx):
            return {"total_compensation": {"base": 120000}}

    sb = FakeSupabase({
        "documents": [{"id": "k", "user_id": CTX.user_id, "doc_type": "401k_statement",
                       "extracted_json": {"total_balance": "80000"}}],
        "life_vision": [{"user_id": CTX.user_id, "prompts": {"current_age": 38}}],
    })
    await LifeDiscoveryService(sb).discover_goal(CTX, surface_goal="retire early",
                                                 why_chain=[{"a": "freedom and independence"}])
    from app.services.tools import ToolRunner
    engine = ScenarioComparisonEngine(readiness=None, life=LifeDiscoveryService(sb), supabase=sb,
                                      tools=ToolRunner(sb), comp=_Comp())
    c = await engine.compare(CTX, "retirement_timing")
    r55 = next(s for s in c["scenarios"] if s["scenario_id"] == "retire_55")
    run = r55["tool_calculations"][0]
    assert run.get("skipped") is not True
    assert run["tool"] == "retirement_projection" and run["tool_run_id"] and run["calculation"]
    assert run["outputs"]["projected_assets"] > 80000           # grew from the real balance
    assert run["outputs"]["years_to_retirement"] == 55 - 38     # the USER's horizon, not an assumed one

    # Retiring later projects more assets — the deterministic, tool-derived difference the old test
    # checked, now verified on real runs instead of on a hardcoded age.
    r65 = next(s_ for s_ in c["scenarios"] if s_["scenario_id"] == "retire_65")
    assert r65["tool_calculations"][0]["outputs"]["projected_assets"] > run["outputs"]["projected_assets"]


@pytest.mark.asyncio
async def test_no_income_means_no_fabricated_degree_roi():
    """`salary_after = income * 1.4` used to invent a 40% raise and `tuition_total = 0` a free
    degree, so the MBA variant always 'paid back'. Both are now absent, so the tool asks."""
    sb = FakeSupabase({})
    await LifeDiscoveryService(sb).discover_goal(CTX, surface_goal="get an MBA",
                                                 why_chain=[{"a": "advance my career"}])
    engine = _engine_with_tools(sb)
    base = await engine._financial_inputs(CTX)  # noqa: SLF001
    for fabricated in ("tuition_total", "salary_after", "current_age", "monthly_debts"):
        assert fabricated not in base, fabricated
