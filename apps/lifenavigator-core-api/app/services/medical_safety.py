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
# Genuine drug/medication dose or prescription REQUESTS — INTENT phrases, not bare words. A bare word like
# "dosage" over-blocks benign wellness ("creatine dosage"); these fire only on an actual "how much should I
# take / prescribe me" intent, AND only OUTSIDE a supplement/nutrition context (see _WELLNESS_CONTEXT).
_DOSING_INTENT = (
    "how much should i take", "what dose", "what's the dose", "whats the dose", "what should my dose",
    "how many mg", "mg should i", "titrate", "increase my dose", "lower my dose", "adjust my dose",
    "prescribe me", "prescription for", "write me a prescription", "get me a prescription",
)
# Benign wellness/supplement/nutrition context — a "how much" question here is coaching, not medical dosing.
_WELLNESS_CONTEXT = (
    "creatine", "protein", "whey", "vitamin", "multivitamin", "magnesium", "omega", "fish oil", "collagen",
    "electrolyte", "caffeine", "pre-workout", "preworkout", "fiber", "supplement", "greens", "hydration",
)
_DIAGNOSIS = (
    "diagnose", "what condition", "is this cancer", "am i sick",
    "what's wrong with me", "whats wrong with me", "what disease", "is this a tumor",
)
# "do i have" alone is too broad ("do I have enough protein/time/money"). Block it ONLY with a real
# condition/symptom cue, so "do I have diabetes?" blocks but benign "do I have enough X" does not.
_CONDITION_CUES = (
    "diabet", "cancer", "tumor", "disease", "disorder", "infection", "syndrome", "deficiency", "adhd",
    "depression", "anxiety disorder", "thyroid", "arthritis", "asthma", "hypertension", "high blood pressure",
    "cholesterol", "a condition", "this condition", "symptom", "std", "sti", "pregnan",
)
# Requires a physician-review boundary even when allowed (labs/vitals/medications). NOT a block. Bare
# "protocol"/"hormone" removed — they over-flagged normal sleep-protocol / wellness coaching.
_NEEDS_REVIEW = (
    "lab result", "blood test", "my labs", "my lab", "vital", "medication", "supplement stack",
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
        # Real drug-dose / prescription intent blocks — but a supplement/nutrition "how much" is coaching.
        if any(k in q for k in _DOSING_INTENT) and not any(w in q for w in _WELLNESS_CONTEXT):
            return SafetyDecision(
                "block", "dosing_or_prescription",
                medical_boundary(requires_review=True, escalation="physician"),
                "I can't advise on prescription-medication dosing — please consult a licensed clinician. "
                "(General supplement and nutrition guidance is fine; just tell me what you're taking.)",
                allowed=False,
            )
        if any(k in q for k in _DIAGNOSIS) or ("do i have" in q and any(c in q for c in _CONDITION_CUES)):
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
