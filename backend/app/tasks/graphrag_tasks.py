"""
Celery tasks for GraphRAG index management.

Background tasks for:
- Full index rebuilds
- Incremental updates
- Delta synchronization
- Metrics collection
"""

import asyncio
import traceback
from datetime import datetime
from typing import Any
from uuid import UUID

import structlog
from celery import Task
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.celery_app import celery_app
from app.core.config import settings
from app.models.graphrag_index import IndexType
from app.services.graphrag_index_service import GraphRAGIndexService
from app.services.graphrag_rebuild_service import GraphRAGRebuildService

logger = structlog.get_logger()


def get_async_session() -> AsyncSession:
    """Create async database session for tasks."""
    engine = create_async_engine(
        str(settings.DATABASE_URL),
        echo=False,
        pool_pre_ping=True,
    )

    async_session = sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    return async_session()


class CallbackTask(Task):
    """
    Base task with callbacks for progress tracking.

    Provides hooks for:
    - Task started
    - Progress updates
    - Task completed
    - Task failed
    """

    def on_success(self, retval, task_id, args, kwargs):
        """Called when task succeeds."""
        logger.info(
            "celery_task_succeeded",
            task_id=task_id,
            task_name=self.name,
            return_value=retval,
        )

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Called when task fails."""
        logger.error(
            "celery_task_failed",
            task_id=task_id,
            task_name=self.name,
            error=str(exc),
            traceback=str(einfo),
        )

    def on_retry(self, exc, task_id, args, kwargs, einfo):
        """Called when task is retried."""
        logger.warning(
            "celery_task_retrying",
            task_id=task_id,
            task_name=self.name,
            error=str(exc),
        )


@celery_app.task(
    bind=True,
    base=CallbackTask,
    name="graphrag.rebuild_index",
    max_retries=3,
    default_retry_delay=60,
)
def rebuild_index_task(
    self,
    job_id: str,
    tenant_id: str,
    index_type: str = "full",
) -> dict[str, Any]:
    """
    Background task to rebuild GraphRAG index.

    Args:
        job_id: Job ID for tracking
        tenant_id: Tenant ID to rebuild
        index_type: Type of rebuild (full, incremental, delta_sync)

    Returns:
        Result dict with statistics
    """

    async def _rebuild():
        """Async rebuild implementation."""
        async with get_async_session() as db:
            index_service = GraphRAGIndexService(db)
            rebuild_service = GraphRAGRebuildService(db)

            try:
                # Mark job as started
                await index_service.start_rebuild_job(
                    job_id=UUID(job_id),
                    celery_task_id=self.request.id,
                )

                logger.info(
                    "index_rebuild_started",
                    job_id=job_id,
                    tenant_id=tenant_id,
                    index_type=index_type,
                    celery_task_id=self.request.id,
                )

                # Execute rebuild based on type
                if index_type == IndexType.FULL.value:
                    result = await rebuild_service.rebuild_full_index(
                        tenant_id=UUID(tenant_id),
                        job_id=UUID(job_id),
                        progress_callback=lambda processed, total, counts: asyncio.create_task(
                            index_service.update_progress(
                                job_id=UUID(job_id),
                                processed_entities=processed,
                                total_entities=total,
                                entity_counts=counts,
                            )
                        ),
                    )
                elif index_type == IndexType.INCREMENTAL.value:
                    result = await rebuild_service.rebuild_incremental(
                        tenant_id=UUID(tenant_id),
                        job_id=UUID(job_id),
                    )
                elif index_type == IndexType.DELTA_SYNC.value:
                    result = await rebuild_service.sync_delta(
                        tenant_id=UUID(tenant_id),
                        job_id=UUID(job_id),
                    )
                else:
                    raise ValueError(f"Unknown index type: {index_type}")

                # Mark job as completed
                await index_service.complete_rebuild_job(
                    job_id=UUID(job_id),
                    entity_counts=result["entity_counts"],
                    performance_metrics=result.get("performance_metrics"),
                )

                logger.info(
                    "index_rebuild_completed",
                    job_id=job_id,
                    tenant_id=tenant_id,
                    result=result,
                )

                return result

            except Exception as e:
                error_trace = traceback.format_exc()

                logger.error(
                    "index_rebuild_error",
                    job_id=job_id,
                    tenant_id=tenant_id,
                    error=str(e),
                    traceback=error_trace,
                )

                # Mark job as failed
                await index_service.fail_rebuild_job(
                    job_id=UUID(job_id),
                    error_message=str(e),
                    error_trace=error_trace,
                )

                # Retry if not at max retries
                if self.request.retries < self.max_retries:
                    raise self.retry(exc=e)

                raise

    # Run async code
    return asyncio.run(_rebuild())


@celery_app.task(
    name="graphrag.update_metrics",
    max_retries=2,
)
def update_index_metrics_task(tenant_id: str) -> dict[str, Any]:
    """
    Background task to update index metrics.

    Collects statistics from:
    - Neo4j (entity and relationship counts)
    - Qdrant (vector counts and size)
    - GraphDB (triple counts and size)

    Args:
        tenant_id: Tenant ID

    Returns:
        Updated metrics dict
    """

    async def _update_metrics():
        """Async metrics update implementation."""
        async with get_async_session() as db:
            rebuild_service = GraphRAGRebuildService(db)

            try:
                logger.info(
                    "index_metrics_update_started",
                    tenant_id=tenant_id,
                )

                # Collect metrics from all sources
                metrics = await rebuild_service.collect_index_metrics(
                    tenant_id=UUID(tenant_id),
                )

                logger.info(
                    "index_metrics_updated",
                    tenant_id=tenant_id,
                    metrics=metrics,
                )

                return metrics

            except Exception as e:
                logger.error(
                    "index_metrics_update_failed",
                    tenant_id=tenant_id,
                    error=str(e),
                )
                raise

    return asyncio.run(_update_metrics())


@celery_app.task(
    name="graphrag.cleanup_old_jobs",
    max_retries=1,
)
def cleanup_old_jobs_task(days: int = 30) -> dict[str, int]:
    """
    Background task to clean up old completed jobs.

    Args:
        days: Delete jobs older than this many days

    Returns:
        Cleanup statistics
    """

    async def _cleanup():
        """Async cleanup implementation."""
        from datetime import timedelta

        from sqlalchemy import delete

        from app.models.graphrag_index import GraphRAGIndexJob, IndexStatus

        async with get_async_session() as db:
            cutoff_date = datetime.utcnow() - timedelta(days=days)

            # Delete old completed/failed jobs
            delete_query = delete(GraphRAGIndexJob).where(
                GraphRAGIndexJob.status.in_(
                    [IndexStatus.COMPLETED, IndexStatus.FAILED, IndexStatus.CANCELLED]
                ),
                GraphRAGIndexJob.completed_at < cutoff_date,
            )

            result = await db.execute(delete_query)
            deleted_count = result.rowcount

            await db.commit()

            logger.info(
                "old_jobs_cleaned_up",
                deleted_count=deleted_count,
                cutoff_days=days,
            )

            return {
                "deleted_jobs": deleted_count,
                "cutoff_date": cutoff_date.isoformat(),
            }

    return asyncio.run(_cleanup())


@celery_app.task(
    name="graphrag.detect_duplicates",
    max_retries=2,
)
def detect_duplicate_entities_task(tenant_id: str) -> dict[str, Any]:
    """
    Background task to detect duplicate entities in the knowledge graph.

    Uses fuzzy matching and vector similarity to identify potential duplicates.

    Args:
        tenant_id: Tenant ID

    Returns:
        Duplicate detection results
    """

    async def _detect_duplicates():
        """Async duplicate detection implementation."""
        async with get_async_session() as db:
            rebuild_service = GraphRAGRebuildService(db)

            try:
                logger.info(
                    "duplicate_detection_started",
                    tenant_id=tenant_id,
                )

                # Run duplicate detection
                duplicates = await rebuild_service.detect_duplicates(
                    tenant_id=UUID(tenant_id),
                )

                logger.info(
                    "duplicate_detection_completed",
                    tenant_id=tenant_id,
                    duplicate_count=len(duplicates),
                )

                return {
                    "tenant_id": tenant_id,
                    "duplicates": duplicates,
                    "total_duplicates": len(duplicates),
                }

            except Exception as e:
                logger.error(
                    "duplicate_detection_failed",
                    tenant_id=tenant_id,
                    error=str(e),
                )
                raise

    return asyncio.run(_detect_duplicates())


@celery_app.task(
    name="graphrag.validate_index_quality",
    max_retries=1,
)
def validate_index_quality_task(tenant_id: str) -> dict[str, Any]:
    """
    Background task to validate index quality.

    Checks for:
    - Orphaned entities (no relationships)
    - Incomplete entities (missing required properties)
    - Broken relationships (missing targets)
    - Vector-entity mismatches

    Args:
        tenant_id: Tenant ID

    Returns:
        Quality validation results
    """

    async def _validate_quality():
        """Async quality validation implementation."""
        async with get_async_session() as db:
            rebuild_service = GraphRAGRebuildService(db)

            try:
                logger.info(
                    "quality_validation_started",
                    tenant_id=tenant_id,
                )

                # Run quality checks
                quality_report = await rebuild_service.validate_quality(
                    tenant_id=UUID(tenant_id),
                )

                logger.info(
                    "quality_validation_completed",
                    tenant_id=tenant_id,
                    quality_score=quality_report.get("overall_score"),
                )

                return quality_report

            except Exception as e:
                logger.error(
                    "quality_validation_failed",
                    tenant_id=tenant_id,
                    error=str(e),
                )
                raise

    return asyncio.run(_validate_quality())
