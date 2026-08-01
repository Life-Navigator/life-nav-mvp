#!/usr/bin/env python3
"""R-2 — journey evidence capture for J1 → J3.

This harness RECORDS a journey. It does not substitute for one.

R-2's requirement is that a human completes signup → onboarding → first grounded answer unaided,
with no operator intervention. An automated script that drives the UI proves the script works; it
does not prove the product is usable. So this captures redacted evidence while a person drives.

Redaction is aggressive: screenshots go through a mask pass, and no request/response body is stored
verbatim — only the fields the gate needs.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _safe import emit, require_env, require_no_service_role  # noqa: E402

GATE = "r2-journey"

JOURNEY = [
    ("J1.1", "invite redeemed",                 "invite accepted, account created"),
    ("J1.2", "signup completed",                "authenticated session established"),
    ("J1.3", "onboarding completed",            "discovery captured; no dead end, no crash"),
    ("J2.1", "first source connected",          "a real data source attached"),
    ("J2.2", "ingestion visible + honest",      "status shown; failures actionable, not silent"),
    ("J3.1", "first advisor question asked",    "turn_id issued"),
    ("J3.2", "grounded answer received",        "answer cites the user's OWN data"),
    ("J3.3", "citation opened",                 "citation resolves; grants no new access"),
    ("J3.4", "response reportable",             "R-3 dialog reachable, bound to that turn_id"),
]

CAPTURE = ["step_id", "wall_clock_utc", "elapsed_s", "http_status", "turn_id",
           "operator_intervention_required", "blocker_description", "screenshot_masked_path"]

NEVER_CAPTURE = ["session cookies", "authorization headers", "passwords", "raw request bodies",
                 "raw response bodies", "personal data beyond the synthetic persona",
                 "llm_response_raw"]


def main() -> int:
    require_no_service_role("R-2 journey capture")
    require_env("WEB_BASE_URL", "BETA_SYNTHETIC_A_EMAIL", "BETA_SYNTHETIC_A_PASSWORD")

    emit(GATE, "result", {
        "gate": "R-2 primary journey J1→J3",
        "status": "NOT_RUN — harness prepared by Prompt 0, never executed",
        "steps": [{"id": i, "name": n, "success_criterion": c} for i, n, c in JOURNEY],
        "fields_captured": CAPTURE,
        "never_captured": NEVER_CAPTURE,
        "key_metric": "time_to_first_grounded_answer_s (beta target < 900s)",
        "pass_condition": "all 9 steps complete with operator_intervention_required = false",
        "verdict": "UNMEASURED",
        "note": "A HUMAN must drive this. The harness records; it does not simulate. An automated "
                "pass would prove the script works, not that the product is usable.",
    })
    print(f"R-2 harness prepared: {len(JOURNEY)} steps. Requires a human driver.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
