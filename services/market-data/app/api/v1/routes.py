"""
FastAPI routes for market-data service.

Endpoints:
- POST /v1/snapshots/build (admin only - triggers snapshot build)
- GET /v1/snapshots/latest
- GET /v1/snapshots/{as_of}
- GET /v1/snapshots/range
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from app.core.security import require_read_scope, require_build_scope, JWTPayload
from app.core.logging import get_logger
from app.core.metrics import api_requests_total, api_request_duration
from app.jobs.build_snapshot import SnapshotBuilder
from app.storage.gcs_store import GCSStore
from app.domain.schema import SnapshotResponse, MarketSnapshot, Provenance

logger = get_logger(__name__)
router = APIRouter(prefix="/v1/snapshots", tags=["snapshots"])


class BuildResponse(BaseModel):
    """Response for snapshot build trigger"""

    status: str
    snapshot_id: Optional[str] = None
    errors: list[str] = []


@router.post("/build", response_model=BuildResponse)
async def build_snapshot(
    jwt: JWTPayload = Depends(require_build_scope),
) -> BuildResponse:
    """
    Trigger a new market snapshot build (admin only).

    Requires market:build scope.

    This endpoint:
    1. Fetches data from all collectors
    2. Normalizes and computes features
    3. Validates snapshot
    4. Stores in GCS

    Typical use: Called by K8s CronJob or Cloud Scheduler
    """
    with api_request_duration.labels(endpoint="build").time():
        try:
            logger.info("snapshot_build_triggered", scope=jwt.scope)

            builder = SnapshotBuilder()
            snapshot, errors = await builder.build_and_store_snapshot()

            if snapshot is None:
                api_requests_total.labels(endpoint="build", status="error").inc()
                return BuildResponse(
                    status="error",
                    errors=errors or ["Unknown error during build"],
                )

            api_requests_total.labels(endpoint="build", status="success").inc()
            return BuildResponse(
                status="success",
                snapshot_id=snapshot.snapshot_id,
                errors=errors,
            )

        except Exception as e:
            logger.error("build_endpoint_error", error=str(e))
            api_requests_total.labels(endpoint="build", status="error").inc()
            raise HTTPException(status_code=500, detail=f"Build failed: {str(e)}")


@router.get("/latest", response_model=SnapshotResponse)
async def get_latest_snapshot(
    jwt: JWTPayload = Depends(require_read_scope),
) -> SnapshotResponse:
    """
    Get the most recent market snapshot.

    Requires market:read scope.

    Returns:
        SnapshotResponse with snapshot, provenance, and staleness info
    """
    with api_request_duration.labels(endpoint="latest").time():
        try:
            logger.debug("latest_snapshot_requested", scope=jwt.scope)

            storage = GCSStore()
            snapshot = await storage.get_latest_snapshot()

            if snapshot is None:
                api_requests_total.labels(endpoint="latest", status="not_found").inc()
                raise HTTPException(status_code=404, detail="No snapshot available")

            # Compute staleness
            now = datetime.now(snapshot.as_of.tzinfo)
            staleness_seconds = int((now - snapshot.as_of).total_seconds())

            # Stub provenance (could load from GCS if needed)
            provenance = Provenance(
                snapshot_id=snapshot.snapshot_id,
                sources_used=[],
                fetch_timestamp=snapshot.created_at,
                build_duration_seconds=0.0,
            )

            api_requests_total.labels(endpoint="latest", status="success").inc()

            return SnapshotResponse(
                snapshot=snapshot,
                provenance=provenance,
                staleness_seconds=staleness_seconds,
                warnings=snapshot.warnings,
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error("latest_snapshot_error", error=str(e))
            api_requests_total.labels(endpoint="latest", status="error").inc()
            raise HTTPException(status_code=500, detail=f"Failed to retrieve snapshot: {str(e)}")


@router.get("/{as_of}", response_model=SnapshotResponse)
async def get_snapshot_by_date(
    as_of: str,
    jwt: JWTPayload = Depends(require_read_scope),
) -> SnapshotResponse:
    """
    Get snapshot for a specific date.

    Args:
        as_of: Date in YYYY-MM-DD format

    Requires market:read scope.
    """
    with api_request_duration.labels(endpoint="by_date").time():
        try:
            logger.debug("snapshot_by_date_requested", as_of=as_of, scope=jwt.scope)

            # Parse date
            try:
                date_obj = datetime.strptime(as_of, "%Y-%m-%d")
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid date format. Use YYYY-MM-DD",
                )

            storage = GCSStore()
            snapshot = await storage.get_snapshot_by_date(date_obj)

            if snapshot is None:
                api_requests_total.labels(endpoint="by_date", status="not_found").inc()
                raise HTTPException(
                    status_code=404,
                    detail=f"No snapshot found for date {as_of}",
                )

            # Compute staleness
            now = datetime.now(snapshot.as_of.tzinfo)
            staleness_seconds = int((now - snapshot.as_of).total_seconds())

            provenance = Provenance(
                snapshot_id=snapshot.snapshot_id,
                sources_used=[],
                fetch_timestamp=snapshot.created_at,
                build_duration_seconds=0.0,
            )

            api_requests_total.labels(endpoint="by_date", status="success").inc()

            return SnapshotResponse(
                snapshot=snapshot,
                provenance=provenance,
                staleness_seconds=staleness_seconds,
                warnings=snapshot.warnings,
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error("snapshot_by_date_error", error=str(e), as_of=as_of)
            api_requests_total.labels(endpoint="by_date", status="error").inc()
            raise HTTPException(status_code=500, detail=f"Failed to retrieve snapshot: {str(e)}")


@router.get("/range", response_model=dict)
async def get_snapshot_range(
    start: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end: str = Query(..., description="End date (YYYY-MM-DD)"),
    jwt: JWTPayload = Depends(require_read_scope),
) -> dict:
    """
    Get snapshots for a date range (stub implementation).

    Args:
        start: Start date
        end: End date

    Requires market:read scope.

    Note: This is a stub. Full implementation would list GCS blobs in range.
    """
    with api_request_duration.labels(endpoint="range").time():
        try:
            logger.warning("range_endpoint_not_implemented", start=start, end=end)

            api_requests_total.labels(endpoint="range", status="not_implemented").inc()

            raise HTTPException(
                status_code=501,
                detail="Range queries not yet implemented. Use /latest or /{as_of}",
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error("range_endpoint_error", error=str(e))
            api_requests_total.labels(endpoint="range", status="error").inc()
            raise HTTPException(status_code=500, detail=str(e))
