"""Audit trail system for immutable, queryable event logging.

This module provides comprehensive audit logging:
- Immutable event recording
- Queryable audit trails
- Compliance reporting
- Event correlation

Example usage:
    >>> audit = AuditTrail()
    >>> await audit.record_event(AuditEvent(...))
    >>> events = await audit.query_events(user_id="user-123")
"""

import uuid
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field

from models.agent_models import AgentType
from utils.logging import get_logger

logger = get_logger(__name__)


class AuditEventType(str, Enum):
    """Types of audit events.

    Attributes:
        AGENT_CREATED: Agent was created.
        AGENT_STARTED: Agent started processing.
        AGENT_STOPPED: Agent stopped.
        TASK_RECEIVED: Task was received.
        TASK_STARTED: Task processing started.
        TASK_COMPLETED: Task completed successfully.
        TASK_FAILED: Task failed.
        QUERY_EXECUTED: Database query executed.
        DATA_ACCESSED: Data was accessed.
        DECISION_MADE: Decision was made.
        ERROR_OCCURRED: Error occurred.
        RECOVERY_ATTEMPTED: Recovery attempted.
        USER_NOTIFIED: User was notified.
    """

    AGENT_CREATED = "agent.created"
    AGENT_STARTED = "agent.started"
    AGENT_STOPPED = "agent.stopped"
    TASK_RECEIVED = "task.received"
    TASK_STARTED = "task.started"
    TASK_COMPLETED = "task.completed"
    TASK_FAILED = "task.failed"
    QUERY_EXECUTED = "query.executed"
    DATA_ACCESSED = "data.accessed"
    DECISION_MADE = "decision.made"
    ERROR_OCCURRED = "error.occurred"
    RECOVERY_ATTEMPTED = "recovery.attempted"
    USER_NOTIFIED = "user.notified"


class AuditEvent(BaseModel):
    """Single immutable audit event.

    Attributes:
        event_id: Unique event identifier.
        event_type: Type of event.
        timestamp: Event timestamp.
        user_id: User identifier.
        agent_id: Agent identifier.
        agent_type: Agent type.
        task_id: Task identifier (optional).
        correlation_id: Correlation ID.
        description: Event description.
        details: Event details.
        data_sources: Data sources accessed.
        parent_event_id: Parent event ID.
        ip_address: Client IP address.
        user_agent: Client user agent.
        session_id: Session identifier.
        contains_pii: Contains PII flag.
        contains_phi: Contains PHI flag.
        compliance_tags: Compliance tags.
    """

    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_type: AuditEventType = Field(..., description="Event type")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), description="Timestamp"
    )

    # Identity
    user_id: str = Field(..., description="User ID")
    agent_id: str = Field(..., description="Agent ID")
    agent_type: AgentType = Field(..., description="Agent type")
    task_id: str | None = Field(default=None, description="Task ID")
    correlation_id: str = Field(..., description="Correlation ID")

    # Event details
    description: str = Field(..., description="Event description")
    details: dict[str, Any] = Field(default_factory=dict, description="Event details")

    # Provenance
    data_sources: list[str] = Field(default_factory=list, description="Data sources")
    parent_event_id: str | None = Field(default=None, description="Parent event ID")

    # Context
    ip_address: str | None = Field(default=None, description="IP address")
    user_agent: str | None = Field(default=None, description="User agent")
    session_id: str | None = Field(default=None, description="Session ID")

    # Compliance
    contains_pii: bool = Field(default=False, description="Contains PII")
    contains_phi: bool = Field(default=False, description="Contains PHI")
    compliance_tags: list[str] = Field(
        default_factory=list, description="Compliance tags"
    )

    def to_log_entry(self) -> dict[str, Any]:
        """Convert to structured log entry.

        Returns:
            Dictionary for logging.
        """
        return {
            "event_id": self.event_id,
            "event_type": self.event_type.value,
            "timestamp": self.timestamp.isoformat(),
            "user_id": self.user_id,
            "agent_id": self.agent_id,
            "agent_type": self.agent_type.value,
            "task_id": self.task_id,
            "description": self.description,
            "details": self.details,
        }


class AuditTrail:
    """Manages audit event storage and querying.

    This class provides buffered event storage and comprehensive
    querying capabilities for audit trails.
    """

    def __init__(self) -> None:
        """Initialize audit trail."""
        self._event_buffer: list[AuditEvent] = []
        self._buffer_size = 100
        self._events_storage: list[AuditEvent] = []  # In-memory for now
        logger.info("AuditTrail initialized")

    async def record_event(self, event: AuditEvent) -> None:
        """Record audit event (immutable).

        Args:
            event: Audit event to record.
        """
        # Add to buffer
        self._event_buffer.append(event)

        # Also log immediately for real-time monitoring
        logger.info(f"Audit: {event.event_type.value}", metadata=event.to_log_entry())

        # Flush buffer if full
        if len(self._event_buffer) >= self._buffer_size:
            await self._flush_buffer()

    async def _flush_buffer(self) -> None:
        """Flush event buffer to storage."""
        if not self._event_buffer:
            return

        events_to_insert = self._event_buffer.copy()
        self._event_buffer.clear()

        # Store events (in-memory for now, would be database in production)
        self._events_storage.extend(events_to_insert)

        logger.debug(f"Flushed {len(events_to_insert)} audit events to storage")

    async def query_events(
        self,
        user_id: str | None = None,
        agent_type: AgentType | None = None,
        event_type: AuditEventType | None = None,
        task_id: str | None = None,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        limit: int = 100,
    ) -> list[AuditEvent]:
        """Query audit events with filters.

        Args:
            user_id: User ID filter.
            agent_type: Agent type filter.
            event_type: Event type filter.
            task_id: Task ID filter.
            start_time: Start time filter.
            end_time: End time filter.
            limit: Maximum results.

        Returns:
            List of matching audit events.
        """
        # Ensure buffer is flushed
        await self._flush_buffer()

        # Filter events
        results = self._events_storage.copy()

        if user_id:
            results = [e for e in results if e.user_id == user_id]

        if agent_type:
            results = [e for e in results if e.agent_type == agent_type]

        if event_type:
            results = [e for e in results if e.event_type == event_type]

        if task_id:
            results = [e for e in results if e.task_id == task_id]

        if start_time:
            results = [e for e in results if e.timestamp >= start_time]

        if end_time:
            results = [e for e in results if e.timestamp <= end_time]

        # Sort by timestamp descending
        results.sort(key=lambda e: e.timestamp, reverse=True)

        return results[:limit]

    async def get_task_timeline(self, task_id: str) -> list[AuditEvent]:
        """Get complete audit trail for a task.

        Args:
            task_id: Task identifier.

        Returns:
            List of events for task.
        """
        return await self.query_events(task_id=task_id, limit=1000)

    async def get_user_activity(
        self, user_id: str, hours: int = 24
    ) -> list[AuditEvent]:
        """Get recent activity for a user.

        Args:
            user_id: User identifier.
            hours: Hours of history.

        Returns:
            List of recent events.
        """
        start_time = datetime.now(timezone.utc) - timedelta(hours=hours)
        return await self.query_events(
            user_id=user_id, start_time=start_time, limit=1000
        )

    async def generate_compliance_report(
        self, user_id: str, start_date: datetime, end_date: datetime
    ) -> dict[str, Any]:
        """Generate compliance audit report.

        Args:
            user_id: User identifier.
            start_date: Report start date.
            end_date: Report end date.

        Returns:
            Compliance report dictionary.
        """
        events = await self.query_events(
            user_id=user_id, start_time=start_date, end_time=end_date, limit=10000
        )

        # Count event types
        event_type_counts = {}
        for event_type in AuditEventType:
            count = sum(1 for e in events if e.event_type == event_type)
            if count > 0:
                event_type_counts[event_type.value] = count

        # Count agent usage
        agent_usage = {}
        for agent_type in AgentType:
            count = sum(1 for e in events if e.agent_type == agent_type)
            if count > 0:
                agent_usage[agent_type.value] = count

        report = {
            "user_id": user_id,
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
            },
            "summary": {
                "total_events": len(events),
                "tasks_completed": sum(
                    1 for e in events if e.event_type == AuditEventType.TASK_COMPLETED
                ),
                "tasks_failed": sum(
                    1 for e in events if e.event_type == AuditEventType.TASK_FAILED
                ),
                "errors_occurred": sum(
                    1 for e in events if e.event_type == AuditEventType.ERROR_OCCURRED
                ),
                "data_accesses": sum(
                    1 for e in events if e.event_type == AuditEventType.DATA_ACCESSED
                ),
            },
            "compliance_flags": {
                "pii_accessed": sum(1 for e in events if e.contains_pii),
                "phi_accessed": sum(1 for e in events if e.contains_phi),
                "hipaa_events": sum(1 for e in events if "HIPAA" in e.compliance_tags),
                "pci_events": sum(1 for e in events if "PCI" in e.compliance_tags),
            },
            "event_types": event_type_counts,
            "agent_usage": agent_usage,
        }

        logger.info(
            f"Generated compliance report for user {user_id}",
            metadata={"total_events": len(events)},
        )

        return report
