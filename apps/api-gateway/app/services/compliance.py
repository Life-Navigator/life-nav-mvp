"""Compliance vetting for outbound recommendation text.

Every recommendation envelope is run through ``check_recommendation``
before the API returns it. The function returns a ``ComplianceResult``
that the caller serializes as ``compliance_notes`` and uses to decide
whether to surface the recommendation or scrub it.

The disallowed-phrase list is intentionally narrow — it catches the
high-risk failure modes (specific securities advice, medical
diagnosis, guaranteed outcomes) without policing legitimate planning
language.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Iterable


# --- Securities / individualized investment advice ---------------------
SECURITIES_PHRASES = [
    r"\bbuy\s+(spy|qqq|tsla|aapl|googl|msft|nvda|amzn|meta)\b",
    r"\bsell\s+(spy|qqq|tsla|aapl|googl|msft|nvda|amzn|meta)\b",
    r"\binvest\s+in\s+\$[a-z]{1,5}\b",
    r"\bguaranteed\s+\d+\s*%\s+returns?\b",
    r"\brisk[-\s]free\s+\d+\s*%\b",
    r"\bI\s+recommend\s+you\s+(buy|sell|short)\b",
]

# --- Medical diagnosis / dosage / treatment ----------------------------
MEDICAL_PHRASES = [
    r"\byou\s+have\s+(diabetes|hypertension|cancer|depression|adhd|als|ms|covid|copd|epilepsy)\b",
    r"\byou\s+are\s+diagnosed\s+with\b",
    r"\btake\s+\d+\s*mg\s+of\b",
    r"\bincrease\s+your\s+dose\b",
    r"\bdecrease\s+your\s+dose\b",
    r"\bstop\s+taking\s+(your|the)\s+(medication|prescription|drug)\b",
    r"\bguaranteed\s+to\s+cure\b",
]

# --- Universal "guaranteed outcome" guard ------------------------------
GUARANTEE_PHRASES = [
    r"\bguaranteed\s+to\s+(make|earn|cure|fix|prevent)\b",
    r"\bwill\s+definitely\s+(make|earn|happen|work)\b",
    r"\b100\s*%\s+chance\b",
    r"\bno\s+downside\b",
]

# --- Cross-user leakage ------------------------------------------------
CROSS_USER_PHRASES = [
    r"\bother\s+users\s+(typically|generally|often)\b",
    r"\bbased\s+on\s+similar\s+users'\s+data\b",
]


@dataclass
class ComplianceViolation:
    category: str
    matched_phrase: str
    context: str


@dataclass
class ComplianceResult:
    ok: bool
    violations: list[ComplianceViolation] = field(default_factory=list)
    compliance_notes: list[str] = field(default_factory=list)


def _category_matches(text: str, patterns: Iterable[str]) -> list[ComplianceViolation]:
    out: list[ComplianceViolation] = []
    for raw in patterns:
        pattern = re.compile(raw, re.IGNORECASE)
        for m in pattern.finditer(text):
            start = max(0, m.start() - 40)
            end = min(len(text), m.end() + 40)
            out.append(
                ComplianceViolation(
                    category="?",  # filled by the caller below
                    matched_phrase=m.group(0),
                    context=text[start:end],
                )
            )
    return out


def check_recommendation(text: str) -> ComplianceResult:
    """Vet the recommendation copy. Returns a ComplianceResult.

    ``ok`` is False if any disallowed phrase matched. The route layer is
    responsible for either scrubbing the offending text or refusing to
    return the recommendation.
    """
    notes: list[str] = []
    if not isinstance(text, str):
        return ComplianceResult(ok=False, compliance_notes=["non-string recommendation rejected"])
    if not text.strip():
        return ComplianceResult(ok=True, compliance_notes=["empty recommendation accepted as no-op"])

    violations: list[ComplianceViolation] = []
    for category, patterns in (
        ("securities", SECURITIES_PHRASES),
        ("medical", MEDICAL_PHRASES),
        ("guarantee", GUARANTEE_PHRASES),
        ("cross_user", CROSS_USER_PHRASES),
    ):
        for v in _category_matches(text, patterns):
            v.category = category
            violations.append(v)

    if violations:
        seen: set[str] = set()
        for v in violations:
            if v.category in seen:
                continue
            seen.add(v.category)
            notes.append(_advice_for(v.category))
        return ComplianceResult(ok=False, violations=violations, compliance_notes=notes)

    # No violations — add a positive note that the engine vetted the copy.
    notes.append("Recommendation reviewed for securities, medical, guarantee, and cross-user safety.")
    return ComplianceResult(ok=True, compliance_notes=notes)


def _advice_for(category: str) -> str:
    return {
        "securities": (
            "This recommendation includes language that could be interpreted as "
            "individualized investment advice or a specific securities recommendation. "
            "Refer the user to a licensed financial advisor."
        ),
        "medical": (
            "This recommendation includes diagnostic, dosage, or treatment language. "
            "Refer the user to a licensed physician."
        ),
        "guarantee": (
            "This recommendation contains a guaranteed-outcome phrase. "
            "Frame outcomes as scenarios, not certainties."
        ),
        "cross_user": (
            "This recommendation references behavior of other users. "
            "Personalized output must rely only on the authenticated user's own data."
        ),
    }[category]
