"""Document Intelligence Platform (Elite Sprint 10) — the data-acquisition layer.

A user uploads a document; LifeNavigator understands it. The taxonomy maps every supported
doc type (employment / benefits / insurance / financial / education / family office / military)
to the fields it should yield and the domains it feeds. The extractor pulls structured,
confidence-scored fields from the document text (deterministic labeled-field parsing; an LLM/OCR
pass is the upgrade for unstructured scans). The intelligence engine then produces the document
graph (documents + document_fields rows → :Document/:DocumentField), a readiness score (have vs
critical per category), a confidence score, a timeline (effective/expiry), and recommendations.
Nothing is invented — a field absent from the text is simply not extracted.
"""
from __future__ import annotations

import re
import uuid
from datetime import date, datetime, timezone
from typing import Any, Optional

from ..clients.supabase import SupabaseClient
from ..models.common import UserContext

DOCS = "documents"
_REC_NS = uuid.UUID("6f3b1e22-0000-4000-8000-00000000000b")
GREEN, YELLOW, ORANGE, RED = "green", "yellow", "orange", "red"


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ── Taxonomy: doc_type -> (category, label, expected fields {key: type}, affected domains, critical) ──
# `critical` doc types drive the readiness score for their category.
class T:
    def __init__(self, category, label, fields, domains, critical=False):
        self.category, self.label, self.fields, self.domains, self.critical = category, label, fields, domains, critical


TAXONOMY: dict[str, T] = {
    # Employment
    "offer_letter": T("employment", "Offer Letter", {"base_salary": "money", "signing_bonus": "money", "annual_bonus": "money", "equity_grant": "money", "start_date": "date", "title": "text"}, ["career", "finance"], True),
    "compensation_plan": T("employment", "Compensation Plan", {"base_salary": "money", "target_bonus": "percent", "equity_grant": "money", "commission_rate": "percent"}, ["career", "finance"]),
    "employment_agreement": T("employment", "Employment Agreement", {"title": "text", "start_date": "date", "non_compete_months": "number", "severance": "text"}, ["career"]),
    "promotion_letter": T("employment", "Promotion Letter", {"new_title": "text", "new_base_salary": "money", "effective_date": "date"}, ["career", "finance"]),
    # Benefits
    "medical_plan": T("benefits", "Medical Plan", {"premium": "money", "deductible": "money", "out_of_pocket_max": "money", "coverage_type": "text"}, ["health", "finance"], True),
    "dental_plan": T("benefits", "Dental Plan", {"premium": "money", "annual_max": "money"}, ["health"]),
    "vision_plan": T("benefits", "Vision Plan", {"premium": "money"}, ["health"]),
    "hsa": T("benefits", "HSA", {"balance": "money", "annual_contribution": "money", "employer_match": "money"}, ["finance", "health"]),
    "fsa": T("benefits", "FSA", {"balance": "money", "annual_contribution": "money"}, ["finance", "health"]),
    "401k_statement": T("benefits", "401(k) Statement", {"vested_balance": "money", "total_balance": "money", "contribution_rate": "percent", "employer_match": "percent"}, ["finance"], True),
    "pension": T("benefits", "Pension", {"monthly_benefit": "money", "vesting_date": "date"}, ["finance"]),
    # Insurance
    "life_insurance_policy": T("insurance", "Life Insurance Policy", {"coverage_amount": "money", "premium": "money", "beneficiary": "text", "term_years": "number"}, ["family", "finance"], True),
    "disability_insurance": T("insurance", "Disability Insurance", {"monthly_benefit": "money", "benefit_period": "text", "elimination_period_days": "number"}, ["family", "finance"], True),
    "ltc_insurance": T("insurance", "Long-Term Care Insurance", {"daily_benefit": "money", "benefit_period": "text"}, ["family", "health"]),
    "umbrella_policy": T("insurance", "Umbrella Policy", {"coverage_amount": "money", "premium": "money"}, ["family", "finance"]),
    # Financial
    "brokerage_statement": T("financial", "Brokerage Statement", {"total_value": "money", "cash_balance": "money", "as_of_date": "date"}, ["finance"], True),
    "retirement_statement": T("financial", "Retirement Statement", {"total_balance": "money", "vested_balance": "money", "as_of_date": "date"}, ["finance"], True),
    "social_security_estimate": T("financial", "Social Security Estimate", {"monthly_benefit_at_67": "money", "monthly_benefit_at_70": "money", "monthly_benefit_at_62": "money"}, ["finance"], True),
    # Education
    "financial_aid_letter": T("education", "Financial Aid Letter", {"grants": "money", "loans": "money", "work_study": "money", "net_cost": "money", "school": "text"}, ["education", "finance"], True),
    "program_details": T("education", "Program Details", {"tuition": "money", "duration_months": "number", "program": "text"}, ["education"]),
    # Family Office
    "trust": T("family_office", "Trust", {"trust_type": "text", "trustee": "text", "estimated_value": "money"}, ["family"], True),
    "will": T("family_office", "Will", {"executor": "text", "last_updated": "date"}, ["family"], True),
    "estate_plan": T("family_office", "Estate Plan", {"has_will": "text", "has_poa": "text", "has_healthcare_directive": "text"}, ["family"], True),
    # Military
    "dd214": T("military", "DD214", {"branch": "text", "discharge_type": "text", "separation_date": "date", "rank": "text"}, ["career", "finance"], True),
    "va_award_letter": T("military", "VA Award Letter", {"disability_rating": "percent", "monthly_benefit": "money", "effective_date": "date"}, ["finance", "health"], True),
    "military_retirement_statement": T("military", "Military Retirement Statement", {"monthly_pension": "money", "retirement_date": "date"}, ["finance"]),
    "les": T("military", "Leave & Earnings Statement (LES)", {"base_pay": "money", "bah": "money", "bas": "money", "net_pay": "money"}, ["finance", "career"]),
    # Health (Sprint 19) — clinical documents. Values are recorded/displayed only; never diagnosed.
    "lab_report": T("health", "Lab Report", {"total_cholesterol": "number", "hdl": "number", "ldl": "number", "triglycerides": "number", "glucose": "number", "a1c": "number", "vitamin_d": "number", "tsh": "number"}, ["health"], True),
    "supplement_list": T("health", "Supplement List", {"supplements": "text"}, ["health"]),
    "medication_list": T("health", "Medication List", {"medications": "text"}, ["health"]),
    "fitness_plan": T("health", "Fitness Plan", {"weekly_workouts": "number", "goal": "text", "target_weight": "number"}, ["health"]),
    "nutrition_log": T("health", "Nutrition Log", {"daily_calories": "number", "protein_g": "number", "carbs_g": "number", "fat_g": "number"}, ["health"]),
}
CATEGORIES = ("employment", "benefits", "insurance", "financial", "education", "family_office", "military", "health")
# Synonyms so labels in real documents resolve to canonical field keys.
_SYNONYMS = {
    "base_salary": ["base salary", "annual salary", "base pay", "salary"], "signing_bonus": ["signing bonus", "sign-on bonus"],
    "annual_bonus": ["annual bonus", "target bonus", "bonus"], "equity_grant": ["equity", "rsu", "stock grant", "equity grant"],
    "start_date": ["start date", "start"], "coverage_amount": ["coverage amount", "death benefit", "face amount", "coverage"],
    "vested_balance": ["vested balance", "vested"], "total_balance": ["total balance", "account balance", "ending balance"],
    "total_value": ["total value", "account value", "portfolio value"], "monthly_benefit": ["monthly benefit", "monthly payment"],
    "premium": ["premium", "monthly premium"], "deductible": ["deductible"], "disability_rating": ["disability rating", "combined rating"],
    "net_cost": ["net cost", "net price"], "grants": ["grants", "gift aid"], "loans": ["loans", "loan"],
    # health lab markers
    "total_cholesterol": ["total cholesterol", "cholesterol total", "cholesterol"], "hdl": ["hdl", "hdl cholesterol"],
    "ldl": ["ldl", "ldl cholesterol"], "triglycerides": ["triglycerides", "trig"], "glucose": ["glucose", "fasting glucose"],
    "a1c": ["a1c", "hba1c", "hemoglobin a1c"], "vitamin_d": ["vitamin d", "25-hydroxyvitamin d", "25-oh vitamin d"],
    "tsh": ["tsh", "thyroid stimulating hormone"], "supplements": ["supplements", "supplement"], "medications": ["medications", "medication", "meds"],
}
_MONEY = re.compile(r"\$?\s?([0-9][0-9,]*(?:\.[0-9]{1,2})?)")
_PCT = re.compile(r"([0-9]+(?:\.[0-9]+)?)\s?%")
_DATE = re.compile(r"(\d{4}-\d{2}-\d{2})|(\d{1,2}/\d{1,2}/\d{2,4})|([A-Z][a-z]+ \d{1,2},? \d{4})")


class DocumentExtractor:
    """Deterministic labeled-field extraction over document text, guided by the doc_type's
    expected fields + synonyms. (LLM/OCR is the upgrade path for unstructured scans.)"""

    def extract(self, doc_type: str, text: str) -> dict[str, Any]:
        spec = TAXONOMY.get(doc_type)
        if not spec or not text:
            return {"fields": [], "confidence": 0.0, "dates": {}}
        lower = text.lower()
        fields: list[dict[str, Any]] = []
        for key, ftype in spec.fields.items():
            labels = _SYNONYMS.get(key, [key.replace("_", " ")])
            hit = self._find(lower, text, labels, ftype)
            if hit is not None:
                value, conf = hit
                fields.append({"field_key": key, "field_value": value, "field_type": ftype, "confidence": conf})
        overall = round(sum(f["confidence"] for f in fields) / len(fields), 2) if fields else 0.0
        # surface effective/document/expiry dates if present
        dates: dict[str, Any] = {}
        for f in fields:
            if f["field_type"] == "date" and ("start" in f["field_key"] or "effective" in f["field_key"] or "as_of" in f["field_key"]):
                dates["document_date"] = f["field_value"]
        return {"fields": fields, "confidence": overall, "dates": dates}

    @staticmethod
    def _find(lower: str, original: str, labels: list[str], ftype: str) -> Optional[tuple[str, float]]:
        for label in labels:
            idx = lower.find(label)
            if idx < 0:
                continue
            window = original[idx: idx + len(label) + 40]
            if ftype == "money":
                m = _MONEY.search(window[len(label):])
                if m:
                    return m.group(1).replace(",", ""), 0.9
            elif ftype == "percent":
                m = _PCT.search(window)
                if m:
                    return m.group(1), 0.9
            elif ftype == "date":
                m = _DATE.search(window)
                if m:
                    return m.group(0), 0.85
            elif ftype == "number":
                m = re.search(r"([0-9][0-9,]*(?:\.[0-9]+)?)", window[len(label):])  # allow decimals (e.g. A1C 5.4)
                if m:
                    return m.group(1).replace(",", ""), 0.8
            else:  # text — take the rest of the line after a colon
                seg = window[len(label):].lstrip(" :\t")
                val = seg.splitlines()[0].strip() if seg else ""
                if val:
                    return val[:120], 0.7
        return None


class DocumentParser:
    """Parse uploaded bytes into text. PDF via pypdf (text-layer PDFs); text/* passthrough.
    Scanned/image PDFs return empty text → status 'needs_review' (OCR is the upgrade path)."""

    def parse(self, filename: str, content_type: str, data: bytes) -> dict[str, Any]:
        ct = (content_type or "").lower()
        name = (filename or "").lower()
        if "pdf" in ct or name.endswith(".pdf"):
            return {"text": self._pdf(data), "kind": "pdf"}
        if ct.startswith("text/") or name.endswith((".txt", ".md", ".csv")):
            return {"text": data.decode("utf-8", errors="replace"), "kind": "text"}
        if ct.startswith("image/"):
            return {"text": "", "kind": "image"}  # OCR upgrade path
        return {"text": data.decode("utf-8", errors="replace"), "kind": "unknown"}

    @staticmethod
    def _pdf(data: bytes) -> str:
        try:
            import io

            from pypdf import PdfReader  # type: ignore[import-not-found]
            reader = PdfReader(io.BytesIO(data))
            return "\n".join((page.extract_text() or "") for page in reader.pages)
        except Exception:  # noqa: BLE001 — unparseable PDF -> empty text -> needs_review
            return ""


def evidence_from_fields(doc_type: str, fields: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Generate domain-citable evidence statements from extracted fields. Each field becomes an
    evidence record sourced to the document, tagged with the domains it feeds — this is how an
    uploaded document grounds future recommendations."""
    spec = TAXONOMY.get(doc_type)
    label = spec.label if spec else doc_type
    domains = spec.domains if spec else []
    out = []
    for f in fields:
        ftype = f.get("field_type")
        val = f.get("field_value")
        shown: Any = val
        if ftype == "money" and str(val).replace(".", "").isdigit():
            shown = f"${int(float(str(val))):,}"
        elif ftype == "percent":
            shown = f"{val}%"
        out.append({"statement": f"{f['field_key'].replace('_', ' ').capitalize()}: {shown} (from your {label})",
                    "field_key": f["field_key"], "value": val, "domains": domains,
                    "confidence": f.get("confidence"), "source_document": label})
    return out


class DocumentIntelligenceService:
    def __init__(self, supabase: SupabaseClient, extractor: Optional[DocumentExtractor] = None, parser: Optional[DocumentParser] = None) -> None:
        self._sb = supabase
        self._ex = extractor or DocumentExtractor()
        self._parser = parser or DocumentParser()

    async def upload(self, ctx: UserContext, *, doc_type: str, filename: str, content_type: str, data: bytes, title: Optional[str] = None) -> dict[str, Any]:
        """Upload → store binary → parse text → extract → register → generate evidence."""
        if doc_type not in TAXONOMY:
            raise ValueError(f"unknown doc_type {doc_type}")
        doc_id = str(uuid.uuid4())
        path = f"{ctx.user_id}/{doc_id}/{(filename or 'document')[:80]}"
        await self._sb.storage_upload("documents", path, data, content_type or "application/octet-stream")
        parsed = self._parser.parse(filename, content_type, data)
        res = await self.register(ctx, doc_type=doc_type, text=parsed["text"], title=title or filename,
                                  file_ref=path, _doc_id=doc_id, source_kind=parsed["kind"])
        res["parsed_kind"] = parsed["kind"]
        res["parsed_chars"] = len(parsed["text"])
        return res

    # Sprint 32 P0/P1.5: a scanned/image document NEVER fails silently — it explains + offers a path.
    SCANNED_MESSAGE = ("This appears to be a scanned document. We saved it successfully but cannot "
                       "extract values yet. Upload a digital PDF or paste the document text to unlock "
                       "readiness scoring, recommendations, and reports.")

    @staticmethod
    def _processing_status(*, classified: bool, has_text: bool, extracted: bool) -> list[dict[str, Any]]:
        steps = [
            ("Uploaded", True, "Your document is stored securely."),
            ("Classified", classified, "We identified the document type."),
            ("Text read (OCR)", has_text, "We read the document's text." if has_text else "No machine-readable text — this looks scanned/photographed."),
            ("Evidence extracted", extracted, "We pulled the key values." if extracted else "No values extracted yet."),
            ("Recommendation ready", extracted, "Your recommendations are updated." if extracted else "Recommendations unlock once values are extracted."),
        ]
        return [{"step": s, "done": bool(d), "detail": detail} for s, d, detail in steps]

    async def register(self, ctx: UserContext, *, doc_type: str, text: str = "", title: Optional[str] = None,
                       file_ref: Optional[str] = None, _doc_id: Optional[str] = None, source_kind: str = "text") -> dict[str, Any]:
        spec = TAXONOMY.get(doc_type)
        if not spec:
            raise ValueError(f"unknown doc_type {doc_type}")
        ext = self._ex.extract(doc_type, text)
        doc_id = _doc_id or str(uuid.uuid4())
        extracted_json = {f["field_key"]: f["field_value"] for f in ext["fields"]}
        has_text = bool((text or "").strip())
        extracted = bool(ext["fields"])
        is_scanned = source_kind == "image" or (source_kind in ("pdf", "unknown") and not has_text)
        status = "extracted" if extracted else "needs_review"
        if extracted:
            reason, message, next_steps = "extracted", None, []
        elif is_scanned:
            reason = "scanned_or_image"
            message = self.SCANNED_MESSAGE
            next_steps = ["Upload a digital (text) PDF of this document", f"Or paste the {spec.label} text directly", "We'll then extract values + generate recommendations"]
        else:
            reason = "no_fields_matched"
            message = (f"We read this document but couldn't find the expected values for a {spec.label}. "
                       "Check the document type, or paste the text so we can extract it.")
            next_steps = [f"Confirm this is a {spec.label}", "Paste the document text", "Try a clearer copy"]
        await self._sb.insert("documents", {
            "id": doc_id, "user_id": ctx.user_id, "tenant_id": ctx.user_id, "doc_type": doc_type,
            "category": spec.category, "title": title or spec.label, "file_ref": file_ref,
            "status": status, "status_reason": reason, "confidence": ext["confidence"],
            "document_date": ext["dates"].get("document_date"), "extracted_json": extracted_json,
            "affects_domains": spec.domains,
        }, schema=DOCS)
        for f in ext["fields"]:
            await self._sb.insert("document_fields", {
                "id": str(uuid.uuid5(_REC_NS, f"{doc_id}:{f['field_key']}")), "document_id": doc_id,
                "user_id": ctx.user_id, "tenant_id": ctx.user_id, "field_key": f["field_key"],
                "field_value": str(f["field_value"]), "field_type": f["field_type"], "confidence": f["confidence"],
            }, schema=DOCS)
        return {"document_id": doc_id, "doc_type": doc_type, "category": spec.category,
                "fields_extracted": len(ext["fields"]), "confidence": ext["confidence"],
                "affects_domains": spec.domains, "status": status, "status_reason": reason,
                "message": message, "next_steps": next_steps,
                "processing_status": self._processing_status(classified=True, has_text=has_text, extracted=extracted),
                "fields": ext["fields"], "evidence": evidence_from_fields(doc_type, ext["fields"])}

    async def _docs(self, ctx: UserContext) -> list[dict]:
        return await self._sb.select("documents", filters={"user_id": f"eq.{ctx.user_id}"}, limit=500, schema=DOCS)

    async def readiness(self, ctx: UserContext) -> dict[str, Any]:
        docs = await self._docs(ctx)
        have_types = {d.get("doc_type") for d in docs}
        out: list[dict[str, Any]] = []
        for cat in CATEGORIES:
            critical = [dt for dt, s in TAXONOMY.items() if s.category == cat and s.critical]
            have = [dt for dt in critical if dt in have_types]
            n = len(critical)
            pct = round(100 * len(have) / n) if n else 100
            status = GREEN if pct >= 80 else YELLOW if pct >= 50 else ORANGE if pct > 0 else RED
            out.append({"category": cat, "status": status, "have": len(have), "critical": n,
                        "missing": [TAXONOMY[dt].label for dt in critical if dt not in have_types]})
        overall = round(sum(c["have"] for c in out) * 100 / max(1, sum(c["critical"] for c in out)))
        return {"overall_score": overall, "overall_status": GREEN if overall >= 80 else YELLOW if overall >= 50 else ORANGE if overall > 0 else RED,
                "categories": out, "documents_on_file": len(docs)}

    async def confidence(self, ctx: UserContext) -> dict[str, Any]:
        docs = await self._docs(ctx)
        confs = [float(d["confidence"]) for d in docs if d.get("confidence") is not None]
        return {"average": round(sum(confs) / len(confs), 2) if confs else 0.0,
                "low_confidence": [{"doc_type": d["doc_type"], "confidence": d.get("confidence")} for d in docs if (d.get("confidence") or 0) < 0.6],
                "documents": len(docs)}

    async def timeline(self, ctx: UserContext) -> list[dict[str, Any]]:
        docs = await self._docs(ctx)
        items = [{"doc_type": d["doc_type"], "title": d.get("title"), "category": d.get("category"),
                  "date": d.get("document_date") or d.get("effective_date") or (d.get("uploaded_at") or "")[:10],
                  "expiry": d.get("expiry_date"), "confidence": d.get("confidence")} for d in docs]
        return sorted(items, key=lambda x: str(x["date"] or ""))

    async def recommendations(self, ctx: UserContext) -> list[dict[str, Any]]:
        readiness = await self.readiness(ctx)
        docs = await self._docs(ctx)
        recs: list[dict[str, Any]] = []
        for cat in readiness["categories"]:
            for missing_label in cat["missing"]:
                recs.append({"title": f"Upload your {missing_label}", "priority": "high" if cat["status"] in (RED, ORANGE) else "medium",
                             "category": cat["category"], "why_it_matters": f"A {missing_label} lets LifeNavigator ground your {cat['category']} guidance in your real documents."})
        today = _now().date()
        for d in docs:
            exp = d.get("expiry_date")
            if exp:
                try:
                    if (date.fromisoformat(str(exp)[:10]) - today).days < 60:
                        recs.append({"title": f"Renew/review your {d.get('title')}", "priority": "high", "category": d.get("category"),
                                     "why_it_matters": "This document expires soon."})
                except (ValueError, TypeError):
                    pass
            if (d.get("confidence") or 0) < 0.6:
                recs.append({"title": f"Review extraction for {d.get('title')}", "priority": "medium", "category": d.get("category"),
                             "why_it_matters": "Low extraction confidence — confirm the values."})
        # persist (idempotent-ish by title+user)
        for r in recs[:25]:
            await self._sb.upsert("document_recommendations", {
                "id": str(uuid.uuid5(_REC_NS, f"{ctx.user_id}:{r['title']}")), "user_id": ctx.user_id, "tenant_id": ctx.user_id,
                "title": r["title"], "why_it_matters": r["why_it_matters"], "priority": r["priority"], "category": r.get("category"),
                "evidence_json": [{"statement": r["why_it_matters"], "source_table": "documents.documents"}],
            }, schema=DOCS)
        return recs
