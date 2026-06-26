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
