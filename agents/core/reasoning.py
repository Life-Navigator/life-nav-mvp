"""Reasoning engine for capturing and structuring agent thought processes.

This module provides transparent reasoning chains that explain every decision:
- Step-by-step thought process capture
- Confidence score tracking
- Data provenance linking
- Human-readable summaries

Example usage:
    >>> engine = ReasoningEngine()
    >>> chain = engine.start_chain("task-123", AgentType.SPECIALIST)
    >>> engine.add_observation(chain.chain_id, "User has $5000 in savings", ["account-data"])
    >>> engine.add_thought(chain.chain_id, "Sufficient emergency fund", confidence=0.9)
    >>> summary = chain.get_summary()
"""

import statistics
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field

from models.agent_models import AgentType
from utils.logging import get_logger

logger = get_logger(__name__)


class ReasoningStepType(str, Enum):
    """Types of reasoning steps in agent decision process.

    Attributes:
        OBSERVATION: Input data analysis.
        THOUGHT: Internal reasoning.
        PLAN: Action planning.
        ACTION: Execution step.
        RESULT: Outcome observation.
        REFLECTION: Self-evaluation.
        CORRECTION: Error recovery.
    """

    OBSERVATION = "observation"
    THOUGHT = "thought"
    PLAN = "plan"
    ACTION = "action"
    RESULT = "result"
    REFLECTION = "reflection"
    CORRECTION = "correction"


class ReasoningStep(BaseModel):
    """Single step in agent reasoning process.

    Attributes:
        step_id: Unique step identifier.
        step_type: Type of reasoning step.
        timestamp: When step occurred.
        content: Human-readable explanation.
        structured_data: Machine-readable data.
        confidence_score: Confidence in this step (0.0-1.0).
        data_sources: IDs of source data used.
        parent_step_id: Parent step for nested reasoning.
        metadata: Additional step metadata.
    """

    step_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    step_type: ReasoningStepType
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), description="Step timestamp"
    )
    content: str = Field(..., description="Human-readable explanation")
    structured_data: dict[str, Any] = Field(
        default_factory=dict, description="Machine-readable data"
    )
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Confidence score")
    data_sources: list[str] = Field(default_factory=list, description="Source data IDs")
    parent_step_id: str | None = Field(
        default=None, description="Parent step for nesting"
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )

    def to_human_readable(self) -> str:
        """Format step for user presentation.

        Returns:
            Formatted string with emoji and description.
        """
        emoji_map = {
            ReasoningStepType.OBSERVATION: "👁️",
            ReasoningStepType.THOUGHT: "💭",
            ReasoningStepType.PLAN: "📋",
            ReasoningStepType.ACTION: "⚡",
            ReasoningStepType.RESULT: "✅",
            ReasoningStepType.REFLECTION: "🤔",
            ReasoningStepType.CORRECTION: "🔧",
        }
        emoji = emoji_map.get(self.step_type, "•")
        return f"{emoji} **{self.step_type.value.title()}**: {self.content}"


class ReasoningChain(BaseModel):
    """Complete reasoning process for a task.

    Attributes:
        chain_id: Unique chain identifier.
        task_id: Associated task ID.
        agent_type: Type of agent.
        steps: List of reasoning steps.
        started_at: Chain start time.
        completed_at: Chain completion time.
        status: Current status.
    """

    chain_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    task_id: str = Field(..., description="Associated task ID")
    agent_type: AgentType = Field(..., description="Agent type")
    steps: list[ReasoningStep] = Field(
        default_factory=list, description="Reasoning steps"
    )
    started_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), description="Start time"
    )
    completed_at: datetime | None = Field(default=None, description="Completion time")
    status: str = Field(default="in_progress", description="Chain status")

    def add_step(self, step: ReasoningStep) -> None:
        """Add reasoning step with validation.

        Args:
            step: Reasoning step to add.
        """
        self.steps.append(step)
        logger.debug(
            f"Added reasoning step: {step.step_type}",
            metadata={"chain_id": self.chain_id, "step_id": step.step_id},
        )

    def get_summary(self) -> str:
        """Generate human-readable summary of reasoning.

        Returns:
            Multi-line summary of all steps.
        """
        if not self.steps:
            return "No reasoning steps recorded."

        summary_parts = [
            f"# Reasoning Chain: {self.chain_id}\n",
            f"**Task ID:** {self.task_id}",
            f"**Agent Type:** {self.agent_type.value}",
            f"**Status:** {self.status}\n",
        ]

        for i, step in enumerate(self.steps, 1):
            summary_parts.append(f"{i}. {step.to_human_readable()}")

        return "\n".join(summary_parts)

    def get_confidence_trajectory(self) -> list[float]:
        """Track confidence scores over time.

        Returns:
            List of confidence scores in order.
        """
        return [step.confidence_score for step in self.steps]

    def get_data_provenance(self) -> dict[str, int]:
        """Count usage of each data source.

        Returns:
            Dictionary mapping source ID to usage count.
        """
        sources: dict[str, int] = {}
        for step in self.steps:
            for source in step.data_sources:
                sources[source] = sources.get(source, 0) + 1
        return sources


class ReasoningEngine:
    """Manages reasoning chain creation and analysis.

    This engine tracks agent decision-making processes in real-time,
    providing transparency and explainability for all agent actions.
    """

    def __init__(self) -> None:
        """Initialize reasoning engine."""
        self._active_chains: dict[str, ReasoningChain] = {}
        logger.info("ReasoningEngine initialized")

    def start_chain(self, task_id: str, agent_type: AgentType) -> ReasoningChain:
        """Initialize new reasoning chain for task.

        Args:
            task_id: Task identifier.
            agent_type: Type of agent.

        Returns:
            New reasoning chain.
        """
        chain = ReasoningChain(task_id=task_id, agent_type=agent_type)
        self._active_chains[chain.chain_id] = chain

        logger.info(
            f"Started reasoning chain for task {task_id}",
            metadata={
                "chain_id": chain.chain_id,
                "agent_type": agent_type.value,
            },
        )

        return chain

    def add_observation(
        self,
        chain_id: str,
        observation: str,
        data_sources: list[str],
        confidence: float = 1.0,
    ) -> ReasoningStep:
        """Record an observation (input analysis).

        Args:
            chain_id: Chain identifier.
            observation: Observation description.
            data_sources: Source data IDs.
            confidence: Confidence score.

        Returns:
            Created reasoning step.
        """
        chain = self._active_chains[chain_id]
        step = ReasoningStep(
            step_type=ReasoningStepType.OBSERVATION,
            content=observation,
            data_sources=data_sources,
            confidence_score=confidence,
        )
        chain.add_step(step)
        return step

    def add_thought(
        self,
        chain_id: str,
        thought: str,
        confidence: float = 0.8,
        parent_step_id: str | None = None,
    ) -> ReasoningStep:
        """Record internal reasoning.

        Args:
            chain_id: Chain identifier.
            thought: Thought description.
            confidence: Confidence score.
            parent_step_id: Parent step for nested reasoning.

        Returns:
            Created reasoning step.
        """
        chain = self._active_chains[chain_id]
        step = ReasoningStep(
            step_type=ReasoningStepType.THOUGHT,
            content=thought,
            confidence_score=confidence,
            parent_step_id=parent_step_id,
        )
        chain.add_step(step)
        return step

    def add_plan(
        self,
        chain_id: str,
        plan: str,
        structured_plan: dict[str, Any],
        justification: str,
    ) -> ReasoningStep:
        """Record action plan with justification.

        Args:
            chain_id: Chain identifier.
            plan: Plan description.
            structured_plan: Machine-readable plan.
            justification: Why this plan.

        Returns:
            Created reasoning step.
        """
        chain = self._active_chains[chain_id]
        step = ReasoningStep(
            step_type=ReasoningStepType.PLAN,
            content=f"{plan}\n\n**Justification:** {justification}",
            structured_data=structured_plan,
            confidence_score=0.9,
        )
        chain.add_step(step)
        return step

    def add_action(
        self, chain_id: str, action: str, action_details: dict[str, Any]
    ) -> ReasoningStep:
        """Record action execution.

        Args:
            chain_id: Chain identifier.
            action: Action description.
            action_details: Action parameters.

        Returns:
            Created reasoning step.
        """
        chain = self._active_chains[chain_id]
        step = ReasoningStep(
            step_type=ReasoningStepType.ACTION,
            content=action,
            structured_data=action_details,
            confidence_score=1.0,
        )
        chain.add_step(step)
        return step

    def add_result(
        self,
        chain_id: str,
        result: str,
        success: bool,
        result_data: dict[str, Any],
    ) -> ReasoningStep:
        """Record action result.

        Args:
            chain_id: Chain identifier.
            result: Result description.
            success: Whether action succeeded.
            result_data: Result details.

        Returns:
            Created reasoning step.
        """
        chain = self._active_chains[chain_id]
        step = ReasoningStep(
            step_type=ReasoningStepType.RESULT,
            content=result,
            structured_data={"success": success, **result_data},
            confidence_score=1.0 if success else 0.3,
        )
        chain.add_step(step)
        return step

    def add_reflection(
        self, chain_id: str, reflection: str, should_retry: bool = False
    ) -> ReasoningStep:
        """Record self-evaluation of results.

        Args:
            chain_id: Chain identifier.
            reflection: Reflection description.
            should_retry: Whether to retry.

        Returns:
            Created reasoning step.
        """
        chain = self._active_chains[chain_id]
        step = ReasoningStep(
            step_type=ReasoningStepType.REFLECTION,
            content=reflection,
            structured_data={"should_retry": should_retry},
            confidence_score=0.7,
        )
        chain.add_step(step)
        return step

    def add_correction(
        self, chain_id: str, correction: str, fallback_strategy: str
    ) -> ReasoningStep:
        """Record error correction attempt.

        Args:
            chain_id: Chain identifier.
            correction: Correction description.
            fallback_strategy: Fallback approach.

        Returns:
            Created reasoning step.
        """
        chain = self._active_chains[chain_id]
        step = ReasoningStep(
            step_type=ReasoningStepType.CORRECTION,
            content=f"{correction}\n\n**Fallback:** {fallback_strategy}",
            structured_data={"fallback_strategy": fallback_strategy},
            confidence_score=0.6,
        )
        chain.add_step(step)
        return step

    def complete_chain(
        self, chain_id: str, status: str = "completed"
    ) -> ReasoningChain:
        """Mark chain as complete and return for storage.

        Args:
            chain_id: Chain identifier.
            status: Final status.

        Returns:
            Completed reasoning chain.
        """
        chain = self._active_chains.pop(chain_id)
        chain.completed_at = datetime.now(timezone.utc)
        chain.status = status

        logger.info(
            f"Completed reasoning chain: {status}",
            metadata={
                "chain_id": chain_id,
                "total_steps": len(chain.steps),
                "status": status,
            },
        )

        return chain

    def analyze_chain(self, chain: ReasoningChain) -> dict[str, Any]:
        """Analyze reasoning quality metrics.

        Args:
            chain: Reasoning chain to analyze.

        Returns:
            Dictionary of analysis metrics.
        """
        if not chain.steps:
            return {
                "total_steps": 0,
                "error": "No steps in chain",
            }

        step_type_counts = {
            step_type.value: sum(1 for s in chain.steps if s.step_type == step_type)
            for step_type in ReasoningStepType
        }

        confidence_trajectory = chain.get_confidence_trajectory()
        avg_confidence = statistics.mean(confidence_trajectory)

        return {
            "total_steps": len(chain.steps),
            "step_type_counts": step_type_counts,
            "avg_confidence": avg_confidence,
            "confidence_trend": (
                "increasing"
                if self._is_increasing(confidence_trajectory)
                else "decreasing"
            ),
            "data_sources_used": len(chain.get_data_provenance()),
            "corrections_needed": sum(
                1 for s in chain.steps if s.step_type == ReasoningStepType.CORRECTION
            ),
        }

    @staticmethod
    def _is_increasing(trajectory: list[float]) -> bool:
        """Check if confidence is trending upward.

        Args:
            trajectory: List of confidence scores.

        Returns:
            True if trending upward.
        """
        if len(trajectory) < 2:
            return True
        return trajectory[-1] >= trajectory[0]
