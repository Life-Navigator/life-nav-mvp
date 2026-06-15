# GraphRAG Agent — Specification

> Agent specification. Specification only — no code, no prompts, no runtime. Inherits the shared contracts
> (`AGENT_FAILURE_BEHAVIOR.md`, `AGENT_CONFIDENCE_MODEL.md`, `AGENT_ESCALATION_MODEL.md`,
> `AGENT_INTERACTION_CONTRACTS.md`, `AGENT_OUTPUT_SCHEMAS.md`). **LIVE** over the 3-store: Neo4j edges (Aura
> Query API v2), Qdrant vectors, Supabase facts. Maps to `clients/neo4j_client`, `clients/qdrant`, and the
> `advisor_context` graph build; 3-store alignment is a measured integrity property.

---

## 1. Identity

- **Agent Name:** GraphRAG
- **Mission:** Retrieve the user's REAL knowledge — their actual graph edges and the vector-similar evidence —
  read-only and with provenance, so every downstream claim can be cited.
- **Purpose:** Be the retrieval authority across the 3-store: return label-resolved real edges, connections,
  `connected_pairs`, and vector-similar evidence (each with `source_table`), so the advisor can ground and
  cite. It enforces the citation contract at the source: **no cited edge ⇒ no claim.**
- **Primary Responsibilities:**
  1. Resolve and return the user's REAL edges (label-resolved) with `edge_confidence`.
  2. Return connections and `connected_pairs` between the user's real nodes.
  3. Return vector-similar evidence with `source_table` and `similarity`.
  4. Carry provenance on everything so claims can be cited (citation contract).
  5. Report confidence with its breakdown; when there are no edges, return empty (the advisor abstains).

---

## 2. Ownership

**Owns:**

- the user's retrieved real edges (label-resolved) + `edge_confidence`
- the connections + `connected_pairs` derived from real nodes
- the vector-similar evidence set (statement + `source_table` + `similarity`)
- the provenance attached to every retrieved item

**Does NOT own:**

- creating or persisting edges (projection from committed truth is a separate sync — see §8)
- the truth of facts (→ Supabase truth layer / writers via Tool Execution)
- recommendations (→ Recommendation Agent)
- user-facing language (→ Response Composer)
- calculations (→ Tool Execution)
- compliance verdicts (→ Compliance)

---

## 3. Boundaries (prohibited)

- Cannot invent nodes or edges — only what exists in the user's real graph.
- Cannot return an edge to an unknown node (every endpoint must resolve to a real node).
- Cannot persist edges — projection of edges from committed truth is a separate sync, not this agent.
- Cannot answer the user directly or call another agent directly.
- Cannot cross tenants — every retrieval is scoped to the JWT `user_id` (RLS / tenant filter).
- Cannot return an edge/evidence without provenance (`source_table`) — that would break the citation contract.
- When no edges exist, cannot synthesize one — it returns empty and the advisor abstains.

---

## 4. Inputs (allowed sources)

- Neo4j (Aura Query API v2) — the user's real edges (read; the legacy `/tx/commit` path is forbidden).
- Qdrant — vector-similar evidence (read).
- Supabase — the facts that nodes/evidence resolve back to (read).
- A typed retrieval request (the focus node(s)/query) from an agent, via the Orchestrator.
- The authenticated `UserContext` (JWT-derived `user_id`) for tenant scoping.

---

## 5. Outputs (schema)

Wrapped in the common envelope (`AGENT_OUTPUT_SCHEMAS.md`); the GraphRAG `payload`:

```json
{
  "edges": [{ "from": "", "to": "", "rel": "", "edge_confidence": 0.0, "source_table": "" }],
  "connections": [{ "node": "", "connected_to": [""] }],
  "connected_pairs": [{ "a": "", "b": "", "via": "", "edge_confidence": 0.0 }],
  "evidence": [{ "statement": "", "source_table": "", "similarity": 0.0 }]
}
```

Every edge resolves to real nodes and carries `edge_confidence` + `source_table`; every evidence item carries
`source_table` + `similarity`. No item lacks provenance. No edges ⇒ all arrays empty.

---

## 6. Cognitive Framework (how it reasons)

```
Step 1  Bind tenant            — take user_id from the JWT; scope every store query (RLS / tenant filter).
Step 2  Resolve labels         — resolve focus node(s) to real graph nodes; unknown node ⇒ no edge.
Step 3  Retrieve real edges    — query Neo4j (Aura Query API v2) for the user's actual edges.
Step 4  Build connections      — derive connections + connected_pairs from those real edges only.
Step 5  Retrieve vectors        — query Qdrant for similar evidence; attach source_table + similarity.
Step 6  Attach provenance      — every edge/evidence carries source_table + confidence/similarity.
Step 7  Empty-guard            — no real edges ⇒ return empty arrays (advisor will abstain).
Step 8  Report confidence      — per AGENT_CONFIDENCE_MODEL.md (edges → GC; vectors → similarity).
Step 9  Return read-only       — never create/persist edges; never claim; never author user text.
```

The agent **retrieves**; it never invents, never persists, never decides. It is the citation contract's
source of truth.

---

## 7. Tool Rules

- **Allowed:** read queries against Neo4j (Aura Query API v2), Qdrant, and Supabase, tenant-scoped.
- **Required:** `source_table` on every returned item; label resolution before any edge is returned; the
  Aura `/query/v2` path (the legacy `/tx/commit` is forbidden).
- **Forbidden:** any write/edge creation; returning an edge to an unknown node; any LLM call; calling another
  agent directly.

---

## 8. GraphRAG Rules

- **May:** return the user's real edges, connections, and `connected_pairs` (read-only) with provenance; this
  is the agent that _supplies_ the cited edges others rely on.
- **May not:** create, infer, or persist edges; return an edge to an unknown node; project edges from
  committed truth (that is a separate sync, not this agent). It enforces "no cited edge ⇒ no claim" at the
  source — if it returns nothing, no downstream agent may assert a relationship.

---

## 9. Memory Rules

- **Can access:** the user's real graph (Neo4j), vectors (Qdrant), and the facts they resolve to (Supabase),
  all read-only, all tenant-scoped. It is the supplier feeding Memory's bounded-context edge set.
- **Cannot access:** another tenant's graph/vectors/facts, raw secrets, or anything beyond read. It never
  writes or persists.

---

## 10. Confidence Model

Uses the global formula (`AGENT_CONFIDENCE_MODEL.md`) with GraphRAG weights (retrieval quality — edges carry
`edge_confidence`, vectors carry `similarity`):

| Weight                   | Value | Rationale                                                                |
| ------------------------ | ----- | ------------------------------------------------------------------------ |
| wGC (graph)              | 0.40  | the core output is real edges; their mean confidence dominates           |
| wEC (evidence coverage)  | 0.30  | vector evidence must actually back what's returned (similarity-weighted) |
| wPQ (provenance quality) | 0.20  | every item carries `source_table`; resolved-node provenance > weak match |
| wDC (data completeness)  | 0.10  | how much of the requested neighborhood was retrievable                   |
| wTA (tool availability)  | N/A   | uses read stores, not deterministic calculators                          |

`confidence = renormalize(0.40·GC + 0.30·EC + 0.20·PQ + 0.10·DC)` with TA dropped (N/A), and GC dropped when
no edges are returned (then it is a vectors-only retrieval). No `success` below 0.75; no edges + no evidence
⇒ empty result, `needs_data` (advisor abstains) rather than a synthesized connection.

---

## 11. Escalation Rules (via Orchestrator)

| Trigger                                                  | → To                                                  |
| -------------------------------------------------------- | ----------------------------------------------------- |
| A focus node cannot be resolved to a real node           | `needs_data` (the node/fact is missing)               |
| A store (Neo4j/Qdrant/Supabase) is unreachable           | `blocked`                                             |
| 3-store alignment integrity check fails (counts diverge) | `blocked` + flag (do not return stale edges as truth) |
| Caller needs facts the graph references                  | Memory / Supabase (read)                              |

GraphRAG is a leaf retrieval provider; it rarely escalates ownership. It never self-escalates, never invents
to fill a gap, and never resolves domain meaning.

---

## 12. Failure Behavior

Standard states (`AGENT_FAILURE_BEHAVIOR.md`):

- `success` — real edges + connections + vector evidence retrieved with provenance.
- `needs_data` — no real edges/evidence for the request (return empty; the advisor abstains).
- `needs_confirmation` — N/A (GraphRAG retrieves committed graph state; it doesn't propose candidates).
- `blocked` — a store is unreachable, or the 3-store alignment integrity check fails.
- `escalated` — rare; only read referrals.
- `compliance_rejected` — set after the gate (e.g. an item returned without `source_table`).
  No guessing — no edge means an empty result, never a synthesized relationship; this is the citation contract.

---

## 13. Compliance Requirements

- Citation contract at the source: every returned edge is real and carries `source_table` — "no cited edge ⇒
  no claim" is enforced here, so downstream agents cannot over-claim a relationship.
- Real-nodes-only: no edge to an unknown node; no invented node/edge.
- Provenance on every item (`source_table`, `edge_confidence`/`similarity`).
- No persistence (edge projection is a separate sync); tenant isolation (RLS / tenant filter).
- 3-store alignment is an integrity property — divergence blocks rather than returns stale edges as truth.

---

## 14. Example Scenarios

**Positive (5):**

1. User with a real home↔savings edge → returns the edge with `edge_confidence` + `source_table` → advisor
   may cite it → `success`.
2. Query for connections around a goal node → returns `connected_pairs` from real edges only → `success`.
3. Vector query → returns evidence statements with `source_table` + `similarity` → claims can be cited.
4. Mixed retrieval → real edges + similar evidence, all with provenance, tenant-scoped → `success`.
5. Aligned 3-store (Supabase = Neo4j = Qdrant counts) → high GC/EC retrieval → `success`.

**Negative (5) — must NOT happen:**

1. Inventing a "your career connects to your retirement" edge with no real edge (→ forbidden; citation contract).
2. Returning an edge whose endpoint node doesn't exist (→ forbidden; real-nodes-only).
3. Creating or persisting an edge (→ forbidden; projection is a separate sync).
4. Returning an evidence item with no `source_table` (→ forbidden; breaks citation).
5. Returning another tenant's edges via an unscoped query (→ RLS violation).

**Edge cases (5):**

1. Focus node has zero real edges → return empty; `needs_data`; advisor abstains (no synthesized connection).
2. Neo4j up but Qdrant down → return edges, omit vector evidence, note the gap.
3. 3-store counts diverge (alignment integrity fails) → `blocked` + flag; don't serve possibly-stale edges as truth.
4. Label resolves to two candidate nodes → return both as candidates' edges with provenance; don't pick one silently.
5. Aura legacy `/tx/commit` attempted → forbidden; only `/query/v2` is used.

---

## 15. Unit Test Matrix

| Class       | Test                        | Expected                                                                       |
| ----------- | --------------------------- | ------------------------------------------------------------------------------ |
| Happy path  | user with real edges        | `success`; edges + connected_pairs with `edge_confidence` + `source_table`     |
| Happy path  | vector query                | evidence with `source_table` + `similarity`; claims citable                    |
| Empty       | no real edges               | `needs_data`; empty arrays; advisor abstains; nothing synthesized              |
| Citation    | unknown-node edge           | rejected; no edge to an unresolved node returned                               |
| Citation    | item without `source_table` | rejected; provenance mandatory                                                 |
| Block       | a store unreachable         | `blocked`; safe fallback; no stale edges as truth                              |
| Integrity   | 3-store counts diverge      | `blocked` + flag; alignment is an enforced property                            |
| Security    | cross-tenant query          | only JWT `user_id` graph returned (RLS / tenant filter)                        |
| Persistence | any retrieval               | read-only; never creates/persists an edge                                      |
| Confidence  | components present          | GC/EC/PQ/DC (TA n/a; GC n/a if vectors-only) + explanation; no `success` <0.75 |
