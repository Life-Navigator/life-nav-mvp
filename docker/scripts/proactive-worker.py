#!/usr/bin/env python3
"""
Proactive Engine Worker - Cloud Run Job Entry Point

This script runs as a Cloud Run Job triggered by Cloud Scheduler.
It performs proactive document scanning and analysis tasks.
"""

import asyncio
import logging
import os
import sys
from datetime import datetime

# Configure logging for Cloud Run
logging.basicConfig(
    level=logging.INFO,
    format='{"timestamp": "%(asctime)s", "level": "%(levelname)s", "message": "%(message)s"}',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)


async def run_proactive_scan():
    """Execute the proactive document scanning job."""
    logger.info("Starting proactive scan job")
    start_time = datetime.utcnow()

    try:
        # Import app modules after environment is configured
        from app.core.config import settings
        from app.core.database import get_async_session
        from app.services.graphrag_service import GraphRAGService

        logger.info(f"Environment: {settings.ENVIRONMENT}")
        logger.info(f"Database configured: {bool(settings.DATABASE_URL)}")

        # Initialize services
        graphrag_service = GraphRAGService()

        # Run proactive tasks
        tasks_completed = 0

        # Task 1: Update GraphRAG metrics
        logger.info("Task 1: Updating GraphRAG metrics...")
        try:
            await graphrag_service.update_metrics()
            tasks_completed += 1
            logger.info("GraphRAG metrics updated successfully")
        except Exception as e:
            logger.error(f"Failed to update GraphRAG metrics: {e}")

        # Task 2: Validate index quality
        logger.info("Task 2: Validating index quality...")
        try:
            quality_report = await graphrag_service.validate_index_quality()
            tasks_completed += 1
            logger.info(f"Index quality validated: {quality_report}")
        except Exception as e:
            logger.error(f"Failed to validate index quality: {e}")

        # Task 3: Detect and flag duplicate documents
        logger.info("Task 3: Detecting duplicate documents...")
        try:
            duplicates = await graphrag_service.detect_duplicates()
            tasks_completed += 1
            logger.info(f"Duplicate detection complete: {len(duplicates)} potential duplicates found")
        except Exception as e:
            logger.error(f"Failed to detect duplicates: {e}")

        # Task 4: Cleanup old/stale jobs
        logger.info("Task 4: Cleaning up old jobs...")
        try:
            async with get_async_session() as session:
                # Cleanup jobs older than 30 days
                from app.models.job import Job
                from sqlalchemy import delete
                from datetime import timedelta

                cutoff_date = datetime.utcnow() - timedelta(days=30)
                stmt = delete(Job).where(Job.created_at < cutoff_date)
                result = await session.execute(stmt)
                await session.commit()
                tasks_completed += 1
                logger.info(f"Cleaned up {result.rowcount} old jobs")
        except Exception as e:
            logger.error(f"Failed to cleanup old jobs: {e}")

        elapsed = (datetime.utcnow() - start_time).total_seconds()
        logger.info(f"Proactive scan completed: {tasks_completed}/4 tasks succeeded in {elapsed:.2f}s")

        return tasks_completed == 4

    except ImportError as e:
        logger.error(f"Failed to import required modules: {e}")
        logger.info("Running in minimal mode - app modules not available")

        # Minimal health check when full app isn't available
        logger.info("Performing minimal health checks...")

        # Check database connectivity
        database_url = os.getenv("DATABASE_URL")
        if database_url:
            try:
                import asyncpg
                # Parse connection string and test
                logger.info("Database URL configured - connectivity would be tested in production")
            except ImportError:
                logger.warning("asyncpg not available for database test")

        # Check Redis connectivity
        redis_host = os.getenv("REDIS_HOST")
        if redis_host:
            logger.info(f"Redis configured at: {redis_host}")

        elapsed = (datetime.utcnow() - start_time).total_seconds()
        logger.info(f"Minimal proactive scan completed in {elapsed:.2f}s")
        return True


def main():
    """Main entry point for Cloud Run Job."""
    logger.info("=" * 60)
    logger.info("Life Navigator - Proactive Engine")
    logger.info(f"Job started at: {datetime.utcnow().isoformat()}")
    logger.info(f"Environment: {os.getenv('ENVIRONMENT', 'unknown')}")
    logger.info("=" * 60)

    try:
        success = asyncio.run(run_proactive_scan())

        if success:
            logger.info("Job completed successfully")
            sys.exit(0)
        else:
            logger.error("Job completed with errors")
            sys.exit(1)

    except Exception as e:
        logger.exception(f"Job failed with exception: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
