# Implementation Rollout Plan

**Date:** 2026-07-30 · Phase 5. **Not every ADR reaches production.** Termination after evaluation is a
legitimate, planned outcome — three ADRs may end there.

---

## 1. Stage definitions

| Stage                                  | Blast radius                     | Production writes | Reversible     |
| -------------------------------------- | -------------------------------- | ----------------- | -------------- |
| **S1 Development**                     | none                             | none              | trivially      |
| **S2 Internal integration**            | none                             | none              | trivially      |
| **S3 Read-only production validation** | reads only                       | none              | stop running   |
| **S4 Shadow**                          | reads; results discarded         | none              | disable flag   |
| **S5 Limited tenant**                  | 1–5 synthetic/consenting tenants | per package       | disable flag   |
| **S6 Pilot**                           | pilot cohort                     | per package       | disable flag   |
| **S7 Broader rollout**                 | all tenants, flagged             | per package       | disable flag   |
| **S8 GA**                              | all tenants, default on          | per package       | revert release |

**Blast radius increases monotonically.** No package skips a stage; a package may **terminate** at any
stage.

---

## 2. Per-stage criteria

| Stage | Entry                                        | Exit                                                                              | Rollback trigger                            | Rollback owner |
| ----- | -------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------- | -------------- |
| S3    | ADR `Accepted`; read-only proven; bounds set | trace artifact produced; 0 cross-tenant                                           | any cross-tenant node; unclassified error   | package owner  |
| S4    | S3 passed                                    | results provably discarded (byte-identical context packet); latency within budget | any response influence detected; p95 breach | AI/Retrieval   |
| S5    | S4 passed; tenant approval recorded          | no regression on the cohort; 0 fabrication                                        | any G-2x/G-4x gate red                      | package owner  |
| S6    | S5 passed; runbook + dashboards live         | pilot metrics ≥ baseline                                                          | fabrication > 0; isolation breach           | on-call        |
| S7    | S6 passed; capacity measured                 | steady state ≥ 2 weeks                                                            | error budget exhausted                      | on-call        |
| S8    | S7 passed; SLOs met                          | —                                                                                 | SLO breach                                  | on-call        |

---

## 3. Per-package rollout paths

| WP                  | Path                       | Terminal stage         | Notes                                                        |
| ------------------- | -------------------------- | ---------------------- | ------------------------------------------------------------ |
| WP-010 invariants   | S1→S2                      | **S2**                 | CI only; never reaches production                            |
| WP-000 credentials  | S1→**production directly** | production             | containment; no staged rollout possible                      |
| WP-100 golden set   | S1→S2                      | **S2**                 | evaluation artifact; not a production path                   |
| WP-110 manifest v3  | S1→S2→S7→S8                | S8                     | no tenant-visible behaviour change expected (G-11 proves it) |
| WP-120 identity     | S1→S2→S3                   | **S3**                 | detection report-only; merging is a later decision           |
| WP-200 traversal    | S1→S2→S3→S4                | **S4 — may terminate** | shadow is the terminal state unless a rollout ADR exists     |
| WP-300 vector trust | S1→S2→S5→S6→S7→S8          | S8                     | payload backfill first, filters flag-gated                   |
| WP-400 emission     | S1→S2→S7                   | S7                     | deprecation is global but write-only                         |
| WP-500 provenance   | S1→S2→S5→S7                | S7                     | forward writes only                                          |
| WP-510 confidence   | S1→S2→S5→S6→S7             | S7                     | ranking/citation flags staged separately                     |
| WP-600 migrations   | S1→S2→S5→S7                | S7                     | bounded batches; **not** a flag rollout                      |
| WP-700 retirement   | S1→S3→S7                   | S7                     | `410` shim is the compatibility stage                        |

---

## 4. Packages that may terminate without reaching production

| WP                                | Termination condition                               | Meaning                                                                                       |
| --------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **WP-200** traversal              | 0 non-seed paths, or no measured retrieval benefit  | Traversal stays shadow-only or disabled. **Not a failure** — evidence-based channel selection |
| **WP-700** retirement             | live content or an active writer in `central` Neo4j | Gateway retained; harvest option re-opens                                                     |
| **WP-011** superclass (in WP-110) | no cross-domain improvement                         | Expansion flag never enabled; the field remains as metadata                                   |

**Planning for termination is deliberate.** A rollout plan that assumes every package ships creates
pressure to ship packages that measured badly.

---

## 5. GraphRAG grounding — explicitly out of scope

`GRAPH_GROUNDING_ENABLED` is **not** rolled out by any package here. Enablement requires a separate ADR
that does not exist, and per ADR-008 the standard is _"traversal improved a defined query category
without unacceptable precision, latency, security, or fabrication regressions"_ — with six legitimate
outcomes, only two of which involve enabling anything.

**Reaching S4 shadow does not authorize S5.** That transition is the rollout ADR's decision.

---

## 6. Maximum blast radius per stage

| Stage | Tenants affected | Data at risk | Worst case                              |
| ----- | ---------------- | ------------ | --------------------------------------- |
| S3    | 0 (reads)        | none         | wasted query capacity                   |
| S4    | 0 (discarded)    | none         | latency regression                      |
| S5    | ≤ 5              | that cohort  | degraded answers for consenting tenants |
| S6    | pilot cohort     | pilot data   | degraded pilot experience               |
| S7    | all, flag-gated  | all          | flag disabled; prior behaviour restored |
| S8    | all, default     | all          | release revert                          |

**WP-600 is the exception and must be read carefully:** batch migrations have no flag. Their blast
radius is bounded by **batch size**, not by cohort, and their rollback is a compensating migration
rather than a toggle. That is why G-06 (rehearsed rollback) is mandatory before WP-600 starts.
