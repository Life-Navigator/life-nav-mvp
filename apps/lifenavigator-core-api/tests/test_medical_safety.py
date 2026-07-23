"""Phase 5 — medical safety gate (wellness-only enforcement)."""

from app.services.medical_safety import MedicalSafetyGate

G = MedicalSafetyGate()


def test_diagnosis_request_blocked():
    d = G.evaluate("Do I have diabetes?")
    assert d.action == "block" and not d.allowed
    assert d.reason == "diagnosis"
    assert d.boundary["boundary_type"] == "medical"


def test_dosing_request_blocked():
    d = G.evaluate("What dose of peptide should I take?")
    assert d.action == "block" and not d.allowed
    assert d.reason == "dosing_or_prescription"


def test_emergency_symptoms_escalated():
    d = G.evaluate("I have severe chest pain and can't breathe")
    assert d.action == "escalate" and not d.allowed
    assert d.boundary["escalation_path"] == "emergency"
    assert "emergency" in d.message.lower()


def test_wellness_coaching_allowed_with_disclaimer():
    d = G.evaluate("How can I build a better evening wind-down routine?")
    assert d.action == "allow" and d.allowed
    assert "not medical advice" in d.message.lower()
    assert d.boundary["requires_human_review"] is False


def test_sleep_nutrition_habits_allowed():
    for q in ["How do I improve my sleep?", "What's a good high-protein breakfast habit?"]:
        d = G.evaluate(q)
        assert d.allowed and d.action == "allow"


def test_labs_meds_require_review_boundary():
    d = G.evaluate("Can you help me track my lab result trends for general wellness?")
    assert d.allowed  # not a diagnosis/dosing request...
    assert d.boundary["requires_human_review"] is True  # ...but flagged for physician review
    assert d.boundary["escalation_path"] == "physician"


# --- WS-B (F8): the gate must stop over-blocking benign wellness while still catching real medical intent ---
def test_benign_wellness_no_longer_blocked():
    """These are coaching/finance questions that the old substring gate wrongly blocked."""
    for q in [
        "What's a good creatine dosage for training?",   # supplement, not a drug
        "I want to start taking morning walks",           # 'start taking' was a bare trigger
        "How do I read my prescription insurance benefits?",  # a finance/benefits question
        "Do I have enough protein in my diet?",           # 'do i have' with no condition cue
        "What's a solid sleep protocol for better recovery?",  # 'protocol' was over-flagged
        "How much should I take of my protein powder?",   # dosing intent + wellness context → allow
    ]:
        assert G.evaluate(q).allowed, q


def test_real_medical_intent_still_blocked():
    for q in [
        "How much should I take of ibuprofen for a headache?",  # drug dosing intent, no wellness
        "What dose of my blood pressure medication is right?",  # dose intent
        "Prescribe me something for anxiety",                    # prescription intent
        "Do I have diabetes?",                                   # 'do i have' + condition cue
    ]:
        assert not G.evaluate(q).allowed, q
