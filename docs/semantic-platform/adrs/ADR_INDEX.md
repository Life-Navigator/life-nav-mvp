# ADR Index — Enterprise Semantic Knowledge Platform

**Date:** 2026-07-30 · **Evidence base:** `docs/semantic-platform/FINAL_TECHNICAL_DESIGN_REVIEW.md`
**All records are `Proposed`.** A written ADR is not an accepted decision.

---

## Records

| ADR                                                                 | Title                                                | Severity | Selected option                                       | Reversible      | Prod mutation       | Depends on    |
| ------------------------------------------------------------------- | ---------------------------------------------------- | -------- | ----------------------------------------------------- | --------------- | ------------------- | ------------- |
| [001](ADR-001-transaction-data-placement.md)                        | Transaction data placement and graph aggregation     | Critical | Account-period summaries; drop user-anchored edge     | Yes             | Yes (Stage 6)       | 002, 004, 008 |
| [002](ADR-002-provenance-substrate-and-granularity.md)              | Provenance substrate and granularity                 | Critical | Hybrid batch/per-assertion, relational, outside Neo4j | Yes             | Yes (Stage 5–6)     | 001, 010      |
| [003](ADR-003-principal-context-traversal-authorization.md)         | Principal- and context-aware traversal authorization | Critical | Context × principal matrix in manifest v3             | Yes             | No                  | —             |
| [004](ADR-004-known-absent-adversarial-evaluation.md)               | Known-absent and adversarial retrieval evaluation    | High     | Hybrid synthetic + human-reviewed, 6 categories       | Yes             | No                  | —             |
| [005](ADR-005-vector-layer-trust-and-poisoning-controls.md)         | Vector-layer trust, review state, poisoning controls | High     | Indexed payload fields, filter during search          | Yes             | Yes (payload only)  | 002, 010      |
| [006](ADR-006-canonical-business-identity.md)                       | Canonical business identity and entity resolution    | High     | Deterministic tenant-local keys + alias table         | Yes             | No (detection only) | 002, 010      |
| [007](ADR-007-secret-management-and-credential-incident-closure.md) | Secret management and credential incident closure    | Critical | Rotate all + least-privilege + secret-store delivery  | No (revocation) | No                  | —             |
| [008](ADR-008-safe-production-traversal-verification.md)            | Safe production traversal verification               | High     | Out-of-band diagnostic, then shadow                   | Yes             | No (read-only)      | 003, 004      |
| [009](ADR-009-api-gateway-retirement.md)                            | API gateway retirement                               | Medium   | Retire outright (nothing to harvest)                  | Partly          | No                  | 007, OQ-7     |
| [010](ADR-010-minimal-stored-confidence-model.md)                   | Minimal stored confidence model                      | High     | Three stored components; rest computed                | Yes             | No                  | 002           |
| [011](ADR-011-catalog-semantic-superclass-hierarchy.md)             | Catalog-based semantic superclass hierarchy          | Medium   | `superclass` catalog field; no graph labels           | Yes             | No                  | 003           |

## Supporting documents

| Document                                                         | Purpose                                                  |
| ---------------------------------------------------------------- | -------------------------------------------------------- |
| [ADR_DECISION_SUMMARY.md](ADR_DECISION_SUMMARY.md)               | One-page summary of every decision and what it overturns |
| [ADR_CONSISTENCY_MATRIX.md](ADR_CONSISTENCY_MATRIX.md)           | Cross-record dependencies; 3 conflicts, 1 unresolved     |
| [ADR_IMPLEMENTATION_SEQUENCE.md](ADR_IMPLEMENTATION_SEQUENCE.md) | Proposed sequence, challenged against the brief's        |
| [ADR_OPEN_QUESTIONS.md](ADR_OPEN_QUESTIONS.md)                   | 12 open questions, 8 blocking                            |
| [ADR_REVIEW_AGENDA.md](ADR_REVIEW_AGENDA.md)                     | Review sessions, required approvers, decision order      |
| `artifacts/semantic-platform/adrs/adr_metadata.json`             | Machine-readable metadata                                |

## Records that overturn prior designs

| ADR | Supersedes                                                                       | What was wrong                                                     |
| --- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 002 | `PROVENANCE_MODEL.md` §2, §2.1, §5                                               | In-graph 1:1 assertions double the graph and mandate a rebuild     |
| 010 | `CONFIDENCE_MODEL.md` §2, §3                                                     | Seven components + Bayesian combination atop one measured signal   |
| 011 | `SEMANTIC_DATA_MODEL.md` §4, SP-032                                              | Graph-wide label migration to serve 127 nodes                      |
| 009 | `REMEDIATION_MASTER_PLAN.md` C-B; `KNOWLEDGE_GRAPH_REFERENCE_ARCHITECTURE.md` §7 | RRF was claimed unique to the gateway; it exists at `fusion.py:81` |

## Status vocabulary

`Proposed` · `Under Review` · `Accepted` · `Rejected` · `Superseded` · `Implemented` · `Verified` ·
`Operationally Observed`
