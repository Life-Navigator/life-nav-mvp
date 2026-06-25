"""Workload Identity Federation runtime: external_account config + Fly OIDC fetch (keyless)."""
import json, os
import pytest
from app.clients import vertex_auth as va
from app.clients.vertex_auth import (wif_enabled, materialize_external_account_config,
                                     fetch_fly_oidc_token, VertexAuthError,
                                     _EXTERNAL_ACCOUNT_FILE, _FLY_OIDC_TOKEN_FILE)

PROVIDER = "projects/763004283556/locations/global/workloadIdentityPools/lifenav-fly/providers/fly-oidc"
SA = "lifenav-model-runtime@gen-lang-client-0849161409.iam.gserviceaccount.com"


def _set_wif(monkeypatch):
    monkeypatch.setenv("VERTEX_WIF_AUDIENCE", "lifenav-vertex-prod")
    monkeypatch.setenv("VERTEX_WIF_PROVIDER", PROVIDER)
    monkeypatch.setenv("VERTEX_SA_EMAIL", SA)
    monkeypatch.delenv("GOOGLE_APPLICATION_CREDENTIALS", raising=False)


def test_wif_enabled_requires_all_three(monkeypatch):
    for k in ("VERTEX_WIF_AUDIENCE", "VERTEX_WIF_PROVIDER", "VERTEX_SA_EMAIL"):
        monkeypatch.delenv(k, raising=False)
    assert not wif_enabled()
    _set_wif(monkeypatch)
    assert wif_enabled()


def test_external_account_config_shape(monkeypatch):
    _set_wif(monkeypatch)
    path = materialize_external_account_config()
    assert path == _EXTERNAL_ACCOUNT_FILE
    cfg = json.load(open(path))
    assert cfg["type"] == "external_account"
    assert cfg["audience"] == f"//iam.googleapis.com/{PROVIDER}"
    assert cfg["subject_token_type"] == "urn:ietf:params:oauth:token-type:jwt"
    assert cfg["token_url"] == "https://sts.googleapis.com/v1/token"
    assert cfg["service_account_impersonation_url"].endswith(f"/{SA}:generateAccessToken")
    assert cfg["credential_source"]["file"] == _FLY_OIDC_TOKEN_FILE
    # CRITICAL: no key material anywhere in the config
    assert "private_key" not in json.dumps(cfg)
    assert os.environ["GOOGLE_APPLICATION_CREDENTIALS"] == _EXTERNAL_ACCOUNT_FILE


def test_fly_token_fetch_fails_loudly_off_fly(monkeypatch):
    # /.fly/api socket doesn't exist off a Fly Machine → must raise VertexAuthError, never silent
    with pytest.raises(VertexAuthError):
        fetch_fly_oidc_token("lifenav-vertex-prod")


def test_refresh_writes_token_file(monkeypatch):
    _set_wif(monkeypatch)
    monkeypatch.setattr(va, "fetch_fly_oidc_token", lambda aud: "header.payload.sig")
    if os.path.exists(_FLY_OIDC_TOKEN_FILE):
        os.remove(_FLY_OIDC_TOKEN_FILE)
    va.refresh_fly_oidc_token()
    assert open(_FLY_OIDC_TOKEN_FILE).read() == "header.payload.sig"
    assert oct(os.stat(_FLY_OIDC_TOKEN_FILE).st_mode)[-3:] == "600"
