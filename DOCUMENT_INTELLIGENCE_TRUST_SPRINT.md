# Document Intelligence Trust Sprint — Deliverables (evidence-based audit + design)

> Status: **audit + design only. No code built, nothing merged.** Findings are from the actual codebase (file:line cited). The sprint's success bar — _"a user can click any recommendation, trace it to the exact document page, understand why it was extracted, and decide whether they agree"_ — is **NOT met today**; this document maps exactly why and what closes it.

---

## 1. Document Intelligence Audit (matrix)

**Extraction engine:** `apps/lifenavigator-core-api/app/services/documents.py` — a **31-type taxonomy** (`TAXONOMY`, lines 98–139), extracted by **deterministic labeled-field regex** (`_find`, 171–223). Media (scanned PDF/image/audio/video) defers to **BYOM providers** (Gemini Vision / Whisper / Gemini Video) via `apps/web/src/lib/ingestion/extractors/{vision,speech,video}-prod.ts`. Native PDF text via `pdf-parse` (`extractors/pdf.ts`). **No Tesseract.**

| Capability                                                                                     | State                        | Evidence                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 31 doc types (offer, 401k, life/disability insurance, will/trust/estate, DD214, lab report, …) | ✅                           | documents.py:98–139                                                                                                                                          |
| Per-field + per-doc **confidence** (computed + stored)                                         | ✅                           | documents.py:202–222; `documents.documents.confidence`, `documents.document_fields.confidence` (migration 143)                                               |
| Confidence schedule (money/% 0.9, date 0.85, number 0.8, text 0.7)                             | ✅                           | documents.py:202–222                                                                                                                                         |
| Doc → life-model **bridge** w/ provenance                                                      | ✅                           | documents.py:381–441; `life.facts.provenance` = {source_type:"document", document_id, confidence}; `confirmation_status` confirmed≥0.85+native else inferred |
| Family bridge (will→estate_plans, insurance→insurance_profiles.life_coverage)                  | ✅                           | documents.py:443–541; test_document_bridge.py                                                                                                                |
| **Graph promotion** (`:Document`, `:DocumentField` nodes; `from_source` edges)                 | ✅ (single-doc)              | migration 144_documents_triggers.sql                                                                                                                         |
| Advisor cites doc facts (sourceTable + recordId + confidence)                                  | ✅ (table-level)             | advisor_facts.py:33–45; advisor_validator.py:241–244; **doc facts added to packet this branch**                                                              |
| `ProvenanceBadge` component                                                                    | ✅ exists, ❌ not integrated | apps/web/src/components/ui/ProvenanceBadge.tsx                                                                                                               |
| **page_number / section** persisted per field                                                  | ❌ ABSENT                    | `document_fields` has no page/section col; pipeline computes `source_locator.page` (pdf.ts:68–80) then **drops it**                                          |
| **extracted_at / extraction_method** per field                                                 | ❌ ABSENT                    | only `created_at`                                                                                                                                            |
| **review_status per field** + confirm/edit/reject UI                                           | ❌ ABSENT                    | doc-level `status`/`status_reason` only (143/153); no UI                                                                                                     |
| **Conflict detection** across documents                                                        | ❌ ABSENT                    | only goal-level `conflicts_with` (life_discovery.py)                                                                                                         |
| **Cross-document reasoning** (resume↔cert, will↔insurance)                                     | ❌ ABSENT                    | single-doc nodes, no inter-doc edges                                                                                                                         |
| **Resume import** (employers/titles/dates/edu/skills)                                          | ❌ ABSENT                    | no `resume` type; offer_letter has title/start_date only                                                                                                     |
| **"View Evidence" / source highlight / last-verified** UI                                      | ❌ ABSENT                    | —                                                                                                                                                            |

**Honest headline:** the _infrastructure_ (provenance model, confidence, citations, grounding, bridge) is real and good. The _user-facing trust_ (page-level traceability, View Evidence, confidence visibility, review/correct, conflict surfacing) is largely missing — and that's exactly what "trust" means to a user.

---

## 2. Provenance Architecture (source-of-truth model)

**Goal:** every fact answers "where from?" and "why believed?" in one click.

**2a. Migration (additive, idempotent) — `document_fields` gains the missing locators:**

```
ALTER TABLE documents.document_fields
  ADD COLUMN page_number       INT,
  ADD COLUMN section           TEXT,
  ADD COLUMN char_start        INT,
  ADD COLUMN char_end          INT,
  ADD COLUMN extraction_method TEXT,           -- 'regex' | 'vision:gemini' | 'whisper' | 'manual'
  ADD COLUMN extracted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN review_status     TEXT NOT NULL DEFAULT 'extracted'  -- extracted|needs_review|user_confirmed|user_edited|rejected
    CHECK (review_status IN ('extracted','needs_review','user_confirmed','user_edited','rejected'));
```

The pipeline **already produces** `source_locator {page, char_start, char_end}` (ingestion.ts:178–190; pdf.ts) — it's discarded at persistence. Wiring it into the insert is the core fix.

**2b. Canonical fact shape (what every consumer reads):**

```
{ fact, value, sourceDocumentId, sourcePage, section, confidence, extractionMethod, extractedAt, reviewStatus }
```

**2c. Trust precedence (advisor + readiness must honor):** `user_confirmed > user_edited > extracted(high-conf, native) > inferred(media/low-conf)`. Maps to existing `confirmation_status` + new `review_status`.

**2d. Provenance UI (Phase 3/4):** integrate `ProvenanceBadge` on every doc-derived value; click → **Evidence drawer** (source doc, page, highlighted span via char_start/char_end, confidence tier, extracted/verified dates). Confidence tiers: **95–100 Verified · 80–94 High · 60–79 Review recommended · <60 Needs review** — rendered as a visible chip, never hidden.

---

## 3. Conflict Detection Design

**Where:** a deterministic pass after each ingest + on demand, comparing the new doc's bridged facts against existing `life.facts` / domain rows by `fact_type` + domain.

**Conflict classes:**

1. **Value divergence** — same fact_type, materially different value (life coverage $500k vs $250k; employer X vs Y). Threshold per type (exact for categorical, %-band for money).
2. **State contradiction** — MBA `completed` (resume) vs `in_progress` (transcript).
3. **Supersedence** — newer offer/promotion letter vs older offer (date-ordered; mark older `superseded`, not deleted).
4. **Coverage gap** — will exists but no guardian; beneficiary named but no policy.

**Output:** a `documents.fact_conflicts` row `{user_id, fact_type, left_ref, right_ref, kind, status}` + a UI "Resolve conflict" card. **Never silently choose** — surface both, cite both sources, let the user pick (writes `review_status=user_confirmed` on the winner). Advisor must refuse to assert a conflicted fact until resolved (validator gate addition).

---

## 4. Resume Import Workflow (Phase 8 — priority, the LinkedIn alternative)

**Path:** upload PDF → existing pipeline produces text + page locators → **new `resume` extractor** (LLM-structured, since resumes aren't labeled-field) emits a structured object:

```
{ employers:[{company,title,start,end,current}], education:[{school,degree,field,grad}],
  certifications:[...], projects:[...], skills:[...] }  // each item carries page + confidence
```

→ **Review screen** (per-item confirm/edit/reject, confidence chips) → **Import to Career** (`career.experience_records`) / **Import to Education** (`education_records`, `education.certifications`) → graph edges auto-created via existing promotion. Every imported row carries `source=document`, `document_id`, page, confidence → so the Career Advisor (validated in Phase 11) cites it.

**Why LLM here (not regex):** resumes are free-form; this is the one type where structured-LLM extraction + the citation/validator gate is the right call. Bounded cost (one doc, one call).

---

## 5. Credential Architecture Proposal (+ Credly existing-code finding)

**⚠️ Finding: a Credly integration already exists and is a compliance risk.**
`apps/web/src/app/api/integrations/credly/{connect,sync,badges}/route.ts` + `lib/integrations/credly/client.ts` authenticate by **Credly username** and `fetchBadges(username)` — i.e. the **public profile path**, with badges mapped into `courses`, stored in the generic `integrations` table. This **violates the sprint's compliance rule** ("Use official Credly/Pearson APIs only; do not scrape public profiles") and has **no OAuth, no `credential_imports` table, no 30-day refresh/delete lifecycle.** It must be **reworked, not extended.**

**Normalized `CredentialSource` interface (Phase 9):**

```
interface CredentialSource {
  id; provider: 'credly'|'aws'|'microsoft'|'google'|'coursera'|'comptia';
  connect(oauthCtx): Promise<Connection>;
  listCredentials(conn): Promise<NormalizedCredential[]>;
  refresh(conn); disconnect(conn): Promise<void>;  // must delete cached API content
}
interface NormalizedCredential {
  externalId, name, issuer, issuerLogoUrl, badgeImageUrl, description, skills[],
  issuedAt, expiresAt, verificationUrl, status, source, lastSyncedAt, sourceMetadata
}
```

**Data model (Credly sprint Phase 2):** new `credential_imports` table (the spec's fields), RLS owner-read/service-write, **NOT** dumped into `education.certifications` (which is a thin id/name/metadata table). Confirmed credentials project into Career/Education read models.

**Compliance lifecycle:** OAuth server-side (scopes: `issued_badges`, `badge_templates`); store only normalized fields (not raw payload); **refresh ≤30 days**; **on disconnect/request, delete Credly-derived rows**; mark stale/expired/revoked.

---

## 6. Trust Scorecard (0–100, evidence-based)

| Dimension           | Score       | Basis                                                                                                |
| ------------------- | ----------- | ---------------------------------------------------------------------------------------------------- |
| Extraction accuracy | 60          | Deterministic regex works for 31 types; **no ground-truth benchmark**; resume absent; media via BYOM |
| Provenance          | 65          | Strong fact-level provenance in `life.facts`; **page/section/method not persisted**                  |
| Citations           | 70          | Advisor cites sourceTable+recordId+confidence, validator-gated; no page/field granularity            |
| Review workflow     | 35          | Status + confirmation_status exist in DB; **no confirm/edit/reject UI**                              |
| Conflict detection  | 10          | **Absent** for documents                                                                             |
| Advisor grounding   | 75          | Proven live in Phase 11 (enhanced + cited, no fabrication)                                           |
| Report grounding    | 65          | Evidence_json + readiness snapshots; partially audit-ready                                           |
| **Blended**         | **~54/100** | Infra ≈70, user-facing trust ≈45                                                                     |

---

## 7. Beta Readiness Assessment

**Verdict: NOT YET at the "advisor-grade explainable" bar this sprint defines.** The platform extracts, grounds, and cites at the _backend_ level (genuinely good), but a user **cannot today** click a fact and see the source **page** with highlighted text, see a confidence tier in the UI, correct a wrong extraction, or be warned of conflicts. The success criterion fails on: **page persistence (Phase 2), View Evidence UI (Phase 3), confidence display (Phase 4), review UI (Phase 5).**

**Minimum to reach the bar (P0):** Phase 2 migration (persist the already-computed page locator + review_status) → Phase 3 Evidence drawer + ProvenanceBadge integration → Phase 4 confidence tiers → Phase 5 review UI. These four are tightly coupled and deliver the "one-click trace + decide" promise.

**High value next (P1):** Resume import (Phase 8) — additive, aligns with the LinkedIn-alternative decision. Then conflict detection (Phase 6) + cross-doc edges (Phase 7).

**P2:** Credly rework (OAuth + `credential_imports` + lifecycle), replacing the non-compliant username path; then the multi-provider `CredentialSource` interface.

---

## Recommended execution order

1. **P0 provenance foundation** (migration + persist page locator + Evidence drawer + confidence tiers + review UI) — closes the trust gap.
2. **Resume import** (priority feature).
3. **Conflict + cross-doc reasoning.**
4. **Credly rework** (compliance-first) → multi-provider credentials.

No code written yet — awaiting go-ahead on which block to build first.
