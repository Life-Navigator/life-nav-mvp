"""Plan explanation system for generating human-readable plan justifications.

This module generates comprehensive explanations for agent plans:
- Objective and rationale
- Risk identification
- Fallback strategies
- Data dependencies
- Success criteria

Example usage:
    >>> explainer = PlanExplainer()
    >>> explanation = explainer.explain_plan(task, plan, context)
    >>> markdown = explanation.to_markdown()
"""

import uuid
from typing import Any

from pydantic import BaseModel, Field

from models.agent_models import AgentType
from utils.logging import get_logger

logger = get_logger(__name__)


class PlanExplanation(BaseModel):
    """Human-readable plan explanation.

    Attributes:
        plan_id: Unique plan identifier.
        task_id: Associated task ID.
        agent_type: Type of agent.
        objective: What we're trying to achieve.
        rationale: Why this approach.
        assumptions: What we're assuming.
        constraints: Limitations we're working within.
        subtasks: Task decomposition.
        execution_order: Task IDs in order.
        critical_path: Tasks that cannot fail.
        risks: Identified risks with mitigations.
        fallback_strategies: Recovery strategies.
        required_data: Data sources needed.
        data_quality_requirements: Quality thresholds.
        success_metrics: Success criteria.
        estimated_confidence: Confidence in plan.
        estimated_duration_seconds: Estimated duration.
    """

    plan_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    task_id: str = Field(..., description="Associated task ID")
    agent_type: AgentType = Field(..., description="Agent type")

    # Core explanation
    objective: str = Field(..., description="Plan objective")
    rationale: str = Field(..., description="Why this approach")
    assumptions: list[str] = Field(default_factory=list, description="Assumptions made")
    constraints: list[str] = Field(default_factory=list, description="Constraints")

    # Decomposition
    subtasks: list[dict[str, Any]] = Field(
        default_factory=list, description="Subtask breakdown"
    )
    execution_order: list[str] = Field(
        default_factory=list, description="Execution order"
    )
    critical_path: list[str] = Field(default_factory=list, description="Critical tasks")

    # Risk & fallbacks
    risks: list[dict[str, Any]] = Field(default_factory=list, description="Risks")
    fallback_strategies: list[dict[str, Any]] = Field(
        default_factory=list, description="Fallback strategies"
    )

    # Data dependencies
    required_data: list[str] = Field(
        default_factory=list, description="Required data sources"
    )
    data_quality_requirements: dict[str, Any] = Field(
        default_factory=dict, description="Quality requirements"
    )

    # Success criteria
    success_metrics: list[str] = Field(
        default_factory=list, description="Success metrics"
    )
    estimated_confidence: float = Field(
        ..., ge=0.0, le=1.0, description="Confidence estimate"
    )
    estimated_duration_seconds: float = Field(
        ..., ge=0.0, description="Duration estimate"
    )

    def to_markdown(self) -> str:
        """Format as readable markdown.

        Returns:
            Formatted markdown string.
        """
        md_parts = [
            "# Plan Explanation\n",
            f"**Objective:** {self.objective}\n",
            f"**Rationale:** {self.rationale}\n",
        ]

        if self.subtasks:
            md_parts.append("\n## Approach\n")
            for i, task in enumerate(self.subtasks, 1):
                name = task.get("name", "Unnamed task")
                purpose = task.get("purpose", "No purpose specified")
                md_parts.append(f"{i}. **{name}**: {purpose}")

        if self.assumptions:
            md_parts.append("\n## Assumptions\n")
            for assumption in self.assumptions:
                md_parts.append(f"- {assumption}")

        if self.constraints:
            md_parts.append("\n## Constraints\n")
            for constraint in self.constraints:
                md_parts.append(f"- {constraint}")

        if self.risks:
            md_parts.append("\n## Risks & Mitigations\n")
            for risk in self.risks:
                desc = risk.get("description", "Unknown risk")
                likelihood = risk.get("likelihood", "unknown")
                mitigation = risk.get("mitigation", "No mitigation specified")
                md_parts.append(f"- **{desc}** (likelihood: {likelihood})")
                md_parts.append(f"  - Mitigation: {mitigation}")

        if self.success_metrics:
            md_parts.append("\n## Success Criteria\n")
            for metric in self.success_metrics:
                md_parts.append(f"- {metric}")

        md_parts.append(f"\n**Estimated Confidence:** {self.estimated_confidence:.0%}")
        md_parts.append(
            f"**Estimated Duration:** {self.estimated_duration_seconds:.1f}s"
        )

        return "\n".join(md_parts)


class PlanExplainer:
    """Generates explanations for agent plans.

    This class analyzes agent plans and generates comprehensive,
    human-readable explanations including risks and fallbacks.
    """

    def __init__(self) -> None:
        """Initialize plan explainer."""
        logger.info("PlanExplainer initialized")

    def explain_plan(
        self,
        task_id: str,
        agent_type: AgentType,
        plan: dict[str, Any],
        context: dict[str, Any] | None = None,
    ) -> PlanExplanation:
        """Generate comprehensive plan explanation.

        Args:
            task_id: Task identifier.
            agent_type: Type of agent.
            plan: Plan structure.
            context: Additional context.

        Returns:
            Complete plan explanation.
        """
        if context is None:
            context = {}

        # Extract plan structure
        objective = self._extract_objective(plan)
        rationale = self._generate_rationale(plan, context)
        subtasks = self._extract_subtasks(plan)

        # Identify risks
        risks = self._identify_risks(plan, context)

        # Generate fallback strategies
        fallbacks = self._generate_fallbacks(plan, risks)

        # Analyze data dependencies
        required_data = self._extract_data_dependencies(plan)

        explanation = PlanExplanation(
            task_id=task_id,
            agent_type=agent_type,
            objective=objective,
            rationale=rationale,
            assumptions=self._extract_assumptions(context),
            constraints=self._extract_constraints(plan),
            subtasks=subtasks,
            execution_order=self._determine_execution_order(subtasks),
            critical_path=self._identify_critical_path(subtasks),
            risks=risks,
            fallback_strategies=fallbacks,
            required_data=required_data,
            data_quality_requirements=self._define_quality_requirements(),
            success_metrics=self._define_success_metrics(plan),
            estimated_confidence=self._estimate_confidence(plan, context),
            estimated_duration_seconds=self._estimate_duration(subtasks),
        )

        logger.info(
            f"Generated plan explanation for task {task_id}",
            metadata={
                "plan_id": explanation.plan_id,
                "subtask_count": len(subtasks),
                "risk_count": len(risks),
            },
        )

        return explanation

    def _extract_objective(self, plan: dict[str, Any]) -> str:
        """Extract plan objective.

        Args:
            plan: Plan structure.

        Returns:
            Objective description.
        """
        objective = plan.get("objective", "Complete assigned task")
        return str(objective)

    def _generate_rationale(self, plan: dict[str, Any], context: dict[str, Any]) -> str:
        """Generate rationale for plan.

        Args:
            plan: Plan structure.
            context: Additional context.

        Returns:
            Rationale description.
        """
        # Simple heuristic-based rationale
        # In production, this would use LLM
        subtask_count = len(plan.get("subtasks", []))

        if subtask_count == 0:
            return "Direct execution without decomposition is most efficient."
        elif subtask_count <= 3:
            return "Task decomposed into manageable subtasks for parallel execution."
        else:
            return (
                f"Complex task requiring {subtask_count} subtasks to ensure "
                "comprehensive analysis and accurate results."
            )

    def _extract_subtasks(self, plan: dict[str, Any]) -> list[dict[str, Any]]:
        """Extract subtask list.

        Args:
            plan: Plan structure.

        Returns:
            List of subtasks.
        """
        subtasks = plan.get("subtasks", [])
        if not isinstance(subtasks, list):
            return []
        return subtasks

    def _extract_assumptions(self, context: dict[str, Any]) -> list[str]:
        """Extract assumptions from context.

        Args:
            context: Context dictionary.

        Returns:
            List of assumptions.
        """
        assumptions = []

        if context.get("has_financial_data"):
            assumptions.append("User's financial data is current and accurate")

        if context.get("has_recent_transactions"):
            assumptions.append(
                "Recent transactions are representative of normal spending"
            )

        if not assumptions:
            assumptions.append("Sufficient data available for analysis")

        return assumptions

    def _extract_constraints(self, plan: dict[str, Any]) -> list[str]:
        """Extract constraints from plan.

        Args:
            plan: Plan structure.

        Returns:
            List of constraints.
        """
        constraints = []

        if plan.get("deadline"):
            constraints.append("Must complete before deadline")

        if plan.get("priority", 0) >= 8:
            constraints.append("High priority - optimize for speed")

        if plan.get("max_cost"):
            constraints.append(f"Budget limit: ${plan.get('max_cost')}")

        return constraints

    def _identify_risks(
        self, plan: dict[str, Any], context: dict[str, Any]
    ) -> list[dict[str, Any]]:
        """Identify potential risks in plan execution.

        Args:
            plan: Plan structure.
            context: Additional context.

        Returns:
            List of identified risks.
        """
        risks = []

        # Check for data quality risks
        if not context.get("has_recent_transactions"):
            risks.append(
                {
                    "description": "Limited transaction history",
                    "mitigation": "Use estimated averages from similar users",
                    "likelihood": "medium",
                }
            )

        # Check for external dependency risks
        if plan.get("requires_external_api"):
            risks.append(
                {
                    "description": "External API failures",
                    "mitigation": "Implement retry logic with exponential backoff",
                    "likelihood": "low",
                }
            )

        # Check for computation complexity
        subtask_count = len(plan.get("subtasks", []))
        if subtask_count > 5:
            risks.append(
                {
                    "description": f"Complex plan with {subtask_count} subtasks may timeout",
                    "mitigation": "Break into multiple user interactions if needed",
                    "likelihood": "medium",
                }
            )

        return risks

    def _generate_fallbacks(
        self, plan: dict[str, Any], risks: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """Generate fallback strategies for identified risks.

        Args:
            plan: Plan structure.
            risks: Identified risks.

        Returns:
            List of fallback strategies.
        """
        fallbacks = []

        for risk in risks:
            description = risk["description"].lower()

            if "data" in description or "transaction" in description:
                fallbacks.append(
                    {
                        "trigger": "Missing required data",
                        "action": "Use industry averages or request user input",
                    }
                )
            elif "api" in description:
                fallbacks.append(
                    {
                        "trigger": "External API failure",
                        "action": "Switch to cached data or alternative API",
                    }
                )
            elif "timeout" in description or "complex" in description:
                fallbacks.append(
                    {
                        "trigger": "Execution exceeds time limit",
                        "action": "Return partial results and queue remaining work",
                    }
                )

        return fallbacks

    def _determine_execution_order(self, subtasks: list[dict[str, Any]]) -> list[str]:
        """Determine execution order for subtasks.

        Args:
            subtasks: List of subtasks.

        Returns:
            List of task IDs in execution order.
        """
        # Simple ordering - in production would do topological sort
        return [str(i) for i in range(len(subtasks))]

    def _identify_critical_path(self, subtasks: list[dict[str, Any]]) -> list[str]:
        """Identify critical path tasks.

        Args:
            subtasks: List of subtasks.

        Returns:
            List of critical task IDs.
        """
        # Identify tasks that have dependents
        critical = []
        for i, task in enumerate(subtasks):
            if task.get("has_dependents", False):
                critical.append(str(i))

        return critical

    def _extract_data_dependencies(self, plan: dict[str, Any]) -> list[str]:
        """Extract data dependencies from plan.

        Args:
            plan: Plan structure.

        Returns:
            List of required data sources.
        """
        deps = set()

        for task in plan.get("subtasks", []):
            sources = task.get("data_sources", [])
            deps.update(sources)

        if plan.get("requires_user_data"):
            deps.add("user_profile")

        return list(deps)

    def _define_quality_requirements(self) -> dict[str, Any]:
        """Define data quality requirements.

        Returns:
            Dictionary of quality requirements.
        """
        return {
            "transaction_data": "Last 90 days required",
            "account_balance": "Real-time or < 24 hours old",
            "user_profile": "Complete profile with goals",
        }

    def _define_success_metrics(self, plan: dict[str, Any]) -> list[str]:
        """Define success metrics for plan.

        Args:
            plan: Plan structure.

        Returns:
            List of success metrics.
        """
        metrics = [
            "All subtasks completed successfully",
            "Results validated against business rules",
        ]

        if plan.get("has_time_limit"):
            metrics.append("Response time within acceptable threshold")

        return metrics

    def _estimate_confidence(
        self, plan: dict[str, Any], context: dict[str, Any]
    ) -> float:
        """Estimate confidence in plan success.

        Args:
            plan: Plan structure.
            context: Additional context.

        Returns:
            Confidence score (0.0-1.0).
        """
        base_confidence = 0.8

        # Adjust based on data quality
        if not context.get("has_recent_transactions"):
            base_confidence -= 0.2

        # Adjust based on plan complexity
        subtask_count = len(plan.get("subtasks", []))
        if subtask_count > 5:
            base_confidence -= 0.1

        # Adjust based on external dependencies
        if plan.get("requires_external_api"):
            base_confidence -= 0.1

        return max(0.3, min(1.0, base_confidence))

    def _estimate_duration(self, subtasks: list[dict[str, Any]]) -> float:
        """Estimate plan duration.

        Args:
            subtasks: List of subtasks.

        Returns:
            Estimated duration in seconds.
        """
        if not subtasks:
            return 2.0

        # Base time per subtask
        base_time = 2.0
        return base_time * len(subtasks)
