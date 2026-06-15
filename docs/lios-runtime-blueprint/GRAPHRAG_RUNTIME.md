# LIOS GraphRAG Runtime

> **Implementation planning only — no code, no runtime change, no deploy, no Gemini wiring, no beta
> change.** This doc maps today's **live** graph retrieval (the graph build inside `advisor_context.py`
>
> - the Neo4j/Qdrant clients) to the LIOS retrieval pipeline (Stage [3]) defined in
>   `docs/lios-execution-architecture/GRAPHRAG_RETRIEVAL_MODEL.md`. Paths are relative to
>   `apps/lifenavigator-core-api/` unless noted. It answers, per component: **where it lives today · what
>   owns it · what must change · what must NOT change.**
>
> Cardinal invariants (carried unchanged): GraphRAG is **read-only**; the **citation contract** ("no
> cited edge ⇒ no claim") is sacrosanct; **no edge fabrication**; **empty-graph abstain**; every query is
> **tenant-scoped** to the JWT `user_id`.

---

## 1. Where graph retrieval lives today

| LIOS piece                          | Lives today in                                                                                                                                                                                                                                                                                                            | Owns                                                                                                                                                                                                                                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Personal-graph build (the read)** | `app/services/life_discovery.py:578 LifeDiscoveryService.personal_graph`                                                                                                                                                                                                                                                  | assembles nodes+edges from **persisted** Supabase data only: active `life_objectives`, `life_graph_edges` (`:588`, filtered `status=="active"`), and domain-hub edges synthesized from real Family/Career/Education/Health CRUD entities (`:598-644`). No edges → empty.                                    |
| **Edge derivation / citation prep** | `app/services/advisor_context.py:67 derive_graph_relations`, `:116 build_relationships`                                                                                                                                                                                                                                   | turns raw edges into `relationship_edges` (label-resolved real edges, `:130-140`), `connections` (real 2-hop primary links, `:142-155`), and **`connected_pairs`** (`frozenset` pairs the validator gates claims against, `:131,:140,:150`). "Computed from persisted edges only — never inferred." (`:76`) |
| **Context wiring**                  | `advisor_context.py:267 AdvisorContextBuilder._relationships` (calls `personal_graph`, `:272`), `:288 build` (gathers edges concurrently, `:296-298`), `AdvisorContext` fields `relationship_edges/connections/connected_pairs` (`:184-186`), `prompt_dict` exposes `relationship_edges`+`graph_connections` (`:220-221`) | the only graph context the LLM ever sees                                                                                                                                                                                                                                                                    |
| **Neo4j client**                    | `app/clients/neo4j.py:24 Neo4jClient` (`query_personal:46`, `ready:77`)                                                                                                                                                                                                                                                   | Aura Query API v2 (`/db/{db}/query/v2`, `:62`); **every** statement filtered `tenant_id = $user_id` (binds it always, `:61`); refuses empty `user_id` (`:57-58`); degrades on error (`:74`)                                                                                                                 |
| **Qdrant client**                   | `app/clients/qdrant.py:32 QdrantClient` (`search_personal:52`, `build_personal_filter:19`, `ready:93`)                                                                                                                                                                                                                    | user-scoped vector search; filter binds both `tenant_id` and `user_id` (`:24-25`); refuses empty `user_id` (`:21-22`); returns `[]` on any error (`:60-61,:74`)                                                                                                                                             |
| **3-store integrity**               | `life_discovery.py:651 _graph_integrity` (per-domain completeness from REAL data presence; `personal_graph` attaches it `:645-647`)                                                                                                                                                                                       | honest "what's actually present" signal (absent data → 0, `:653`)                                                                                                                                                                                                                                           |
| **Citation enforcement (the gate)** | `app/services/advisor_validator.py:107 _check_relationships`, `:40 _asserts_goal_relationship`, `:89 _pair_supported`                                                                                                                                                                                                     | rejects any cited relationship not in `connected_pairs`; rejects an asserted relationship with no backing edge; rejects all relationship claims when the graph has no edges (`:111-131`)                                                                                                                    |

> Note (live reality): the **read path that feeds the advisor today is Supabase-backed**
> (`personal_graph` reads `life_graph_edges` + domain CRUD). The `Neo4jClient`/`QdrantClient` are present,
> tenant-scoped, and used by the ingestion/projection side; their query surfaces are the seam LIOS will
> formalize into retrieval plans. The 3-store-alignment invariant governs how those reads must reconcile.

---

## 2. Retrieval PLANS — when to query, when to skip

Today retrieval is **unconditional**: `AdvisorContextBuilder.build` always calls `_relationships`
(`advisor_context.py:296-298`) regardless of the message; if there are no edges the lists come back empty
and the prompt simply carries empty arrays. There is no "skip" decision.

**LIOS target (Stage [3] plan, additive):** a deterministic `graph_required` boolean (written by Stage [2],
`GRAPHRAG_RETRIEVAL_MODEL.md` §2) decides query vs. skip _before_ the read:

- **QUERY** iff a claim will rest on a relationship — goal↔goal, evidence→source, a cross-domain decision
  link, the Goal-Conflict path, or a ≥2-domain decision (`GRAPHRAG_RETRIEVAL_MODEL.md` §3).
- **SKIP** (`graph_required=false`) for **single-fact lookups** — "what's my net worth", "what's my 401k
  balance", "list my goals" — the number comes from Tool Execution/Memory and asserts no edge
  (`GRAPHRAG_RETRIEVAL_MODEL.md` §4). "Silence is cheaper than a no-op call."

The live validator already encodes the _consumer_ side of this distinction: `_asserts_goal_relationship`
(`advisor_validator.py:40`) only fires when the text links two of the user's goals — a single-fact answer
trips no relationship gate. The LIOS plan moves that decision **upstream** (skip the read entirely) instead
of always reading and discarding.

- **What must change:** introduce `graph_required` and gate the `_relationships` read on it (proposed
  `services/lios/graphrag_runtime.py`, `TARGET_RUNTIME_ARCHITECTURE.md` §4).
- **What must NOT change:** that an empty result yields **no** relationship claim (the validator already
  guarantees this, `advisor_validator.py:127-129`).

---

## 3. Evidence packaging (statement + source_table)

A GraphRAG payload carries two kinds of provenance (`GRAPHRAG_RETRIEVAL_MODEL.md` §8 outputs):
**edges** (relationship provenance) and **evidence** items (`{statement, source_table, similarity}` from
vector hits). Today the edge side is fully realized — every edge resolves to real nodes and carries a
`rel`+`confidence` and traces to its `source_table` of origin (`life_graph_edges` or a domain hub,
`life_discovery.py:642-644`). The `{statement, source_table}` **evidence** shape is exactly the one
RecommendationOS already consumes (`recommendations_os.py` evidence items, e.g. `:292`), so the contracts
align.

**LIOS mapping:** the retrieval runtime packages each retrieved item as evidence with its originating
`source_table` (Neo4j edge → `source_table` of the projected edge; Qdrant hit → its payload `source_table`

- `similarity`). An item missing `source_table` is `compliance_rejected` — no provenance would break the
  citation contract (`GRAPHRAG_RETRIEVAL_MODEL.md` §7,§8). Read-only: GraphRAG never creates/persists/infers
  an edge (`qdrant.py` returns hits only; `neo4j.py:46 query_personal` reads only).

---

## 4. Citation packaging (real edges + connected_pairs → relationships_referenced)

This is the live citation spine and **must not change**:

- `build_relationships` (`advisor_context.py:116`) produces `relationship_edges` (label-resolved real edges)
  and `connected_pairs` (the `frozenset({norm(a),norm(b)})` set, `:131,:140,:150`) — 2-hop primary links are
  citable too (`:150`). Bounded for the prompt: `relationship_edges[:40]`, `connections[:15]` (`:158`).
- The LLM may cite a relationship only by emitting `relationships_referenced`. The validator
  `_check_relationships` (`advisor_validator.py:107`) keeps only citations that are **real connected pairs**
  (`_pair_supported:89` against `context.connected_pairs:118`), drops the rest (`:124-125`), and rejects an
  asserted-but-uncited relationship (`:127-131`).
- The accepted, real cited edges become `safe["relationships_referenced"]` (`advisor_validator.py:195`),
  which the orchestrator records into telemetry: `tr["relationships_referenced"]` and the response
  (`advisor_orchestrator.py:158-162`), alongside `graph_edges_available = len(relationship_edges)` (`:134`).

**LIOS mapping:** the retrieval runtime emits `edges[]` + `connected_pairs[]` + `connections[]` (the Stage
[3] output, `GRAPHRAG_RETRIEVAL_MODEL.md` §8). `connected_pairs` remains the gate key feeding
`relationships_referenced`. **No edge fabrication**: the only citable edges are the persisted/projected ones
(`advisor_context.py:76` "never inferred"; a `proposed`/uncited edge is not citable —
`GRAPHRAG_RETRIEVAL_MODEL.md` §6).

- **What must NOT change:** the `connected_pairs` → `relationships_referenced` flow; the
  `_check_relationships` drop/reject rules; the persisted-edges-only rule.

---

## 5. Confidence packaging (edge_confidence → GC component)

Every edge already carries a `confidence` (`life_discovery.py:642`; surfaced into `relationship_edges`
`advisor_context.py:138` and `connections` `:152`). The LIOS confidence model uses the cited edges'
`edge_confidence` as the asserting agent's **GC** (Graph-confidence) component: GC = mean of cited
`edge_confidence`; GC is **N/A (renormalize)** when no edge is cited; the global formula is
`renormalize(0.40·GC + 0.30·EC + 0.20·PQ + 0.10·DC)` (`GRAPHRAG_RETRIEVAL_MODEL.md` §7,§8; no `success`
below 0.75).

**LIOS mapping:** the retrieval runtime returns each edge's `edge_confidence`; the downstream asserting
agent (Goal Conflict / Decision Scientist / Advisor) computes GC from the cited subset. When the turn makes
no graph claim, GC drops and the weights renormalize — matching today's behavior where an edge-free turn
carries no relationship confidence at all.

- **What must change:** formalize GC from `edge_confidence` in the confidence model (today `confidence` is a
  single scalar in the turn record, `advisor_orchestrator.py:115`).
- **What must NOT change:** edge confidence is a property of the real edge, never invented.

---

## 6. The 3-store alignment (Supabase = Neo4j = Qdrant)

A relationship is valid only if all three stores agree; on divergence GraphRAG must **block + flag**, never
serve possibly-stale edges as truth (`GRAPHRAG_RETRIEVAL_MODEL.md` §7; invariant 7). Today the integrity
signal is `_graph_integrity` (`life_discovery.py:651`), which scores per-domain completeness from real data
presence and attaches it to `personal_graph` (`:645-647`). The Neo4j/Qdrant clients each enforce tenant
scope independently (`neo4j.py:61`, `qdrant.py:24`) but there is **no live cross-store count reconciliation
in the read path** — that is the gap LIOS closes.

**LIOS mapping:** the retrieval runtime adds a deterministic alignment check (counts/ids across
Supabase ↔ Neo4j ↔ Qdrant for the tenant). Agreement → serve edges; divergence → `blocked` + flag (branch
degrades, deterministic floor still answers — never the user). Store unreachable → `blocked` likewise
(`GRAPHRAG_RETRIEVAL_MODEL.md` §6 table). This sits **outside** the advisor turn's critical path so a drift
never fails the user.

- **What must change:** add the cross-store reconciliation gate before serving edges as citable.
- **What must NOT change:** read-only; tenant scope on every store (the clients already refuse empty
  `user_id`); "never serve stale edges as truth."

---

## 7. Read-only, tenant-scoped, empty-graph abstain

- **Read-only:** `personal_graph`/`derive_graph_relations` compute from persisted truth only
  (`advisor_context.py:76`); `Neo4jClient.query_personal` and `QdrantClient.search_personal` read only;
  projection of new edges is a separate worker sync (`CURRENT_STATE_AUDIT.md` §4 "Neo4j written by the
  ingestion worker (projection)").
- **Tenant-scoped:** every store query binds the JWT `user_id` — Neo4j always binds `tenant_id=$user_id`
  (`neo4j.py:61`) and refuses empty (`:57`); Qdrant filters `tenant_id`+`user_id` (`qdrant.py:24`) and
  refuses empty (`:21`). Cross-tenant retrieval is forbidden.
- **Empty-graph abstain:** when the graph has no edges, `relationship_edges`/`connections`/`connected_pairs`
  are empty and the validator forbids any relationship claim (`advisor_validator.py:127-129` — "relationship
  mentioned but the user's graph has no edges"). The **turn continues single-entity**; only the _claim_ is
  dropped (`GRAPHRAG_RETRIEVAL_MODEL.md` §6).

---

## 8. Invariants this runtime must preserve (the must-NOT-change list)

1. **No cited edge ⇒ no claim** — enforced at the source (empty payload ⇒ no relationship claim) and at the
   gate (`advisor_validator.py:107-131`).
2. **No edge fabrication** — only persisted/projected edges are citable; `proposed`/inferred edges are not
   (`advisor_context.py:76`; `GRAPHRAG_RETRIEVAL_MODEL.md` §6).
3. **Query when a relationship/evidence/cross-domain claim is possible; skip single-fact lookups.**
4. **Missing edge ⇒ the claim is dropped (abstain); the turn continues single-entity.** Empty graph ⇒ zero
   relationship claims.
5. **Read-only, tenant-scoped, provenance on every item** (`source_table`+`edge_confidence` on edges;
   `source_table`+`similarity` on evidence); `user_id` from JWT on every store query.
6. **`edge_confidence` feeds GC; GC is N/A (renormalize) when no edge is cited.**
7. **3-store divergence blocks rather than serving stale edges as truth.**
8. **Failure degrades the branch, never the turn** — the deterministic floor always answers
   (`CURRENT_STATE_AUDIT.md` §7.1).

> Bottom line: the live system already builds the personal graph from persisted truth, packages real edges
> into `connected_pairs`, and enforces the citation contract in the validator. LIOS GraphRAG is an
> **additive retrieval-plan layer** (query/skip decision + cross-store alignment gate + GC packaging) over
> that existing build — read-only, tenant-scoped, with no edge fabrication and empty-graph abstain
> preserved exactly as they are today.
