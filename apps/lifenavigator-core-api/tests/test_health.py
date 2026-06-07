"""Liveness + readiness."""
from __future__ import annotations


def test_healthz_returns_ok(client):
    resp = client.get("/healthz")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_readyz_returns_readiness_shape(client):
    resp = client.get("/readyz")
    assert resp.status_code == 200
    body = resp.json()
    assert "status" in body
    assert body["status"] in {"ok", "degraded"}
    services = body["services"]
    assert set(services.keys()) == {"supabase", "qdrant", "neo4j", "gemini"}
    assert all(isinstance(v, bool) for v in services.values())
    # Test settings configure every dependency → ready.
    assert body["status"] == "ok"
