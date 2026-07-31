# Invariant Implementation Report — Sprint 1 (WP-010)

**Date:** 2026-07-30 · **Scope:** unconditional architectural invariant enforcement only.
**No ADR was modified. No architecture was redesigned. No production behaviour changed.**

---

## 1. What was implemented

| Invariant                                    | Enforcement added                                                                 | Status                            |
| -------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------- |
| **I-1** Rust worker is the only graph writer | AST-based scan for write Cypher across all core-api Python                        | **Implemented + mutation-proven** |
| **I-2** Python Neo4j client is read-only     | Public-surface assertion on `Neo4jClient`                                         | **Implemented + mutation-proven** |
| **I-3** Tenant bound on every node pattern   | Static check of every generated Cypher builder **+ two-tenant traversal fixture** | **Implemented + mutation-proven** |
| **I-4** Caller cannot override tenant        | Three negative tests against the client guard                                     | **Implemented**                   |
| **I-10** No raw-string relationship emission | Literals checked against the generated manifest vocabulary                        | **Implemented + mutation-proven** |

**Deliverables:** `apps/lifenavigator-core-api/tests/test_architectural_invariants.py` (14 tests) and an
unconditional `architectural-invariants` CI job in `.github/workflows/ci.yml`.

---

## 2. Enforcement points located

### I-1 / I-2 — write path

- **Sole sanctioned writer:** `apps/ingestion-worker/src/neo4j_client.rs`
- **Read-only surface (verified):** `app/clients/neo4j.py` exposes `query_personal`,
  `query_personal_dicts`, `_post_personal`, `ready`, `configured` — **no write method**
- **Regression paths:** (a) a convenience `execute`/`run`/`write` helper on the client;
  (b) write Cypher embedded in a router or service; (c) a second client class bypassing this one

### I-3 / I-4 — tenant binding

- **Cypher builders:** `build_seed_cypher`, `build_lexical_seed_cypher`, `build_expand_cypher`
  (`app/grounding/semantic/traversal.py`)
- **Runtime guard:** `Neo4jClient._post_personal` — refuses statements lacking `$user_id`, refuses a
  caller-supplied `user_id`, binds tenant **last** so it cannot be overwritten
- **Entry guard:** `traverse()` raises on an empty `user_id` — fails closed, never wildcards
- **Regression paths:** (a) a new builder that binds only the seed; (b) the far-end binding removed
  from an expansion; (c) a new builder added without the tenant parameter; (d) the client guard
  weakened or duplicated into a caller

### I-10 — relationship vocabulary

- **Authority:** `apps/ingestion-worker/src/relationship_catalog.rs` → generated
  `ontology_manifest.json` → consumed by `planner.py`
- **Regression paths:** (a) an inline `"HAS_GOAL"` literal in retrieval code; (b) a hand-maintained
  edge-type list; (c) a fallback list shadowing the manifest

---

## 3. The two-tenant fixture — why it is not tautological

The pre-existing test `test_traversal_binds_the_authenticated_tenant_on_every_hop` asserts that the
tenant is passed on each call. It cannot detect a leak, because its fake returns whatever rows the test
author supplied regardless of the query.

`TwoTenantFakeNeo4j` instead **interprets the tenant predicate in the generated Cypher**. It holds data
for two tenants plus a deliberately corrupt cross-tenant edge (`a1 → b2`), and returns a neighbour only
if the statement actually constrains it. Consequently:

- with the far-end binding present → tenant B's node is unreachable
- with the far-end binding removed → tenant B's node **is returned and the test fails**

That was verified by mutation (§4). A companion meta-test
(`test_i3_two_tenant_fixture_detects_an_unbound_neighbour`) feeds the fake a deliberately defective
statement and asserts the leak _does_ appear — so if the fixture ever stops being able to fail, that is
itself a test failure.

---

## 4. Mutation proof

Each gate was verified to fail when its invariant is broken, then reverted.

| #   | Mutation                                                                   | Expected | Result                                                                            |
| --- | -------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------- |
| 1   | Remove `{tenant_id: $user_id}` from the neighbour in `build_expand_cypher` | I-3 red  | ✅ **2 tests failed** — static check _and_ the two-tenant fixture caught the leak |
| 2   | Add a module containing `MATCH … SET n.title …`                            | I-1 red  | ✅ failed                                                                         |
| 3   | Add `async def execute()` to `Neo4jClient`                                 | I-2 red  | ✅ failed                                                                         |
| 4   | Add `HARDCODED = "HAS_GOAL\|HAS_EVIDENCE"` to `fusion.py`                  | I-10 red | ✅ failed                                                                         |

All mutations reverted via `git checkout`; working tree verified clean afterwards.

---

## 5. Test-authoring defects found and fixed

Both initial failures were bugs in the tests, **not** real invariant violations. Recorded because a
reviewer should know the checks were tightened rather than loosened:

1. **Node-pattern regex matched function calls.** `type(r)`, `labels(b)`, `coalesce(…)` were being read
   as unbound node patterns. Fixed with a `(?<![\w.])` lookbehind — made _more_ precise, not more
   permissive.
2. **Relationship-literal check flagged Cypher keywords.** `MATCH`, `RETURN`, `ORDER`, `DESC`, `LIMIT`,
   `WITH`, `NULL`, `CONTAINS` match an uppercase-token shape. Replaced the shape heuristic with a
   membership test against **the actual manifest vocabulary** — a literal is an offender only if it is
   a real relationship type. Strictly more precise and self-updating as the catalog evolves.

---

## 6. Regression suite status

| Suite                                      | Before | After              |
| ------------------------------------------ | ------ | ------------------ |
| core-api pytest                            | 963    | **977** (+14)      |
| ingestion-worker `cargo test --lib`        | 85     | **85** (unchanged) |
| Drift gates (catalog↔manifest, vocabulary) | green  | **green**          |

No existing test was modified, disabled, or weakened.

---

## 7. Constraint compliance

| Constraint                      | Compliance                                    |
| ------------------------------- | --------------------------------------------- |
| No provenance implemented       | ✅                                            |
| No graph data migrated          | ✅                                            |
| No retrieval behaviour modified | ✅ — tests only; no production module changed |
| Graph traversal not enabled     | ✅ — `GRAPH_GROUNDING_ENABLED` untouched      |
| No authorization policy change  | ✅                                            |
| No new architecture             | ✅                                            |
| No ADR modified                 | ✅                                            |

**Production code changed: none.** The sprint added one test module and one CI job.

---

## 8. Invariants NOT enforced — blocked on ADR acceptance

Documented rather than implemented, per the sprint constraint:

| Invariant                           | Blocked on | Why it cannot be enforced now                                                                         |
| ----------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------- |
| **I-12** manifest policy fidelity   | ADR-003    | The fields to compare (`permitted_contexts`, `permitted_principals`) do not exist in the manifest yet |
| **I-13** no edge without provenance | ADR-002    | `ProvenanceRef` does not exist; the schema is undecided pending OQ-2                                  |
| **I-14** confidence not collapsed   | ADR-010    | No confidence fields exist to check                                                                   |

I-8 (family ≠ permission) and I-9 (provider exclusion) were **partially** covered: the sprint asserts
`RELATED_TO` is never traversable, but the full principal × context matrix cannot be tested until
ADR-003 lands. Recorded as a residual, not as complete.

---

## 9. Additional weakness discovered — documented, scope not expanded

**W-1 · Path-filtered CI would have made the invariants conditional.**
`deploy-fly.yml:test-core-api` is gated by `paths-filter` on `apps/lifenavigator-core-api/**`. Had the
invariant tests been left there, they would have run only when core-api changed — and a cross-tenant
regression can be introduced by a change that never touches those paths.

_Resolved within scope_ by adding an **unconditional** `architectural-invariants` job to `ci.yml`
(no `if`, no `needs`, no path filter), mirroring the existing `verify-governance` precedent.

**W-2 · `.venv` vs CI environment divergence (IQ-4) — unresolved.**
Local runs use `apps/lifenavigator-core-api/.venv`; CI installs from `requirements*.txt`. These were
not proven equivalent. Logged as risk R-12; **not** addressed in this sprint.

---

## 10. Honest status

| Capability                           | Highest achieved status                                            |
| ------------------------------------ | ------------------------------------------------------------------ |
| I-1, I-2, I-3, I-4, I-10 enforcement | **Unit tested + mutation-proven**                                  |
| CI enforcement                       | **Implemented** — not yet observed running in CI (branch unpushed) |
| I-8, I-9                             | **Partially tested**                                               |
| I-12, I-13, I-14                     | **Designed** — blocked on ADRs                                     |

The CI job has been validated as well-formed YAML and confirmed unconditional, but **has not executed
in GitHub Actions**, because the branch is unpushed. It is _Implemented_, not _Operationally observed_.
