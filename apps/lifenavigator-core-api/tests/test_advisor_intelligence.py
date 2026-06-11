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


def test_long_answer_splits_into_clean_goals():
    s = LifeDiscoveryService(None)
    stmt = ("I am currently paying down credit cards in order to get a better travel rewards card for all "
            "spending and the current one will be for emergencies. Once I don't carry any revolving debt "
            "anymore I want to build a down payment for a larger house. My fiancée and I want to start "
            "building a family after the wedding next September.")
    goals = s.analyze_statement(stmt)
    assert len(goals) >= 4  # P0.4: a run-on answer becomes several clean goal units
    blob = " ".join((g["goal"] + " " + g["objective"]) for g in goals).lower()
    assert "career" not in blob  # Rule 1: never invents career
    assert any("credit card" in g["goal"].lower() or "debt" in g["goal"].lower() for g in goals)
    assert any("house" in g["goal"].lower() or "down payment" in g["goal"].lower() for g in goals)
    assert any("family" in g["goal"].lower() for g in goals)


def test_every_surfaced_goal_has_supporting_quote():
    s = LifeDiscoveryService(None)
    for g in s.analyze_statement("pay off debt, and build a down payment for a house"):
        assert g.get("supporting_quotes") and g["supporting_quotes"][0]  # P0.6: no quote, no goal
        assert g.get("goal")  # user wording preserved


def test_travel_rewards_is_not_career():
    s = LifeDiscoveryService(None)
    r = s.analyze(surface_goal="get a better travel rewards card")
    assert r.get("primary_objective") != "career_growth"  # adventure/travel != career
