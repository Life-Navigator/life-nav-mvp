"""Phase 0 — token ledger: what the clients put ON THE WIRE and read back OFF it.

test_llm_cost.py proves the arithmetic. This file proves the inputs to that arithmetic are real:
an output cap that is actually sent, and a cached-token count that is actually parsed. Both were
previously unobservable — `maxOutputTokens` was never sent at all, and `cachedContentTokenCount`
was dropped on the floor, which is what made prompt caching unverifiable.
"""
import httpx
import pytest

from app.clients.gemini import GeminiClient, VertexGeminiClient, _generation_config, _usage_from


# ── _generation_config: the payload key is omitted entirely when nothing is constrained ───────────
def test_generation_config_empty_when_nothing_set():
    """An empty dict means the caller omits `generationConfig` from the payload. Sending
    `generationConfig: {}` is a needless difference in the request body — and request bodies are
    cache keys, so gratuitous variation is not free."""
    assert _generation_config(None, None) == {}


def test_generation_config_carries_temperature_only():
    assert _generation_config(0.4, None) == {"temperature": 0.4}


def test_generation_config_carries_max_output_tokens_only():
    assert _generation_config(None, 2048) == {"maxOutputTokens": 2048}


def test_generation_config_carries_both():
    assert _generation_config(0.2, 512) == {"temperature": 0.2, "maxOutputTokens": 512}


@pytest.mark.parametrize("bad", [0, -1, -2048])
def test_generation_config_ignores_nonpositive_cap(bad):
    """A 0/negative cap would be a request for zero output. Treat it as 'no cap' rather than
    shipping a value that makes every generation empty."""
    assert "maxOutputTokens" not in _generation_config(None, bad)


# ── _usage_from: the cache-hit subset is the point ────────────────────────────────────────────────
def test_usage_from_parses_every_field():
    usage = _usage_from({"usageMetadata": {
        "promptTokenCount": 4000, "candidatesTokenCount": 800,
        "totalTokenCount": 4800, "cachedContentTokenCount": 3500,
    }})
    assert usage == {"prompt_tokens": 4000, "completion_tokens": 800, "thoughts_tokens": 0,
                     "total_tokens": 4800, "cached_prompt_tokens": 3500}


def test_thinking_tokens_are_counted_as_billed_OUTPUT():
    """On Gemini 2.5, `thoughtsTokenCount` is EXCLUDED from `candidatesTokenCount` but BILLED at the
    output rate. Reading candidates alone understated the expensive side of the bill — reportedly by
    ~8.5x on thinking-heavy turns — which is the exact failure llm_cost exists to prevent. The
    default generation model (config.py) is gemini-2.5-pro, a thinking model, so this is the normal
    case and not an edge case."""
    usage = _usage_from({"usageMetadata": {
        "promptTokenCount": 1000, "candidatesTokenCount": 200,
        "thoughtsTokenCount": 1800, "totalTokenCount": 3000,
    }})
    assert usage["completion_tokens"] == 2000, "candidates + thoughts = billed output"
    assert usage["thoughts_tokens"] == 1800   # kept separately for visibility


def test_folding_thoughts_into_output_reconciles_with_the_provider_total():
    """Google's `totalTokenCount` includes thoughts while TurnUsage recomputes total = in + out. With
    thoughts folded into output the two agree; without it the ledger would silently disagree with the
    provider's own total on every thinking turn."""
    u = _usage_from({"usageMetadata": {
        "promptTokenCount": 1000, "candidatesTokenCount": 200,
        "thoughtsTokenCount": 1800, "totalTokenCount": 3000,
    }})
    assert u["prompt_tokens"] + u["completion_tokens"] == u["total_tokens"] == 3000


def test_usage_from_defaults_cached_to_zero_when_absent():
    """Providers omit cachedContentTokenCount when nothing was cached. Absent must read as 0 — not
    as missing — so the ledger can distinguish 'no cache hit' from 'field not captured'."""
    usage = _usage_from({"usageMetadata": {"promptTokenCount": 10, "candidatesTokenCount": 2,
                                           "totalTokenCount": 12}})
    assert usage["cached_prompt_tokens"] == 0


def test_usage_from_tolerates_a_missing_usage_block():
    """A truncated/errored response must not raise inside telemetry — zeros, not an exception."""
    assert _usage_from({}) == {"prompt_tokens": 0, "completion_tokens": 0, "thoughts_tokens": 0,
                               "total_tokens": 0, "cached_prompt_tokens": 0}


def test_usage_from_keeps_the_three_legacy_keys():
    """advisor_orchestrator reads these three by name; renaming any of them silently zeroes the
    per-turn token columns in analytics.advisor_turns."""
    usage = _usage_from({"usageMetadata": {"promptTokenCount": 1}})
    for k in ("prompt_tokens", "completion_tokens", "total_tokens"):
        assert k in usage


# ── end-to-end through the real clients (mock transport) ──────────────────────────────────────────
def _capture_transport(captured: dict, *, usage: dict | None = None):
    def handler(request: httpx.Request) -> httpx.Response:
        import json as _json
        captured["body"] = _json.loads(request.content.decode())
        return httpx.Response(200, json={
            "candidates": [{"content": {"parts": [{"text": "ok"}]}}],
            "usageMetadata": usage or {"promptTokenCount": 9, "candidatesTokenCount": 3,
                                       "totalTokenCount": 12, "cachedContentTokenCount": 7},
        })
    return httpx.MockTransport(handler)


@pytest.fixture
def mock_httpx(monkeypatch):
    """Patch httpx.AsyncClient so the clients' own `async with httpx.AsyncClient(...)` is captured."""
    captured: dict = {}
    real = httpx.AsyncClient

    def _factory(*a, **k):
        k["transport"] = _capture_transport(captured)
        return real(*a, **k)

    monkeypatch.setattr(httpx, "AsyncClient", _factory)
    return captured


@pytest.mark.asyncio
async def test_aistudio_client_sends_max_output_tokens(mock_httpx):
    c = GeminiClient(api_key="k", embedding_model="e", generation_model="gemini-2.5-flash")
    text, usage = await c.generate_with_usage("sys", "user", 0.3, max_output_tokens=2048)
    assert text == "ok"
    assert mock_httpx["body"]["generationConfig"] == {"temperature": 0.3, "maxOutputTokens": 2048}
    assert usage["cached_prompt_tokens"] == 7


@pytest.mark.asyncio
async def test_aistudio_client_omits_generation_config_when_unconstrained(mock_httpx):
    c = GeminiClient(api_key="k", embedding_model="e", generation_model="gemini-2.5-flash")
    await c.generate_with_usage("sys", "user")
    assert "generationConfig" not in mock_httpx["body"]


@pytest.mark.asyncio
async def test_plain_generate_still_forwards_the_cap(mock_httpx):
    """generate() is the convenience wrapper; a cap passed there must not be silently dropped."""
    c = GeminiClient(api_key="k", embedding_model="e", generation_model="gemini-2.5-flash")
    out = await c.generate("sys", "user", 0.1, max_output_tokens=256)
    assert out == "ok"
    assert mock_httpx["body"]["generationConfig"]["maxOutputTokens"] == 256


class _StubTP:
    def token(self):
        return "adc-token"


@pytest.mark.asyncio
async def test_vertex_client_sends_max_output_tokens_too(mock_httpx):
    """The two clients must stay in lockstep: a cap honoured on AI Studio but dropped on Vertex
    would make cost behaviour depend on which auth path happened to be configured."""
    c = VertexGeminiClient(project="p", region="us-central1",
                           generation_model="gemini-2.5-pro", token_provider=_StubTP())
    _text, usage = await c.generate_with_usage("sys", "user", 0.5, max_output_tokens=1024)
    assert mock_httpx["body"]["generationConfig"] == {"temperature": 0.5, "maxOutputTokens": 1024}
    assert usage["cached_prompt_tokens"] == 7


@pytest.mark.asyncio
async def test_both_clients_report_a_provider_that_maps_to_a_legal_ledger_slug():
    """Closes the loop between the clients and llm_cost: whatever `provider` the client advertises
    has to survive the ops.is_llm_provider CHECK, or its usage rows are dropped on insert."""
    from app.services.llm_cost import provider_slug
    legal = {"gemini", "openai", "anthropic", "local", "other"}
    assert provider_slug(GeminiClient.provider) == "gemini"
    assert provider_slug(VertexGeminiClient.provider) in legal


# ── Orchestrator: the turn-level undercount, end to end ───────────────────────────────────────────
# Reuses test_advisor_hybrid's harness so this exercises the REAL _enhance path (routing, validation,
# repair, fallback) rather than a reimplementation of it.
from tests.test_advisor_hybrid import (  # noqa: E402
    AdvisorContextBuilder, AdvisorOrchestrator, FakeCoverage, FakeRM, FakeSupabase,
    _base, _ctx, _good_llm,
)


class _SequenceLLM:
    """Returns a scripted sequence of outputs, reporting per-call token usage like the real wrapper.

    Critically it OVERWRITES `last_usage` on every call, exactly as GeminiAdvisorLLM does — so if the
    orchestrator ever goes back to reading `last_usage` instead of the accumulator, these tests fail.
    """

    prompt_version = "test"
    provider = "google_aistudio"
    model_name = "gemini-2.5-flash"

    def __init__(self, outputs, per_call_usage):
        self._outputs = list(outputs)
        self._usage = list(per_call_usage)
        self.calls = 0
        self.last_usage = {}
        self.last_raw = ""
        self.last_error = ""

    @property
    def available(self):
        return True

    async def generate(self, context, plan):
        i = min(self.calls, len(self._outputs) - 1)
        self.calls += 1
        self.last_usage = dict(self._usage[min(i, len(self._usage) - 1)])
        out = self._outputs[i]
        self.last_raw = "{}" if out else ""
        return out


def _orch(llm):
    return AdvisorOrchestrator(
        FakeRM(_base()), AdvisorContextBuilder(FakeSupabase(), coverage=FakeCoverage()), llm,
    )


def _u3(pin, out):
    return {"prompt_tokens": pin, "completion_tokens": out, "total_tokens": pin + out,
            "cached_prompt_tokens": 0}


@pytest.mark.asyncio
async def test_single_call_turn_records_one_call_and_its_tokens():
    llm = _SequenceLLM([_good_llm()], [_u3(4000, 500)])
    out = await _orch(llm).converse(_ctx(), "what should I do", trace=True)
    tr = out["_trace"]
    assert llm.calls == 1
    assert tr["provider_calls"] == 1
    assert tr["prompt_tokens"] == 4000 and tr["completion_tokens"] == 500
    assert tr["total_tokens"] == 4500


@pytest.mark.asyncio
async def test_retry_turn_counts_BOTH_calls_not_just_the_last():
    """THE regression. First call returns None (transient provider failure) → orchestrator retries.
    Two generations were billed. Before the accumulator, `last_usage` held only the second, so the
    turn reported 4,500 tokens for 9,000 tokens of spend."""
    llm = _SequenceLLM([None, _good_llm()], [_u3(4000, 0), _u3(4000, 500)])
    out = await _orch(llm).converse(_ctx(), "what should I do", trace=True)
    tr = out["_trace"]

    assert llm.calls == 2, "expected the orchestrator's one retry"
    assert tr["provider_calls"] == 2
    assert tr["prompt_tokens"] == 8000          # 4000 + 4000, NOT 4000
    assert tr["completion_tokens"] == 500
    assert tr["total_tokens"] == 8500           # NOT 4500
    # And it is NOT merely the final call's usage.
    assert tr["total_tokens"] != llm.last_usage["total_tokens"]


@pytest.mark.asyncio
async def test_turn_cost_is_recorded_and_scales_with_the_retry():
    """Cost must follow the same accumulation — a retried turn genuinely costs more."""
    one = _SequenceLLM([_good_llm()], [_u3(4000, 500)])
    out_one = await _orch(one).converse(_ctx(), "what should I do", trace=True)

    two = _SequenceLLM([None, _good_llm()], [_u3(4000, 0), _u3(4000, 500)])
    out_two = await _orch(two).converse(_ctx(), "what should I do", trace=True)

    c1 = out_one["_trace"]["cost_usd_micros"]
    c2 = out_two["_trace"]["cost_usd_micros"]
    assert c1 > 0
    assert c2 > c1, "a turn that retried must cost more than one that did not"
    assert out_one["_trace"]["cost_fully_known"] is True


@pytest.mark.asyncio
async def test_unavailable_provider_turn_still_records_the_attempts():
    """A turn that never got a usable answer still made billable round-trips. Recording zero calls
    would hide the cost of a provider outage, which is exactly when spend spikes."""
    llm = _SequenceLLM([None], [_u3(3000, 0)])
    out = await _orch(llm).converse(_ctx(), "what should I do", trace=True)
    tr = out["_trace"]
    assert tr["llm_status"].startswith("fallback")
    assert tr["provider_calls"] >= 1
    assert tr["prompt_tokens"] >= 3000


@pytest.mark.asyncio
async def test_usage_accumulator_is_not_persisted_to_advisor_turns():
    """`tr['_usage']` is a live object, not a column. The _ADVISOR_TURNS_COLUMNS whitelist must keep
    it out of the insert — an unknown key 400s the row and silently drops the whole turn."""
    from app.services.advisor_orchestrator import _ADVISOR_TURNS_COLUMNS
    assert "_usage" not in _ADVISOR_TURNS_COLUMNS
    llm = _SequenceLLM([_good_llm()], [_u3(10, 2)])
    out = await _orch(llm).converse(_ctx(), "hi", trace=True)
    row = {k: out["_trace"].get(k) for k in _ADVISOR_TURNS_COLUMNS if k in out["_trace"]}
    import json
    json.dumps(row)  # must be serializable — proves no live object leaked into the row


@pytest.mark.asyncio
async def test_ledger_rows_reach_the_insert_boundary_and_are_homogeneous(monkeypatch):
    """Asserted at the real insert boundary, not by reaching into the trace — `_usage` is popped in
    _finish precisely so it never escapes into an API response.

    PostgREST derives the column set from the FIRST element of an array insert, so every row in one
    bulk call must share the same keys or the later rows silently lose columns.
    """
    captured: dict = {}

    class _CapturingSb:
        configured = True

        async def insert(self, table, row, *, schema="public"):
            captured.setdefault(table, []).append((schema, row))
            return []

    llm = _SequenceLLM([None, _good_llm()], [_u3(100, 0), _u3(100, 20)])
    orch = AdvisorOrchestrator(
        FakeRM(_base()), AdvisorContextBuilder(FakeSupabase(), coverage=FakeCoverage()), llm,
        supabase=_CapturingSb(),
    )
    monkeypatch.setenv("CALL_USAGE_LEDGER_ENABLED", "true")
    out = await orch.converse(_ctx(), "what should I do", trace=True)

    # The write is fire-and-forget; let the pending task run.
    import asyncio
    await asyncio.sleep(0)

    assert "llm_call_usage" in captured, "the per-call ledger insert never fired"
    schema, rows = captured["llm_call_usage"][0]
    assert schema == "analytics"
    assert isinstance(rows, list) and len(rows) == 2, "one row per provider call (initial + retry)"
    assert len({frozenset(r) for r in rows}) == 1, "heterogeneous keys would truncate the bulk insert"
    # Correlated to the turn, and summing to the same total the turn row reports.
    assert all(r["turn_id"] == out["_trace"]["turn_id"] for r in rows)
    assert sum(r["tokens_in"] + r["tokens_out"] for r in rows) == out["_trace"]["total_tokens"]
    # latency_ms must be real, not NULL: the migration's rollup advertises avg_latency_ms, and a
    # column that is always NULL is a metric that lies by omission.
    assert all(isinstance(r["latency_ms"], int) and r["latency_ms"] >= 0 for r in rows)
    # The internal provider name survives into the indexed column.
    assert all(r["provider"] == "google_aistudio" for r in rows)


# ── The output cap: OFF by default, and correct when enabled ──────────────────────────────────────
def test_cap_is_off_by_default(monkeypatch):
    """Phase 0 is measurement. Capping output CHANGES GENERATION BEHAVIOUR, so it must be opt-in.

    The first cut sourced the cap from `model_registry.MODELS[*].max_tokens` == 2048 — a field with
    no consumers (documentation only) carrying a value this repo had already proven unsafe twice:
    the VertexClaude body comment ("2048 truncated long plans ... 4096 matches Gemini's effective
    output headroom"), and gemini-2.5-pro — the DEFAULT generation model — being a thinking model
    whose reasoning tokens count against `maxOutputTokens`. A 2048 ceiling there returns
    finishReason: MAX_TOKENS with no text, which parses to None → retry → deterministic fallback:
    the advisor silently degrades on its longest, highest-value answers while billing three
    generations per turn. Unset therefore means NO cap.
    """
    from app.services import model_registry as reg
    monkeypatch.delenv("ADVISOR_MAX_OUTPUT_TOKENS", raising=False)
    assert reg.advisor_max_output_tokens() is None


@pytest.mark.parametrize("raw,expected", [
    ("4096", 4096), ("8192", 8192), ("  4096  ", 4096),
    ("", None), ("0", None), ("-1", None), ("abc", None), ("4096.5", None),
])
def test_cap_env_parsing_is_fail_safe(monkeypatch, raw, expected):
    """Any unusable value means 'no cap', never a guessed one — a malformed env var must not quietly
    throttle generation."""
    from app.services import model_registry as reg
    monkeypatch.setenv("ADVISOR_MAX_OUTPUT_TOKENS", raw)
    assert reg.advisor_max_output_tokens() == expected


def test_registry_max_tokens_is_no_longer_wired_to_generation():
    """Guard against re-introducing the regression: the doc-only 2048 field must not become the cap
    again. If a future change wants a per-model cap, it needs its own correctly-valued field."""
    from app.services import model_registry as reg
    assert not hasattr(reg, "max_tokens_for_model_id")
    assert reg.MODELS["gemini_2_5_pro"]["max_tokens"] == 2048, (
        "the field itself is unchanged — it is simply no longer wired to generation"
    )


def test_one_normalizer_is_shared_by_the_registry_and_the_price_table():
    """Two functions normalizing the same identifier differently is how a lookup starts succeeding in
    the price table and failing for the cap (or vice versa)."""
    from app.services import model_registry as reg
    from app.services import llm_cost as LC
    for raw in ("models/gemini-2.5-pro", "GEMINI-2.5-PRO", "claude-opus-4-8@20260101", " gemini-2.5-flash "):
        assert reg.normalize_model_id(raw) == LC._normalize_model(raw)
    assert reg.normalize_model_id("models/gemini-2.5-pro") == "gemini-2.5-pro"


@pytest.mark.asyncio
async def test_advisor_omits_the_cap_when_unset_and_sends_it_when_set(monkeypatch):
    from app.services.advisor_llm import GeminiAdvisorLLM
    from tests.test_advisor_hybrid import _build_ctx, _base as _b
    import json as _json

    seen = {}

    class _Modern:
        configured = True
        model_name = "gemini-2.5-flash"

        async def generate_with_usage(self, system, user, temperature=None, *, max_output_tokens=None):
            seen["cap"] = max_output_tokens
            return _json.dumps(_good_llm()), {"prompt_tokens": 1, "completion_tokens": 1,
                                              "total_tokens": 2}

    ctx = await _build_ctx("retire at 60", _b())

    monkeypatch.delenv("ADVISOR_MAX_OUTPUT_TOKENS", raising=False)
    assert await GeminiAdvisorLLM(_Modern()).generate(ctx, {"intent": "discovery"}) is not None
    assert seen["cap"] is None, "default must not constrain generation"

    monkeypatch.setenv("ADVISOR_MAX_OUTPUT_TOKENS", "4096")
    assert await GeminiAdvisorLLM(_Modern()).generate(ctx, {"intent": "discovery"}) is not None
    assert seen["cap"] == 4096


@pytest.mark.asyncio
async def test_advisor_does_not_break_an_old_client_that_lacks_the_kwarg():
    """Backward compatibility, checked by signature so an unexpected-kwarg TypeError can never turn
    into a second (billed) generation."""
    from app.services.advisor_llm import GeminiAdvisorLLM
    from tests.test_advisor_hybrid import _build_ctx, _base as _b
    import json as _json

    calls = {"n": 0}

    class _Legacy:
        configured = True
        model_name = "gemini-2.5-flash"

        async def generate_with_usage(self, system, user, temperature=None):
            calls["n"] += 1
            return _json.dumps(_good_llm()), {"prompt_tokens": 1, "completion_tokens": 1,
                                              "total_tokens": 2}

    ctx = await _build_ctx("retire at 60", _b())
    out = await GeminiAdvisorLLM(_Legacy()).generate(ctx, {"intent": "discovery"})
    assert out is not None
    assert calls["n"] == 1, "must not retry — a retry here would be a second billed generation"


# ── Regressions found while auditing Phase 0 ──────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_repair_calls_are_included_in_the_turn_totals():
    """The totals must be the FINAL state of the accumulator.

    The first cut snapshotted `usage_acc.totals` straight after the initial/retry/fallback calls —
    which is BEFORE the supervised repair loop runs. Repair calls were recorded into the accumulator
    but never reached the advisor_turns columns, so a repaired turn still undercounted and the
    per-call ledger disagreed with the per-turn row. Same class of bug as the one Phase 0 set out to
    fix, one stage further down.
    """
    bad = _good_llm(reflection="Given your $87,432 salary, you should move fast.")  # ungrounded number
    llm = _SequenceLLM([bad, _good_llm()], [_u3(4000, 500), _u3(4100, 600)])
    out = await _orch(llm).converse(_ctx(), "what should I do about my finances", trace=True)
    tr = out["_trace"]

    assert llm.calls == 2, "expected the validator to reject once and trigger one repair"
    assert tr.get("repair_attempts") == 1
    assert tr["provider_calls"] == 2
    assert tr["prompt_tokens"] == 8100          # 4000 + 4100, not 4000
    assert tr["total_tokens"] == 9200           # not 4500


@pytest.mark.asyncio
async def test_trace_payload_is_json_serializable():
    """`trace=true` is an API-reachable Body param on /v1/life/* (gated by ADVISOR_TRACE_ENABLED),
    and _finish attaches `tr` to the response as `_trace`. The accumulator is a live object, so
    leaving it on `tr` made FastAPI's response serialization raise — a 500 on every traced turn."""
    import json
    llm = _SequenceLLM([_good_llm()], [_u3(10, 2)])
    out = await _orch(llm).converse(_ctx(), "what should I do", trace=True)
    json.dumps(out)  # must not raise


@pytest.mark.asyncio
async def test_turn_totals_always_equal_the_per_call_ledger():
    """The invariant tying the two surfaces together: analytics.advisor_turns and
    analytics.llm_call_usage must never disagree about one turn's spend."""
    bad = _good_llm(reflection="Your $55,123 cushion covers it.")
    llm = _SequenceLLM([bad, _good_llm()], [_u3(1000, 100), _u3(1200, 150)])
    out = await _orch(llm).converse(_ctx(), "what should I do about my finances", trace=True)
    tr = out["_trace"]
    assert tr["prompt_tokens"] + tr["completion_tokens"] == tr["total_tokens"]
    assert tr["total_tokens"] == 2450
    assert tr["cost_usd_micros"] > 0


def test_anthropic_cache_semantics_are_normalized_to_the_subset_convention():
    """Anthropic reports `cache_read_input_tokens` SEPARATELY from `input_tokens`; Gemini reports
    `cachedContentTokenCount` as a SUBSET of `promptTokenCount`. llm_cost assumes the subset
    convention, so the Claude wrapper must fold cache reads into the prompt total — otherwise a
    cache-heavy turn undercounts its prompt size and Phase 1 looks like it cut tokens rather than
    their price.

    Asserted against the documented wire shape rather than through a live call, since the Vertex
    Claude path is flag-gated and needs ADC.
    """
    u = {"input_tokens": 1000, "cache_read_input_tokens": 9000, "output_tokens": 200}
    cache_read = int(u.get("cache_read_input_tokens") or 0)
    prompt = int(u.get("input_tokens") or 0) + cache_read
    assert prompt == 10_000, "the real prompt was 10k tokens, 9k of them cached"
    assert cache_read <= prompt, "the subset invariant llm_cost relies on"

    # And the cost must be strictly below billing all 10k at the full input rate.
    from app.services import llm_cost as LC
    cached_cost = LC.cost_usd_micros("claude-opus-4-8", tokens_in=prompt, tokens_out=200,
                                     cached_tokens_in=cache_read)
    full_cost = LC.cost_usd_micros("claude-opus-4-8", tokens_in=prompt, tokens_out=200)
    assert cached_cost < full_cost


def test_claude_wrapper_declares_an_anthropic_provider():
    """_record_call reads `provider` off the live wrapper; a missing attribute would silently label
    every Claude call 'other' in the ledger."""
    from app.services.advisor_llm import VertexClaudeAdvisorLLM
    from app.services.llm_cost import provider_slug
    assert provider_slug(VertexClaudeAdvisorLLM.provider) == "anthropic"


@pytest.mark.asyncio
async def test_streaming_final_event_is_json_serializable_with_trace():
    """converse_stream yields `{"type": "final", **base}` AFTER _finish, so the stream carries
    `_trace` too — the same 500-on-traced-turn exposure as the non-streaming path, via a different
    door. Also covers the early-_finish stream branches, where _enhance never ran and there is no
    accumulator on `tr` to pop."""
    import json
    llm = _SequenceLLM([_good_llm()], [_u3(1000, 200)])
    orch = _orch(llm)
    events = [e async for e in orch.converse_stream(_ctx(), "what should I do", trace=True)]
    assert [e["type"] for e in events] == ["ack", "final"]
    json.dumps(events)  # must not raise
    final = events[-1]
    assert final["_trace"]["total_tokens"] == 1200
    assert final["_trace"]["provider_calls"] == 1


@pytest.mark.asyncio
async def test_ledger_write_is_off_by_default(monkeypatch):
    """The table arrives in an UNAPPLIED migration. Ungated, every turn would POST to a non-existent
    table and log a warning — one per turn, in a repo where unapplied migrations recur."""
    monkeypatch.delenv("CALL_USAGE_LEDGER_ENABLED", raising=False)
    captured: dict = {}

    class _Sb:
        configured = True

        async def insert(self, table, row, *, schema="public"):
            captured.setdefault(table, []).append(row)
            return []

    llm = _SequenceLLM([_good_llm()], [_u3(100, 20)])
    orch = AdvisorOrchestrator(
        FakeRM(_base()), AdvisorContextBuilder(FakeSupabase(), coverage=FakeCoverage()), llm,
        supabase=_Sb(),
    )
    out = await orch.converse(_ctx(), "what should I do", trace=True)
    import asyncio
    await asyncio.sleep(0)
    assert "llm_call_usage" not in captured
    # Telemetry is still fully observable on the turn row + log line while the flag is off.
    assert out["_trace"]["total_tokens"] == 120
    assert out["_trace"]["cost_usd_micros"] > 0


@pytest.mark.asyncio
async def test_unavailable_provider_records_no_calls():
    """A wrapper that short-circuits on `not available` issues NO HTTP request. Counting those made
    provider_calls read 2 for a misconfigured deployment that made zero round-trips."""
    class _Unavailable:
        prompt_version = "test"
        provider = "google_aistudio"
        model_name = "gemini-2.5-flash"
        last_usage: dict = {}
        last_raw = ""
        last_error = "not_available"

        @property
        def available(self):
            return False

        async def generate(self, context, plan):
            return None

    orch = AdvisorOrchestrator(
        FakeRM(_base()), AdvisorContextBuilder(FakeSupabase(), coverage=FakeCoverage()), _Unavailable(),
    )
    out = await orch.converse(_ctx(), "what should I do", trace=True)
    tr = out["_trace"]
    assert tr["llm_status"].startswith("fallback")
    assert tr.get("provider_calls", 0) == 0, "no round-trip happened, so nothing to count"
    assert tr.get("cost_usd_micros", 0) == 0


def test_anthropic_cache_writes_are_priced_above_the_input_rate():
    """Cache creation bills ~1.25x input, so a priming turn must cost MORE than an uncached one —
    otherwise the first turn of every conversation looks free."""
    from app.services import llm_cost as LC
    plain = LC.cost_usd_micros("claude-opus-4-8", tokens_in=100_000)
    priming = LC.cost_usd_micros("claude-opus-4-8", tokens_in=100_000,
                                 cache_write_tokens_in=100_000)
    reading = LC.cost_usd_micros("claude-opus-4-8", tokens_in=100_000,
                                 cached_tokens_in=100_000)
    assert priming > plain > reading


def test_cache_read_and_write_subsets_cannot_exceed_the_prompt():
    """Over-reporting must never yield a negative uncached remainder (which would subtract money)."""
    from app.services import llm_cost as LC
    got = LC.cost_usd_micros("claude-opus-4-8", tokens_in=1_000,
                             cached_tokens_in=5_000, cache_write_tokens_in=5_000)
    assert got is not None and got > 0


def test_thoughts_are_not_double_charged_by_turnusage():
    """`completion_tokens` already contains thoughts (the clients fold them in). TurnUsage must carry
    `tokens_thoughts` for visibility WITHOUT pricing it a second time."""
    from app.services import llm_cost as LC
    t = LC.TurnUsage()
    t.record(model="gemini-2.5-pro", provider="google_aistudio",
             usage={"prompt_tokens": 1000, "completion_tokens": 2000, "thoughts_tokens": 1800},
             operation_kind="advisor.generate")
    assert t.calls[0]["tokens_out"] == 2000
    assert t.calls[0]["tokens_thoughts"] == 1800
    assert t.cost_usd_micros_total == LC.cost_usd_micros("gemini-2.5-pro", tokens_in=1000,
                                                         tokens_out=2000)
