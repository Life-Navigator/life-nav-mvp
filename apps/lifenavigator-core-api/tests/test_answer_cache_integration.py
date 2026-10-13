"""The answer cache, exercised through `_enhance` rather than asserted from source.

The wiring tests check that `lookup_answer` and `save_answer` APPEAR in the orchestrator and in the
right order. That is not the same as them working: a cache that is called but whose hit path sets a
key nothing reads returns a silent blank answer, which is exactly the bug that nearly shipped. So
this runs the real `_enhance` against a real `CalculationStore` and asserts on behaviour — whether
the provider was called, and what the user would actually be shown.
"""
from __future__ import annotations

from typing import Any, Optional

import pytest

from app.models.common import UserContext
from app.services.advisor_context import AdvisorContext
from app.services.advisor_orchestrator import AdvisorOrchestrator
from app.services.calculation_store import CalculationStore

from .conftest import FakeSupabase

U = "11111111-1111-1111-1111-111111111111"
CTX = UserContext(user_id=U)
MESSAGE = "how much federal tax will I owe on my salary this year"

PACKET = {
    "available": True,
    "results": [{"calculator": "tax.federal_income_tax", "value": 23_282.0,
                 "unit": "usd", "tier": "scenario", "inputs_used": {"tax_year": 2024},
                 "detail": {"table_provenance": "2024 table (verified)"}}],
    "treatments": [], "gaps": [], "tax_conflicts": [],
    "allowed_numbers": ["23282"], "scenario_numbers": [],
    "tax_year_requested": 2026,
    "fingerprints": {"inputs": "i" * 32, "basis": "b" * 32},
}


def _context(packet: Optional[dict] = None) -> AdvisorContext:
    return AdvisorContext(
        user_id=U, user_message=MESSAGE, current_stage="complete", life_vision=None,
        primary_objective=None, candidate_goals=[], rejected_goals=[], risks=[],
        opportunities=[], constraints=[], domains_touched=["finance"], missing_areas=[],
        discovery_pct=100, allowed_numbers={"23282"},
        calculations=packet if packet is not None else PACKET,
    )


class _Builder:
    def __init__(self, packet: Optional[dict] = None) -> None:
        self._packet = packet
        self.builds = 0

    async def build(self, ctx, message, base, history, agent=None):  # noqa: ANN001
        self.builds += 1
        return _context(self._packet)


class _LLM:
    """Records whether the provider was reached, and returns a well-formed answer."""

    available = True
    last_error = ""
    model_name = "fake-model"
    provider = "fake"
    last_usage: dict[str, Any] = {}

    def __init__(self) -> None:
        self.calls = 0

    async def generate(self, context, constraints):  # noqa: ANN001
        self.calls += 1
        # Shaped to PASS the validator: a `recommendation` means the turn delivered an answer and
        # needs no trailing question (advisor_validator, section 3). Without it the turn falls back
        # — which is itself worth knowing, because a fallback is never cached.
        return {"summary": "Your federal tax comes to about 23282 this year.",
                "recommendation": "Set aside about 23282 for federal tax this year.",
                "sections": [], "citations": []}


class _RM:
    async def converse(self, ctx, message, pending_key=None, focus_domains=None):  # noqa: ANN001
        return {"assistant_message": "deterministic fallback", "complete": True}


def _orch(store: Any, builder: Any, llm: Any) -> AdvisorOrchestrator:
    return AdvisorOrchestrator(_RM(), builder, llm, answer_cache=store)


async def _enhance(orch: AdvisorOrchestrator, llm: Any) -> dict[str, Any]:
    base: dict[str, Any] = {"assistant_message": "deterministic fallback"}
    tr: dict[str, Any] = {"turn_id": "t", "stages_ms": {}}
    await orch._enhance(base, CTX, MESSAGE, tr, lambda name: None, history=[], llm=llm)
    return {"base": base, "tr": tr}


# ── A cold cache must reach the provider and then store ─────────────────────────────────────────
@pytest.mark.asyncio
async def test_a_cold_cache_calls_the_provider_and_stores_the_validated_answer():
    db = FakeSupabase({})
    store = CalculationStore(db)
    llm = _LLM()
    out = await _enhance(_orch(store, _Builder(), llm), llm)

    # >= 1 rather than == 1: the validator may run a repair pass, which is its own concern. What
    # matters here is that the provider was reached at all on a cold cache.
    assert llm.calls >= 1, "nothing was cached, so the model must run"
    assert out["tr"].get("cache_hit") is False
    assert out["base"]["llm_status"] == "enhanced"

    # The write is fire-and-forget; drain it before asserting.
    import asyncio
    await asyncio.sleep(0)
    rows = db._by_table.get("answer_cache") or []
    assert len(rows) == 1, "a validated answer must be cached"
    assert rows[0]["inputs_fingerprint"] == "i" * 32, "the PACKET's fingerprint, not a re-derived one"
    assert rows[0]["basis_fingerprint"] == "b" * 32
    assert "23282" in rows[0]["answer"]


# ── A warm cache must NOT reach the provider, and must show the user real text ──────────────────
@pytest.mark.asyncio
async def test_a_warm_cache_SKIPS_the_provider_and_returns_the_text_the_UI_reads():
    """THE BUG THIS WOULD HAVE CAUGHT. The hit path originally set `base["response"]`, which nothing
    reads — the human-facing key is `assistant_message`. Every cache hit would have returned a
    silent blank while reporting success, and no source-inspection test would have noticed.
    """
    db = FakeSupabase({})
    store = CalculationStore(db)

    first_llm = _LLM()
    await _enhance(_orch(store, _Builder(), first_llm), first_llm)
    import asyncio
    await asyncio.sleep(0)
    assert first_llm.calls >= 1

    second_llm = _LLM()
    out = await _enhance(_orch(store, _Builder(), second_llm), second_llm)

    assert second_llm.calls == 0, "the provider must not be called on a hit"
    assert out["tr"]["cache_hit"] is True
    assert out["tr"]["provider_called"] is False
    assert out["base"]["llm_status"] == "cache"
    assert out["base"]["served_from_cache"] is True
    # The thing the user is actually shown.
    assert "23282" in out["base"]["assistant_message"]
    assert out["base"]["assistant_message"] != "deterministic fallback"
    assert out["base"].get("response") is None, "`response` is read by nothing"


@pytest.mark.asyncio
async def test_the_context_is_still_BUILT_on_a_hit_so_the_figures_are_fresh():
    """The whole design: recompute the cheap deterministic half every turn and reuse only the
    expensive prose. A hit that skipped the build would be comparing against nothing."""
    db = FakeSupabase({})
    store = CalculationStore(db)
    builder = _Builder()
    llm1 = _LLM()
    await _enhance(_orch(store, builder, llm1), llm1)
    import asyncio
    await asyncio.sleep(0)
    llm2 = _LLM()
    await _enhance(_orch(store, builder, llm2), llm2)
    assert builder.builds == 2, "the packet is rebuilt on every turn, hit or miss"


# ── It must refuse when the figures moved ───────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_a_changed_BASIS_sends_the_turn_back_to_the_provider():
    db = FakeSupabase({})
    store = CalculationStore(db)
    llm1 = _LLM()
    await _enhance(_orch(store, _Builder(), llm1), llm1)
    import asyncio
    await asyncio.sleep(0)

    moved = {**PACKET, "fingerprints": {"inputs": "i" * 32, "basis": "Z" * 32}}
    llm2 = _LLM()
    out = await _enhance(_orch(store, _Builder(moved), llm2), llm2)
    assert llm2.calls >= 1, "the law moved, so the prose must be regenerated"
    assert out["tr"].get("cache_hit") is False


@pytest.mark.asyncio
async def test_a_changed_INPUTS_fingerprint_also_regenerates():
    db = FakeSupabase({})
    store = CalculationStore(db)
    llm1 = _LLM()
    await _enhance(_orch(store, _Builder(), llm1), llm1)
    import asyncio
    await asyncio.sleep(0)

    moved = {**PACKET, "fingerprints": {"inputs": "Z" * 32, "basis": "b" * 32}}
    llm2 = _LLM()
    await _enhance(_orch(store, _Builder(moved), llm2), llm2)
    assert llm2.calls >= 1


# ── The cache must never be load-bearing ────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_no_packet_means_no_cache_and_a_normal_turn():
    """An ungrounded turn has no fingerprint worth keying on, so it is neither served nor stored."""
    db = FakeSupabase({})
    llm = _LLM()
    out = await _enhance(_orch(CalculationStore(db), _Builder(packet={}), llm), llm)
    assert llm.calls >= 1
    assert out["base"]["llm_status"] == "enhanced"
    assert not (db._by_table.get("answer_cache") or [])


@pytest.mark.asyncio
async def test_NO_STORE_at_all_behaves_exactly_as_before():
    llm = _LLM()
    out = await _enhance(_orch(None, _Builder(), llm), llm)
    assert llm.calls >= 1
    assert out["base"]["llm_status"] == "enhanced"
    assert "cache_hit" in out["tr"] and out["tr"]["cache_hit"] is False


@pytest.mark.asyncio
async def test_a_BROKEN_cache_costs_tokens_not_the_turn():
    """A lookup that raises must degrade to a miss, never to a failed turn."""
    class _Broken:
        async def lookup_answer(self, *a, **k):
            raise RuntimeError("cache exploded")

        async def save_answer(self, *a, **k):
            raise RuntimeError("cache exploded")

    llm = _LLM()
    out = await _enhance(_orch(_Broken(), _Builder(), llm), llm)
    assert llm.calls >= 1
    assert out["base"]["llm_status"] == "enhanced"
    assert out["base"]["assistant_message"] != "deterministic fallback"
