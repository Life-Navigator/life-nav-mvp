"""Post-generation compliance validation for Life Navigator.

Pure regex, no network calls, sub-millisecond execution.
Scans both user queries (pre-generation) and AI responses (post-generation)
for violations, missing disclaimers, and crisis escalation triggers.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional

from lib.compliance_rules import (
    ALL_RULES,
    ComplianceRule,
    RuleType,
    Severity,
    get_rules_by_domain,
)

# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------


@dataclass
class ComplianceResult:
    """Result of a compliance check on a query or response."""

    is_compliant: bool = True
    violations: list[dict] = field(default_factory=list)
    warnings: list[dict] = field(default_factory=list)
    required_disclaimers: list[str] = field(default_factory=list)
    escalation_needed: bool = False
    escalation_type: Optional[str] = None
    escalation_message: Optional[str] = None
    modified_response: Optional[str] = None


# ---------------------------------------------------------------------------
# Violation patterns (response-side)
# ---------------------------------------------------------------------------

VIOLATION_PATTERNS: list[tuple[str, re.Pattern, str]] = [
    (
        "specific_security_recommendation",
        re.compile(
            r"\b(?:buy|sell|short|long)\b.{0,30}\b(?:shares?|stock|options?)\b"
            r".{0,30}\b(?:of|in)\b\s+[A-Z]{1,5}\b",
            re.IGNORECASE,
        ),
        "Response contains a specific security recommendation",
    ),
    (
        "guaranteed_returns",
        re.compile(
            r"\b(?:guarantee[ds]?|assured?|certain)\b.{0,40}"
            r"\b(?:return|profit|gain|yield|performance)\b",
            re.IGNORECASE,
        ),
        "Response contains guaranteed return language",
    ),
    (
        "medical_diagnosis",
        re.compile(
            r"\b(?:you (?:have|probably have|likely have|are suffering from))\b"
            r".{0,60}\b(?:disease|disorder|syndrome|condition|infection|deficiency)\b",
            re.IGNORECASE,
        ),
        "Response contains a medical diagnosis",
    ),
    (
        "medication_dosage",
        re.compile(
            r"\b(?:take|prescribe|dose|dosage|administer)\b.{0,30}"
            r"\b\d+\s*(?:mg|ml|mcg|iu|units?|tablets?|capsules?|pills?)\b",
            re.IGNORECASE,
        ),
        "Response contains specific medication dosage",
    ),
    (
        "legal_advice",
        re.compile(
            r"\b(?:legal(?:ly)?\s+(?:you\s+(?:should|must|can|cannot)|advice|opinion))\b",
            re.IGNORECASE,
        ),
        "Response contains legal advice",
    ),
]

# ---------------------------------------------------------------------------
# Crisis patterns (query-side pre-generation)
# ---------------------------------------------------------------------------

CRISIS_PATTERNS: list[tuple[str, re.Pattern, str, str]] = [
    (
        "suicidal_ideation",
        re.compile(
            r"\b(?:kill\s+(?:my)?self|suicid|end\s+(?:my\s+)?life"
            r"|want\s+to\s+die|don'?t\s+want\s+to\s+(?:live|be\s+alive))\b",
            re.IGNORECASE,
        ),
        "988 Suicide & Crisis Lifeline",
        (
            "**If you are in crisis, please contact the 988 Suicide & Crisis "
            "Lifeline by calling or texting 988 (US). You can also chat at "
            "988lifeline.org. You are not alone, and help is available.**"
        ),
    ),
    (
        "domestic_violence",
        re.compile(
            r"\b(?:domestic\s+(?:violence|abuse)"
            r"|partner\s+(?:hits?|hurts?|abuses?)"
            r"|being\s+(?:hit|beaten|abused))\b",
            re.IGNORECASE,
        ),
        "National Domestic Violence Hotline",
        (
            "**If you or someone you know is experiencing domestic violence, "
            "contact the National Domestic Violence Hotline at 1-800-799-7233 "
            "or text START to 88788.**"
        ),
    ),
]

# ---------------------------------------------------------------------------
# Domain disclaimers
# ---------------------------------------------------------------------------

DOMAIN_DISCLAIMERS: dict[str, str] = {
    "finance": (
        "\n\n---\n*This is general financial information, not personalized "
        "financial advice. For advice tailored to your situation, consider "
        "consulting a Certified Financial Planner (CFP) or financial advisor.*"
    ),
    "health": (
        "\n\n---\n*This is general wellness information, not medical advice. "
        "Please consult a licensed physician or healthcare provider for "
        "medical concerns.*"
    ),
    "mental_health": (
        "\n\n---\n*This is general wellness guidance, not therapy or clinical "
        "advice. For mental health concerns, please consult a licensed mental "
        "health professional.*"
    ),
    "legal": (
        "\n\n---\n*This is general information, not legal advice. For legal "
        "matters, please consult a licensed attorney in your jurisdiction.*"
    ),
    "tax": (
        "\n\n---\n*This is general tax information, not personalized tax advice. "
        "For tax preparation, filing, or specific tax situations, please consult "
        "a Certified Public Accountant (CPA) or Enrolled Agent.*"
    ),
    "insurance": (
        "\n\n---\n*This is general insurance information, not a recommendation "
        "to purchase any specific policy. For coverage decisions, please consult "
        "a licensed insurance agent or broker in your state.*"
    ),
    "nutrition": (
        "\n\n---\n*This is general nutrition information, not medical nutrition "
        "therapy. For personalized dietary needs or medical conditions, please "
        "consult a Registered Dietitian (RD) or physician.*"
    ),
}

# ---------------------------------------------------------------------------
# Pre-generation: query escalation check
# ---------------------------------------------------------------------------


def check_query_escalation(query: str) -> ComplianceResult:
    """Check the user query for crisis signals BEFORE generation.

    If a crisis pattern matches, the result includes an escalation message
    that should be prepended to any generated response.
    """
    result = ComplianceResult()

    for crisis_id, pattern, escalation_type, message in CRISIS_PATTERNS:
        if pattern.search(query):
            result.escalation_needed = True
            result.escalation_type = escalation_type
            result.escalation_message = message
            # Only take the first (highest priority) match
            break

    return result


# ---------------------------------------------------------------------------
# Post-generation: response compliance check
# ---------------------------------------------------------------------------


def check_response_compliance(
    response: str,
    query: str,
    detected_domains: list[str],
) -> ComplianceResult:
    """Scan a generated response for violations and missing disclaimers.

    Returns a ComplianceResult with:
    - violations: list of detected violations
    - warnings: non-critical issues
    - required_disclaimers: disclaimer text that should be appended
    - modified_response: response with disclaimers appended and
      escalation messages prepended (if needed)
    """
    result = ComplianceResult()
    modified = response

    # --- 1. Check for crisis escalation in the query ---
    escalation = check_query_escalation(query)
    if escalation.escalation_needed:
        result.escalation_needed = True
        result.escalation_type = escalation.escalation_type
        result.escalation_message = escalation.escalation_message
        # Prepend escalation message
        modified = f"{escalation.escalation_message}\n\n{modified}"

    # --- 2. Scan for violation patterns in the response ---
    for violation_id, pattern, description in VIOLATION_PATTERNS:
        if pattern.search(response):
            result.is_compliant = False
            result.violations.append({
                "type": violation_id,
                "description": description,
            })

    # --- 3. Check for missing disclaimers ---
    disclaimer_domains = set(detected_domains)

    # Also check if response touches domains not detected from query
    _domain_indicators = {
        "finance": re.compile(r"\b(?:invest|budget|saving|debt|retire|portfolio)\b", re.IGNORECASE),
        "health": re.compile(r"\b(?:exercise|nutrition|sleep|fitness|medical)\b", re.IGNORECASE),
        "mental_health": re.compile(r"\b(?:anxiety|stress|therapy|depress|coping)\b", re.IGNORECASE),
        "legal": re.compile(r"\b(?:legal|attorney|lawsuit|contract|liability)\b", re.IGNORECASE),
        "tax": re.compile(r"\b(?:tax|deduction|irs|withholding|filing|cpa)\b", re.IGNORECASE),
        "insurance": re.compile(r"\b(?:insurance|coverage|premium|deductible|policy|claim)\b", re.IGNORECASE),
        "nutrition": re.compile(r"\b(?:nutrition|macro|protein|calorie|meal plan|supplement)\b", re.IGNORECASE),
    }
    for domain, indicator in _domain_indicators.items():
        if indicator.search(response):
            disclaimer_domains.add(domain)

    for domain in disclaimer_domains:
        if domain in DOMAIN_DISCLAIMERS:
            disclaimer_text = DOMAIN_DISCLAIMERS[domain]
            # Check if a similar disclaimer is already in the response
            # Use a simplified check — look for key phrases
            key_phrases = {
                "finance": "not personalized financial advice",
                "health": "not medical advice",
                "mental_health": "not therapy",
                "legal": "not legal advice",
                "tax": "not personalized tax advice",
                "insurance": "not a recommendation to purchase",
                "nutrition": "not medical nutrition therapy",
            }
            phrase = key_phrases.get(domain, "")
            if phrase and phrase.lower() not in response.lower():
                result.required_disclaimers.append(domain)
                modified += disclaimer_text

    result.modified_response = modified
    return result
