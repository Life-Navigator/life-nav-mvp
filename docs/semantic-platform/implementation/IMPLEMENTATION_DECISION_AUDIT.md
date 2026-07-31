# Implementation Decision Audit

**Date:** 2026-07-30 · Phase 9. **The highest-value unconditional work in the package** — most of it is
valid regardless of any ADR verdict, because it protects properties the platform already relies on.

Principle: _no architectural invariant should depend solely on human memory._

---

## 1. Invariant register

For each: can implementation accidentally violate it, is it automatable today, and what catches it.

| #        | Invariant                                                    | Source                 | Violable? | Automatable **today** | Detection                                                                                         |
| -------- | ------------------------------------------------------------ | ---------------------- | --------- | --------------------- | ------------------------------------------------------------------------------------------------- |
| **I-1**  | Exactly one graph writer (Rust worker)                       | verified strength      | **yes**   | ✅ **yes**            | CI: grep for write Cypher (`MERGE`/`CREATE`/`SET`/`DELETE`) outside the worker                    |
| **I-2**  | Python GraphRAG clients remain read-only                     | verified strength      | **yes**   | ✅ **yes**            | CI: assert `clients/neo4j.py` exposes no write method                                             |
| **I-3**  | Traversal binds **both** endpoints by tenant                 | `traversal.py:108-110` | **yes**   | ✅ **yes**            | CI: every emitted node pattern carries `{tenant_id: $user_id}`; property test on generated Cypher |
| **I-4**  | Caller cannot override the bound tenant                      | client guard           | yes       | ✅ yes                | negative test: caller-supplied tenant is ignored                                                  |
| **I-5**  | Relationship vocabulary enumerable                           | catalog                | yes       | ✅ **exists**         | `catalog_covers_every_emittable_relationship`                                                     |
| **I-6**  | Unknown relationship fails closed                            | `spec_for → None`      | yes       | ✅ **exists**         | `undeclared_relationship_is_refused_in_every_context`                                             |
| **I-7**  | Catalog↔manifest drift gated                                 | generator              | yes       | ✅ **exists**         | `manifest_on_disk_matches_the_registry` (semantic compare, survives prettier)                     |
| **I-8**  | Semantic family does not itself grant traversal              | catalog design         | **yes**   | ✅ yes                | test: permission derived from `permitted_*`, never from `family`                                  |
| **I-9**  | Provider/B2B excluded from personal traversal                | 19 types               | **yes**   | ✅ yes                | property test: personal principal ∩ provider types = ∅                                            |
| **I-10** | No raw-string relationship emission                          | evolution rule         | **yes**   | ✅ **yes**            | CI: grep for relationship-name string literals outside the catalog                                |
| **I-11** | Domain values canonical at every filter                      | ADR-committed          | yes       | ✅ **exists**         | `domain_values_are_canonical`, `manifest_on_disk_matches_the_vocabulary`                          |
| **I-12** | Manifest policy fidelity (catalog fields == exported fields) | ADR-003                | yes       | ⏳ after 003          | CI gate to be built with 003                                                                      |
| **I-13** | No edge without provenance reference                         | ADR-002                | yes       | ⏳ after 002          | Rust type system (`ProvenanceRef` required)                                                       |
| **I-14** | Confidence never collapsed to a stored scalar                | ADR-010                | yes       | ⏳ after 010          | schema gate                                                                                       |

**9 of 14 are automatable today. 5 already have passing gates** (I-5, I-6, I-7, I-11 ×2).
**4 are automatable, unautomated, and currently protected by human memory alone: I-1, I-2, I-3, I-10.**

---

## 2. The four unprotected invariants — build these first

These need no ADR verdict. They protect properties the platform already depends on, and every one has
already been violated somewhere in this codebase's history in an analogous form.

### DA-1 · Single graph writer (I-1) and read-only Python clients (I-2)

_Violation path:_ a future PR adds a convenience write method to `clients/neo4j.py`, or issues write
Cypher from a router. Nothing prevents it. Provenance enforcement (ADR-002) **assumes** single-writer;
if that assumption silently breaks, provenance becomes bypassable and the type-system guarantee is void.
_Check:_ CI grep for write verbs in Cypher strings outside `apps/ingestion-worker/`; assert the Python
client's public surface contains no write method.
_Prevention:_ fail the build. _Reviewer checklist:_ any new Neo4j call site.
_Effort:_ hours. **Highest ROI item in the entire programme.**

### DA-2 · Both-endpoint tenant binding (I-3)

_Violation path:_ a new traversal pattern binds only the seed, leaving the far end unconstrained —
a cross-tenant read that no test would catch because fixtures are single-tenant.
_Check:_ parse generated Cypher; assert every node pattern carries `{tenant_id: $user_id}`. Plus a
two-tenant fixture property test asserting zero foreign nodes in any returned path.
_Prevention:_ fail the build. _Rollback:_ revert the pattern.
_Effort:_ 1–2 days. **This is the most severe invariant in the system.**

### DA-3 · No raw-string relationship emission (I-10)

_Violation path:_ someone writes `"HAS_GOAL"` inline instead of going through the catalog — the exact
defect class (`EDGE_FAMILY` dict, `"finance"` literal) that produced this entire programme, twice.
_Check:_ CI grep for `SCREAMING_SNAKE` string literals matching relationship-name shape outside the
catalog module and its tests.
_Prevention:_ fail the build with a message naming the catalog as the required path.
_Effort:_ hours. Expect false positives initially; allowlist explicitly, never broadly.

### DA-4 · Family does not grant traversal (I-8) and provider exclusion (I-9)

_Violation path:_ a convenience helper infers permission from `family` because it is "close enough."
Currently true by construction; nothing enforces it.
_Check:_ property test that permission is a pure function of `permitted_*` and independent of `family`;
assertion that personal-principal types ∩ the 19 provider/B2B types = ∅.
_Effort:_ 1 day.

---

## 3. Reviewer checklist — for what automation cannot yet cover

Used until the corresponding gate exists; retired when it does.

| Question                                                             | Covers                                                    |
| -------------------------------------------------------------------- | --------------------------------------------------------- |
| Does this add a graph write outside the Rust worker?                 | I-1, I-2                                                  |
| Does any new Cypher node pattern omit `{tenant_id: $user_id}`?       | I-3                                                       |
| Does this introduce a relationship name as a string literal?         | I-10                                                      |
| Does this derive permission from `family` rather than `permitted_*`? | I-8                                                       |
| Does this widen `permitted_contexts` or `permitted_principals`?      | **breaking governance change** — requires security review |
| Does this add a second vocabulary, manifest, or policy source?       | evolution rule                                            |
| Does this default an unknown value instead of failing closed?        | I-6, I-11                                                 |
| Does this add a fallback that shadows a generated contract?          | the original defect class                                 |

The fifth row is the one reviewers most often wave through: widening a permission adds only a list
entry, looks additive, and changes who can see what. It is classified breaking for that reason.

---

## 4. Post-ADR invariants (I-12 … I-14)

Built with their ADRs, not before:

| Invariant                       | Mechanism                                                                        | Gate                                                                                               |
| ------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| I-12 manifest policy fidelity   | generator + CI compare                                                           | exported fields == catalog-declared fields; **and** personal advisor resolves to exactly 119 types |
| I-13 no edge without provenance | Rust type system — `ProvenanceRef` unobtainable without writing provenance first | compile-time + a test proving a bare edge write does not compile                                   |
| I-14 confidence not collapsed   | schema gate                                                                      | no single stored scalar; component correlation < 0.9                                               |

I-13's design point stands: making the wrong thing **unrepresentable** beats detecting it. That is only
sufficient because I-1 holds — which is why DA-1 must be automated before ADR-002 relies on it.

---

## 5. Standing rule

> **An invariant with no automated check is a comment.**

Every ADR that introduces an invariant must ship its verification mechanism in the same work package.
An ADR whose invariant is enforced only by review notes does not meet its acceptance criteria.
