"""ShareService (Sprint 6) — governed report sharing.

Share tokens + consent ledger (reporting.report_shares) + revocation + expiration + per-access
audit log (reporting.share_access_log) + audience-aware redaction. The public view resolves a
token server-side via service-role and returns the REDACTED report — the recipient (advisor /
CPA / attorney / parent / spouse) never has a LifeNavigator account or the service-role key; the
token is their only credential. Revoked or expired tokens fail; every access is logged.
"""
from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from ..clients.supabase import SupabaseClient
from ..models.common import UserContext
from .report_engine import REPORT_TYPES, UniversalReportEngine

REPORTING = "reporting"
AUDIENCES = ("advisor", "cpa", "attorney", "parent", "spouse")

# Which domains each audience may see. None = all. Single-domain reports (e.g. an education
# report shared with a parent) keep all their sections; a `full` report is redacted to scope.
_AUDIENCE_DOMAINS: dict[str, Optional[set[str]]] = {
    "advisor": None,
    "cpa": {"finance", "education", "general"},
    "attorney": {"family", "decision", "general"},
    "parent": {"education", "general"},
    "spouse": {"family", "finance", "general"},
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _section_domain(key: str) -> str:
    k = key.lower()
    for d in ("finance", "career", "health", "family", "decision", "education"):
        if k.startswith(d) or f"_{d}" in k:
            return d
    if k[:1].isdigit() or k in ("executive_summary", "no_decisions", "no_data"):
        return "general" if "executive" in k or "no_" in k else "education"  # numbered keys = education report
    return "general"


class ShareService:
    def __init__(self, supabase: SupabaseClient, reports: UniversalReportEngine) -> None:
        self._sb = supabase
        self._reports = reports

    # ---- owner: create / list / revoke ----
    async def create_share(
        self, ctx: UserContext, *, report_type: str, audience: str,
        expires_in_days: int = 14, purpose: Optional[str] = None,
    ) -> dict[str, Any]:
        if report_type not in REPORT_TYPES:
            raise ValueError(f"report_type must be one of {REPORT_TYPES}")
        if audience not in AUDIENCES:
            raise ValueError(f"audience must be one of {AUDIENCES}")
        # Ensure the report exists + is current (consent is for the latest report).
        gen = await self._reports.generate(ctx, report_type)
        report_id = gen["report_id"]
        token = secrets.token_urlsafe(24)
        expires = (_now() + timedelta(days=max(1, min(expires_in_days, 180)))).isoformat()
        dom = _AUDIENCE_DOMAINS[audience]
        row = {
            "id": str(uuid.uuid4()), "report_id": report_id, "user_id": ctx.user_id, "tenant_id": ctx.user_id,
            "token": token, "audience": audience, "report_type": report_type,
            "redaction": {"domains": sorted(dom) if dom else "all"},
            "purpose": purpose or f"Shared with {audience}", "expires_at": expires, "revoked": False,
        }
        res = await self._sb.insert("report_shares", row, schema=REPORTING)
        return {
            "share_id": row["id"], "token": token, "audience": audience, "report_type": report_type,
            "share_path": f"/share/{token}", "expires_at": expires, "stored": bool(res),
        }

    async def list_shares(self, ctx: UserContext) -> list[dict[str, Any]]:
        rows = await self._sb.select(
            "report_shares", filters={"user_id": f"eq.{ctx.user_id}"}, limit=100, order="created_at.desc", schema=REPORTING)
        return [{k: r.get(k) for k in ("id", "report_type", "audience", "purpose", "expires_at", "revoked", "accessed_count", "last_accessed_at", "created_at")} for r in rows]

    async def revoke(self, ctx: UserContext, share_id: str) -> dict[str, Any]:
        res = await self._sb.update(
            "report_shares", {"revoked": True},
            filters={"id": f"eq.{share_id}", "user_id": f"eq.{ctx.user_id}"}, schema=REPORTING)
        return {"revoked": bool(res), "share_id": share_id}

    async def audit_log(self, ctx: UserContext, share_id: Optional[str] = None) -> list[dict[str, Any]]:
        f = {"user_id": f"eq.{ctx.user_id}"}
        if share_id:
            f["share_id"] = f"eq.{share_id}"
        return await self._sb.select("share_access_log", filters=f, limit=200, order="accessed_at.desc", schema=REPORTING)

    # ---- public: resolve a token (no auth; service-role server-side) ----
    async def resolve(self, token: str) -> dict[str, Any]:
        shares = await self._sb.select("report_shares", filters={"token": f"eq.{token}"}, limit=1, schema=REPORTING)
        if not shares:
            return {"ok": False, "reason": "not_found"}
        share = shares[0]
        outcome = "granted"
        if share.get("revoked"):
            outcome = "revoked"
        elif share.get("expires_at") and _parse(share["expires_at"]) < _now():
            outcome = "expired"
        # audit EVERY access attempt (granted or denied)
        await self._sb.insert("share_access_log", {
            "id": str(uuid.uuid4()), "share_id": share["id"], "user_id": share["user_id"],
            "tenant_id": share["user_id"], "outcome": outcome, "audience": share.get("audience"),
        }, schema=REPORTING)
        if outcome != "granted":
            return {"ok": False, "reason": outcome}
        # count + timestamp the successful access
        await self._sb.update("report_shares", {
            "accessed_count": (share.get("accessed_count") or 0) + 1, "last_accessed_at": _now().isoformat(),
        }, filters={"id": f"eq.{share['id']}"}, schema=REPORTING)
        reports = await self._sb.select("reports", filters={"id": f"eq.{share['report_id']}"}, limit=1, schema=REPORTING)
        if not reports:
            return {"ok": False, "reason": "report_missing"}
        definition = reports[0].get("content_json") or {}
        redacted = self._redact(definition, share.get("audience"))
        return {
            "ok": True, "audience": share.get("audience"), "report_type": share.get("report_type"),
            "purpose": share.get("purpose"), "expires_at": share.get("expires_at"),
            "redacted": redacted["redacted"], "report": redacted["definition"],
            "notice": f"Shared view for {share.get('audience')} — read-only, redacted to scope, access logged.",
        }

    @staticmethod
    def _redact(definition: dict[str, Any], audience: Optional[str]) -> dict[str, Any]:
        allowed = _AUDIENCE_DOMAINS.get(audience or "", set())
        if allowed is None:  # advisor — full
            return {"definition": definition, "redacted": False}
        sections = definition.get("sections") or []
        kept, dropped = [], 0
        for s in sections:
            if _section_domain(str(s.get("key", ""))) in allowed:
                kept.append(s)
            else:
                dropped += 1
        out = dict(definition)
        out["sections"] = kept
        out["redaction_note"] = f"{dropped} section(s) hidden for the {audience} audience." if dropped else None
        return {"definition": out, "redacted": dropped > 0}


def _parse(ts: str) -> datetime:
    try:
        return datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return _now()
