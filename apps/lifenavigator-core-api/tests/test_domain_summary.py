"""Shared domain summary contract — one truth (status/facts/missing/hint) for education + health."""
import pytest
from app.models.common import UserContext
from app.services.domain_summary import domain_summary, missing_for
from app.services.discovery_coverage import DiscoveryCoverageService
from app.services.life_discovery import LifeDiscoveryService
from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")


def _cov(sb):
    return DiscoveryCoverageService(LifeDiscoveryService(sb), sb)


def test_missing_for_health_specific_not_generic():
    facts = {"Height": "6'0\"", "Weight": "210 lbs", "Body fat": "18%", "Goal": "body recomposition"}
    m = missing_for("health", facts)
    assert "waist measurement" in m and "starting lifts" in m and "sleep average" in m
    assert "current fitness baseline" not in m and "target definition" not in m


def test_missing_for_education_planned_jd():
    facts = {"Highest completed": "BS in Business Administration, University of Phoenix",
             "Planned / in progress": "Juris Doctor (JD), Syracuse Law School", "Records": "2 degrees"}
    m = missing_for("education", facts)
    assert any("financing" in x for x in m) and any("objective" in x for x in m)
    assert "current education" not in m and "target degree" not in m


@pytest.mark.asyncio
async def test_health_summary_contract():
    sb = FakeSupabase({})
    await sb.insert("health_profiles", {"id": "h", "user_id": CTX.user_id, "height_cm": 182.9}, schema="health")
    await sb.insert("body_metrics", {"id": "m", "user_id": CTX.user_id, "weight_kg": 95.25,
                                      "body_fat_pct": 18}, schema="health")
    await sb.insert("health_goals", {"id": "g", "user_id": CTX.user_id, "title": "body recomposition",
                                     "goal_type": "recomposition", "status": "active"}, schema="health")
    s = await domain_summary(_cov(sb), CTX, "health")
    assert s["status"] != "not_started"
    assert "Weight" in s["facts"] and "Body fat" in s["facts"]
    assert "waist measurement" in s["missing_items"]
    assert "current fitness baseline" not in s["missing_items"]
    assert s["advisor_prompt_hint"] and "body composition" in s["advisor_prompt_hint"]
    assert s["blockers"] and "Add" in s["blockers"][0]


@pytest.mark.asyncio
async def test_education_summary_contract_agrees_with_card():
    sb = FakeSupabase({})
    await sb.insert("education_records", {"id": "bs", "user_id": CTX.user_id, "degree_type": "bachelor",
        "field_of_study": "Business Administration", "institution_name": "University of Phoenix",
        "status": "completed"}, schema="public")
    await sb.insert("education_records", {"id": "jd", "user_id": CTX.user_id, "degree_type": "doctorate",
        "field_of_study": "Juris Doctorate", "institution_name": "Syracuse Law School",
        "status": "in_progress", "start_date": "2026-08-01"}, schema="public")
    s = await domain_summary(_cov(sb), CTX, "education")
    assert s["status"] != "not_started"
    assert "Juris Doctor (JD)" in s["facts"].get("Planned / in progress", "")
    assert any("financing" in m for m in s["missing_items"])
    assert "current education" not in s["missing_items"] and "target degree" not in s["missing_items"]
    # the dashboard CARD (discovery_coverage) shows the SAME missing → no contradiction
    edu_card = next(d for d in (await _cov(sb).coverage(CTX))["domains"] if d["domain"] == "education")
    assert edu_card["missing"] == s["missing_items"]


@pytest.mark.asyncio
async def test_empty_health_is_honest_not_started():
    sb = FakeSupabase({})
    s = await domain_summary(_cov(sb), CTX, "health")
    assert s["status"] == "not_started" and not s["facts"]
    assert s["blockers"] and "height" in s["blockers"][0].lower()
