"""
GraphRAG Index Status Models.

Tracks the status of knowledge graph index rebuilds for monitoring and observability.
"""

from datetime import datetime
from enum import Enum as PyEnum
from uuid import UUID

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin, UUIDMixin


class IndexStatus(str, PyEnum):
    """Index rebuild job status."""

    PENDING = "pending"  # Queued but not started
    RUNNING = "running"  # Currently building
    COMPLETED = "completed"  # Successfully completed
    FAILED = "failed"  # Failed with error
    CANCELLED = "cancelled"  # Manually cancelled


class IndexType(str, PyEnum):
    """Type of index being built."""

    FULL = "full"  # Complete rebuild from scratch
    INCREMENTAL = "incremental"  # Delta updates only
    DELTA_SYNC = "delta_sync"  # Sync specific changes


class GraphRAGIndexJob(UUIDMixin, TimestampMixin, Base):
    """
    GraphRAG index rebuild job tracking.

    Stores metadata about index rebuild operations for:
    - Progress tracking
    - Error recovery
    - Performance analytics
    - Audit logging
    """

    __tablename__ = "graphrag_index_jobs"

    # Tenant & user context
    tenant_id: Mapped[UUID] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Tenant this index belongs to",
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="User who triggered the rebuild",
    )

    # Job metadata
    status: Mapped[IndexStatus] = mapped_column(
        Enum(IndexStatus),
        default=IndexStatus.PENDING,
        nullable=False,
        index=True,
        comment="Current status of index job",
    )
    index_type: Mapped[IndexType] = mapped_column(
        Enum(IndexType),
        default=IndexType.FULL,
        nullable=False,
        comment="Type of indexing operation",
    )

    # Progress tracking
    total_entities: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Total entities to process",
    )
    processed_entities: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Entities processed so far",
    )
    failed_entities: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Entities that failed processing",
    )

    # Entity type breakdown
    entity_counts: Mapped[dict] = mapped_column(
        JSONB,
        default=dict,
        server_default="{}",
        comment="Entity counts by type (ln:Goal: 100, ln:Transaction: 500, etc.)",
    )

    # Timing information
    started_at: Mapped[datetime | None] = mapped_column(
        comment="When processing actually started",
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        comment="When processing finished",
    )
    duration_seconds: Mapped[int | None] = mapped_column(
        Integer,
        comment="Total processing duration",
    )

    # Error tracking
    error_message: Mapped[str | None] = mapped_column(
        Text,
        comment="Error message if failed",
    )
    error_trace: Mapped[str | None] = mapped_column(
        Text,
        comment="Full error traceback",
    )
    retry_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Number of retry attempts",
    )

    # Celery task tracking
    celery_task_id: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        index=True,
        comment="Celery task ID for status lookup",
    )

    # Performance metrics
    entities_per_second: Mapped[float | None] = mapped_column(
        comment="Average processing throughput",
    )
    peak_memory_mb: Mapped[int | None] = mapped_column(
        Integer,
        comment="Peak memory usage during rebuild",
    )

    # Configuration
    config: Mapped[dict] = mapped_column(
        JSONB,
        default=dict,
        server_default="{}",
        comment="Index rebuild configuration (batch_size, parallelism, etc.)",
    )

    # Additional metadata
    metadata_: Mapped[dict] = mapped_column(
        "metadata",
        JSONB,
        default=dict,
        server_default="{}",
        comment="Additional metadata",
    )

    # Relationships (forward references for models defined in other files)
    # tenant: Mapped["Tenant"] = relationship()  # Uncomment when Tenant model is available
    # user: Mapped["User"] = relationship()  # Uncomment when User model is available

    @property
    def progress_percentage(self) -> float:
        """Calculate progress percentage (0-100)."""
        if self.total_entities == 0:
            return 0.0
        return round((self.processed_entities / self.total_entities) * 100, 2)

    @property
    def is_active(self) -> bool:
        """Check if job is currently running."""
        return self.status in (IndexStatus.PENDING, IndexStatus.RUNNING)

    @property
    def is_terminal(self) -> bool:
        """Check if job is in terminal state (done/failed/cancelled)."""
        return self.status in (IndexStatus.COMPLETED, IndexStatus.FAILED, IndexStatus.CANCELLED)


class GraphRAGIndexMetrics(UUIDMixin, TimestampMixin, Base):
    """
    Real-time metrics for knowledge graph index.

    Updated continuously to provide current state of the index.
    Used by status endpoints to show index health.
    """

    __tablename__ = "graphrag_index_metrics"

    # Tenant context
    tenant_id: Mapped[UUID] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
        comment="Tenant this index belongs to",
    )

    # Entity statistics
    total_entities: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Total entities in index",
    )
    entity_types: Mapped[dict] = mapped_column(
        JSONB,
        default=dict,
        server_default="{}",
        comment="Entity counts by type",
    )

    # Relationship statistics
    total_relationships: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Total relationships in graph",
    )
    relationship_types: Mapped[dict] = mapped_column(
        JSONB,
        default=dict,
        server_default="{}",
        comment="Relationship counts by type",
    )

    # Vector index statistics
    total_vectors: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Total vectors in Qdrant",
    )
    vector_dimension: Mapped[int] = mapped_column(
        Integer,
        default=1536,  # OpenAI ada-002 dimension
        nullable=False,
        comment="Vector embedding dimension",
    )

    # Index health
    last_rebuild_at: Mapped[datetime | None] = mapped_column(
        comment="Timestamp of last successful rebuild",
    )
    last_rebuild_job_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("graphrag_index_jobs.id"),
        comment="Reference to last rebuild job",
    )
    is_healthy: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        comment="Overall index health status",
    )

    # Quality metrics
    avg_entity_completeness: Mapped[float | None] = mapped_column(
        comment="Average percentage of filled properties per entity",
    )
    orphaned_entities: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Entities with no relationships",
    )
    duplicate_entities: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Potential duplicate entities detected",
    )

    # Performance metrics
    avg_query_latency_ms: Mapped[int | None] = mapped_column(
        Integer,
        comment="Average query latency",
    )
    queries_per_second: Mapped[float | None] = mapped_column(
        comment="Current query throughput",
    )

    # Storage metrics
    neo4j_size_mb: Mapped[int | None] = mapped_column(
        Integer,
        comment="Neo4j database size",
    )
    qdrant_size_mb: Mapped[int | None] = mapped_column(
        Integer,
        comment="Qdrant index size",
    )
    graphdb_size_mb: Mapped[int | None] = mapped_column(
        Integer,
        comment="GraphDB repository size",
    )

    # Metadata
    metadata_: Mapped[dict] = mapped_column(
        "metadata",
        JSONB,
        default=dict,
        server_default="{}",
        comment="Additional metrics",
    )

    # Relationships (forward references for models defined in other files)
    # tenant: Mapped["Tenant"] = relationship()  # Uncomment when Tenant model is available
    last_rebuild_job: Mapped["GraphRAGIndexJob"] = relationship()
