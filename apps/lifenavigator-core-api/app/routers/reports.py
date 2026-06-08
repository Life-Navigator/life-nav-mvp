"""Universal Reporting router (`/v1/reports`).

Generates + stores typed, reproducible ReportDefinitions (full / financial / education /
decision). JSON-first — a renderer consumes content_json later. Every report cites its
evidence; nothing is invented.
"""
from __future__ import annotations

from fastapi import APIRouter, Body, Depends, HTTPException, Response

from ..auth import AuthenticatedUser
from ..dependencies import authenticated, get_analytics_service, get_report_engine, get_share_service
from ..services.analytics import AnalyticsService
from ..models.common import UserContext
from ..services.pdf_renderer import render_education_pdf
from ..services.report_engine import REPORT_TYPES, UniversalReportEngine
from ..services.sharing import AUDIENCES, ShareService

router = APIRouter(prefix="/v1/reports", tags=["reports"])


def _ctx(user: AuthenticatedUser) -> UserContext:
    return UserContext(user_id=user.user_id)


@router.post("/generate")
async def generate(
    user: AuthenticatedUser = Depends(authenticated),
    engine: UniversalReportEngine = Depends(get_report_engine),
    analytics: AnalyticsService = Depends(get_analytics_service),
    report_type: str = Body("full", embed=True),
):
    if report_type not in REPORT_TYPES:
        raise HTTPException(status_code=400, detail=f"report_type must be one of {REPORT_TYPES}")
    ctx = _ctx(user)
    result = await engine.generate(ctx, report_type)
    await analytics.emit(ctx, "report_generated", domain="report", props={"report_type": report_type})
    return result


@router.get("/{report_type}/preview")
async def preview(
    report_type: str,
    user: AuthenticatedUser = Depends(authenticated),
    engine: UniversalReportEngine = Depends(get_report_engine),
):
    if report_type not in REPORT_TYPES:
        raise HTTPException(status_code=400, detail=f"report_type must be one of {REPORT_TYPES}")
    definition = await engine.build(_ctx(user), report_type)
    return engine.render(definition)


@router.get("/education/pdf")
async def education_pdf(
    user: AuthenticatedUser = Depends(authenticated),
    engine: UniversalReportEngine = Depends(get_report_engine),
):
    """One-click branded Education PDF (downloadable). Rendered from the reproducible
    ReportDefinition — every figure traces to the evidence appendix."""
    definition = await engine.build(_ctx(user), "education")
    pdf = render_education_pdf(definition.model_dump())
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="lifenavigator-education-report.pdf"'},
    )


@router.post("/{report_type}/share")
async def create_share(
    report_type: str,
    user: AuthenticatedUser = Depends(authenticated),
    svc: ShareService = Depends(get_share_service),
    analytics: AnalyticsService = Depends(get_analytics_service),
    audience: str = Body(..., embed=True),
    expires_in_days: int = Body(14, embed=True),
    purpose: str = Body("", embed=True),
):
    """Generate a governed share token (consent ledger entry) for a report + audience."""
    if report_type not in REPORT_TYPES:
        raise HTTPException(status_code=400, detail=f"report_type must be one of {REPORT_TYPES}")
    if audience not in AUDIENCES:
        raise HTTPException(status_code=400, detail=f"audience must be one of {AUDIENCES}")
    ctx = _ctx(user)
    result = await svc.create_share(ctx, report_type=report_type, audience=audience, expires_in_days=expires_in_days, purpose=purpose or None)
    await analytics.emit(ctx, "share_created", domain="share", props={"audience": audience, "report_type": report_type})
    return result


@router.get("/shares")
async def list_shares(user: AuthenticatedUser = Depends(authenticated), svc: ShareService = Depends(get_share_service)):
    return {"shares": await svc.list_shares(_ctx(user))}


@router.post("/shares/{share_id}/revoke")
async def revoke_share(share_id: str, user: AuthenticatedUser = Depends(authenticated), svc: ShareService = Depends(get_share_service)):
    return await svc.revoke(_ctx(user), share_id)


@router.get("/shares/audit")
async def share_audit(user: AuthenticatedUser = Depends(authenticated), svc: ShareService = Depends(get_share_service)):
    return {"access_log": await svc.audit_log(_ctx(user))}
