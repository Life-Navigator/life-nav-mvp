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
from .ingestion import IngestionService

DOCS = "documents"
FAMILY = "family"
_REC_NS = uuid.UUID("6f3b1e22-0000-4000-8000-00000000000b")

# ── PII safeguard (Sprint 42B): detect sensitive identifiers in uploads. High-precision so normal
# financial numbers (balances, rates) don't false-positive. We return categories + COUNTS only —
# never the matched values — and never store them. ──
_SSN_RE = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")
_SSN_LABELED_RE = re.compile(r"(?i)\b(?:ssn|social\s*security)\b[^0-9]{0,15}(\d{9}|\d{3}-\d{2}-\d{4})")
_CARD_RE = re.compile(r"\b(?:\d[ -]?){13,19}\b")
_ROUTING_RE = re.compile(r"(?i)\b(?:routing|aba|rtn)\b[^0-9]{0,15}\d{9}\b")
_ACCOUNT_RE = re.compile(r"(?i)\b(?:account|acct)\s*(?:number|no\.?|#)\b[^0-9]{0,10}\d{6,17}")


def _luhn_ok(digits: str) -> bool:
    s, alt = 0, False
    for ch in reversed(digits):
        d = ord(ch) - 48
        if alt:
            d *= 2
            if d > 9:
                d -= 9
        s += d
        alt = not alt
    return s % 10 == 0 and len(digits) >= 13


def scan_pii(text: str) -> dict[str, int]:
    """Return {category: count} of detected sensitive identifiers (counts only, no values)."""
    if not text:
        return {}
    out: dict[str, int] = {}
    ssn_vals = set(_SSN_RE.findall(text)) | set(_SSN_LABELED_RE.findall(text))  # dedupe overlap (count distinct)
    if ssn_vals:
        out["ssn"] = len(ssn_vals)
    cards = sum(1 for m in _CARD_RE.findall(text) if _luhn_ok(re.sub(r"[ -]", "", m)))
    if cards:
        out["credit_or_debit_card"] = cards
    routing = len(_ROUTING_RE.findall(text))
    if routing:
        out["routing_number"] = routing
    acct = len(_ACCOUNT_RE.findall(text))
    if acct:
        out["account_number"] = acct
    return out


_PII_LABELS = {"ssn": "Social Security Number", "credit_or_debit_card": "Credit/debit card number",
               "routing_number": "Routing number", "account_number": "Account number"}
# Bridge: a document fact is auto-CONFIRMED only when it is a labeled native-text field at high
# confidence; otherwise it is INFERRED (qualified when surfaced, never silently promoted).
_CONFIRM_THRESHOLD = 0.85
# Valid ingestion Domain values (mirror app.services.ingestion.Domain) — used to pick a fact's domain.
_INGEST_DOMAINS = {"finance", "family", "health", "education", "career", "core"}
GREEN, YELLOW, ORANGE, RED = "green", "yellow", "orange", "red"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _num(v: Any) -> Optional[float]:
    try:
        return float(str(v).replace(",", "")) if v is not None else None
    except (TypeError, ValueError):
        return None


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
    "life_insurance_policy": T("insurance", "Life Insurance Policy", {"coverage_amount": "money", "premium": "money", "insurer": "text", "policy_type": "text", "insured_person": "text", "beneficiaries": "text", "term_years": "number"}, ["family", "finance"], True),
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
    "trust": T("family_office", "Trust", {"trust_name": "text", "grantor": "text", "trustee": "text", "successor_trustee": "text", "beneficiaries": "text", "revocable_status": "text", "estimated_value": "money", "date": "date"}, ["family"], True),
    "will": T("family_office", "Will", {"executor": "text", "guardian": "text", "beneficiaries": "text", "date": "date", "last_updated": "date"}, ["family"], True),
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
    # estate / will / trust / life-insurance labels (native-text docs)
    "executor": ["executor", "personal representative", "executrix"],
    "guardian": ["guardian", "designated guardian", "guardian of minor children", "guardian for minor children"],
    "beneficiaries": ["beneficiaries", "beneficiary", "named beneficiaries", "primary beneficiary"],
    "trust_name": ["trust name", "name of trust", "trust"], "grantor": ["grantor", "settlor", "trustor"],
    "trustee": ["trustee"], "successor_trustee": ["successor trustee", "alternate trustee"],
    "revocable_status": ["revocable status", "revocable or irrevocable", "trust type", "type of trust"],
    "insurer": ["insurer", "insurance company", "carrier", "issued by", "underwritten by"],
    "policy_type": ["policy type", "type of policy", "plan type"],
    "insured_person": ["insured person", "insured", "name of insured", "life insured"],
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
    def __init__(self, supabase: SupabaseClient, extractor: Optional[DocumentExtractor] = None, parser: Optional[DocumentParser] = None,
                 ingestion: Optional[IngestionService] = None) -> None:
        self._sb = supabase
        self._ex = extractor or DocumentExtractor()
        self._parser = parser or DocumentParser()
        self._ingest = ingestion or IngestionService(supabase)

    async def upload(self, ctx: UserContext, *, doc_type: str, filename: str, content_type: str, data: bytes,
                     title: Optional[str] = None, acknowledge_sensitive: bool = False) -> dict[str, Any]:
        """Upload → parse → PII scan → (store binary) → extract → register → evidence.
        The PII scan happens BEFORE storing the binary, so a blocked upload persists nothing."""
        if doc_type not in TAXONOMY:
            raise ValueError(f"unknown doc_type {doc_type}")
        parsed = self._parser.parse(filename, content_type, data)
        pii = scan_pii(parsed["text"])
        if pii and not acknowledge_sensitive:
            await self._log_pii(ctx, doc_type, pii, acknowledged=False)
            return {"stored": False, "pii_warning": True, "requires_confirmation": True,
                    "detected": [{"category": k, "label": _PII_LABELS.get(k, k), "count": v} for k, v in pii.items()],
                    "message": ("Potential sensitive information detected. We recommend removing or redacting "
                                + ", ".join(_PII_LABELS.get(k, k) for k in pii) + " before uploading. Continue anyway?"),
                    "status": "blocked_pending_confirmation"}
        doc_id = str(uuid.uuid4())
        path = f"{ctx.user_id}/{doc_id}/{(filename or 'document')[:80]}"
        await self._sb.storage_upload("documents", path, data, content_type or "application/octet-stream")
        res = await self.register(ctx, doc_type=doc_type, text=parsed["text"], title=title or filename,
                                  file_ref=path, _doc_id=doc_id, source_kind=parsed["kind"], acknowledge_sensitive=True)
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

    async def _log_pii(self, ctx: UserContext, doc_type: str, categories: dict[str, int], *, acknowledged: bool) -> None:
        try:  # categories + counts ONLY — never the matched values
            await self._sb.insert("pii_scan_events", {"id": str(uuid.uuid4()), "user_id": ctx.user_id,
                                                      "tenant_id": ctx.user_id, "doc_type": doc_type,
                                                      "categories": categories, "acknowledged": acknowledged}, schema=DOCS)
        except Exception:  # noqa: BLE001 — telemetry must never block the upload
            pass

    async def register(self, ctx: UserContext, *, doc_type: str, text: str = "", title: Optional[str] = None,
                       file_ref: Optional[str] = None, _doc_id: Optional[str] = None, source_kind: str = "text",
                       acknowledge_sensitive: bool = False) -> dict[str, Any]:
        spec = TAXONOMY.get(doc_type)
        if not spec:
            raise ValueError(f"unknown doc_type {doc_type}")
        # PII safeguard (Sprint 42B): if sensitive identifiers are present and the user hasn't
        # acknowledged, DO NOT store the document — return a warning. We never persist the matched
        # values; we log only the categories + counts (for beta safety telemetry).
        pii = scan_pii(text)
        if pii and not acknowledge_sensitive:
            await self._log_pii(ctx, doc_type, pii, acknowledged=False)
            return {"stored": False, "pii_warning": True, "requires_confirmation": True,
                    "detected": [{"category": k, "label": _PII_LABELS.get(k, k), "count": v} for k, v in pii.items()],
                    "message": ("Potential sensitive information detected. We recommend removing or redacting "
                                + ", ".join(_PII_LABELS.get(k, k) for k in pii) + " before uploading. Continue anyway?"),
                    "status": "blocked_pending_confirmation"}
        if pii and acknowledge_sensitive:
            await self._log_pii(ctx, doc_type, pii, acknowledged=True)
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
        # ── BRIDGE: turn extracted VALUES into life-model facts (+ Family rows for critical docs). ──
        # Nothing here is invented — we only bridge fields that were actually extracted. The doc itself
        # never auto-confirms a life fact unless it's a labeled native-text field at high confidence.
        bridge = await self._bridge(ctx, doc_id=doc_id, doc_type=doc_type, spec=spec,
                                    fields=ext["fields"], source_kind=source_kind)
        return {"document_id": doc_id, "doc_type": doc_type, "category": spec.category,
                "fields_extracted": len(ext["fields"]), "confidence": ext["confidence"],
                "affects_domains": spec.domains, "status": status, "status_reason": reason,
                "message": message, "next_steps": next_steps,
                "processing_status": self._processing_status(classified=True, has_text=has_text, extracted=extracted),
                "fields": ext["fields"], "evidence": evidence_from_fields(doc_type, ext["fields"]),
                "changed": bridge["changed"], "needs_review": bridge["needs_review"],
                "bridged_facts": bridge["facts"]}

    # ──────────────────────────────────────────────────────────────────────────
    # BRIDGE — extracted document values → life.facts (provenance) + Family rows.
    # ──────────────────────────────────────────────────────────────────────────
    @staticmethod
    def _fact_domain(spec: T) -> str:
        for d in spec.domains:
            if d in _INGEST_DOMAINS:
                return d
        return "core"

    @staticmethod
    def _confirmation(conf: float, source_kind: str) -> str:
        """Confirmed ONLY when the value came from labeled native text at high confidence.
        Everything else is inferred — a document never silently promotes a fact to confirmed."""
        is_native_text = source_kind in ("text", "pdf")  # machine-readable, labeled-field extraction
        return "confirmed" if (conf >= _CONFIRM_THRESHOLD and is_native_text) else "inferred"

    async def _bridge(self, ctx: UserContext, *, doc_id: str, doc_type: str, spec: T,
                      fields: list[dict[str, Any]], source_kind: str) -> dict[str, Any]:
        changed: list[str] = []
        needs_review: list[dict[str, Any]] = []
        facts: list[dict[str, Any]] = []
        if not fields:
            return {"changed": changed, "needs_review": needs_review, "facts": facts}
        domain = self._fact_domain(spec)
        changed.append(f"{spec.label} detected")
        # 1. Every extracted field → a life.facts row with document provenance (idempotent by doc+field).
        for f in fields:
            key, value, conf = f["field_key"], str(f["field_value"]), float(f.get("confidence") or 0.0)
            status = self._confirmation(conf, source_kind)
            res = await self._ingest.submit_life_fact(ctx, {
                "fact_type": f"{doc_type}.{key}", "value": value, "domain": domain,
                "confidence": conf, "confirmation_status": status,
                "idempotency_key": f"{doc_id}:{key}",
                "provenance": {"submitted_by": "document-intelligence", "source_type": "document",
                               "document_id": doc_id},
            })
            facts.append({"fact_type": f"{doc_type}.{key}", "ok": res.get("ok", False),
                          "confirmation_status": status})
            if status == "inferred":
                needs_review.append({"field_key": key, "reason": "low_confidence_or_scanned", "confidence": conf})
            label = key.replace("_", " ").capitalize()
            changed.append(f"{label} identified: {value}")
        # 2. Family-domain bridge for the critical estate/insurance doc types (real columns only).
        fam = await self._bridge_family(ctx, doc_type=doc_type, fields=fields, source_kind=source_kind)
        changed.extend(fam)
        return {"changed": changed, "needs_review": needs_review, "facts": facts}

    async def _bridge_family(self, ctx: UserContext, *, doc_type: str, fields: list[dict[str, Any]],
                             source_kind: str) -> list[str]:
        """Upsert the user-owned Family rows that FamilyService actually READS, so an upload moves
        family readiness. We only write columns that EXIST in migration 131 and only when the value
        was actually extracted. Trust/will/insurance attributes with no real column are preserved in
        the row's `metadata` (and always as life.facts) — never invented as top-level columns.
        Read-before-write: never overwrite a richer user-confirmed value with a document value."""
        by_key = {f["field_key"]: str(f["field_value"]) for f in fields}
        out: list[str] = []
        if doc_type == "will":
            out += await self._upsert_estate(ctx, set_will=True, by_key=by_key)
            guardian = by_key.get("guardian")
            if guardian:
                out += await self._upsert_guardianship(ctx, guardian=guardian)
        elif doc_type == "trust":
            # estate_plans has no trust columns (migration 131) → record has_will untouched; persist the
            # trust attributes into estate_plans.metadata + life.facts. has_trust is NOT a real column.
            out += await self._upsert_estate(ctx, set_will=False, by_key=by_key, trust=True)
        elif doc_type == "life_insurance_policy":
            out += await self._upsert_insurance(ctx, by_key=by_key)
        return out

    async def _existing(self, table: str, ctx: UserContext) -> Optional[dict[str, Any]]:
        rows = await self._sb.select(table, filters={"user_id": f"eq.{ctx.user_id}"}, limit=1,
                                     order="updated_at.desc", schema=FAMILY)
        return rows[0] if rows else None

    @staticmethod
    def _det_family_id(ctx: UserContext, table: str) -> str:
        # one row per user for these singletons — deterministic id keeps the upload idempotent.
        return str(uuid.uuid5(_REC_NS, f"{ctx.user_id}:{table}"))

    async def _upsert_estate(self, ctx: UserContext, *, set_will: bool, by_key: dict[str, str],
                             trust: bool = False) -> list[str]:
        existing = await self._existing("estate_plans", ctx)
        row = dict(existing) if existing else {
            "id": self._det_family_id(ctx, "estate_plans"), "user_id": ctx.user_id, "tenant_id": ctx.user_id,
            "has_will": False, "has_poa": False, "has_beneficiaries": False, "status": "incomplete",
        }
        meta = dict(row.get("metadata") or {})
        changed: list[str] = []
        if set_will:
            row["has_will"] = True                       # a will document means a will EXISTS
            changed.append("Estate plan updated (will on file)")
            for k in ("executor", "beneficiaries", "date"):
                if by_key.get(k):
                    meta[k] = by_key[k]                   # no executor/beneficiary COLUMN → metadata + life.facts
        if trust:
            # no has_trust column; record trust attributes in metadata only (never invent a column).
            for k in ("trust_name", "grantor", "trustee", "successor_trustee", "beneficiaries", "revocable_status"):
                if by_key.get(k):
                    meta[k] = by_key[k]
            meta["has_trust"] = True
            changed.append("Estate plan updated (trust recorded)")
        row["metadata"] = meta
        row["updated_at"] = _now().isoformat()
        await self._sb.upsert("estate_plans", row, schema=FAMILY)
        return changed

    async def _upsert_guardianship(self, ctx: UserContext, *, guardian: str) -> list[str]:
        existing = await self._existing("guardianship_plans", ctx)
        # never overwrite a user-designated guardian with a document value.
        if existing and existing.get("status") == "designated" and existing.get("designated_guardian"):
            return []
        row = dict(existing) if existing else {
            "id": self._det_family_id(ctx, "guardianship_plans"), "user_id": ctx.user_id, "tenant_id": ctx.user_id,
        }
        row["status"] = "designated"
        row["designated_guardian"] = guardian
        row["updated_at"] = _now().isoformat()
        await self._sb.upsert("guardianship_plans", row, schema=FAMILY)
        return [f"Guardian recorded: {guardian}"]

    async def _upsert_insurance(self, ctx: UserContext, *, by_key: dict[str, str]) -> list[str]:
        coverage = by_key.get("coverage_amount")
        if not coverage:
            return []  # nothing to bridge — never write an insurance row without a real coverage value
        try:
            cov_num = float(str(coverage).replace(",", ""))
        except (TypeError, ValueError):
            return []
        existing = await self._existing("insurance_profiles", ctx)
        # never lower a user's existing higher coverage with a document value (preserve user data).
        if existing and _num(existing.get("life_coverage")) is not None and _num(existing.get("life_coverage")) >= cov_num and (existing.get("source") or "") != "document-intelligence":
            return ["Life insurance reviewed (existing coverage kept)"]
        row = dict(existing) if existing else {
            "id": self._det_family_id(ctx, "insurance_profiles"), "user_id": ctx.user_id, "tenant_id": ctx.user_id,
        }
        meta = dict(row.get("metadata") or {})
        row["life_coverage"] = cov_num                    # real column
        row["source"] = "document-intelligence"
        # policy_type / beneficiaries / premium have NO real columns → metadata + life.facts only.
        for k in ("policy_type", "beneficiaries", "premium", "insurer", "insured_person"):
            if by_key.get(k):
                meta[k] = by_key[k]
        row["metadata"] = meta
        row["updated_at"] = _now().isoformat()
        await self._sb.upsert("insurance_profiles", row, schema=FAMILY)
        return [f"Protection updated: life coverage ${cov_num:,.0f} on file", "Family readiness will recalculate"]

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
