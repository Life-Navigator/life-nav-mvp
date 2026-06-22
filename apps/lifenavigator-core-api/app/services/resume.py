"""Resume import pipeline (Document Intelligence Trust Sprint — Phase 8).

A resume is "just another document intelligence source": the uploaded file is a normal
documents.documents row (doc_type='resume'); we extract its STRUCTURED, multi-record content
(employment / volunteer / projects / education / certifications / skills) into reviewable staging
rows (documents.resume_items) with provenance + confidence + a review lifecycle. Nothing
auto-imports — the user reviews each item, then approved items are written to the real domain
tables (career.* / public.education_records / education.certifications) with provenance preserved in
the row's metadata. Conflict detection (Phase 6) and the document/provenance stack (Phase 5) are
REUSED, never duplicated.

Extraction is deterministic (section segmentation + per-section heuristics). An LLM pass is the
upgrade path for unusual layouts — and `confidence` is scored honestly so low-confidence records
land in `needs_review`, never silently imported.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from ..clients.supabase import SupabaseClient
from ..models.common import UserContext
from .conflicts import _norm_org, _norm_text, _norm_title  # reuse Phase 6 normalizers
from .documents import _page_for_offset  # reuse provenance page mapping

DOCS = "documents"
_NS = uuid.UUID("6f3b1e22-0000-4000-8000-00000000000d")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─────────────────────────────────────────────────────────────────────────────
# Section segmentation + parsing heuristics.
# ─────────────────────────────────────────────────────────────────────────────
_SECTION_PATTERNS: list[tuple[str, re.Pattern]] = [
    ("employment", re.compile(r"^(work\s+|professional\s+|relevant\s+)?(experience|employment|work history|career history)\b", re.I)),
    ("education", re.compile(r"^(education|academic background|academics)\b", re.I)),
    ("certifications", re.compile(r"^(certificat(es?|ions?)|licen[sc]es?|credentials)\b", re.I)),
    ("projects", re.compile(r"^(projects?|portfolio|selected projects)\b", re.I)),
    ("volunteer", re.compile(r"^(volunteer|community service|community involvement|volunteering)\b", re.I)),
    ("skills", re.compile(r"^(skills|technical skills|core competencies|competencies|technologies)\b", re.I)),
]
_DEGREE_PATTERNS: list[tuple[str, re.Pattern]] = [
    ("doctorate", re.compile(r"\b(ph\.?\s?d|doctor(ate)?|d\.?phil)\b", re.I)),
    ("master", re.compile(r"\b(master('?s)?|m\.?s\.?|m\.?b\.?a\.?|m\.?a\.?|m\.?eng|m\.?ed)\b", re.I)),
    ("bachelor", re.compile(r"\b(bachelor('?s)?|b\.?s\.?|b\.?a\.?|b\.?eng|undergraduate)\b", re.I)),
    ("associate", re.compile(r"\b(associate('?s)?|a\.?a\.?|a\.?s\.?)\b", re.I)),
    ("certificate", re.compile(r"\bcertificate\b", re.I)),
    ("high_school", re.compile(r"\b(high school|diploma|g\.?e\.?d)\b", re.I)),
]
_MONTHS = "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec"
_DATE_TOKEN = rf"((?:{_MONTHS})[a-z]*\.?\s+\d{{4}}|\d{{1,2}}/\d{{4}}|\d{{4}}-\d{{2}}|\d{{4}})"
_PRESENT = re.compile(r"\b(present|current|now|ongoing)\b", re.I)
_DATE_RANGE = re.compile(rf"{_DATE_TOKEN}\s*(?:-|–|—|to|through)\s*({_DATE_TOKEN}|present|current|now|ongoing)", re.I)
_YEAR = re.compile(r"\b(19|20)\d{2}\b")
_LOCATION = re.compile(r"\b([A-Z][a-zA-Z.\- ]+,\s*[A-Z]{2})\b")
_MONTH_NUM = {m: i + 1 for i, m in enumerate(_MONTHS.split("|"))}


def _to_iso(token: Optional[str]) -> Optional[str]:
    if not token:
        return None
    t = token.strip().lower()
    m = re.match(rf"({_MONTHS})[a-z]*\.?\s+(\d{{4}})", t)
    if m:
        return f"{int(m.group(2)):04d}-{_MONTH_NUM[m.group(1)]:02d}-01"
    m = re.match(r"(\d{1,2})/(\d{4})", t)
    if m:
        return f"{int(m.group(2)):04d}-{int(m.group(1)):02d}-01"
    m = re.match(r"(\d{4})-(\d{2})", t)
    if m:
        return f"{m.group(1)}-{m.group(2)}-01"
    m = re.match(r"(19|20)\d{2}$", t)
    if m:
        return f"{t}-01-01"
    return None


def _split_blocks(section_text: str) -> list[str]:
    """Split a section into entry blocks on blank lines (the universal resume entry separator)."""
    blocks, cur = [], []
    for line in section_text.splitlines():
        if line.strip():
            cur.append(line.rstrip())
        elif cur:
            blocks.append("\n".join(cur))
            cur = []
    if cur:
        blocks.append("\n".join(cur))
    return blocks


def _dates_from(text: str) -> tuple[Optional[str], Optional[str], bool]:
    rng = _DATE_RANGE.search(text)
    if rng:
        start = _to_iso(rng.group(1))
        end_raw = rng.group(2)  # the whole end alternation (a date token OR present/current/…)
        is_current = bool(_PRESENT.search(end_raw or ""))
        end = None if is_current else _to_iso(end_raw)
        return start, end, is_current
    m = _YEAR.search(text)
    if m:
        return _to_iso(m.group(0)), None, bool(_PRESENT.search(text))
    return None, None, bool(_PRESENT.search(text))


def _split_header(header: str) -> tuple[Optional[str], Optional[str]]:
    """Best-effort (title, employer) from an entry header line (dates already stripped)."""
    h = _LOCATION.sub("", header).strip(" |•·,—–-")  # drop a trailing/embedded location first
    if " at " in f" {h.lower()} ":
        parts = re.split(r"\s+at\s+", h, maxsplit=1, flags=re.I)
        return (parts[0].strip() or None), (parts[1].strip() if len(parts) > 1 else None)
    # Prefer pipe/bullet columns (e.g. "Title | Company | …"); fall back to comma, then dash.
    tokens = [t.strip() for t in re.split(r"\s*[|•·]\s*", h) if t.strip()]
    if len(tokens) >= 2:
        return tokens[0] or None, tokens[1] or None
    h = tokens[0] if tokens else h
    if "," in h:
        a, _, b = h.partition(",")
        return a.strip() or None, b.strip() or None
    for sep in ("—", "–", " - "):
        if sep in h:
            a, _, b = h.partition(sep)
            return a.strip() or None, b.strip() or None
    return h.strip() or None, None


class ResumeExtractor:
    """Deterministic resume → structured records. Section-segment, then parse per section."""

    def sections(self, text: str) -> dict[str, str]:
        """Map each detected section name → its raw text body."""
        out: dict[str, str] = {}
        current: Optional[str] = None
        buf: list[str] = []
        for line in (text or "").splitlines():
            stripped = re.sub(r"[^\w\s/&+-]", "", line).strip()
            heading = None
            if 0 < len(stripped) <= 40:
                for name, pat in _SECTION_PATTERNS:
                    if pat.match(stripped):
                        heading = name
                        break
            if heading:
                if current and buf:
                    out[current] = (out.get(current, "") + "\n" + "\n".join(buf)).strip()
                current, buf = heading, []
            elif current:
                buf.append(line)
        if current and buf:
            out[current] = (out.get(current, "") + "\n" + "\n".join(buf)).strip()
        return out

    def is_resume(self, text: str) -> bool:
        """Inference fallback: ≥2 recognized sections ⇒ looks like a resume."""
        return len(self.sections(text)) >= 2

    def extract(self, text: str, pages: Optional[list[tuple[int, int]]] = None) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        secs = self.sections(text)
        for section, body in secs.items():
            label = section
            offset = (text or "").find(body[:40]) if body else -1
            page = _page_for_offset(offset, pages) if offset >= 0 else None
            if section == "skills":
                items += self._skills(body, page, label)
            elif section in ("employment", "volunteer", "projects"):
                items += self._experience(section, body, page, label)
            elif section == "education":
                items += self._education(body, page, label)
            elif section == "certifications":
                items += self._certifications(body, page, label)
        return items

    @staticmethod
    def _mk(section, fields, conf, page, label) -> dict[str, Any]:
        return {"section": section, "fields": fields, "confidence": round(conf, 2),
                "page_number": page, "section_label": label}

    def _experience(self, section: str, body: str, page, label) -> list[dict[str, Any]]:
        out = []
        for block in _split_blocks(body):
            lines = [l for l in block.splitlines() if l.strip()]
            if not lines:
                continue
            start, end, is_current = _dates_from(block)
            header = lines[0]
            # strip a trailing date range from the header before splitting title/employer
            header = _DATE_RANGE.sub("", header).strip(" |•·,—–-")
            a, b = _split_header(header)
            loc = _LOCATION.search(block)
            desc = "\n".join(lines[1:]).strip() or None
            conf = 0.45 + (0.2 if (start or end or is_current) else 0) + (0.2 if b else 0) + (0.1 if a else 0)
            if section == "employment":
                fields = {"title": a, "employer": b, "start_date": start, "end_date": end,
                          "is_current": is_current, "location": loc.group(1) if loc else None, "description": desc}
            elif section == "volunteer":
                fields = {"organization": b or a, "role": a if b else None, "start_date": start,
                          "end_date": end, "is_current": is_current, "description": desc}
            else:  # projects
                fields = {"name": a, "role": b, "project_type": None, "start_date": start,
                          "end_date": end, "description": desc}
            out.append(self._mk(section, fields, min(conf, 0.95), page, label))
        return out

    _SCHOOL_RE = re.compile(r"\b(university|college|institute|school|academy|polytechnic)\b", re.I)

    def _education(self, body: str, page, label) -> list[dict[str, Any]]:
        # Group into entries: a line containing a degree keyword starts a new entry; following
        # non-degree lines append to it. Handles both one-line-per-degree and multi-line layouts.
        entries: list[list[str]] = []
        for raw in body.splitlines():
            line = raw.strip()
            if not line:
                continue
            if any(pat.search(line) for _, pat in _DEGREE_PATTERNS) or not entries:
                entries.append([line])
            else:
                entries[-1].append(line)
        out = []
        for lines in entries:
            block = "\n".join(lines)
            degree_type = next((name for name, pat in _DEGREE_PATTERNS if pat.search(block)), None)
            # institution: the comma-part (or line) carrying a school keyword.
            inst = None
            parts = [p.strip() for ln in lines for p in ln.split(",")]
            for p in parts:
                if self._SCHOOL_RE.search(p):
                    inst = re.sub(r"\b(19|20)\d{2}\b", "", p).strip(" ,–—-|") or None
                    break
            if not inst:  # fall back to a non-degree comma-part
                for p in parts:
                    if p and not any(pat.search(p) for _, pat in _DEGREE_PATTERNS) and not _YEAR.fullmatch(p.strip()):
                        inst = re.sub(r"\b(19|20)\d{2}\b", "", p).strip(" ,–—-|") or None
                        break
            m = re.search(r"\bin\s+([A-Z][A-Za-z &]+?)(?:,|\s+from\b|$)", block)
            fos = m.group(1).strip() if m else None
            status = "in_progress" if re.search(r"\b(expected|in progress|present|current|candidate|pursuing)\b", block, re.I) else (
                "completed" if _YEAR.search(block) else None)
            grad = _to_iso(_YEAR.search(block).group(0)) if _YEAR.search(block) else None
            conf = 0.4 + (0.25 if degree_type else 0) + (0.2 if inst else 0) + (0.15 if grad else 0)
            out.append(self._mk("education", {"institution_name": inst, "degree_type": degree_type,
                                              "field_of_study": fos, "graduation_date": grad,
                                              "status": status, "is_current": status == "in_progress"},
                                min(conf, 0.95), page, label))
        return out

    def _certifications(self, body: str, page, label) -> list[dict[str, Any]]:
        out = []
        for raw in body.splitlines():
            line = raw.strip(" -•·\t")
            if not line or len(line) < 3:
                continue
            issuer = None
            name = line
            for sep in (" — ", " – ", " by ", " - ", ", ", " | "):
                if sep in line:
                    name, _, issuer = line.partition(sep)
                    name = name.strip()
                    issuer = re.sub(r",?\s*(19|20)\d{2}\s*$", "", issuer).strip()  # drop trailing year
                    break
            issue = _to_iso(_YEAR.search(line).group(0)) if _YEAR.search(line) else None
            conf = 0.55 + (0.2 if issuer else 0) + (0.15 if issue else 0)
            out.append(self._mk("certifications", {"name": name, "issuer": issuer or None,
                                                   "issue_date": issue, "expiration_date": None,
                                                   "status": "active"}, min(conf, 0.95), page, label))
        return out

    def _skills(self, body: str, page, label) -> list[dict[str, Any]]:
        tokens: list[str] = []
        for chunk in re.split(r"[\n,;•·|/]+", body):
            t = chunk.strip(" -\t")
            if 1 < len(t) <= 40 and not _SECTION_PATTERNS[0][1].match(t):
                tokens.append(t)
        seen, out = set(), []
        for t in tokens:
            k = t.lower()
            if k in seen:
                continue
            seen.add(k)
            out.append(self._mk("skills", {"name": t, "category": "general"}, 0.7, page, label))
        return out


# Map each section → (schema, table). skills are evidence-only (never inflate readiness).
_TARGETS: dict[str, tuple[Optional[str], Optional[str]]] = {
    "employment": ("career", "experience_records"),
    "volunteer": ("career", "volunteer_records"),
    "projects": ("career", "side_projects"),
    "education": ("public", "education_records"),
    "certifications": ("education", "certifications"),
    "skills": (None, None),
}
_SECTION_TITLES = {"employment": "Employment History", "volunteer": "Volunteer Experience",
                   "projects": "Projects", "education": "Education",
                   "certifications": "Certifications", "skills": "Skills"}


class ResumeImportService:
    def __init__(self, supabase: SupabaseClient, extractor: Optional[ResumeExtractor] = None) -> None:
        self._sb = supabase
        self._ex = extractor or ResumeExtractor()

    # ── ingest (8A/8B/8C) ───────────────────────────────────────────────────────
    async def ingest(self, ctx: UserContext, *, text: str, pages: Optional[list] = None,
                     title: Optional[str] = None, file_ref: Optional[str] = None,
                     _doc_id: Optional[str] = None, source_kind: str = "text") -> dict[str, Any]:
        items = self._ex.extract(text or "", pages)
        doc_id = _doc_id or str(uuid.uuid4())
        existing = await self._sb.select("documents", filters={"user_id": f"eq.{ctx.user_id}", "doc_type": "eq.resume"}, schema=DOCS) or []
        version = len(existing) + 1
        overall = round(sum(i["confidence"] for i in items) / len(items), 2) if items else 0.0
        counts: dict[str, int] = {}
        for it in items:
            counts[it["section"]] = counts.get(it["section"], 0) + 1
        status = "extracted" if items else "needs_review"
        await self._sb.insert("documents", {
            "id": doc_id, "user_id": ctx.user_id, "tenant_id": ctx.user_id, "doc_type": "resume",
            "category": "employment", "title": title or "Resume", "file_ref": file_ref,
            "status": status, "status_reason": "extracted" if items else "no_sections_detected",
            "confidence": overall, "extracted_json": {"resume_version": version, "sections": counts},
            "affects_domains": ["career", "education"],
        }, schema=DOCS)
        for it in items:
            review = "needs_review" if it["confidence"] < 0.6 else "extracted"
            await self._sb.insert("resume_items", {
                "id": str(uuid.uuid4()), "user_id": ctx.user_id, "tenant_id": ctx.user_id,
                "document_id": doc_id, "section": it["section"], "fields": it["fields"],
                "confidence": it["confidence"], "page_number": it["page_number"],
                "section_label": it["section_label"], "review_status": review,
            }, schema=DOCS)
        review_payload = await self.review_payload(ctx, document_id=doc_id)
        return {"document_id": doc_id, "doc_type": "resume", "category": "employment",
                "resume_version": version, "confidence": overall, "status": status,
                "fields_extracted": len(items), "sections": counts,
                "affects_domains": ["career", "education"],
                "review": review_payload, "message": None if items else
                "We couldn't detect resume sections. Paste the text or upload a text-based PDF/DOCX."}

    async def _items(self, ctx: UserContext, document_id: str) -> list[dict]:
        return await self._sb.select("resume_items",
                                     filters={"document_id": f"eq.{document_id}", "user_id": f"eq.{ctx.user_id}"}, schema=DOCS) or []

    # ── review payload (8C) ──────────────────────────────────────────────────────
    async def review_payload(self, ctx: UserContext, *, document_id: str) -> dict[str, Any]:
        items = await self._items(ctx, document_id)
        sections: dict[str, list[dict]] = {}
        for it in items:
            sections.setdefault(it["section"], []).append({
                "id": it["id"], "fields": it.get("fields"), "confidence": it.get("confidence"),
                "page_number": it.get("page_number"), "section_label": it.get("section_label"),
                "review_status": it.get("review_status"), "target_record_id": it.get("target_record_id"),
            })
        return {"document_id": document_id,
                "sections": [{"section": s, "title": _SECTION_TITLES.get(s, s), "items": sections[s]}
                             for s in _SECTION_TITLES if s in sections]}

    # ── per-item review action (8C) ──────────────────────────────────────────────
    async def set_item(self, ctx: UserContext, *, item_id: str, action: str,
                       fields: Optional[dict] = None) -> dict[str, Any]:
        if action == "ignore":
            patch = {"review_status": "ignored", "updated_at": _now()}
        elif action == "edit":
            if not fields:
                raise ValueError("edit requires fields")
            patch = {"review_status": "user_edited", "fields": fields, "updated_at": _now()}
        elif action == "reset":
            patch = {"review_status": "extracted", "updated_at": _now()}
        else:
            raise ValueError(f"unknown action {action}")
        await self._sb.update("resume_items", patch,
                              filters={"id": f"eq.{item_id}", "user_id": f"eq.{ctx.user_id}"}, schema=DOCS)
        return {"item_id": item_id, **patch}

    # ── conflict preview (8E) — reuse the Phase 6 engine, no duplication ──────────
    async def preview_conflicts(self, ctx: UserContext, *, document_id: str) -> list[dict]:
        from .conflicts import ConflictDetectionService
        items = await self._items(ctx, document_id)
        claims: list[dict] = []
        # resume side: current role / employer (from the current-or-first employment item), degree status
        emp = [i for i in items if i["section"] == "employment" and i["review_status"] != "ignored"]
        cur_emp = next((i for i in emp if (i.get("fields") or {}).get("is_current")), emp[0] if emp else None)
        if cur_emp:
            f = cur_emp.get("fields") or {}
            if f.get("title"):
                claims.append(self._claim("current_role", "Current role", "career", "current_role_mismatch",
                                          "medium", "title", "document", "documents.resume_items",
                                          f["title"], cur_emp["confidence"], cur_emp["review_status"], document_id))
            if f.get("employer"):
                claims.append(self._claim("current_employer", "Current employer", "career", "current_employer_mismatch",
                                          "medium", "org", "document", "documents.resume_items",
                                          f["employer"], cur_emp["confidence"], cur_emp["review_status"], document_id))
        for ed in [i for i in items if i["section"] == "education" and i["review_status"] != "ignored"]:
            f = ed.get("fields") or {}
            if f.get("status"):
                claims.append(self._claim("degree_status", "Degree status", "education", "degree_status_mismatch",
                                          "medium", "text", "document", "documents.resume_items",
                                          f["status"], ed["confidence"], ed["review_status"], document_id))
        # domain side: existing user-entered values
        for r in await self._sb.select("experience_records", filters={"user_id": f"eq.{ctx.user_id}"}, schema="career") or []:
            if r.get("is_current") and r.get("title"):
                claims.append(self._claim("current_role", "Current role", "career", "current_role_mismatch",
                                          "medium", "title", "domain", "career.experience_records",
                                          r["title"], 1.0, "user_entered", None))
            if r.get("is_current") and r.get("employer"):
                claims.append(self._claim("current_employer", "Current employer", "career", "current_employer_mismatch",
                                          "medium", "org", "domain", "career.experience_records",
                                          r["employer"], 1.0, "user_entered", None))
        for r in await self._sb.select("career_profiles", filters={"user_id": f"eq.{ctx.user_id}"}, schema="career") or []:
            if r.get("current_title"):
                claims.append(self._claim("current_role", "Current role", "career", "current_role_mismatch",
                                          "medium", "title", "domain", "career.career_profiles",
                                          r["current_title"], 1.0, "user_entered", None))
        for r in await self._sb.select("education_records", filters={"user_id": f"eq.{ctx.user_id}"}, schema="public") or []:
            if r.get("status"):
                claims.append(self._claim("degree_status", "Degree status", "education", "degree_status_mismatch",
                                          "medium", "text", "domain", "public.education_records",
                                          r["status"], 1.0, "user_entered", None))
        return await ConflictDetectionService(self._sb).compare_claims(ctx, claims)

    @staticmethod
    def _claim(concept, label, domain, conflict_type, severity, normalizer, source_type, source_table,
               value, confidence, review_status, document_id) -> dict:
        return {"concept": concept, "label": label, "domain": domain, "conflict_type": conflict_type,
                "severity": severity, "normalizer": normalizer, "source_type": source_type,
                "source_table": source_table, "source_document_id": document_id, "value": value,
                "confidence": confidence, "review_status": review_status}

    # ── import (8D/8F/8G) ────────────────────────────────────────────────────────
    async def import_items(self, ctx: UserContext, *, document_id: str,
                           item_ids: Optional[list[str]] = None) -> dict[str, Any]:
        """Write approved items into the real domain tables with provenance, create graph facts, then
        re-run the Phase 6 conflict scan. Ignored/already-imported items are skipped (8G)."""
        items = await self._items(ctx, document_id)
        chosen = [i for i in items if (item_ids is None or i["id"] in item_ids)
                  and i["review_status"] not in ("ignored", "imported")]
        imported: dict[str, int] = {}
        skipped: list[dict] = []
        for it in chosen:
            schema, table = _TARGETS.get(it["section"], (None, None))
            fields = it.get("fields") or {}
            prov = {"source": "resume-import", "source_document_id": document_id,
                    "source_field_id": it["id"], "source_page": it.get("page_number"),
                    "source_confidence": it.get("confidence"), "imported_at": _now()}
            row, reason = self._row_for(it["section"], fields, ctx, prov)
            if table is None:  # skills → evidence only (never a domain row, never readiness inflation)
                await self._graph_fact(ctx, it["section"], fields, document_id, it.get("confidence"))
                await self._sb.update("resume_items", {"review_status": "imported", "imported_at": _now(), "updated_at": _now()},
                                      filters={"id": f"eq.{it['id']}", "user_id": f"eq.{ctx.user_id}"}, schema=DOCS)
                imported["skills"] = imported.get("skills", 0) + 1
                continue
            if row is None:
                skipped.append({"item_id": it["id"], "section": it["section"], "reason": reason})
                continue
            await self._sb.insert(table, row, schema=schema)
            await self._sb.update("resume_items", {
                "review_status": "imported", "target_table": f"{schema}.{table}",
                "target_record_id": row["id"], "imported_at": _now(), "updated_at": _now()},
                filters={"id": f"eq.{it['id']}", "user_id": f"eq.{ctx.user_id}"}, schema=DOCS)
            await self._graph_fact(ctx, it["section"], fields, document_id, it.get("confidence"))
            imported[it["section"]] = imported.get(it["section"], 0) + 1
        # Phase 6: re-scan so any contradiction the import created surfaces in the normal conflict UI.
        try:
            from .conflicts import ConflictDetectionService
            await ConflictDetectionService(self._sb).scan(ctx)
        except Exception:  # noqa: BLE001
            pass
        return {"document_id": document_id, "imported": imported, "skipped": skipped,
                "imported_total": sum(imported.values())}

    def _row_for(self, section: str, f: dict, ctx: UserContext, prov: dict) -> tuple[Optional[dict], Optional[str]]:
        base = {"id": str(uuid.uuid4()), "user_id": ctx.user_id, "tenant_id": ctx.user_id,
                "metadata": dict(prov), "updated_at": _now()}
        if section == "employment":
            base.update(title=f.get("title"), employer=f.get("employer"), start_date=f.get("start_date"),
                        end_date=f.get("end_date"), is_current=bool(f.get("is_current")),
                        responsibilities=f.get("description"), location=f.get("location"))
        elif section == "volunteer":
            base.update(organization=f.get("organization"), role=f.get("role"), start_date=f.get("start_date"),
                        end_date=f.get("end_date"), is_current=bool(f.get("is_current")), description=f.get("description"))
        elif section == "projects":
            base.update(name=f.get("name"), role=f.get("role"), project_type=f.get("project_type"),
                        start_date=f.get("start_date"), end_date=f.get("end_date"),
                        is_active=bool(f.get("is_current")), description=f.get("description"))
        elif section == "education":
            if not f.get("institution_name"):
                return None, "missing institution_name (NOT NULL)"
            base.update(institution_name=f.get("institution_name"), degree_type=f.get("degree_type"),
                        field_of_study=f.get("field_of_study"), graduation_date=f.get("graduation_date"),
                        status=f.get("status") or "completed", is_current=bool(f.get("is_current")))
        elif section == "certifications":
            if not f.get("name"):
                return None, "missing certification name (NOT NULL)"
            meta = base["metadata"]
            meta.update(issue_date=f.get("issue_date"), expiration_date=f.get("expiration_date"))
            base.update(name=f.get("name"), issuer=f.get("issuer"), status=f.get("status") or "active")
        else:
            return None, "unsupported section"
        return base, None

    async def _graph_fact(self, ctx: UserContext, section: str, f: dict, document_id: str, conf) -> None:
        """Graph ingestion (8F): each imported entity becomes a provenance-carrying life fact, which the
        worker projects into the life graph (User → worked_at/earned/holds/completed/volunteered_at)."""
        try:
            from .ingestion import IngestionService
            value = self._fact_value(section, f)
            if not value:
                return
            await IngestionService(self._sb).submit_life_fact(ctx, {
                "fact_type": f"resume.{section}", "value": value,
                "domain": "education" if section in ("education", "certifications") else "career",
                "confidence": float(conf or 0.6), "confirmation_status": "confirmed",  # user approved the import
                "idempotency_key": f"resume:{document_id}:{section}:{value}".lower()[:200],
                "provenance": {"submitted_by": "resume-import", "source_type": "document", "document_id": document_id},
            })
        except Exception:  # noqa: BLE001 — graph projection must never break the import
            pass

    @staticmethod
    def _fact_value(section: str, f: dict) -> Optional[str]:
        if section == "employment":
            return " @ ".join(x for x in (f.get("title"), f.get("employer")) if x) or None
        if section == "volunteer":
            return " @ ".join(x for x in (f.get("role"), f.get("organization")) if x) or None
        if section == "projects":
            return f.get("name")
        if section == "education":
            return " ".join(x for x in (f.get("degree_type"), f.get("institution_name")) if x) or None
        if section == "certifications":
            return f.get("name")
        if section == "skills":
            return f.get("name")
        return None
