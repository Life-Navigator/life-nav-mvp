# Beta Scorecard — baseline measures

**Date:** 2026-07-30. **Every product-behaviour metric is `UNMEASURED`.** The application could not be
exercised (no `.env.local`, no credentials). Populating this scorecard is Prompt 2's exit obligation.

A scorecard of invented numbers is worse than an empty one: it produces confident decisions on fiction.

---

## 1. Activation funnel

| Metric                                 | Baseline   | Beta target  | Instrument | Status |
| -------------------------------------- | ---------- | ------------ | ---------- | ------ |
| Invite redemption rate                 | UNMEASURED | ≥ 90%        | analytics  | ❌     |
| Signup completion                      | UNMEASURED | ≥ 90%        | analytics  | ❌     |
| Onboarding completion (J1)             | UNMEASURED | ≥ 80%        | analytics  | ❌     |
| First source connected (J2)            | UNMEASURED | ≥ 80%        | analytics  | ❌     |
| **Time to first grounded answer (J3)** | UNMEASURED | **< 15 min** | analytics  | ❌     |
| Return within 7 days (J4)              | UNMEASURED | ≥ 50%        | analytics  | ❌     |

---

## 2. Trust and safety — the beta's differentiator

| Metric                              | Baseline         | Target                  | Instrument                            | Status                      |
| ----------------------------------- | ---------------- | ----------------------- | ------------------------------------- | --------------------------- |
| **Known-absent fabrication**        | **UNMEASURABLE** | **0**                   | ADR-004 golden set                    | 🔴 **no instrument exists** |
| Cross-tenant leakage                | **0**            | 0                       | Sprint 1 invariants (mutation-proven) | ✅ **enforced**             |
| Answer citation coverage            | UNMEASURED       | ≥ 90% of factual claims | eval                                  | ❌                          |
| Citation resolvability              | UNMEASURED       | 100%                    | E2E                                   | ❌                          |
| Citation grants no new access       | UNMEASURED       | 100%                    | E2E                                   | ❌                          |
| Advisor-inferred graph growth ratio | UNMEASURED       | tracked + alerted       | telemetry                             | ❌                          |
| Autonomous graph mutations          | expected 0       | **0**                   | audit                                 | ❌ unverified               |

**Row 1 is the beta promise and it has no instrument.** Everything else is secondary.

---

## 3. Ingestion reliability

| Metric                     | Baseline                                 | Target                         | Status             |
| -------------------------- | ---------------------------------------- | ------------------------------ | ------------------ |
| Ingestion success rate     | UNMEASURED                               | ≥ 95%                          | ❌                 |
| Actionable failure rate    | UNMEASURED                               | 100% of failures actionable    | ❌                 |
| Retry idempotency          | UNMEASURED                               | no duplicates                  | ❌                 |
| Queue age p95              | UNMEASURED                               | within budget                  | ❌                 |
| Dead-letter count          | UNMEASURED                               | visible + recoverable          | ❌                 |
| **Cross-store divergence** | **17 tenants (Neo4j 268 vs Qdrant 251)** | **classified, 0 unclassified** | 🔴 **ANOM-1 open** |

---

## 4. Performance and cost

| Metric                      | Baseline                        | Target                     | Status |
| --------------------------- | ------------------------------- | -------------------------- | ------ |
| p50 / p95 answer latency    | UNMEASURED                      | threshold TBD by load test | ❌     |
| Frontend error rate         | UNMEASURED                      | < 1% sessions              | ❌     |
| Job failure/retry rate      | UNMEASURED                      | < 5%                       | ❌     |
| **Capacity at concurrency** | **UNKNOWN — never load-tested** | documented                 | 🔴     |
| Cost per successful J3      | UNMEASURED                      | documented                 | ❌     |

**Capacity is unknown, not merely insufficient.** Single 512 MB shared-CPU machines per service; no
load test has ever run. Every latency threshold below is currently unfalsifiable.

---

## 5. Accessibility

| Metric                            | Baseline   | Target  | Status |
| --------------------------------- | ---------- | ------- | ------ |
| axe serious/critical on J1–J5     | UNMEASURED | **0**   | ❌     |
| Keyboard completion of J1–J5      | UNMEASURED | 100%    | ❌     |
| Screen-reader async announcements | UNMEASURED | present | ❌     |

---

## 6. What IS measured today

Not everything is unknown. These are verified and reproducible:

| Fact                                         | Value                                   | Source           |
| -------------------------------------------- | --------------------------------------- | ---------------- |
| Web pages / API routes / dashboard subroutes | 189 / 320 / 138                         | repo inspection  |
| **Browser E2E specs**                        | **2**                                   | repo inspection  |
| core-api / worker tests                      | 977 / 85, green                         | test run         |
| Architectural invariants enforced            | 5, mutation-proven                      | Sprint 1         |
| Neo4j                                        | 2,506 nodes / 3,208 edges / 268 tenants | live, 2026-07-30 |
| Qdrant `life_navigator`                      | 2,218 pts, 3072-dim, 100% personal      | live             |
| Qdrant `ln_central`                          | **0 points**                            | live             |
| `GRAPH_GROUNDING_ENABLED`                    | false                                   | `fly.toml:43`    |
| Unpushed commits / remote branch             | 26 / **absent**                         | git              |

---

## 6b. Prompt 2A additions (2026-07-30)

| Fact                                          | Value                                     | Status                                         |
| --------------------------------------------- | ----------------------------------------- | ---------------------------------------------- |
| Required checks specified + machine-validated | **10**                                    | ✅ implemented, **not operationally observed** |
| Branch protection active                      | **false**                                 | ❌ externally blocked (B-17, repo admin)       |
| Fresh checkout: `pnpm install`                | **PASS** (3.7s, frozen lockfile)          | ✅ locally verified                            |
| Fresh checkout: verification command          | **NONE DEFINED**                          | ❌ gap F-1                                     |
| Fresh checkout: `pnpm test`                   | **FAILS** (`@life-navigator/mobile#test`) | ❌ gap F-2                                     |
| Offline backend tests                         | **1,016 core-api + 90 worker**            | ✅ locally verified                            |
| Preview environment                           | **does not exist**                        | ❌ externally blocked                          |
| Rollback exercised outside production         | **no**                                    | ❌ externally blocked                          |
| Unpinned CI actions on mutable refs           | **3** (guarded, not pinned)               | ⚠️ gap CI-1                                    |

## 7. Reading the scorecard

**Backend correctness is well-evidenced. Product behaviour is not evidenced at all.** 1,062 backend
tests and 5 mutation-proven invariants sit alongside 2 browser E2E specs covering 189 pages.

That asymmetry _is_ the beta plan: the work is not to build more backend, it is to prove that a human
can complete five journeys and that the platform tells the truth when it does not know.

**Three red rows gate the beta:** no fabrication instrument (ADR-004), ANOM-1 unclassified, capacity
unknown. The first is decision-blocked; the other two are days of work with no owner.
