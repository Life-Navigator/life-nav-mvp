# Document Intelligence Trust Sprint — Executive Summary

**Date:** 2026-06-18 · The trust break is **proven and fixed**: extracted document facts now flow into the life model + Family domain and the user sees what changed. Extraction-quality (OCR/LLM) upgrade is correctly sequenced as the next step.

## Root cause (proven, not assumed)

**It was not OCR.** The pipeline ran upload → store → native text (PyMuPDF) → deterministic extraction → `documents`/`document_fields` **and stopped there.** `documents.py` had **zero** writes to `life.*` and never called the MCP `IngestionService`; FamilyService reads `estate_plans`/`guardianship_plans`/`insurance_profiles` (not `document_fields`); recommendations/my_life read document **existence**, never the extracted **values**. So uploads created no downstream value — the integration bridge (stages H+I) was missing. Even perfect OCR would have changed nothing. (Full evidence: `DOCUMENT_PIPELINE_TRACE.md`, `ROOT_CAUSE_ANALYSIS.md`.)

## The fix (built + tested this sprint)

**Document → life-model + Family bridge** in `documents.upload()`/`register()`:

- Every extracted field → `life.facts` via the sanctioned `IngestionService` (provenance `source_type='document'` + `document_id` + confidence; `confirmed` only ≥0.85 native-text, else `inferred` — never auto-promoted; idempotent).
- Critical doc types → the Family tables FamilyService actually reads: **Will → `estate_plans.has_will` + `guardianship_plans.designated_guardian`**, **Life Insurance → `insurance_profiles.life_coverage`** (preserving user-confirmed values).
- `upload()` returns a **`changed` summary** + `needs_review`.
- Will/Trust/Life-Insurance fields added to the taxonomy (executor/guardian/beneficiaries; trustee/grantor/successor/revocable; insurer/coverage/premium).
- **Upload UX** (`UploadResult.tsx`) replaces "Upload successful" with a state machine + the verbatim "what changed" list + honest needs-review/empty/failed states.
- **537 core-api tests** (+12 bridge) + web type-check + 6 UX tests pass.

## Downstream value — what now moves on upload

| Surface                          | Moves?     | How                                                                                          |
| -------------------------------- | ---------- | -------------------------------------------------------------------------------------------- |
| Life model (`life.facts`)        | ✅ written | bridge                                                                                       |
| Family readiness                 | ✅         | FamilyService reads `has_will`/guardian/`life_coverage` (bridged)                            |
| Recommendations                  | ✅         | protection-gap rec derives from the bridged coverage; estate "missing docs" resolves         |
| Dashboard (Family Overview card) | ✅         | reads the family tables                                                                      |
| User sees what changed           | ✅         | UploadResult state machine + `changed`                                                       |
| Life Brief / explainable graph   | ⚠️ not yet | no consumer reads `life.facts` (documented follow-on)                                        |
| Trust-specific fields            | ⚠️ partial | persisted to `estate_plans.metadata` + `life.facts`; FamilyService doesn't read metadata yet |

## The 10 deliverables (`docs/document-intelligence/`)

DOCUMENT_PIPELINE_TRACE · ROOT_CAUSE_ANALYSIS · DOCUMENT_EXTRACTION_ARCHITECTURE · DOCUMENT_SCHEMA_SPEC · DOCUMENT_MCP_VALIDATION · FAMILY_READINESS_INTEGRATION · DOCUMENT_UPLOAD_EXPERIENCE · DOCUMENT_RENDERING_AUDIT · PRODUCTION_DOCUMENT_SMOKE · EXECUTIVE_SUMMARY.

## The 10 final questions

1. Is OCR the problem? **No — the bridge was.** 2. Native extraction works? **Yes (PyMuPDF).** 3. Correct model? **Deterministic floor works for labeled native docs; Gemini/Vision is the now-justified upgrade.** 4. Classified correctly? **Yes (taxonomy).** 5. Structured facts extracted? **Yes for labeled native; prose needs the LLM upgrade.** 6. MCP persisting document facts? **Yes now** (bridge → IngestionService). 7. Family readiness consuming? **Yes now.** 8. Dashboard consuming? **Yes (Family Overview) — Life Brief is the follow-on.** 9. Report consuming? **Via recommendations, yes.** 10. User sees what changed? **Yes.**

## Honest residuals (documented, sequenced)

1. **`life.facts` surfacing** in Life Brief / explainable graph (write done; consumer not wired) — next.
2. **Extraction-quality upgrade** (PyMuPDF → Gemini 2.5 Pro; Vision OCR fallback for scanned) — now worth building because the bridge makes it visible.
3. **Trust-specific Family columns** (or FamilyService reading `metadata`) for trustee/grantor.
4. **Live UI smoke** with sample will/trust/policy (~15 min, gated on a session).

## Status

The reported **trust break is fixed**: a will/insurance upload now visibly moves family readiness, recommendations, and the dashboard's Family Overview, with the user shown exactly what changed — all proven by tests, with no fabrication. **DOCUMENT_INTELLIGENCE_READY for the Family path**, pending the live smoke; the extraction-quality upgrade + Life-Brief/graph surfacing are the sequenced next steps (not the trust break).
