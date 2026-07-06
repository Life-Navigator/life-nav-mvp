# MCP / Bridge → Render Audit

**Grounded finding.** The bridge from extracted document fields into the life model is **half-connected**. Two write paths fire on every upload (`documents.py:_bridge`): (1) `submit_life_fact` into `life.facts` for _every_ field, and (2) `_bridge_family` into the real Family columns (`estate_plans.has_will`, `insurance_profiles.life_coverage`, `guardianship_plans.designated_guardian`) plus rich attributes into `*.metadata`. Path (2)'s **columns** are read by `app/domains/family.py` and `family_office.py`, so coverage/will/guardian genuinely project into Family readiness, recommendations, and reports — that part is real and cited. But **path (1) is orphaned**: a project-wide grep shows **zero readers of `life.facts`** (and `life.relationships`) outside the writer `ingestion.py`. The advisor's fact packet (`advisor_facts.py`) reads `documents.documents` for a count and per-document titles — never `document_fields` values and never `life.facts`. The graph (`life_graph_workspace.py`) reads recommendations + persisted edges, never documents or facts. So the system's richest, provenance-stamped layer (beneficiary names, executor, trustee, premium, insurer, policy type, every comp/financial value) is captured perfectly and then **rendered nowhere**.

---

## The write → read matrix

| Write target                                                                  | Written by                                             | Read by                                                                                            | Projects to                                       |
| ----------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `life.facts`                                                                  | `_bridge` → `ingestion.submit_life_fact` (every field) | **NOBODY** (grep: only `ingestion.py` writes; no select)                                           | ❌ nothing                                        |
| `life.relationships`                                                          | `ingestion.submit_relationship` (MCP only)             | **NOBODY** in app code                                                                             | ❌ nothing                                        |
| `estate_plans.has_will`                                                       | `_upsert_estate`                                       | `family.py`, `family_office.py`                                                                    | ✅ Family readiness, estate gap, report           |
| `estate_plans.metadata.{executor,beneficiaries,trust_name,trustee,...}`       | `_upsert_estate`                                       | **NOBODY** (family_office reads a `trust` table, not this metadata)                                | ❌ nothing                                        |
| `insurance_profiles.life_coverage`                                            | `_upsert_insurance`                                    | `family.py` (coverage_gap), `family_office.py`                                                     | ✅ Family protection, report                      |
| `insurance_profiles.metadata.{premium,policy_type,insurer,beneficiaries,...}` | `_upsert_insurance`                                    | **NOBODY**                                                                                         | ❌ nothing                                        |
| `guardianship_plans.designated_guardian`                                      | `_upsert_guardianship`                                 | `family.py` (guardianship status)                                                                  | ✅ Family readiness                               |
| `documents.documents`                                                         | `register`                                             | `advisor_facts.py` (count+titles), `my_life.py` (count), `report_engine`                           | ✅ count/title only                               |
| `documents.document_fields`                                                   | `register`                                             | `field_evidence` (Evidence drawer), `conflicts._gather`                                            | ✅ evidence + conflicts; ❌ not advisor/dashboard |
| `documents.field_conflicts`                                                   | `conflicts.scan`                                       | `ConflictReview.tsx`, `report_engine._conflicts_section`, `open_conflict_facts` (advisor)          | ✅                                                |
| `documents.resume_items`                                                      | `resume.ingest`                                        | `ResumeImportReview`, `report_engine._resume_imports_section`; on import → career/education tables | ✅                                                |

**Pattern:** every _column_ with a home is read; every value routed to `life.facts` or `*.metadata` is orphaned.

---

## Per render-surface verdict

### Dashboard (`my_life.py`, `advisor_facts.py`) — PARTIAL

- Reads `documents.documents` → "N documents on file" tile + one fact per document title (confidence 0.85, cited `documents.documents`).
- **Does NOT** read `document_fields` values or `life.facts`. So "you have a will" surfaces, but "your will names Jane Doe as guardian and 3 beneficiaries" never does.

### Recommendations — PASS (document-readiness driven)

- `documents.recommendations` persists "Upload your X", renew-soon, low-confidence-review into `document_recommendations`.
- Family recs (estate gap, coverage gap) come from `family.py` via the real columns. ✅ cited.
- **Gap:** no recommendation is ever generated _from_ a `life.facts` value (e.g. "your term policy expires in 3 years" — term_years is extracted, bridged to `life.facts`, then unread).

### Graph (`life_graph_workspace.py`) — FAIL

- Nodes/edges = recommendations + persisted graph edges + recommendation→evidence→source lineage. Documents, `document_fields`, `life.facts`, `life.relationships` are **never queried**. Uploaded documents do not appear in the Explainable Life Graph.

### Reports (`report_engine.py`) — PASS (partial)

- `_conflicts_section` (cited), `_resume_imports_section` (cited, with source doc + confidence), comp evidence (`documents.documents`), readiness from `life.readiness_snapshots` (163). All real + cited.
- **Gap:** no "Documents on file → extracted values" section; `life.facts` detail never enters a report.

### Advisor (`advisor_facts.py` + `conflicts.open_conflict_facts`) — PARTIAL

- Sees document **count + titles** and **open conflicts** (good — it will say "your sources disagree on coverage, please confirm").
- **Does NOT** see the extracted values themselves, nor field-level review status. So a user who confirms "coverage = $500k" in the Evidence drawer changes the _conflict_ outcome but not the advisor's fact set (the advisor never had the $500k value as a fact — only the conflict, or the Family `life_coverage` column indirectly via the domain summary).

---

## Surfacing fixes (no new infra — wire existing data)

1. **Add a `life.facts` reader to `advisor_facts.py`.** Select `life.facts` (user-scoped, `confirmation_status != 'candidate'`, not `rejected`) and emit each as a cited fact (`source='document-intelligence'`, `sourceTable='life.facts'`, with `confidence` + `provenance.document_id`). This single change makes every extracted value advisor-visible and citable. **Highest leverage.**
2. **Read `*.metadata` in the Family summary + Family Office checklist.** `family.py` already loads the `estate_plans`/`insurance_profiles` rows — surface `metadata.executor`, `metadata.beneficiaries`, `metadata.trustee`, `metadata.premium`, `metadata.insurer`, `metadata.policy_type` as cited facts. No new query.
3. **Add documents/facts as graph nodes.** In `life_graph_workspace.py`, project `documents.documents` (Document nodes) + their `life.facts` (DocumentField/Fact nodes) with `provenance` edges, reusing the existing source-lineage pattern. Honest empty when none.
4. **Dashboard "applied changes" feed.** Read recent `documents.documents` + persisted `change_summary` (see DOCUMENT_CHANGE_VISIBILITY) → show what each upload changed, not just a count.
5. **Report "Documents & Extracted Facts" section.** Add a section reading `document_fields` (confirmed/extracted, not rejected) grouped by document, each cited to page/section.

All five read rows that **already exist**; none adds a table, model, or service.

---

## Empty / In-Progress / Complete (render states)

- **Empty:** No facts/documents → advisor "0 documents on file"; graph honest-empty; dashboard "upload to see changes." ✅ no fabrication.
- **In-Progress:** `inferred`/`needs_review` facts → surface qualified ("inferred from a scanned document — confirm?"), never as hard fact. The `confirmation_status` discipline from `ingestion.py` already supports this.
- **Complete:** `confirmed` facts → cited, full-confidence, render everywhere once readers exist.

## Biggest hidden-intelligence finding

`life.facts` (and `life.relationships`) is a **fully-built, provenance-complete, idempotent write-only sink with zero readers.** Every document the user uploads has its detailed values extracted, confidence-scored, conflict-checked, and written here with full provenance — and then no advisor, dashboard, report, or graph ever reads it. Wiring a single `life.facts` reader into `advisor_facts.py` (fix #1) is the highest-leverage surfacing move in the entire Document Intelligence domain.
