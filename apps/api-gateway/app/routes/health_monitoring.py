"""Health monitoring passthrough.

Manual-entry and wearable-event acknowledgement endpoints. The actual
ingestion + alert evaluation lives in the Next.js
`/api/health-monitoring/*` routes today; the gateway is positioned to
adopt them in a future iteration.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..auth import AuthenticatedUser, current_user

router = APIRouter()


class ManualEntryBody(BaseModel):
    kind: str = Field(pattern=r"^(daily_wellbeing|vitals|body_measurement|lab_result)$")
    data: dict


class WearableEventBody(BaseModel):
    provider: str = Field(
        pattern=r"^(apple_health|google_health_connect|oura|whoop|garmin|fitbit|other)$"
    )
    metric_type: str = Field(min_length=1, max_length=64)
    value: float
    unit: str = Field(min_length=1, max_length=32)
    secondary_value: float | None = None
    recorded_at: str  # ISO timestamp


@router.post("/manual-entry")
async def manual_entry(body: ManualEntryBody, user: AuthenticatedUser = Depends(current_user)) -> dict:
    return {
        "accepted": True,
        "user_id": user.user_id,
        "kind": body.kind,
        "delegated_to": "web /api/health-monitoring/manual-entry",
    }


@router.post("/wearable-event")
async def wearable_event(body: WearableEventBody, user: AuthenticatedUser = Depends(current_user)) -> dict:
    return {
        "accepted": True,
        "user_id": user.user_id,
        "provider": body.provider,
        "metric_type": body.metric_type,
        "delegated_to": "web /api/health-monitoring/wearable-event",
    }
