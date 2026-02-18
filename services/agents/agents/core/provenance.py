"""Decision provenance tracking for data lineage.

This module tracks data sources influencing every decision:
- Source tracking
- Data transformations
- Confidence scoring
- Citation generation

Example usage:
    >>> tracker = ProvenanceTracker()
    >>> decision_id = tracker.start_decision("task-123", AgentType.SPECIALIST, "Calculate budget")
    >>> tracker.add_data_source(decision_id, DataSource(...))
    >>> provenance = tracker.finalize_decision(decision_id, result, 0.85)
"""

import statistics
import uuid
from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field

from models.agent_models import AgentType
from utils.logging import get_logger

logger = get_logger(__name__)


class DataSource(BaseModel):
    """Single data source used in decision.

    Attributes:
        source_id: Unique source identifier.
        source_type: Type of source.
        source_name: Human-readable name.
        data_excerpt: Brief data excerpt.
        confidence: Confidence in source.
        timestamp: Source timestamp.
    """

    source_id: str = Field(..., description="Source ID")
    source_type: str = Field(
        ...,
        description="Source type (transaction, account, goal, document, external_api)",
    )
    source_name: str = Field(..., description="Source name")
    data_excerpt: str | None = Field(default=None, description="Brief data excerpt")
    confidence: float = Field(
        default=1.0, ge=0.0, le=1.0, description="Source confidence"
    )
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), description="Timestamp"
    )


class DecisionProvenance(BaseModel):
    """Complete provenance for a decision.

    Attributes:
        decision_id: Unique decision identifier.
        task_id: Associated task ID.
        agent_type: Agent type.
        decision_description: Decision description.
        decision_output: Decision output.
        primary_sources: Primary data sources.
        secondary_sources: Secondary data sources.
        transformations: Data transformations applied.
        calculations: Calculations performed.
        data_quality_score: Overall data quality.
        confidence_score: Decision confidence.
        timestamp: Decision timestamp.
        reasoning_chain_id: Associated reasoning chain.
    """

    decision_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    task_id: str = Field(..., description="Task ID")
    agent_type: AgentType = Field(..., description="Agent type")

    # Decision details
    decision_description: str = Field(..., description="Decision description")
    decision_output: dict[str, Any] = Field(
        default_factory=dict, description="Decision output"
    )

    # Data lineage
    primary_sources: list[DataSource] = Field(
        default_factory=list, description="Primary sources"
    )
    secondary_sources: list[DataSource] = Field(
        default_factory=list, description="Secondary sources"
    )

    # Processing
    transformations: list[str] = Field(
        default_factory=list, description="Transformations"
    )
    calculations: list[dict[str, Any]] = Field(
        default_factory=list, description="Calculations"
    )

    # Quality
    data_quality_score: float = Field(
        default=0.0, ge=0.0, le=1.0, description="Data quality"
    )
    confidence_score: float = Field(
        default=0.0, ge=0.0, le=1.0, description="Confidence"
    )

    # Metadata
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), description="Timestamp"
    )
    reasoning_chain_id: str | None = Field(
        default=None, description="Reasoning chain ID"
    )

    def to_citation(self) -> str:
        """Generate citation text for user presentation.

        Returns:
            Citation string.
        """
        primary_count = len(self.primary_sources)

        if primary_count == 0:
            return "No data sources cited. Confidence: 0%"

        sources_text = f"Based on {primary_count} primary data source"
        if primary_count > 1:
            sources_text += "s"

        if self.primary_sources:
            source_types = set(s.source_type for s in self.primary_sources)
            sources_text += f" ({', '.join(sorted(source_types))})"

        return f"{sources_text}. Confidence: {self.confidence_score:.0%}"


class ProvenanceTracker:
    """Tracks data provenance for decisions.

    This tracker maintains a record of all data sources and
    transformations used in agent decision-making.
    """

    def __init__(self) -> None:
        """Initialize provenance tracker."""
        self._active_decisions: dict[str, DecisionProvenance] = {}
        logger.info("ProvenanceTracker initialized")

    def start_decision(
        self, task_id: str, agent_type: AgentType, description: str
    ) -> str:
        """Start tracking a new decision.

        Args:
            task_id: Task identifier.
            agent_type: Agent type.
            description: Decision description.

        Returns:
            Decision ID.
        """
        provenance = DecisionProvenance(
            task_id=task_id,
            agent_type=agent_type,
            decision_description=description,
            decision_output={},
        )
        self._active_decisions[provenance.decision_id] = provenance

        logger.debug(
            f"Started decision tracking: {description}",
            metadata={"decision_id": provenance.decision_id, "task_id": task_id},
        )

        return provenance.decision_id

    def add_data_source(
        self, decision_id: str, source: DataSource, primary: bool = True
    ) -> None:
        """Add data source to decision provenance.

        Args:
            decision_id: Decision identifier.
            source: Data source.
            primary: Whether source is primary.
        """
        provenance = self._active_decisions[decision_id]

        if primary:
            provenance.primary_sources.append(source)
        else:
            provenance.secondary_sources.append(source)

        logger.debug(
            f"Added {'primary' if primary else 'secondary'} source: {source.source_name}",
            metadata={"decision_id": decision_id, "source_type": source.source_type},
        )

    def add_transformation(self, decision_id: str, transformation: str) -> None:
        """Record data transformation step.

        Args:
            decision_id: Decision identifier.
            transformation: Transformation description.
        """
        provenance = self._active_decisions[decision_id]
        provenance.transformations.append(transformation)

        logger.debug(
            f"Added transformation: {transformation}",
            metadata={"decision_id": decision_id},
        )

    def add_calculation(self, decision_id: str, calculation: dict[str, Any]) -> None:
        """Record calculation performed.

        Args:
            decision_id: Decision identifier.
            calculation: Calculation details.
        """
        provenance = self._active_decisions[decision_id]
        provenance.calculations.append(calculation)

        logger.debug(
            "Added calculation",
            metadata={
                "decision_id": decision_id,
                "calculation_type": calculation.get("type"),
            },
        )

    def finalize_decision(
        self, decision_id: str, output: dict[str, Any], confidence: float
    ) -> DecisionProvenance:
        """Finalize decision and calculate quality scores.

        Args:
            decision_id: Decision identifier.
            output: Decision output.
            confidence: Confidence score.

        Returns:
            Finalized decision provenance.
        """
        provenance = self._active_decisions.pop(decision_id)
        provenance.decision_output = output
        provenance.confidence_score = confidence

        # Calculate data quality score
        if provenance.primary_sources:
            avg_source_confidence = statistics.mean(
                [s.confidence for s in provenance.primary_sources]
            )
            provenance.data_quality_score = avg_source_confidence
        else:
            provenance.data_quality_score = 0.0

        logger.info(
            "Finalized decision provenance",
            metadata={
                "decision_id": decision_id,
                "primary_sources": len(provenance.primary_sources),
                "confidence": confidence,
                "data_quality": provenance.data_quality_score,
            },
        )

        return provenance

    def generate_citation_list(self, decision_id: str) -> list[str]:
        """Generate formatted citation list for user.

        Args:
            decision_id: Decision identifier.

        Returns:
            List of formatted citations.
        """
        provenance = self._active_decisions.get(decision_id)
        if not provenance:
            return []

        citations = []
        for i, source in enumerate(provenance.primary_sources, 1):
            citations.append(
                f"[{i}] {source.source_name} ({source.source_type}) - "
                f"{source.timestamp.strftime('%Y-%m-%d')}"
            )

        return citations
