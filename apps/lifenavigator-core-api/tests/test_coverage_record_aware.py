"""Dashboard coverage cards must reflect REAL domain records — never 'not started' when data exists."""
import pytest
from app.models.common import UserContext
from app.services.discovery_coverage import DiscoveryCoverageService
from app.services.life_discovery import LifeDiscoveryService
from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")


def _cov(sb):
    return DiscoveryCoverageService(LifeDiscoveryService(sb), sb)


def _dom(cov, key):
    return next(d for d in cov["domains"] if d["domain"] == key)


@pytest.mark.asyncio
async def test_education_not_started_when_degree_record_exists():
    sb = FakeSupabase({})
    await sb.insert("education_records", {"id": "e1", "user_id": CTX.user_id, "degree": "BS",
                                          "field_of_study": "Business Administration"}, schema="public")
    edu = _dom(await _cov(sb).coverage(CTX), "education")
    assert edu["status"] != "not_started"          # the platform knows about the degree
    assert edu["coverage_pct"] > 0
    assert "education interest" not in (edu["missing"] or [])   # not "missing a goal" — records exist
    assert "education goal" not in (edu["missing"] or [])


@pytest.mark.asyncio
async def test_career_not_started_when_profile_exists():
    sb = FakeSupabase({})
    await sb.insert("career_profiles", {"id": "c1", "user_id": CTX.user_id,
                                        "current_title": "Senior Architect"}, schema="public")
    car = _dom(await _cov(sb).coverage(CTX), "career")
    assert car["status"] != "not_started" and car["coverage_pct"] > 0
    assert "career goal" not in (car["missing"] or [])


@pytest.mark.asyncio
async def test_empty_domain_is_still_not_started():
    sb = FakeSupabase({})
    edu = _dom(await _cov(sb).coverage(CTX), "education")
    assert edu["status"] == "not_started" and edu["coverage_pct"] == 0  # truly empty → honest not_started


@pytest.mark.asyncio
async def test_coverage_returns_concrete_facts():
    sb = FakeSupabase({})
    await sb.insert("education_records", {"id": "e1", "user_id": CTX.user_id, "degree_type": "bachelor",
                                          "field_of_study": "Business Administration",
                                          "institution_name": "Cal State Bakersfield"}, schema="public")
    await sb.insert("career_profiles", {"id": "c1", "user_id": CTX.user_id, "current_title": "Senior Architect",
                                        "current_company": "Persistent Systems"}, schema="public")
    cov = await _cov(sb).coverage(CTX)
    edu = _dom(cov, "education")["facts"]
    assert "Business Administration" in edu.get("Highest completed", "") and "Cal State Bakersfield" in edu.get("Highest completed", "")
    car = _dom(cov, "career")["facts"]
    assert car.get("Current role") == "Senior Architect" and car.get("Company") == "Persistent Systems"


@pytest.mark.asyncio
async def test_education_jd_labeling_completed_vs_planned():
    sb = FakeSupabase({})
    # completed BS + a FUTURE JD (Aug 2026) — must be separated, JD labeled correctly
    await sb.insert("education_records", {"id": "bs", "user_id": CTX.user_id, "degree_type": "bachelor",
        "field_of_study": "Business Administration", "institution_name": "University of Phoenix",
        "status": "completed"}, schema="public")
    await sb.insert("education_records", {"id": "jd", "user_id": CTX.user_id, "degree_type": "doctorate",
        "field_of_study": "Juris Doctorate", "institution_name": "Syracuse Law School",
        "status": "in_progress", "start_date": "2026-08-01", "graduation_date": "2030-12-15"}, schema="public")
    f = _dom(await _cov(sb).coverage(CTX), "education")["facts"]
    assert "BS in Business Administration" in f.get("Highest completed", "")     # completed = BS, not JD
    assert "University of Phoenix" in f.get("Highest completed", "")
    assert f.get("Planned / in progress") == "Juris Doctor (JD), Syracuse Law School"  # JD separate + labeled
    blob = " ".join(f.values()) if all(isinstance(v, str) for v in f.values()) else str(f)
    assert "doctorate in Juris Doctorate" not in blob
