# Relationship Catalog

**Status:** authoritative for runtime relationship vocabulary and traversal semantics.
**Source of truth:** `apps/ingestion-worker/src/relationship_catalog.rs` (`CATALOG`).
**Generated contract:** `apps/lifenavigator-core-api/app/grounding/semantic/ontology_manifest.json` (v2).
**Regenerate:** `cargo test -p ingestion-worker export_relationship_manifest -- --ignored`

---

## What this is, and what it is not

This catalog is a **typed, weighted, policy-carrying operational relationship vocabulary**. It controls
which relationships ingestion may emit, which the planner may traverse, in which query contexts, and how
they rank.

It is **not** an OWL ontology and there is **no RDF reasoner**. The `.ttl` and SHACL files under
`ontology/` are loaded by zero lines of runtime code; they are disconnected conceptual assets. No
subsumption, no inference, no SHACL validation runs at any point in the pipeline. Any claim that
LifeNavigator performs ontological reasoning would be false.

---

## The defect this replaced

The manifest generator walked `ontology::REGISTRY` and nothing else. But `REGISTRY` was never the only
emitter — `normalizer::relationships_for` carried a second mapping as an inline `match`, and **a `match`
is not enumerable**. Nothing could walk it to discover what it emitted.

Consequence, measured against production:

|                                                           | count                                |
| --------------------------------------------------------- | ------------------------------------ |
| Relationship types the normalizer's legacy table can emit | 89                                   |
| Of those, absent from the generated manifest              | **86**                               |
| Live in the graph, absent from the manifest               | 1 (`HAS_EDUCATION_RECORD`, 16 edges) |

`HAS_EDUCATION_RECORD` was not an isolated omission — it was the only one of the 86 that happened to
have data. Every other legacy domain (health metrics, lab results, estate beneficiaries, why-chains,
optimizer runs, provider records) would have become unreachable the moment it was populated. The
relationships were writable but not traversable, and nothing reported the gap.

The repair is structural, not a row addition:

1. The legacy mapping moved out of the `match` into `ontology::LEGACY_USER_EDGES` — an enumerable table.
2. `relationship_catalog::emittable_relationship_types()` walks **every** enumerable emitter.
3. CI fails if executable code can emit a relationship with no catalog row.
4. The manifest is generated from the catalog, so policy travels with the vocabulary.

---

## Coverage

Machine-readable: `artifacts/graphrag-reconciliation/relationship_coverage.json`.

| metric                               | value |
| ------------------------------------ | ----- |
| Emittable by executable code         | 141   |
| Declared in catalog / manifest       | 147   |
| Live relationship types in the graph | 40    |
| Live but undeclared                  | **0** |
| Traversable — personal advisor       | 119   |
| Non-traversable                      | 28    |
| Implemented but absent from data     | 106   |
| Planned (no writer)                  | 6     |
| Deprecated                           | 0     |
| Provider / B2B                       | 19    |
| Sensitive personal                   | 25    |

"Implemented but absent from data" is **not** a defect. Support is a property of the code; a
relationship with no rows yet is still supported. The reverse — live but undeclared — is the defect, and
it is now zero and CI-enforced.

---

## Per-relationship declaration

Every row in `CATALOG` declares all of:

| field                                     | meaning                                                                                            |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `origin`                                  | which emitter can produce it — `PrimaryRegistry`, `LegacyNormalizer`, `SpecialFallback`, `Planned` |
| `lifecycle`                               | `Implemented`, `Planned`, `Deprecated`, `Unsupported`, `DerivedOnly`                               |
| `classification`                          | see the eight classes below                                                                        |
| `data_plane`                              | `PersonalLifeModel`, `DerivedAnalytic`, `Operational`, `ProviderB2b`, `Central`                    |
| `sensitivity`                             | `Low`, `Medium`, `High`, `Restricted`                                                              |
| `semantic_domain`                         | owning domain                                                                                      |
| `family`                                  | edge family driving ranking                                                                        |
| `weight`                                  | evidential ranking weight                                                                          |
| `direction`                               | `SourceToTarget` — `(source)-[rel]->(target)`                                                      |
| `source_node_types` / `target_node_types` | permitted endpoints                                                                                |
| `permitted_contexts`                      | query contexts allowed to traverse. **Empty means none, never "all".**                             |
| `permitted_principals`                    | `User`, `Provider`, `OrgAdministrator`, `System`                                                   |
| `max_hops`                                | `0` = never expand through this edge                                                               |
| `provenance_required`                     | provenance must accompany the edge                                                                 |
| `citation_eligible`                       | may appear in a user-facing citation                                                               |

### Classification

| class                    | count | notes                                        |
| ------------------------ | ----- | -------------------------------------------- |
| Personal life-model fact | 77    | the user's own life data                     |
| Sensitive personal       | 25    | health, insurance, estate, dependents        |
| Provider / B2B           | 19    | **not** personal-advisor eligible            |
| Derived analytic         | 17    | probabilities, projections, accuracy metrics |
| Operational / provenance | 8     | traces, audits, discovery sessions           |
| Compatibility            | 1     | `RELATED_TO` fallback                        |
| Deprecated               | 0     | —                                            |
| Planned, not implemented | 6     | declared, no writer                          |

---

## Fail-closed guarantee

`spec_for()` returns `None` for an undeclared relationship, and **`None` means refuse**. Neither
ingestion validation nor traversal planning substitutes a default policy. There is no inferred fallback:
an unknown relationship is a build failure, not a guess.

Proven by `undeclared_relationship_is_refused_in_every_context` (Rust) and
`test_undeclared_relationship_is_never_traversable` (Python).

---

## CI gates

| gate                                                    | location      | fails when                                                |
| ------------------------------------------------------- | ------------- | --------------------------------------------------------- |
| `manifest_covers_every_relationship`                    | `ontology.rs` | an emitter can produce a relationship with no catalog row |
| `every_catalog_row_has_an_explicit_traversal_policy`    | `ontology.rs` | a row is hop-expandable but permits no context            |
| `provider_b2b_edges_are_not_personal_advisor_eligible`  | `ontology.rs` | a B2B edge becomes personal-advisor reachable             |
| `undeclared_relationship_is_refused_in_every_context`   | `ontology.rs` | the planner infers a policy                               |
| `manifest_on_disk_matches_the_registry`                 | `ontology.rs` | semantic drift; formatting-only changes pass              |
| `test_provider_edges_are_excluded_from_every_plan`      | core-api      | any query plan admits a B2B edge                          |
| `test_family_membership_alone_does_not_grant_traversal` | core-api      | the policy filter becomes a no-op                         |
| `relationship_coverage.py`                              | CI script     | a live relationship type is undeclared                    |

### Proof the gate bites

A controlled relationship was injected into an emitter and CI failed until it was catalogued:

```
$ # inject (EntityType::Goal, "ZZ_CONTROLLED_PROOF_EDGE") into LEGACY_USER_EDGES
$ cargo test --lib manifest_covers_every_relationship
executable code can emit 1 relationship type(s) with no catalog row: ["ZZ_CONTROLLED_PROOF_EDGE"]
test result: FAILED. 0 passed; 1 failed

$ # revert
test result: ok. 1 passed; 0 failed
```

---

## Related

- `RELATIONSHIP_TRAVERSAL_POLICY.md` — per-context policy model and why it is not a Boolean
- `RELATIONSHIP_COVERAGE_REPORT.md` — the numbers above, with live-graph join
- `artifacts/graphrag-reconciliation/` — machine-readable coverage and live snapshot
