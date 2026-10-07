"""LLM cost accounting (Phase 0 — token ledger).

The invariants that matter here are the ones that make a cost ledger trustworthy:
  * provider slugs can never violate the ops.is_llm_provider CHECK (a violation drops the row),
  * an unpriced model yields None (cost UNKNOWN) rather than 0 (cost FREE),
  * money is integer micros and the per-1M arithmetic is not off by a factor of a thousand,
  * cached tokens are never billed at MORE than the uncached price.
"""
import pytest

from app.services import llm_cost as C

# The five values ops.is_llm_provider() accepts (migration 090). Anything else fails the CHECK.
LEGAL_SLUGS = {"gemini", "openai", "anthropic", "local", "other"}


# ── provider_slug ─────────────────────────────────────────────────────────────────────────────────
@pytest.mark.parametrize("internal,expected", [
    ("google_aistudio", "gemini"),
    ("vertex", "gemini"),
    ("vertex_gemini", "gemini"),
    ("google_vertex", "gemini"),
    ("vertex_anthropic", "anthropic"),   # Claude via Vertex is still Anthropic
    ("deterministic", "local"),          # health-safety fallback: no model call
    ("openai", "openai"),
])
def test_provider_slug_maps_internal_names(internal, expected):
    assert C.provider_slug(internal) == expected


@pytest.mark.parametrize("weird", [
    "", "   ", "GOOGLE_AISTUDIO", "  vertex_anthropic  ", "something_new", "nonsense", None,
])
def test_provider_slug_is_always_a_legal_slug(weird):
    """The whole point: no input — including an unknown provider or None — may produce a value that
    violates the DB CHECK. An illegal slug silently drops the usage row, which is the exact failure
    mode this ledger exists to end."""
    assert C.provider_slug(weird) in LEGAL_SLUGS


def test_provider_slug_unknown_is_other():
    assert C.provider_slug("mistral_via_somewhere") == "other"


# ── price_known / unpriced models ─────────────────────────────────────────────────────────────────
def test_unpriced_model_returns_none_not_zero():
    """None means 'cost unknown'. Returning 0 would record an expensive call as free, and a zero in a
    cost ledger is indistinguishable from a genuinely free call."""
    assert C.cost_usd_micros("some-unreleased-model", tokens_in=1000, tokens_out=1000) is None
    assert C.price_known("some-unreleased-model") is False


def test_known_models_are_priced():
    for m in ("gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro", "claude-opus-4-8"):
        assert C.price_known(m) is True
        assert C.cost_usd_micros(m, tokens_in=1) is not None


# ── the per-1M arithmetic ─────────────────────────────────────────────────────────────────────────
def test_one_million_input_tokens_costs_the_quoted_price():
    """1M tokens at $0.30/1M must be exactly $0.30 == 300_000 micros. This is the assertion that
    catches an off-by-1e6 in the rate conversion."""
    assert C.cost_usd_micros("gemini-2.5-flash", tokens_in=1_000_000) == 300_000


def test_one_million_output_tokens_costs_the_quoted_price():
    assert C.cost_usd_micros("gemini-2.5-flash", tokens_out=1_000_000) == 2_500_000


def test_input_and_output_are_summed_at_their_own_rates():
    # 1M in @ $1.25 + 1M out @ $10.00 = $11.25
    assert C.cost_usd_micros("gemini-2.5-pro", tokens_in=1_000_000, tokens_out=1_000_000) == 11_250_000


def test_opus_rates():
    # $5/MTok in, $25/MTok out
    assert C.cost_usd_micros("claude-opus-4-8", tokens_in=1_000_000) == 5_000_000
    assert C.cost_usd_micros("claude-opus-4-8", tokens_out=1_000_000) == 25_000_000


def test_realistic_turn_is_a_sane_sub_cent_amount():
    """A ~4k-in/800-out flash turn should land in the low hundreds of micros (fractions of a cent).
    Guards against a result that is plausible-looking but three orders of magnitude off."""
    micros = C.cost_usd_micros("gemini-2.5-flash", tokens_in=4_000, tokens_out=800)
    assert 0 < micros < 10_000  # under one cent
    assert micros == int(round(4_000 * 0.30 + 800 * 2.50))


def test_zero_tokens_is_zero_cost_not_none():
    """A priced model with no tokens cost nothing — that is a known 0, distinct from unknown."""
    assert C.cost_usd_micros("gemini-2.5-flash") == 0


def test_returns_integer_micros():
    v = C.cost_usd_micros("gemini-2.5-pro", tokens_in=333, tokens_out=777)
    assert isinstance(v, int)


# ── model-id normalization ────────────────────────────────────────────────────────────────────────
def test_vertex_snapshot_suffix_and_rest_prefix_resolve_to_the_same_price():
    """Vertex appends an @-snapshot and the REST surface prefixes `models/`. Neither changes the
    price, so neither may turn a priced model into an unpriced one."""
    base = C.cost_usd_micros("claude-opus-4-8", tokens_in=1000)
    assert C.cost_usd_micros("claude-opus-4-8@20260101", tokens_in=1000) == base
    assert C.cost_usd_micros("models/gemini-2.5-flash", tokens_in=1000) == \
        C.cost_usd_micros("gemini-2.5-flash", tokens_in=1000)


def test_model_id_is_case_insensitive():
    assert C.cost_usd_micros("GEMINI-2.5-FLASH", tokens_in=1000) == \
        C.cost_usd_micros("gemini-2.5-flash", tokens_in=1000)


# ── cached tokens ─────────────────────────────────────────────────────────────────────────────────
def test_cached_tokens_are_cheaper_when_a_cached_rate_exists():
    """Flash-lite publishes $0.01/1M cached vs $0.10/1M input — a cache hit must cost less."""
    full = C.cost_usd_micros("gemini-2.5-flash-lite", tokens_in=1_000_000)
    cached = C.cost_usd_micros("gemini-2.5-flash-lite", tokens_in=1_000_000, cached_tokens_in=1_000_000)
    assert cached < full
    assert cached == 10_000  # 1M @ $0.01


def test_cached_tokens_never_cost_more_than_uncached():
    """Holds even for a model with no published cached rate (billed at the full input rate). A cache
    hit that costs MORE would make Phase 1 look like a regression."""
    for m in ("gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro", "claude-opus-4-8"):
        full = C.cost_usd_micros(m, tokens_in=100_000)
        cached = C.cost_usd_micros(m, tokens_in=100_000, cached_tokens_in=100_000)
        assert cached <= full, m


def test_model_without_published_cached_rate_bills_cached_at_full_input_rate():
    """Deliberate overestimate: for a budget guard, over is safe and under is not."""
    full = C.cost_usd_micros("gemini-2.5-flash", tokens_in=50_000)
    cached = C.cost_usd_micros("gemini-2.5-flash", tokens_in=50_000, cached_tokens_in=50_000)
    assert cached == full


def test_partial_cache_hit_splits_the_input_at_the_two_rates():
    # 1M in, 600k of it cached: 400k @ $1.25 + 600k @ $0.125
    got = C.cost_usd_micros("gemini-2.5-pro", tokens_in=1_000_000, cached_tokens_in=600_000)
    assert got == int(round(400_000 * 1.25 + 600_000 * 0.125))


def test_cached_exceeding_input_is_clamped_not_negative():
    """A provider reporting cached > prompt tokens must not produce a negative uncached count (which
    would subtract money from the bill)."""
    got = C.cost_usd_micros("gemini-2.5-pro", tokens_in=1_000, cached_tokens_in=99_999)
    assert got == int(round(1_000 * 0.125))
    assert got > 0


def test_negative_token_counts_are_floored_at_zero():
    assert C.cost_usd_micros("gemini-2.5-flash", tokens_in=-5, tokens_out=-5) == 0


# ── pricing table surface ─────────────────────────────────────────────────────────────────────────
def test_describe_pricing_reports_a_checked_date_and_every_model():
    d = C.describe_pricing()
    assert d["checked"]  # staleness must be visible at runtime, not only in the source
    assert set(d["models"]) == {"gemini-2.5-flash-lite", "gemini-2.5-flash",
                                "gemini-2.5-pro", "claude-opus-4-8"}
    for rates in d["models"].values():
        assert rates["in"] is not None and rates["out"] is not None


def test_describe_pricing_returns_a_copy():
    """Callers must not be able to mutate the live price table through the diagnostic surface."""
    d = C.describe_pricing()
    d["models"]["gemini-2.5-flash"]["in"] = 999.0
    assert C.cost_usd_micros("gemini-2.5-flash", tokens_in=1_000_000) == 300_000


def test_every_registry_model_is_priced_or_deliberately_free():
    """Drift gate: a model added to model_registry.MODELS without a price here would silently log
    `cost_known: false` forever. Deterministic entries make no model call and are legitimately free.
    """
    from app.services import model_registry as reg
    for key, meta in reg.MODELS.items():
        if meta.get("provider") == "deterministic":
            continue
        assert C.price_known(meta["model_id"]), f"{key} ({meta['model_id']}) has no price in llm_cost._PRICES"


# ── TurnUsage: the undercount fix ─────────────────────────────────────────────────────────────────
def _u(pin=0, out=0, cached=0):
    return {"prompt_tokens": pin, "completion_tokens": out, "cached_prompt_tokens": cached}


def test_turn_usage_sums_every_call_not_just_the_last():
    """THE regression this class exists for. Before: each provider call overwrote the wrapper's
    `last_usage`, so a turn that retried + repaired billed three generations and recorded one."""
    t = C.TurnUsage()
    t.record(model="gemini-2.5-flash", provider="google_aistudio",
             usage=_u(4000, 500), operation_kind="advisor.generate", call_reason="initial")
    t.record(model="gemini-2.5-flash", provider="google_aistudio",
             usage=_u(4000, 450), operation_kind="advisor.generate", call_reason="retry")
    t.record(model="gemini-2.5-flash", provider="google_aistudio",
             usage=_u(4200, 600), operation_kind="advisor.repair", call_reason="repair")

    assert len(t) == 3
    totals = t.totals
    assert totals["prompt_tokens"] == 12_200          # NOT 4_200 (the last call alone)
    assert totals["completion_tokens"] == 1_550       # NOT 600
    assert totals["total_tokens"] == 13_750


def test_turn_usage_prices_each_call_at_its_own_model_rate():
    """A model-fallback turn spans two models at different prices, so one running total cannot price
    it. Flash-lite ($0.10/$0.40) then pro ($1.25/$10.00) must cost the sum of both, not either rate
    applied to the combined tokens."""
    t = C.TurnUsage()
    t.record(model="gemini-2.5-flash-lite", provider="google_aistudio",
             usage=_u(1_000_000, 1_000_000), operation_kind="advisor.generate")
    t.record(model="gemini-2.5-pro", provider="google_aistudio",
             usage=_u(1_000_000, 1_000_000), operation_kind="advisor.generate",
             call_reason="model_fallback")
    expected = (1_000_000 * 0.10 + 1_000_000 * 0.40) + (1_000_000 * 1.25 + 1_000_000 * 10.00)
    assert t.cost_usd_micros_total == int(round(expected))


def test_turn_usage_counts_a_call_that_returned_no_usage():
    """A failed/empty generation was still a billable round-trip; dropping it would make retries
    invisible again."""
    t = C.TurnUsage()
    t.record(model="gemini-2.5-flash", provider="google_aistudio",
             usage=None, operation_kind="advisor.generate")
    assert len(t) == 1
    assert t.totals["total_tokens"] == 0
    assert t.calls[0]["cost_usd_micros"] == 0


def test_turn_usage_cost_fully_known_flags_an_unpriced_model():
    t = C.TurnUsage()
    t.record(model="gemini-2.5-flash", provider="google_aistudio",
             usage=_u(100, 10), operation_kind="advisor.generate")
    assert t.cost_fully_known is True
    t.record(model="brand-new-model", provider="google_aistudio",
             usage=_u(100_000, 10_000), operation_kind="advisor.generate")
    assert t.cost_fully_known is False
    # The unpriced call contributes 0 — so the total is a FLOOR, which the flag is there to say.
    assert t.cost_usd_micros_total == C.cost_usd_micros("gemini-2.5-flash", tokens_in=100, tokens_out=10)


def test_empty_turn_usage_is_zero_and_known():
    t = C.TurnUsage()
    assert t.totals["total_tokens"] == 0
    assert t.cost_usd_micros_total == 0
    assert t.cost_fully_known is True
    assert t.ledger_rows() == []


def test_turn_usage_clamps_cached_to_prompt_tokens():
    t = C.TurnUsage()
    t.record(model="gemini-2.5-pro", provider="google_aistudio",
             usage=_u(1_000, 0, cached=99_999), operation_kind="advisor.generate")
    assert t.calls[0]["tokens_cached_in"] == 1_000
    assert t.calls[0]["cost_usd_micros"] > 0


def test_ledger_rows_are_per_call_and_indexed_in_order():
    t = C.TurnUsage()
    for reason in ("initial", "retry", "repair"):
        t.record(model="gemini-2.5-flash", provider="google_aistudio",
                 usage=_u(10, 1), operation_kind="advisor.generate", call_reason=reason)
    rows = t.ledger_rows(user_id="u-1", turn_id="11111111-1111-1111-1111-111111111111",
                         conversation_id="c-9")
    assert len(rows) == 3
    assert [r["call_index"] for r in rows] == [0, 1, 2]
    assert [r["call_reason"] for r in rows] == ["initial", "retry", "repair"]
    assert all(r["user_id"] == "u-1" and r["conversation_id"] == "c-9" for r in rows)


def test_ledger_rows_keep_the_internal_provider_name_and_carry_the_slug_in_metadata():
    """analytics.llm_call_usage has NO is_llm_provider CHECK, so there is nothing to satisfy by
    collapsing `provider` to a 5-value slug — and collapsing it would erase which auth path served
    the call (google_aistudio vs google_vertex), the one thing the indexed column can answer that
    `model` cannot. The slug stays available in metadata for coarse rollups."""
    t = C.TurnUsage()
    t.record(model="claude-opus-4-8", provider="vertex_anthropic",
             usage=_u(100, 50), operation_kind="advisor.generate")
    row = t.ledger_rows()[0]
    assert row["provider"] == "vertex_anthropic"
    assert row["metadata"]["provider_slug"] == "anthropic"


def test_aistudio_and_vertex_stay_distinguishable_in_the_provider_column():
    t = C.TurnUsage()
    t.record(model="gemini-2.5-flash", provider="google_aistudio",
             usage=_u(10, 1), operation_kind="advisor.generate")
    t.record(model="gemini-2.5-flash", provider="google_vertex",
             usage=_u(10, 1), operation_kind="advisor.generate")
    providers = [r["provider"] for r in t.ledger_rows()]
    assert providers == ["google_aistudio", "google_vertex"]
    # Both still roll up to the same coarse slug.
    assert {r["metadata"]["provider_slug"] for r in t.ledger_rows()} == {"gemini"}


def test_ledger_rows_omit_correlation_keys_when_not_supplied():
    """Off the advisor path there is no turn_id; the column is nullable and the key must simply be
    absent rather than present-and-None (which PostgREST would write as an explicit null)."""
    t = C.TurnUsage()
    t.record(model="gemini-2.5-flash", provider="google_aistudio",
             usage=_u(5, 1), operation_kind="relationship.interpret")
    row = t.ledger_rows()[0]
    assert "turn_id" not in row and "user_id" not in row and "conversation_id" not in row


def test_ledger_rows_do_not_alias_internal_state():
    """A caller mutating a returned row must not corrupt the accumulator."""
    t = C.TurnUsage()
    t.record(model="gemini-2.5-flash", provider="google_aistudio",
             usage=_u(10, 2), operation_kind="advisor.generate")
    t.ledger_rows()[0]["tokens_in"] = 999_999
    assert t.totals["prompt_tokens"] == 10


def test_ledger_row_keys_match_the_migration_columns():
    """Drift gate against 20261007000000_llm_call_usage.sql. A key the table lacks 400s the insert
    and silently drops the row — the lesson _ADVISOR_TURNS_COLUMNS was written to remember."""
    columns = {
        "id", "created_at", "user_id", "turn_id", "conversation_id", "provider", "model",
        "operation_kind", "call_index", "call_reason", "tokens_in", "tokens_out",
        "tokens_thoughts", "tokens_cached_in", "tokens_cache_write_in",
        "cost_usd_micros", "cost_known", "latency_ms", "metadata",
    }
    t = C.TurnUsage()
    t.record(model="gemini-2.5-flash", provider="google_aistudio",
             usage=_u(10, 2), operation_kind="advisor.generate", latency_ms=1234)
    row = t.ledger_rows(user_id="u", turn_id="t", conversation_id="c")[0]
    assert set(row).issubset(columns), set(row) - columns
