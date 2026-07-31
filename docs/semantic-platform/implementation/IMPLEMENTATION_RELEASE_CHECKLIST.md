# Implementation Release Checklist

**Date:** 2026-07-30 · Phase 10. Nothing reaches production unless every **Required** item is complete.

Categories: **Required** · **Recommended** · **Future improvement** · **Unknown** · **Blocked**.

---

## 1. Programme-level — must be true before ANY production change

| #    | Item                                                                   | Category               | Status                              |
| ---- | ---------------------------------------------------------------------- | ---------------------- | ----------------------------------- |
| P-01 | All exposed credentials revoked with **rejected-old-credential proof** | **Required**           | **BLOCKED** — owner action          |
| P-02 | Least-privilege replacements issued; consumers verified                | **Required**           | Blocked on P-01                     |
| P-03 | Service-role holders = 1                                               | **Required**           | Blocked                             |
| P-04 | Incident residuals R-1, R-3 closed                                     | **Required**           | Blocked                             |
| P-05 | OQ-12 (credential used?) answered                                      | **Required**           | **Unknown** — largest residual risk |
| P-06 | ≥1 ADR `Accepted` with signed approval record                          | **Required**           | **BLOCKED** — 0 of 11               |
| P-07 | All blocking rejection triggers owned (owner+method+date+escalation)   | **Required**           | **BLOCKED** — 0 of 11               |
| P-08 | OQ-9 tenant divergence classified, 0 unclassified                      | **Required**           | Blocked                             |
| P-09 | Invariant automation (WP-010) live                                     | **Required**           | Not started — **may start today**   |
| P-10 | Rollback rehearsed for every production-mutating package               | **Required**           | Blocked                             |
| P-11 | Capacity load-tested                                                   | **Recommended**        | **Unknown** — no baseline exists    |
| P-12 | APM / tracing across services                                          | **Future improvement** | Not started                         |

**Six Required items are blocked and two are unknown. No production change may proceed.**

---

## 2. Per-package release gate

Applied to every package before it advances past S4.

| #    | Item                                                    | Category        |
| ---- | ------------------------------------------------------- | --------------- |
| R-01 | Maps to exactly one `Accepted` ADR                      | **Required**    |
| R-02 | All universal gates green (G-01…G-06)                   | **Required**    |
| R-03 | Package-specific gates green                            | **Required**    |
| R-04 | Rollback **rehearsed**, not merely documented           | **Required**    |
| R-05 | Reviewer checklist completed by a named approver        | **Required**    |
| R-06 | Dashboards + alerts live before, not after              | **Required**    |
| R-07 | Runbook exists with a named on-call owner               | **Required**    |
| R-08 | Blast radius stated and bounded                         | **Required**    |
| R-09 | Observability proves the change is doing what it claims | **Required**    |
| R-10 | Cost impact measured                                    | **Recommended** |
| R-11 | Performance delta measured vs baseline                  | **Recommended** |
| R-12 | Documentation updated in the same PR                    | **Recommended** |

**R-04 and R-06 are the two most commonly deferred and are both Required.** A rollback discovered to be
broken during an incident is not a rollback; a dashboard built after an incident explains history rather
than preventing it.

---

## 3. Production-mutation gate (WP-600 and any batch migration)

Every item Required. Inherited from the standing production safety envelope.

| #    | Item                                                                                                        |
| ---- | ----------------------------------------------------------------------------------------------------------- |
| M-01 | Environment, operation ID, code commit recorded                                                             |
| M-02 | Dry-run executed; timestamp recorded                                                                        |
| M-03 | Expected affected count stated **before** execution                                                         |
| M-04 | Expected tenants stated                                                                                     |
| M-05 | Batch size defined                                                                                          |
| M-06 | Current node/edge/point counts captured                                                                     |
| M-07 | Expected post-run counts stated                                                                             |
| M-08 | Query-plan / collection assumptions recorded                                                                |
| M-09 | Rollback command written and **rehearsed**                                                                  |
| M-10 | Reconciliation command written                                                                              |
| M-11 | Second dry run reports 0 affected (idempotency)                                                             |
| M-12 | Stop conditions armed (count, tenant, cross-tenant, dimension, duplicates, error rate, credentials-in-logs) |
| M-13 | Post-run reconciliation executed and clean                                                                  |

---

## 4. Operational readiness (Phase 6) — per production-affecting package

| Item                                                    | Category                    | Note                                                    |
| ------------------------------------------------------- | --------------------------- | ------------------------------------------------------- |
| Dashboard with baseline, current, delta                 | **Required**                | absolute numbers with no reference produce no decisions |
| Alerts configured **and demonstrated firing**           | **Required**                | an alert never seen to fire is unproven                 |
| Structured logs with correlation ID + hashed tenant     | **Required**                | no PII/PHI                                              |
| Metrics per §6 of the relevant ADR                      | **Required**                |                                                         |
| SLO + error budget                                      | **Recommended**             | none defined today                                      |
| Capacity assumption documented                          | **Required**                | currently unknown                                       |
| On-call owner named                                     | **Required**                |                                                         |
| Runbook: detect → diagnose → mitigate → escalate        | **Required**                |                                                         |
| Incident classification (`integrity` vs `availability`) | **Required**                | ADR-005 drift asymmetry depends on this                 |
| Manual recovery documented                              | **Required**                |                                                         |
| Automatic recovery (quarantine, flag kill)              | **Required** where designed | ADR-005 quarantine                                      |
| Escalation path                                         | **Required**                |                                                         |
| Traces across services                                  | **Future improvement**      | no APM today                                            |

---

## 5. Status roll-up

| Category                | Count          | Complete |
| ----------------------- | -------------- | -------- |
| Required (programme)    | 10             | **0**    |
| Recommended (programme) | 1              | 0        |
| Future improvement      | 1              | 0        |
| Unknown                 | 2 (P-05, P-11) | —        |
| Blocked                 | 8              | —        |

**One item is genuinely actionable today: P-09 (invariant automation).** It requires no ADR verdict, no
credentials, and no production access — and it protects invariants that later work will assume.
