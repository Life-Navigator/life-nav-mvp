"""Service-account JSON-secret → file bootstrap + VERTEX_MODEL env alias."""
import base64, json, os
import pytest
from app.clients.vertex_auth import materialize_sa_credentials, VertexAuthError, _SA_FILE

SA = {"type": "service_account", "project_id": "gen-lang-client-0849161409",
      "private_key": "x", "client_email": "lifenav-model-runtime@x.iam.gserviceaccount.com"}


def _clear(monkeypatch):
    monkeypatch.delenv("GOOGLE_APPLICATION_CREDENTIALS", raising=False)
    monkeypatch.delenv("GOOGLE_APPLICATION_CREDENTIALS_JSON", raising=False)
    if os.path.exists(_SA_FILE):
        os.remove(_SA_FILE)


def test_materialize_from_base64(monkeypatch):
    _clear(monkeypatch)
    b64 = base64.b64encode(json.dumps(SA).encode()).decode()
    monkeypatch.setenv("GOOGLE_APPLICATION_CREDENTIALS_JSON", b64)
    path = materialize_sa_credentials()
    assert path == _SA_FILE and os.environ["GOOGLE_APPLICATION_CREDENTIALS"] == _SA_FILE
    assert json.load(open(path))["type"] == "service_account"
    assert oct(os.stat(path).st_mode)[-3:] == "600"  # not world-readable


def test_materialize_from_raw_json(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv("GOOGLE_APPLICATION_CREDENTIALS_JSON", json.dumps(SA))
    assert materialize_sa_credentials() == _SA_FILE


def test_existing_file_wins(monkeypatch, tmp_path):
    _clear(monkeypatch)
    f = tmp_path / "key.json"; f.write_text(json.dumps(SA))
    monkeypatch.setenv("GOOGLE_APPLICATION_CREDENTIALS", str(f))
    assert materialize_sa_credentials() == str(f)  # untouched, no JSON env needed


def test_no_env_returns_none(monkeypatch):
    _clear(monkeypatch)
    assert materialize_sa_credentials() is None


def test_invalid_blob_raises(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv("GOOGLE_APPLICATION_CREDENTIALS_JSON", "not-json-not-base64-$$$")
    with pytest.raises(VertexAuthError):
        materialize_sa_credentials()


def test_non_sa_json_raises(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv("GOOGLE_APPLICATION_CREDENTIALS_JSON", json.dumps({"type": "authorized_user"}))
    with pytest.raises(VertexAuthError):
        materialize_sa_credentials()


def test_vertex_model_env_alias(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv("VERTEX_MODEL", "gemini-2.5-pro")
    from app.config import Settings
    assert Settings().vertex_gemini_model == "gemini-2.5-pro"
