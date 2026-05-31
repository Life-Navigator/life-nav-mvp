"""Compliance rejection paths.

Asserts that ``check_recommendation`` flags each of the four high-risk
categories and surfaces the right partner recommendation in the
compliance notes.
"""
from __future__ import annotations

from app.services.compliance import check_recommendation


def test_empty_text_is_accepted_as_no_op():
    r = check_recommendation("")
    assert r.ok is True
    assert "no-op" in " ".join(r.compliance_notes).lower()


def test_neutral_planning_language_passes():
    r = check_recommendation(
        "Consider contributing to a tax-advantaged retirement account once your "
        "emergency fund covers three months of expenses."
    )
    assert r.ok is True
    assert r.violations == []


def test_specific_securities_recommendation_is_flagged():
    r = check_recommendation("You should buy SPY this week.")
    assert r.ok is False
    cats = {v.category for v in r.violations}
    assert "securities" in cats
    assert any("licensed financial advisor" in n.lower() for n in r.compliance_notes)


def test_individualized_advice_pattern_is_flagged():
    r = check_recommendation("I recommend you buy AAPL for stable growth.")
    assert r.ok is False
    cats = {v.category for v in r.violations}
    assert "securities" in cats


def test_guaranteed_return_phrase_is_flagged():
    r = check_recommendation("This portfolio gives you guaranteed 12% returns.")
    assert r.ok is False
    cats = {v.category for v in r.violations}
    # 'guaranteed N%' is in the securities list; we accept either
    # bucket — both surface the same partner.
    assert cats & {"securities", "guarantee"}


def test_medical_diagnosis_is_flagged():
    r = check_recommendation("You have hypertension and should reduce sodium.")
    assert r.ok is False
    cats = {v.category for v in r.violations}
    assert "medical" in cats
    assert any("physician" in n.lower() for n in r.compliance_notes)


def test_dosage_instruction_is_flagged():
    r = check_recommendation("Take 500 mg of ibuprofen every six hours.")
    assert r.ok is False
    cats = {v.category for v in r.violations}
    assert "medical" in cats


def test_stop_taking_meds_is_flagged():
    r = check_recommendation("Stop taking your medication.")
    assert r.ok is False
    cats = {v.category for v in r.violations}
    assert "medical" in cats


def test_cross_user_reasoning_is_flagged():
    r = check_recommendation(
        "Based on similar users' data, your portfolio should be 70/30 stocks/bonds."
    )
    assert r.ok is False
    cats = {v.category for v in r.violations}
    assert "cross_user" in cats


def test_no_downside_guarantee_is_flagged():
    r = check_recommendation("This strategy has no downside.")
    assert r.ok is False
    cats = {v.category for v in r.violations}
    assert "guarantee" in cats


def test_compliance_route_returns_violation_payload(client, bearer):
    """End-to-end through the route — verifies the wire shape."""
    token, headers = bearer
    r = client.post(
        "/api/compliance/check",
        headers=headers,
        json={"text": "You have diabetes and should buy SPY."},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is False
    cats = {v["category"] for v in body["violations"]}
    assert {"medical", "securities"}.issubset(cats)
    assert len(body["compliance_notes"]) >= 2
    assert body["checked_by_user_id"] == "00000000-0000-0000-0000-000000000001"
