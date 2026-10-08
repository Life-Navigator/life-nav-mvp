"""Probe A — routing and the health-urgent safety net.

Measures `classify_domain`, `classify_risk` and `detect_health_urgent` against labelled messages.
All three are pure regex today with no confidence signal, so a message that matches two domains is
resolved by PATTERN ORDER rather than by meaning — health is scanned first, then finance, and
finance owns `loan`/`debt`/`tax`, so an education question phrased around loans lands in finance.
That is the mechanism behind the "education misframe" and "health misroute" findings in this repo's
history, and this probe is where that becomes a number instead of an anecdote.

DIRECTION SEMANTICS FOR THIS PROBE
----------------------------------
The scorecard's two buckets carry the same ASYMMETRY as the gate's, with probe-specific meaning:

    must_pass   — the message must route to the labelled domain, and must NOT falsely trip the
                  health-urgent net. Failure is a QUALITY cost: the wrong agent, the wrong
                  grounding, the wrong playbook in the prompt.
    must_block  — the health-urgent safety net MUST fire. Failure is a SAFETY cost, and it is the
                  one failure in this whole harness that could matter medically.

Those are deliberately not averaged, for the same reason they are not averaged in the gate: a router
that sent everything to health would score perfectly on safety and be useless.
"""
from __future__ import annotations

from typing import Optional

from app.services.model_router import classify_domain, classify_risk, detect_health_urgent

from .model import CaseResult, RoutingCase, fixture_version, load_routing_cases
from .scorecard import ProbeScore, score

PROBE = "routing"


def evaluate_case(case: RoutingCase) -> CaseResult:
    """Run one message through the production classifiers."""
    urgent = detect_health_urgent(case.message)
    domain = classify_domain(case.message)
    risk = classify_risk(case.message, domain)

    # A case asserting the safety net is scored ONLY on the safety net. Mixing in domain assertions
    # would let a domain mismatch mask a missed emergency in the same number.
    if case.expect_urgent is not None:
        ok = urgent == case.expect_urgent
        return CaseResult(
            case_id=case.id, direction="must_block",
            expected=f"urgent={case.expect_urgent}", actual=f"urgent={urgent}",
            ok=ok, known_divergence=case.known_divergence,
            detail={"domain": domain, "risk": risk, "why": case.why, "tags": list(case.tags)},
        )

    mismatches = []
    if domain != case.expect_domain:
        mismatches.append(f"domain {domain}≠{case.expect_domain}")
    if case.expect_risk is not None and risk != case.expect_risk:
        mismatches.append(f"risk {risk}≠{case.expect_risk}")
    # A non-urgent case must not trip the safety net either — a false positive replaces real advice
    # with an emergency-room message, which is its own kind of broken turn.
    if urgent is not None:
        mismatches.append(f"falsely urgent ({urgent})")

    return CaseResult(
        case_id=case.id, direction="must_pass",
        expected=f"{case.expect_domain}/{case.expect_risk or '*'}",
        actual=f"{domain}/{risk}" + (f" urgent={urgent}" if urgent else ""),
        ok=not mismatches, known_divergence=case.known_divergence,
        detail={"mismatches": mismatches, "why": case.why, "tags": list(case.tags)},
    )


def run(cases: Optional[list[RoutingCase]] = None) -> ProbeScore:
    cases = cases if cases is not None else load_routing_cases()
    results = [evaluate_case(c) for c in cases]
    notes: list[str] = []
    if not cases:
        notes.append("no routing fixtures found — the probe reports UNMEASURED, not a pass")
    else:
        safety = sum(1 for c in cases if c.expect_urgent is not None)
        notes.append(f"{len(cases) - safety} routing / {safety} safety-net cases")
        notes.append("classifiers are regex with no confidence score; ambiguity resolves by pattern "
                     "ORDER (health → finance → career → education → family)")
    return score(PROBE, fixture_version("routing_cases.json"), results, notes)
