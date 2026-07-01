"""Cross-domain life-decision routing: a decision cue + ≥2 life-domain cues → supervised (Opus), even without
an explicit finance keyword. Generic 'should I' (product/writing) must NOT over-route. Finance education stays fast."""
import pytest
from app.services.advisor_orchestrator import (
    select_route_path, _is_cross_domain_life_decision, _count_life_domains)

# domains=[] simulates the keyword router MISSING a finance tag (the exact Q2 failure).
NONE = []

SUPERVISED = [
    "Should I buy before the wedding or after promotion?",
    "Should we buy a house before starting a family?",
    "Should I use my bonus for debt or down payment?",
    "Compare buying now versus after my raise.",
    "How should I sequence wedding cash, emergency reserve, and down payment?",
    "Should I delay school until after the promotion?",
    "Should we prioritize wedding cash or the emergency fund?",
    "Should I take the new job before buying a house?",
]

NOT_SUPERVISED = [
    "Should I rename this button?",
    "Should I make this email friendlier?",
    "Should I use dark mode?",
    "Should I ask one more question?",
]


@pytest.mark.parametrize("q", SUPERVISED)
def test_cross_domain_decisions_route_supervised(q):
    assert _is_cross_domain_life_decision(q) is True, q
    assert select_route_path(q, NONE) == "supervised", q  # even with NO finance keyword tagged


@pytest.mark.parametrize("q", NOT_SUPERVISED)
def test_generic_should_i_does_not_over_route(q):
    assert _is_cross_domain_life_decision(q) is False, q
    assert select_route_path(q, NONE) != "supervised", q


def test_finance_education_still_fast():
    assert select_route_path("What is PMI?", ["finance"]) in ("fast", "standard")
    assert select_route_path("What is a 529?", ["finance"]) in ("fast", "standard")
    assert _is_cross_domain_life_decision("What is PMI?") is False  # no decision cue


def test_needs_two_distinct_domains():
    # one domain cue + decision → NOT cross-domain (single-domain finance is handled by the finance gate instead)
    assert _count_life_domains("should I use my bonus?") == 1
    assert _is_cross_domain_life_decision("should I use my bonus?") is False
    # two distinct → yes
    assert _count_life_domains("wedding and a house") == 2


def test_route_sends_cross_domain_decision_to_opus():
    """When a Claude/Opus hybrid is configured, a cross-domain life decision is routed to it (not Gemini)."""
    from app.services.advisor_orchestrator import AdvisorOrchestrator
    from app.models.common import UserContext
    gemini, opus = object(), object()
    o = AdvisorOrchestrator(None, None, gemini, hybrid_claude=opus, claude_domains={"finance", "health"})
    ctx = UserContext(user_id="u")
    tr = {"turn_id": "t", "route_path": "supervised"}  # cross-domain decisions classify supervised
    primary, fallback = o._route(ctx, "Should I buy before the wedding or after promotion?", None, tr)
    assert primary is opus         # Opus primary
    assert fallback is gemini      # Gemini same-tier fallback
    assert tr["hybrid_route"]["cross_domain"] is True

    # a plain non-life question with a hybrid configured is NOT forced to Opus by the cross-domain path
    tr2 = {"turn_id": "t2", "route_path": "standard"}
    p2, _ = o._route(ctx, "should I rename this button?", None, tr2)
    assert p2 is gemini and "hybrid_route" not in tr2
