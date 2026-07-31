# Implementation Test Matrix

**Date:** 2026-07-30 · Phase 7. **Every test maps to an ADR acceptance criterion.** A test mapping to
none is unsanctioned work; an acceptance criterion with no test is an unverifiable claim.

Baseline: 963 core-api + 85 worker tests green at `120f301a`.

---

## 1. Matrix

| #                                                                   | Test                                                              | Type            | ADR criterion     | Gate | Exists    |
| ------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------- | ----------------- | ---- | --------- |
| **Tenant isolation**                                                |
| T-01                                                                | Two-tenant fixture: no returned path contains a foreign node      | property        | 003, 008          | G-20 | ✗         |
| T-02                                                                | Cross-tenant edge count = 0                                       | integrity       | 002, 006          | G-21 | partial   |
| T-03                                                                | Caller-supplied tenant is ignored                                 | negative        | verified strength | G-05 | ✗         |
| T-04                                                                | Cypher lacking `$user_id` is refused                              | negative        | verified strength | G-05 | ✓ (guard) |
| T-05                                                                | Every emitted node pattern carries `{tenant_id: $user_id}`        | static          | verified strength | G-05 | ✗         |
| **Authorization**                                                   |
| T-10                                                                | Personal advisor resolves to **exactly 119** types                | regression      | 003               | G-11 | ✗         |
| T-11                                                                | Full principal × context × relationship matrix asserted           | property        | 003               | G-10 | ✗         |
| T-12                                                                | Unknown principal / context / manifest version → deny             | negative        | 003               | G-12 | ✗         |
| T-13                                                                | 0 wildcard grants                                                 | static          | 003               | G-13 | ✗         |
| T-14                                                                | Permission independent of `family`                                | property        | 003               | G-05 | ✗         |
| T-15                                                                | Provider/B2B ∩ personal-traversable = ∅ (19 types)                | property        | 003               | G-05 | ✗         |
| T-16                                                                | Superclass expansion ⊆ ∪ individually-permitted                   | property        | 011               | G-14 | ✗         |
| **Graph traversal**                                                 |
| T-20                                                                | ≥1 non-seed path on ≥3 tenants                                    | live            | 008               | G-46 | ✗         |
| T-21                                                                | Depth/breadth/budget bounds enforced                              | boundary        | 008               | —    | partial   |
| T-22                                                                | Shadow: context packet byte-identical on/off                      | property        | 008               | —    | ✗         |
| T-23                                                                | Aura row-shape handled (dict contract)                            | contract        | prior defect      | G-02 | ✓         |
| T-24                                                                | Traversal error → classified `integrity_failure`, never swallowed | negative        | 008               | G-53 | ✗         |
| **Vector retrieval**                                                |
| T-30                                                                | Filter during search excludes untrusted before top-k              | positive        | 005               | G-42 | ✗         |
| T-31                                                                | Unknown `source_trust` → not citable (fail closed)                | negative        | 005               | —    | ✗         |
| T-32                                                                | Poisoned document never reaches citation or mutation path         | security        | 005               | G-42 | ✗         |
| T-33                                                                | Dangerous drift (PG block / Qdrant allow) = 0                     | integrity       | 005               | G-28 | ✗         |
| T-34                                                                | Injected drift triggers quarantine                                | security        | 005               | G-30 | ✗         |
| T-35                                                                | Embedding dimension uniform 3072                                  | integrity       | —                 | G-26 | ✓ (live)  |
| T-36                                                                | Payload completeness: 0 missing tenant/user/domain                | integrity       | —                 | G-27 | ✓ (live)  |
| **Identity**                                                        |
| T-40                                                                | 47/47 classes declare a business key or `None`                    | static          | 006               | —    | ✗         |
| T-41                                                                | `BusinessKey::None` class cannot auto-merge                       | negative        | 006               | —    | ✗         |
| T-42                                                                | Same key + different `entity_id` → duplicate detected             | positive        | 006               | —    | ✗         |
| T-43                                                                | Different key + same `entity_id` → integrity error, halt          | negative        | 006               | —    | ✗         |
| T-44                                                                | Resolution confidence never enters a truth projection             | property        | 006, 010          | —    | ✗         |
| **Provenance**                                                      |
| T-50                                                                | A bare edge write does not compile                                | compile         | 002               | G-05 | ✗         |
| T-51                                                                | 0 dangling provenance references                                  | integrity       | 002               | G-24 | ✗         |
| T-52                                                                | 0 orphan assertions                                               | integrity       | 002               | G-25 | ✗         |
| T-53                                                                | Source deletion cascades to derived assertions                    | positive        | 002               | G-56 | ✗         |
| T-54                                                                | Legacy edges classified `unknown_legacy`, never fabricated        | static          | 002               | —    | ✗         |
| T-55                                                                | Batch provenance shared across a bulk-sync batch                  | positive        | 002               | —    | ✗         |
| **Deletion**                                                        |
| T-60                                                                | 0 residue across Neo4j + Qdrant + Postgres + object store         | integrity       | 002, 007          | G-56 | ✗         |
| T-61                                                                | Deletion artifact reports per-store counts                        | positive        | 007               | —    | ✗         |
| **Confidence**                                                      |
| T-70                                                                | Monotonicity: recommendation ≤ answer ≤ evidence                  | property        | 010               | —    | ✗         |
| T-71                                                                | 0 self-reinforcing corroboration pairs                            | property        | 010               | —    | ✗         |
| T-72                                                                | Null ≠ zero; null handled explicitly at every consumer            | boundary        | 010               | —    | ✗         |
| T-73                                                                | Component correlation < 0.9                                       | statistical     | 010               | —    | ✗         |
| T-74                                                                | Path confidence ≤ min hop confidence                              | property        | 010               | —    | ✗         |
| **Temporal** — _deferred; no accepted temporal ADR in this package_ |
| T-80                                                                | Future facts never stated as present                              | negative        | (future ADR)      | G-44 | ✗         |
| T-81                                                                | Expired facts never cited as current                              | negative        | (future ADR)      | G-44 | ✗         |
| **Evaluation**                                                      |
| T-90                                                                | Runner fails if it bypasses auth/tenant/flags                     | negative        | 004               | G-41 | ✗         |
| T-91                                                                | Known-absent → abstention, 0 fabricated substitutes               | negative        | 004               | G-42 | ✗         |
| T-92                                                                | Metric correctness vs hand-computed fixtures                      | unit            | 004               | —    | ✗         |
| T-93                                                                | Unsupported answers score **negative**, not zero                  | unit            | 004               | —    | ✗         |
| T-94                                                                | Trace replay yields identical evidence set                        | reproducibility | —                 | G-47 | ✗         |
| **Migration**                                                       |
| T-100                                                               | Second dry run reports 0 affected (idempotency)                   | property        | 001, 002          | G-22 | ✗         |
| T-101                                                               | Rollback restores prior counts exactly                            | rehearsal       | all               | G-06 | ✗         |
| T-102                                                               | Stop-on-anomaly fires on injected count deviation                 | negative        | 001, 002          | —    | ✗         |
| T-103                                                               | `HAS_PERSONA` = 148, `RELATED_TO` = 0, total edges unchanged      | integrity       | SP-030            | G-23 | ✗         |
| **Performance / DR**                                                |
| T-110                                                               | Expected indexes used in every traversal plan                     | plan            | —                 | G-50 | ✗         |
| T-111                                                               | Capacity documented at defined concurrency                        | load            | —                 | G-52 | ✗         |
| T-112                                                               | p95 within budget at depth 2 (post ADR-001)                       | perf            | 001               | G-51 | ✗         |
| T-113                                                               | Backup/restore rehearsed before any destructive migration         | DR              | 002               | G-06 | ✗         |
| **Security scanning**                                               |
| T-120                                                               | Canary secret detected by CI scanners                             | security        | 007               | G-04 | partial   |
| T-121                                                               | No credential in logs, shell history, or artifacts                | security        | 007               | G-04 | ✓         |

---

## 2. Coverage summary

| Domain           | Tests  | Exist  | Gap          |
| ---------------- | ------ | ------ | ------------ |
| Tenant isolation | 5      | 1      | **4**        |
| Authorization    | 7      | 0      | **7**        |
| Traversal        | 5      | 1.5    | 3.5          |
| Vector           | 7      | 2      | 5            |
| Identity         | 5      | 0      | 5            |
| Provenance       | 6      | 0      | 6            |
| Deletion         | 2      | 0      | 2            |
| Confidence       | 5      | 0      | 5            |
| Temporal         | 2      | 0      | 2 (deferred) |
| Evaluation       | 5      | 0      | 5            |
| Migration        | 4      | 0      | 4            |
| Perf / DR        | 4      | 0      | 4            |
| Security scan    | 2      | 1.5    | 0.5          |
| **Total**        | **59** | **~6** | **~53**      |

The 963 existing core-api tests cover application behaviour well; they cover **almost none of the
architectural invariants** in this matrix. That is the honest gap, and it is expected — these tests
verify decisions that have not been accepted yet.

---

## 3. Tests buildable today, with no ADR verdict

T-01, T-03, T-05 (tenant isolation), T-14, T-15 (permission independence), T-24 (error classification),
T-121 (already passing). These belong to **WP-010** and protect properties that are already true.

**T-01 is the single most valuable missing test in the repository.** Traversal binds both endpoints
today — but nothing proves it stays that way, and a regression there is a cross-tenant data leak.
