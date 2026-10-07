"""Deterministic LLM cost accounting (Phase 0 — token ledger).

WHY THIS EXISTS
---------------
Token counts were already being captured (`generate_with_usage` reads Gemini's `usageMetadata`) and
already persisted per turn (`analytics.advisor_turns.prompt_tokens/completion_tokens/total_tokens`).
What was missing was *money*: nothing in the Python tier ever converted tokens to a cost, so the
question "what does one advisor turn cost?" was unanswerable. `model_registry.MODELS[*].cost_estimate`
is a hand-written $/turn guess from list pricing at an assumed ~3.5k-in/0.7k-out shape — useful for
routing decisions, useless as accounting, and it drifts silently from both reality and the price list.

This module is the one place that knows prices. It does three things and nothing else:

  1. `provider_slug()`  — maps our internal provider names onto the FIVE values
                          `ops.is_llm_provider()` accepts, so a ledger insert cannot fail its CHECK.
  2. `cost_usd_micros()` — integer micro-dollar cost from a token triple.
  3. `price_known()`    — says whether a model has a price at all, so an unpriced model is recorded
                          as "cost unknown" rather than silently as "cost zero".

DESIGN RULES
------------
* **Integer money.** `ops.llm_usage_meter.cost_usd_micros` is a BIGINT of millionths of a USD. Float
  dollars accumulate representation error across millions of rows; micros do not.
* **Never guess a price.** An unrecognised model returns `None` from `cost_usd_micros()`, and the
  caller records 0 with `cost_known: false` in metadata. A wrong number in a cost ledger is worse
  than an absent one — it gets trusted and budgeted against.
* **Round up on cached tokens we cannot price.** Where a provider publishes no cached-input rate, we
  bill cached tokens at the FULL input rate. That overestimates. For a budget guard, overestimating
  is safe and underestimating is not.
* **Prices are data, not logic.** `_PRICES` is a flat table with a `checked` date so staleness is
  visible in review. Update the table; never special-case a model in the arithmetic.
"""
from __future__ import annotations

from typing import Optional

# ── Provider slugs ────────────────────────────────────────────────────────────────────────────────
# `ops.is_llm_provider(p)` (migration 090) accepts exactly: gemini | openai | anthropic | local | other.
# Our code uses richer internal names ("google_aistudio", "vertex_anthropic", "deterministic", …) which
# would VIOLATE that CHECK on insert and drop the row. Mapping here keeps the richer name for logs and
# the legal slug for the column. The full internal name is preserved in the ledger's `model` field.
_PROVIDER_SLUGS: dict[str, str] = {
    "google_aistudio": "gemini",
    "google_vertex": "gemini",      # Gemini *via* Vertex is still Gemini
    "vertex": "gemini",
    "vertex_gemini": "gemini",
    "gemini": "gemini",
    "vertex_anthropic": "anthropic",  # Claude via Vertex
    "anthropic": "anthropic",
    "openai": "openai",
    "deterministic": "local",         # the health-safety fallback: no model call, no cost
    "local": "local",
}


def provider_slug(provider: str) -> str:
    """Internal provider name → a value `ops.is_llm_provider()` accepts. Unknown → 'other'."""
    return _PROVIDER_SLUGS.get((provider or "").strip().lower(), "other")


# ── Price table ───────────────────────────────────────────────────────────────────────────────────
# USD per 1,000,000 tokens. `cached_in` is the discounted rate for tokens served from a prompt cache;
# None means "no published rate we trust" → billed at the full input rate (see DESIGN RULES).
#
# Gemini rates: Google list pricing, checked 2026-10-07.
# Claude rates: Anthropic first-party list pricing, checked 2026-10-07. NOTE — `claude-opus-4-8` is
#   reached through Vertex (`vertex_anthropic`), and Vertex is partner-operated with its own price
#   list. These first-party rates are therefore an APPROXIMATION for that path; reconcile against the
#   GCP bill before using them for anything contractual.
# gemini-2.5-pro is TIERED: the rates below are the ≤200k-context tier. Our advisor packets are
#   single-digit-thousands of tokens, so the >200k tier ($2.50/$15.00) is not reachable on this path.
# `cache_write_in` is the rate for tokens WRITTEN to a prompt cache. Anthropic charges a premium for
# cache creation (~1.25x input), so a cache-priming turn costs MORE than an uncached one — if that is
# billed at the plain input rate, Phase 1 looks cheaper than it is on the first turn of every
# conversation. None means "no separate write rate published" → billed at the input rate.
_PRICES: dict[str, dict[str, Optional[float]]] = {
    "gemini-2.5-flash-lite": {"in": 0.10, "out": 0.40, "cached_in": 0.01, "cache_write_in": None},
    "gemini-2.5-flash": {"in": 0.30, "out": 2.50, "cached_in": None, "cache_write_in": None},
    "gemini-2.5-pro": {"in": 1.25, "out": 10.00, "cached_in": 0.125, "cache_write_in": None},
    "claude-opus-4-8": {"in": 5.00, "out": 25.00, "cached_in": 0.50, "cache_write_in": 6.25},
}

_PRICES_CHECKED = "2026-10-07"


def _normalize_model(model: str) -> str:
    """Canonical model id. Delegates to the registry so there is exactly ONE normalizer — two
    functions stripping different decorations is how a lookup starts succeeding in the price table
    and failing everywhere else."""
    from . import model_registry as _reg  # local import: keeps this module's import graph flat
    return _reg.normalize_model_id(model)


def price_known(model: str) -> bool:
    """True when `model` has an entry in the price table."""
    return _normalize_model(model) in _PRICES


def cost_usd_micros(
    model: str,
    *,
    tokens_in: int = 0,
    tokens_out: int = 0,
    cached_tokens_in: int = 0,
    cache_write_tokens_in: int = 0,
) -> Optional[int]:
    """Cost in integer millionths of a USD, or None when `model` has no known price.

    The arithmetic is deliberately plain. Because a price is quoted per 1e6 tokens and a micro-dollar
    IS one millionth of a dollar, the two factors of 1e6 cancel exactly:

        cost_usd    = tokens * usd_per_1m / 1e6
        cost_micros = cost_usd * 1e6      = tokens * usd_per_1m

    so "tokens times the quoted price" is already the answer in micros. No scaling constant, nothing
    to get wrong by a factor of a thousand.

    `cached_tokens_in` and `cache_write_tokens_in` must both be SUBSETS of `tokens_in` (cache reads
    and cache writes respectively); each is priced at its own rate and whatever remains at the full
    input rate. Values are clamped so an over-reporting provider can never produce a negative
    uncached count — which would subtract money from the bill.

    `tokens_out` must already include any reasoning/thinking tokens: providers bill those at the
    output rate, and Gemini reports them OUTSIDE `candidatesTokenCount` (see clients/gemini.py).
    """
    p = _PRICES.get(_normalize_model(model))
    if p is None:
        return None

    ti = max(0, int(tokens_in or 0))
    to = max(0, int(tokens_out or 0))
    # Clamp each subset, then the pair, so read+write can never exceed the prompt total.
    tc = min(max(0, int(cached_tokens_in or 0)), ti)
    tw = min(max(0, int(cache_write_tokens_in or 0)), ti - tc)
    uncached = ti - tc - tw

    in_rate = float(p["in"] or 0.0)
    out_rate = float(p["out"] or 0.0)
    # No trusted cached rate → bill cached tokens at the full input rate (overestimate, never under).
    cached_rate = in_rate if p.get("cached_in") is None else float(p["cached_in"] or 0.0)
    # No published write premium → at least the input rate, never free.
    write_rate = in_rate if p.get("cache_write_in") is None else float(p["cache_write_in"] or 0.0)

    total = (uncached * in_rate) + (tc * cached_rate) + (tw * write_rate) + (to * out_rate)
    return int(round(total))


class TurnUsage:
    """Accumulates every provider call made while serving ONE request.

    WHY THIS IS A CLASS AND NOT A RUNNING TOTAL
    -------------------------------------------
    An advisor turn can call the provider up to four times — initial, retry, model-fallback, repair
    (`advisor_orchestrator`). Each call assigned the LLM wrapper's `self.last_usage`, so the turn's
    recorded tokens were whatever the *final* call happened to use. A turn that retried once and
    repaired once billed three generations and reported one. Summing into a single counter would fix
    the total but lose per-call attribution, and a model-fallback turn spans TWO models at two
    different prices, so one counter cannot price it correctly either.

    Keeping the individual calls solves both: totals are a sum, and cost is priced per call at that
    call's own model rate.
    """

    __slots__ = ("calls",)

    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

    def record(
        self,
        *,
        model: str,
        provider: str,
        usage: Optional[dict[str, int]],
        operation_kind: str,
        call_reason: str = "initial",
        latency_ms: Optional[int] = None,
    ) -> None:
        """Record one provider call. A call that returned no usage block still counts as a call.

        Recording it with zero tokens is deliberate: a failed or empty generation was still a
        round-trip, and `provider_calls` is how an expensive turn's cause stays visible. Dropping it
        would make retries invisible again, which is the bug this class exists to fix.
        """
        u = usage or {}
        tokens_in = max(0, int(u.get("prompt_tokens") or 0))
        # `completion_tokens` already includes reasoning tokens (the clients fold them in) because
        # providers bill them at the output rate. `thoughts_tokens` is carried for visibility only —
        # pricing it again here would double-charge it.
        tokens_out = max(0, int(u.get("completion_tokens") or 0))
        thoughts = min(max(0, int(u.get("thoughts_tokens") or 0)), tokens_out)
        cached_in = min(max(0, int(u.get("cached_prompt_tokens") or 0)), tokens_in)
        cache_write_in = min(max(0, int(u.get("cache_write_prompt_tokens") or 0)), tokens_in - cached_in)
        micros = cost_usd_micros(model, tokens_in=tokens_in, tokens_out=tokens_out,
                                 cached_tokens_in=cached_in, cache_write_tokens_in=cache_write_in)
        self.calls.append({
            "model": model or "",
            # The INTERNAL provider name (google_aistudio / vertex_anthropic / …). This column has no
            # CHECK constraint, so collapsing it to a 5-value slug would discard the distinction
            # between e.g. AI Studio and Vertex in the one indexed field that could answer "which
            # auth path served this?". Use provider_slug() only where a CHECK demands it.
            "provider": provider or "",
            "operation_kind": operation_kind,
            "call_reason": call_reason,
            "call_index": len(self.calls),
            "tokens_in": tokens_in,
            "tokens_out": tokens_out,
            "tokens_cached_in": cached_in,
            "tokens_cache_write_in": cache_write_in,
            "tokens_thoughts": thoughts,
            # An unpriced model stores 0 with cost_known=False — "unknown", never "free".
            "cost_usd_micros": int(micros or 0),
            "cost_known": micros is not None,
            "latency_ms": int(latency_ms) if latency_ms is not None else None,
        })

    def __len__(self) -> int:
        return len(self.calls)

    @property
    def totals(self) -> dict[str, int]:
        """Summed tokens across every call this turn — what advisor_turns should have recorded."""
        return {
            "prompt_tokens": sum(int(c["tokens_in"]) for c in self.calls),
            "completion_tokens": sum(int(c["tokens_out"]) for c in self.calls),
            "total_tokens": sum(int(c["tokens_in"]) + int(c["tokens_out"]) for c in self.calls),
            "cached_prompt_tokens": sum(int(c["tokens_cached_in"]) for c in self.calls),
            "thoughts_tokens": sum(int(c["tokens_thoughts"]) for c in self.calls),
        }

    @property
    def cost_usd_micros_total(self) -> int:
        """Summed cost. A FLOOR when `cost_fully_known` is False — see that property."""
        return sum(int(c["cost_usd_micros"]) for c in self.calls)

    @property
    def cost_fully_known(self) -> bool:
        """False when any call used a model absent from the price table, so the total understates."""
        return all(bool(c["cost_known"]) for c in self.calls) if self.calls else True

    def ledger_rows(
        self, *, user_id: Optional[str] = None, turn_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
    ) -> list[dict[str, object]]:
        """Rows for `analytics.llm_call_usage` — one per provider call.

        `provider` keeps the INTERNAL name: this table has no `is_llm_provider` CHECK, so there is
        nothing to satisfy by collapsing it, and the slug would erase which auth path served the
        call. `provider_slug` is carried in metadata so a rollup that needs the coarse grouping has
        it without re-deriving it.
        """
        out: list[dict[str, object]] = []
        for c in self.calls:
            row = dict(c)
            row["metadata"] = {"provider_slug": provider_slug(str(c["provider"]))}
            if user_id:
                row["user_id"] = str(user_id)
            if turn_id:
                row["turn_id"] = str(turn_id)
            if conversation_id:
                row["conversation_id"] = str(conversation_id)
            out.append(row)
        return out


def describe_pricing() -> dict[str, object]:
    """The price table and the date it was last checked — for an admin/diagnostic endpoint.

    Exposed so "which prices is the ledger using?" is answerable at runtime instead of by reading
    this file, which is how a stale table goes unnoticed.
    """
    return {"checked": _PRICES_CHECKED, "models": {k: dict(v) for k, v in _PRICES.items()}}
