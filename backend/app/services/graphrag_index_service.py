"""
GraphRAG Index Management Service.

Handles knowledge graph index rebuilding with:
- Background job processing (Celery)
- Progress tracking
- Error recovery
- Performance monitoring
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

import structlog
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.graphrag_index import (
    GraphRAGIndexJob,
    GraphRAGIndexMetrics,
    IndexStatus,
    IndexType,
)

logger = structlog.get_logger()


class GraphRAGIndexService:
    """
    Service for managing GraphRAG index operations.

    Provides:
    - Index rebuild coordination
    - Progress tracking
    - Status reporting
    - Health monitoring
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_rebuild_job(
        self,
        tenant_id: UUID,
        user_id: UUID,
        index_type: IndexType = IndexType.FULL,
        config: dict | None = None,
    ) -> GraphRAGIndexJob:
        """
        Create a new index rebuild job.

        Args:
            tenant_id: Tenant to rebuild index for
            user_id: User who triggered the rebuild
            index_type: Type of rebuild (full, incremental, delta_sync)
            config: Optional configuration overrides

        Returns:
            Created job instance
        """
        # Check if there's already an active job for this tenant
        active_job = await self._get_active_job(tenant_id)
        if active_job:
            logger.warning(
                "index_rebuild_already_running",
                tenant_id=str(tenant_id),
                active_job_id=str(active_job.id),
            )
            raise ValueError(
                f"Index rebuild already running for tenant {tenant_id}. "
                f"Job ID: {active_job.id}"
            )

        # Create job record
        job = GraphRAGIndexJob(
            tenant_id=tenant_id,
            user_id=user_id,
            status=IndexStatus.PENDING,
            index_type=index_type,
            config=config or self._get_default_config(),
        )

        self.db.add(job)
        await self.db.commit()
        await self.db.refresh(job)

        logger.info(
            "index_rebuild_job_created",
            job_id=str(job.id),
            tenant_id=str(tenant_id),
            user_id=str(user_id),
            index_type=index_type.value,
        )

        return job

    async def start_rebuild_job(
        self,
        job_id: UUID,
        celery_task_id: str,
    ) -> None:
        """
        Mark job as started.

        Args:
            job_id: Job ID
            celery_task_id: Celery task ID for tracking
        """
        query = (
            update(GraphRAGIndexJob)
            .where(GraphRAGIndexJob.id == job_id)
            .values(
                status=IndexStatus.RUNNING,
                started_at=datetime.utcnow(),
                celery_task_id=celery_task_id,
            )
        )

        await self.db.execute(query)
        await self.db.commit()

        logger.info(
            "index_rebuild_started",
            job_id=str(job_id),
            celery_task_id=celery_task_id,
        )

    async def update_progress(
        self,
        job_id: UUID,
        processed_entities: int,
        total_entities: int,
        entity_counts: dict | None = None,
    ) -> None:
        """
        Update job progress.

        Args:
            job_id: Job ID
            processed_entities: Number of entities processed
            total_entities: Total entities to process
            entity_counts: Entity counts by type
        """
        update_values = {
            "processed_entities": processed_entities,
            "total_entities": total_entities,
        }

        if entity_counts:
            update_values["entity_counts"] = entity_counts

        query = update(GraphRAGIndexJob).where(GraphRAGIndexJob.id == job_id).values(**update_values)

        await self.db.execute(query)
        await self.db.commit()

        # Calculate progress percentage
        progress = (
            round((processed_entities / total_entities) * 100, 2) if total_entities > 0 else 0.0
        )

        logger.info(
            "index_rebuild_progress",
            job_id=str(job_id),
            processed=processed_entities,
            total=total_entities,
            progress_percent=progress,
        )

    async def complete_rebuild_job(
        self,
        job_id: UUID,
        entity_counts: dict,
        performance_metrics: dict | None = None,
    ) -> None:
        """
        Mark job as completed successfully.

        Args:
            job_id: Job ID
            entity_counts: Final entity counts by type
            performance_metrics: Optional performance metrics
        """
        # Get job to calculate duration
        job = await self._get_job(job_id)
        if not job:
            raise ValueError(f"Job {job_id} not found")

        duration_seconds = None
        entities_per_second = None

        if job.started_at:
            duration_seconds = int((datetime.utcnow() - job.started_at).total_seconds())

            if duration_seconds > 0 and job.total_entities > 0:
                entities_per_second = job.total_entities / duration_seconds

        update_values = {
            "status": IndexStatus.COMPLETED,
            "completed_at": datetime.utcnow(),
            "duration_seconds": duration_seconds,
            "entity_counts": entity_counts,
            "entities_per_second": entities_per_second,
        }

        if performance_metrics:
            if "peak_memory_mb" in performance_metrics:
                update_values["peak_memory_mb"] = performance_metrics["peak_memory_mb"]

        query = update(GraphRAGIndexJob).where(GraphRAGIndexJob.id == job_id).values(**update_values)

        await self.db.execute(query)
        await self.db.commit()

        # Update index metrics
        await self._update_index_metrics(job.tenant_id, job_id)

        logger.info(
            "index_rebuild_completed",
            job_id=str(job_id),
            tenant_id=str(job.tenant_id),
            duration_seconds=duration_seconds,
            entities_per_second=entities_per_second,
        )

    async def fail_rebuild_job(
        self,
        job_id: UUID,
        error_message: str,
        error_trace: str | None = None,
    ) -> None:
        """
        Mark job as failed.

        Args:
            job_id: Job ID
            error_message: Error message
            error_trace: Full error traceback
        """
        # Get job to calculate duration
        job = await self._get_job(job_id)
        if not job:
            raise ValueError(f"Job {job_id} not found")

        duration_seconds = None
        if job.started_at:
            duration_seconds = int((datetime.utcnow() - job.started_at).total_seconds())

        query = (
            update(GraphRAGIndexJob)
            .where(GraphRAGIndexJob.id == job_id)
            .values(
                status=IndexStatus.FAILED,
                completed_at=datetime.utcnow(),
                duration_seconds=duration_seconds,
                error_message=error_message,
                error_trace=error_trace,
                retry_count=GraphRAGIndexJob.retry_count + 1,
            )
        )

        await self.db.execute(query)
        await self.db.commit()

        logger.error(
            "index_rebuild_failed",
            job_id=str(job_id),
            error=error_message,
            duration_seconds=duration_seconds,
        )

    async def cancel_rebuild_job(
        self,
        job_id: UUID,
    ) -> None:
        """
        Cancel a running job.

        Args:
            job_id: Job ID
        """
        query = (
            update(GraphRAGIndexJob)
            .where(GraphRAGIndexJob.id == job_id)
            .values(
                status=IndexStatus.CANCELLED,
                completed_at=datetime.utcnow(),
            )
        )

        await self.db.execute(query)
        await self.db.commit()

        logger.warning("index_rebuild_cancelled", job_id=str(job_id))

    async def get_job_status(
        self,
        job_id: UUID,
    ) -> dict:
        """
        Get detailed job status.

        Args:
            job_id: Job ID

        Returns:
            Job status dict
        """
        job = await self._get_job(job_id)
        if not job:
            raise ValueError(f"Job {job_id} not found")

        return {
            "job_id": str(job.id),
            "tenant_id": str(job.tenant_id),
            "user_id": str(job.user_id) if job.user_id else None,
            "status": job.status.value,
            "index_type": job.index_type.value,
            "progress": {
                "total_entities": job.total_entities,
                "processed_entities": job.processed_entities,
                "failed_entities": job.failed_entities,
                "percentage": job.progress_percentage,
            },
            "entity_counts": job.entity_counts,
            "timing": {
                "created_at": job.created_at.isoformat(),
                "started_at": job.started_at.isoformat() if job.started_at else None,
                "completed_at": job.completed_at.isoformat() if job.completed_at else None,
                "duration_seconds": job.duration_seconds,
            },
            "performance": {
                "entities_per_second": job.entities_per_second,
                "peak_memory_mb": job.peak_memory_mb,
            },
            "error": {
                "message": job.error_message,
                "retry_count": job.retry_count,
            }
            if job.error_message
            else None,
            "celery_task_id": job.celery_task_id,
        }

    async def get_index_metrics(
        self,
        tenant_id: UUID,
    ) -> dict:
        """
        Get current index metrics for tenant.

        Args:
            tenant_id: Tenant ID

        Returns:
            Index metrics dict
        """
        # Get or create metrics
        query = select(GraphRAGIndexMetrics).where(GraphRAGIndexMetrics.tenant_id == tenant_id)
        result = await self.db.execute(query)
        metrics = result.scalar_one_or_none()

        if not metrics:
            # Initialize metrics if they don't exist
            metrics = GraphRAGIndexMetrics(tenant_id=tenant_id)
            self.db.add(metrics)
            await self.db.commit()
            await self.db.refresh(metrics)

        return {
            "tenant_id": str(tenant_id),
            "entities": {
                "total": metrics.total_entities,
                "by_type": metrics.entity_types,
                "orphaned": metrics.orphaned_entities,
                "duplicates": metrics.duplicate_entities,
            },
            "relationships": {
                "total": metrics.total_relationships,
                "by_type": metrics.relationship_types,
            },
            "vectors": {
                "total": metrics.total_vectors,
                "dimension": metrics.vector_dimension,
            },
            "health": {
                "is_healthy": metrics.is_healthy,
                "avg_entity_completeness": metrics.avg_entity_completeness,
            },
            "performance": {
                "avg_query_latency_ms": metrics.avg_query_latency_ms,
                "queries_per_second": metrics.queries_per_second,
            },
            "storage": {
                "neo4j_size_mb": metrics.neo4j_size_mb,
                "qdrant_size_mb": metrics.qdrant_size_mb,
                "graphdb_size_mb": metrics.graphdb_size_mb,
            },
            "last_rebuild": {
                "timestamp": metrics.last_rebuild_at.isoformat() if metrics.last_rebuild_at else None,
                "job_id": str(metrics.last_rebuild_job_id) if metrics.last_rebuild_job_id else None,
            },
            "updated_at": metrics.updated_at.isoformat(),
        }

    async def list_rebuild_jobs(
        self,
        tenant_id: UUID,
        limit: int = 10,
        include_completed: bool = False,
    ) -> list[dict]:
        """
        List rebuild jobs for tenant.

        Args:
            tenant_id: Tenant ID
            limit: Maximum number of jobs to return
            include_completed: Include completed jobs

        Returns:
            List of job status dicts
        """
        query = select(GraphRAGIndexJob).where(GraphRAGIndexJob.tenant_id == tenant_id)

        if not include_completed:
            query = query.where(GraphRAGIndexJob.status.in_([IndexStatus.PENDING, IndexStatus.RUNNING]))

        query = query.order_by(GraphRAGIndexJob.created_at.desc()).limit(limit)

        result = await self.db.execute(query)
        jobs = result.scalars().all()

        return [await self.get_job_status(job.id) for job in jobs]

    # Private helper methods

    async def _get_job(self, job_id: UUID) -> Optional[GraphRAGIndexJob]:
        """Get job by ID."""
        query = select(GraphRAGIndexJob).where(GraphRAGIndexJob.id == job_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def _get_active_job(self, tenant_id: UUID) -> Optional[GraphRAGIndexJob]:
        """Get active job for tenant."""
        query = (
            select(GraphRAGIndexJob)
            .where(
                GraphRAGIndexJob.tenant_id == tenant_id,
                GraphRAGIndexJob.status.in_([IndexStatus.PENDING, IndexStatus.RUNNING]),
            )
            .order_by(GraphRAGIndexJob.created_at.desc())
        )

        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    def _get_default_config(self) -> dict:
        """Get default rebuild configuration."""
        return {
            "batch_size": 1000,
            "parallelism": 4,
            "enable_deduplication": True,
            "enable_quality_checks": True,
            "neo4j_timeout": 60,
            "qdrant_timeout": 30,
        }

    async def _update_index_metrics(
        self,
        tenant_id: UUID,
        job_id: UUID,
    ) -> None:
        """
        Update index metrics after successful rebuild.

        Args:
            tenant_id: Tenant ID
            job_id: Completed job ID
        """
        job = await self._get_job(job_id)
        if not job:
            return

        # Get or create metrics
        query = select(GraphRAGIndexMetrics).where(GraphRAGIndexMetrics.tenant_id == tenant_id)
        result = await self.db.execute(query)
        metrics = result.scalar_one_or_none()

        if not metrics:
            metrics = GraphRAGIndexMetrics(tenant_id=tenant_id)
            self.db.add(metrics)

        # Update from job results
        metrics.total_entities = job.total_entities
        metrics.entity_types = job.entity_counts
        metrics.last_rebuild_at = job.completed_at
        metrics.last_rebuild_job_id = job.id

        await self.db.commit()
