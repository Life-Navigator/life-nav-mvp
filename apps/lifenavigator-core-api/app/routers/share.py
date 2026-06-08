"""Public report-share view (`/v1/share/{token}`) — NO authentication.

The recipient (advisor / CPA / attorney / parent / spouse) holds only the share token. The
server resolves it via service-role, enforces revocation + expiration, redacts to the audience
scope, logs the access, and returns the read-only report. The service-role key never leaves the
server; the token is the only credential.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from ..dependencies import get_share_service
from ..services.sharing import ShareService

router = APIRouter(prefix="/v1/share", tags=["share"])


@router.get("/{token}")
async def view(token: str, svc: ShareService = Depends(get_share_service)):
    result = await svc.resolve(token)
    if not result.get("ok"):
        reason = result.get("reason", "not_found")
        code = 410 if reason in ("revoked", "expired") else 404
        raise HTTPException(status_code=code, detail=f"Share link {reason}")
    return result
