"""Probe D — the number gate.

Measures `advisor_validator`'s decision directly: given a reply and the grounding a turn had, does
the gate block or pass it, and is that what the trust policy requires?

WHY THIS PROBE IS THE MOST VALUABLE ONE
---------------------------------------
* It is FREE and offline — no model, no deployment, no credentials. It can run on every PR.
* It measures the component the control experiment attributed ~49% of the advisor-quality gap to.
* It is the only probe that can quantify OVER-blocking, which is a cost that is otherwise invisible:
  when the gate deletes a true sentence, no error is raised, `llm_status` still reads "enhanced",
  and the user simply receives a thinner answer. Nothing in production notices.

IT CALLS THE REAL VALIDATOR
---------------------------
`_fabricated_personal_numbers` is invoked directly, not reimplemented. A harness that re-derived the
gate's logic would measure the copy and drift from the thing that actually ships — which is exactly
the failure mode the ontology-manifest contract and the cross-language parity fixture were built to
prevent elsewhere in this repo.
"""
from __future__ import annotations

from typing import Optional

from app.services.advisor_validator import _fabricated_personal_numbers

from .model import CaseResult, GateCase, fixture_version, load_gate_cases
from .scorecard import ProbeScore, score

PROBE = "gate"


def evaluate_case(case: GateCase) -> CaseResult:
    """Run one case through the production gate."""
    blocked = _fabricated_personal_numbers(
        case.text, set(case.allowed), set(case.scenario), set()
    )
    actual = "blocked" if blocked else "passed"
    expected = "passed" if case.direction == "must_pass" else "blocked"
    return CaseResult(
        case_id=case.id,
        direction=case.direction,
        expected=expected,
        actual=actual,
        ok=(actual == expected),
        known_divergence=case.known_divergence,
        detail={"blocked_numbers": sorted(blocked), "why": case.why, "tags": list(case.tags)},
    )


def run(cases: Optional[list[GateCase]] = None) -> ProbeScore:
    cases = cases if cases is not None else load_gate_cases()
    results = [evaluate_case(c) for c in cases]
    notes: list[str] = []
    if not cases:
        notes.append("no gate fixtures found — the probe reports UNMEASURED, not a pass")
    else:
        # Surfaced because a one-sided fixture set produces a meaningless rate: all must_block cases
        # make any gate look perfect on trust, all must_pass cases make any gate look perfect on
        # quality. The asymmetry has to be visible in the report, not buried in the case file.
        mp = sum(1 for c in cases if c.direction == "must_pass")
        mb = len(cases) - mp
        if not mp or not mb:
            notes.append("WARNING: fixtures are one-sided — a rate from these cases is not meaningful")
        notes.append(f"{mp} must_pass / {mb} must_block cases")
    return score(PROBE, fixture_version("gate_cases.json"), results, notes)
