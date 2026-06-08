"""F3 — /v1/life-profile aggregation."""
from __future__ import annotations

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


def test_unfinished_domains_not_exposed_as_live(make_client):
    client = make_client({"financial_accounts": [ACCOUNT]})
    body = client.get("/v1/life-profile", headers=_auth()).json()
    live = set(body["domains"].keys())
    assert live == {"finance"}  # only finance is live
    for d in ("health", "career", "family", "education"):
        assert d in body["missing_domains"]   # known, but metadata only
        assert d not in body["domains"]        # never exposed as live
        assert d not in body["summaries"]      # never fake data
