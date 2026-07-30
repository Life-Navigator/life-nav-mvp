"""Domain vocabulary contract — the Python half of the cross-tier agreement.

The Rust worker owns the vocabulary because it owns the writes; these tests prove core-api agrees with
the generated contract and that the compatibility alias actually functions at the boundary where it is
needed.

THE DEFECT
----------
The worker writes `domain: "financial"`. The planner emitted `"finance"`. Against the live Qdrant
collection, same tenant, same vector: `domain=finance` -> 0 hits, `domain=financial` -> 5 hits,
unfiltered -> 5 hits. 1,583 of 2,218 points (71%) were unreachable, and the trace reported
`vector_seeds: 0` — indistinguishable from "this user has no data".
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.grounding.semantic.domains import (
    CANONICAL_DOMAINS,
    DOMAIN_ALIASES,
    alias_usage,
    normalize_domain,
)
from app.grounding.semantic.planner import _DOMAIN_TERMS, plan_query

_MANIFEST = (
    Path(__file__).resolve().parents[1]
    / "app" / "grounding" / "semantic" / "domain_manifest.json"
)

# The eight domain values observed in the live graph and vector store (2026-07-30).
LIVE_DOMAINS = {
    "financial", "career", "general", "health", "education", "documents", "family", "decision",
}


def test_manifest_is_the_shared_source_of_truth() -> None:
    """Python loads the generated contract rather than restating it."""
    data = json.loads(_MANIFEST.read_text(encoding="utf-8"))
    assert set(data["canonical"]) == set(CANONICAL_DOMAINS)
    assert {k: v for k, v in data["aliases"].items()} == dict(DOMAIN_ALIASES)


def test_every_live_domain_value_is_canonical() -> None:
    """Whatever is actually stored must be filterable. Otherwise retrieval silently returns nothing."""
    missing = sorted(LIVE_DOMAINS - set(CANONICAL_DOMAINS))
    assert not missing, f"live domain values are not declared canonical: {missing}"


# ── POSITIVE CONTROL ────────────────────────────────────────────────────────────────────────────

def test_finance_alias_resolves_to_stored_spelling() -> None:
    """A request using `finance` must reach records stored as `financial`."""
    assert normalize_domain("finance") == "financial"
    assert normalize_domain("Finance") == "financial"
    assert normalize_domain("  FINANCE  ") == "financial"


def test_advisor_router_vocabulary_survives_the_boundary() -> None:
    """The real integration path, not a hypothetical one.

    `advisor_agents.ALL_LIFE_DOMAINS` is `("finance", "career", …)` and `AdvisorContextBuilder` passes
    `turn_domains[0]` straight into `SemanticGraphRAG.retrieve(domain=...)`. So the advisor's own routing
    layer emits the legacy spelling into the retrieval boundary on every finance turn. The alias is
    required for correctness today, not merely defensive.
    """
    from app.services.advisor_agents import ALL_LIFE_DOMAINS

    for d in ALL_LIFE_DOMAINS:
        assert normalize_domain(d) is not None, (
            f"advisor router emits domain {d!r} which does not normalize — it would become a filter "
            f"that matches nothing"
        )
    assert normalize_domain("finance") == "financial"


def test_planner_produces_canonical_domains() -> None:
    """Plans must carry values that exist in the store."""
    assert "financial" in _DOMAIN_TERMS
    assert "finance" not in _DOMAIN_TERMS, "planner lexicon regressed to the non-canonical key"

    plan = plan_query("how much did I save toward retirement this year?")
    assert plan.domains, "no domain detected for an unambiguous finance question"
    for d in plan.domains:
        assert d in CANONICAL_DOMAINS, f"plan carries non-canonical domain {d!r}"


def test_domain_hint_is_normalized_into_the_plan() -> None:
    """An API caller passing the legacy spelling gets a canonical plan."""
    plan = plan_query("what should I do?", domain_hint="finance")
    assert "financial" in plan.domains
    assert "finance" not in plan.domains


# ── NEGATIVE CONTROL ────────────────────────────────────────────────────────────────────────────

def test_removing_the_alias_reproduces_the_zero_hit_defect(monkeypatch: pytest.MonkeyPatch) -> None:
    """With the alias disabled, the advisor's `finance` hint yields no usable filter.

    This is the defect reproduction. `normalize_domain` returning None means the caller drops the
    filter — which is the *safe* degradation. The unsafe original behaviour was passing `"finance"`
    through verbatim to Qdrant, producing a filter that matched zero of 1,583 financial points while
    reporting success.
    """
    import app.grounding.semantic.domains as dom

    monkeypatch.setattr(dom, "DOMAIN_ALIASES", {}, raising=True)
    assert dom.normalize_domain("finance") is None, (
        "alias removal did not reproduce the defect — the test is not exercising the alias"
    )
    # And the canonical spelling still works, proving only the alias was disabled.
    assert dom.normalize_domain("financial") == "financial"


def test_unknown_domain_is_dropped_not_passed_through() -> None:
    """The core safety property: never emit a filter no writer can satisfy."""
    assert normalize_domain("cryptocurrency") is None
    assert normalize_domain("") is None
    assert normalize_domain(None) is None


def test_alias_usage_is_observable() -> None:
    """Alias traffic must be measurable — it is the removal criterion for the compatibility layer."""
    before = alias_usage().get("finance", 0)
    normalize_domain("finance")
    assert alias_usage().get("finance", 0) == before + 1


def test_new_writes_cannot_emit_the_alias() -> None:
    """`finance` is an accepted INPUT, never a canonical output."""
    assert "finance" not in CANONICAL_DOMAINS
    for alias in DOMAIN_ALIASES:
        assert normalize_domain(alias) != alias, f"{alias} normalized to itself"
