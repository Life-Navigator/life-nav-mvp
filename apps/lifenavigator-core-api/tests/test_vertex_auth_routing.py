"""Vertex ADC auth + VertexGeminiClient + loud-fallback metadata (Model Auth & Routing sprint).

Proves: no API key on the Vertex path, ADC tokens are minted/cached, auth failure is LOUD (raises +
logs, never a silent downgrade), the client speaks the GeminiAdvisorLLM contract, and the runtime
provider/model is recorded on the response.
"""
from __future__ import annotations

import asyncio
import time

import httpx
import pytest

from app.clients.gemini import VertexGeminiClient
from app.clients.vertex_auth import AdcTokenProvider, VertexAuthError
from app.services.advisor_llm import GeminiAdvisorLLM


# ---- ADC token provider ----------------------------------------------------------------------------------
class _FakeCreds:
    def __init__(self, token="tok-1", expiry=None):
        self.token = token
        self.expiry = expiry  # naive UTC datetime or None
        self.refreshed = 0

    def refresh(self, _request):
        self.refreshed += 1
        self.token = f"tok-{self.refreshed}"


def test_adc_provider_mints_and_caches(monkeypatch):
    creds = _FakeCreds()
    p = AdcTokenProvider()
    p._creds = creds  # skip google.auth.default()
    monkeypatch.setattr("google.auth.transport.requests.Request", lambda: object())
    t1 = p.token()
    t2 = p.token()
    assert t1 == t2 == "tok-1"          # cached, single refresh
    assert creds.refreshed == 1


def test_adc_provider_loud_when_no_credentials(monkeypatch):
    p = AdcTokenProvider()

    def _boom(*a, **k):
        raise RuntimeError("could not find ADC")

    monkeypatch.setattr("google.auth.default", _boom)
    with pytest.raises(VertexAuthError) as ei:
        p.token()
    assert "Application Default Credentials" in str(ei.value)


# ---- VertexGeminiClient ----------------------------------------------------------------------------------
class _StubTP:
    def __init__(self, token="adc-xyz", fail=False):
        self._token, self._fail = token, fail

    def token(self):
        if self._fail:
            raise VertexAuthError("no ADC")
        return self._token


def _mock_transport(captured: dict):
    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["auth"] = request.headers.get("authorization")
        return httpx.Response(200, json={
            "candidates": [{"content": {"parts": [{"text": "hello from vertex"}]}}],
            "usageMetadata": {"promptTokenCount": 5, "candidatesTokenCount": 7, "totalTokenCount": 12},
        })

    return httpx.MockTransport(handler)


@pytest.mark.asyncio
async def test_vertex_gemini_uses_adc_bearer_no_api_key(monkeypatch):
    captured: dict = {}
    # Patch the AsyncClient used inside the client to a mock transport.
    real = httpx.AsyncClient

    def _factory(*a, **k):
        k["transport"] = _mock_transport(captured)
        return real(*a, **k)

    monkeypatch.setattr(httpx, "AsyncClient", _factory)
    c = VertexGeminiClient(project="proj-1", region="us-central1",
                           generation_model="gemini-2.5-pro", token_provider=_StubTP("adc-xyz"))
    assert c.configured and c.provider == "vertex_gemini" and c.model_name == "gemini-2.5-pro"
    text, usage = await c.generate_with_usage("sys", "user")
    assert text == "hello from vertex"
    assert usage["total_tokens"] == 12
    assert captured["auth"] == "Bearer adc-xyz"        # ADC bearer, not ?key=
    assert "key=" not in captured["url"] and "aiplatform.googleapis.com" in captured["url"]


@pytest.mark.asyncio
async def test_vertex_gemini_auth_failure_is_loud():
    c = VertexGeminiClient(project="proj-1", region="us-central1",
                           generation_model="gemini-2.5-pro", token_provider=_StubTP(fail=True))
    with pytest.raises(VertexAuthError):
        await c.generate_with_usage("sys", "user")


@pytest.mark.asyncio
async def test_advisor_wrapper_swallows_auth_error_to_fallback(caplog):
    """GeminiAdvisorLLM must turn a VertexAuthError into a (logged) None → deterministic fallback,
    never a raised error to the user — but the log makes it LOUD."""
    c = VertexGeminiClient(project="p", region="us-central1",
                           generation_model="gemini-2.5-pro", token_provider=_StubTP(fail=True))
    llm = GeminiAdvisorLLM(c)
    assert llm.provider == "vertex_gemini" and llm.model_name == "gemini-2.5-pro"

    class _Ctx:
        def prompt_dict(self):
            return {}

    with caplog.at_level("WARNING"):
        out = await llm.generate(_Ctx(), {"intent": "discovery"})
    assert out is None
    assert any("falling back" in r.message for r in caplog.records)
