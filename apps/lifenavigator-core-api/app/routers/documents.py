"""Document Intelligence router (`/v1/documents`).

Upload/register a document → extract structured, confidence-scored fields → build the document
graph → readiness / confidence / timeline / recommendations. The data-acquisition layer for
every domain. Extraction never invents: a field absent from the text is simply not returned.
"""
from __future__ import annotations

from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, UploadFile

from ..auth import AuthenticatedUser
from ..dependencies import authenticated, get_conflict_service, get_document_service, get_resume_service
from ..models.common import UserContext
from ..services.conflicts import ConflictDetectionService
from ..services.documents import CATEGORIES, TAXONOMY, DocumentIntelligenceService
from ..services.resume import ResumeImportService

router = APIRouter(prefix="/v1/documents", tags=["documents"])
_MAX_BYTES = 25 * 1024 * 1024


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
    acknowledge_sensitive: bool = Body(False, embed=True),
):
    if doc_type not in TAXONOMY:
        raise HTTPException(status_code=400, detail="unknown doc_type (see /v1/documents/catalog)")
    return await svc.register(_ctx(user), doc_type=doc_type, text=text, title=title or None,
                              file_ref=file_ref or None, acknowledge_sensitive=acknowledge_sensitive)


@router.post("/upload")
async def upload(
    user: AuthenticatedUser = Depends(authenticated),
    svc: DocumentIntelligenceService = Depends(get_document_service),
    doc_type: str = Form(...),
    file: UploadFile = File(...),
    acknowledge_sensitive: bool = Form(False),
):
    """Upload a real file (PDF/text/image) → PII scan → store → parse → extract → evidence."""
    if doc_type not in TAXONOMY:
        raise HTTPException(status_code=400, detail="unknown doc_type (see /v1/documents/catalog)")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="empty file")
    if len(data) > _MAX_BYTES:
        raise HTTPException(status_code=413, detail="file too large (max 25MB)")
    return await svc.upload(_ctx(user), doc_type=doc_type, filename=file.filename or "document",
                            content_type=file.content_type or "application/octet-stream", data=data,
                            acknowledge_sensitive=acknowledge_sensitive)


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


@router.get("/{document_id}/evidence")
async def evidence(document_id: str, user: AuthenticatedUser = Depends(authenticated),
                   svc: DocumentIntelligenceService = Depends(get_document_service)):
    """P0 trust: the 'View Evidence' payload — the document + every extracted field with its page,
    section, char span, confidence, method, and review status. Tenant-scoped to the caller."""
    return await svc.field_evidence(_ctx(user), document_id=document_id)


@router.post("/fields/{field_id}/review")
async def review_field(field_id: str, user: AuthenticatedUser = Depends(authenticated),
                       svc: DocumentIntelligenceService = Depends(get_document_service),
                       action: str = Body(..., embed=True), new_value: str = Body("", embed=True)):
    """Human review of one extracted field: confirm / edit / reject. Drives the trust precedence the
    advisor honors (user_confirmed/user_edited > extracted > inferred)."""
    try:
        return await svc.set_field_review(_ctx(user), field_id=field_id, action=action,
                                          new_value=new_value or None)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Phase 6 — conflict detection ───────────────────────────────────────────────
@router.get("/conflicts")
async def list_conflicts(status: str = "", include_resolved: bool = False,
                         user: AuthenticatedUser = Depends(authenticated),
                         svc: ConflictDetectionService = Depends(get_conflict_service)):
    """Detected contradictions across documents + user-entered domain data. Defaults to OPEN only;
    pass status=… or include_resolved=true to see resolved/ignored. Tenant-scoped."""
    conflicts = await svc.list_conflicts(_ctx(user), status=status or None, include_resolved=include_resolved)
    return {"conflicts": conflicts, "open_count": sum(1 for c in conflicts if c["status"] == "open")}


@router.post("/conflicts/scan")
async def scan_conflicts(user: AuthenticatedUser = Depends(authenticated),
                         svc: ConflictDetectionService = Depends(get_conflict_service)):
    """Re-run deterministic conflict detection now. Respects prior user_resolved/ignored decisions."""
    return {"conflicts": await svc.scan(_ctx(user))}


@router.get("/conflicts/{conflict_id}")
async def get_conflict(conflict_id: str, user: AuthenticatedUser = Depends(authenticated),
                       svc: ConflictDetectionService = Depends(get_conflict_service)):
    conflict = await svc.get_conflict(_ctx(user), conflict_id=conflict_id)
    if not conflict:
        raise HTTPException(status_code=404, detail="conflict not found")
    return conflict


@router.post("/conflicts/{conflict_id}/resolve")
async def resolve_conflict(conflict_id: str, user: AuthenticatedUser = Depends(authenticated),
                           svc: ConflictDetectionService = Depends(get_conflict_service),
                           resolution: str = Body(..., embed=True),
                           value: str = Body("", embed=True),
                           item_id: str = Body("", embed=True)):
    """Resolve a conflict: keep (item_id), value (corrected value), or ignore. Stores the winning
    value; never silently overwrites the source records."""
    try:
        return await svc.resolve(_ctx(user), conflict_id=conflict_id, resolution=resolution,
                                 value=value or None, item_id=item_id or None)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Phase 8 — resume import pipeline ───────────────────────────────────────────
# (Resume UPLOAD reuses POST /v1/documents/upload with doc_type='resume' — it delegates to the
#  resume pipeline, so a resume is just another document intelligence source.)
@router.get("/resume/{document_id}/review")
async def resume_review(document_id: str, user: AuthenticatedUser = Depends(authenticated),
                        svc: ResumeImportService = Depends(get_resume_service)):
    """The Resume Import Review payload: extracted records grouped by section, each with confidence,
    page, section, and review status. Nothing imports until the user approves."""
    return await svc.review_payload(_ctx(user), document_id=document_id)


@router.post("/resume/items/{item_id}")
async def resume_item_action(item_id: str, user: AuthenticatedUser = Depends(authenticated),
                             svc: ResumeImportService = Depends(get_resume_service),
                             action: str = Body(..., embed=True),
                             fields: dict = Body(None, embed=True)):
    """Per-item review: edit (with fields) / ignore / reset before import."""
    try:
        return await svc.set_item(_ctx(user), item_id=item_id, action=action, fields=fields)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/resume/{document_id}/conflicts")
async def resume_conflicts(document_id: str, user: AuthenticatedUser = Depends(authenticated),
                           svc: ResumeImportService = Depends(get_resume_service)):
    """Pre-import conflict preview (reuses the Phase 6 engine): where the resume disagrees with
    existing profile/domain data, so the user resolves before importing."""
    return {"conflicts": await svc.preview_conflicts(_ctx(user), document_id=document_id)}


@router.post("/resume/{document_id}/import")
async def resume_import(document_id: str, user: AuthenticatedUser = Depends(authenticated),
                        svc: ResumeImportService = Depends(get_resume_service),
                        item_ids: list[str] = Body(None, embed=True)):
    """Import approved items into Career + Education (provenance preserved); pass item_ids to import a
    subset, or omit to import every non-ignored item. Re-runs conflict detection after import."""
    return await svc.import_items(_ctx(user), document_id=document_id, item_ids=item_ids)
