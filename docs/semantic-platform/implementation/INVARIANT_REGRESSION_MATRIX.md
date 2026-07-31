# Invariant Regression Matrix — Sprint 1

**Date:** 2026-07-30. Every known regression path for each enforced invariant, and whether it is now
caught. Honest about what remains uncovered.

Legend: 🟢 caught automatically · 🟡 caught only by reviewer checklist · 🔴 uncovered

---

## I-1 · The Rust worker is the only graph writer

| #   | Regression path                                      | Caught | Mechanism                                                                             |
| --- | ---------------------------------------------------- | ------ | ------------------------------------------------------------------------------------- |
| 1.1 | Write Cypher literal in a router/service             | 🟢     | `test_i1_no_write_cypher_anywhere_in_core_api` (AST scan, **mutation-proven M-2**)    |
| 1.2 | Write Cypher assembled from f-string fragments       | 🟡     | AST sees only constant parts; a fully dynamic `f"{verb} (n)"` evades it               |
| 1.3 | Write via a new client class bypassing `Neo4jClient` | 🟡     | I-1 catches the Cypher **if** it appears as a literal; a driver-object call would not |
| 1.4 | Write from `apps/api-gateway` (second Python tier)   | 🔴     | **Scan covers core-api only** — see RES-2                                             |
| 1.5 | Write from a Supabase Edge Function                  | 🔴     | Out of scanned surface — see RES-2                                                    |

## I-2 · Python Neo4j client is read-only

| #   | Regression path                                                                                | Caught | Mechanism                                                                |
| --- | ---------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------ |
| 2.1 | `execute` / `run` / `write` / `merge` / `create` / `delete` / `upsert` / `commit` / `tx` added | 🟢     | `test_i2_neo4j_client_exposes_no_write_method` (**mutation-proven M-3**) |
| 2.2 | Write method with an unlisted name (e.g. `apply_changes`)                                      | 🟡     | Name-based check; I-1 catches its Cypher if literal                      |
| 2.3 | Read method that happens to run write Cypher                                                   | 🟢     | Caught by I-1                                                            |

## I-3 · Tenant bound on every node pattern

| #   | Regression path                                                         | Caught | Mechanism                                                                                     |
| --- | ----------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------- |
| 3.1 | Far-end binding removed from an expansion                               | 🟢🟢   | **Two independent tests** — static check **and** two-tenant fixture (**mutation-proven M-1**) |
| 3.2 | Seed builder loses its binding                                          | 🟢     | Static check over all builders                                                                |
| 3.3 | New builder added, tenant-unbound, **and registered** in `ALL_BUILDERS` | 🟢     | Static check                                                                                  |
| 3.4 | New builder added, tenant-unbound, **and NOT registered**               | 🟡     | Runtime guard still refuses it (`$user_id` missing) — but only when executed. **RES-1**       |
| 3.5 | Cypher built inline at a call site, bypassing the builders              | 🟡     | Runtime guard catches missing `$user_id`; a _partially_ bound statement would pass            |
| 3.6 | Corrupt cross-tenant edge already in the graph                          | 🟢     | Fixture includes one deliberately; query-level binding makes it unreachable                   |
| 3.7 | Client guard weakened or duplicated into a caller                       | 🟡     | Reviewer checklist; no test asserts the guard's own presence                                  |

## I-4 · Caller cannot override the bound tenant

| #   | Regression path                               | Caught | Mechanism                                                             |
| --- | --------------------------------------------- | ------ | --------------------------------------------------------------------- |
| 4.1 | Statement without `$user_id` executed         | 🟢     | `test_i4_client_refuses_untenanted_statement`                         |
| 4.2 | Caller passes `user_id` in parameters         | 🟢     | `test_i4_client_refuses_caller_supplied_tenant`                       |
| 4.3 | Empty tenant treated as wildcard              | 🟢     | `test_i4_empty_tenant_is_refused`                                     |
| 4.4 | Parameter merge order reversed so caller wins | 🟡     | Behaviourally covered by 4.2; no test asserts the _ordering_ directly |

## I-10 · No raw-string relationship emission

| #    | Regression path                              | Caught | Mechanism                                                                              |
| ---- | -------------------------------------------- | ------ | -------------------------------------------------------------------------------------- |
| 10.1 | Relationship literal in a retrieval module   | 🟢     | `test_i10_no_raw_relationship_literals_in_retrieval_modules` (**mutation-proven M-4**) |
| 10.2 | Hand-maintained edge-type list               | 🟢     | Any manifest member appearing as a literal is flagged                                  |
| 10.3 | Literal in a module outside the four scanned | 🟡     | Scan covers `traversal/planner/engine/fusion` — see RES-3                              |
| 10.4 | `RELATED_TO` made traversable                | 🟢     | `test_i10_related_to_is_never_traversable`                                             |
| 10.5 | Edge types stop deriving from the manifest   | 🟢     | `test_i10_edge_types_are_derived_from_the_manifest_not_hardcoded`                      |
| 10.6 | Relationship name assembled dynamically      | 🔴     | Not detectable by literal analysis                                                     |

---

## Coverage summary

| Invariant | Paths  | 🟢           | 🟡          | 🔴          |
| --------- | ------ | ------------ | ----------- | ----------- |
| I-1       | 5      | 1            | 2           | **2**       |
| I-2       | 3      | 2            | 1           | 0           |
| I-3       | 7      | 4            | 3           | 0           |
| I-4       | 4      | 3            | 1           | 0           |
| I-10      | 6      | 4            | 1           | **1**       |
| **Total** | **25** | **14 (56%)** | **8 (32%)** | **3 (12%)** |

---

## Residuals — carried forward, not resolved in this sprint

| ID        | Residual                                                                                                                                       | Severity   | Proposed disposition                                                                                                                    |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **RES-1** | A new Cypher builder must be manually registered in `ALL_BUILDERS` or the static check skips it (3.4)                                          | **Medium** | Auto-discover builders by naming convention (`build_*_cypher`) via module introspection. ~1h. Not done here to keep the sprint minimal  |
| **RES-2** | I-1 scans core-api only; `apps/api-gateway` (a second live Python tier holding a service-role key) and Edge Functions are unscanned (1.4, 1.5) | **Medium** | Extend the scan to api-gateway. Note ADR-009 proposes retiring it, so this may resolve itself — but **not before retirement completes** |
| **RES-3** | I-10 scans four retrieval modules; a literal elsewhere is missed (10.3)                                                                        | Low        | Widen to the whole `grounding/` package once false-positive behaviour is understood                                                     |
| **RES-4** | Dynamic construction evades literal analysis (1.2, 10.6)                                                                                       | Low        | Inherent to static analysis. Runtime guards are the compensating control                                                                |
| **RES-5** | The client guard's own presence is untested (3.7)                                                                                              | Low        | Add a test asserting `_post_personal` retains all three checks                                                                          |
| **RES-6** | I-8/I-9 (family ≠ permission; provider exclusion) only partially covered                                                                       | Medium     | **Blocked on ADR-003** — the full matrix needs `permitted_*` fields                                                                     |

**RES-2 is the one worth flagging to reviewers.** `apps/api-gateway` is live, internet-reachable, holds
a Supabase service-role key, and is not covered by the single-writer scan. ADR-009 proposes retiring it;
until that completes, I-1 is enforced for one of two live Python tiers.

---

## Invariants blocked on ADR acceptance

| Invariant                       | Blocked on | Status                                  |
| ------------------------------- | ---------- | --------------------------------------- |
| I-12 manifest policy fidelity   | ADR-003    | Designed; fields do not exist yet       |
| I-13 no edge without provenance | ADR-002    | Designed; schema undecided pending OQ-2 |
| I-14 confidence not collapsed   | ADR-010    | Designed; no fields exist               |

Per the sprint constraint, these were **documented, not implemented**. Attempting them would require
architectural decisions that are still `Proposed`.
