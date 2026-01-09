"""
Google Cloud Storage persistence for market snapshots.

Stores snapshots as JSON files in GCS for compliance and auditability.
Format: gs://{bucket}/snapshots/YYYY-MM-DD/{snapshot_id}.json
"""

import json
from datetime import datetime
from typing import Optional

from google.cloud import storage

from app.core.config import settings
from app.core.logging import get_logger
from app.domain.schema import MarketSnapshot, Provenance

logger = get_logger(__name__)


class GCSStore:
    """
    GCS storage for market snapshots.

    Directory structure:
    - snapshots/YYYY-MM-DD/{snapshot_id}.json
    - snapshots/latest.json (symlink or copy)
    - provenance/YYYY-MM-DD/{snapshot_id}_provenance.json
    """

    def __init__(self):
        self.client = storage.Client(project=settings.GCS_PROJECT_ID)
        self.bucket = self.client.bucket(settings.GCS_BUCKET_NAME)
        logger.info("gcs_store_initialized", bucket=settings.GCS_BUCKET_NAME)

    async def store_snapshot(
        self,
        snapshot: MarketSnapshot,
        provenance: Provenance,
    ) -> str:
        """
        Store snapshot and provenance in GCS.

        Args:
            snapshot: Market snapshot to store
            provenance: Provenance metadata

        Returns:
            GCS path to stored snapshot
        """
        try:
            # Generate paths
            date_str = snapshot.as_of.strftime("%Y-%m-%d")
            snapshot_path = f"{settings.GCS_SNAPSHOT_PREFIX}{date_str}/{snapshot.snapshot_id}.json"
            provenance_path = (
                f"{settings.GCS_SNAPSHOT_PREFIX}provenance/{date_str}/"
                f"{snapshot.snapshot_id}_provenance.json"
            )
            latest_path = f"{settings.GCS_SNAPSHOT_PREFIX}latest.json"

            # Serialize snapshot
            snapshot_json = snapshot.model_dump_json(indent=2)
            provenance_json = provenance.model_dump_json(indent=2)

            # Upload snapshot
            blob = self.bucket.blob(snapshot_path)
            blob.upload_from_string(
                snapshot_json,
                content_type="application/json",
            )

            # Upload provenance
            prov_blob = self.bucket.blob(provenance_path)
            prov_blob.upload_from_string(
                provenance_json,
                content_type="application/json",
            )

            # Update latest pointer
            latest_blob = self.bucket.blob(latest_path)
            latest_blob.upload_from_string(
                snapshot_json,
                content_type="application/json",
            )

            logger.info(
                "snapshot_stored",
                path=snapshot_path,
                snapshot_id=snapshot.snapshot_id,
            )

            return snapshot_path

        except Exception as e:
            logger.error("snapshot_store_error", error=str(e), snapshot_id=snapshot.snapshot_id)
            raise

    async def get_latest_snapshot(self) -> Optional[MarketSnapshot]:
        """
        Retrieve the latest snapshot.

        Returns:
            MarketSnapshot or None if not found
        """
        try:
            latest_path = f"{settings.GCS_SNAPSHOT_PREFIX}latest.json"
            blob = self.bucket.blob(latest_path)

            if not blob.exists():
                logger.warning("latest_snapshot_not_found")
                return None

            snapshot_json = blob.download_as_string()
            snapshot_dict = json.loads(snapshot_json)

            snapshot = MarketSnapshot(**snapshot_dict)

            logger.info("latest_snapshot_retrieved", snapshot_id=snapshot.snapshot_id)
            return snapshot

        except Exception as e:
            logger.error("latest_snapshot_retrieval_error", error=str(e))
            return None

    async def get_snapshot_by_date(self, as_of_date: datetime) -> Optional[MarketSnapshot]:
        """
        Retrieve snapshot for a specific date.

        Args:
            as_of_date: Date to retrieve

        Returns:
            MarketSnapshot or None if not found
        """
        try:
            date_str = as_of_date.strftime("%Y-%m-%d")
            prefix = f"{settings.GCS_SNAPSHOT_PREFIX}{date_str}/"

            # List blobs for this date
            blobs = list(self.bucket.list_blobs(prefix=prefix, max_results=1))

            if not blobs:
                logger.warning("snapshot_not_found_for_date", date=date_str)
                return None

            # Get first snapshot for this date
            blob = blobs[0]
            snapshot_json = blob.download_as_string()
            snapshot_dict = json.loads(snapshot_json)

            snapshot = MarketSnapshot(**snapshot_dict)

            logger.info("snapshot_retrieved_by_date", date=date_str, snapshot_id=snapshot.snapshot_id)
            return snapshot

        except Exception as e:
            logger.error("snapshot_retrieval_error", date=as_of_date, error=str(e))
            return None
