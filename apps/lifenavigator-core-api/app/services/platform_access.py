"""Platform access + identity service (Elite Sprint 22).

Reads/writes the user's military identity, detects military documents (auto-enable), resolves
module visibility, enforces the admin allow-list, and audits admin access. All gating decisions
are made here, server-side — endpoints call this rather than trusting the client.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from ..clients.supabase import SupabaseClient
from ..models.common import UserContext
from . import module_registry as reg

PLATFORM = "platform"
DOCS = "documents"
VALID_STATUSES = {"unknown", "civilian", "veteran", "active_duty", "guard_reserve", "spouse_dependent", "military_affiliated"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class PlatformAccess:
    def __init__(self, supabase: SupabaseClient, admin_emails: set[str]) -> None:
        self._sb = supabase
        self._admins = admin_emails

    def is_admin(self, email: Optional[str]) -> bool:
        return email is not None and email.lower() in self._admins

    async def get_settings(self, ctx: UserContext) -> dict[str, Any]:
        rows = await self._sb.select("user_settings", filters={"user_id": f"eq.{ctx.user_id}"}, limit=1, schema=PLATFORM)
        if rows:
            return rows[0]
        return {"user_id": ctx.user_id, "military_status": "unknown", "military_source": None, "onboarding_military_asked": False}

    async def set_military_status(self, ctx: UserContext, status: str, *, source: str = "self_reported") -> dict[str, Any]:
        if status not in VALID_STATUSES:
            raise ValueError(f"military_status must be one of {sorted(VALID_STATUSES)}")
        row = {"user_id": ctx.user_id, "tenant_id": ctx.user_id, "military_status": status,
               "military_source": source, "onboarding_military_asked": True, "updated_at": _now()}
        await self._sb.upsert("user_settings", row, schema=PLATFORM)
        return {"military_status": status, "source": source}

    async def mark_onboarding_asked(self, ctx: UserContext) -> None:
        existing = await self.get_settings(ctx)
        await self._sb.upsert("user_settings", {"user_id": ctx.user_id, "tenant_id": ctx.user_id,
                                                "military_status": existing.get("military_status", "unknown"),
                                                "onboarding_military_asked": True, "updated_at": _now()}, schema=PLATFORM)

    async def has_military_doc(self, ctx: UserContext) -> bool:
        rows = await self._sb.select("documents", columns="doc_type", filters={"user_id": f"eq.{ctx.user_id}"}, limit=500, schema=DOCS)
        return any((r.get("doc_type") in reg.MILITARY_DOC_TYPES) for r in rows)

    async def context(self, ctx: UserContext, email: Optional[str]) -> dict[str, Any]:
        settings = await self.get_settings(ctx)
        status = settings.get("military_status", "unknown")
        has_doc = await self.has_military_doc(ctx)
        # Document-based auto-enable: a military doc with no explicit status implies affiliation.
        auto_enabled = has_doc and status in ("unknown", "civilian")
        return {"military_status": status, "has_military_doc": has_doc, "auto_enabled": auto_enabled,
                "onboarding_military_asked": settings.get("onboarding_military_asked", False),
                "is_admin": self.is_admin(email),
                "ask_military_question": status == "unknown" and not settings.get("onboarding_military_asked", False) and not has_doc}

    async def visibility(self, ctx: UserContext, email: Optional[str]) -> dict[str, Any]:
        c = await self.context(ctx, email)
        resolved = reg.resolve(military_status=c["military_status"], has_military_doc=c["has_military_doc"], is_admin=c["is_admin"])
        resolved["ask_military_question"] = c["ask_military_question"]
        resolved["auto_enabled_military"] = c["auto_enabled"]
        return resolved

    async def require_military(self, ctx: UserContext, email: Optional[str]) -> bool:
        """Server-side gate for military endpoints — never trust the client to hide the nav."""
        c = await self.context(ctx, email)
        return reg.is_military(c["military_status"], c["has_military_doc"])

    async def log_admin_access(self, ctx: UserContext, email: Optional[str], endpoint: str, result: str) -> None:
        try:
            await self._sb.insert("admin_access_log", {"id": str(uuid.uuid4()), "user_id": ctx.user_id,
                                                        "email": email, "endpoint": endpoint, "result": result}, schema=PLATFORM)
        except Exception:  # noqa: BLE001 — audit must never break the request
            pass
