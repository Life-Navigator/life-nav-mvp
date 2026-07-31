# Implementation Verification Gates

**Date:** 2026-07-30 · Phase 4. **No subjective gates.** Every gate states owner, measurement,
threshold, pass, fail, and required artifact.

---

## 1. Universal gates — every work package

| Gate                      | Owner          | Measurement                                  | Threshold                                                      | Pass     | Fail                   | Artifact         |
| ------------------------- | -------------- | -------------------------------------------- | -------------------------------------------------------------- | -------- | ---------------------- | ---------------- |
| **G-01** Compilation      | package owner  | `cargo build`, `python -c import`            | 0 errors                                                       | builds   | any error              | CI log           |
| **G-02** Unit tests       | package owner  | `cargo test --lib`; `pytest`                 | **≥ 85 worker, ≥ 963 core-api** (current baseline), 0 failures | all pass | any failure            | test report      |
| **G-03** Drift gates      | Graph Platform | 4 existing catalog/manifest/vocabulary gates | 0 divergence, semantic compare                                 | green    | any drift              | CI log           |
| **G-04** Secret scan      | Security       | gitleaks binary + canary                     | 0 leaks; **canary detected**                                   | both     | leak, or canary missed | scan log         |
| **G-05** Invariant checks | Graph Platform | DA-1…DA-4 (WP-010)                           | 0 violations                                                   | green    | any violation          | CI log           |
| **G-06** Reversibility    | package owner  | rollback executed in a non-prod env          | restores prior state exactly                                   | verified | untested rollback      | rehearsal record |

**G-02 thresholds are the measured baseline** (963 core-api, 85 worker, commit `120f301a`) and ratchet
upward only. **G-04's canary requirement exists because TruffleHog `--only-verified` was blind by design
to the credential class that leaked** — a scanner that has never caught a planted secret is unproven.

**G-06 is the gate most often skipped.** An untested rollback is a plan, not a capability.

---

## 2. Contract gates

| Gate                                 | Owner          | Measurement                                        | Threshold                       | Artifact      |
| ------------------------------------ | -------------- | -------------------------------------------------- | ------------------------------- | ------------- |
| **G-10** Manifest policy fidelity    | Security       | exported fields == catalog-declared fields         | exact equality                  | CI diff       |
| **G-11** Personal-advisor parity     | Security       | relationship types resolved for `personal_advisor` | **exactly 119**                 | parity report |
| **G-12** Version rejection           | Graph Platform | loader given manifest v2 after cutover             | rejects; does not ignore fields | test log      |
| **G-13** Wildcard grants             | Security       | scan principal registry                            | **0**                           | registry dump |
| **G-14** Superclass expansion safety | Security       | expanded ⊆ ∪ individually-permitted, per principal | subset holds ∀ principals       | property test |

**G-11 is the migration's falsification criterion.** Any number other than 119 means the export is not
faithful and the migration halts.

---

## 3. Data-plane gates

| Gate                           | Owner          | Measurement                                    | Threshold                  | Artifact              |
| ------------------------------ | -------------- | ---------------------------------------------- | -------------------------- | --------------------- |
| **G-20** Tenant isolation      | Security       | two-tenant fixture; all returned paths         | **0 foreign-tenant nodes** | property test         |
| **G-21** Cross-tenant edges    | Data Platform  | live count                                     | **0**                      | reconciliation        |
| **G-22** Migration idempotency | Graph Platform | second dry run                                 | **0 affected**             | preflight artifact    |
| **G-23** Count reconciliation  | Graph Platform | post-run vs expected                           | within stated tolerance    | reconciliation report |
| **G-24** Dangling references   | Data Platform  | edges whose provenance ref resolves to nothing | **0**                      | integrity query       |
| **G-25** Orphan provenance     | Data Platform  | assertions with no materialized edge           | **0**                      | integrity query       |
| **G-26** Embedding dimension   | Platform Ops   | Qdrant vector size                             | **3072, uniform**          | collection info       |
| **G-27** Payload completeness  | Data Platform  | points missing `tenant_id`/`user_id`/`domain`  | **0**                      | facet query           |
| **G-28** Dangerous drift       | Security       | Postgres-block → Qdrant-allow                  | **0**                      | drift report          |
| **G-29** Conservative drift    | Platform Ops   | Postgres-allow → Qdrant-block                  | within budget              | drift report          |
| **G-30** Quarantine fires      | Security       | injected-drift test                            | quarantine triggers        | rehearsal record      |

**G-28 and G-29 are deliberately separate gates** with different severities and different owners.
Merging them would let a security incident be triaged as a freshness blip.
**G-30 exists because an unexercised quarantine is not a control.**

---

## 4. Evaluation gates

| Gate                           | Owner        | Measurement                            | Threshold                    | Artifact       |
| ------------------------------ | ------------ | -------------------------------------- | ---------------------------- | -------------- |
| **G-40** Golden set exists     | AI/Retrieval | query count by category                | ≥100, all 6 categories       | `golden.json`  |
| **G-41** Production-path proof | AI/Retrieval | runner exercises auth+tenant+flags     | test fails if bypassed       | test log       |
| **G-42** Fabrication           | AI/Retrieval | known-absent category                  | **0 fabricated substitutes** | eval report    |
| **G-43** Cross-tenant leakage  | Security     | cross-tenant probe category            | **0**                        | eval report    |
| **G-44** Temporal leakage      | AI/Retrieval | future/expired facts stated as present | **0**                        | eval report    |
| **G-45** No-regression         | AI/Retrieval | known-present vs baseline              | ≥ baseline                   | delta report   |
| **G-46** Non-seed paths        | AI/Retrieval | traversal expansion                    | ≥1 on ≥3 tenants             | trace artifact |
| **G-47** Reproducibility       | AI/Retrieval | trace replay                           | identical evidence set       | replay log     |

**G-46 may legitimately fail**, and failure terminates ADR-008 rather than blocking the programme.
It is the only gate in this document whose failure is an acceptable published outcome.

---

## 5. Operational gates

| Gate                           | Owner        | Measurement                           | Threshold                         | Artifact          |
| ------------------------------ | ------------ | ------------------------------------- | --------------------------------- | ----------------- |
| **G-50** Index usage           | Platform Ops | query plan for each traversal pattern | expected indexes used             | plan output       |
| **G-51** Latency               | Platform Ops | p50/p95 per stage                     | within stated budget              | perf report       |
| **G-52** Capacity              | Platform Ops | load test                             | documented at defined concurrency | load report       |
| **G-53** Error classification  | Platform Ops | unclassified exceptions in new paths  | **0**                             | log audit         |
| **G-54** Credential closure    | Security     | old credential auth attempt           | **rejected**                      | rejection proof   |
| **G-55** Consumer verification | Platform Ops | each consumer post-rotation           | all functional                    | health checks     |
| **G-56** Deletion completeness | Privacy      | residue across all 4 stores           | **0**                             | deletion artifact |

**G-52 currently has no baseline** — capacity is unknown, never load-tested. The gate cannot pass until
a first measurement establishes what it compares against.

---

## 6. Gate application by work package

| WP                  | Universal      | Additional                                       |
| ------------------- | -------------- | ------------------------------------------------ |
| WP-010 invariants   | G-01…G-05      | each check demonstrated failing on a bad fixture |
| WP-000 credentials  | G-04           | G-54, G-55                                       |
| WP-100 golden set   | G-01, G-02     | G-40, G-41                                       |
| WP-110 manifest v3  | all            | G-10…G-14, G-20                                  |
| WP-120 identity     | G-01…G-03      | duplicate/collision counts                       |
| WP-200 traversal    | G-01, G-02     | G-20, G-46, G-51, G-53                           |
| WP-300 vector trust | all            | G-26…G-30, G-42, G-45                            |
| WP-400 emission     | all            | G-45, G-50                                       |
| WP-500 provenance   | all            | G-24, G-25, G-56                                 |
| WP-510 confidence   | G-01…G-03      | monotonicity, self-reinforcement = 0             |
| WP-600 migrations   | all + **G-06** | G-21…G-23, G-27                                  |
| WP-700 retirement   | G-04           | 7-day traffic = 0, `410` hits = 0                |

---

## 7. Standing rules

1. **A gate never demonstrated failing is decoration.** Every gate ships with a deliberately bad fixture
   proving it catches the thing it claims to catch.
2. **No subjective gates.** "Code reviewed" is not a gate; "two named approvers recorded" is.
3. **Thresholds ratchet, never loosen.** Lowering a threshold requires the same approval as an ADR
   amendment.
4. **G-06 is mandatory before any production mutation.** WP-600 does not start without a rehearsed
   rollback.
