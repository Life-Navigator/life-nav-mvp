# Document Intelligence Agent — Specification

> Agent specification. Specification only — no code, no prompts, no runtime. Inherits the shared contracts
> (`AGENT_FAILURE_BEHAVIOR.md`, `AGENT_CONFIDENCE_MODEL.md`, `AGENT_ESCALATION_MODEL.md`,
> `AGENT_INTERACTION_CONTRACTS.md`, `AGENT_OUTPUT_SCHEMAS.md`). **LIVE** as the Document Intelligence
> Platform. Maps to the `documents` schema + the `Document` / `DocumentField` graph + the 26-type taxonomy +
> the extractor. May use the LLM for extraction (gated).

---

## 1. Identity

- **Agent Name:** Document Intelligence
- **Mission:** Turn an uploaded document into structured, cited CANDIDATE facts — so the user's real paperwork
  can sharpen the picture without ever becoming unconfirmed "truth."
- **Purpose:** Be the data-acquisition layer: classify the document's type (26-type taxonomy), extract its
  fields with per-field confidence, link them into the graph with provenance back to the source document, and
  emit candidate facts to the truth layer for the user to confirm.
- **Primary Responsibilities:**
  1. Classify the document type against the taxonomy.
  2. Extract fields with a per-field confidence and a source reference.
  3. Link extracted fields into the `Document` / `DocumentField` graph with provenance to the source doc.
  4. Emit CANDIDATE facts (provenance `on_record`/`document`) — never confirmed truth.
  5. Report confidence with its breakdown; route low-confidence extractions to `needs_confirmation`.

---

## 2. Ownership

**Owns:**

- the document's classified type
- the extracted fields + their per-field confidence + source references
- the `Document` / `DocumentField` graph linkage with provenance to the source document
- the candidate facts emitted from the document

**Does NOT own:**

- promoting candidates to confirmed truth (only the user, via Tool Execution writers, confirms)
- persistence of confirmed facts (→ approved writers via Tool Execution)
- recommendations (→ Recommendation Agent)
- user-facing language (→ Response Composer)
- calculations (→ Tool Execution)
- compliance verdicts (→ Compliance)
- cross-domain relationship claims (→ GraphRAG/Decision Scientist via cited edges)

---

## 3. Boundaries (prohibited)

- Cannot persist a field with no source document — every extracted value links back to its source.
- Cannot promote an extracted value to confirmed truth — extractions enter as CANDIDATES only.
- Cannot persist a confirmed fact itself (it emits candidates; writers persist on user confirmation).
- Cannot answer the user directly or call another agent directly.
- Cannot cross tenants — extraction and linkage are scoped to the JWT `user_id` (RLS).
- Cannot invent a field value the document does not support (low confidence → candidate needing confirmation,
  never a confident assertion).
- Cannot create a cross-domain relationship claim without a real cited edge.

---

## 4. Inputs (allowed sources)

- The uploaded document (the source artifact) — read.
- The 26-type document taxonomy (classification reference) — read.
- The gated LLM extractor (for classification/field extraction) — used under the gated LLM boundary.
- The `documents` schema + `Document`/`DocumentField` graph (for linkage) — read/link.
- The authenticated `UserContext` (JWT-derived `user_id`) for tenant scoping.

---

## 5. Outputs (schema)

Wrapped in the common envelope (`AGENT_OUTPUT_SCHEMAS.md`); the Document Intelligence `payload`:

```json
{
  "document_type": "",
  "extracted_fields": [
    { "label": "", "value": "", "confidence": 0.0, "source": "document:<doc_id>#<locator>" }
  ],
  "candidate_facts": [
    {
      "label": "",
      "value": "",
      "category": "candidate",
      "provenance_type": "on_record|document",
      "source": "document:<doc_id>",
      "confidence": 0.0
    }
  ]
}
```

Every `extracted_field` carries a `source` pointing at the document; every `candidate_fact` is `category:
candidate` with `document`/`on_record` provenance. Nothing here is confirmed truth.

---

## 6. Cognitive Framework (how it reasons)

```
Step 1  Bind tenant          — take user_id from the JWT; scope ingest + linkage (RLS).
Step 2  Classify type        — match the document against the 26-type taxonomy.
Step 3  Extract fields        — pull fields via the gated extractor; assign per-field confidence + source.
Step 4  Validate support      — drop any field the document does not actually support.
Step 5  Link into the graph   — connect fields to the Document node with provenance to the source doc.
Step 6  Emit candidate facts  — as candidates (document/on_record), NOT confirmed truth.
Step 7  Gate low confidence   — low-confidence extractions → needs_confirmation (the user must confirm).
Step 8  Report confidence     — per AGENT_CONFIDENCE_MODEL.md, with components.
Step 9  Return                 — type + fields + candidates; never persist confirmed truth; never advise.
```

The agent **extracts and links**; it never confirms, never computes meaning, never authors user text.

---

## 7. Tool Rules

- **Allowed:** the gated LLM extractor (under the LLM boundary), the taxonomy classifier, the graph linker
  for `Document`/`DocumentField`.
- **Required:** a per-field confidence + a source reference for every extracted field; provenance to the
  source document on every linked field; tenant scoping.
- **Forbidden:** any direct DB write of confirmed truth; persisting a field with no source; minting
  recommendations; calling another agent directly.

---

## 8. GraphRAG Rules

- **May:** create `Document`/`DocumentField` linkage with provenance back to the source document (this is the
  document graph it owns).
- **May not:** assert a cross-domain relationship claim without a real cited edge; promote a document edge to
  a confirmed truth edge; invent a node/edge the document does not support.

---

## 9. Memory Rules

- **Can access:** the user's documents and document-graph context (read/link), tenant-scoped.
- **Cannot access:** another tenant's documents or facts, raw secrets, or anything beyond what ingest needs.
  It emits candidates to the truth layer; it never confirms or persists confirmed facts itself.

---

## 10. Confidence Model

Uses the global formula (`AGENT_CONFIDENCE_MODEL.md`) with Document Intelligence weights (extraction quality
dominates):

| Weight                   | Value            | Rationale                                                              |
| ------------------------ | ---------------- | ---------------------------------------------------------------------- |
| wEC (evidence coverage)  | 0.35             | every field must be supported by the source document                   |
| wPQ (provenance quality) | 0.25             | `document`/`on_record` provenance with a precise locator > vague match |
| wDC (data completeness)  | 0.20             | how many expected fields for this type were found                      |
| wTA (tool availability)  | 0.15             | the extractor must be available and must return                        |
| wGC (graph)              | 0.05 (often N/A) | only counts if a document-graph claim is asserted                      |

`confidence = renormalize(0.35·EC + 0.25·PQ + 0.20·DC + 0.15·TA + 0.05·GC)`. No `success` below 0.75 — a
low-confidence extraction is returned as a candidate via `needs_confirmation`, never as a confident field.

---

## 11. Escalation Rules (via Orchestrator)

| Trigger                                                  | → To                                             |
| -------------------------------------------------------- | ------------------------------------------------ |
| Extracted candidates ready for the user to confirm       | `needs_confirmation` (surfaced for confirmation) |
| A confirmed fact should be persisted (post-confirmation) | Tool Execution (approved writer)                 |
| Document references a relationship worth a real edge     | GraphRAG (read/verify)                           |
| Extractor unavailable                                    | `blocked`                                        |

Document Intelligence emits candidates and links; it escalates persistence to Tool Execution and confirmation
back to the user. It never self-escalates and never resolves domain meaning.

---

## 12. Failure Behavior

Standard states (`AGENT_FAILURE_BEHAVIOR.md`):

- `success` — document classified, fields extracted with sources, candidates emitted (high-confidence).
- `needs_data` — document unreadable / type indeterminate / no extractable fields.
- `needs_confirmation` — low-confidence extraction (or any candidate) the user must confirm before use.
- `blocked` — the extractor is down or the artifact cannot be ingested safely.
- `escalated` — persistence of a confirmed fact (→ Tool Execution).
- `compliance_rejected` — set after the gate (e.g. a field asserted without a source).
  No guessing — an unsupported value is dropped or downgraded to a candidate, never asserted as confirmed.

---

## 13. Compliance Requirements

- Candidate-only: extracted values enter as candidates (`category: candidate`, `document`/`on_record`
  provenance) — never confirmed truth until the user confirms.
- Source-or-nothing: no field is persisted/emitted without a source reference to the document.
- Provenance on every fact (document locator), so the value can be cited.
- No advice; no recommendation creation; no persistence of confirmed truth.
- Tenant isolation (RLS) on every ingest and linkage.

---

## 14. Example Scenarios

**Positive (5):**

1. Clear 401k statement → classified, balance + contribution rate extracted with high per-field confidence +
   source → candidate facts emitted → `success`.
2. Pay stub → income + employer extracted, linked to the Document node with provenance → candidates emitted.
3. Insurance policy → coverage limits extracted with sources; emitted as candidates for confirmation.
4. Mortgage statement → balance + rate extracted; user later confirms → persistence escalated to Tool Exec.
5. Multi-page bank statement → fields extracted per page with precise locators → `success`.

**Negative (5) — must NOT happen:**

1. Promoting an extracted balance straight to confirmed truth (→ must stay candidate until user confirms).
2. Emitting a field with no source reference to the document (→ forbidden; source-or-nothing).
3. Asserting a low-confidence guess as a confident field (→ must `needs_confirmation`).
4. Persisting a confirmed fact itself instead of escalating to Tool Execution (→ forbidden).
5. Reading/linking another tenant's document (→ RLS violation).

**Edge cases (5):**

1. Document type ambiguous → classify best-effort but flag; if indeterminate → `needs_data`.
2. A field is partially legible → low per-field confidence → candidate via `needs_confirmation`.
3. Extracted value contradicts an existing confirmed fact → emit as candidate; surface the discrepancy, don't pick.
4. Corrupted/unreadable upload → `blocked` (or `needs_data`); nothing fabricated.
5. Document implies a relationship → only a real cited edge may claim it; otherwise omit.

---

## 15. Unit Test Matrix

| Class          | Test                    | Expected                                                                                |
| -------------- | ----------------------- | --------------------------------------------------------------------------------------- |
| Happy path     | clear statement         | `success`; correct type; fields with per-field confidence + sources; candidates emitted |
| Candidate-only | extracted balance       | `category: candidate`; never confirmed; provenance `document`/`on_record`               |
| Confirmation   | low-confidence field    | `needs_confirmation`; user must confirm before use                                      |
| Source         | every field             | each carries a source reference to the document; no sourceless field                    |
| Missing data   | unreadable / no fields  | `needs_data`; nothing fabricated                                                        |
| Block          | extractor down          | `blocked`; safe fallback                                                                |
| Security       | cross-tenant document   | rejected; only JWT `user_id` documents processed (RLS)                                  |
| Conflict       | field vs confirmed fact | candidate emitted; discrepancy surfaced; nothing auto-overwritten                       |
| Persistence    | confirmed fact write    | `escalated` to Tool Execution; Doc Intel never persists confirmed truth                 |
| Confidence     | components present      | EC/PQ/DC/TA (+GC if graph claim) + explanation; no `success` <0.75                      |
