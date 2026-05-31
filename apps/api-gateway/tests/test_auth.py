"""JWT validation contract.

Every protected route must reject:
  - missing Authorization header (401)
  - missing 'Bearer ' prefix (401)
  - tokens signed with the wrong secret (401)
  - expired tokens (401)
  - tokens with the wrong audience (401)
  - tokens missing 'sub' (401)

And must accept a freshly-signed token with the right secret + claims.
"""
from __future__ import annotations

import datetime as dt

import jwt

from app.auth import verify_jwt
from tests.conftest import TEST_JWT_SECRET, make_jwt


def test_health_route_does_not_require_auth(client):
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_missing_authorization_header_returns_401(client):
    r = client.post("/api/compliance/check", json={"text": "hello"})
    assert r.status_code == 401
    assert "Authorization" in r.json()["detail"] or "Missing" in r.json()["detail"]


def test_bad_scheme_returns_401(client):
    r = client.post(
        "/api/compliance/check",
        headers={"Authorization": "Token abc"},
        json={"text": "hello"},
    )
    assert r.status_code == 401


def test_token_signed_with_wrong_secret_returns_401(client):
    bad = make_jwt(secret="wrong-secret")
    r = client.post(
        "/api/compliance/check",
        headers={"Authorization": f"Bearer {bad}"},
        json={"text": "hello"},
    )
    assert r.status_code == 401


def test_expired_token_returns_401(client):
    expired = make_jwt(expires_in_seconds=-1)
    r = client.post(
        "/api/compliance/check",
        headers={"Authorization": f"Bearer {expired}"},
        json={"text": "hello"},
    )
    assert r.status_code == 401
    assert "expired" in r.json()["detail"].lower()


def test_token_with_wrong_audience_returns_401(client):
    wrong_aud = make_jwt(audience="anon")
    r = client.post(
        "/api/compliance/check",
        headers={"Authorization": f"Bearer {wrong_aud}"},
        json={"text": "hello"},
    )
    assert r.status_code == 401


def test_token_missing_sub_is_rejected_unit():
    # We can't reach the route in this state because PyJWT enforces
    # `require=['sub']`. Confirm at the verify_jwt boundary instead.
    now = dt.datetime.now(dt.timezone.utc)
    payload_missing_sub = {
        "aud": "authenticated",
        "iat": int(now.timestamp()),
        "exp": int((now + dt.timedelta(seconds=60)).timestamp()),
    }
    bad = jwt.encode(payload_missing_sub, TEST_JWT_SECRET, algorithm="HS256")
    try:
        verify_jwt(bad, TEST_JWT_SECRET)
        raise AssertionError("expected verify_jwt to raise")
    except Exception as e:
        assert "401" in str(e) or "Token" in str(e) or "Invalid" in str(e)


def test_valid_token_passes_through_and_user_id_is_echoed(client, bearer):
    token, headers = bearer
    r = client.post("/api/compliance/check", headers=headers, json={"text": "hello"})
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["checked_by_user_id"] == "00000000-0000-0000-0000-000000000001"


def test_user_id_comes_only_from_jwt_not_from_body(client, bearer):
    """The compliance route doesn't take a user_id from the body, so we
    can only assert that the response contains the JWT's sub. We verify
    the JWT sub != arbitrary body user_id we might try to pass."""
    token, headers = bearer
    r = client.post(
        "/api/compliance/check",
        headers=headers,
        # Even if we sneak a user_id field in the body, the route
        # never reads it; the response should still echo the JWT sub.
        json={"text": "hello", "user_id": "ATTACKER_OVERRIDE"},
    )
    assert r.status_code == 200
    assert r.json()["checked_by_user_id"] == "00000000-0000-0000-0000-000000000001"
