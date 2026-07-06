# Document Pipeline Trace — Upload → Graph (Hop-by-Hop)

**Grounded finding.** The document pipeline is real and mostly continuous: an upload is parsed, PII-scanned, stored, field-extracted (with page/section/char-span provenance), persisted, bridged into the life model, conflict-scanned, and returned with a rich `changed[]` / `processing_status[]` / `needs_review[]` payload that the `UploadResult.tsx` component renders honestly. The **family-document moments work** — a `will`, `life_insurance_policy`, or `trust` upload writes the exact rows `FamilyService`/`FamilyOfficeService` actually read (`family.estate_plans.has_will`, `family.insurance_profiles.life_coverage`, `family.guardianship_plans.designated_guardian`), so family readiness genuinely moves. **The break is downstream of the upload moment:** the bridge faithfully writes every extracted value into `life.facts` (migration `20260616160000_mcp_ingestion`), but **no service reads `life.facts` back** — it is a write-only sink. The advisor, dashboard, and graph see only `documents.documents` (a count + titles), never the extracted _values_. So the richest layer (beneficiary names, executor, premium, coverage detail, policy type) is captured with provenance and then never surfaced anywhere except the one-time upload result and the Family rows that happen to have real columns.

---

## Pipeline at a glance

| #   | Hop                           | Source file                                                                                                                                           | What flows                                                                                  | User sees it?                                                             |
| --- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | Upload (file/paste)           | `apps/web/src/components/documents/DocumentIntelligence.tsx` → `apps/web/src/app/api/documents/route.ts` → `app/routers/documents.py:upload/register` | bytes or pasted text + `doc_type`                                                           | **YES** — busy spinner, then `UploadResult`                               |
| 2   | Parse → text + page spans     | `app/services/documents.py:DocumentParser`                                                                                                            | PDF/DOCX/text → `(text, page_spans)`; image/scanned → empty text                            | **YES** — "Text read (OCR)" step; scanned → honest message                |
| 3   | PII scan (pre-store)          | `documents.py:scan_pii`                                                                                                                               | category+count of SSN/card/routing/acct (never values)                                      | **YES** — blocking warning + categories                                   |
| 4   | Store binary                  | `documents.py:upload` → `storage_upload("documents", …)`                                                                                              | file at `{user}/{doc_id}/{name}`                                                            | Silent (implied by "Uploaded")                                            |
| 5   | Field extraction + provenance | `documents.py:DocumentExtractor.extract`                                                                                                              | `field_key/value/type/confidence/char_start/char_end/page_number/section/extraction_method` | **YES** — extracted-field chips + Evidence drawer                         |
| 6   | Persist document + fields     | `documents.py:register` → `documents.documents` + `documents.document_fields` (migration 165)                                                         | rows with status/confidence/provenance/review_status                                        | **YES** via `GET /{id}/evidence` (DocumentEvidence.tsx)                   |
| 7   | Review lifecycle              | `documents.py:set_field_review` → `POST /fields/{id}/review`                                                                                          | confirm/edit/reject → `user_confirmed`/`user_edited`/`rejected`                             | **YES** — DocumentEvidence Confirm/Edit/Reject                            |
| 8a  | Bridge → `life.facts`         | `documents.py:_bridge` → `ingestion.py:submit_life_fact`                                                                                              | every field → a provenance-carrying life fact                                               | **PARTIAL** — listed once in `changed[]`, then **invisible** (no reader)  |
| 8b  | Bridge → Family rows          | `documents.py:_bridge_family` → `family.estate_plans / insurance_profiles / guardianship_plans`                                                       | `has_will`, `life_coverage`, `designated_guardian` (+ rich attrs to `metadata`)             | **YES (real columns)** / **NO (metadata)**                                |
| 9   | Conflict re-scan              | `documents.py:_scan_conflicts` → `conflicts.py:ConflictDetectionService.scan`                                                                         | `documents.field_conflicts` + items (migration 166)                                         | **YES** — `ConflictReview.tsx` remounts after upload                      |
| 10  | Readiness (doc)               | `documents.py:readiness` → `GET /v1/documents`                                                                                                        | per-category have/critical + overall score                                                  | **YES** — readiness rings in DocumentIntelligence                         |
| 11  | Readiness (life index)        | `app/services/readiness.py:LifeReadinessEngine`                                                                                                       | Family/Career/etc. domain progress from domain summaries                                    | **YES (indirect)** — only via the Family rows in 8b, NOT via `life.facts` |
| 12  | Recommendations               | `documents.py:recommendations` → `documents.document_recommendations`                                                                                 | "Upload your X", renew-soon, low-confidence review                                          | **YES** — `/dashboard/recommendations` + doc page                         |
| 13  | Reports                       | `report_engine.py:_conflicts_section / _resume_imports_section`; readiness via `life.readiness_snapshots` (163)                                       | conflicts, imported-from-resume, comp evidence                                              | **YES (PDF sections)**                                                    |
| 14  | Dashboard                     | `my_life.py` (reads `documents.documents` count) + `advisor_facts.py`                                                                                 | "N documents on file" + per-doc title fact                                                  | **PARTIAL** — count + title only, never values                            |
| 15  | Graph                         | `life_graph_workspace.py`                                                                                                                             | nodes/edges from **recommendations + persisted edges**, NOT documents/`life.facts`          | **NO** — documents do not appear in the graph                             |

---

## Narrative walk

### Hops 1–4 — Upload, parse, PII, store (SOLID, visible)

`DocumentIntelligence.tsx` posts to `/api/documents` (paste → JSON `register`; file → multipart `/upload`). The proxy forwards the Supabase JWT to the Core API. `DocumentParser.parse` returns text + per-page char spans for digital PDFs; scanned/image PDFs return empty text. `scan_pii` runs **before** the binary is stored, so a blocked upload persists nothing — and the block is fully surfaced (`UploadResult.tsx` PII branch shows category + count + the API message). **No invisible success here.**

### Hop 5–7 — Extraction, persistence, review (SOLID, visible — this is the Trust Sprint P0 win)

`DocumentExtractor` records `char_start/char_end/page_number/section/extraction_method` for every field (migration 165 gives them a home). `register` writes `documents.documents` + `documents.document_fields`, defaulting low-confidence (<0.6) fields to `review_status='needs_review'`. The `GET /{id}/evidence` endpoint powers `DocumentEvidence.tsx`, which shows confidence bands (Verified/High/Review/Needs-review), the provenance line ("Page 2 · section 'coverage' · chars 540–588 · via regex"), and Confirm/Edit/Reject buttons. **Fully visible and trustworthy.**

### Hop 8a — Bridge to `life.facts` (⚠ INVISIBLE SUCCESS — the core gap)

`_bridge` calls `submit_life_fact` for **every** extracted field, stamping `fact_type=f"{doc_type}.{key}"`, document provenance, and a confirmation status (`confirmed` only for labeled native-text at ≥0.85; else `inferred`). These rows land in `life.facts`. **Grep confirms zero readers of `life.facts`** outside `ingestion.py` (the writer). The values appear once in the upload `changed[]` list ("Beneficiaries identified: Jane Doe") and are then unreachable by the advisor, dashboard, reports, or graph. This is the largest silent-success point in the pipeline.

### Hop 8b — Bridge to Family rows (PARTIALLY visible — the working half)

`_bridge_family` writes only **real columns** the family layer reads: `will` → `estate_plans.has_will=true` (+ guardian → `guardianship_plans.designated_guardian`); `life_insurance_policy` → `insurance_profiles.life_coverage` (read-before-write so it never lowers a user's higher coverage); `trust` → `estate_plans.metadata.has_trust`. `app/domains/family.py` reads `has_will/has_poa/has_beneficiaries`, `life_coverage`, `guardianship` status → **family readiness genuinely moves and is visible** on the Family dashboard. BUT executor, beneficiary names, trustee, policy type, premium, insurer go only to `*.metadata` — and **no reader consumes `estate_plans.metadata` or `insurance_profiles.metadata`** (FamilyOfficeService reads a `trust` table var, not the document metadata). Invisible success.

### Hop 9 — Conflict re-scan (SOLID, visible)

After every upload AND every field review, `_scan_conflicts` runs `ConflictDetectionService.scan`, which detects contradictions across documents + user-entered domain data for the 3 registered concepts (`current_role`, `current_employer`, `life_insurance_coverage`). `ConflictReview.tsx` is re-keyed to the new `document_id` so it remounts and shows new conflicts immediately. **Visible.** (Coverage is narrow — only 3 concepts; see OCR/MCP audits.)

### Hops 10–12 — Readiness + recommendations (SOLID, visible)

Document readiness (`GET /v1/documents`) is a have-vs-critical count per category with green/yellow/orange/red, rendered as rings. Recommendations persist to `documents.document_recommendations` ("Upload your Will", renew-soon, low-confidence-review) and surface on `/dashboard/recommendations`. The **life** readiness index (`readiness.py`) only reflects documents _transitively_ through the Family rows of hop 8b — never through `life.facts`.

### Hops 13–14 — Reports + dashboard (PARTIAL)

Reports surface `_conflicts_section` (unresolved conflicts), `_resume_imports_section` (imported employers/education/certs with source + confidence), and comp evidence — all real and cited. Readiness in reports comes from `life.readiness_snapshots` (163), the shared TS↔Python source of truth. The dashboard (`my_life.py`, `advisor_facts.py`) shows "N documents on file" + a per-document title fact — **never the extracted values**.

### Hop 15 — Graph (MISSING)

`life_graph_workspace.py` builds nodes/edges from recommendations + persisted graph edges + recommendation→evidence→source lineage. It does **not** read `documents.documents`, `documents.document_fields`, or `life.facts`/`life.relationships`. Uploaded documents and their facts **do not appear in the Explainable Life Graph at all.**

---

## Empty / In-Progress / Complete states (per hop)

- **Upload (1–4):** Empty = no file chosen (button disabled); In-Progress = "Reading your document…"; Complete = `UploadResult` headline.
- **Extraction (5–7):** Empty = "No structured fields were extracted"; In-Progress = `needs_review` band; Complete = Confirmed/Edited badge.
- **Bridge (8):** Empty = no `changed[]`; In-Progress = `needs_review[]` items; Complete = `changed[]` checklist — **but only at the upload moment; no persistent surface.**
- **Conflicts (9):** Empty = no `ConflictReview` card; Open = conflict cards; Resolved = hidden unless `include_resolved`.
- **Readiness (10–11):** Empty = red ring "get started"; Complete = green ring + have/critical.

## Invisible-success points (the punch list)

1. **`life.facts` write-only** (hop 8a) — every extracted value is orphaned after upload. _Biggest gap._
2. **`*.metadata` on family rows write-only** (hop 8b) — beneficiary/executor/trustee/premium/insurer captured, never read.
3. **`life.relationships` write-only** (no document writes here today, but same orphan risk).
4. **Documents absent from the graph** (hop 15).
5. **Dashboard shows count, not values** (hop 14) — the moat (real extracted detail) is invisible on the home surface.
