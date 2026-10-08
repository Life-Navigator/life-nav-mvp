"""Opus-on-Vertex as THE model for every route (owner decision 2026-10-07).

Three things have to hold for that decision to be implemented rather than merely intended:
  1. Opus is actually REACHABLE on every route — four separate gates used to prevent it.
  2. The request body asks for the model they are paying for (adaptive thinking is not optional on
     Opus 4.8: omitting it runs the model WITHOUT thinking).
  3. The cost ledger can be told the truth about Vertex rates, which differ from first-party.
"""
import json

import pytest

from app.services import llm_cost as C
from app.services import model_registry as reg
from app.services.advisor_llm import VertexClaudeAdvisorLLM, _claude_system_blocks, _env_flag


# ── 1. Reachability on every route ───────────────────────────────────────────────────────────────
def test_every_user_facing_role_has_opus_as_primary():
    """`classification` is deliberately excluded — it picks an internal label, not user-facing
    advice, so Opus there would pay reasoning prices to choose a string."""
    for role, m in reg.ROLES.items():
        if role == "classification":
            assert m["primary"] == "gemini_flash_lite"
            continue
        assert m["primary"] == "claude_opus_4_8", f"{role} does not lead with Opus"


def test_every_role_keeps_a_non_opus_fallback():
    """The Vertex path depends on ADC. An auth or regional outage must degrade quality, not remove
    the advisor — so no role may have Opus as BOTH primary and fallback."""
    for role, m in reg.ROLES.items():
        assert m["fallback"] != "claude_opus_4_8", f"{role} has no escape from a Vertex outage"


def test_opus_is_enabled_by_its_own_flag_alone(monkeypatch):
    """It used to need PREMIUM_ROUTING_ENABLED as well, because `premium: True` gated it. With Opus
    serving everyone that second gate only produced silent Gemini fallbacks."""
    monkeypatch.setenv("CLAUDE_OPUS_4_8_ENABLED", "true")
    monkeypatch.delenv("PREMIUM_ROUTING_ENABLED", raising=False)
    assert reg.model_enabled("claude_opus_4_8") is True


def test_opus_is_available_to_every_tier():
    """`ModelRouter._resolve` returns None when the caller's tier is not listed, so a missing tier
    here routes that entire plan past Opus to the fallback."""
    assert set(reg.MODELS["claude_opus_4_8"]["tiers"]) == {"free", "plus", "premium", "enterprise"}


def test_opus_no_longer_counts_against_a_premium_allowance():
    """`is_premium` + a 0 free-tier premium allowance made `budget_state` report "exhausted" and
    sent the turn to Gemini. Cost control for a single-model setup is caching, effort and an output
    cap — not a quota that silently downgrades the product."""
    assert reg.is_premium("claude_opus_4_8") is False


# ── 2. The request body ──────────────────────────────────────────────────────────────────────────
class _StubTP:
    def token(self):
        return "adc-token"


def _wrapper():
    return VertexClaudeAdvisorLLM(project="p", region="us-east5", model="claude-opus-4-8",
                                  token_provider=_StubTP())


class _Ctx:
    turn_domains = None

    def prompt_dict(self):
        return {"user_message": "hi"}


async def _capture_body(monkeypatch) -> dict:
    """Drive generate() against a mock transport and return the JSON body it sent."""
    import httpx
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen.update(json.loads(request.content.decode()))
        return httpx.Response(200, json={
            "content": [{"type": "text", "text": '{"reflection":"r","next_question":"q?"}'}],
            "usage": {"input_tokens": 10, "output_tokens": 5},
        })

    real = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient",
                        lambda *a, **k: real(*a, **{**k, "transport": httpx.MockTransport(handler)}))
    await _wrapper().generate(_Ctx(), {"intent": "discovery"})
    return seen


@pytest.mark.asyncio
async def test_adaptive_thinking_is_requested_by_default(monkeypatch):
    """THE most consequential line in this file. On Opus 4.8 `{"type": "adaptive"}` is the only
    on-mode and OMITTING `thinking` runs the model WITHOUT it — the previous body sent nothing, so
    it paid the most expensive model's price for less than it can do."""
    monkeypatch.delenv("CLAUDE_THINKING", raising=False)
    body = await _capture_body(monkeypatch)
    assert body["thinking"] == {"type": "adaptive"}


@pytest.mark.asyncio
async def test_thinking_can_be_switched_off_without_a_deploy(monkeypatch):
    """If Vertex rejects the field, the turn 400s into a Gemini fallback on EVERY request. An env
    switch means that is a config change, not an incident."""
    monkeypatch.setenv("CLAUDE_THINKING", "false")
    body = await _capture_body(monkeypatch)
    assert "thinking" not in body


@pytest.mark.asyncio
async def test_effort_is_omitted_unless_explicitly_set(monkeypatch):
    """The benchmark score (8.84) was measured at the default effort. Silently lowering it would
    invalidate that number while appearing to be a cost win."""
    monkeypatch.delenv("CLAUDE_EFFORT", raising=False)
    assert "output_config" not in await _capture_body(monkeypatch)


@pytest.mark.asyncio
@pytest.mark.parametrize("level", ["low", "medium", "high", "xhigh", "max"])
async def test_effort_is_passed_when_set_to_a_valid_level(monkeypatch, level):
    monkeypatch.setenv("CLAUDE_EFFORT", level)
    body = await _capture_body(monkeypatch)
    assert body["output_config"] == {"effort": level}


@pytest.mark.asyncio
async def test_a_nonsense_effort_value_is_ignored_rather_than_sent(monkeypatch):
    """An invalid enum would 400 the turn. Dropping it keeps the advisor working."""
    monkeypatch.setenv("CLAUDE_EFFORT", "turbo")
    assert "output_config" not in await _capture_body(monkeypatch)


# ── Prompt caching: Anthropic has no implicit cache ──────────────────────────────────────────────
def test_system_is_a_plain_string_when_caching_is_off(monkeypatch):
    monkeypatch.delenv("CLAUDE_PROMPT_CACHE", raising=False)
    assert _claude_system_blocks("SYSTEM") == "SYSTEM"


def test_caching_adds_an_explicit_breakpoint_because_anthropic_has_no_implicit_cache(monkeypatch):
    """Gemini 2.5 caches implicitly — automatic, free, no code. Anthropic does NOT; it is
    `cache_control` breakpoints only. So moving to Claude silently loses a discount the Gemini path
    got for free, re-billing the whole ~5.2k-token stable prefix at Opus input rates every turn.

    Phase 1 already proved the prefix is byte-stable and ordered first, so the breakpoint is all
    that was missing.
    """
    monkeypatch.setenv("CLAUDE_PROMPT_CACHE", "true")
    blocks = _claude_system_blocks("SYSTEM")
    assert blocks == [{"type": "text", "text": "SYSTEM",
                       "cache_control": {"type": "ephemeral"}}]


@pytest.mark.asyncio
async def test_the_cache_breakpoint_reaches_the_wire(monkeypatch):
    monkeypatch.setenv("CLAUDE_PROMPT_CACHE", "true")
    body = await _capture_body(monkeypatch)
    assert isinstance(body["system"], list)
    assert body["system"][0]["cache_control"] == {"type": "ephemeral"}


def test_caching_defaults_off_because_vertex_support_is_preview():
    """Prompt caching for Claude on Vertex is preview and documented as not behaving identically to
    the first-party API. An unsupported field would 400 the turn into a Gemini fallback — a silent
    quality loss — so this is opt-in, and Phase 0's `cached_prompt_tokens` is how you tell whether
    it actually engaged rather than assuming."""
    assert _env_flag("CLAUDE_PROMPT_CACHE") is False


@pytest.mark.asyncio
async def test_cache_read_and_write_tokens_are_captured_for_measurement(monkeypatch):
    """Without this there is no way to know whether the breakpoint did anything on Vertex."""
    import httpx

    def handler(request):
        return httpx.Response(200, json={
            "content": [{"type": "text", "text": '{"reflection":"r","next_question":"q?"}'}],
            "usage": {"input_tokens": 400, "cache_read_input_tokens": 5_000,
                      "cache_creation_input_tokens": 120, "output_tokens": 300},
        })

    real = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient",
                        lambda *a, **k: real(*a, **{**k, "transport": httpx.MockTransport(handler)}))
    w = _wrapper()
    await w.generate(_Ctx(), {"intent": "discovery"})
    u = w.last_usage
    # Anthropic reports cache reads/writes SEPARATELY from input_tokens; they are folded in so the
    # subset convention llm_cost assumes holds.
    assert u["prompt_tokens"] == 400 + 5_000 + 120
    assert u["cached_prompt_tokens"] == 5_000
    assert u["cache_write_prompt_tokens"] == 120


# ── 3. Vertex pricing must be settable ───────────────────────────────────────────────────────────
def test_vertex_rates_can_be_overridden_without_a_deploy(monkeypatch):
    """The table holds Anthropic FIRST-PARTY rates; Vertex is partner-operated with its own list.
    With Opus on every route, a wrong rate does not make the ledger slightly off — it makes it
    fiction, which defeats the reason Phase 0 exists."""
    base = C.cost_usd_micros("claude-opus-4-8", tokens_in=1_000_000)
    monkeypatch.setenv("LLM_PRICE_CLAUDE_OPUS_4_8_IN", "7.50")
    assert C.cost_usd_micros("claude-opus-4-8", tokens_in=1_000_000) == 7_500_000
    assert base != 7_500_000


def test_a_model_absent_from_the_table_is_priceable_by_override_alone(monkeypatch):
    """So a newly-enabled Vertex model is metered the day it ships, instead of silently logging
    cost_known=false forever."""
    assert C.price_known("claude-sonnet-5") is False
    monkeypatch.setenv("LLM_PRICE_CLAUDE_SONNET_5_IN", "2.0")
    monkeypatch.setenv("LLM_PRICE_CLAUDE_SONNET_5_OUT", "10.0")
    assert C.price_known("claude-sonnet-5") is True
    assert C.cost_usd_micros("claude-sonnet-5", tokens_in=1_000_000, tokens_out=1_000_000) == 12_000_000


def test_a_malformed_override_is_ignored_not_treated_as_zero(monkeypatch):
    """A zero rate would report every Opus turn as free."""
    monkeypatch.setenv("LLM_PRICE_CLAUDE_OPUS_4_8_IN", "not-a-number")
    assert C.cost_usd_micros("claude-opus-4-8", tokens_in=1_000_000) == 5_000_000


def test_describe_pricing_warns_that_claude_rates_are_first_party(monkeypatch):
    d = C.describe_pricing()
    assert "FIRST-PARTY" in d["note"] and "Vertex" in d["note"]
    assert d["models"]["claude-opus-4-8"]["overridden"] is False
    monkeypatch.setenv("LLM_PRICE_CLAUDE_OPUS_4_8_OUT", "30.0")
    assert C.describe_pricing()["models"]["claude-opus-4-8"]["overridden"] is True
