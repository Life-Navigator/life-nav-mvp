"""Conflict detection (Document Intelligence Trust Sprint — Phase 6).

Deterministic contradiction detection across extracted document fields AND user-entered domain
data. The system stops silently accepting conflicting facts: when two sources disagree about the
SAME concept (after normalization), we surface the conflict, cite BOTH sources, recommend a
resolution (by precedence), and let the user decide. No guessing, no silent overwrite.

Design:
  * A CONCEPT REGISTRY maps document fields (doc_type, field_key) and user-entered domain columns
    (schema.table.column) to a canonical concept (e.g. "current_role"). Only concepts whose data
    actually exists today are registered — we never invent a conflict for data we can't read.
  * Each value found becomes a CLAIM (value + normalized_value + source + confidence + review status).
  * Claims are grouped by concept; >1 distinct normalized value ⇒ a conflict.
  * Precedence (user_confirmed > user_edited > user_entered > verified > extracted-high >
    extracted-medium > inferred > needs_review) recommends a winner — but resolution is the user's.
  * Normalization is deterministic first (money/title/org/date/text). When the only divergence is
    between low-confidence sources we mark it a *potential* conflict, not a confirmed one.
"""
from __future__ import annotations

import re
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Optional

from ..clients.supabase import SupabaseClient
from ..models.common import UserContext

DOCS = "documents"
_NS = uuid.UUID("6f3b1e22-0000-4000-8000-00000000000c")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─────────────────────────────────────────────────────────────────────────────
# NORMALIZATION (Phase 6C) — deterministic; compare meaning, not formatting.
# ─────────────────────────────────────────────────────────────────────────────
_MONEY_RE = re.compile(r"[-+]?\d[\d,]*(?:\.\d+)?")
_TITLE_ABBR = {
    "vp": "vice president", "svp": "senior vice president", "evp": "executive vice president",
    "sr": "senior", "jr": "junior", "mgr": "manager", "mgmt": "management", "eng": "engineering",
    "engr": "engineer", "dir": "director", "ops": "operations", "admin": "administrator",
    "exec": "executive", "asst": "assistant", "assoc": "associate", "cto": "chief technology officer",
    "ceo": "chief executive officer", "cfo": "chief financial officer", "coo": "chief operating officer",
}
_TITLE_STOP = {"of", "the", "for", "and", "a", "an"}
_ORG_SUFFIX = {"inc", "incorporated", "llc", "ltd", "limited", "corp", "corporation",
               "co", "company", "plc", "lp", "llp", "gmbh", "group"}


def _basic(v: Any) -> str:
    s = re.sub(r"[^\w\s]", " ", str(v or "").lower())
    return re.sub(r"\s+", " ", s).strip()


def _norm_text(v: Any) -> str:
    return _basic(v)


def _norm_money(v: Any) -> str:
    m = _MONEY_RE.search(str(v or "").replace(" ", ""))
    if not m:
        return _basic(v)
    try:
        return str(int(round(float(m.group(0).replace(",", "")))))
    except (TypeError, ValueError):
        return _basic(v)


def _norm_title(v: Any) -> str:
    words = [_TITLE_ABBR.get(w, w) for w in _basic(v).split()]
    return " ".join(w for w in words if w not in _TITLE_STOP)


def _norm_org(v: Any) -> str:
    return " ".join(w for w in _basic(v).split() if w not in _ORG_SUFFIX)


def _norm_date(v: Any) -> str:
    s = str(v or "").strip()
    try:
        return datetime.fromisoformat(s[:10]).date().isoformat()
    except (ValueError, TypeError):
        pass
    for fmt in ("%m/%d/%Y", "%m/%d/%y", "%B %d, %Y", "%B %d %Y", "%b %d, %Y", "%b %d %Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            continue
    return _basic(v)


_NORMALIZERS: dict[str, Callable[[Any], str]] = {
    "money": _norm_money, "title": _norm_title, "org": _norm_org, "date": _norm_date, "text": _norm_text,
}


# ─────────────────────────────────────────────────────────────────────────────
# CONCEPT REGISTRY (Phase 6B) — only concepts whose data exists today.
# ─────────────────────────────────────────────────────────────────────────────
@dataclass(frozen=True)
class DomainSource:
    schema: str
    table: str
    value_col: str
    where: Optional[Callable[[dict], bool]] = None


@dataclass(frozen=True)
class ConceptDef:
    label: str
    domain: str
    conflict_type: str
    severity: str          # base severity when a trusted source is involved
    normalizer: str
    doc_fields: tuple      # tuple[(doc_type, field_key), ...]
    domain_sources: tuple = field(default=())


def _is_current(r: dict) -> bool:
    return bool(r.get("is_current"))


CONCEPTS: dict[str, ConceptDef] = {
    "current_role": ConceptDef(
        label="Current role", domain="career", conflict_type="current_role_mismatch",
        severity="medium", normalizer="title",
        doc_fields=(("offer_letter", "title"), ("promotion_letter", "new_title"),
                    ("employment_agreement", "title")),
        domain_sources=(
            DomainSource("career", "experience_records", "title", where=_is_current),
            DomainSource("career", "career_profiles", "current_title"),
        ),
    ),
    "current_employer": ConceptDef(
        label="Current employer", domain="career", conflict_type="current_employer_mismatch",
        severity="medium", normalizer="org",
        doc_fields=(),  # the extractor has no employer field yet → domain↔domain only
        domain_sources=(
            DomainSource("career", "experience_records", "employer", where=_is_current),
            DomainSource("career", "career_profiles", "current_employer"),
        ),
    ),
    "life_insurance_coverage": ConceptDef(
        label="Life insurance coverage", domain="finance", conflict_type="insurance_coverage_mismatch",
        severity="high", normalizer="money",
        doc_fields=(("life_insurance_policy", "coverage_amount"),),
        domain_sources=(
            DomainSource("family", "insurance_profiles", "life_coverage"),
        ),
    ),
}

# (doc_type, field_key) -> concept, for fast document-claim mapping.
DOC_FIELD_INDEX: dict[tuple, str] = {
    df: concept for concept, cdef in CONCEPTS.items() for df in cdef.doc_fields
}

_TABLE_LABELS = {
    "career.experience_records": "your current role on file",
    "career.career_profiles": "your career profile",
    "family.insurance_profiles": "your insurance profile",
}

# Precedence (Phase 6D): lower rank = higher authority. Never auto-overwrite a higher-rank value.
_PRECEDENCE = {"user_confirmed": 1, "user_edited": 2, "user_entered": 3, "verified": 4, "inferred": 7,
               "needs_review": 8, "rejected": 99}


class ConflictDetectionService:
    def __init__(self, supabase: SupabaseClient) -> None:
        self._sb = supabase
        self._doc_titles: dict[str, str] = {}

    # ── helpers ──────────────────────────────────────────────────────────────
    @staticmethod
    def _cid(ctx: UserContext, concept: str) -> str:
        return str(uuid.uuid5(_NS, f"{ctx.user_id}:{concept}"))

    @staticmethod
    def _iid(conflict_id: str, claim: dict) -> str:
        anchor = f"{claim['source_table']}:{claim.get('source_record_id')}:{claim.get('document_field_id')}"
        return str(uuid.uuid5(_NS, f"{conflict_id}:{anchor}"))

    @staticmethod
    def _normalize(kind: str, v: Any) -> str:
        return _NORMALIZERS.get(kind, _norm_text)(v)

    @staticmethod
    def _precedence(claim: dict) -> int:
        rs = (claim.get("review_status") or "").lower()
        if rs in _PRECEDENCE:
            return _PRECEDENCE[rs]
        conf = float(claim.get("confidence") or 0)  # 'extracted'/unknown → by confidence
        return 5 if conf >= 0.8 else 6 if conf >= 0.6 else 8

    def _rank(self, claims: list[dict]) -> list[dict]:
        return sorted(claims, key=lambda c: (self._precedence(c), -float(c.get("confidence") or 0), str(c.get("value"))))

    def _source_label(self, claim: Optional[dict]) -> Optional[str]:
        if not claim:
            return None
        if claim.get("source_type") == "document":
            return self._doc_titles.get(claim.get("source_document_id"), "an uploaded document")
        st = claim.get("source_table") or ""
        return _TABLE_LABELS.get(st, st.split(".")[-1].replace("_", " "))

    def _recommendation(self, ranked: list[dict], *, potential: bool) -> str:
        if not ranked:
            return ""
        w = ranked[0]
        base = f"Keep '{w['value']}' (from {self._source_label(w)})"
        if len(ranked) > 1:
            o = ranked[1]
            base += f" over '{o['value']}' (from {self._source_label(o)})"
        base += " — it has higher source precedence."
        prefix = "Potential conflict — both sources are low-confidence; please confirm. " if potential else ""
        return prefix + base

    def _severity(self, cdef: ConceptDef, claims: list[dict]) -> tuple[str, bool]:
        """Return (severity, is_potential). No trusted source ⇒ potential/low. Two strong sources
        disagreeing on a high-base concept ⇒ critical."""
        if not any(self._precedence(c) <= 4 for c in claims):
            return "low", True
        strong_vals = {c["normalized_value"] for c in claims if self._precedence(c) <= 5 and c["normalized_value"]}
        if cdef.severity == "high" and len(strong_vals) > 1:
            return "critical", False
        return cdef.severity, False

    async def _doc_title_map(self, ctx: UserContext) -> dict[str, str]:
        docs = await self._sb.select("documents", filters={"user_id": f"eq.{ctx.user_id}"}, schema=DOCS) or []
        return {d["id"]: (d.get("title") or (d.get("doc_type") or "document").replace("_", " ")) for d in docs}

    async def _conflict_row(self, ctx: UserContext, conflict_id: str) -> Optional[dict]:
        rows = await self._sb.select("field_conflicts", filters={"id": f"eq.{conflict_id}", "user_id": f"eq.{ctx.user_id}"}, schema=DOCS)
        return rows[0] if rows else None

    async def _items(self, ctx: UserContext, conflict_id: str) -> list[dict]:
        return await self._sb.select("field_conflict_items",
                                     filters={"conflict_id": f"eq.{conflict_id}", "user_id": f"eq.{ctx.user_id}"}, schema=DOCS) or []

    # ── claim gathering ────────────────────────────────────────────────────────
    async def _gather(self, ctx: UserContext) -> list[dict]:
        self._doc_titles = await self._doc_title_map(ctx)
        claims: list[dict] = []
        # Document claims: every extracted field (except user-rejected) mapped to a concept.
        docs = await self._sb.select("documents", filters={"user_id": f"eq.{ctx.user_id}"}, schema=DOCS) or []
        doctype = {d["id"]: d.get("doc_type") for d in docs}
        fields = await self._sb.select("document_fields", filters={"user_id": f"eq.{ctx.user_id}"}, schema=DOCS) or []
        for f in fields:
            rs = (f.get("review_status") or "extracted").lower()
            if rs == "rejected":
                continue
            concept = DOC_FIELD_INDEX.get((doctype.get(f.get("document_id")), f.get("field_key")))
            if not concept:
                continue
            cdef = CONCEPTS[concept]
            raw = str(f.get("field_value"))
            claims.append({
                "concept": concept, "source_type": "document", "source_table": "documents.document_fields",
                "source_record_id": f.get("id"), "source_document_id": f.get("document_id"),
                "document_field_id": f.get("id"), "value": raw,
                "normalized_value": self._normalize(cdef.normalizer, raw),
                "confidence": float(f.get("confidence") or 0), "review_status": rs,
                "page_number": f.get("page_number"), "section": f.get("section"),
            })
        # Domain claims: user-entered values (treated as authoritative — the user typed them).
        for concept, cdef in CONCEPTS.items():
            for ds in cdef.domain_sources:
                rows = await self._sb.select(ds.table, filters={"user_id": f"eq.{ctx.user_id}"}, schema=ds.schema) or []
                for r in rows:
                    if ds.where and not ds.where(r):
                        continue
                    val = r.get(ds.value_col)
                    if val is None or str(val).strip() == "":
                        continue
                    raw = str(val)
                    claims.append({
                        "concept": concept, "source_type": "domain", "source_table": f"{ds.schema}.{ds.table}",
                        "source_record_id": r.get("id"), "source_document_id": None, "document_field_id": None,
                        "value": raw, "normalized_value": self._normalize(cdef.normalizer, raw),
                        "confidence": 1.0, "review_status": "user_entered", "page_number": None, "section": None,
                    })
        return claims

    # ── scan / detect (Phase 6E) ────────────────────────────────────────────────
    async def scan(self, ctx: UserContext) -> list[dict]:
        """Detect conflicts and persist them. Respects user_resolved/ignored decisions (never reopens
        them); auto-resolves an open conflict whose values now agree. Returns open-conflict payloads."""
        claims = await self._gather(ctx)
        by_concept: dict[str, list[dict]] = defaultdict(list)
        for c in claims:
            by_concept[c["concept"]].append(c)

        results: list[dict] = []
        for concept, cdef in CONCEPTS.items():
            cclaims = by_concept.get(concept, [])
            cid = self._cid(ctx, concept)
            existing = await self._conflict_row(ctx, cid)
            distinct = {c["normalized_value"] for c in cclaims if c["normalized_value"]}

            if len(distinct) <= 1:  # no contradiction
                if existing and existing.get("status") == "open":
                    await self._sb.update("field_conflicts", {
                        "status": "system_resolved", "resolved_at": _now(),
                        "resolution_method": "auto_match", "updated_at": _now()},
                        filters={"id": f"eq.{cid}", "user_id": f"eq.{ctx.user_id}"}, schema=DOCS)
                continue
            if existing and existing.get("status") in ("user_resolved", "ignored"):
                continue  # respect the user's decision — do not reopen

            severity, potential = self._severity(cdef, cclaims)
            ranked = self._rank(cclaims)
            row = {
                "id": cid, "user_id": ctx.user_id, "tenant_id": ctx.user_id, "domain": cdef.domain,
                "conflict_type": cdef.conflict_type, "field_key": concept, "status": "open",
                "severity": severity, "winning_value": None, "winning_source_id": None,
                "notes": self._recommendation(ranked, potential=potential), "updated_at": _now(),
            }
            if not existing:
                row["created_at"] = _now()
            await self._sb.upsert("field_conflicts", row, schema=DOCS)
            items: list[dict] = []
            for c in cclaims:
                item = {
                    "id": self._iid(cid, c), "conflict_id": cid, "user_id": ctx.user_id, "tenant_id": ctx.user_id,
                    "source_type": c["source_type"], "source_table": c["source_table"],
                    "source_record_id": c["source_record_id"], "source_document_id": c["source_document_id"],
                    "document_field_id": c["document_field_id"], "value": c["value"],
                    "normalized_value": c["normalized_value"], "confidence": c["confidence"],
                    "review_status": c["review_status"], "page_number": c.get("page_number"), "section": c.get("section"),
                }
                await self._sb.upsert("field_conflict_items", item, schema=DOCS)
                items.append(item)
            results.append(self._payload(row, items))
        return results

    # ── read (Phase 6E/6F) ──────────────────────────────────────────────────────
    def _payload(self, row: dict, items: list[dict]) -> dict:
        ranked = self._rank(items)
        winner = ranked[0] if ranked else None
        return {
            "id": row["id"], "domain": row.get("domain"), "conflict_type": row.get("conflict_type"),
            "field_key": row.get("field_key"), "label": CONCEPTS.get(row.get("field_key"), None).label
            if row.get("field_key") in CONCEPTS else row.get("field_key"),
            "status": row.get("status"), "severity": row.get("severity"),
            "winning_value": row.get("winning_value"), "resolution_method": row.get("resolution_method"),
            "created_at": row.get("created_at"), "updated_at": row.get("updated_at"),
            "items": items,
            "competing_values": sorted({i.get("normalized_value") for i in items if i.get("normalized_value")}),
            "recommended": {
                "item_id": winner.get("id") if winner else None,
                "value": winner.get("value") if winner else None,
                "source_label": self._source_label(winner),
                "text": row.get("notes") or self._recommendation(ranked, potential=False),
            },
        }

    async def list_conflicts(self, ctx: UserContext, *, status: Optional[str] = None,
                             include_resolved: bool = False) -> list[dict]:
        filters: dict[str, str] = {"user_id": f"eq.{ctx.user_id}"}
        if status:
            filters["status"] = f"eq.{status}"
        rows = await self._sb.select("field_conflicts", filters=filters, schema=DOCS) or []
        if not status and not include_resolved:
            rows = [r for r in rows if r.get("status") == "open"]
        self._doc_titles = await self._doc_title_map(ctx)
        out = []
        for r in rows:
            out.append(self._payload(r, await self._items(ctx, r["id"])))
        return out

    async def get_conflict(self, ctx: UserContext, *, conflict_id: str) -> Optional[dict]:
        row = await self._conflict_row(ctx, conflict_id)
        if not row:
            return None
        self._doc_titles = await self._doc_title_map(ctx)
        return self._payload(row, await self._items(ctx, conflict_id))

    # ── resolve (Phase 6F) ──────────────────────────────────────────────────────
    async def resolve(self, ctx: UserContext, *, conflict_id: str, resolution: str,
                      value: Optional[str] = None, item_id: Optional[str] = None) -> dict:
        """Apply the user's decision. keep → adopt a chosen item's value; value → a corrected value;
        ignore → dismiss. Stores the winning value; never silently overwrites the source records."""
        row = await self._conflict_row(ctx, conflict_id)
        if not row:
            raise ValueError("conflict not found")
        patch: dict[str, Any] = {"updated_at": _now(), "resolved_at": _now(), "resolved_by": ctx.user_id}
        if resolution == "ignore":
            patch.update(status="ignored", resolution_method="user_ignored")
        elif resolution in ("keep", "select"):
            if not item_id:
                raise ValueError("resolution 'keep' requires item_id")
            chosen = next((i for i in await self._items(ctx, conflict_id) if str(i.get("id")) == str(item_id)), None)
            if not chosen:
                raise ValueError("item not found")
            patch.update(status="user_resolved", winning_value=chosen.get("value"),
                         winning_source_id=item_id, resolution_method="user_selected")
        elif resolution in ("value", "corrected"):
            if not value:
                raise ValueError("resolution 'value' requires value")
            patch.update(status="user_resolved", winning_value=str(value),
                         winning_source_id=None, resolution_method="user_corrected")
        else:
            raise ValueError(f"unknown resolution {resolution}")
        await self._sb.update("field_conflicts", patch,
                              filters={"id": f"eq.{conflict_id}", "user_id": f"eq.{ctx.user_id}"}, schema=DOCS)
        return {"conflict_id": conflict_id, "status": patch["status"],
                "winning_value": patch.get("winning_value"), "resolution_method": patch["resolution_method"]}

    async def compare_claims(self, ctx: UserContext, claims: list[dict]) -> list[dict]:
        """Detect conflicts among AD-HOC claims WITHOUT persisting — reuses the same normalizers,
        precedence, severity, and recommendation as scan(). Used for pre-import previews (Phase 8E):
        the caller supplies claims (each with concept/conflict_type/domain/severity/normalizer +
        value/source_type/source_table/source_document_id/confidence/review_status)."""
        self._doc_titles = await self._doc_title_map(ctx)
        by_concept: dict[str, list[dict]] = defaultdict(list)
        for c in claims:
            c = dict(c)
            c["normalized_value"] = self._normalize(c.get("normalizer", "text"), c.get("value"))
            by_concept[c["concept"]].append(c)
        out: list[dict] = []
        for concept, cl in by_concept.items():
            distinct = {c["normalized_value"] for c in cl if c["normalized_value"]}
            if len(distinct) <= 1:
                continue
            base_sev = cl[0].get("severity", "medium")
            if not any(self._precedence(c) <= 4 for c in cl):
                severity, potential = "low", True
            else:
                strong = {c["normalized_value"] for c in cl if self._precedence(c) <= 5 and c["normalized_value"]}
                severity, potential = ("critical", False) if base_sev == "high" and len(strong) > 1 else (base_sev, False)
            ranked = self._rank(cl)
            out.append({
                "concept": concept, "conflict_type": cl[0].get("conflict_type", concept),
                "domain": cl[0].get("domain", "core"), "label": cl[0].get("label", concept),
                "severity": severity, "competing_values": sorted(distinct),
                "items": [{"value": c.get("value"), "source_type": c.get("source_type"),
                           "source_table": c.get("source_table"), "source_label": self._source_label(c),
                           "confidence": c.get("confidence"), "review_status": c.get("review_status")} for c in cl],
                "recommended": {"value": ranked[0].get("value"), "source_label": self._source_label(ranked[0]),
                                "text": self._recommendation(ranked, potential=potential)},
            })
        return out

    # ── advisor + report grounding (Phase 6G/6H) ────────────────────────────────
    async def unresolved_summary(self, ctx: UserContext) -> list[dict]:
        """Compact open-conflict list for reports — flag, never resolve."""
        return [{
            "conflict_type": c["conflict_type"], "field_key": c["field_key"], "label": c["label"],
            "severity": c["severity"], "domain": c["domain"],
            "values": [i["value"] for i in c["items"]],
            "recommended": c["recommended"]["text"],
        } for c in await self.list_conflicts(ctx, status="open")]


async def open_conflict_facts(sb: SupabaseClient, ctx: UserContext) -> list[dict[str, Any]]:
    """Advisor grounding (Phase 6G): emit each OPEN conflict as a fact so the advisor knows the data
    is contested and asks the user to confirm instead of choosing silently."""
    svc = ConflictDetectionService(sb)
    out: list[dict[str, Any]] = []
    for c in await svc.list_conflicts(ctx, status="open"):
        vals = " vs ".join(f"'{i['value']}' ({svc._source_label(i)})" for i in c["items"][:3])
        out.append({
            "id": f"conflict:{c['id']}", "domain": c.get("domain", "core"), "label": "Data conflict",
            "value": f"{c['label']}: {vals} — conflicting and unresolved; ask the user which is current.",
            "source": "Conflict detection", "sourceTable": "documents.field_conflicts",
            "recordId": c["id"], "confidence": 0.99, "updatedAt": c.get("updated_at"),
        })
    return out
