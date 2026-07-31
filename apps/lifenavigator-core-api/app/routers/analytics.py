"""Analytics router — beta instrumentation (`/v1/events` emit) + Executive Dashboard (`/v1/admin/metrics`).

The dashboard returns platform-wide COUNTS only (no PII, no user content). emit records funnel
events (onboarding/login/domain views) for the authenticated user.
"""
from __future__ import annotations

from fastapi import APIRouter, Body, Depends, HTTPException

from ..auth import AuthenticatedUser
from ..dependencies import authenticated, get_analytics_service, get_platform_access, get_supabase
from ..models.common import UserContext
from ..services.response_reports import ReportRejected, ResponseReportService
from ..services.response_review import ResponseReviewService, ReviewForbidden, ReviewRejected
from ..services.analytics import EVENT_TYPES, AnalyticsService
from ..services.pilot_service import FeedbackService, PilotAnalyticsService
from ..services.platform_access import PlatformAccess

router = APIRouter(prefix="/v1", tags=["analytics"])


@router.post("/events")
async def emit_event(
    user: AuthenticatedUser = Depends(authenticated),
    svc: AnalyticsService = Depends(get_analytics_service),
    event_type: str = Body(..., embed=True),
    domain: str = Body("", embed=True),
    props: dict = Body({}, embed=True),
):
    if event_type not in EVENT_TYPES:
        raise HTTPException(status_code=400, detail=f"event_type must be one of {EVENT_TYPES}")
    await svc.emit(UserContext(user_id=user.user_id), event_type, domain=domain or None, props=props)
    return {"ok": True}


@router.post("/feedback")
async def submit_feedback(
    user: AuthenticatedUser = Depends(authenticated),
    sb=Depends(get_supabase),
    payload: dict = Body(...),
):
    """Pilot feedback capture (thumbs/trust/usefulness/recommendation_quality/advisor_comparison/nps/comment).
    Owner-scoped: user_id is stamped from the JWT, never the body. Partial feedback is accepted."""
    return await FeedbackService(sb).submit(str(user.user_id), payload or {})


@router.get("/admin/pilot-analytics")
async def pilot_analytics(
    user: AuthenticatedUser = Depends(authenticated),
    sb=Depends(get_supabase),
    access: PlatformAccess = Depends(get_platform_access),
):
    """Pilot dashboard rollup (admin-only): advisor turn outcomes + safety events + feedback/NPS summary.
    Counts/rates only — no PII."""
    ctx = UserContext(user_id=user.user_id)
    if not access.is_admin(user.email):
        await access.log_admin_access(ctx, user.email, "/v1/admin/pilot-analytics", "denied")
        raise HTTPException(status_code=403, detail="Admin access required")
    await access.log_admin_access(ctx, user.email, "/v1/admin/pilot-analytics", "granted")
    return await PilotAnalyticsService(sb).summary()


@router.get("/admin/metrics")
async def metrics(
    user: AuthenticatedUser = Depends(authenticated),
    svc: AnalyticsService = Depends(get_analytics_service),
    access: PlatformAccess = Depends(get_platform_access),
):
    """Executive Dashboard — admin-only. Authenticated alone is INSUFFICIENT."""
    ctx = UserContext(user_id=user.user_id)
    if not access.is_admin(user.email):
        await access.log_admin_access(ctx, user.email, "/v1/admin/metrics", "denied")
        raise HTTPException(status_code=403, detail="Admin access required")
    await access.log_admin_access(ctx, user.email, "/v1/admin/metrics", "granted")
    return await svc.dashboard()


@router.get("/admin/advisor-metrics")
async def advisor_metrics(
    user: AuthenticatedUser = Depends(authenticated),
    svc: AnalyticsService = Depends(get_analytics_service),
    access: PlatformAccess = Depends(get_platform_access),
):
    """Advisor observability dashboard (P0.1) — admin-only. Fallback rate, latency p95, validator
    failure rate, avg confidence/edges/tokens over the last 30 days. Counts/rates only — no PII."""
    ctx = UserContext(user_id=user.user_id)
    if not access.is_admin(user.email):
        await access.log_admin_access(ctx, user.email, "/v1/admin/advisor-metrics", "denied")
        raise HTTPException(status_code=403, detail="Admin access required")
    await access.log_admin_access(ctx, user.email, "/v1/admin/advisor-metrics", "granted")
    return await svc.advisor_metrics()


@router.post("/advisor/response-report", status_code=201)
async def report_advisor_response(
    user: AuthenticatedUser = Depends(authenticated),
    sb=Depends(get_supabase),
    payload: dict = Body(...),
):
    """Report a specific advisor response (audit finding R-3).

    Body carries exactly three fields — `turn_id`, `category`, `explanation`. Identity, tenant,
    deployment, model and evidence metadata are resolved SERVER-SIDE; anything identity-shaped in
    the body is ignored, matching the established pattern in `submit_feedback` above.

    Returns 404 both when the turn does not exist and when it belongs to someone else, so a caller
    holding another tenant's turn_id learns nothing. That is deliberate, not an oversight.
    """
    svc = ResponseReportService(sb)
    try:
        result = await svc.submit(
            authenticated_user_id=str(user.user_id),
            turn_id=str((payload or {}).get("turn_id") or ""),
            category=str((payload or {}).get("category") or ""),
            explanation=(payload or {}).get("explanation"),
        )
    except ReportRejected as exc:
        reason = str(exc)
        if reason in ("invalid category", "explanation too long"):
            raise HTTPException(status_code=400, detail=reason) from exc
        # "not found" and "not yours" collapse to the same response — no enumeration oracle.
        raise HTTPException(status_code=404, detail="Response not found") from exc
    return {
        "report_id": result.report_id,
        "duplicate": result.duplicate,
        "status": "received",
    }


# ── Advisor-response report REVIEW (R-3 / B-23) ──────────────────────────────────────────────────
# Guarded by the narrow `advisor_response_reviewer` capability, NOT by is_admin. Admins inherit it
# explicitly inside PlatformAccess; reviewers gain nothing beyond these three endpoints.

def _review_service(sb, access) -> ResponseReviewService:
    return ResponseReviewService(sb, access)


@router.get("/admin/response-reports")
async def list_response_reports(
    user: AuthenticatedUser = Depends(authenticated),
    sb=Depends(get_supabase),
    access: PlatformAccess = Depends(get_platform_access),
    category: str = "", review_status: str = "", severity: str = "",
    deployment_version: str = "", prompt_version: str = "", model_name: str = "",
    assigned_to: str = "", limit: int = 25, offset: int = 0,
):
    """Review queue. Returns queue columns ONLY — no question or response snapshot."""
    ctx = UserContext(user_id=user.user_id)
    try:
        return await _review_service(sb, access).list_reports(
            ctx, user.email,
            filters={"category": category, "review_status": review_status, "severity": severity,
                     "deployment_version": deployment_version, "prompt_version": prompt_version,
                     "model_name": model_name, "assigned_to": assigned_to},
            limit=limit, offset=offset,
        )
    except ReviewForbidden as exc:
        raise HTTPException(status_code=403, detail="Response review access required") from exc


@router.get("/admin/response-reports/{report_id}")
async def get_response_report(
    report_id: str,
    user: AuthenticatedUser = Depends(authenticated),
    sb=Depends(get_supabase),
    access: PlatformAccess = Depends(get_platform_access),
):
    """One report's preserved evidence plus its append-only audit history."""
    ctx = UserContext(user_id=user.user_id)
    try:
        return await _review_service(sb, access).get_report(ctx, user.email, report_id)
    except ReviewForbidden as exc:
        raise HTTPException(status_code=403, detail="Response review access required") from exc
    except ReviewRejected as exc:
        raise HTTPException(status_code=404, detail="Report not found") from exc


@router.patch("/admin/response-reports/{report_id}")
async def update_response_report(
    report_id: str,
    user: AuthenticatedUser = Depends(authenticated),
    sb=Depends(get_supabase),
    access: PlatformAccess = Depends(get_platform_access),
    payload: dict = Body(...),
):
    """Assignment, severity, status transition, note, duplicate linkage, escalation.

    Evidence columns are unreachable: the service builds its patch from these fields only, so no
    request shape can edit a question snapshot, a reporter, a tenant or a turn id. There is no
    delete endpoint.
    """
    ctx = UserContext(user_id=user.user_id)
    body = payload or {}
    try:
        return await _review_service(sb, access).update_review(
            ctx, user.email, report_id,
            assigned_to=body.get("assigned_to"), severity=body.get("severity"),
            review_status=body.get("review_status"), note=body.get("note"),
            duplicate_of=body.get("duplicate_of"), escalate=bool(body.get("escalate")),
        )
    except ReviewForbidden as exc:
        raise HTTPException(status_code=403, detail="Response review access required") from exc
    except ReviewRejected as exc:
        detail = str(exc)
        raise HTTPException(status_code=404 if detail == "not found" else 400, detail=detail) from exc
