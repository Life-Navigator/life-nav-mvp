"""Health & Wellness domain router (`/v1/health`).

Named `health_domain` so it never collides with `routers/health.py` (liveness).
Health is NOT unlocked as a live domain in the registry (H1) — these endpoints exist
for the backend foundation + smoke, not production navigation. Wellness only; medical
requests are blocked/escalated by the MedicalSafetyGate.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends

from ..auth import AuthenticatedUser
from ..dependencies import authenticated, get_health_intelligence, get_health_service
from ..domains.health import HealthService
from ..models.common import DomainViewModel, UserContext, WriteResult
from ..services.medical_safety import MedicalSafetyGate

router = APIRouter(prefix="/v1/health", tags=["health"])
_gate = MedicalSafetyGate()


def _ctx(user: AuthenticatedUser) -> UserContext:
    return UserContext(user_id=user.user_id)


# ---- summary + recommendations ----
@router.get("/summary", response_model=DomainViewModel)
async def summary(user: AuthenticatedUser = Depends(authenticated), svc: HealthService = Depends(get_health_service)):
    return await svc.summary(_ctx(user))


@router.get("/recommendations", response_model=DomainViewModel)
async def recommendations(user: AuthenticatedUser = Depends(authenticated), svc: HealthService = Depends(get_health_service)):
    ctx = _ctx(user)
    recs = await svc.recommendations(ctx)
    vm = await svc.summary(ctx)
    vm.recommendations = recs
    return vm


@router.post("/recommendations/generate")
async def generate_recommendations(user: AuthenticatedUser = Depends(authenticated), svc: HealthService = Depends(get_health_service)) -> dict[str, Any]:
    persisted = await svc.persist_recommendations(_ctx(user))
    return {
        "count": len(persisted),
        "recommendation_ids": [r.get("id") for r in persisted],
        "recommendation_types": [r.get("recommendation_type") for r in persisted],
    }


# ---- list endpoints (generic owner-scoped reads as DomainViewModel) ----
_LISTS = {
    "profile": ("health_profiles", "profile"),
    "goals": ("health_goals", "goals"),
    "habits": ("wellness_habits", "habits"),
    "activity": ("activity_logs", "activity"),
    "sleep": ("sleep_logs", "sleep"),
    "nutrition": ("nutrition_logs", "nutrition"),
    "supplements": ("supplement_logs", "supplements"),
    "vitals": ("vitals", "vitals"),
    "labs": ("lab_markers", "labs"),
    "insurance": ("health_insurance_plans", "insurance"),
    "hsa-fsa": ("health_spending_accounts", "spending_accounts"),
}


def _make_list_route(path: str, table: str, key: str) -> None:
    @router.get(f"/{path}", response_model=DomainViewModel, name=f"health_{key}")
    async def _list(user: AuthenticatedUser = Depends(authenticated), svc: HealthService = Depends(get_health_service)):  # noqa: ANN202
        return await svc.list_view(_ctx(user), table, key)


for _p, (_t, _k) in _LISTS.items():
    _make_list_route(_p, _t, _k)


# ---- writes (owner-scoped; identity from JWT) ----
@router.post("/profile", response_model=WriteResult)
async def write_profile(payload: dict[str, Any] = Body(default_factory=dict), user: AuthenticatedUser = Depends(authenticated), svc: HealthService = Depends(get_health_service)):
    return await svc.write(_ctx(user), "health_profiles", payload)


@router.post("/goal", response_model=WriteResult)
async def write_goal(payload: dict[str, Any] = Body(default_factory=dict), user: AuthenticatedUser = Depends(authenticated), svc: HealthService = Depends(get_health_service)):
    return await svc.write(_ctx(user), "health_goals", payload)


@router.post("/habit", response_model=WriteResult)
async def write_habit(payload: dict[str, Any] = Body(default_factory=dict), user: AuthenticatedUser = Depends(authenticated), svc: HealthService = Depends(get_health_service)):
    return await svc.write(_ctx(user), "wellness_habits", payload)


@router.post("/check-in", response_model=WriteResult)
async def check_in(payload: dict[str, Any] = Body(default_factory=dict), user: AuthenticatedUser = Depends(authenticated), svc: HealthService = Depends(get_health_service)):
    """A daily wellness check-in persists a sleep log (the v1 check-in metric)."""
    return await svc.write(_ctx(user), "sleep_logs", payload)


# ---- medical safety gate (wellness-only enforcement) ----
@router.post("/safety-check")
async def safety_check(payload: dict[str, Any] = Body(default_factory=dict), user: AuthenticatedUser = Depends(authenticated)) -> dict[str, Any]:
    """Classify a health question against the medical-safety boundary. Deterministic."""
    decision = _gate.evaluate(str(payload.get("message", "")))
    return {
        "action": decision.action,
        "allowed": decision.allowed,
        "reason": decision.reason,
        "message": decision.message,
        "boundary": decision.boundary,
    }


@router.get("/intelligence")
async def health_intelligence(user: AuthenticatedUser = Depends(authenticated), svc=Depends(get_health_intelligence)):
    """Health Intelligence: labs vs reference ranges + supplements + medications + fitness +
    nutrition, from uploaded health documents. Not medical advice."""
    return await svc.assess(_ctx(user))
