# ADR Evidence Register

**Date:** 2026-07-30. What evidence exists, what is missing, and what class of effort each gap requires.

Classes: **Verified** · **Requires inspection** (repo read) · **Requires experiment** ·
**Requires production observation** · **Requires policy decision** · **Requires security approval** ·
**Requires platform approval**

---

## 1. Blocking open questions — owner assignment table (Session 1, Block A)

**Fill this in the room. 11 rows, 11 names, 11 dates.**

| OQ            | Question                              | Class                      | Effort | Blocks          | Owner    | Method                                                       | Date     | Escalation                                 |
| ------------- | ------------------------------------- | -------------------------- | ------ | --------------- | -------- | ------------------------------------------------------------ | -------- | ------------------------------------------ |
| OQ-1          | `TransactionSummary` granularity      | Inspection                 | 0.5d   | ADR-001         | **\_\_** | read `normalizer.rs` + count distinct `(account_id, period)` | \_\_\_\_ | Graph Platform lead                        |
| OQ-2          | Plaid sync batch homogeneity          | Inspection + observation   | 1d     | **ADR-002**     | **\_\_** | queue semantics + one live ingest trace                      | \_\_\_\_ | Graph Platform lead                        |
| OQ-4          | Persona coverage ≥100 queries         | Inspection                 | 1d     | ADR-004         | **\_\_** | per-domain entity census × 5 personas                        | \_\_\_\_ | AI/Retrieval lead                          |
| OQ-5          | Review-state propagation to Qdrant    | Inspection                 | 0.5d   | ADR-005         | **\_\_** | inspect worker payload construction                          | \_\_\_\_ | DocIntel lead                              |
| OQ-6          | `entity_id` derivation                | Inspection                 | 0.5d   | ADR-006         | **\_\_** | read `normalizer.rs` id construction                         | \_\_\_\_ | Data Platform lead                         |
| OQ-7          | `central` Neo4j contents/writers      | **Production observation** | 1d     | **ADR-009**     | **\_\_** | read-only inventory                                          | \_\_\_\_ | Platform Ops lead                          |
| OQ-9          | 17-tenant Neo4j/Qdrant divergence     | **Production observation** | 1–2d   | integrity gates | **\_\_** | enumerate + diff + classify into 9 buckets                   | \_\_\_\_ | **Engineering Lead if bucket 2/3/5/7/9**   |
| OQ-11         | 1-hop `user→HAS_TRANSACTION` readers  | Inspection                 | 1d     | ADR-001         | **\_\_** | grep + traversal trace + query review                        | \_\_\_\_ | Graph Platform lead                        |
| OQ-12         | Was any exposed credential **used**?  | **Production observation** | 1–2d   | ADR-007 closure | **\_\_** | auth-log review, all three providers                         | \_\_\_\_ | **Engineering Lead → incident if any use** |
| IQ-1 (CONF-A) | ADR-005 backfill precedes its source  | **Policy decision**        | ruling | ADR-005         | **\_\_** | reviewer ruling, options (a)/(b)                             | \_\_\_\_ | Engineering Lead                           |
| IQ-3          | Do I-3/I-10 have existing violations? | Inspection                 | 0.5d   | RES-1/2         | **\_\_** | run widened scans                                            | \_\_\_\_ | Graph Platform lead                        |

**All 11 are parallel. Seven are read-only repository inspections of ≤1 day.** Total elapsed time if
parallelised: ~2 days. This is the cheapest unblock available to the programme.

---

## 1b. Credential-free investigations completed 2026-07-30

Findings: `OQ_INVESTIGATION_FINDINGS.md`. **No ADR status changed.**

| OQ        | State                         | Outcome                                                                                                                                                                                 |
| --------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **OQ-5**  | ✅ **FULLY ANSWERED**         | Qdrant payload has 12 fields; trust/review state **ABSENT**, not dormant. Confirms ADR-005 premise                                                                                      |
| **OQ-11** | ✅ **substantially answered** | **0 named consumers** in serving code; one indirect family-based consumer. Does **not** reject ADR-001 — its trigger did not fire. Reduces WP-400 re-pointing to a verification step    |
| **OQ-6**  | 🟡 partial                    | Children + point ids deterministic & tenant-scoped; **root `entity_id` is inherited from source and NOT tenant-qualified**; `idx`-based child ids unstable across normalizer reordering |
| **OQ-1**  | 🟡 partial                    | **No aggregation period defined anywhere**; source is `finance.transactions` (per-transaction rows). Live count still required                                                          |
| **IQ-3**  | ✅ **FULLY ANSWERED**         | api-gateway: 0 write-Cypher → RES-2 **Medium→Low**. 5 relationship literals in **legacy `retriever.py`** = accepted exception with drift risk                                           |

## 2. Evidence already verified — no further work

| Claim                                              | Evidence                                          | Verified      |
| -------------------------------------------------- | ------------------------------------------------- | ------------- |
| 150 `permitted_contexts` in catalog, 0 in manifest | `grep -c` both files                              | ✅ 2026-07-30 |
| `personal_advisor: 119`; 4 contexts null           | `relationship_coverage.json`                      | ✅            |
| `live_but_undeclared: 0`                           | same artifact                                     | ✅            |
| `HAS_TRANSACTION` = 1,951 of 3,208 (60.8%)         | live Cypher + `live_graph_snapshot.json`          | ✅            |
| ~2 transaction edges per node                      | `ontology.rs:93-96`                               | ✅            |
| 0 of 3,208 relationships carry any property        | live Cypher                                       | ✅            |
| `ln_central` = 0 points                            | Qdrant REST                                       | ✅            |
| Qdrant: 2,218 pts, 3072-dim, 100% `personal` scope | Qdrant REST                                       | ✅            |
| `domain=finance` → 0; `domain=financial` → 1,583   | Qdrant count API                                  | ✅            |
| RRF exists at `fusion.py:81`                       | `grep`                                            | ✅            |
| Python Neo4j client has no write method            | source + **CI gate since Sprint 1**               | ✅            |
| Traversal binds both endpoints                     | `traversal.py:108-110` + **mutation-proven test** | ✅            |
| Fly token is org-scoped and can read 31 secrets    | `flyctl secrets list`                             | ✅            |
| 127 nodes in the `Objective` grouping              | live label counts                                 | ✅            |
| 977 core-api / 85 worker tests green               | test run                                          | ✅            |

**Reviewers may challenge any row live** — every claim has a reproducible command.

---

## 3. Evidence required before each ADR can reach `Accepted`

| ADR     | Evidence                             | Class                      | Status                                             |
| ------- | ------------------------------------ | -------------------------- | -------------------------------------------------- |
| **003** | 150-vs-0 discrepancy                 | Verified                   | ✅                                                 |
| **003** | 119-parity achievable post-migration | Requires experiment        | ⏳ **after implementation, not before acceptance** |
| **003** | Provider permissions out of scope    | Policy decision            | ⏳ confirm in session                              |
| **007** | Exposure scope                       | Verified                   | ✅                                                 |
| **007** | Least-privilege satisfies consumers  | Requires inspection        | ⏳ consumer inventory                              |
| **007** | OQ-12 owned                          | Security approval          | ⏳ **Session 1**                                   |
| **011** | 127-node motivating set              | Verified                   | ✅                                                 |
| **011** | Cross-domain improvement             | Requires experiment        | ⏳ **needs ADR-004 — hence flag-off**              |
| **001** | OQ-11 read dependencies              | Inspection                 | ❌ **blocking**                                    |
| **001** | OQ-1 granularity                     | Inspection                 | ❌ blocking                                        |
| **002** | OQ-2 batch homogeneity               | Inspection + observation   | ❌ **blocking — decisive**                         |
| **004** | OQ-4 persona census                  | Inspection                 | ❌ blocking                                        |
| **005** | CONF-A ruling                        | **Policy decision**        | ❌ **blocking**                                    |
| **005** | OQ-5 payload propagation             | Inspection                 | ❌ blocking                                        |
| **006** | OQ-6 `entity_id` derivation          | Inspection                 | ❌ blocking                                        |
| **008** | ADR-003 shipped                      | Sequence                   | ⏳                                                 |
| **009** | OQ-7 `central` inventory             | **Production observation** | ❌ **blocking**                                    |
| **009** | 7-day zero traffic                   | Production observation     | ❌ not started                                     |
| **010** | ADR-002 decided                      | Sequence                   | ⏳                                                 |

---

## 4. Evidence that cannot be obtained before acceptance

An important category reviewers routinely mishandle: some evidence is only producible **by doing the
work**, so demanding it pre-acceptance creates deadlock.

| Evidence                        | ADR | Why it must come after                                                                                        |
| ------------------------------- | --- | ------------------------------------------------------------------------------------------------------------- |
| 119-parity holds post-migration | 003 | Requires the migration to exist. It is an **acceptance criterion of the implementation**, not of the decision |
| Cross-domain queries improve    | 011 | Requires the golden set + expansion built. Hence accept **flag-off**                                          |
| Traversal finds non-seed paths  | 008 | The verification _is_ the evidence                                                                            |
| Dangerous drift = 0             | 005 | Requires the reconciliation job                                                                               |
| Calibration data                | 010 | Requires confidence fields populated                                                                          |

**Rule for the room:** distinguish _evidence that should exist now_ (OQ-2, OQ-7, OQ-11) from _evidence
the work produces_ (parity, improvement, calibration). Blocking on the second class is how programmes
stall permanently.

---

## 5. Approvals required, by type

| Type                  | Item                                                                         | Approver           |
| --------------------- | ---------------------------------------------------------------------------- | ------------------ |
| **Security approval** | ADR-003 authorization model; ADR-007 secret model; CONF-A                    | Security lead      |
| **Platform approval** | ADR-009 retirement; branch-protection required check (B-17)                  | Platform Ops       |
| **Policy decision**   | CONF-A; provider-context retrieval (out of scope); git-history rewrite       | Engineering Lead   |
| **Privacy approval**  | ADR-006 third-party classes (`Dependent`, `SpouseProfile`); deletion cascade | Privacy/Governance |
| **Repo admin**        | Add `Architectural Invariants` to required checks                            | repo admin         |

The last row is small but consequential: until it is done, the Sprint 1 CI gate **reports without
blocking**. An advisory gate is not enforcement.
