"""Finance Core API endpoint surface: owner-only, missing-data, shapes, writes."""
from __future__ import annotations

from .conftest import make_jwt

GET_ROUTES = [
    "/v1/finance/summary",
    "/v1/finance/accounts",
    "/v1/finance/transactions",
    "/v1/finance/cash-flow",
    "/v1/finance/net-worth",
    "/v1/finance/debt",
    "/v1/finance/investments",
    "/v1/finance/retirement",
    "/v1/finance/recommendations",
]

ACCOUNT = {"id": "a1", "name": "Checking", "institution_name": "Bank", "account_type": "depository", "current_balance": 6000, "currency": "USD"}
HIGH_APR_DEBT = {"id": "d1", "name": "Credit Card", "balance": 8000, "interest_rate": 22.5}

H_FIELDS = {
    "id", "title", "why_it_matters", "evidence", "source_tables", "source_graph_nodes",
    "assumptions", "confidence", "priority", "affected_domains", "action_steps",
    "risks", "revisit_date", "governance_verdict",
}


def _auth():
    return {"Authorization": f"Bearer {make_jwt()}"}


def test_all_finance_routes_require_auth(client):
    for route in GET_ROUTES:
        assert client.get(route).status_code == 401, route
    for route in ["/v1/finance/goals", "/v1/finance/manual-asset", "/v1/finance/manual-liability", "/v1/finance/refresh"]:
        assert client.post(route, json={}).status_code == 401, route


def test_empty_data_returns_missing_state(client):
    # No Supabase data → premium missing-data state, never a fake zero.
    for route in GET_ROUTES:
        resp = client.get(route, headers=_auth())
        assert resp.status_code == 200, route
        body = resp.json()
        assert body["confidence"]["basis"] == "missing", route
        assert body["missing"], route
    # summary specifically must not present a fake $0 net worth.
    summary = client.get("/v1/finance/summary", headers=_auth()).json()
    assert summary["data"]["net_worth"] is None
    assert "plaid_link" in summary["missing"]


def test_no_5xx_on_missing_optional_data(client):
    for route in GET_ROUTES:
        assert client.get(route, headers=_auth()).status_code < 500, route


def test_summary_shape_populated(make_client):
    client = make_client({"financial_accounts": [ACCOUNT]})
    body = client.get("/v1/finance/summary", headers=_auth()).json()
    data = body["data"]
    for key in ("net_worth", "cash", "debt", "monthly_income", "monthly_expenses",
                "savings_rate", "emergency_reserve_months", "accounts",
                "top_opportunities", "top_risks", "next_best_action"):
        assert key in data, key
    assert data["net_worth"]["amount"] == 6000
    assert data["cash"]["amount"] == 6000


def test_recommendations_follow_h_contract(make_client):
    client = make_client({"financial_accounts": [ACCOUNT], "asset_loans": [HIGH_APR_DEBT]})
    body = client.get("/v1/finance/recommendations", headers=_auth()).json()
    recs = body["recommendations"]
    assert recs, "expected a debt-payoff recommendation"
    rec = recs[0]
    assert H_FIELDS.issubset(rec.keys())
    assert rec["source_tables"] == ["finance.asset_loans"]
    assert rec["governance_verdict"]["passed"] is True
    assert rec["priority"] in {"high", "medium", "low"}
    assert rec["revisit_date"]


def test_manual_liability_write_is_owner_scoped(make_client):
    client = make_client(None)
    # Attacker tries to set a different user_id in the body — must be ignored.
    resp = client.post(
        "/v1/finance/manual-liability",
        json={"name": "Car loan", "balance": 10000, "user_id": "ATTACKER"},
        headers=_auth(),
    )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
    inserts = client.fake_supabase.inserts  # type: ignore[attr-defined]
    assert len(inserts) == 1
    table, row = inserts[0]
    assert table == "asset_loans"
    # identity comes from the JWT (make_jwt default sub), NOT the request body
    assert row["user_id"] == "11111111-1111-1111-1111-111111111111"
    assert row["user_id"] != "ATTACKER"


def test_refresh_returns_status(client):
    resp = client.post("/v1/finance/refresh", headers=_auth())
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
