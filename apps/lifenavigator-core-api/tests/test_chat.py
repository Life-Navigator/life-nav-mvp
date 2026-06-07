"""F2 chat flow: grounding, anti-hallucination, Trust/Safety."""
from __future__ import annotations

from app.dependencies import get_gemini, get_retriever, get_trust_safety_agent
from app.services.trust_safety import TrustSafetyVerdict

from .conftest import make_jwt


class FakeRetriever:
    """Hermetic stand-in — no Qdrant/Neo4j network in tests."""

    async def retrieve_personal(self, query, ctx, *, domain=None, limit=10):
        return []

ACCOUNTS = [
    {"id": "a1", "name": "Checking", "institution_name": "Bank", "account_type": "depository", "current_balance": 5000, "currency": "USD"},
    {"id": "a2", "name": "Brokerage", "institution_name": "Broker", "account_type": "investment", "current_balance": 12000, "currency": "USD"},
]


class FakeGemini:
    configured = True

    def __init__(self) -> None:
        self.embed_calls = 0
        self.generate_calls = 0

    def ready(self) -> bool:
        return True

    async def embed(self, text: str) -> list[float]:
        self.embed_calls += 1
        return [0.0] * 8

    async def generate(self, system_prompt: str, user_prompt: str) -> str:
        self.generate_calls += 1
        return "Your net worth is $17,000.00, based on your linked accounts."


class SpyTrustSafety:
    def __init__(self) -> None:
        self.review_calls = 0

    def review(self, text: str, *, domain: str = "core") -> TrustSafetyVerdict:
        self.review_calls += 1
        return TrustSafetyVerdict(passed=True)


def _auth():
    return {"Authorization": f"Bearer {make_jwt()}"}


def test_chat_requires_auth(client):
    assert client.post("/v1/chat", json={"message": "hi"}).status_code == 401
    assert client.post("/v1/chat/context", json={"query": "hi"}).status_code == 401


def test_chat_context_returns_typed_structure(make_client):
    client = make_client(ACCOUNTS)
    resp = client.post("/v1/chat/context", json={"domains": ["finance"]}, headers=_auth())
    assert resp.status_code == 200
    contexts = resp.json()["contexts"]
    assert isinstance(contexts, list) and len(contexts) == 1
    ctx = contexts[0]
    for key in ("domain", "authoritative_facts", "missing_facts", "graph_evidence", "freshness", "confidence"):
        assert key in ctx
    assert ctx["domain"] == "finance"
    assert any(f["fact"] == "net_worth" for f in ctx["authoritative_facts"])


def test_gemini_not_called_when_facts_missing(make_client):
    # Empty Supabase → no authoritative facts → must NOT call Gemini.
    client = make_client(None)
    fake = FakeGemini()
    client.app.dependency_overrides[get_gemini] = lambda: fake
    client.app.dependency_overrides[get_retriever] = lambda: FakeRetriever()

    resp = client.post("/v1/chat", json={"message": "what is my net worth?"}, headers=_auth())
    assert resp.status_code == 200
    body = resp.json()
    assert body["used_gemini"] is False
    assert fake.generate_calls == 0
    assert fake.embed_calls == 0
    assert "don't have enough" in body["message"].lower() or body["missing_facts"]


def test_trust_safety_gate_is_invoked(make_client):
    # Facts present → Gemini called → output MUST pass through Trust/Safety.
    client = make_client(ACCOUNTS)
    fake = FakeGemini()
    spy = SpyTrustSafety()
    client.app.dependency_overrides[get_gemini] = lambda: fake
    client.app.dependency_overrides[get_trust_safety_agent] = lambda: spy
    client.app.dependency_overrides[get_retriever] = lambda: FakeRetriever()

    resp = client.post("/v1/chat", json={"message": "what is my net worth?"}, headers=_auth())
    assert resp.status_code == 200
    body = resp.json()
    assert body["used_gemini"] is True
    assert fake.generate_calls == 1
    assert spy.review_calls >= 1
    assert "17,000" in body["message"]
    assert body["governance"]["passed"] is True
