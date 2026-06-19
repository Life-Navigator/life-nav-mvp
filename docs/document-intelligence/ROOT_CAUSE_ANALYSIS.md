# Root Cause Analysis (evidence)

**Date:** 2026-06-18 · Per the mandate: the exact failure point, proven with code evidence, before any architecture/OCR change.

## Verdict: the break is **H + I (Life Model / Family Readiness integration)** — NOT D (OCR)

The document pipeline runs A→G successfully for native-text documents and **terminates at the `documents` schema**. Extracted facts are never bridged into the life model or the Family domain, and no consumer reads the extracted **values**. OCR absence is a secondary quality ceiling, not the cause of "no downstream value."

## Stage-by-stage evidence

| Stage                   | Status                        | Evidence                                                                                                                                                                                                                                                                                                                |
| ----------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A Upload                | ✅ works                      | `routers/documents.py:48`                                                                                                                                                                                                                                                                                               |
| B Storage               | ✅ works                      | `documents.py:274` storage_upload("documents", …)                                                                                                                                                                                                                                                                       |
| C Native text           | ✅ works (native PDFs)        | `documents.py:206-224` PyMuPDF/pypdf                                                                                                                                                                                                                                                                                    |
| D OCR                   | ➖ absent (by design)         | `documents.py:204` "OCR is the upgrade path"; scanned → `needs_review`                                                                                                                                                                                                                                                  |
| E Classification        | ✅ (caller-supplied doc_type) | `TAXONOMY` `documents.py:80-126`                                                                                                                                                                                                                                                                                        |
| F Structured extraction | ⚠️ weak for real docs         | `documents.py:148-169` deterministic labeled-field regex                                                                                                                                                                                                                                                                |
| G Persistence           | ✅ but **dead-ends**          | inserts only `documents`/`document_fields`/`document_recommendations` (schema `documents`) `:342-354,418`                                                                                                                                                                                                               |
| **H Life Model**        | ❌ **BROKEN**                 | `grep` of `documents.py` for `life.`/`IngestionService`/`snapshot` → **NONE**. The MCP `IngestionService` (writes `life.facts`) is never called by document upload.                                                                                                                                                     |
| **I Family Readiness**  | ❌ **BROKEN**                 | `FamilyService` (`app/domains/family.py:76-89`) reads `family_profile`/`dependent`/`estate_plan`/`guardianship_plan`/`insurance_profiles` — **not** `document_fields`. Uploading a will never writes `estate_plan`/`guardianship_plan`; uploading a policy never writes `insurance_profiles`. So readiness cannot move. |
| J Dashboard             | ⚠️ existence only             | `my_life.py:76-83` reads `documents` for `needs_review` alerts; never reads field values                                                                                                                                                                                                                                |
| K Report                | ⚠️ not surfaced               | `report_engine` reads recs/tool-calcs, not `document_fields`                                                                                                                                                                                                                                                            |
| L Recommendations       | ⚠️ existence only             | `recommendations_os.py:120-131` reads doc_type **presence** (→ "missing X"); `:78` only boosts evidence weight if `source_table` mentions `documents:`. It never reads extracted **values** (coverage_amount, executor, beneficiaries).                                                                                 |

## The two true failure points

1. **No life-model bridge (H).** Extracted fields are never written to `life.facts` (or any `life.*`) and the MCP ingestion path is unused by documents. So the dashboard / Life Brief / snapshot never reflect document content.
2. **No family-domain bridge (I).** Document upload never populates the Family domain's source tables (`estate_plan`, `guardianship_plan`, `insurance_profiles`), which are what `FamilyService` readiness actually reads. So "guardian detected → estate readiness ↑" cannot happen.

A **secondary** ceiling: the extractor is deterministic labeled-field parsing (F) and OCR is absent (D), so real-world prose/scanned wills/trusts/policies extract poorly. But **even with perfect extraction, H+I would still produce zero downstream value** — proving the dominant break is integration, not OCR.

## Answers to the mandated final questions (evidence-based)

1. **Is OCR the problem?** **No.** The bridge (H+I) is. OCR only raises extraction quality for scanned docs.
2. **Does native text extraction already work?** **Yes** (PyMuPDF) for native-text PDFs.
3. **Correct extraction model selected?** Deterministic parser is fine for labeled native PDFs; an LLM (Gemini) pass is the right upgrade for prose/scanned — but only after the bridge exists.
4. **Documents classified correctly?** doc_type is caller-supplied (UI picks); taxonomy mapping is correct.
5. **Structured facts extracted correctly?** Partially — only labeled fields in native text.
6. **Is MCP persisting facts?** **Not for documents** — the IngestionService exists but documents never call it.
7. **Family Readiness consuming document facts?** **No.**
8. **Dashboard consuming document facts?** **No** (only needs_review alerts).
9. **Report consuming document facts?** **No.**
10. **Does the user see what changed?** **No** — upload returns success + a document-only readiness score; nothing in the life model/family/dashboard moves.

## The fix (drives the rest of the sprint)

Build the **document → life-model + family bridge** in `documents.upload()`: after extraction, write extracted fields as `life.facts` (provenance: `source_type='document'`, `document_id`, confidence; candidate/inferred unless high-confidence) **and** upsert the Family domain source rows for critical doc types (will/trust/estate → `estate_plan`/`guardianship_plan`; life-insurance → `insurance_profiles`), then return a **"what changed"** summary. OCR/LLM extraction quality is a _follow-on_ upgrade (Phase 3), justified only after the bridge makes extracted facts visible.
