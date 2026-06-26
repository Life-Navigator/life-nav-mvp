"""Advisor welcome: domain-aware, fact-grounded entry state (no generic 'how can I help', no fake facts)."""
import pytest
from app.models.common import UserContext
from app.services.advisor_welcome import build_welcome

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")


class FakeCov:
    def __init__(self, domains): self._d = domains
    async def coverage(self, ctx): return {"domains": self._d}


class FakeLife:
    def __init__(self, ns): self._ns = ns
    async def snapshot(self, ctx): return {"north_star": self._ns}


DOMAINS = [
    {"domain": "health", "label": "Health", "facts": {"Weight": "210 lbs", "Body fat": "18%"}, "missing": ["waist"]},
    {"domain": "finance", "label": "Financial", "facts": {}, "missing": ["emergency fund target"]},
    {"domain": "career", "label": "Career", "facts": {"Current role": "Senior Architect"}, "missing": ["timeline"]},
]


@pytest.mark.asyncio
async def test_dashboard_welcome_uses_north_star_and_facts():
    w = await build_welcome(FakeCov(DOMAINS), FakeLife("Build a strong foundation before marriage"),
                            CTX, "relationship_manager")
    assert w["title"] == "Life Advisor" and w["subtitle"]
    assert "foundation before marriage" in w["message"]
    assert "how can i help" not in w["message"].lower()
    assert "Work on finance" in w["chips"] and "Review my life plan" in w["chips"]
    assert any("Health" in kf for kf in w["known_facts"])  # cross-domain known summary


@pytest.mark.asyncio
async def test_health_advisor_welcome_has_facts_and_chips():
    w = await build_welcome(FakeCov(DOMAINS), FakeLife(None), CTX, "health_advisor")
    assert w["title"] == "Health Advisor"
    assert "210 lbs" in w["message"]
    assert "Build next week's workout plan" in w["chips"]
    assert "waist" in w["missing"]


@pytest.mark.asyncio
async def test_empty_domain_welcome_is_welcoming_not_generic():
    cov = FakeCov([{"domain": "health", "label": "Health", "facts": {}, "missing": []}])
    w = await build_welcome(cov, FakeLife(None), CTX, "health_advisor")
    assert "how can i help" not in w["message"].lower()
    assert "height" in w["message"].lower()  # specific welcoming empty state
    assert w["chips"]  # chips still offered, never dead-empty


@pytest.mark.asyncio
async def test_no_internal_labels_in_welcome():
    w = await build_welcome(FakeCov(DOMAINS), FakeLife("Build a strong foundation"), CTX, "relationship_manager")
    blob = str(w)
    assert "_advisor" not in w["message"] and "peak_earning" not in blob and "not_started" not in blob
