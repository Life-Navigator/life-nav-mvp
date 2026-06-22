"""Life facts reader — the UI surfacing primitive for extracted document facts.

`life.facts` is written by the document pipeline (`documents._bridge` -> `submit_life_fact`) on every
upload, with provenance. The advisor already reads it (advisor_facts). This is the shared reader for the
*visible* surfaces (dashboard "recently learned" strip, Reports appendix, per-domain evidence): same trust
gate (confirmed/inferred only; candidates excluded; inferred flagged needs-confirmation), same provenance,
in a render-friendly shape. Read-only over an existing table — no new database / model / domain.
"""
from __future__ import annotations

from typing import Any, Optional

from app.models.common import UserContext

_GATE = ("confirmed", "inferred")


def _render(row: dict[str, Any]) -> dict[str, Any]:
    ft = str(row.get("fact_type") or "")
    doc_type, _dot, key = ft.partition(".")
    label = (key or ft).replace("_", " ").strip().capitalize() or "Extracted fact"
    prov = row.get("provenance") or {}
    status = row.get("confirmation_status")
    return {
        "id": row.get("id"),
        "label": label,
        "value": row.get("value"),
        "domain": row.get("domain") or "core",
        "docType": doc_type or None,
        "documentId": prov.get("document_id"),
        "confidence": round(float(row.get("confidence") or 0.0), 2),
        "confirmationStatus": status,
        "needsConfirmation": status == "inferred",  # surface a one-click confirm, never assert as settled
        "source": row.get("source") or "document",
        "updatedAt": str(row.get("updated_at")) if row.get("updated_at") else None,
        "sourceTable": "life.facts",
    }


async def recent_facts(sb: Any, ctx: UserContext, *, domain: Optional[str] = None,
                       limit: int = 20) -> list[dict[str, Any]]:
    """Confirmed/inferred extracted facts for the user, newest+highest-confidence first. Honest empty []
    when none. Optionally scoped to a domain (family/career/education/health/finance/core)."""
    filters = {"user_id": f"eq.{ctx.user_id}"}
    if domain:
        filters["domain"] = f"eq.{domain}"
    try:
        rows = await sb.select(
            "facts",
            columns="id,fact_type,value,domain,confidence,confirmation_status,source,provenance,updated_at",
            filters=filters, limit=200, schema="life", order="updated_at.desc",
        ) or []
    except Exception:  # noqa: BLE001 — surfacing must never 500 the page
        return []
    gated = [r for r in rows if r.get("value") and r.get("confirmation_status") in _GATE]
    # Confirmed before inferred, then by confidence — the most trustworthy facts lead.
    gated.sort(key=lambda r: (r.get("confirmation_status") == "confirmed", float(r.get("confidence") or 0.0)),
               reverse=True)
    return [_render(r) for r in gated[:max(1, min(limit, 100))]]
