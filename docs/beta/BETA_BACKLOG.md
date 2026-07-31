# Beta Backlog — dependency-ordered

**Date:** 2026-07-30. Every P0/P1 has an owner role, dependency, acceptance criterion, test evidence,
effort, rollback, and target prompt. **No "polish" bucket exists.**

Machine-readable: `artifacts/beta/beta_backlog.json`

---

## P0 — Beta Blocker (beta cannot admit external users)

| ID        | Item                                                                | Journey/Risk      | Owner         | Dependency                     | Acceptance                                                                                 | Evidence          | Effort    | Rollback                     | Prompt   |
| --------- | ------------------------------------------------------------------- | ----------------- | ------------- | ------------------------------ | ------------------------------------------------------------------------------------------ | ----------------- | --------- | ---------------------------- | -------- |
| **P0-1**  | Credential closure with **rejection proof**                         | D-1               | Security      | ADR-007 accepted; owner action | every exposed credential proven rejected; least-privilege replacements; consumers verified | closure record    | 1–2d      | n/a — irreversible by design | **2**    |
| **P0-2**  | Push 26 commits; open PR; restore remote branch                     | launch obligation | Eng Lead      | none                           | branch on origin; CI green                                                                 | CI run            | 15m       | revert branch                | **2**    |
| **P0-3**  | Classify ~120 off-journey dashboard routes (keep / hide / scaffold) | support cost      | Product + Eng | exercise the app               | every route labelled; scaffold routes unreachable in beta nav                              | route inventory   | 2–3d      | unhide                       | **2→3**  |
| **P0-4**  | Verify GoTrue public signup is actually disabled                    | J1 security       | Security      | owner action                   | live probe: anon signup **rejected**                                                       | probe log         | 1h        | n/a                          | **2**    |
| **P0-5**  | Establish journey baselines (J1–J5 completion, latency, error rate) | all gates         | Eng           | preview env                    | every UNMEASURED value replaced with a measurement                                         | scorecard         | 2d        | n/a                          | **2**    |
| **P0-6**  | **ANOM-1** 17-tenant divergence classified                          | D-7, J5           | Data Platform | OQ-9 owner                     | 9-bucket classification, 0 unclassified                                                    | artifact          | 1–2d      | **never delete**             | **2→6**  |
| **P0-7**  | Retrieval golden set incl. known-absent                             | D-5/D-8, G2       | AI/Retrieval  | **ADR-004 `Needs Revision`**   | ≥100 queries, 6 categories, baseline recorded                                              | `golden.json`     | 2–2.5w    | n/a read-only                | **7/13** |
| **P0-8**  | Zero-fabrication gate on known-absent                               | **the promise**   | AI/Retrieval  | P0-7                           | fabrication = 0                                                                            | eval report       | with P0-7 | n/a                          | **13**   |
| **P0-9**  | Truthful deletion UX (proven, or honest limitation)                 | J5, compliance    | Privacy       | ADR-002 blocked                | UI never falsely claims deletion; machine-readable artifact                                | deletion artifact | 1w        | disable deletion UI          | **10**   |
| **P0-10** | E2E for J1–J5 against staging                                       | all               | QA            | P0-3, P0-5                     | 5 journeys pass on real services                                                           | Playwright run    | 2w        | n/a                          | **13**   |

**P0-7/P0-8 are decision-blocked, not effort-blocked.** ADR-004 is `Needs Revision` pending OQ-4
(a ~1-day persona census). **This is the cheapest unblock of the highest-value beta gate**, and it is
currently unowned.

---

## P1 — Beta Required (beta launches without polish, not without these)

| ID    | Item                                              | Journey    | Owner         | Dependency                   | Acceptance                                                      | Effort | Prompt  |
| ----- | ------------------------------------------------- | ---------- | ------------- | ---------------------------- | --------------------------------------------------------------- | ------ | ------- |
| P1-1  | Pick **one** onboarding paradigm                  | J1         | Product       | P0-3                         | one path; other removed from beta nav                           | 1w     | 4       |
| P1-2  | Account closure route                             | J1/J5      | Product       | none                         | user can close account; data disposition truthful               | 3d     | 10      |
| P1-3  | User-visible ingestion state model                | J2/J6      | Eng           | none                         | 10 states from **real backend state**, not timers               | 2w     | 6       |
| P1-4  | Idempotent retry + resumability                   | J2         | Eng           | P1-3                         | no duplicate graph/vector content on retry                      | 1w     | 6       |
| P1-5  | Cross-store reconciliation (4 stores)             | J2/J5      | Data Platform | P0-6                         | divergence detected and reported                                | 1w     | 6       |
| P1-6  | Citation resolvability + access recheck           | J3/J8      | Eng           | none                         | citation never grants access user lacks                         | 1w     | 8       |
| P1-7  | Insufficient-evidence UX                          | J3         | UX            | none                         | honest "no evidence" state, not a hedged answer                 | 3d     | 8       |
| P1-8  | Pick **one** canonical return surface             | J4         | Product       | triage #1                    | single home answering what changed / needs attention            | 1w     | 9       |
| P1-9  | Approval-gated actions (no autonomous mutation)   | J4         | Eng           | none                         | suggestion → approval → `life.facts`; **0 autonomous writes**   | 1w     | 9       |
| P1-10 | Advisor-inferred vs external growth ratio + alert | J4         | Eng           | P1-9                         | ratio tracked; abnormal growth alerts                           | 3d     | 9/11    |
| P1-11 | Beta support console (least-privilege)            | J5         | Ops           | none                         | diagnose without DB access; **no document contents by default** | 1w     | 10      |
| P1-12 | Vector-layer trust filter                         | D-9        | Security      | **ADR-005 + CONF-A blocked** | unreviewed content cannot reach a privileged path               | 1w     | 5/7     |
| P1-13 | Structured logging + trace ID across tiers        | ops        | Ops           | none                         | one trace ID browser→API→worker→stores                          | 1w     | 11      |
| P1-14 | Deep readiness checks                             | ops        | Ops           | none                         | dead datastore ⇒ not ready                                      | 3d     | 11      |
| P1-15 | Backup/restore exercised outside production       | recovery   | Ops           | none                         | restore reconciled across stores                                | 1w     | 12      |
| P1-16 | WCAG 2.2 AA on J1–J5                              | G9         | UX            | P0-3                         | 0 serious/critical                                              | 1w     | 3/13    |
| P1-17 | Manifest policy fidelity (C-2/D-4)                | D-4        | Security      | ADR-003 (Session 1)          | exported == declared; 119-parity                                | 1–1.5w | post-S1 |
| P1-18 | Load test → establish p95 threshold               | G10        | Ops           | preview                      | documented capacity                                             | 3d     | 13      |
| P1-19 | Branch protection for invariant CI gate (B-17)    | invariants | repo admin    | none                         | gate blocks merge                                               | 15m    | 2       |
| P1-20 | Single-writer scan covers api-gateway (RES-2)     | I-1        | Eng           | none                         | scan includes both Python tiers                                 | 2h     | 2       |

---

## P2 — Post-Beta

Transaction edge removal (D-2, a 2–4yr cliff at 268 tenants) · provenance completeness (ADR-002) ·
graph traversal in answers (ADR-008) · gateway retirement (ADR-009) · confidence model (ADR-010) ·
identity resolution (ADR-006) · superclass expansion enablement · the ~120 hidden dashboard routes ·
Google/Microsoft connectors · 8 calculators · healthcare/education domains · `/employer`, `/portal`.

---

## Rejected / Out of Scope

| Item                                                                 | Reason                                                   |
| -------------------------------------------------------------------- | -------------------------------------------------------- |
| Enterprise/employer workflows                                        | All 5 personas are individuals                           |
| Central/collective knowledge                                         | `ln_central` is **empty**; highest-risk feature possible |
| Multi-agent                                                          | ADR-003 not accepted; no second principal                |
| Marketplace, billing beyond entitlement hooks                        | Not on a canonical journey                               |
| Graph-vendor abstraction, custom rules engine, multi-model embedding | Rejected in the technical review                         |
| Autonomous agents                                                    | Contradicts the approval-gated loop (P1-9)               |

---

## Blocked by unaccepted ADRs — visibly, not silently

| Item                                     | ADR     | ADR status                         | Effect on beta                                        |
| ---------------------------------------- | ------- | ---------------------------------- | ----------------------------------------------------- |
| P0-7, P0-8 golden set + fabrication gate | ADR-004 | **Needs Revision** (OQ-4)          | **The headline beta gate cannot be measured**         |
| P1-12 vector trust filter                | ADR-005 | **Needs Revision** (CONF-A)        | Poisoning vector unmitigated once users upload        |
| P0-9 provenance-complete deletion        | ADR-002 | **Needs Revision** (OQ-2)          | Deletion truthfulness limited to an honest disclosure |
| P1-17 manifest fidelity                  | ADR-003 | Proposed — **Session 1 candidate** | Latent; no second principal in beta                   |
| Graph traversal in answers               | ADR-008 | Deferred                           | J3 must work on vectors alone                         |

**Three of ten P0s are ADR-blocked.** No amount of engineering effort moves them; they move when
Session 1 assigns owners to nine open questions — roughly two days of parallel read-only work.
