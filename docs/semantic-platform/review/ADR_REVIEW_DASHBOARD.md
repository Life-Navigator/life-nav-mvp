# ADR Review Dashboard

**Date:** 2026-07-30 · Pre-Session-1 state. Machine-readable form:
`artifacts/semantic-platform/review/review_metadata.json`

---

## 1. Status board

| ADR                      | Status   | Session | Recommended         | Owner          | Blocking               | Impl. ready         |
| ------------------------ | -------- | ------- | ------------------- | -------------- | ---------------------- | ------------------- |
| **003** Authorization    | Proposed | **1**   | **Accept**          | Security       | none                   | ✅ after accept     |
| **007** Credentials      | Proposed | **1**   | **Accept**          | Security       | OQ-12 _(closure only)_ | ✅ containment live |
| **011** Superclass       | Proposed | **1**   | **Accept flag-off** | Graph Platform | none                   | ✅ with 003         |
| **004** Evaluation       | Proposed | 2       | Defer               | AI/Retrieval   | OQ-4                   | ❌                  |
| **008** Traversal verify | Proposed | 2       | Defer               | AI/Retrieval   | needs 003              | ❌                  |
| **002** Provenance       | Proposed | 3       | **Needs Revision**  | Graph Platform | **OQ-2**               | ❌                  |
| **010** Confidence       | Proposed | 3       | Defer               | AI/Retrieval   | needs 002              | ❌                  |
| **001** Transactions     | Proposed | 3       | **Needs Revision**  | Graph Platform | **OQ-11**, OQ-1        | ❌                  |
| **006** Identity         | Proposed | 3       | **Needs Revision**  | Data Platform  | **OQ-6**               | ❌                  |
| **005** Vector trust     | Proposed | 4       | **Needs Revision**  | Security       | **CONF-A**, OQ-5       | ❌                  |
| **009** Gateway          | Proposed | 4       | **Needs Revision**  | Platform Ops   | **OQ-7**               | ❌                  |

**0 of 11 Accepted. 0 of 11 blocking questions owned.**

---

## 2. Approval progress

| Metric                       | Value              |
| ---------------------------- | ------------------ |
| ADRs `Accepted`              | **0 / 11**         |
| Approval rows signed         | **0 / 26**         |
| Blocking questions owned     | **0 / 11**         |
| Escalated conflicts resolved | **0 / 1** (CONF-A) |
| Work packages activated      | **0 / 12**         |
| Production mutations         | **0**              |
| `GRAPH_GROUNDING_ENABLED`    | unset              |

---

## 3. Session plan — driven by evidence, not calendar

| Session | ADRs               | Gate to convene                       |
| ------- | ------------------ | ------------------------------------- |
| **1**   | 007, 003, 011      | Security lead available               |
| **2**   | 004, 008           | OQ-4 resolved; ADR-003 accepted       |
| **3**   | 002, 010, 001, 006 | **OQ-2, OQ-11, OQ-1, OQ-6 resolved**  |
| **4**   | 005, 009           | **CONF-A ruled; OQ-5, OQ-7 resolved** |

Sessions 2–4 have **no dates**. Scheduling them against a calendar rather than against resolved
evidence is how a review process starts approving on schedule pressure.

---

## 4. Critical path

```
Session 1 owner assignment (15 min)
        │
        ├── unblocks ALL acceptance (binding status rule)
        │
        ├── ADR-007 ──► every write-enabled work package
        └── ADR-003 ──► ADR-008, ADR-011, all multi-agent work

OQ investigations (11, fully parallel, ~2 days elapsed)
        └──► Sessions 2, 3, 4
```

**The programme's critical path is a 15-minute administrative block plus ~2 days of parallel read-only
investigation.** Not engineering.

---

## 5. Blocking issues, ranked

| #   | Issue                                      | Blocks                     | Effort  | Class           |
| --- | ------------------------------------------ | -------------------------- | ------- | --------------- |
| 1   | 11 blocking questions unowned              | **all acceptance**         | 15 min  | administrative  |
| 2   | Credential closure without rejection proof | all write work             | 1–2d    | security        |
| 3   | OQ-2 batch homogeneity                     | ADR-002 → 010, 005         | 1d      | inspection      |
| 4   | OQ-7 `central` Neo4j                       | ADR-009                    | 1d      | production read |
| 5   | CONF-A ruling                              | ADR-005                    | ruling  | policy          |
| 6   | OQ-11 read dependencies                    | ADR-001                    | 1d      | inspection      |
| 7   | OQ-9 tenant divergence                     | integrity gates            | 1–2d    | production read |
| 8   | OQ-6 `entity_id`                           | ADR-006                    | 0.5d    | inspection      |
| 9   | OQ-4 persona census                        | ADR-004                    | 1d      | inspection      |
| 10  | Branch protection (B-17)                   | invariant gate enforcement | minutes | repo admin      |

---

## 6. Implementation readiness

| Package            | ADR       | Ready?                                               |
| ------------------ | --------- | ---------------------------------------------------- |
| WP-010 invariants  | none      | ✅ **DONE** — Sprint 1, mutation-proven              |
| WP-000 credentials | 007       | ⚠️ containment live; closure pending rejection proof |
| WP-110 manifest v3 | 003 + 011 | ⏳ ready on acceptance                               |
| all others         | various   | ❌ blocked                                           |

---

## 7. Review cadence

| Item                  | Cadence                                |
| --------------------- | -------------------------------------- |
| Open-question owners  | weekly until resolved                  |
| `Needs Revision` ADRs | on evidence arrival, not on a timer    |
| `Accepted` ADRs       | at implementation completion + 90 days |
| CONF-A                | weekly until ruled                     |
| Dashboard             | after every session                    |

---

## 8. Health indicators

| Indicator                            | Status    | Reading                                    |
| ------------------------------------ | --------- | ------------------------------------------ |
| Decisions made on absent evidence    | **0**     | 🟢 the discipline is holding               |
| ADRs accepted without owners         | 0         | 🟢                                         |
| Architectural conflicts hidden       | 0         | 🟢 CONF-A escalated, not resolved silently |
| Blocking questions unowned           | **11**    | 🔴 **the one red indicator**               |
| Invariants protected by memory alone | 4 → **0** | 🟢 Sprint 1                                |
| Production mutations before closure  | 0         | 🟢                                         |

**One red indicator, and it is fixable in fifteen minutes.**
