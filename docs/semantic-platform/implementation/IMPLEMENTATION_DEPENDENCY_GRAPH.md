# Implementation Dependency Graph

**Date:** 2026-07-30 · Phase 2.

---

## 1. DAG

```
                    ┌──────────────────────────────────────────┐
                    │ WP-000  Stage 0 credential closure       │  ← gates ALL write-enabled work
                    └───────────────┬──────────────────────────┘
                                    │
      ┌─────────────────────────────┼──────────────────────────────┐
      │                             │                              │
┌─────▼─────────┐        ┌──────────▼──────────┐        ┌──────────▼──────────┐
│ WP-100 golden │        │ WP-110 manifest v3  │        │ WP-010 invariant    │
│ set (ADR-004) │        │ (ADR-003 + ADR-011) │        │ automation (DA-1..4)│
└─────┬─────────┘        └──────────┬──────────┘        └─────────────────────┘
      │                             │                     ↑ NO ADR DEPENDENCY
      │            ┌────────────────┴───────────┐           may start today
      │            │                            │
      │   ┌────────▼─────────┐        ┌─────────▼────────┐
      │   │ WP-200 traversal │        │ WP-120 identity  │
      │   │ verify (ADR-008) │        │ decls (ADR-006)  │
      │   └────────┬─────────┘        └─────────┬────────┘
      │            │                            │
      └────────────┼────────────────┐           │
                   │                │           │
          ┌────────▼──────┐  ┌──────▼───────────▼──┐
          │ WP-400 emission│  │ WP-500 provenance   │
          │ (ADR-001)      │  │ schema (ADR-002)    │
          └────────┬───────┘  └──────┬──────────────┘
                   │                 │
                   │        ┌────────▼────────┐
                   │        │ WP-510 confidence│
                   │        │ fields (ADR-010) │
                   │        └────────┬─────────┘
                   │                 │
                   │        ┌────────▼─────────┐
                   │        │ WP-300 vector    │
                   │        │ trust (ADR-005)  │  ⚠ CONF-A ordering conflict
                   │        └────────┬─────────┘
                   │                 │
              ┌────▼─────────────────▼────┐
              │ WP-600 historical migrations│  ← first true production mutations
              └────────────┬────────────────┘
                           │
                  ┌────────▼─────────┐
                  │ WP-700 retirement │ (ADR-009, gated on OQ-7)
                  └───────────────────┘
```

**No circular dependencies exist.** Verified by inspection of the ADR dependency fields in
`adr_metadata.json`: 001→{002,004,008}, 002→{001,010}, 005→{002,010}, 006→{002,010}, 008→{003,004},
009→{007}, 010→{002}, 011→{003}.

**One apparent cycle — 001 ↔ 002 — is not one.** ADR-001 depends on ADR-002 only for _acceptance
sequencing_ (fewer transaction edges reduces provenance volume, informing 002's design); ADR-002
depends on ADR-001 only for _cost estimation_. Neither depends on the other's **implementation**.
Resolution: 001's deprecation step (WP-400) may precede 002's schema (WP-500); only 001's historical
removal (WP-600) must follow. Recorded so a future reader does not "fix" a cycle that isn't there.

---

## 2. Critical path

```
WP-000 → WP-110 → WP-200 → WP-400 → WP-500 → WP-600
(credentials) (manifest v3) (traversal) (emission) (provenance) (migrations)
```

**WP-100 (golden set) runs parallel** but gates the _acceptance criteria_ of WP-200 and WP-400 — it is
not on the build path but is on the **evidence** path. A parallel item that gates acceptance is the
easiest kind to under-resource; it is flagged here for that reason.

**WP-010 (invariant automation) has no ADR dependency at all** and may start immediately. It is
off the critical path and off the evidence path, but DA-1 (single-writer enforcement) protects an
assumption WP-500 depends on — so it should land **before** WP-500, not merely eventually.

---

## 3. Dependency classification

| From   | To                       | Type                       | Reason                                                      |
| ------ | ------------------------ | -------------------------- | ----------------------------------------------------------- |
| WP-000 | all write-enabled        | **hard**                   | credential prerequisite, standing rule                      |
| WP-110 | WP-200                   | **hard**                   | `evaluation` context must exist                             |
| WP-110 | WP-120 (superclass part) | **hard**                   | shared manifest v3 (CONFLICT-3)                             |
| WP-100 | WP-200 acceptance        | **hard (evidence)**        | no baseline, no verdict                                     |
| WP-100 | WP-400 acceptance        | **hard (evidence)**        | no-regression gate                                          |
| WP-500 | WP-510                   | **hard**                   | confidence fields live on the assertion schema              |
| WP-510 | WP-300                   | **hard**                   | eligibility flags derive from confidence                    |
| WP-500 | WP-300 traceability      | **hard** ⚠                 | **violated by current stage order — CONF-A**                |
| WP-007 | WP-700                   | **hard**                   | credential revocation precedes retirement                   |
| WP-010 | WP-500                   | **soft, strongly advised** | DA-1 protects the single-writer assumption WP-500 relies on |
| WP-400 | WP-500                   | **soft**                   | fewer edges makes provenance cheaper; not required          |
| WP-120 | WP-500                   | **soft**                   | stable subject id improves assertions; not required         |

---

## 4. Parallel execution opportunities

| Can run concurrently      | Constraint                                        |
| ------------------------- | ------------------------------------------------- |
| WP-010 + WP-100 + WP-110  | different repos/skills; **WP-010 needs no ADR**   |
| WP-100 + WP-120           | independent                                       |
| WP-200 + WP-120           | after WP-110                                      |
| OQ investigations (all 9) | **fully parallel — no dependencies between them** |

**The OQ row is the important one.** All nine blocking questions are independently investigable, all are
read-only, and none needs an ADR verdict. Parallelizing them is the fastest route to unblocking the
programme, and it is currently the work with zero owners.

---

## 5. Shared points

| Shared                        | Packages                                | Risk                                                             |
| ----------------------------- | --------------------------------------- | ---------------------------------------------------------------- |
| **Manifest schema v3**        | WP-110 (003 + 011)                      | single migration; two ADRs — a rejection of either forces re-cut |
| **Assertion schema**          | WP-500, WP-510                          | 002 and 010 must land together or 010's fields have no home      |
| **Qdrant payload**            | WP-300, WP-600                          | backfill then migration touch the same points                    |
| **Golden set harness**        | WP-100, WP-200, WP-400, WP-011          | one harness, four consumers — **shared bottleneck**              |
| **Reviewers: Security**       | 003, 005, 007 + all cross-track         | **most contended reviewer in the programme**                     |
| **Reviewers: Graph Platform** | 001, 002, 011 owner; reviewer on 5 more | second most contended                                            |
| **Rollback: manifest revert** | WP-110                                  | one revert restores both 003 and 011 behaviour                   |

**Reviewer contention is a real schedule risk**, not an administrative note: Security owns or reviews
9 of 11 ADRs. Serializing on one reviewer would negate the parallelism above. Logged as risk R-04.
