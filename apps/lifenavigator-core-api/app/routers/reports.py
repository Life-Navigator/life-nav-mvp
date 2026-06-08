"""Universal Reporting router (`/v1/reports`).

Generates + stores typed, reproducible ReportDefinitions (full / financial / education /
decision). JSON-first — a renderer consumes content_json later. Every report cites its
evidence; nothing is invented.
"""
from __future__ import annotations

from fastapi import APIRouter, Body, Depends, HTTPException, Response

from ..auth import AuthenticatedUser
from ..dependencies import authenticated, get_report_engine
from ..models.common import UserContext
from ..services.pdf_renderer import render_education_pdf
from ..services.report_engine import REPORT_TYPES, UniversalReportEngine

router = APIRouter(prefix="/v1/reports", tags=["reports"])


def _ctx(user: AuthenticatedUser) -> UserContext:
    return UserContext(user_id=user.user_id)


@router.post("/generate")
async def generate(
    user: AuthenticatedUser = Depends(authenticated),
    engine: UniversalReportEngine = Depends(get_report_engine),
    report_type: str = Body("full", embed=True),
):
    if report_type not in REPORT_TYPES:
        raise HTTPException(status_code=400, detail=f"report_type must be one of {REPORT_TYPES}")
    return await engine.generate(_ctx(user), report_type)


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
