"""Traversal-policy gates on the Python side of the ontology contract.

The Rust catalog decides policy; these tests prove the planner *honours* it. That split matters: the
generated manifest previously carried no policy at all, and `allowed_edge_types` selected purely by
edge family. Families are semantic, not authorizational — provider/B2B edges are classified `identity`,
`evidence` and `progress` exactly like personal facts — so a family-only allowlist admitted them into
personal retrieval. These tests fail if that regresses.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.grounding.semantic.planner import (
    EDGE_FAMILY,
    PERSONAL_ADVISOR_TRAVERSABLE,
    allowed_edge_types,
    plan_query,
)

_MANIFEST = (
    Path(__file__).resolve().parents[1]
    / "app"
    / "grounding"
    / "semantic"
    / "ontology_manifest.json"
)

# Provider / Arcana B2B edges. These describe the service relationship AROUND a user rather than facts
# INSIDE their life model. Enabling them for the personal advisor requires a separate authorization,
# tenancy and query-context design — never a widened allowlist.
PROVIDER_B2B = {
    "ANALYZED_BY_PROVIDER",
    "AUTHORED_KNOWLEDGE",
    "HAS_ARCANA_MEMBERSHIP",
    "RECOMMENDED_BY_PROVIDER",
    "HAS_PROVIDER_PROFILE",
    "HAS_PROVIDER_ENGAGEMENT",
    "HAS_CONSENT_SCOPE",
    "PROVIDER_OUTCOME",
    "GRANTED_LEAD_CONSENT",
    "GENERATED_ARCANA_LEAD",
}


@pytest.fixture(scope="module")
def rows() -> list[dict]:
    return json.loads(_MANIFEST.read_text(encoding="utf-8"))["relationships"]


def test_manifest_declares_policy_for_every_relationship(rows: list[dict]) -> None:
    """Every row carries an explicit traversal decision and lifecycle. No implicit defaults."""
    missing = [r["rel_type"] for r in rows if "traversable" not in r or "lifecycle" not in r]
    assert not missing, (
        f"{len(missing)} manifest row(s) carry no explicit traversal/lifecycle decision: "
        f"{sorted(missing)[:10]}"
    )


def test_manifest_covers_the_legacy_emitter(rows: list[dict]) -> None:
    """Regression: the manifest once covered only the primary registry.

    `HAS_EDUCATION_RECORD` had 16 live edges in production while being absent from the manifest, and it
    was one of 86 such types emitted by the normalizer's legacy table.
    """
    declared = {r["rel_type"] for r in rows}
    assert "HAS_EDUCATION_RECORD" in declared
    # A sample of legacy-emitter types across domains; all must be catalogued.
    for rel in ("HAS_HEALTH_METRIC", "HAS_LAB_RESULT", "HAS_BENEFICIARY", "HAS_WHY_CHAIN"):
        assert rel in declared, f"{rel} is emittable but absent from the manifest"


def test_provider_b2b_edges_are_not_personal_advisor_traversable(rows: list[dict]) -> None:
    """NEGATIVE CONTROL for the policy: B2B edges must never be personal-advisor reachable."""
    declared = {r["rel_type"] for r in rows}
    for rel in PROVIDER_B2B & declared:
        assert rel not in PERSONAL_ADVISOR_TRAVERSABLE, (
            f"{rel} is a provider/B2B relationship but is personal-advisor traversable"
        )


def test_provider_edges_are_excluded_from_every_plan() -> None:
    """The end-to-end assertion: no query plan can produce a provider edge in its allowlist.

    This is stronger than checking the flag, because it exercises the family expansion that caused the
    defect — provider edges sit in ordinary families and would otherwise be pulled in by them.
    """
    probes = [
        "what's my net worth?",
        "should I pay off the loan or invest?",
        "why did you recommend that?",
        "how has my health changed this year?",
        "what happens if I retire at 60?",
        "tell me about my situation",
    ]
    for message in probes:
        allowed = set(allowed_edge_types(plan_query(message)))
        leaked = allowed & PROVIDER_B2B
        assert not leaked, f"plan for {message!r} admitted provider/B2B edges: {sorted(leaked)}"


def test_family_membership_alone_does_not_grant_traversal() -> None:
    """Proves the filter is doing work rather than being a no-op.

    At least one relationship must be in a traversable family yet excluded by policy. If this ever
    becomes false, the policy filter has silently stopped constraining anything.
    """
    in_a_family = {rel for rels in EDGE_FAMILY.values() for rel in rels}
    excluded = in_a_family - set(PERSONAL_ADVISOR_TRAVERSABLE)
    assert excluded, (
        "no relationship is family-eligible but policy-excluded — the traversal policy filter is a "
        "no-op, which is exactly the state that let provider edges into personal retrieval"
    )


def test_undeclared_relationship_is_never_traversable() -> None:
    """FAIL CLOSED: the planner infers no policy for an unknown edge label."""
    assert "ZZ_NOT_A_REAL_RELATIONSHIP" not in PERSONAL_ADVISOR_TRAVERSABLE
