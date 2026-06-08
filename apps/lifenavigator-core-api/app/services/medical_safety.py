"""Medical safety gate for the Health domain.

Health is **wellness/lifestyle guidance only** — never medical care. This gate is a
deterministic (no-LLM) classifier that BLOCKS diagnosis/dosing/prescription requests,
ESCALATES emergencies, and ALLOWS wellness coaching with a mandatory disclaimer.
See HEALTH_GOVERNANCE_STANDARD.md.
"""

from __future__ import annotations

from dataclasses import dataclass

_EMERGENCY = (
    "chest pain", "can't breathe", "cant breathe", "trouble breathing", "suicidal",
    "kill myself", "stroke", "overdose", "unconscious", "severe bleeding", "anaphylaxis",
    "heart attack",
)
_DOSING = (
    "how much should i take", "what dose", "dosage", "what should my dose", "mg of",
    "how many mg", "titrate", "prescribe", "prescription", "peptide", "start taking",
    "increase my dose", "stop taking my",
)
_DIAGNOSIS = (
    "diagnose", "do i have", "what condition", "is this cancer", "am i sick",
    "what's wrong with me", "whats wrong with me", "what disease", "is this a tumor",
)
# Requires a physician-review boundary even when allowed (labs/vitals/medications).
_NEEDS_REVIEW = (
    "lab result", "blood test", "my labs", "my lab", "vital", "medication",
    "protocol", "supplement stack", "hormone",
)

DISCLAIMER = (
    "This is general wellness guidance, not medical advice. "
    "Consult a licensed clinician for medical concerns."
)


def medical_boundary(*, requires_review: bool = False, escalation: str = "physician") -> dict:
    """The standard Health AdviceBoundary (boundary_type='medical')."""
    return {
        "boundary_type": "medical",
        "disclaimer_text": DISCLAIMER,
        "requires_human_review": requires_review,
        "escalation_path": escalation,
        "prohibited_intents": ["diagnosis", "treatment", "prescription", "medical_claim"],
    }


@dataclass
class SafetyDecision:
    action: str       # "allow" | "block" | "escalate"
    reason: str
    boundary: dict
    message: str
    allowed: bool


class MedicalSafetyGate:
    """Deterministic medical-safety classifier. No model call — auditable keyword rules."""

    def evaluate(self, query: str) -> SafetyDecision:
        q = (query or "").lower()
        if any(k in q for k in _EMERGENCY):
            return SafetyDecision(
                "escalate", "emergency_symptoms",
                medical_boundary(requires_review=True, escalation="emergency"),
                "If this may be a medical emergency, call your local emergency number now. "
                "I can't provide medical care.",
                allowed=False,
            )
        if any(k in q for k in _DOSING):
            return SafetyDecision(
                "block", "dosing_or_prescription",
                medical_boundary(requires_review=True, escalation="physician"),
                "I can't advise on medication, supplement, or peptide dosing. Please consult a "
                "licensed clinician.",
                allowed=False,
            )
        if any(k in q for k in _DIAGNOSIS):
            return SafetyDecision(
                "block", "diagnosis",
                medical_boundary(requires_review=True, escalation="physician"),
                "I can't diagnose conditions. Please consult a licensed clinician.",
                allowed=False,
            )
        needs_review = any(k in q for k in _NEEDS_REVIEW)
        return SafetyDecision(
            "allow", "wellness_coaching",
            medical_boundary(requires_review=needs_review, escalation="physician"),
            DISCLAIMER,
            allowed=True,
        )
