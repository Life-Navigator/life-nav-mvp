"""Auth enforcement on protected routes."""
from __future__ import annotations

from .conftest import make_jwt


def test_protected_route_rejects_missing_auth(client):
    resp = client.get("/v1/finance/summary")
    assert resp.status_code == 401
    assert "Authorization" in resp.json()["detail"]


def test_protected_route_rejects_malformed_bearer(client):
    resp = client.get("/v1/finance/summary", headers={"Authorization": "Token abc"})
    assert resp.status_code == 401


def test_protected_route_rejects_bad_signature(client):
    bad = make_jwt(secret="wrong-secret")
    resp = client.get("/v1/finance/summary", headers={"Authorization": f"Bearer {bad}"})
    assert resp.status_code == 401


def test_protected_route_accepts_valid_jwt(client, auth_header):
    resp = client.get("/v1/finance/summary", headers=auth_header)
    assert resp.status_code == 200
