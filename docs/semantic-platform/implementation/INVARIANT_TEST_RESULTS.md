# Invariant Test Results — Sprint 1

**Date:** 2026-07-30 · **Commit under test:** `ac41b5e7` + WP-010 working tree
**Environment:** `apps/lifenavigator-core-api/.venv` (Python 3.12), `cargo` stable

---

## 1. New invariant suite — 14/14 passing

`apps/lifenavigator-core-api/tests/test_architectural_invariants.py`

| #   | Test                                                                     | Invariant | Result        |
| --- | ------------------------------------------------------------------------ | --------- | ------------- |
| 1   | `test_i1_no_write_cypher_anywhere_in_core_api`                           | I-1       | ✅ PASSED     |
| 2   | `test_i2_neo4j_client_exposes_no_write_method`                           | I-2       | ✅ PASSED     |
| 3   | `test_i3_every_node_pattern_binds_the_tenant[build_expand_cypher]`       | I-3       | ✅ PASSED     |
| 4   | `test_i3_every_node_pattern_binds_the_tenant[build_lexical_seed_cypher]` | I-3       | ✅ PASSED     |
| 5   | `test_i3_every_node_pattern_binds_the_tenant[build_seed_cypher]`         | I-3       | ✅ PASSED     |
| 6   | `test_i3_every_builder_references_the_tenant_parameter`                  | I-3       | ✅ PASSED     |
| 7   | **`test_i3_two_tenant_traversal_returns_zero_foreign_tenant_nodes`**     | **I-3**   | ✅ **PASSED** |
| 8   | `test_i3_two_tenant_fixture_detects_an_unbound_neighbour` (meta)         | I-3       | ✅ PASSED     |
| 9   | `test_i4_client_refuses_untenanted_statement`                            | I-4       | ✅ PASSED     |
| 10  | `test_i4_client_refuses_caller_supplied_tenant`                          | I-4       | ✅ PASSED     |
| 11  | `test_i4_empty_tenant_is_refused`                                        | I-4       | ✅ PASSED     |
| 12  | `test_i10_no_raw_relationship_literals_in_retrieval_modules`             | I-10      | ✅ PASSED     |
| 13  | `test_i10_edge_types_are_derived_from_the_manifest_not_hardcoded`        | I-10      | ✅ PASSED     |
| 14  | `test_i10_related_to_is_never_traversable`                               | I-10      | ✅ PASSED     |

`14 passed in 0.32s`

**Test 7 is the deliverable the sprint named as highest-value.** Test 8 exists to guarantee test 7 can
still fail — a fixture that cannot detect a leak is worse than no fixture, because it certifies safety
it does not verify.

---

## 2. Mutation testing — every gate proven to fail

Standing rule: _a gate never demonstrated failing is decoration._ Each invariant was deliberately
broken, the suite run, and the mutation reverted.

### M-1 · I-3 — far-end tenant binding removed

```diff
- f"MATCH (a)-[r:{rels}]-(b {{tenant_id: $user_id}}) "
+ f"MATCH (a)-[r:{rels}]-(b) "
```

**Result: 2 failed, 12 passed.**

- `test_i3_every_node_pattern_binds_the_tenant[build_expand_cypher]` — static detection
- `test_i3_two_tenant_traversal_returns_zero_foreign_tenant_nodes` — **the fixture returned tenant B's
  node, proving it detects a real cross-tenant leak rather than a canned result**

This is the single most important line in this document: a one-token deletion in a Cypher builder is a
cross-tenant data breach, and it is now caught two independent ways.

### M-2 · I-1 — write Cypher added to a service

```python
BAD = "MATCH (n {tenant_id: $user_id}) SET n.title = 'x' RETURN n"
```

**Result: 1 failed** — `test_i1_no_write_cypher_anywhere_in_core_api`.

### M-3 · I-2 — write method added to the client

```python
async def execute(self, q): return None
```

**Result: 1 failed** — `test_i2_neo4j_client_exposes_no_write_method`.

### M-4 · I-10 — raw relationship literal in retrieval code

```python
HARDCODED = "HAS_GOAL|HAS_EVIDENCE"
```

**Result: 1 failed** — `test_i10_no_raw_relationship_literals_in_retrieval_modules`.

### Post-mutation state

All four reverted via `git checkout`. Working tree verified clean; suite returned to 14/14.

---

## 3. Full regression

| Suite                   | Command                                  | Before     | After          | Delta           |
| ----------------------- | ---------------------------------------- | ---------- | -------------- | --------------- |
| core-api                | `pytest tests/ -q`                       | 963 passed | **977 passed** | +14, 0 failures |
| ingestion-worker        | `cargo test --lib`                       | 85 passed  | **85 passed**  | unchanged       |
| Ontology drift gates    | `cargo test --lib manifest`              | 9 passed   | **9 passed**   | unchanged       |
| Domain vocabulary gates | `pytest tests/test_domain_vocabulary.py` | 10 passed  | **10 passed**  | unchanged       |

**No existing test was modified, skipped, or weakened.**

---

## 4. Defects found in the tests themselves

Both surfaced on first run and were fixed by making the checks **more precise**, never more permissive.

| #   | Defect                                            | Symptom                                                                                                               | Fix                                                                                              |
| --- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| D-1 | Node-pattern regex matched function calls         | `type(r)`, `labels(b)`, `coalesce(…)` reported as unbound node patterns                                               | `(?<![\w.])` lookbehind excludes function calls                                                  |
| D-2 | Relationship-literal check used a shape heuristic | Cypher keywords `MATCH`, `RETURN`, `ORDER`, `DESC`, `LIMIT`, `WITH`, `NULL`, `CONTAINS` flagged as relationship types | Replaced with membership against the **generated manifest vocabulary** — self-updating and exact |

D-2's fix is a genuine improvement beyond bug-fixing: the check is now derived from the same generated
contract it protects, so a new relationship type is covered automatically.

---

## 5. What these results do NOT establish

Stated explicitly to prevent over-reading:

- **CI enforcement is unproven in CI.** The job is valid YAML and confirmed unconditional, but the
  branch is unpushed, so it has never executed in GitHub Actions. Status: _Implemented_, not
  _Operationally observed_.
- **I-3 is proven for the three current builders only.** A future builder is covered by the static
  test only if it is added to `ALL_BUILDERS` — a registration step a developer could forget. Recorded
  as residual RES-1 in the regression matrix.
- **No production traversal was executed.** These are unit-level; ADR-008's live verification is a
  separate, still-blocked package.
- **I-8/I-9 are partially covered.** Only the `RELATED_TO` non-traversability slice is tested; the full
  principal × context matrix requires ADR-003.
