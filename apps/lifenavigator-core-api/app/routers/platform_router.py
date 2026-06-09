"""Platform identity + visibility router (`/v1/platform`).

The client asks this for what it may show; the server is the authority. Military identity is a
first-class attribute; visibility is resolved from the central module registry.
"""
from __future__ import annotations

from fastapi import APIRouter, Body, Depends, HTTPException

from ..auth import AuthenticatedUser
from ..dependencies import authenticated, get_guidance, get_platform_access
from ..models.common import UserContext
from ..services import assumptions as A
from ..services.guidance import GuidanceEngine
from ..services.platform_access import VALID_STATUSES, PlatformAccess

router = APIRouter(prefix="/v1/platform", tags=["platform"])


def _ctx(u: AuthenticatedUser) -> UserContext:
    return UserContext(user_id=u.user_id)


@router.get("/modules")
async def modules(user: AuthenticatedUser = Depends(authenticated), svc: PlatformAccess = Depends(get_platform_access)):
    """Resolved module visibility + maturity for the current user (server-authoritative)."""
    return await svc.visibility(_ctx(user), user.email)


@router.get("/profile")
async def profile(user: AuthenticatedUser = Depends(authenticated), svc: PlatformAccess = Depends(get_platform_access)):
    return await svc.context(_ctx(user), user.email)


@router.put("/military")
async def set_military(
    user: AuthenticatedUser = Depends(authenticated),
    svc: PlatformAccess = Depends(get_platform_access),
    military_status: str = Body(..., embed=True),
):
    if military_status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"military_status must be one of {sorted(VALID_STATUSES)}")
    return await svc.set_military_status(_ctx(user), military_status)


@router.post("/military/skip")
async def skip_military(user: AuthenticatedUser = Depends(authenticated), svc: PlatformAccess = Depends(get_platform_access)):
    """User dismissed the one-time military onboarding question without answering."""
    await svc.mark_onboarding_asked(_ctx(user))
    return {"ok": True}


@router.get("/dashboard")
async def dashboard(user: AuthenticatedUser = Depends(authenticated), svc: GuidanceEngine = Depends(get_guidance)):
    """Mission control: status + next-best-action + top gaps + missing documents + journey."""
    return await svc.dashboard(_ctx(user))


@router.put("/onboarding")
async def set_onboarding(
    user: AuthenticatedUser = Depends(authenticated),
    svc: PlatformAccess = Depends(get_platform_access),
    focus_decision: str = Body("", embed=True),
    completed: bool = Body(False, embed=True),
    step: int = Body(0, embed=True),
):
    return await svc.set_onboarding(_ctx(user), focus_decision=focus_decision or None,
                                    completed=completed if completed else None, step=step or None)


@router.get("/assumptions")
async def assumptions(user: AuthenticatedUser = Depends(authenticated), mode: str = "consumer"):
    """Every planning assumption + its cited basis. mode=advisor shows all; consumer groups them."""
    if mode == "advisor":
        return {"mode": "advisor", "assumptions": A.all_assumptions()}
    return {"mode": "consumer", "by_category": A.by_category()}


# ── Sprint 32: beta activation (product clarity, guided first upload, sample mode) ──
PRODUCT_CLARITY = ("LifeNavigator turns your documents, goals, and life data into evidence-backed "
                   "decisions, prioritized actions, and advisor-ready reports.")

FIRST_UPLOAD_GUIDE = [
    {"key": "new_job", "label": "New Job", "recommended_documents": ["offer_letter", "benefits_package", "401k_statement"]},
    {"key": "retirement", "label": "Retirement", "recommended_documents": ["401k_statement", "ira_statement", "brokerage_statement"]},
    {"key": "buy_house", "label": "Buy a House", "recommended_documents": ["offer_letter", "brokerage_statement", "401k_statement"]},
    {"key": "mba", "label": "MBA / School", "recommended_documents": ["program_details", "financial_aid_letter", "offer_letter"]},
    {"key": "family_planning", "label": "Protect My Family", "recommended_documents": ["life_insurance_policy", "will", "beneficiary_designation"]},
    {"key": "military_transition", "label": "Military / VA", "recommended_documents": ["dd214", "va_award_letter", "les"]},
    {"key": "health", "label": "Health Optimization", "recommended_documents": ["lab_report", "medication_list"]},
    {"key": "not_sure", "label": "Not Sure", "recommended_documents": ["offer_letter", "401k_statement", "life_insurance_policy"]},
]


@router.get("/onboarding/guide")
async def onboarding_guide(user: AuthenticatedUser = Depends(authenticated)):
    """The guided first-upload flow: the welcome question + the document that unlocks the most value."""
    return {"clarity": PRODUCT_CLARITY, "question": "What decision are you trying to make?",
            "decisions": FIRST_UPLOAD_GUIDE}


@router.get("/sample")
async def sample(user: AuthenticatedUser = Depends(authenticated)):
    """Isolated, clearly-labeled SAMPLE experience — never mixed with or persisted to user data.
    Lets a new user preview the full value loop before uploading anything."""
    return {
        "is_sample": True,
        "label": "SAMPLE — illustrative data, not your account",
        "clarity": PRODUCT_CLARITY,
        "readiness": {"index": 71, "status": "yellow", "headline": "Solid foundation, two clear gaps"},
        "top_recommendation": {
            "rec_type": "ACTION", "title": "Increase your 401(k) from 3% to 6%",
            "current_state": "3%", "target_state": "6%",
            "quantified_impact": {"financial_impact_annual": 5760, "retirement_success_before_pct": 63, "retirement_success_after_pct": 78, "readiness_delta": 5, "recomputed": True},
            "why": "Your employer matches up to 6% — you're leaving $5,760/yr on the table.",
            "confidence": 0.9, "evidence": [{"statement": "Sample 401(k): contributing 3% vs 6% match", "source_table": "documents:401k_statement"}],
        },
        "roadmap": {
            "now": [{"title": "Increase your 401(k) from 3% to 6%", "rec_type": "ACTION"}],
            "next": [{"title": "Close a $420,000 life-insurance protection gap", "rec_type": "RISK"}],
            "later": [{"title": "Complete your estate documents", "rec_type": "DEPENDENCY"}],
        },
        "report_available": True,
        "note": "This is sample data so you can see the full experience. Upload your first document to generate your own.",
    }
