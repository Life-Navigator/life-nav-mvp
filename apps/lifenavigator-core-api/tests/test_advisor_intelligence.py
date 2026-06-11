"""P0 Advisor Intelligence — guards against inventing career, losing user wording, forcing domain flow."""
from app.services.life_discovery import LifeDiscoveryService
from app.services.relationship_manager import FLOW, _CORRECTION_RE


def test_no_forced_career_or_health_question_in_flow():
    keys = [s["key"] for s in FLOW]
    assert "career_goal" not in keys  # Rule 4: career is never force-asked
    assert "health_goal" not in keys
    assert "family_goal" not in keys


def test_debt_house_family_does_not_produce_career():
    s = LifeDiscoveryService(None)
    cands = s.analyze_statement(
        "paying down credit cards, building a down payment for a larger house, and starting a family"
    )
    blob = " ".join(((c.get("objective") or "") + " " + (c.get("goal") or "")) for c in cands).lower()
    assert "career" not in blob and "advance your career" not in blob  # Rule 1


def test_candidate_goals_preserve_user_wording():
    s = LifeDiscoveryService(None)
    cands = s.analyze_statement("pay off revolving debt, and build a down payment for a house")
    goals = " ".join((c.get("goal") or "") for c in cands).lower()
    assert "debt" in goals  # Rule 3: user's words preserved verbatim
    assert "house" in goals or "down payment" in goals


def test_analyze_never_defaults_to_career():
    s = LifeDiscoveryService(None)
    # An ambiguous statement must PROBE, never silently fall back to career_growth.
    r = s.analyze(surface_goal="reorganize how we handle our spending", why_chain=[{"a": "to keep things simple"}])
    assert r.get("primary_objective") != "career_growth"  # Rule 1


def test_correction_regex_detects_pushback():
    for m in [
        "No, you made up advance my career",
        "that's wrong",
        "not what I meant",
        "I never said that",
        "no",
        "not career",
    ]:
        assert _CORRECTION_RE.search(m), m  # Rule 2: corrections are detected
