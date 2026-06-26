"""Fact→domain sync: advisor-captured facts upsert the existing domain tables the dashboard reads."""
import pytest
from app.models.common import UserContext
from app.services import fact_domain_sync as S
from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")
CAREER_MSG = ("I am a senior architect for Persistent Systems working on Embedded AI/ML with Python and "
              "C++ & PyTorch & TensorFlow. The next promotion is Principal Architect.")
EDU_MSG = "I have a BS in Business Administration from Cal State Bakersfield and education is sufficient for now."


def test_extract_career_facts():
    f = S.extract_career_facts(CAREER_MSG)
    assert f["current_role"] == "Senior Architect"
    assert f["company"] == "Persistent Systems"
    assert f["target_role"] == "Principal Architect"
    assert {"Python", "C++", "PyTorch", "TensorFlow"} <= set(f["skills"])


def test_extract_education_facts():
    f = S.extract_education_facts(EDU_MSG)
    assert f["highest_level"] == "BS"
    assert f["field"] == "Business Administration"
    assert f["school"] == "Cal State Bakersfield"
    assert f["priority"] == "sufficient"


@pytest.mark.asyncio
async def test_sync_career_upserts_profile_and_goal():
    sb = FakeSupabase({})
    res = await S.sync_career(sb, CTX, S.extract_career_facts(CAREER_MSG))
    assert "current_title" in res["fields_updated"]
    assert "current_company" in res["fields_updated"]
    assert "target_role" in res["fields_updated"]
    assert not res["errors"]
    prof = await sb.select("career_profiles", filters={"user_id": f"eq.{CTX.user_id}"}, schema="public")
    assert prof and prof[0]["current_title"] == "Senior Architect"
    assert prof[0]["current_company"] == "Persistent Systems"
    goals = await sb.select("career_goals", filters={"user_id": f"eq.{CTX.user_id}"}, schema="career")
    assert goals and goals[0]["target_role"] == "Principal Architect" and goals[0]["goal_type"] == "promotion"


@pytest.mark.asyncio
async def test_sync_career_does_not_overwrite_manual_value():
    """Conflict rule: a non-empty existing (manual) value is NEVER clobbered by chat."""
    sb = FakeSupabase({})
    await sb.upsert("career_profiles", {"id": "x", "user_id": CTX.user_id, "current_title": "VP Engineering"},
                    schema="public")
    res = await S.sync_career(sb, CTX, {"current_role": "Senior Architect", "company": "Persistent Systems"})
    assert "current_title" in res["fields_skipped"]      # manual title preserved
    assert "current_company" in res["fields_updated"]    # missing field filled
    prof = await sb.select("career_profiles", filters={"user_id": f"eq.{CTX.user_id}"}, schema="public")
    assert prof[0]["current_title"] == "VP Engineering"  # not overwritten


@pytest.mark.asyncio
async def test_sync_education_upserts_credential():
    sb = FakeSupabase({})
    res = await S.sync_education(sb, CTX, S.extract_education_facts(EDU_MSG))
    assert "existing_credentials" in res["fields_updated"]
    assert not res["errors"]
    prof = await sb.select("education_profiles", filters={"user_id": f"eq.{CTX.user_id}"}, schema="education")
    assert prof and prof[0]["highest_level"] == "BS"
    creds = prof[0]["existing_credentials"]
    assert any(c.get("school") == "Cal State Bakersfield" and c.get("field") == "Business Administration" for c in creds)


@pytest.mark.asyncio
async def test_sync_from_message_runs_both_domains():
    sb = FakeSupabase({})
    out = await S.sync_from_message(sb, CTX, CAREER_MSG + " " + EDU_MSG)
    domains = {r["domain"] for r in out}
    assert "career" in domains and "education" in domains
