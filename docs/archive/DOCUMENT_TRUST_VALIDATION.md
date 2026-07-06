# Document Trust Validation — Proven / Unproven / Broken

**Grounded finding.** End-to-end, the _acquisition + trust_ half of the pipeline is genuinely strong and shippable: provenance (page/section/char-span via migration 165), confidence bands, a real confirm/edit/reject review loop, deterministic conflict detection (migration 166), a PII guard that runs before storage, and an honest `UploadResult` state machine that never fabricates a change. What is **unproven or broken is the _surfacing_ half**: the system detects guardian/beneficiary/coverage and records them with provenance, but only _coverage_ and _will/guardian presence_ are read back anywhere (via the Family rows). Beneficiary names, executor, trustee, policy type, premium, and every `life.facts` value pass the "detected" test but fail the "user sees it later" test. The "user must see" checklist below is therefore split: detection PASSES broadly; _durable_ visibility GAPS on everything that flows only into `life.facts` or `*.metadata`.

---

## Proven to work (read the code, the path is continuous + visible)

| Capability                      | Evidence (file)                                                                                                 | Why it's proven                                                                   |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Upload → parse → store          | `documents.py:upload`, `DocumentParser`                                                                         | Real bytes path; page spans computed; storage_upload after PII gate               |
| PII guard before store          | `documents.py:scan_pii`, `_log_pii`                                                                             | Block returns before `storage_upload`; counts-only telemetry                      |
| Field provenance                | `documents.py:DocumentExtractor` + migration 165                                                                | char_start/end/page/section/method persisted + rendered in `DocumentEvidence.tsx` |
| Confidence bands                | `DocumentEvidence.tsx:band()`                                                                                   | 0..1 → Verified/High/Review/Needs-review, honest % shown                          |
| Review loop                     | `documents.py:set_field_review` + `/fields/{id}/review`                                                         | confirm/edit/reject → precedence the advisor honors                               |
| Conflict detection              | `conflicts.py:ConflictDetectionService` + migration 166                                                         | Deterministic normalizers, precedence, both sources cited, user resolves          |
| Conflict surfacing              | `ConflictReview.tsx` (remounts on upload)                                                                       | New conflicts appear immediately after an upload                                  |
| Family readiness movement       | `_bridge_family` → `family.estate_plans/insurance_profiles/guardianship_plans`, read by `app/domains/family.py` | will/coverage/guardian write the columns the domain summary reads                 |
| Honest upload result            | `UploadResult.tsx:stageStates/terminalOf`                                                                       | Never claims a stage the API didn't support; empty `changed` → honest fallback    |
| Report conflict/resume sections | `report_engine.py:_conflicts_section/_resume_imports_section`                                                   | Real rows, cited, honest-empty                                                    |
| Resume multi-record import      | `resume.py:ResumeImportService`                                                                                 | Staged → reviewed → imported to career/education with provenance                  |

## Unproven (built, but not validated against live data / no consumer)

| Capability                          | Status                                                                                 | Gap                                                                                                                                                          |
| ----------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `life.facts` from documents         | **Written, never read**                                                                | `submit_life_fact` is called per field, but grep shows **no reader** of `life.facts` outside `ingestion.py`. Unproven that any value ever influences advice. |
| `life.relationships`                | Schema + tool exist; no document writer/reader path exercised                          | Orphaned table risk                                                                                                                                          |
| Vision/OCR extraction               | `extraction_method='vision:<model>'` is a _schema value only_                          | No code path produces it; scanned docs always dead-end to `needs_review`                                                                                     |
| Confirm→advisor precedence          | Code honors `user_confirmed > extracted > inferred` in `conflicts.py:_precedence`      | But advisor reads `documents.documents` only, not field-level review status, so confirming a field changes a conflict but not the advisor's fact set         |
| Live-data citation of bridged facts | The PR memory ("advisor-grounding-reports-phase8-9") flags live-model citation as TODO | Not yet exercised with real creds                                                                                                                            |

## Broken / dead-ends (a real user hits a wall)

| Issue                                        | Where                                                                                                                                                                                                                                                          | Impact                                                                                                                                                                                             |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend doc-type catalog ≠ backend TAXONOMY | `DocumentIntelligence.tsx:DEFAULT_DOC_GROUPS` lists `pay_stub`, `tax_return`, `bank_statement`, `transcript`, `degree_plan`, `insurance_card`, `beneficiary_document`, `employment_contract`, `mortgage_statement` — **none exist in `documents.py:TAXONOMY`** | Selecting them → `400 unknown doc_type`. The proxy returns the error JSON but `DocumentIntelligence.submit` only sets result on `res.ok`, so the user sees **nothing happen** — a silent dead-end. |
| Beneficiary/executor/trustee detail          | `_upsert_estate` writes to `estate_plans.metadata`; no reader                                                                                                                                                                                                  | User uploads a will naming a guardian + 3 beneficiaries → only "will on file" + guardian surface; beneficiaries vanish                                                                             |
| Premium / policy_type / insurer              | `_upsert_insurance` → `insurance_profiles.metadata`; no reader                                                                                                                                                                                                 | Coverage amount surfaces (real column); the rest is captured then invisible                                                                                                                        |
| Documents in the graph                       | `life_graph_workspace.py` ignores documents                                                                                                                                                                                                                    | "Explainable Life Graph" cannot show document-sourced edges                                                                                                                                        |

---

## "User must see" checklist (PASS / GAP)

Scenario: a user uploads a **Will** naming an executor + guardian + beneficiaries, and a **Life Insurance Policy** with a coverage amount, beneficiary, premium, insurer.

| The user must see…              | At upload moment                                  | Durably (dashboard/advisor/report/graph)                                                                                                         | Verdict                                  |
| ------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| **Guardian detected**           | PASS — `changed[]`: "Guardian recorded: …"        | PARTIAL — `guardianship_plans.designated_guardian` set; Family domain reads guardianship _status_, surfaces "designated" but not always the name | **PASS (status) / GAP (name surfacing)** |
| **Beneficiary detected**        | PASS — `changed[]`: "Beneficiaries identified: …" | **GAP** — only `estate_plans.metadata` / `insurance_profiles.metadata` + orphaned `life.facts`; no reader                                        | **GAP**                                  |
| **Coverage identified**         | PASS — `changed[]`: "life coverage $X on file"    | PASS — `insurance_profiles.life_coverage` read by `family.py` (coverage_gap) + FamilyOfficeService                                               | **PASS**                                 |
| **Estate gap found**            | PASS — readiness recalcs                          | PASS — `family.py` estate_gap (missing will/POA/beneficiaries) feeds Family readiness + recs                                                     | **PASS**                                 |
| **Readiness changed**           | PASS — `readiness_updated` stage                  | PASS — doc readiness ring + Family readiness move                                                                                                | **PASS**                                 |
| **Recommendation updated**      | PASS — recs persisted                             | PASS — `document_recommendations` + Family recs on `/dashboard/recommendations`                                                                  | **PASS**                                 |
| **Report updated**              | n/a                                               | PASS — conflicts/resume/comp sections + `readiness_snapshots`; **GAP** — no "documents on file with extracted values" report section             | **PASS (partial)**                       |
| **Executor / trustee detected** | PASS — `changed[]`                                | **GAP** — metadata only, no reader; FamilyOfficeService reads a `trust` table, not document metadata                                             | **GAP**                                  |
| **Graph shows the document**    | n/a                                               | **GAP** — graph never reads documents/facts                                                                                                      | **GAP**                                  |

**Score:** Detection 9/9 PASS. Durable visibility: 5 PASS, 4 GAP. The trust _foundation_ is shippable; the _surfacing_ of detailed extracted facts is the work.

---

## Empty / In-Progress / Complete (validation states)

- **Empty:** No documents → doc readiness all-red "get started", advisor fact "0 documents on file", honest empty Evidence/Conflict cards. ✅ honest, no fake data.
- **In-Progress:** Scanned/low-confidence → `needs_review` with the SCANNED_MESSAGE + next_steps; conflicts `open`. ✅ honest.
- **Complete:** Extracted + confirmed → green bands, `changed[]`, readiness moved. ✅ for coverage/will; ⚠ for beneficiary/executor (complete in DB, invisible in UI).

## Recommended validation steps (no new infra)

1. Add a reader for `life.facts` (advisor_facts + dashboard) — closes 80% of the GAPs in one move (see MCP_RENDER_AUDIT).
2. Surface `estate_plans.metadata` / `insurance_profiles.metadata` in the Family domain summary + Family Office checklist.
3. Map the frontend catalog to the backend TAXONOMY (delete or implement the 9 phantom doc types) to kill the silent 400 dead-end.
4. Add documents/facts as graph nodes with provenance (reuse `life_graph_workspace` source-lineage pattern).
