"""Phase 1 — prompt caching: lock the stable-prefix invariant.

WHAT THIS PHASE TURNED OUT TO BE
--------------------------------
The Phase 1 premise was that `_system_for(context)` "is a function of context, therefore implicit
caching cannot engage". That was WRONG, and measuring it is what showed why: the context-dependence
is a SUFFIX (`domain_playbook_block`), and prefix caching is indifferent to what follows the prefix.
The common prefix across every domain variant is exactly `ADVISOR_SYSTEM` — ~20.6k chars, ~5.2k
tokens — which already clears the implicit-cache minimum (1,024 tokens on 2.5-flash, 2,048 on
2.5-pro) by about 2.5x. The structure was already correct and implicit caching was already eligible.

So there is no prompt restructuring to do. What was missing is a GUARANTEE: nothing stops a future
edit from interpolating a timestamp into the system prompt, prepending the per-turn playbook, or
trimming the prompt below the cache threshold — each of which silently deletes a 75-90% discount
with no test failing and no error anywhere. These tests make that regression loud.

WHY NOT EXPLICIT CACHING (`cachedContent`)
------------------------------------------
It is not applicable, for two independent reasons:
  * Explicit caching requires a minimum of 32,768 tokens. The stable prefix is ~5.2k — it does not
    qualify and cannot be made to without padding the prompt, which would cost more than it saves.
  * Explicit caching bills hourly storage (~$1/M tokens/hour) whether or not anything hits it, while
    implicit caching has NO storage cost and discounts only on hits. At beta traffic a per-hour
    charge is the wrong shape of cost entirely.
Implicit caching is therefore the whole strategy, and keeping the prefix stable is the whole job.
"""
import os
import re

import pytest

from app.services.advisor_llm import (ADVISOR_SYSTEM, _claude_system_blocks, _system_for,
                                      domain_playbook_block)


class _Ctx:
    """Minimal stand-in for AdvisorContext — _system_for only reads `turn_domains`."""

    def __init__(self, domains):
        self.turn_domains = domains


# Every routing outcome the advisor can produce: no match, explicit finance/general (empty playbook),
# each single domain, and a multi-domain turn.
DOMAIN_VARIANTS = [
    None, [], ["finance"], ["health"], ["career"], ["education"], ["family"],
    ["health", "career"], ["career", "health"], ["education", "family", "health"],
    ["not_a_real_domain"],
]

# Minimum cacheable prefix is 2,048 tokens on gemini-2.5-pro (the default generation model) and
# 1,024 on 2.5-flash. Asserted in CHARACTERS against a deliberately PESSIMISTIC 6 chars/token, so
# the guard holds even if the real tokenizer is far less efficient on this text than typical prose.
_PESSIMISTIC_CHARS_PER_TOKEN = 6
_MIN_CACHEABLE_TOKENS = 2048
_MIN_PREFIX_CHARS = _MIN_CACHEABLE_TOKENS * _PESSIMISTIC_CHARS_PER_TOKEN  # 12,288


@pytest.mark.parametrize("domains", DOMAIN_VARIANTS)
def test_system_prompt_always_starts_with_the_stable_block(domains):
    """The cacheable prefix must be at the FRONT. Prepending anything per-turn — even one line —
    moves the shared prefix to zero and forfeits the discount on every request."""
    assert _system_for(_Ctx(domains)).startswith(ADVISOR_SYSTEM)


def test_the_common_prefix_across_all_variants_is_exactly_the_stable_block():
    """The strongest form of the invariant: whatever varies, it varies strictly AFTER the stable
    block, so two turns on different domains still share the full ~5.2k-token prefix."""
    prompts = [_system_for(_Ctx(d)) for d in DOMAIN_VARIANTS]
    assert os.path.commonprefix(prompts) == ADVISOR_SYSTEM


@pytest.mark.parametrize("domains", DOMAIN_VARIANTS)
def test_the_volatile_part_is_only_ever_appended(domains):
    """`_system_for` must be exactly stable + suffix. If it ever interleaves (e.g. injects routed
    domains into the middle of the core prompt) the prefix is truncated at the injection point."""
    prompt = _system_for(_Ctx(domains))
    assert prompt == ADVISOR_SYSTEM + prompt[len(ADVISOR_SYSTEM):]
    assert prompt[len(ADVISOR_SYSTEM):] == domain_playbook_block(domains)


def test_stable_prefix_clears_the_implicit_cache_minimum_with_margin():
    """A cost regression with no error: trimming the system prompt below the minimum cacheable
    prefix silently ends all caching. Nothing else in the codebase would notice."""
    assert len(ADVISOR_SYSTEM) >= _MIN_PREFIX_CHARS, (
        f"stable prefix is {len(ADVISOR_SYSTEM)} chars; below ~{_MIN_PREFIX_CHARS} it risks falling "
        f"under the {_MIN_CACHEABLE_TOKENS}-token implicit-cache minimum and caching stops entirely"
    )


def test_stable_prefix_contains_no_per_request_invalidator():
    """The classic silent cache killer: a timestamp, a uuid, or a request id inside the cached block
    makes every request a unique prefix, so the hit rate is zero and the cause is invisible.

    This checks the BUILT string, not the source, because the prompt is assembled at import time
    (`ADVISOR_SYSTEM.replace("{SOURCE_KEYS}", ...)`) — a value interpolated there would not show up
    in a source grep for `datetime`.
    """
    suspicious = {
        "iso timestamp": r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}",
        "date": r"\b\d{4}-\d{2}-\d{2}\b",
        "uuid": r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
        "clock time": r"\b\d{1,2}:\d{2}:\d{2}\b",
        "unfilled placeholder": r"\{[A-Z_]{3,}\}",
    }
    for label, pattern in suspicious.items():
        found = re.search(pattern, ADVISOR_SYSTEM, re.IGNORECASE)
        assert not found, f"{label} in the cached prefix ({found.group(0)!r}) — every request would miss"


def test_system_prompt_is_byte_identical_across_repeated_builds():
    """Determinism across calls. A set iteration or an unsorted dict render would produce the same
    CONTENT in a different ORDER — different bytes, therefore a different cache key, therefore a
    permanent miss that looks like nothing is wrong."""
    ctx = _Ctx(["health", "career"])
    first = _system_for(ctx)
    for _ in range(25):
        assert _system_for(ctx) == first


def test_playbook_order_follows_the_routed_domain_order():
    """Two turns routed to the same domains in the same order must produce identical bytes; the block
    is built from the caller's list, so this is the property that keeps it stable."""
    assert domain_playbook_block(["health", "career"]) == domain_playbook_block(["health", "career"])
    # Order is meaningful and preserved (not sorted/set-ified), so this pair genuinely differs.
    assert domain_playbook_block(["health", "career"]) != domain_playbook_block(["career", "health"])


def test_unknown_and_empty_domains_add_nothing():
    """A broad/ambiguous route must not append an empty header — that would be a second distinct
    prefix variant for no benefit."""
    assert domain_playbook_block(None) == ""
    assert domain_playbook_block([]) == ""
    assert domain_playbook_block(["not_a_real_domain"]) == ""
    assert _system_for(_Ctx(["not_a_real_domain"])) == ADVISOR_SYSTEM


def test_explicit_caching_is_not_applicable_at_this_prompt_size():
    """Documents the Phase 1 decision as an executable fact rather than a comment.

    `cachedContent` requires >= 32,768 tokens. Even at an optimistic 3 chars/token the stable prefix
    is nowhere near it, so if someone later proposes explicit caching, this test is the reason not
    to — and it will start failing (prompting a re-decision) only if the prompt grows ~5x.
    """
    optimistic_tokens = len(ADVISOR_SYSTEM) / 3
    assert optimistic_tokens < 32_768, (
        "the stable prefix now approaches the explicit-cache minimum — re-evaluate cachedContent, "
        "weighing its hourly storage charge against implicit caching's zero storage cost"
    )


# ── Cache observability: measurable in prod without waiting on the migration ──────────────────────
@pytest.mark.asyncio
async def test_turn_log_line_carries_the_caching_and_cost_fields(caplog):
    """The durable ledger is flag-gated behind an unapplied migration, so the structured
    `advisor_turn` log line is the only place caching is observable in production today. If these
    fields are dropped, "is implicit caching engaging?" becomes unanswerable until the migration
    lands — and a zero cache-hit rate is invisible rather than obvious."""
    import json
    import logging
    from tests.test_llm_usage_accounting import (
        AdvisorContextBuilder, AdvisorOrchestrator, FakeCoverage, FakeRM, FakeSupabase,
        _SequenceLLM, _base, _ctx, _good_llm,
    )

    llm = _SequenceLLM(
        [_good_llm()],
        [{"prompt_tokens": 5200, "completion_tokens": 400, "total_tokens": 5600,
          "cached_prompt_tokens": 5165, "thoughts_tokens": 150}],
    )
    orch = AdvisorOrchestrator(
        FakeRM(_base()), AdvisorContextBuilder(FakeSupabase(), coverage=FakeCoverage()), llm,
    )
    with caplog.at_level(logging.INFO, logger="core.advisor"):
        await orch.converse(_ctx(), "what should I do")

    lines = [json.loads(r.message) for r in caplog.records
             if r.message.startswith("{") and '"advisor_turn"' in r.message]
    assert lines, "no structured advisor_turn log line emitted"
    entry = lines[-1]
    assert entry["prompt_tokens"] == 5200
    assert entry["cached_prompt_tokens"] == 5165   # the Phase 1 scoreboard
    assert entry["thoughts_tokens"] == 150
    assert entry["provider_calls"] == 1
    assert entry["cost_usd_micros"] > 0
    assert entry["cost_known"] is True


# ── Where the Anthropic cache breakpoint goes ─────────────────────────────────────────────────────
# Gemini caches implicitly and finds the common prefix on its own, so the tests above were enough
# for that path. Anthropic matches an EXPLICIT breakpoint by exact bytes, which means the block
# LAYOUT — not just the prompt ordering — decides whether the discount lands.

DOMAIN_CASES = [None, ("financial",), ("family",), ("career",), ("health",), ("education",)]
PLAYBOOK_DOMAINS = [("career",), ("health",), ("education",)]
NO_PLAYBOOK_DOMAINS = [None, ("financial",), ("family",)]


@pytest.fixture
def cache_on(monkeypatch):
    monkeypatch.setenv("CLAUDE_PROMPT_CACHE", "true")


def test_caching_off_returns_a_plain_string(monkeypatch):
    monkeypatch.delenv("CLAUDE_PROMPT_CACHE", raising=False)
    assert isinstance(_claude_system_blocks(_system_for(_Ctx(("career",)))), str)


@pytest.mark.parametrize("domains", DOMAIN_CASES)
def test_the_cached_block_is_byte_identical_in_every_domain(cache_on, domains):
    """THE POINT. One shared cache entry, not one per routed domain.

    A single block over `ADVISOR_SYSTEM + playbook` produced four distinct entries, each paying a
    1.25x cache WRITE on its first turn. Ephemeral entries expire in minutes, so a low-traffic
    domain paid the write repeatedly and collected the read almost never — worse than no caching.
    """
    blocks = _claude_system_blocks(_system_for(_Ctx(domains)))
    cached = [b for b in blocks if "cache_control" in b]
    assert len(cached) == 1, "exactly one breakpoint"
    assert cached[0]["text"] == ADVISOR_SYSTEM


def test_every_domain_shares_one_cache_entry(cache_on):
    prefixes = {_claude_system_blocks(_system_for(_Ctx(d)))[0]["text"] for d in DOMAIN_CASES}
    assert len(prefixes) == 1


@pytest.mark.parametrize("domains", PLAYBOOK_DOMAINS)
def test_the_volatile_playbook_is_a_separate_unmarked_block(cache_on, domains):
    """Separate so it cannot invalidate the prefix; unmarked because at ~250 tokens it is below the
    minimum cacheable size, so a breakpoint there could not be honoured anyway."""
    blocks = _claude_system_blocks(_system_for(_Ctx(domains)))
    assert len(blocks) == 2
    assert "cache_control" not in blocks[1]
    assert blocks[1]["text"] == domain_playbook_block(domains)
    assert blocks[1]["text"]


@pytest.mark.parametrize("domains", NO_PLAYBOOK_DOMAINS)
def test_domains_with_no_playbook_send_a_single_block(cache_on, domains):
    blocks = _claude_system_blocks(_system_for(_Ctx(domains)))
    assert len(blocks) == 1 and blocks[0]["text"] == ADVISOR_SYSTEM


@pytest.mark.parametrize("domains", DOMAIN_CASES)
def test_the_blocks_reassemble_into_exactly_the_original_system_text(cache_on, domains):
    """The split must be lossless — a dropped or reordered block changes the advisor's instructions,
    which is a far worse outcome than a cache miss."""
    system_text = _system_for(_Ctx(domains))
    blocks = _claude_system_blocks(system_text)
    assert "".join(b["text"] for b in blocks) == system_text


def test_cached_block_still_clears_the_minimum_cacheable_size(cache_on):
    """Splitting must not drop the cached unit below the threshold, or the breakpoint is ignored and
    every turn silently pays full input price."""
    cached = _claude_system_blocks(_system_for(_Ctx(("health",))))[0]["text"]
    assert len(cached) // 4 > 2048, "cached prefix must clear the 2,048-token minimum"
