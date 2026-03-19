"""Structured compliance rules as Python dataclasses.

Phase 1: Pure Python data used by the compliance checker.
Phase 2: Loadable into Neo4j as graph nodes for NL→Cypher querying.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class RuleType(str, Enum):
    PROHIBITION = "prohibition"
    DISCLAIMER = "disclaimer"
    ESCALATION = "escalation"
    BOUNDARY = "boundary"


class Severity(str, Enum):
    CRITICAL = "critical"   # Must block / prepend immediately
    HIGH = "high"           # Must append disclaimer
    MEDIUM = "medium"       # Should append disclaimer
    LOW = "low"             # Informational warning


@dataclass(frozen=True)
class ComplianceRule:
    """A single compliance rule governing AI behavior."""

    id: str
    domain: str
    rule_type: RuleType
    description: str
    severity: Severity
    pattern: Optional[str] = None           # Regex pattern that triggers the rule
    required_text: Optional[str] = None     # Text that must be present/appended
    referral_type: Optional[str] = None     # Professional type for escalation
    regulation_ref: Optional[str] = None    # Regulatory citation


# ---------------------------------------------------------------------------
# Finance rules
# ---------------------------------------------------------------------------

FINANCE_RULES: list[ComplianceRule] = [
    ComplianceRule(
        id="FIN-001",
        domain="finance",
        rule_type=RuleType.PROHIBITION,
        description="Do not recommend specific securities by name or ticker",
        severity=Severity.CRITICAL,
        pattern=r"\b(?:buy|sell|short|long)\b.{0,30}\b(?:shares?|stock|options?)\b.{0,30}\b(?:of|in)\b\s+[A-Z]{1,5}\b",
        regulation_ref="SEC Investment Advisers Act of 1940 § 202(a)(11)",
    ),
    ComplianceRule(
        id="FIN-002",
        domain="finance",
        rule_type=RuleType.PROHIBITION,
        description="Do not guarantee investment returns or specific performance",
        severity=Severity.CRITICAL,
        pattern=r"\b(?:guarantee[ds]?|assured?|certain)\b.{0,40}\b(?:return|profit|gain|yield|performance)\b",
        regulation_ref="SEC Rule 206(4)-1 (Investment Adviser Marketing Rule)",
    ),
    ComplianceRule(
        id="FIN-003",
        domain="finance",
        rule_type=RuleType.DISCLAIMER,
        description="Financial guidance must include non-advice disclaimer",
        severity=Severity.HIGH,
        required_text=(
            "This is general financial information, not personalized financial "
            "advice. For advice tailored to your situation, consider consulting "
            "a Certified Financial Planner (CFP) or financial advisor."
        ),
    ),
    ComplianceRule(
        id="FIN-004",
        domain="finance",
        rule_type=RuleType.PROHIBITION,
        description="Do not provide specific tax advice or preparation",
        severity=Severity.HIGH,
        pattern=r"\b(?:you (?:should|must|need to)\b.{0,30}\b(?:deduct|claim|file|report)\b.{0,20}\b(?:on your|your)\b.{0,10}\btax)",
        regulation_ref="IRS Circular 230",
    ),
    ComplianceRule(
        id="FIN-005",
        domain="finance",
        rule_type=RuleType.BOUNDARY,
        description="Refer to CFP/CPA for complex financial situations",
        severity=Severity.MEDIUM,
        referral_type="CFP/CPA",
        required_text=(
            "For complex tax, estate planning, or investment situations, "
            "consider consulting a Certified Financial Planner (CFP) or "
            "Certified Public Accountant (CPA)."
        ),
    ),
]

# ---------------------------------------------------------------------------
# Health rules
# ---------------------------------------------------------------------------

HEALTH_RULES: list[ComplianceRule] = [
    ComplianceRule(
        id="HLT-001",
        domain="health",
        rule_type=RuleType.PROHIBITION,
        description="Do not diagnose medical conditions",
        severity=Severity.CRITICAL,
        pattern=r"\b(?:you (?:have|probably have|likely have|are suffering from|are diagnosed with))\b.{0,60}\b(?:disease|disorder|syndrome|condition|infection|deficiency)\b",
        regulation_ref="FDA Practice of Medicine guidance",
    ),
    ComplianceRule(
        id="HLT-002",
        domain="health",
        rule_type=RuleType.PROHIBITION,
        description="Do not recommend specific medication dosages",
        severity=Severity.CRITICAL,
        pattern=r"\b(?:take|prescribe|dose|dosage|administer)\b.{0,30}\b\d+\s*(?:mg|ml|mcg|iu|units?|tablets?|capsules?|pills?)\b",
        regulation_ref="FDA/HIPAA",
    ),
    ComplianceRule(
        id="HLT-003",
        domain="health",
        rule_type=RuleType.DISCLAIMER,
        description="Health guidance must include medical disclaimer",
        severity=Severity.HIGH,
        required_text=(
            "This is general wellness information, not medical advice. "
            "Please consult a licensed physician or healthcare provider "
            "for medical concerns."
        ),
    ),
    ComplianceRule(
        id="HLT-004",
        domain="health",
        rule_type=RuleType.ESCALATION,
        description="Refer to physician for medical symptoms",
        severity=Severity.HIGH,
        referral_type="Physician/MD",
        required_text=(
            "If you are experiencing symptoms, please consult a licensed "
            "physician or healthcare provider."
        ),
    ),
]

# ---------------------------------------------------------------------------
# Mental health rules
# ---------------------------------------------------------------------------

MENTAL_HEALTH_RULES: list[ComplianceRule] = [
    ComplianceRule(
        id="MH-001",
        domain="mental_health",
        rule_type=RuleType.ESCALATION,
        description="Provide 988 Lifeline for suicidal ideation",
        severity=Severity.CRITICAL,
        pattern=r"\b(?:kill\s+(?:my)?self|suicid|end\s+(?:my\s+)?life|want\s+to\s+die|don'?t\s+want\s+to\s+(?:live|be\s+alive))\b",
        referral_type="988 Suicide & Crisis Lifeline",
        required_text=(
            "If you are in crisis, please contact the 988 Suicide & Crisis "
            "Lifeline by calling or texting 988 (US). You can also chat at "
            "988lifeline.org. You are not alone, and help is available."
        ),
    ),
    ComplianceRule(
        id="MH-002",
        domain="mental_health",
        rule_type=RuleType.ESCALATION,
        description="Provide DV hotline for domestic violence",
        severity=Severity.CRITICAL,
        pattern=r"\b(?:domestic\s+(?:violence|abuse)|partner\s+(?:hits?|hurts?|abuses?)|being\s+(?:hit|beaten|abused))\b",
        referral_type="National Domestic Violence Hotline",
        required_text=(
            "If you or someone you know is experiencing domestic violence, "
            "contact the National Domestic Violence Hotline at 1-800-799-7233 "
            "or text START to 88788."
        ),
    ),
    ComplianceRule(
        id="MH-003",
        domain="mental_health",
        rule_type=RuleType.DISCLAIMER,
        description="Mental health guidance must include therapy disclaimer",
        severity=Severity.HIGH,
        required_text=(
            "This is general wellness guidance, not therapy or clinical "
            "advice. For mental health concerns, please consult a licensed "
            "mental health professional (therapist, psychologist, or psychiatrist)."
        ),
    ),
]

# ---------------------------------------------------------------------------
# Legal rules
# ---------------------------------------------------------------------------

LEGAL_RULES: list[ComplianceRule] = [
    ComplianceRule(
        id="LEG-001",
        domain="legal",
        rule_type=RuleType.PROHIBITION,
        description="Do not provide legal opinions or interpret laws",
        severity=Severity.CRITICAL,
        pattern=r"\b(?:legal(?:ly)?\s+(?:you\s+(?:should|must|can|cannot)|advice|opinion|rights?))\b",
    ),
    ComplianceRule(
        id="LEG-002",
        domain="legal",
        rule_type=RuleType.DISCLAIMER,
        description="Legal topics must include attorney referral",
        severity=Severity.HIGH,
        referral_type="Attorney/JD",
        required_text=(
            "This is general information, not legal advice. For legal matters, "
            "please consult a licensed attorney in your jurisdiction."
        ),
    ),
]

# ---------------------------------------------------------------------------
# Tax rules
# ---------------------------------------------------------------------------

TAX_RULES: list[ComplianceRule] = [
    ComplianceRule(
        id="TAX-001",
        domain="tax",
        rule_type=RuleType.PROHIBITION,
        description="Do not provide specific tax preparation or filing advice",
        severity=Severity.HIGH,
        pattern=r"\b(?:you (?:should|must|need to)\b.{0,30}\b(?:file|report|claim|deduct)\b.{0,20}\b(?:on your|your)\b.{0,10}\btax)",
        regulation_ref="IRS Circular 230",
    ),
    ComplianceRule(
        id="TAX-002",
        domain="tax",
        rule_type=RuleType.PROHIBITION,
        description="Do not provide specific tax filing instructions or prepare returns",
        severity=Severity.CRITICAL,
        pattern=r"\b(?:file\s+(?:your|the)\s+(?:tax|return|1040|schedule)|prepare\s+(?:your|the)\s+(?:tax|return))\b",
        regulation_ref="IRS Circular 230 § 10.35",
    ),
    ComplianceRule(
        id="TAX-003",
        domain="tax",
        rule_type=RuleType.BOUNDARY,
        description="Refer to CPA or Enrolled Agent for personalized tax situations",
        severity=Severity.HIGH,
        referral_type="CPA/Enrolled Agent",
        required_text=(
            "For personalized tax advice, preparation, or filing, please "
            "consult a Certified Public Accountant (CPA) or IRS Enrolled Agent."
        ),
    ),
]

# ---------------------------------------------------------------------------
# Insurance rules
# ---------------------------------------------------------------------------

INSURANCE_RULES: list[ComplianceRule] = [
    ComplianceRule(
        id="INS-001",
        domain="insurance",
        rule_type=RuleType.PROHIBITION,
        description="Do not act as a licensed insurance agent or recommend specific policies",
        severity=Severity.HIGH,
        pattern=r"\b(?:you\s+should\s+(?:buy|purchase|get)\s+(?:a |the )?(?:policy|plan|coverage)\s+(?:from|with|at))\b",
    ),
    ComplianceRule(
        id="INS-002",
        domain="insurance",
        rule_type=RuleType.DISCLAIMER,
        description="Insurance topics must include licensed agent referral",
        severity=Severity.HIGH,
        referral_type="Licensed Insurance Agent",
        required_text=(
            "This is general insurance information, not a recommendation to "
            "purchase any specific policy. For coverage decisions, please "
            "consult a licensed insurance agent or broker in your state."
        ),
    ),
]

# ---------------------------------------------------------------------------
# All rules combined
# ---------------------------------------------------------------------------

ALL_RULES: list[ComplianceRule] = (
    FINANCE_RULES + HEALTH_RULES + MENTAL_HEALTH_RULES + LEGAL_RULES
    + TAX_RULES + INSURANCE_RULES
)

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------


def get_rules_by_domain(domain: str) -> list[ComplianceRule]:
    """Return all compliance rules for a given domain."""
    return [r for r in ALL_RULES if r.domain == domain]


def get_critical_rules() -> list[ComplianceRule]:
    """Return all rules with CRITICAL severity."""
    return [r for r in ALL_RULES if r.severity == Severity.CRITICAL]
