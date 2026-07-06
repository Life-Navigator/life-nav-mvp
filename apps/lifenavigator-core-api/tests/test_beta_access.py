"""Private-beta gate enforced at the core-api (not only the web proxy).

The Fly core-api is publicly reachable, so a valid-but-non-allowlisted JWT must be
blocked here too. These tests exercise both the pure decision function and the live
403 on a protected route.
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.beta_access import is_beta_access_allowed, masked_email, private_beta_enabled
from app.config import Settings, get_settings
from app.dependencies import get_supabase
from app.main import create_app

from .conftest import FakeSupabase, _test_settings, make_jwt


# ---------------------------------------------------------------- decision fn (pure)
def _gated(**over) -> Settings:
    base = dict(private_beta_enabled="true")
    base.update(over)
    return Settings(supabase_jwt_secret="x", **base)


def test_gate_off_allows_everyone():
    s = Settings(private_beta_enabled="")  # OFF
    assert private_beta_enabled(s) is False
    assert is_beta_access_allowed("stranger@example.com", False, s) is True


def test_gate_on_blocks_non_allowlisted():
    s = _gated(private_beta_allowed_emails="ok@beta.test")
    assert private_beta_enabled(s) is True
    assert is_beta_access_allowed("stranger@example.com", False, s) is False


def test_gate_on_allows_exact_allowlisted_case_insensitive():
    s = _gated(private_beta_allowed_emails="ok@beta.test, other@beta.test")
    assert is_beta_access_allowed("OK@Beta.Test", False, s) is True


def test_gate_on_allows_admin():
    s = _gated(private_beta_admin_emails="founder@lifenav.test")
    assert is_beta_access_allowed("founder@lifenav.test", False, s) is True


def test_gate_on_allows_invited_even_without_allowlist():
    s = _gated()  # empty lists
    assert is_beta_access_allowed("anyone@example.com", True, s) is True


def test_gate_on_blocks_missing_email():
    s = _gated(private_beta_allowed_emails="ok@beta.test")
    assert is_beta_access_allowed(None, False, s) is False
    assert is_beta_access_allowed("", False, s) is False


def test_synthetic_domain_off_by_default_on_when_opted_in():
    off = _gated()
    on = _gated(private_beta_allow_synthetic_domain="true")
    email = "beta7@lifenav-beta.example.com"
    assert is_beta_access_allowed(email, False, off) is False
    assert is_beta_access_allowed(email, False, on) is True


def test_masked_email_is_non_pii():
    assert masked_email("stranger@example.com") == "st***@example.com"
    assert masked_email(None) == "(none)"


# ---------------------------------------------------------------- live route enforcement
def _client_with_settings(**over) -> TestClient:
    app = create_app()
    merged = _test_settings().model_dump()
    merged.update(over)
    app.dependency_overrides[get_settings] = lambda: Settings(**merged)
    app.dependency_overrides[get_supabase] = lambda: FakeSupabase(None)
    return TestClient(app)


def test_route_403_for_non_allowlisted_when_gate_on():
    tc = _client_with_settings(private_beta_enabled="true", private_beta_allowed_emails="ok@beta.test")
    token = make_jwt(email="stranger@example.com")
    resp = tc.get("/v1/finance/summary", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403
    assert "private beta" in resp.json()["detail"].lower()


def test_route_allows_allowlisted_when_gate_on():
    tc = _client_with_settings(private_beta_enabled="true", private_beta_allowed_emails="ok@beta.test")
    token = make_jwt(email="ok@beta.test")
    resp = tc.get("/v1/finance/summary", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200


def test_route_allows_invited_when_gate_on():
    tc = _client_with_settings(private_beta_enabled="true")  # no allowlist at all
    token = make_jwt(email="invitee@example.com", invited=True)
    resp = tc.get("/v1/finance/summary", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200


def test_route_open_when_gate_off():
    tc = _client_with_settings(private_beta_enabled="")  # OFF -> normal
    token = make_jwt(email="stranger@example.com")
    resp = tc.get("/v1/finance/summary", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
