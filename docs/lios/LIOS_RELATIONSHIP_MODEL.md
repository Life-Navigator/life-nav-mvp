# LIOS — Relationship Model (Phase 2)

The edges between entities are where the **life model** stops being a pile of rows and becomes
_intelligence_. This is the moat: a typed, provenance-carrying graph of how a person's goals,
constraints, money, health, and decisions actually relate. Models read it; they do not own it.

Companion to `LIOS_ONTOLOGY_ARCHITECTURE.md`. Same discipline — every edge type is marked
**EXISTS / PARTIAL / NEW** with backing — and the same hard rule applies, **already enforced in
production**: _the advisor may assert a relationship only if a real graph edge backs it_
(`advisor_validator.py`, `_check_relationships`).

---

## 1. The mandate: every edge carries lineage

A LIOS edge is never a bare `(a)-[rel]->(b)`. It carries the trust payload, and **this schema
already exists** in the Life Graph workspace edge model
(`apps/lifenavigator-core-api/app/services/life_graph_workspace.py`):

```jsonc
{
  "id":          "persisted:src->tgt:rel",   // stable, derived
  "source":      "<node id>",
  "target":      "<node id>",
  "type":        "supports | conflicts_with | depends_on | impacts | evidenced_by | ...",
  "label":       "human-readable",
  "confidence":  0.0-1.0,                     // MANDATE: confidence
  "strength":    0.0-1.0,
  "provenance":  "persisted_edge | computed_connection | shared_node",  // MANDATE: provenance
  "via":         "<shared node label>",       // lineage: how it was derived
  "viaId":       "<shared node id>",
  "citationId":  "<evidence/source node id>", // MANDATE: lineage / citation
  "evidenceIds": ["<evidence node id>", ...]  // MANDATE: evidence
}
```

Plus the **timestamp** mandate: the underlying canonical nodes carry `created_at`/`updated_at`
(`entities.rs:774`), surfaced as edge/graph `lastUpdated` (`life_graph_workspace.py:213`). Neo4j
edges inherit the tenant + timestamp context of their nodes (`merge_cypher_for`, `neo4j_client.rs:110`).

**Provenance values are a closed set, all EXISTS today:**

| `provenance`          | Meaning                                                                | Backing                                                 |
| --------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------- |
| `persisted_edge`      | A real edge stored in the personal graph (Neo4j / `life_graph_edges`). | `life_graph_workspace.py:179`                           |
| `computed_connection` | Derived deterministically (e.g. recommendation→impacted-domain hub).   | `life_graph_workspace.py:160`                           |
| `shared_node`         | A real 2-hop link through a single shared node.                        | `advisor_context.py:142`, `life_graph_workspace.py:192` |

> **The trust gate (live).** `advisor_validator._check_relationships` (`advisor_validator.py:119`)
> rejects any advisor turn that (a) cites a pair not in `connected_pairs`, or (b) _asserts_ a
> goal-to-goal relationship when the graph has no supporting edge. `connected_pairs` is built only
> from **persisted edges + real shared-node connections** (`advisor_context.py:151`,
> `build_relationships`). If the graph has no edges, the advisor says nothing about connections.
> This is the single most important property LIOS preserves: **no ungrounded edge ever reaches the user.**

---

## 2. The relationship algorithm is shared (one core, two views)

There is exactly one relationship engine, `derive_graph_relations` (`advisor_context.py:102`),
operating at node-id level. Two views build on it, guaranteeing the advisor and the visual graph
**agree on what exists**:

- **Advisor LABEL view** — `build_relationships` → `relationship_edges`, `connections`,
  `connected_pairs` (the validator's allow-set). `advisor_context.py:151`.
- **Workspace ID view** — `build_workspace` → frontend `nodes`/`edges` with full provenance.
  `life_graph_workspace.py:168`.

"If the advisor cannot cite an edge, the graph cannot draw it" (`life_graph_workspace.py:6`). LIOS
formalizes this as an invariant: **one relationship core, no second source of edges.**

---

## 3. Edge-type catalog

Direction is `source → target`. Markers cite where the edge is real today.

### 3.1 Structural / ownership edges — **EXISTS** (the live registry)

These are emitted by the ingestion worker's ontology registry (`ontology.rs`) on every sync. They
are the typed, tenant-safe backbone; `RELATED_TO` is the _only_ fallback and registry-mapped
entities never reach it (tested, `ontology.rs:428`).

| Edge           | Semantics                                                                             | Valid pairs (source→target)                                                                                                    | Marker · Backing                                                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **owned_by**   | The entity belongs to the person.                                                     | Person → {Asset, Account, Liability, Investment, Income, Expense, Document, …} (emitted as `OWNS_ACCOUNT`/`HAS_ASSET`/`HAS_*`) | **EXISTS** — `ontology.rs:92-252` (UserAnchor edges)                                                                                                    |
| **part_of**    | The entity is a component of a parent.                                                | DocumentField → Document; DecisionScenario → Decision; Evidence/Assumption/Tradeoff → Recommendation                           | **EXISTS** — FK edges `HAS_EXTRACTED_FIELD`, `HAS_SCENARIO`, `HAS_EVIDENCE` (`ontology.rs:123-253`)                                                     |
| **managed_by** | The entity is administered by another (account holds holdings; plan covers a person). | InvestmentHolding → FinancialAccount; GuardianshipPlan → Dependent (`COVERS_DEPENDENT`); School → Program (`OFFERS`)           | **PARTIAL** — specific typed forms exist (`HAS_HOLDING` FK, `COVERS_DEPENDENT`, `OFFERS`); no generic `managed_by` label yet (`ontology.rs:99,226,211`) |

### 3.2 Semantic / reasoning edges — the LIOS core

| Edge               | Semantics                                                     | Valid pairs                                                                | Marker · Backing                                                                                                                                                                                                                 |
| ------------------ | ------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **supports**       | Source advances/helps the target.                             | Goal→Objective, Evidence→Recommendation, Asset→Goal, Position→Goal         | **EXISTS** — first-class in the advisor relation core; `connected_pairs` + `relationship_edges` gate it (`advisor_context.py:151`); validator phrase "both support" (`advisor_validator.py:24`).                                 |
| **conflicts_with** | Source competes with / works against the target.              | Goal↔Goal, Recommendation↔Recommendation (same finite resource)            | **EXISTS** — advisor relation core + RecommendationOS conflict engine (`_conflicts`, money/time/resource competition, `recommendations_os.py:635`); validator phrases "compete with / at odds with" (`advisor_validator.py:32`). |
| **depends_on**     | Target is a prerequisite of source.                           | Objective→Dependency, Goal→Constraint, Recommendation(DEPENDENCY)→Document | **EXISTS** — `life.dependencies` drives DEPENDENCY recs (`recommendations_os.py:389`); the advisor reflects derived dependencies (`relationship_manager.py:232`); relation-core edge.                                            |
| **impacts**        | Source changes the readiness/state of target (sign-agnostic). | Recommendation→DomainHub, Decision→Domain, Document→Analysis               | **EXISTS** — typed `impacts` edge with provenance `computed_connection` (`life_graph_workspace.py:160`); cross-domain `impact` nodes in decision graph (`decision_graph.py:109`); `CrossDomainImpact` entity.                    |
| **evidenced_by**   | Source is backed by a piece of evidence.                      | Recommendation→Evidence, Analysis→Evidence                                 | **EXISTS** — typed `evidenced_by` edge, `provenance: persisted_edge`, `citationId` set (`life_graph_workspace.py:145`); registry `HAS_EVIDENCE` (`ontology.rs:123`).                                                             |
| **derived_from**   | Source was computed from a source row/document.               | Evidence→Source(table), Analysis→Document, Recommendation→life_objective   | **EXISTS** — `from_source` edge (`life_graph_workspace.py:153`); `derived_by`/`source_tables`/`source_graph_nodes` on decisions (`134_decision_schema.sql:27`); `source_table` on every node.                                    |
| **supported_by**   | Inverse of `supports` (target is what does the supporting).   | Objective→Evidence, Recommendation→Fact                                    | **PARTIAL** — semantically present via `evidenced_by` + `supports` (the reverse traversal exists); not a distinct stored label.                                                                                                  |

### 3.3 Domain-effect edges — **PARTIAL** (computed, not yet typed in the registry)

These are computed/asserted in services today but are **not** yet first-class typed Neo4j edges from
`ontology.rs` (they are documented EXTENSION POINTS in the registry, `ontology.rs:115-148`). They are
real in the reasoning layer, partial in the persisted graph.

| Edge            | Semantics                                               | Valid pairs                                              | Marker · Backing                                                                                                                                                 |
| --------------- | ------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **accelerates** | Source speeds up reaching the target.                   | Action→Goal, Compensation↑→FinancialGoal                 | **PARTIAL** — expressed as positive `impacts` with a readiness delta (`decision_graph.py:114`); no distinct `accelerates` label.                                 |
| **blocks**      | Source prevents/gates the target until resolved.        | Constraint→Objective, DEPENDENCY→Action                  | **PARTIAL** — RecommendationOS `roadmap.blocked_by` + DEPENDENCY blockers (`recommendations_os.py:543`); not a stored edge label.                                |
| **improves**    | Source raises a measured outcome of target.             | Recommendation→ReadinessIndex, Habit→HealthMetric        | **PARTIAL** — recomputed readiness/protection deltas (`recommendations_os.py:175,280`); surfaced as `impacts`, not a typed `improves` edge.                      |
| **reduces**     | Source lowers a (usually risk/cost) quantity of target. | Action→Risk, Coverage→ProtectionGap                      | **PARTIAL** — `risk_reduction` quantified impact (`recommendations_os.py:288`); not a typed edge.                                                                |
| **requires**    | Target must exist/be true for source.                   | Recommendation→Document, Objective→Constraint resolution | **PARTIAL** — DEPENDENCY recs ("upload your 401(k) statement", `recommendations_os.py:263`); registry extension point.                                           |
| **protects**    | Source guards target against a threat.                  | Insurance→Dependent, EstatePlan→Household                | **PARTIAL** — protection-gap analysis ("closes a survivor income shortfall", `recommendations_os.py:286`); not a typed edge.                                     |
| **threatens**   | Source endangers target.                                | Risk→Objective, Underinsurance→Family                    | **PARTIAL** — `life.risks` linked to objectives ("threatens your objective", `recommendations_os.py:410`); modeled as a Risk node, not a typed `threatens` edge. |

### 3.4 Lifecycle edge — **EXISTS**

| Edge           | Semantics                                      | Valid pairs                                                           | Marker · Backing                                                                                                                                                                                                                                                                                                                     |
| -------------- | ---------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **supersedes** | Source replaces/obsoletes target (versioning). | Objective→Objective, Recommendation→Recommendation, Decision→Decision | **EXISTS** — superseded objectives stop generating recs (`recommendations_os.py:383`); recs are `invalidated` when no longer evidence-backed (`recommendations_os.py:425`); `LifeScenarioVersion` + `accepted_at/rejected_at/dismissed_at` lifecycle on decisions (`134_decision_schema.sql:30`). Not yet a stored Neo4j edge label. |

---

## 4. Summary: EXISTS vs the work

**EXISTS as live, provenance-carrying edges:**
`owned_by`, `part_of`, `supports`, `conflicts_with`, `depends_on`, `impacts`, `evidenced_by`,
`derived_from`, `supersedes` (lifecycle), and the full edge payload (confidence + provenance +
lineage + citation + timestamp). The validator already enforces grounding on `supports` /
`conflicts_with` / `depends_on` with citations.

**PARTIAL (real in the reasoning/recommendation layer, not yet a typed registry edge):**
`managed_by` (generic form), `supported_by`, `accelerates`, `blocks`, `improves`, `reduces`,
`requires`, `protects`, `threatens`. Each is a documented **extension point** in `ontology.rs`
(awaiting outgoing-edge support in `merge_cypher_for` and/or an FK), not a fabrication.

**NEW:** no edge type in the mandated list is wholly unrepresented — but promoting the §3.3 effect
edges from "computed in a service" to "typed, persisted, provenance-stamped Neo4j edges" is the
concrete Phase-2 build. The durable move is identical to the ontology one: add the edge as a
**registry rule** in `ontology.rs` with a `version`, give `merge_cypher_for` outgoing-edge support,
and carry the §1 payload — so a new semantic edge is _data_, reviewed once, never scattered logic.
