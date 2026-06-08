"""Document Intelligence router (`/v1/documents`).

Upload/register a document → extract structured, confidence-scored fields → build the document
graph → readiness / confidence / timeline / recommendations. The data-acquisition layer for
every domain. Extraction never invents: a field absent from the text is simply not returned.
"""
from __future__ import annotations

from fastapi import APIRouter, Body, Depends, HTTPException

from ..auth import AuthenticatedUser
from ..dependencies import authenticated, get_document_service
from ..models.common import UserContext
from ..services.documents import CATEGORIES, TAXONOMY, DocumentIntelligenceService

router = APIRouter(prefix="/v1/documents", tags=["documents"])


def _ctx(user: AuthenticatedUser) -> UserContext:
    return UserContext(user_id=user.user_id)


@router.get("/catalog")
async def catalog():
    """The supported upload taxonomy (categories → doc types + the fields each yields)."""
    return {"categories": list(CATEGORIES),
            "doc_types": {dt: {"category": s.category, "label": s.label, "fields": list(s.fields.keys()),
                               "affects_domains": s.domains, "critical": s.critical} for dt, s in TAXONOMY.items()}}


@router.post("")
async def register(
    user: AuthenticatedUser = Depends(authenticated),
    svc: DocumentIntelligenceService = Depends(get_document_service),
    doc_type: str = Body(..., embed=True),
    text: str = Body("", embed=True),
    title: str = Body("", embed=True),
    file_ref: str = Body("", embed=True),
):
    if doc_type not in TAXONOMY:
        raise HTTPException(status_code=400, detail="unknown doc_type (see /v1/documents/catalog)")
    return await svc.register(_ctx(user), doc_type=doc_type, text=text, title=title or None, file_ref=file_ref or None)


@router.get("")
async def readiness(user: AuthenticatedUser = Depends(authenticated), svc: DocumentIntelligenceService = Depends(get_document_service)):
    return await svc.readiness(_ctx(user))


@router.get("/confidence")
async def confidence(user: AuthenticatedUser = Depends(authenticated), svc: DocumentIntelligenceService = Depends(get_document_service)):
    return await svc.confidence(_ctx(user))


@router.get("/timeline")
async def timeline(user: AuthenticatedUser = Depends(authenticated), svc: DocumentIntelligenceService = Depends(get_document_service)):
    return {"timeline": await svc.timeline(_ctx(user))}


@router.get("/recommendations")
async def recommendations(user: AuthenticatedUser = Depends(authenticated), svc: DocumentIntelligenceService = Depends(get_document_service)):
    return {"recommendations": await svc.recommendations(_ctx(user))}
