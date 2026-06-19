# Document Rendering Audit — where extracted facts go, and where they don't

Date: 2026-06-18
Scope: trace each extracted document fact from extraction → storage → API contract → frontend, and
identify where it SHOULD surface vs. where it currently does NOT. Grounded in code, file:line. No
fabrication — claims below are what the code actually does.

## 1. The pipeline (source of truth)

Upload/register handler:

- Router: `apps/lifenavigator-core-api/app/routers/documents.py:32` (`POST /v1/documents` register),
  `:48` (`POST /v1/documents/upload`), `:69` (`GET /v1/documents` readiness).
- Service: `apps/lifenavigator-core-api/app/services/documents.py`
  - `upload()` :271 → parse → PII scan → store binary → `register()`
  - `register()` :319 → extract fields → insert `documents` (:356) + `document_fields` (:363) →
    `_bridge()` (:372) → return response (:374-381).
  - `_bridge()` :405 → writes `life.facts` per field (:418 `submit_life_fact`) and Family rows
    (`_bridge_family` :436), returns `{changed, needs_review, facts}`.

Response shape returned to the web proxy (`register()` :374-381):
`{document_id, doc_type, category, fields_extracted, confidence, affects_domains, status,
status_reason, message, next_steps, processing_status, fields, evidence, changed, needs_review,
bridged_facts}` (+ `parsed_kind`, `parsed_chars` from `upload()` :291-292).

Web proxy (render-only, forwards JWT): `apps/web/src/app/api/documents/route.ts:27` POST →
multipart → Core `/v1/documents/upload` (:34); JSON → `/v1/documents` (:40). Returns the upstream
JSON unchanged (:37, :43).

## 2. Per-fact trace

### Will → executor / guardian

- Extraction: doc_type `will`; fields `executor`, `guardian`, `beneficiaries`, `date`
  (TAXONOMY in `services/documents.py`).
- Storage:
  - `documents.extracted_json` + `document_fields` rows (`register()` :360, :363).
  - `life.facts`: `will.executor`, `will.guardian` via `submit_life_fact` (`_bridge` :418-424),
    with document provenance (:422).
  - Family `estate_plans`: `has_will=True` (`_upsert_estate` :478); `executor`/`beneficiaries`/`date`
    go to `estate_plans.metadata` (:480-482) — there is NO executor column.
  - Family `guardianship_plans`: `designated_guardian = guardian`, `status='designated'`
    (`_upsert_guardianship` :503-504), unless a user value already exists (:498).
- `changed` strings produced: `"Will detected"` (:413), `"Executor identified: …"` (:430),
  `"Estate plan updated (will on file)"` (:479), `"Guardian recorded: …"` (:507).

### Trust → trustee

- doc_type `trust`; fields `trust_name`, `grantor`, `trustee`, `successor_trustee`,
  `beneficiaries`, `revocable_status`.
- Storage: `document_fields` + `life.facts` (`trust.trustee`, etc.). `estate_plans` has NO trust
  columns → all trust attributes (incl. `trustee`) go to `estate_plans.metadata` (`_upsert_estate`
  trust branch :485-488; `meta["has_trust"]=True` :488). `has_trust` is intentionally NOT a column.
- `changed`: `"Trust detected"` (:413), `"Trustee identified: …"` (:430),
  `"Estate plan updated (trust recorded)"` (:489).

### Insurance → coverage_amount

- doc_type `life_insurance_policy`; field `coverage_amount` (+ `policy_type`, `beneficiaries`,
  `premium`, `insurer`, `insured_person`).
- Storage: `document_fields` + `life.facts`. Family `insurance_profiles.life_coverage = cov_num`
  (real column, `_upsert_insurance` :532); other attributes → `insurance_profiles.metadata`
  (:535-537). Never lowers an existing higher user coverage (:526-527).
- `changed`: `"Life insurance policy detected"` (:413),
  `"Protection updated: life coverage $… on file"` (:541), `"Family readiness will recalculate"`
  (:541).

## 3. Where these facts SHOULD surface vs. CURRENTLY do

| Surface                                                                          | Reads from                                                              | Will/guardian                                                                         | Trust/trustee                                                   | Insurance coverage                                            | Status                                                                                                                |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Upload result view** (`DocumentIntelligence`)                                  | the upload response                                                     | SHOULD show `changed`                                                                 | SHOULD show `changed`                                           | SHOULD show `changed`                                         | **FIXED in this sprint** — see §4                                                                                     |
| **Family Overview** (`/dashboard/family`)                                        | `/api/family/summary` → Core `/v1/family/summary`                       | `readiness.estate.has_will`, `guardianship_status` rendered (`family/page.tsx:21-29`) | trust in metadata — **NOT a top-level field, likely not shown** | `protection.life_coverage` rendered (`family/page.tsx:15-19`) | will/guardian/coverage flow IF `/v1/family/summary` reads estate_plans/guardianship_plans/insurance_profiles          |
| **Dashboard / Life Brief** (`ExecutiveSummary`, `LifeBrief`, `LifeIntelligence`) | `/api/life/my-life` → Core `/v1/life/my-life`                           | depends on whether my_life surfaces `will.*` facts                                    | same                                                            | same                                                          | document `life.facts` only appear here if `my_life` projects them — **not verified to render document-sourced facts** |
| **Recommendations**                                                              | `/v1/documents/recommendations` (`router :84`) + family recommendations | readiness-driven recs                                                                 | same                                                            | same                                                          | recs are readiness-derived; per-fact recs (e.g. "name a successor trustee") not traced as wired                       |
| **Report viewer**                                                                | report engine                                                           | —                                                                                     | —                                                               | —                                                             | not traced in this sprint                                                                                             |
| **Explainable graph** (`/life-graph/explainable`)                                | `/v1/life-graph` (advisor edge model)                                   | facts carry provenance (`_bridge` :422) so eligible                                   | same                                                            | same                                                          | document-provenance facts CAN appear; not verified that document-sourced edges render                                 |

### Honest gaps (where document facts do NOT currently surface)

1. **The upload itself** (pre-sprint): `DocumentIntelligence.tsx` only showed
   `fields_extracted` + a raw field-pill list — it IGNORED `changed`, `needs_review`,
   `processing_status`, `status_reason`, `next_steps`, `bridged_facts`. So a user saw
   "Extracted 2 fields" but never "Will detected / Guardian recorded / Family readiness updated."
   Confirmed: a repo-wide grep for `changed|needs_review|bridged_facts|processing_status|
status_reason|next_steps` in `apps/web/src` (.tsx/.ts) returned ZERO hits in the documents UI.
   **Fixed in §4.**
2. **Trust/trustee** lives only in `estate_plans.metadata` + `life.facts`. The Family Overview
   view-model (`family/page.tsx:16-37`) has no `trust`/`trustee` field, so a trust upload moves no
   visible top-level Family field (only `changed` in the upload view + readiness, if family summary
   counts trust). This is a backend/contract gap, not a frontend bug.
3. **Dashboard / Life Brief**: not verified to project document-sourced `life.facts` (e.g.
   `will.executor`) into the Life Brief. If `my_life` doesn't include them, the only place a user
   sees "Executor identified: …" is the upload view's `changed` list.
4. **Explainable graph**: facts are written WITH provenance (document_id), so they are eligible to
   render as cited edges, but document-sourced edges were not verified to appear in
   `/life-graph/explainable` in this sprint.

## 4. What this sprint changed (frontend only)

The upload view now renders the FULL response — see `DOCUMENT_UPLOAD_EXPERIENCE.md`.

- `apps/web/src/components/documents/UploadResult.tsx` (new) — state machine + `changed` +
  `needs_review` + `next_steps` + honest empty/failed/PII states.
- `apps/web/src/components/documents/DocumentIntelligence.tsx` — replaced the passive
  "Extracted N fields" block (old :259-283) with `<UploadResult />`.

Not changed (owned by other agents / out of scope): core-api, Family Overview view-model,
my_life projection, report engine, explainable graph. Gaps 2-4 above remain for those owners.
