"""
Celery application configuration.

Celery is used for background task processing including:
- GraphRAG index rebuilds
- Metrics collection
- Data cleanup
- Email sending (future)
- Report generation (future)
"""

from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

# Create Celery app
celery_app = Celery(
    "life-navigator",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

# Celery configuration
celery_app.conf.update(
    # Task settings
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    # Task execution settings
    task_acks_late=True,  # Acknowledge after task completes
    task_reject_on_worker_lost=True,  # Reject tasks if worker crashes
    task_time_limit=3600,  # 1 hour max
    task_soft_time_limit=3300,  # 55 minutes soft limit
    # Result backend settings
    result_expires=86400,  # Results expire after 24 hours
    result_extended=True,  # Store additional task metadata
    # Worker settings
    worker_prefetch_multiplier=1,  # One task at a time (for long-running tasks)
    worker_max_tasks_per_child=50,  # Restart worker after 50 tasks (memory cleanup)
    # Monitoring
    worker_send_task_events=True,
    task_send_sent_event=True,
)

# Task routing (future: route different task types to different queues)
celery_app.conf.task_routes = {
    "graphrag.*": {"queue": "graphrag"},
    "email.*": {"queue": "email"},
    "reports.*": {"queue": "reports"},
}

# Periodic tasks (cron-like scheduling)
celery_app.conf.beat_schedule = {
    # Update GraphRAG metrics every 15 minutes
    "update-graphrag-metrics": {
        "task": "graphrag.update_metrics",
        "schedule": crontab(minute="*/15"),
        # Note: This would need tenant_id - implement dynamic task scheduling
    },
    # Clean up old jobs daily at 2 AM
    "cleanup-old-jobs": {
        "task": "graphrag.cleanup_old_jobs",
        "schedule": crontab(hour=2, minute=0),
        "kwargs": {"days": 30},
    },
    # Detect duplicates weekly (Sunday at 3 AM)
    "detect-duplicates-weekly": {
        "task": "graphrag.detect_duplicates",
        "schedule": crontab(hour=3, minute=0, day_of_week=0),
        # Note: This would need tenant_id - implement dynamic task scheduling
    },
    # Validate index quality daily at 4 AM
    "validate-quality-daily": {
        "task": "graphrag.validate_index_quality",
        "schedule": crontab(hour=4, minute=0),
        # Note: This would need tenant_id - implement dynamic task scheduling
    },
}

# Auto-discover tasks from all installed apps
celery_app.autodiscover_tasks(["app.tasks"])
