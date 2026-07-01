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
