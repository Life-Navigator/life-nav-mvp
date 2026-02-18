"""
Compliance Validator Service

Validates AI responses against regulatory knowledge graph.
Implements the block -> reassess -> rewrite flow for compliance.

Flow:
1. Query comes in
2. Retrieve context from personal graph (user data)
3. LLM generates response
4. Validate response against central knowledge graph (regulations)
5. If violation detected:
   a. LOG the violation for review
   b. BLOCK the original response
   c. REASSESS with compliance context
   d. REWRITE to comply with regulations
6. Return compliant response

Categories:
- Financial: IRS, SEC, FINRA, state laws
- Medical: HIPAA, state medical privacy
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
import uuid

from utils.logging import get_logger

logger = get_logger(__name__)


class ComplianceSeverity(Enum):
    """Severity levels for compliance violations"""
    INFO = "info"           # Informational only, log but don't block
    WARNING = "warning"     # Log and include disclaimer
    BLOCK = "block"         # Must block and rewrite


class ComplianceCategory(Enum):
    """Categories of compliance rules"""
    FINANCIAL_TAX = "financial_tax"         # IRS, tax laws
    FINANCIAL_INVESTMENT = "financial_investment"  # SEC, FINRA
    FINANCIAL_BANKING = "financial_banking"  # Banking regulations
    MEDICAL_HIPAA = "medical_hipaa"         # HIPAA privacy
    MEDICAL_STATE = "medical_state"         # State medical privacy
    GENERAL = "general"                     # General compliance


@dataclass
class ComplianceViolation:
    """Represents a detected compliance violation"""
    violation_id: str
    rule_id: str
    rule_title: str
    category: ComplianceCategory
    severity: ComplianceSeverity
    description: str
    original_content: str
    regulation_id: str
    regulation_title: str
    source: str  # e.g., "IRS", "SEC", "HHS"
    required_action: str
    detected_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ComplianceResult:
    """Result of compliance validation"""
    is_compliant: bool
    violations: List[ComplianceViolation]
    original_response: str
    compliant_response: Optional[str]  # Rewritten response if violations found
    validation_log_id: str
    processing_time_ms: float
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ValidationLog:
    """Log entry for compliance validation (for review)"""
    log_id: str
    user_id: str
    query: str
    original_response: str
    is_compliant: bool
    violations: List[Dict[str, Any]]
    compliant_response: Optional[str]
    action_taken: str  # "passed", "logged", "blocked_and_rewritten"
    created_at: datetime = field(default_factory=datetime.utcnow)
    reviewed: bool = False
    reviewer_id: Optional[str] = None
    review_notes: Optional[str] = None


class ComplianceValidator:
    """
    Validates AI responses against regulatory compliance rules.

    Architecture:
    - Fetches applicable rules from Neo4j central graph
    - Uses Qdrant for semantic similarity search against regulations
    - Logs all validations for human review
    - Blocks and rewrites non-compliant responses

    Example:
        >>> validator = ComplianceValidator(neo4j_client, qdrant_client)
        >>> result = await validator.validate_response(
        ...     user_id="user123",
        ...     query="What's the best investment strategy?",
        ...     response="Put all your money in this penny stock!",
        ...     categories=[ComplianceCategory.FINANCIAL_INVESTMENT]
        ... )
        >>> if not result.is_compliant:
        ...     print(f"Violations: {result.violations}")
        ...     print(f"Compliant response: {result.compliant_response}")
    """

    def __init__(
        self,
        neo4j_client,
        qdrant_client,
        embedding_model=None,
        llm_client=None
    ):
        """
        Initialize compliance validator.

        Args:
            neo4j_client: Neo4jClient for central knowledge graph
            qdrant_client: QdrantVectorClient for semantic search
            embedding_model: Model for generating embeddings
            llm_client: LLM client for rewriting responses
        """
        self.neo4j = neo4j_client
        self.qdrant = qdrant_client
        self.embedding_model = embedding_model
        self.llm_client = llm_client

        # In-memory log storage (should be backed by database in production)
        self._validation_logs: Dict[str, ValidationLog] = {}

        # Compliance keywords for quick filtering
        self._financial_keywords = [
            "invest", "stock", "bond", "retirement", "401k", "ira",
            "tax", "deduction", "income", "capital gains", "dividend",
            "financial advice", "trading", "portfolio", "asset allocation",
            "wealth management", "fiduciary", "securities"
        ]

        self._medical_keywords = [
            "health", "medical", "diagnosis", "treatment", "medication",
            "prescription", "doctor", "hospital", "patient", "phi",
            "health insurance", "hipaa", "medical records", "symptoms"
        ]

        logger.info("ComplianceValidator initialized")

    async def validate_response(
        self,
        user_id: str,
        query: str,
        response: str,
        categories: Optional[List[ComplianceCategory]] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> ComplianceResult:
        """
        Validate an AI response against compliance rules.

        Args:
            user_id: User identifier
            query: Original user query
            response: AI-generated response to validate
            categories: Compliance categories to check (auto-detected if None)
            context: Additional context (e.g., user profile, conversation history)

        Returns:
            ComplianceResult with validation outcome
        """
        import time
        start_time = time.time()

        # Auto-detect categories if not provided
        if categories is None:
            categories = self._detect_categories(query, response)

        # Skip validation if no relevant categories
        if not categories:
            log_id = self._create_validation_log(
                user_id=user_id,
                query=query,
                original_response=response,
                is_compliant=True,
                violations=[],
                compliant_response=None,
                action_taken="passed"
            )

            processing_time = (time.time() - start_time) * 1000
            return ComplianceResult(
                is_compliant=True,
                violations=[],
                original_response=response,
                compliant_response=None,
                validation_log_id=log_id,
                processing_time_ms=processing_time
            )

        # Fetch applicable rules from Neo4j
        violations = await self._check_rules(query, response, categories)

        # Check for semantic violations using Qdrant
        semantic_violations = await self._check_semantic_violations(
            query, response, categories
        )
        violations.extend(semantic_violations)

        # Determine if response is compliant
        is_compliant = len(violations) == 0
        blocking_violations = [v for v in violations if v.severity == ComplianceSeverity.BLOCK]

        compliant_response = None
        action_taken = "passed"

        if blocking_violations:
            # BLOCK and REWRITE
            compliant_response = await self._rewrite_response(
                query, response, blocking_violations, context
            )
            action_taken = "blocked_and_rewritten"
        elif violations:
            # Log but don't block
            action_taken = "logged"

        # Create validation log
        log_id = self._create_validation_log(
            user_id=user_id,
            query=query,
            original_response=response,
            is_compliant=is_compliant,
            violations=[self._violation_to_dict(v) for v in violations],
            compliant_response=compliant_response,
            action_taken=action_taken
        )

        processing_time = (time.time() - start_time) * 1000

        logger.info(
            "Compliance validation completed",
            extra={
                "user_id": user_id,
                "is_compliant": is_compliant,
                "violation_count": len(violations),
                "action": action_taken,
                "processing_time_ms": processing_time
            }
        )

        return ComplianceResult(
            is_compliant=is_compliant,
            violations=violations,
            original_response=response,
            compliant_response=compliant_response,
            validation_log_id=log_id,
            processing_time_ms=processing_time,
            metadata={"categories": [c.value for c in categories]}
        )

    def _detect_categories(
        self,
        query: str,
        response: str
    ) -> List[ComplianceCategory]:
        """
        Auto-detect compliance categories from content.

        Args:
            query: User query
            response: AI response

        Returns:
            List of detected categories
        """
        categories = []
        combined = f"{query} {response}".lower()

        # Check financial keywords
        if any(kw in combined for kw in self._financial_keywords):
            if any(kw in combined for kw in ["tax", "irs", "deduction", "income"]):
                categories.append(ComplianceCategory.FINANCIAL_TAX)
            if any(kw in combined for kw in ["invest", "stock", "portfolio", "securities"]):
                categories.append(ComplianceCategory.FINANCIAL_INVESTMENT)
            if any(kw in combined for kw in ["bank", "loan", "credit"]):
                categories.append(ComplianceCategory.FINANCIAL_BANKING)

        # Check medical keywords
        if any(kw in combined for kw in self._medical_keywords):
            categories.append(ComplianceCategory.MEDICAL_HIPAA)

        return list(set(categories))

    async def _check_rules(
        self,
        query: str,
        response: str,
        categories: List[ComplianceCategory]
    ) -> List[ComplianceViolation]:
        """
        Check response against rules in the central knowledge graph.

        Args:
            query: User query
            response: AI response
            categories: Categories to check

        Returns:
            List of detected violations
        """
        violations = []

        # Map categories to regulation types
        category_to_type = {
            ComplianceCategory.FINANCIAL_TAX: "tax_law",
            ComplianceCategory.FINANCIAL_INVESTMENT: "sec_rule",
            ComplianceCategory.FINANCIAL_BANKING: "banking_regulation",
            ComplianceCategory.MEDICAL_HIPAA: "hipaa",
            ComplianceCategory.MEDICAL_STATE: "state_medical"
        }

        for category in categories:
            regulation_type = category_to_type.get(category)
            if not regulation_type:
                continue

            # Fetch rules from Neo4j
            rules = await self.neo4j.get_applicable_rules(
                regulation_type=regulation_type
            )

            for rule in rules:
                # Check if any conditions are triggered
                violation = self._check_rule_conditions(
                    rule, query, response, category
                )
                if violation:
                    violations.append(violation)

        return violations

    def _check_rule_conditions(
        self,
        rule: Dict[str, Any],
        query: str,
        response: str,
        category: ComplianceCategory
    ) -> Optional[ComplianceViolation]:
        """
        Check if a specific rule's conditions are violated.

        Args:
            rule: Rule from Neo4j
            query: User query
            response: AI response
            category: Compliance category

        Returns:
            ComplianceViolation if violated, None otherwise
        """
        combined = f"{query} {response}".lower()
        conditions = rule.get("conditions", [])

        # Check if any condition keyword is present
        triggered = False
        for condition in conditions:
            if isinstance(condition, str) and condition.lower() in combined:
                triggered = True
                break

        if not triggered:
            return None

        # Determine severity
        severity_map = {
            "info": ComplianceSeverity.INFO,
            "warning": ComplianceSeverity.WARNING,
            "block": ComplianceSeverity.BLOCK
        }
        severity = severity_map.get(rule.get("severity", "warning"), ComplianceSeverity.WARNING)

        return ComplianceViolation(
            violation_id=str(uuid.uuid4()),
            rule_id=rule["rule_id"],
            rule_title=rule["title"],
            category=category,
            severity=severity,
            description=rule["description"],
            original_content=response[:500],  # Truncate for logging
            regulation_id=rule["regulation_id"],
            regulation_title=rule["regulation_title"],
            source=rule["source"],
            required_action=", ".join(rule.get("actions", ["Review response"]))
        )

    async def _check_semantic_violations(
        self,
        query: str,
        response: str,
        categories: List[ComplianceCategory]
    ) -> List[ComplianceViolation]:
        """
        Check for semantic violations using vector similarity.

        Args:
            query: User query
            response: AI response
            categories: Categories to check

        Returns:
            List of semantic violations
        """
        violations = []

        if not self.embedding_model:
            return violations

        # Generate embedding for the response
        response_embedding = await self.embedding_model.encode(response)

        # Map categories to Qdrant filter values
        category_to_source = {
            ComplianceCategory.FINANCIAL_TAX: "IRS",
            ComplianceCategory.FINANCIAL_INVESTMENT: "SEC",
            ComplianceCategory.FINANCIAL_BANKING: "FDIC",
            ComplianceCategory.MEDICAL_HIPAA: "HHS"
        }

        for category in categories:
            source = category_to_source.get(category)
            if not source:
                continue

            # Search for similar regulatory content
            results = await self.qdrant.search_central_knowledge(
                query_embedding=response_embedding.tolist(),
                source=source,
                limit=5,
                score_threshold=0.8  # High threshold for semantic match
            )

            # Check if any high-similarity matches indicate violation
            for result in results:
                if result["score"] > 0.85:
                    # Very high similarity to regulatory content might indicate
                    # the response is making unauthorized claims
                    violations.append(ComplianceViolation(
                        violation_id=str(uuid.uuid4()),
                        rule_id=result.get("rule_id", "semantic_match"),
                        rule_title="Semantic Compliance Match",
                        category=category,
                        severity=ComplianceSeverity.WARNING,
                        description=f"Response closely matches regulatory content: {result['chunk_text'][:200]}",
                        original_content=response[:500],
                        regulation_id=result.get("regulation_id", "unknown"),
                        regulation_title="Semantic Match",
                        source=source,
                        required_action="Review for unauthorized advice or claims"
                    ))

        return violations

    async def _rewrite_response(
        self,
        query: str,
        original_response: str,
        violations: List[ComplianceViolation],
        context: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Rewrite response to be compliant.

        Args:
            query: Original query
            original_response: Non-compliant response
            violations: Detected violations
            context: Additional context

        Returns:
            Compliant rewritten response
        """
        if not self.llm_client:
            # Fallback: Return generic compliant response
            return self._generate_fallback_response(violations)

        # Build compliance prompt
        violation_context = "\n".join([
            f"- {v.rule_title}: {v.description} (Source: {v.source})"
            for v in violations
        ])

        prompt = f"""You are a compliance-aware AI assistant. The following response was flagged for compliance violations:

ORIGINAL QUERY: {query}

ORIGINAL RESPONSE: {original_response}

COMPLIANCE VIOLATIONS DETECTED:
{violation_context}

Please rewrite the response to be fully compliant while still being helpful. Requirements:
1. Do not provide specific financial or medical advice
2. Include appropriate disclaimers
3. Recommend consulting licensed professionals
4. Maintain helpful and informative tone
5. Address the user's underlying need

COMPLIANT RESPONSE:"""

        try:
            compliant_response = await self.llm_client.generate(prompt)
            return compliant_response
        except Exception as e:
            logger.error(f"Failed to rewrite response: {e}")
            return self._generate_fallback_response(violations)

    def _generate_fallback_response(
        self,
        violations: List[ComplianceViolation]
    ) -> str:
        """
        Generate fallback compliant response when LLM is unavailable.

        Args:
            violations: Detected violations

        Returns:
            Generic compliant response
        """
        categories = set(v.category for v in violations)

        disclaimers = []

        if any(c.value.startswith("financial") for c in categories):
            disclaimers.append(
                "I cannot provide specific financial advice. "
                "Please consult with a licensed financial advisor, CPA, or tax professional "
                "for personalized guidance based on your specific situation."
            )

        if any(c.value.startswith("medical") for c in categories):
            disclaimers.append(
                "I cannot provide medical advice or diagnoses. "
                "Please consult with a licensed healthcare provider "
                "for medical guidance specific to your situation."
            )

        return (
            "I'd like to help, but I need to be careful about providing information "
            "in this area due to regulatory requirements.\n\n"
            + "\n\n".join(disclaimers) +
            "\n\nIs there a different way I can assist you with general information?"
        )

    def _create_validation_log(
        self,
        user_id: str,
        query: str,
        original_response: str,
        is_compliant: bool,
        violations: List[Dict[str, Any]],
        compliant_response: Optional[str],
        action_taken: str
    ) -> str:
        """
        Create a validation log entry for review.

        Args:
            user_id: User identifier
            query: Original query
            original_response: Original response
            is_compliant: Compliance status
            violations: List of violations
            compliant_response: Rewritten response
            action_taken: Action taken

        Returns:
            Log ID
        """
        log_id = str(uuid.uuid4())

        log_entry = ValidationLog(
            log_id=log_id,
            user_id=user_id,
            query=query,
            original_response=original_response,
            is_compliant=is_compliant,
            violations=violations,
            compliant_response=compliant_response,
            action_taken=action_taken
        )

        self._validation_logs[log_id] = log_entry

        logger.debug(f"Validation log created: {log_id}")
        return log_id

    def _violation_to_dict(self, violation: ComplianceViolation) -> Dict[str, Any]:
        """Convert violation to dictionary for logging"""
        return {
            "violation_id": violation.violation_id,
            "rule_id": violation.rule_id,
            "rule_title": violation.rule_title,
            "category": violation.category.value,
            "severity": violation.severity.value,
            "description": violation.description,
            "regulation_id": violation.regulation_id,
            "source": violation.source,
            "required_action": violation.required_action,
            "detected_at": violation.detected_at.isoformat()
        }

    # =========================================================================
    # Review Interface
    # =========================================================================

    async def get_pending_reviews(
        self,
        limit: int = 50
    ) -> List[ValidationLog]:
        """
        Get validation logs pending human review.

        Args:
            limit: Maximum logs to return

        Returns:
            List of unreviewed validation logs
        """
        pending = [
            log for log in self._validation_logs.values()
            if not log.reviewed and log.action_taken != "passed"
        ]

        # Sort by creation time (newest first)
        pending.sort(key=lambda x: x.created_at, reverse=True)

        return pending[:limit]

    async def mark_reviewed(
        self,
        log_id: str,
        reviewer_id: str,
        notes: Optional[str] = None
    ) -> bool:
        """
        Mark a validation log as reviewed.

        Args:
            log_id: Validation log ID
            reviewer_id: ID of reviewer
            notes: Optional review notes

        Returns:
            True if marked, False if not found
        """
        if log_id not in self._validation_logs:
            return False

        log = self._validation_logs[log_id]
        log.reviewed = True
        log.reviewer_id = reviewer_id
        log.review_notes = notes

        logger.info(f"Validation log {log_id} marked as reviewed by {reviewer_id}")
        return True

    async def get_validation_stats(self) -> Dict[str, Any]:
        """
        Get validation statistics.

        Returns:
            Dictionary with validation stats
        """
        logs = list(self._validation_logs.values())

        return {
            "total_validations": len(logs),
            "compliant": len([log for log in logs if log.is_compliant]),
            "non_compliant": len([log for log in logs if not log.is_compliant]),
            "pending_review": len([log for log in logs if not log.reviewed and log.action_taken != "passed"]),
            "reviewed": len([log for log in logs if log.reviewed]),
            "actions": {
                "passed": len([log for log in logs if log.action_taken == "passed"]),
                "logged": len([log for log in logs if log.action_taken == "logged"]),
                "blocked_and_rewritten": len([log for log in logs if log.action_taken == "blocked_and_rewritten"])
            }
        }


# Factory function
async def create_compliance_validator(
    neo4j_client=None,
    qdrant_client=None,
    embedding_model=None,
    llm_client=None
) -> ComplianceValidator:
    """
    Create a configured ComplianceValidator instance.

    Args:
        neo4j_client: Neo4j client (uses global if None)
        qdrant_client: Qdrant client (uses global if None)
        embedding_model: Embedding model
        llm_client: LLM client

    Returns:
        Configured ComplianceValidator
    """
    from graphrag.neo4j_client import get_neo4j_client
    from graphrag.qdrant_client import get_qdrant_client

    if neo4j_client is None:
        neo4j_client = await get_neo4j_client()

    if qdrant_client is None:
        qdrant_client = await get_qdrant_client()

    return ComplianceValidator(
        neo4j_client=neo4j_client,
        qdrant_client=qdrant_client,
        embedding_model=embedding_model,
        llm_client=llm_client
    )
