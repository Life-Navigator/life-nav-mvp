"""F3 — /v1/life-profile aggregation."""
from __future__ import annotations

import pytest

from .conftest import make_jwt

ACCOUNT = {"id": "a1", "name": "Checking", "institution_name": "Bank", "account_type": "depository", "current_balance": 6000, "currency": "USD"}

REQUIRED_KEYS = {
    "user_id", "generated_at", "domains", "summaries", "recommendations",
    "missing_data_prompts", "missing_domains", "freshness", "confidence", "system_status",
}


def _auth():
    return {"Authorization": f"Bearer {make_jwt()}"}


def test_life_profile_requires_auth(client):
    assert client.get("/v1/life-profile").status_code == 401


def test_life_profile_shape_is_stable(make_client):
    client = make_client({"financial_accounts": [ACCOUNT]})
    body = client.get("/v1/life-profile", headers=_auth()).json()
    assert REQUIRED_KEYS.issubset(body.keys())
    assert body["user_id"] == "11111111-1111-1111-1111-111111111111"
    # system_status shape
    assert set(body["system_status"].keys()) == {"supabase", "qdrant", "neo4j", "gemini"}


def test_life_profile_includes_finance_when_registered(make_client):
    client = make_client({"financial_accounts": [ACCOUNT]})
    body = client.get("/v1/life-profile", headers=_auth()).json()
    assert "finance" in body["domains"]
    assert "finance" in body["summaries"]
    card = body["domains"]["finance"]
    assert card["available"] is True
    assert card["summary_ref"] == "/v1/finance/summary"
    assert body["summaries"]["finance"]["data"]["net_worth"]["amount"] == 6000


def test_empty_finance_yields_missing_prompts_not_fake_zero(client):
    body = client.get("/v1/life-profile", headers=_auth()).json()
    # finance is live but has no data → available False, premium prompt, NOT a $0.
    assert body["domains"]["finance"]["available"] is False
    assert body["summaries"]["finance"]["data"]["net_worth"] is None
    prompts = body["missing_data_prompts"]
    assert prompts and any(p["domain"] == "finance" and p["cta"] for p in prompts)
    assert body["confidence"]["basis"] == "missing"


def test_finance_health_career_family_live_after_unlock(make_client):
    client = make_client({"financial_accounts": [ACCOUNT]})
    body = client.get("/v1/life-profile", headers=_auth()).json()
    live = set(body["domains"].keys())
    assert live == {"finance", "health", "career", "family"}  # four live after Family-unlock
    for d in ("health", "career", "family"):
        assert d not in body["missing_domains"]  # unlocked
    for d in ("education",):
        assert d in body["missing_domains"]   # still known-but-metadata-only
        assert d not in body["domains"]        # never exposed as live
        assert d not in body["summaries"]


def test_family_live_but_no_data_shows_prompts_not_fake(make_client):
    client = make_client({"financial_accounts": [ACCOUNT]})  # no family tables seeded
    body = client.get("/v1/life-profile", headers=_auth()).json()
    fcard = body["domains"]["family"]
    assert fcard["available"] is False  # live, but no data
    assert any(p["domain"] == "family" for p in body["missing_data_prompts"])
    btypes = {b["boundary_type"] for b in body["summaries"]["family"]["data"]["safety_boundaries"]}
    assert {"family_planning", "legal"} <= btypes


def test_career_live_but_no_data_shows_prompts_not_fake(make_client):
    client = make_client({"financial_accounts": [ACCOUNT]})  # no career tables seeded
    body = client.get("/v1/life-profile", headers=_auth()).json()
    ccard = body["domains"]["career"]
    assert ccard["available"] is False  # live, but no data
    comp = body["summaries"]["career"]["data"]["compensation"]["current_estimated_market_value"]
    assert comp is None  # never a fabricated salary
    assert any(p["domain"] == "career" for p in body["missing_data_prompts"])
    assert body["summaries"]["career"]["data"]["safety_boundaries"][0]["boundary_type"] == "career_guidance"


def test_health_live_but_no_data_shows_prompts_not_fake(make_client):
    client = make_client({"financial_accounts": [ACCOUNT]})  # no health tables seeded
    body = client.get("/v1/life-profile", headers=_auth()).json()
    hcard = body["domains"]["health"]
    assert hcard["available"] is False  # live, but no data
    assert body["summaries"]["health"]["data"]["avg_sleep_hours"] is None  # never fake 0
    assert any(p["domain"] == "health" for p in body["missing_data_prompts"])
    # safety posture is always present on the health summary
    assert body["summaries"]["health"]["data"]["safety_boundaries"][0]["boundary_type"] == "medical"


class _BoomHealth:
    domain = "health"

    async def summary(self, ctx):  # noqa: ANN001
        raise RuntimeError("health backend down")


class _OKFinance:
    domain = "finance"

    async def summary(self, ctx):  # noqa: ANN001
        from app.models.common import Confidence, DomainViewModel

        return DomainViewModel(
            domain="finance", user_id=ctx.user_id, generated_at="t",
            confidence=Confidence(score=0.6, basis="partial"),
            data={"net_worth": {"amount": 100, "currency": "USD"}}, missing=[],
        )


class _Registry:
    def live(self):
        return {"finance": _OKFinance(), "health": _BoomHealth()}

    def unavailable(self):
        return ["career", "family", "education"]


class _Rec:
    async def collect(self, ctx, services):  # noqa: ANN001
        return []


@pytest.mark.asyncio
async def test_health_summary_failure_degrades_gracefully():
    from app.models.common import SystemStatus, UserContext
    from app.services.life_profile import LifeProfileService

    svc = LifeProfileService(_Registry(), _Rec())
    vm = await svc.build(
        UserContext(user_id="u-1"),
        SystemStatus(supabase=True, qdrant=True, neo4j=True, gemini=True),
    )
    # finance survives; health (failed summary) is omitted — NO exception, no 5xx.
    assert "finance" in vm.domains
    assert "health" not in vm.domains
