"""Fact→domain sync: LLM-extracted, validated facts upsert the existing domain tables (no brittle regex)."""
import json
import pytest
from app.models.common import UserContext
from app.services import fact_domain_sync as S
from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")


class FakeGem:
    """Returns a fixed structured-extraction JSON (stands in for the LLM)."""
    configured = True

    def __init__(self, payload):
        self._payload = payload

    async def generate(self, system, user, temperature=None):
        return json.dumps(self._payload)


@pytest.mark.asyncio
async def test_llm_extraction_validates_all_domains():
    gem = FakeGem({
        "career": {"current_role": "Senior Architect", "company": "Persistent Systems",
                   "skills": ["Python", "C++"], "target_role": "Principal Architect", "confidence": 0.95},
        "health": {"height_in": 72, "weight_lbs": 210, "body_fat_pct": 18, "goal_type": "body recomposition",
                   "confidence": 0.9},
        "education": {"highest_level": "BS", "field": "Business Administration",
                      "school": "Cal State Bakersfield", "confidence": 0.95},
        "family": {"relationship_status": "engaged", "wedding_timeline": "next June", "home_goal": True,
                   "children_goal": True, "family_goals": ["buy first home"], "confidence": 0.9},
        "finance_planning": {"priority": "financial foundation", "home_price_min": 500000,
                             "home_price_max": 750000, "confidence": 0.9},
    })
    f = await S.extract_domain_facts(gem, "long enough message about my life and plans")
    assert f["career"]["current_role"] == "Senior Architect"
    assert f["health"]["weight_lbs"] == 210 and f["health"]["body_fat_pct"] == 18
    assert f["education"]["school"] == "Cal State Bakersfield"
    assert f["family"]["home_goal"] is True
    assert f["finance_planning"]["home_price_max"] == 750000


@pytest.mark.asyncio
async def test_extraction_clamps_insane_numbers():
    gem = FakeGem({"health": {"weight_lbs": 99999, "body_fat_pct": 250, "height_in": 5, "confidence": 0.9}})
    f = await S.extract_domain_facts(gem, "a message with nonsense health numbers in it")
    # all out-of-range → health dropped entirely (nothing to sync)
    assert f is None or "health" not in f


@pytest.mark.asyncio
async def test_no_llm_returns_none():
    class NoGem:
        configured = False
        async def generate(self, *a, **k): return "{}"
    assert await S.extract_domain_facts(NoGem(), "some message here") is None


@pytest.mark.asyncio
async def test_sync_career_profile_and_goal():
    sb = FakeSupabase({})
    res = await S.sync_career(sb, CTX, {"current_role": "Senior Architect", "company": "Persistent Systems",
                                        "skills": ["Python", "C++"], "target_role": "Principal Architect",
                                        "confidence": 0.95})
    assert {"current_title", "current_company", "target_role"} <= set(res["fields_updated"])
    prof = await sb.select("career_profiles", filters={"user_id": f"eq.{CTX.user_id}"}, schema="public")
    assert prof[0]["current_title"] == "Senior Architect"


@pytest.mark.asyncio
async def test_sync_career_does_not_overwrite_manual():
    sb = FakeSupabase({})
    await sb.upsert("career_profiles", {"id": "x", "user_id": CTX.user_id, "current_title": "VP Engineering"},
                    schema="public")
    res = await S.sync_career(sb, CTX, {"current_role": "Senior Architect", "company": "Persistent Systems",
                                        "confidence": 0.95})
    assert "current_title" in res["fields_skipped"] and "current_company" in res["fields_updated"]
    prof = await sb.select("career_profiles", filters={"user_id": f"eq.{CTX.user_id}"}, schema="public")
    assert prof[0]["current_title"] == "VP Engineering"


@pytest.mark.asyncio
async def test_low_confidence_is_needs_review_not_written():
    sb = FakeSupabase({})
    res = await S.sync_career(sb, CTX, {"current_role": "maybe an architect", "confidence": 0.3})
    assert res["needs_review"] and not res["fields_updated"]
    assert not await sb.select("career_profiles", filters={"user_id": f"eq.{CTX.user_id}"}, schema="public")


@pytest.mark.asyncio
async def test_sync_health_writes_real_columns():
    sb = FakeSupabase({})
    res = await S.sync_health(sb, CTX, {"height_in": 72, "weight_lbs": 210, "body_fat_pct": 18,
                                        "goal_type": "body recomposition", "confidence": 0.9})
    assert {"weight_kg", "body_fat_pct"} <= set(res["fields_updated"])
    m = await sb.select("body_metrics", filters={"user_id": f"eq.{CTX.user_id}"}, schema="health")
    assert m[0]["weight_kg"] == 95.25 and m[0]["body_fat_pct"] == 18  # 210 lb -> 95.25 kg
    prof = await sb.select("health_profiles", filters={"user_id": f"eq.{CTX.user_id}"}, schema="health")
    assert prof[0]["height_cm"] == 182.9


@pytest.mark.asyncio
async def test_sync_family_profile():
    sb = FakeSupabase({})
    res = await S.sync_family(sb, CTX, {"relationship_status": "engaged", "wedding_timeline": "next June",
                                        "home_goal": True, "children_goal": True,
                                        "family_goals": ["buy first home"], "confidence": 0.9})
    # marital_status is a real column; planning facts live in the metadata JSONB (deployed schema, no migration)
    assert {"marital_status", "wedding_timeline", "home_goal"} <= set(res["fields_updated"])
    prof = await sb.select("family_profiles", filters={"user_id": f"eq.{CTX.user_id}"}, schema="family")
    assert prof[0]["marital_status"] == "engaged"
    assert prof[0]["metadata"]["home_goal"] is True and prof[0]["metadata"]["wedding_timeline"] == "next June"


@pytest.mark.asyncio
async def test_sync_finance_planning_only_goals_no_accounts():
    sb = FakeSupabase({})
    res = await S.sync_finance_planning(sb, CTX, {"priority": "financial foundation", "home_price_min": 500000,
                                                  "home_price_max": 750000, "linked_domains": ["family"],
                                                  "confidence": 0.9})
    assert "financial_foundation" in res["fields_updated"] and "home_price_range" in res["fields_updated"]
    goals = await sb.select("financial_planning_goals", filters={"user_id": f"eq.{CTX.user_id}"}, schema="finance")
    hpr = next(g for g in goals if g["goal_type"] == "home_price_range")
    assert hpr["amount_min"] == 500000 and hpr["amount_max"] == 750000
    # never writes account tables
    assert not sb._by_table.get("financial_accounts") and not sb._by_table.get("assets")


@pytest.mark.asyncio
async def test_sync_from_message_scopes_to_agent_domain():
    sb = FakeSupabase({})
    gem = FakeGem({"career": {"current_role": "Senior Architect", "confidence": 0.95},
                   "finance_planning": {"priority": "financial foundation", "confidence": 0.9}})
    out = await S.sync_from_message(sb, gem, CTX, "a longer message about work and money", domains={"career"})
    assert {r["domain"] for r in out} == {"career"}
    assert await sb.select("career_profiles", filters={"user_id": f"eq.{CTX.user_id}"}, schema="public")
    assert not sb._by_table.get("financial_planning_goals")  # finance NOT synced (out of scope)
