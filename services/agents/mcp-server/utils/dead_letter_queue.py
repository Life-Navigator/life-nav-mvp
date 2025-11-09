"""
Enterprise-Grade Dead Letter Queue (DLQ)

Handles permanently failed jobs that have exhausted all retries:
- Persistent storage of failed jobs
- Metadata tracking (error details, timestamps, retry history)
- Replay capabilities
- Alerting and monitoring
- Cleanup policies
"""

import asyncio
import json
from typing import Optional, Dict, Any, List, Callable
from datetime import datetime, timedelta
from pathlib import Path
from enum import Enum
import structlog
import uuid

from .errors import BaseError

logger = structlog.get_logger(__name__)


# ============================================================================
# DLQ Item Status
# ============================================================================

class DLQItemStatus(str, Enum):
    """Status of items in dead letter queue"""
    FAILED = "failed"  # Initial failure
    PENDING_REVIEW = "pending_review"  # Awaiting manual review
    REPLAYING = "replaying"  # Being replayed
    RESOLVED = "resolved"  # Successfully replayed
    DISCARDED = "discarded"  # Manually discarded
    ARCHIVED = "archived"  # Old item archived


# ============================================================================
# DLQ Item
# ============================================================================

class DLQItem:
    """
    Represents a failed job in the dead letter queue.

    Attributes:
        id: Unique identifier
        job_name: Name/type of the failed job
        payload: Job data (serializable)
        error: Error information
        created_at: When job was added to DLQ
        retry_count: Number of retry attempts before DLQ
        metadata: Additional context
        status: Current status
    """

    def __init__(
        self,
        job_name: str,
        payload: Dict[str, Any],
        error: Optional[BaseError] = None,
        retry_count: int = 0,
        metadata: Optional[Dict[str, Any]] = None,
        item_id: Optional[str] = None
    ):
        self.id = item_id or str(uuid.uuid4())
        self.job_name = job_name
        self.payload = payload
        self.error_id = error.error_id if error else None
        self.error_message = str(error.message) if error else "Unknown error"
        self.error_type = type(error).__name__ if error else "UnknownError"
        self.error_category = error.category.value if error and hasattr(error, 'category') else None
        self.error_severity = error.severity.value if error and hasattr(error, 'severity') else None
        self.error_context = error.context if error and hasattr(error, 'context') else {}
        self.retry_count = retry_count
        self.metadata = metadata or {}
        self.status = DLQItemStatus.FAILED
        self.created_at = datetime.utcnow().isoformat()
        self.updated_at = self.created_at
        self.replay_attempts = 0
        self.last_replay_at: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage/API"""
        return {
            "id": self.id,
            "job_name": self.job_name,
            "payload": self.payload,
            "error": {
                "id": self.error_id,
                "message": self.error_message,
                "type": self.error_type,
                "category": self.error_category,
                "severity": self.error_severity,
                "context": self.error_context
            },
            "retry_count": self.retry_count,
            "metadata": self.metadata,
            "status": self.status.value,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "replay_attempts": self.replay_attempts,
            "last_replay_at": self.last_replay_at
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'DLQItem':
        """Create DLQItem from dictionary"""
        item = cls(
            job_name=data["job_name"],
            payload=data["payload"],
            retry_count=data.get("retry_count", 0),
            metadata=data.get("metadata", {}),
            item_id=data.get("id")
        )

        # Restore error info
        error_data = data.get("error", {})
        item.error_id = error_data.get("id")
        item.error_message = error_data.get("message", "Unknown error")
        item.error_type = error_data.get("type", "UnknownError")
        item.error_category = error_data.get("category")
        item.error_severity = error_data.get("severity")
        item.error_context = error_data.get("context", {})

        # Restore status info
        item.status = DLQItemStatus(data.get("status", DLQItemStatus.FAILED.value))
        item.created_at = data.get("created_at", item.created_at)
        item.updated_at = data.get("updated_at", item.updated_at)
        item.replay_attempts = data.get("replay_attempts", 0)
        item.last_replay_at = data.get("last_replay_at")

        return item

    def update_status(self, status: DLQItemStatus):
        """Update item status"""
        self.status = status
        self.updated_at = datetime.utcnow().isoformat()


# ============================================================================
# Dead Letter Queue
# ============================================================================

class DeadLetterQueue:
    """
    Dead letter queue for permanently failed jobs.

    Provides:
    - Persistent storage of failed jobs
    - Replay capabilities
    - Filtering and search
    - Automatic cleanup
    """

    def __init__(
        self,
        storage_path: Optional[Path] = None,
        max_items: int = 10000,
        retention_days: int = 30,
        auto_archive: bool = True
    ):
        self.storage_path = storage_path or Path("logs/dlq")
        self.storage_path.mkdir(parents=True, exist_ok=True)
        self.max_items = max_items
        self.retention_days = retention_days
        self.auto_archive = auto_archive

        # In-memory index
        self._items: Dict[str, DLQItem] = {}
        self._lock = asyncio.Lock()

        # Statistics
        self._stats = {
            "total_items": 0,
            "items_by_status": {},
            "items_by_job": {},
            "items_by_error_type": {}
        }

        # Load existing items
        self._load_items()

        logger.info(
            "dlq_initialized",
            storage_path=str(self.storage_path),
            max_items=self.max_items,
            retention_days=self.retention_days,
            loaded_items=len(self._items)
        )

    def _get_item_path(self, item_id: str) -> Path:
        """Get file path for DLQ item"""
        return self.storage_path / f"{item_id}.json"

    def _load_items(self):
        """Load all items from storage"""
        if not self.storage_path.exists():
            return

        for item_file in self.storage_path.glob("*.json"):
            try:
                with open(item_file, 'r') as f:
                    data = json.load(f)
                    item = DLQItem.from_dict(data)
                    self._items[item.id] = item
            except Exception as e:
                logger.error(
                    "failed_to_load_dlq_item",
                    file=str(item_file),
                    error=str(e)
                )

        self._update_stats()

    def _save_item(self, item: DLQItem):
        """Save item to disk"""
        try:
            item_path = self._get_item_path(item.id)
            with open(item_path, 'w') as f:
                json.dump(item.to_dict(), f, indent=2)
        except Exception as e:
            logger.error(
                "failed_to_save_dlq_item",
                item_id=item.id,
                error=str(e)
            )

    def _delete_item_file(self, item_id: str):
        """Delete item file from disk"""
        try:
            item_path = self._get_item_path(item_id)
            if item_path.exists():
                item_path.unlink()
        except Exception as e:
            logger.error(
                "failed_to_delete_dlq_item",
                item_id=item_id,
                error=str(e)
            )

    def _update_stats(self):
        """Update internal statistics"""
        self._stats["total_items"] = len(self._items)

        # By status
        status_counts = {}
        for item in self._items.values():
            status_counts[item.status.value] = status_counts.get(item.status.value, 0) + 1
        self._stats["items_by_status"] = status_counts

        # By job name
        job_counts = {}
        for item in self._items.values():
            job_counts[item.job_name] = job_counts.get(item.job_name, 0) + 1
        self._stats["items_by_job"] = job_counts

        # By error type
        error_counts = {}
        for item in self._items.values():
            error_counts[item.error_type] = error_counts.get(item.error_type, 0) + 1
        self._stats["items_by_error_type"] = error_counts

    async def add(
        self,
        job_name: str,
        payload: Dict[str, Any],
        error: Optional[BaseError] = None,
        retry_count: int = 0,
        metadata: Optional[Dict[str, Any]] = None
    ) -> DLQItem:
        """
        Add failed job to dead letter queue.

        Args:
            job_name: Name/type of the failed job
            payload: Job data
            error: Error that caused failure
            retry_count: Number of retries before DLQ
            metadata: Additional context

        Returns:
            DLQItem instance
        """
        async with self._lock:
            # Check max items
            if len(self._items) >= self.max_items:
                logger.warning(
                    "dlq_full",
                    max_items=self.max_items,
                    current_items=len(self._items)
                )
                # Archive oldest items
                await self._cleanup_old_items(force=True)

            # Create item
            item = DLQItem(
                job_name=job_name,
                payload=payload,
                error=error,
                retry_count=retry_count,
                metadata=metadata
            )

            # Save to memory and disk
            self._items[item.id] = item
            self._save_item(item)
            self._update_stats()

            logger.error(
                "job_added_to_dlq",
                item_id=item.id,
                job_name=job_name,
                error_type=item.error_type,
                error_message=item.error_message,
                retry_count=retry_count
            )

            return item

    async def get(self, item_id: str) -> Optional[DLQItem]:
        """Get item by ID"""
        async with self._lock:
            return self._items.get(item_id)

    async def list(
        self,
        status: Optional[DLQItemStatus] = None,
        job_name: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[DLQItem]:
        """
        List DLQ items with filtering.

        Args:
            status: Filter by status
            job_name: Filter by job name
            limit: Max items to return
            offset: Skip first N items

        Returns:
            List of DLQItems
        """
        async with self._lock:
            items = list(self._items.values())

            # Filter by status
            if status:
                items = [item for item in items if item.status == status]

            # Filter by job name
            if job_name:
                items = [item for item in items if item.job_name == job_name]

            # Sort by created_at (newest first)
            items.sort(key=lambda x: x.created_at, reverse=True)

            # Pagination
            return items[offset:offset + limit]

    async def replay(
        self,
        item_id: str,
        replay_func: Callable[[Dict[str, Any]], Any]
    ) -> bool:
        """
        Replay a failed job.

        Args:
            item_id: ID of item to replay
            replay_func: Async function to execute job

        Returns:
            True if replay succeeded, False otherwise
        """
        async with self._lock:
            item = self._items.get(item_id)
            if not item:
                logger.warning("dlq_item_not_found", item_id=item_id)
                return False

            item.update_status(DLQItemStatus.REPLAYING)
            item.replay_attempts += 1
            item.last_replay_at = datetime.utcnow().isoformat()
            self._save_item(item)

        # Execute replay outside lock
        try:
            await replay_func(item.payload)

            # Mark as resolved
            async with self._lock:
                item.update_status(DLQItemStatus.RESOLVED)
                self._save_item(item)
                self._update_stats()

            logger.info(
                "dlq_item_replayed_successfully",
                item_id=item_id,
                job_name=item.job_name,
                replay_attempts=item.replay_attempts
            )

            return True

        except Exception as e:
            # Replay failed
            async with self._lock:
                item.update_status(DLQItemStatus.FAILED)
                self._save_item(item)

            logger.error(
                "dlq_item_replay_failed",
                item_id=item_id,
                job_name=item.job_name,
                replay_attempts=item.replay_attempts,
                error=str(e)
            )

            return False

    async def discard(self, item_id: str) -> bool:
        """
        Manually discard an item.

        Args:
            item_id: ID of item to discard

        Returns:
            True if discarded, False if not found
        """
        async with self._lock:
            item = self._items.get(item_id)
            if not item:
                return False

            item.update_status(DLQItemStatus.DISCARDED)
            self._save_item(item)
            self._update_stats()

            logger.info("dlq_item_discarded", item_id=item_id, job_name=item.job_name)
            return True

    async def delete(self, item_id: str) -> bool:
        """
        Permanently delete an item.

        Args:
            item_id: ID of item to delete

        Returns:
            True if deleted, False if not found
        """
        async with self._lock:
            if item_id not in self._items:
                return False

            # Remove from memory and disk
            del self._items[item_id]
            self._delete_item_file(item_id)
            self._update_stats()

            logger.info("dlq_item_deleted", item_id=item_id)
            return True

    async def _cleanup_old_items(self, force: bool = False):
        """
        Archive or delete old items.

        Args:
            force: Force cleanup even if not auto_archive
        """
        if not self.auto_archive and not force:
            return

        async with self._lock:
            cutoff_date = datetime.utcnow() - timedelta(days=self.retention_days)
            items_to_archive = []

            for item in self._items.values():
                created_at = datetime.fromisoformat(item.created_at)
                if created_at < cutoff_date:
                    items_to_archive.append(item.id)

            # Archive items
            for item_id in items_to_archive:
                item = self._items[item_id]
                item.update_status(DLQItemStatus.ARCHIVED)
                self._save_item(item)

                # Could move to archive directory instead of deleting
                # For now, just mark as archived
                logger.info(
                    "dlq_item_archived",
                    item_id=item_id,
                    job_name=item.job_name,
                    age_days=(datetime.utcnow() - datetime.fromisoformat(item.created_at)).days
                )

    def get_stats(self) -> Dict[str, Any]:
        """Get DLQ statistics"""
        return {
            **self._stats,
            "storage_path": str(self.storage_path),
            "max_items": self.max_items,
            "retention_days": self.retention_days
        }


# ============================================================================
# Global DLQ Instance
# ============================================================================

# Global dead letter queue
dlq = DeadLetterQueue()


# ============================================================================
# Helper Functions
# ============================================================================

async def add_to_dlq(
    job_name: str,
    payload: Dict[str, Any],
    error: Optional[BaseError] = None,
    retry_count: int = 0,
    metadata: Optional[Dict[str, Any]] = None
) -> DLQItem:
    """
    Add failed job to global DLQ.

    Args:
        job_name: Name/type of the failed job
        payload: Job data
        error: Error that caused failure
        retry_count: Number of retries before DLQ
        metadata: Additional context

    Returns:
        DLQItem instance
    """
    return await dlq.add(job_name, payload, error, retry_count, metadata)


async def replay_dlq_item(item_id: str, replay_func: Callable[[Dict[str, Any]], Any]) -> bool:
    """
    Replay a DLQ item.

    Args:
        item_id: ID of item to replay
        replay_func: Function to execute job

    Returns:
        True if succeeded, False otherwise
    """
    return await dlq.replay(item_id, replay_func)


def get_dlq_stats() -> Dict[str, Any]:
    """Get global DLQ statistics"""
    return dlq.get_stats()


if __name__ == "__main__":
    # Example usage
    import asyncio
    from .errors import DatabaseError

    async def example_job(payload: Dict[str, Any]):
        """Example job that can be replayed"""
        print(f"Processing job: {payload}")
        # Simulate work
        await asyncio.sleep(0.1)
        return True

    async def main():
        # Create DLQ
        test_dlq = DeadLetterQueue(storage_path=Path("test_dlq"))

        # Add failed job
        error = DatabaseError("Database connection failed", operation="insert")
        item = await test_dlq.add(
            job_name="process_user_data",
            payload={"user_id": "12345", "data": {"name": "John"}},
            error=error,
            retry_count=3,
            metadata={"source": "api"}
        )

        print(f"Added item to DLQ: {item.id}")
        print(f"Stats: {test_dlq.get_stats()}")

        # List items
        items = await test_dlq.list()
        print(f"\nDLQ has {len(items)} items")

        # Replay item
        print(f"\nReplaying item {item.id}...")
        success = await test_dlq.replay(item.id, example_job)
        print(f"Replay {'succeeded' if success else 'failed'}")

        print(f"\nFinal stats: {test_dlq.get_stats()}")

    asyncio.run(main())
