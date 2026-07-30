#!/usr/bin/env python3
"""Relationship catalog coverage — joins the declared catalog against live graph contents.

Answers the question the manifest alone cannot: of everything executable code CAN emit, what is
declared, what is traversable in which context, and what actually exists in data.

Support is a property of the CODE (the catalog), never of the data. A relationship with no rows yet is
still supported; a relationship in the graph with no catalog row is a defect. This script reports both
directions and exits non-zero on the second, so it doubles as a CI gate against live drift.

Usage:
    python scripts/graphrag/relationship_coverage.py \
        --manifest apps/lifenavigator-core-api/app/grounding/semantic/ontology_manifest.json \
        --live artifacts/graphrag-reconciliation/live_graph_snapshot.json \
        --out artifacts/graphrag-reconciliation/relationship_coverage.json
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

# Classification of declared relationships that the manifest does not carry directly. The Rust catalog
# is authoritative for policy; these sets mirror its classification for reporting only.
PROVIDER_B2B = {
    "HAS_PROVIDER_PROFILE", "HAS_PROVIDER_ENGAGEMENT", "HAS_CONSENT_SCOPE",
    "RECOMMENDED_BY_PROVIDER", "PROVIDER_OUTCOME", "AUTHORED_KNOWLEDGE", "ANALYZED_BY_PROVIDER",
    "HAS_ARCANA_PROFILE", "HAS_ARCANA_ASSESSMENT", "HAS_ARCANA_GOAL", "HAS_ARCANA_CONSTRAINT",
    "HAS_ARCANA_CAPABILITY", "HAS_ARCANA_MOTIVATION", "HAS_ARCANA_READINESS", "HAS_ARCANA_MEMBERSHIP",
    "HAS_ARCANA_INSURANCE_DOCUMENT", "GENERATED_ARCANA_LEAD", "GRANTED_LEAD_CONSENT",
    "HAS_CONCIERGE_PREFERENCE",
}
SENSITIVE = {
    "HAS_HEALTH_METRIC", "HAS_LAB_RESULT", "HAS_BIOMETRIC_OBSERVATION", "HAS_INJURY",
    "OBSERVED_HEALTH_ALERT", "HAS_HEALTH_GOAL", "HAS_WELLNESS", "TRACKS_METRIC",
    "HAS_SUPPLEMENT_PROTOCOL", "HAS_TRAINING_PROTOCOL", "HAS_HEALTH_MILESTONE", "HAS_WEARABLE_METRIC",
    "HAS_WEARABLE_CONNECTION", "HAS_INSURANCE_PROFILE", "HAS_INSURANCE_PLAN", "HAS_INSURANCE_DOCUMENT",
    "HAS_INSURANCE_FACT", "HAS_ESTATE_PLAN", "HAS_ESTATE_PROFILE", "HAS_BENEFICIARY",
    "HAS_GUARDIANSHIP_PLAN", "HAS_DEPENDENT", "COVERS_DEPENDENT", "HAS_SPOUSE", "LOGGED",
}


def build(manifest_path: Path, live_path: Path) -> dict:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    rows = manifest["relationships"]
    declared = {r["rel_type"]: r for r in rows}

    live_doc = json.loads(live_path.read_text(encoding="utf-8"))
    live_counts: dict[str, int] = live_doc["live_relationship_counts"]
    live = set(live_counts)

    traversable_personal = {r for r, v in declared.items() if v.get("traversable") is True}
    lifecycle = Counter(v.get("lifecycle", "undeclared") for v in declared.values())

    # A live relationship with no catalog row is the defect this whole phase exists to prevent.
    live_undeclared = sorted(live - set(declared))
    # Declared, has a writer, but no data in this corpus yet. NOT a defect.
    implemented_absent = sorted(
        r for r, v in declared.items()
        if v.get("lifecycle") == "implemented" and r not in live
    )
    planned = sorted(r for r, v in declared.items() if v.get("lifecycle") == "planned")

    non_traversable = sorted(set(declared) - traversable_personal)
    reasons: dict[str, str] = {}
    for rel in non_traversable:
        if rel in PROVIDER_B2B:
            reasons[rel] = "provider_or_b2b_requires_separate_authorization_design"
        elif rel == "RELATED_TO":
            reasons[rel] = "compatibility_fallback_carries_no_semantics"
        else:
            reasons[rel] = "operational_or_provenance_not_advisor_facing"

    return {
        "_generated_by": "scripts/graphrag/relationship_coverage.py",
        "manifest_version": manifest.get("version"),
        "graph_totals": live_doc.get("totals", {}),
        "counts": {
            "emittable_by_executable_code": len(declared) - len(planned),
            "manifest_declared": len(declared),
            "live_relationship_types": len(live),
            "traversable_personal_advisor": len(traversable_personal),
            "non_traversable": len(non_traversable),
            "implemented_but_absent_from_data": len(implemented_absent),
            "planned": len(planned),
            "deprecated": lifecycle.get("deprecated", 0),
            "provider_b2b": len(PROVIDER_B2B & set(declared)),
            "sensitive": len(SENSITIVE & set(declared)),
            "live_but_undeclared": len(live_undeclared),
        },
        "traversable_by_context": {
            # Only the personal-advisor context has a planner today. The other contexts are declared in
            # the catalog but have no retrieval implementation, so their counts are reported as null
            # rather than zero — "not built" is not the same as "nothing permitted".
            "personal_advisor": len(traversable_personal),
            "provider_advisor": None,
            "organization_administrator": None,
            "internal_audit": None,
            "central_knowledge": None,
        },
        "non_traversable_by_reason": dict(Counter(reasons.values())),
        "lifecycle": dict(lifecycle),
        "live_but_undeclared": live_undeclared,
        "implemented_but_absent_from_data": implemented_absent,
        "planned_relationships": planned,
        "live_relationship_counts": dict(
            sorted(live_counts.items(), key=lambda kv: -kv[1])
        ),
        "unresolved_policy_decisions": [
            {
                "id": "provider-context-retrieval",
                "question": (
                    "Provider/Arcana B2B edges are declared but traversable in no implemented context. "
                    "A provider-advisor retrieval path needs its own authorization, tenancy and "
                    "query-context design before these become reachable."
                ),
                "status": "open",
                "blocking_personal_advisor_enablement": False,
            }
        ],
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", type=Path, required=True)
    ap.add_argument("--live", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()

    report = build(args.manifest, args.live)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    c = report["counts"]
    print(f"wrote {args.out}")
    print(
        f"  declared={c['manifest_declared']} live={c['live_relationship_types']} "
        f"traversable(personal)={c['traversable_personal_advisor']} "
        f"implemented-absent={c['implemented_but_absent_from_data']} planned={c['planned']}"
    )
    if report["live_but_undeclared"]:
        print(
            "FAIL: live relationships absent from the catalog: "
            f"{report['live_but_undeclared']}",
            file=sys.stderr,
        )
        return 1
    print("  OK: every live relationship type is declared")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
