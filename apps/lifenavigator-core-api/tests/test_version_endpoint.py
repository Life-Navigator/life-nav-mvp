"""Release identity (/version) — unit + integration.

The endpoint's whole value is that it CANNOT quietly lie about what is running, so the tests that
matter most are the negative ones: no SHA in a gated environment must fail loudly, and no
infrastructure detail may ever leak into the payload.
"""
from __future__ import annotations

import re

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.routers import version as version_router

_IDENTITY_ENV_VARS = ("LN_COMMIT_SHA", "LN_BUILD_TIME", "LN_APP_VERSION", "LN_ENVIRONMENT")

FAKE_SHA = "a" * 40


@pytest.fixture(autouse=True)
def _clean_identity_env(monkeypatch):
    for name in _IDENTITY_ENV_VARS:
        monkeypatch.delenv(name, raising=False)


@pytest.fixture
def client():
    return TestClient(create_app())


# ── happy path ────────────────────────────────────────────────────────────────────────────────────

def test_version_returns_injected_identity(client, monkeypatch):
    monkeypatch.setenv("LN_COMMIT_SHA", FAKE_SHA)
    monkeypatch.setenv("LN_BUILD_TIME", "2026-07-31T12:00:00Z")
    monkeypatch.setenv("LN_ENVIRONMENT", "staging")
    monkeypatch.setenv("LN_APP_VERSION", "6.0.0")

    r = client.get("/version")
    assert r.status_code == 200
    body = r.json()
    assert body["service"] == "lifenavigator-core-api"
    assert body["commit_sha"] == FAKE_SHA
    assert body["build_time"] == "2026-07-31T12:00:00Z"
    assert body["environment"] == "staging"
    assert body["version"] == "6.0.0"


def test_version_omits_app_version_when_unset(client, monkeypatch):
    monkeypatch.setenv("LN_COMMIT_SHA", FAKE_SHA)
    monkeypatch.setenv("LN_ENVIRONMENT", "production")
    assert "version" not in client.get("/version").json()


def test_build_time_reports_unknown_rather_than_omitting(client, monkeypatch):
    monkeypatch.setenv("LN_COMMIT_SHA", FAKE_SHA)
    monkeypatch.setenv("LN_ENVIRONMENT", "production")
    assert client.get("/version").json()["build_time"] == "unknown"


# ── the negative tests: identity must fail loudly, never silently ─────────────────────────────────

@pytest.mark.parametrize("environment", ["production", "staging", "candidate",
                                         "PRODUCTION", " Staging "])
def test_missing_sha_is_503_in_gated_environments(client, monkeypatch, environment):
    """A gate that answers 'unknown' is worse than one that answers nothing."""
    monkeypatch.setenv("LN_ENVIRONMENT", environment)
    r = client.get("/version")
    assert r.status_code == 503
    assert "LN_COMMIT_SHA" in r.json()["detail"]


def test_blank_sha_is_treated_as_missing(client, monkeypatch):
    monkeypatch.setenv("LN_ENVIRONMENT", "production")
    monkeypatch.setenv("LN_COMMIT_SHA", "   ")
    assert client.get("/version").status_code == 503


def test_development_gets_a_clearly_labelled_placeholder(client):
    body = client.get("/version").json()
    assert body["environment"] == "development"
    assert body["commit_sha"] == "development-unbuilt"
    # It must be impossible to mistake the placeholder for a real SHA.
    assert not re.fullmatch(r"[0-9a-f]{40}", body["commit_sha"])


def test_sha_is_not_derived_from_a_runtime_git_directory():
    """Constraint 1. The module must not shell out to git or read .git."""
    source = (version_router.__file__)
    text = open(source, encoding="utf-8").read()
    for forbidden in ("subprocess", "GitPython", "import git", ".git/HEAD", "rev-parse"):
        assert forbidden not in text.replace("git rev-parse HEAD", ""), \
            f"/version must not derive the SHA at runtime (found {forbidden!r})"


# ── the endpoint must not become a reconnaissance surface ─────────────────────────────────────────

def test_version_exposes_only_release_identity(client, monkeypatch):
    monkeypatch.setenv("LN_COMMIT_SHA", FAKE_SHA)
    monkeypatch.setenv("LN_ENVIRONMENT", "production")
    body = client.get("/version").json()
    assert set(body) <= {"service", "commit_sha", "build_time", "environment", "version"}


def test_version_leaks_no_infrastructure_or_dependency_detail(client, monkeypatch):
    """No hostnames, project ids, database names, private URLs, or dependency status."""
    monkeypatch.setenv("LN_COMMIT_SHA", FAKE_SHA)
    monkeypatch.setenv("LN_ENVIRONMENT", "production")
    # Secrets that must never surface even if they are set in the process environment.
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "super-secret-service-role")
    monkeypatch.setenv("NEO4J_PASSWORD", "super-secret-neo4j")
    monkeypatch.setenv("QDRANT_API_KEY", "super-secret-qdrant")

    raw = client.get("/version").text.lower()
    for leak in ("supabase", "qdrant", "neo4j", "gemini", "fly.dev", "postgres", "password",
                 "secret", "api_key", "apikey", "token", "super-secret"):
        assert leak not in raw, f"/version leaked {leak!r}"


def test_version_does_not_duplicate_readyz(client, monkeypatch):
    """Dependency health stays at /readyz. /version answers one question only."""
    monkeypatch.setenv("LN_COMMIT_SHA", FAKE_SHA)
    monkeypatch.setenv("LN_ENVIRONMENT", "production")
    assert "services" not in client.get("/version").json()


# ── integration: the route is actually wired into the app ─────────────────────────────────────────

def test_version_route_is_registered():
    assert "/version" in {r.path for r in create_app().routes}


def test_healthz_still_works_alongside_version(client):
    assert client.get("/healthz").json() == {"status": "ok"}
