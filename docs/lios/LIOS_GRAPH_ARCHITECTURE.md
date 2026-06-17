# LIOS Graph Architecture (Phase 4)

**Thesis.** The Life Graph is how LIOS reasons _across_ the durable life model: it connects goals,
constraints, risks, recommendations, documents, and domains so the system can answer "if X changes,
what else moves?". LIOS owns the graph as durable truth; models traverse and explain it but do not
own it. Everything drawn is **real-edges-only** — if the advisor can't cite an edge, the graph can't
draw it (`life_graph_workspace.py` reuses the advisor's relation core `derive_graph_relations`).

Status legend: **EXISTS** · **PARTIAL** · **NEW**.

---

## 1. The seven logical stores, mapped to the real 3-store stack

LIOS specifies seven _logical_ stores. They are **not** seven databases. They map onto the existing
three physical stores, which are kept in lock-step by the ingestion worker:

- **Supabase (Postgres)** = canonical truth. The `life.*`, domain (`finance/career/...`),
  `documents.*`, `recommendations.*`, `decision.*` rows ARE the nodes and relationships of record.
- **Neo4j Aura** = traversal index. The worker mirrors each canonical row as a node + edges via the
  Aura **Query API v2** (`apps/ingestion-worker/src/neo4j_client.rs`; legacy `/tx/commit` is
  forbidden on Aura). Labels are PascalCase of `entity_type`; every statement is `tenant_id`-filtered.
- **Qdrant** = semantic retrieval. The worker embeds each node's summary with
  `gemini-embedding-001` (**3072-dim**, must match the core-api `gemini.embed`) and upserts a point
  (`apps/ingestion-worker/src/processor.rs` `process_upsert`: embed → Qdrant → Neo4j).

| LIOS logical store     | Physical home                                                  | Status  | Evidence                                                                                                                                              |
| ---------------------- | -------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ------------- |
| **Node Store**         | Supabase canonical rows (truth) + Neo4j nodes (index)          | EXISTS  | `life_discovery.personal_graph` builds nodes from `life.*` + domain CRUD; worker `Neo4jClient::merge_cypher_for` mirrors each `CanonicalGraphObject`. |
| **Relationship Store** | Supabase `life.life_graph_edges` (truth) + Neo4j relationships | EXISTS  | `life_graph_edges` (`source_node/target_node/edge_type/confidence/status`); worker `MERGE (t)-[:REL]->(n)` from `canon.relationships`.                |
| **Evidence Store**     | `recommendations.recommendations.evidence[]` (+ `documents`)   | EXISTS  | `recommendations_os.py` requires evidence per rec; `life_graph_workspace.recommendation_lineage` materializes rec→evidence→source nodes/edges.        |
| **Confidence Store**   | `confidence` columns + `confidence.py` service                 | PARTIAL | Confidence on objectives/edges/recs/docs; **not** uniform across all node types (see Memory doc).                                                     |
| **Lineage Store**      | node `table`+`record_id`; edge `provenance` tag                | EXISTS  | `life_graph_workspace._map_node` emits `dataUsed` with `sourceTable`/`sourceId`; edges carry `provenance: persisted_edge                              | computed_connection | shared_node`. |
| **Scenario Store**     | `scenario_tree.py` / `scenario_compare.py` (Supabase)          | PARTIAL | Scenario trees exist as their own structures; **not yet** linked into the personal graph as nodes/edges.                                              |
| **Decision Store**     | `decision.*` + `decision_graph.py`                             | EXISTS  | `decision_graph.build` composes Documents→Analyses→Impacts→Tradeoffs→Recommendation→Readiness with per-node detail + provenance.                      |

**Single relation core.** The advisor and the graph share one algorithm —
`advisor_context.derive_graph_relations` (node-id level) and `build_relationships` (label level).
`life_graph_workspace.build_workspace` calls the same `derive_graph_relations`, so the graph and the
advisor _cannot disagree_ about which edges exist. This is the architectural backbone for trust.

---

## 2. Edge provenance model (already in code)

Every edge carries a `provenance` so the UI can defend it (`life_graph_workspace.py`):

- `persisted_edge` — a real row in `life.life_graph_edges` (or a rec→evidence edge backed by stored
  evidence). Highest trust.
- `computed_connection` / `shared_node` — a 2-hop link between two _primary_ nodes (Goal/Objective/
  hub) that share a node; carries `via`/`viaId`/`citationId`, strength `0.4`. Computed, not asserted.

`derive_graph_relations` only emits a connection when endpoints exist in `by_id` (edges with a
missing endpoint are dropped) and only between primary nodes within 2 undirected hops. No edge is
ever inferred from absence of data.

---

## 3. Capabilities to support — and their status

| Capability                     | Status  | What exists / what's missing                                                                                                                                                                                                                                                                                                     |
| ------------------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cross-domain traversal**     | EXISTS  | Domain hubs (`<domain>_hub`) connect domain-entity nodes (`part_of`) and link to objectives (`supports`) in `life_discovery.personal_graph`. Neo4j gives true multi-hop traversal across `tenant_id`-scoped nodes.                                                                                                               |
| **Goal analysis**              | EXISTS  | `life_objectives` (`why_chain`, themes, confidence) + dependencies + the advisor's 2-hop primary-node connections (`build_relationships`). Goal→evidence→recommendation lineage in `life_graph_workspace`.                                                                                                                       |
| **Conflict detection**         | NEW     | No explicit conflict/contradiction edge type today. Edges are supportive (`supports`, `part_of`, `impacts`, `evidenced_by`). A `conflicts_with` edge type + a detector (e.g. two goals competing for the same constrained resource) is NEW.                                                                                      |
| **Dependency mapping**         | EXISTS  | `life.dependencies` (objective→dependency, `satisfied` flag) materialized as `Dependency` nodes; decision graph maps document→analysis→impact dependencies.                                                                                                                                                                      |
| **Risk propagation**           | PARTIAL | Risks exist as nodes (`life.risks`) and recommendation RISK type; `decision_graph` colors impacts red and shows readiness deltas. But there is **no automatic propagation** of a risk's effect _along edges_ to connected goals/domains — impact is computed per decision-workspace, not graph-wide.                             |
| **Opportunity propagation**    | PARTIAL | Same as risk: `life.opportunities` + OPPORTUNITY recs + `impacted_domains` hub edges (`recommendation_lineage`), but no edge-following propagation engine.                                                                                                                                                                       |
| **Household reasoning**        | PARTIAL | Family-office domain (`family.dependents/beneficiaries/...`) is graphed under the `family_hub`; `family_office.py` reasons over it. Multi-member _household_ graph (shared goals across members, per-member tenancy) is not yet a first-class graph shape — current graph is single-user (`tenant_id = user_id` in most writes). |
| **Life-event impact analysis** | NEW     | `life.life_events` table exists but is not populated by a path nor wired to recompute affected goals/readiness. Event→impact propagation is NEW.                                                                                                                                                                                 |

---

## 4. The explainable endpoint (real-edges-only) — EXISTS

`apps/lifenavigator-core-api/app/routers/life_graph.py` (`/v1/life-graph`):

- `GET /v1/life-graph/workspace` → `build_workspace(personal_graph, real_recommendations)`:
  persisted nodes + provenance-tagged edges + recommendation→evidence→source lineage + impacted-
  domain hub edges. Empty model → empty workspace (no fabrication). Returns `metrics`
  (`totalNodes/Edges`, `avgConfidence`, `avgStrength`, `lastUpdated`).
- `POST /v1/life-graph/query-focus` → `query_focus(gemini, workspace, query)`: **real** semantic
  relevance — embeds the query and each node's text with the same 3072-dim model, scores by cosine,
  normalizes to the strongest match, drops weak noise (`rel > 0.15`), bounds cost at
  `_MAX_FOCUS_NODES = 120`. No embeddings / any error → `{}` (no highlight, never a guess).

This is the front door for the explainable 3D Life Graph: provenance + citations on every edge, and
the model is used _only_ to rank relevance, never to assert structure.

---

## 5. How propagation should work — design + what's NEW

Today the graph is **descriptive** (it draws what is). Propagation makes it **reactive** (it
computes what-moves-if). The mechanism reuses the existing edge model; only the traversal is NEW.

**Inputs that already exist:**

- typed edges with `confidence`/`strength` and `provenance` (`life_graph_workspace` edges,
  `life_graph_edges` rows);
- node confidence;
- Neo4j as the traversal engine (multi-hop, tenant-scoped);
- recommendations already declare `impacted_domains` → hub edges (the first, hand-authored form of
  propagation: rec `impacts` domain hub, `recommendation_lineage`).

**Risk/opportunity propagation (NEW) — proposed mechanism:**

1. Seed: a Risk/Opportunity node (or a life event) with a magnitude.
2. Traverse outgoing edges in Neo4j from the seed to connected goals/objectives/domain hubs,
   following only **real edges** (`persisted_edge`, then `shared_node` connections at reduced weight).
3. Attenuate along each hop: `effect(target) = effect(source) × edge.strength × decay^hops`. This
   reuses the existing `strength`/`confidence` already on every edge (persisted ≈ confidence,
   shared-node = 0.4) — no new weighting model needed.
4. Aggregate per goal/domain and surface as a _propagated impact_, tagged with the full edge path as
   its provenance (so it stays explainable, like every other edge).
5. Gate by confidence: below a threshold, surface as an _assumption/needs-data_ rather than an
   assertion — consistent with `my_life.py` provenance tiers and the validator's no-fabrication rule.

**What this needs that does not exist yet (NEW):**

- a `conflicts_with` / `competes_for` edge type for conflict detection;
- a propagation service (Neo4j traversal + attenuation) — none exists; impact is currently computed
  only inside a single decision workspace (`decision_graph.build`), not graph-wide;
- life-event ingestion + an event→affected-nodes recompute trigger;
- a household/multi-tenant graph shape for true household reasoning.

**What it can reuse (EXISTS), so it isn't a rewrite:**

- the one relation core (`derive_graph_relations`) shared by advisor + graph;
- Neo4j Query-API traversal with tenant isolation (`neo4j_client.rs`);
- edge `strength`/`confidence`/`provenance` already populated by `build_workspace`;
- recommendation `impacted_domains` hub edges as the prototype propagation path;
- the explainable endpoint to render propagated paths with citations.

---

## 6. Invariants the graph must preserve

1. **Real edges only.** If the advisor can't cite it, the graph can't draw it
   (`life_graph_workspace.py` shares `derive_graph_relations`; `advisor_validator._check_relationships`
   gates the advisor against `connected_pairs`).
2. **Every node/edge carries provenance + a citation** (`dataUsed`/`sourceTable`/`citationId`,
   `provenance` tag). Propagation results must too (the edge path).
3. **Tenant isolation in traversal.** Every Neo4j statement is `tenant_id`-filtered by construction
   (`neo4j_client.rs` `merge_cypher_for`/`delete_node`); propagation traversals must keep this.
4. **Three stores stay aligned.** The worker writes Supabase-canonical → Qdrant → Neo4j in one
   `process_upsert`; the graph reads Supabase as truth and uses Neo4j/Qdrant as indexes, never as a
   second source of truth.
5. **No invention on empty data.** Empty graph → empty workspace; no embeddings → no focus. Absence
   is shown honestly, never filled.
