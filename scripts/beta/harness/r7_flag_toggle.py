#!/usr/bin/env python3
"""R-7 — exercise one NON-DESTRUCTIVE feature disable and re-enable.

Proves the containment lever in rollback-plan.md §1 actually works, before an incident requires it.

HARD CONSTRAINT: GRAPH_GROUNDING_ENABLED is NOT the flag under test and must remain false
throughout. Toggling it would change what reaches the model on every advisor turn — the exact thing
non-negotiable rule 4 forbids.

Flag under test: a per-user override in ops.user_feature_flag_overrides scoped to synthetic user A.
Chosen because its blast radius is exactly one synthetic account.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _safe import emit, require_env  # noqa: E402

GATE = "r7-flag-toggle"

FORBIDDEN_FLAGS = {"GRAPH_GROUNDING_ENABLED"}
FLAG_UNDER_TEST = "advisor_response_reporting"   # per-user override, synthetic A only

STEPS = [
    "record baseline: flag state + a working request as synthetic A",
    "disable the flag for synthetic A ONLY (ops.user_feature_flag_overrides)",
    "observe: the feature is unavailable to A, and the app degrades gracefully (no 500)",
    "observe: synthetic B is UNAFFECTED — the override is genuinely per-user",
    "re-enable the flag for synthetic A",
    "observe: the feature returns; no restart or deploy was required",
    "assert GRAPH_GROUNDING_ENABLED is still false",
]


def main() -> int:
    if FLAG_UNDER_TEST in FORBIDDEN_FLAGS:
        raise SystemExit("ABORT: refusing to toggle a forbidden flag")
    require_env("API_BASE_URL", "BETA_SYNTHETIC_A_EMAIL", "BETA_SYNTHETIC_A_PASSWORD",
                "BETA_SYNTHETIC_B_EMAIL", "BETA_SYNTHETIC_B_PASSWORD")

    emit(GATE, "result", {
        "gate": "R-7 feature disable / re-enable",
        "status": "NOT_RUN — harness prepared by Prompt 0, never executed",
        "flag_under_test": FLAG_UNDER_TEST,
        "forbidden_flags": sorted(FORBIDDEN_FLAGS),
        "scope": "per-user override, synthetic A only — blast radius one account",
        "steps": STEPS,
        "verdict": "UNMEASURED",
        "note": "Also the first rehearsal of rollback-plan.md §1. The deploy-level rollback lever "
                "(§2/§3) remains unrehearsed and cannot be rehearsed without a staging target.",
    })
    print("R-7 harness prepared.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
