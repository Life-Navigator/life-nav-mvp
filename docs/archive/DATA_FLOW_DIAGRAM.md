# LIOS — Data Flow

> How data enters, becomes truth, gets retrieved, becomes a response, and gets observed. Companion to
> `LIOS_ARCHITECTURE.md` and `TRUTH_AND_PROVENANCE_MODEL.md`. Architecture only — no code.

---

## 1. The four data planes

| Plane                | Store                      | What it holds                                                                               | Authority                 |
| -------------------- | -------------------------- | ------------------------------------------------------------------------------------------- | ------------------------- |
| **Relational truth** | Supabase (Postgres + RLS)  | the canonical facts: profile, goals, finance, family, documents, recommendations, analytics | **system of record**      |
| **Personal graph**   | Neo4j (Aura, Query API v2) | the user's entities + real relationships (goal↔goal, evidence→source)                       | derived from truth; cited |
| **Vectors**          | Qdrant                     | embeddings of evidence/docs for semantic retrieval                                          | derived; retrieval only   |
| **Telemetry**        | Supabase `analytics`       | per-turn agent decisions + rollups                                                          | observability             |

> Invariant: the three knowledge stores stay **aligned** (Supabase = Neo4j = Qdrant). Supabase is the source
> of truth; the graph and vectors are projections of it, each carrying provenance back to the relational row
> or source document.

Tenancy: every store is partitioned by `user_id`, derived from the verified JWT — **never** from a request
body. Supabase enforces this with RLS (`auth.uid() = user_id`); writers set `user_id` from the token.

---

## 2. Ingestion → Truth → Knowledge (write path)

```
                         INGESTION SOURCES
   ┌───────────────┬──────────────────┬───────────────────┬──────────────────┐
   │ user messages │ uploaded docs    │ connected accounts│ persona/sandbox  │
   │ (advisor chat)│ (statements,etc.)│ (Plaid finance)   │ (beta fixtures)  │
   └───────┬───────┴────────┬─────────┴─────────┬─────────┴────────┬─────────┘
           │                │                   │                  │
           ▼                ▼                   ▼                  ▼
   ┌───────────────┐ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
   │ Advisor /     │ │ Document     │  │ Finance      │  │ persona      │
   │ Goal Discovery│ │ Intelligence │  │ ingest       │  │ loader       │
   │ → CANDIDATE   │ │ → extract +  │  │ → accounts/  │  │ → labeled    │
   │   facts/goals │ │   fields     │  │   balances   │  │   sandbox    │
   └───────┬───────┘ └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
           │  (proposals, with provenance + confidence)         │
           └───────────────┬───────────────────────────────────┘
                           ▼
                ┌─────────────────────────┐
                │  USER TRUTH LAYER        │   proposed → validated → confirmed → persisted
                │  (Supabase, provenance)  │   (see TRUTH_AND_PROVENANCE_MODEL.md)
                └───────────┬─────────────┘
                            │  APPROVED WRITERS ONLY
        ┌───────────────────┼───────────────────────┐
        ▼                   ▼                       ▼
 ┌──────────────┐   ┌──────────────┐        ┌──────────────┐
 │ RelationshipMgr│  │ RecommendationOS│      │ domain writers│
 │ (goals/vision) │  │ (recs: evidence-│      │ (finance/family│
 │                │  │  or-nothing)    │      │  /docs/...)    │
 └──────┬───────┘   └──────┬─────────┘        └──────┬───────┘
        └──────────────────┼───────────────────────┘
                           ▼  projection (with provenance)
              ┌────────────────────────────────┐
              │  GraphRAG sync: Neo4j + Qdrant  │  (3-store alignment, worker)
              └────────────────────────────────┘
```

**Rules on the write path:**

- The LLM produces **candidates/proposals only** — it never writes. (Advisor, Goal Discovery, Document
  extraction.)
- Only **approved writers** touch Supabase: `RelationshipManager` (goals/vision/discovery),
  `RecommendationOS.write` (recommendations — refuses to write without evidence), and the domain writers.
- Every write sets `user_id` from the JWT and records **provenance** (source + type + confidence + time).
- Graph + vectors are **projections** synced after the relational write, each edge/vector carrying a
  pointer back to its source row/document.

---

## 3. Retrieval → Reasoning → Response (read path)

```
   request (user_id from JWT)
        │
        ▼
 ┌──────────────────┐     reads (parallel, read-only)
 │ Memory / Context │ ───┬──▶ Supabase truth (facts, goals, discovery scores)
 │ (AdvisorContext) │    ├──▶ Neo4j (real edges → connected pairs)
 │                  │    ├──▶ Qdrant (semantic evidence)
 │                  │    └──▶ Document Intelligence (cited fields)
 └────────┬─────────┘
          │ bounded guardrail context: allowed_numbers, real edges, classified facts,
          │ discovery scores, domain priorities, rejected goals, safety constraints
          ▼
 ┌──────────────────┐
 │ LLM agent(s)     │  reason within the context ONLY (numbers/edges must be present to be used)
 └────────┬─────────┘
          ▼
 ┌──────────────────┐
 │ Compliance gate  │  accept / repair / reject  (anti-fabrication + safety)
 └────────┬─────────┘
          ▼
 ┌──────────────────┐
 │ Response Composer│  merge validated text with deterministic outcomes
 └────────┬─────────┘
          ▼
   governed response ───▶ surface          (and ▼)
                                  ┌──────────────────┐
                                  │ Audit / telemetry │ analytics.advisor_turns (+ metrics)
                                  └──────────────────┘
```

**Rules on the read path:**

- The bounded context is the **only** thing the LLM may reason from. If a number isn't in `allowed_numbers`
  or an edge isn't in the graph, the LLM may not use it — and Compliance enforces this after the fact.
- Reads are tenant-scoped and parallelized (the context build runs its independent reads concurrently).
- Nothing on the read path writes to the systems of record (telemetry is the only write, and it's
  observability, not truth).

---

## 4. Approved save paths (the only ways data is persisted)

| Save path                    | Writes                                                            | Precondition                               | Provenance set                               |
| ---------------------------- | ----------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------- |
| `RelationshipManager`        | goals, vision, primary objective, rejected goals, discovery state | user-stated/confirmed in conversation      | `user_stated` / `user_confirmed`             |
| `RecommendationOS.write`     | recommendations (ACTION/RISK/OPPORTUNITY/DEPENDENCY/INFORMATION)  | **non-empty evidence** (else returns null) | `calculated` + evidence `source_table`       |
| Document Intelligence writer | `documents`, `document_fields`, doc graph nodes                   | a real uploaded document                   | `on-record` / `document` + source doc        |
| Finance/domain writers       | domain rows (accounts, members, etc.)                             | typed, validated input                     | `on-record` (Plaid) / `user_stated` (manual) |
| GraphRAG sync                | Neo4j edges, Qdrant vectors                                       | a committed relational write               | inherits source provenance                   |
| Audit                        | `analytics.advisor_turns`                                         | end of a turn (best-effort, non-blocking)  | n/a (telemetry)                              |

**Forbidden everywhere:** an LLM-initiated write; a write without `user_id` from the JWT; a recommendation
without evidence; a graph edge without a source; a confirmed fact created from an unconfirmed extraction.

---

## 5. The fact's journey (one example: "I have $60k saved")

```
1. User says it in chat
2. Advisor proposes candidate_fact {label:"savings", value:"$60k", source:"user_message", conf:0.9}
3. Compliance: keeps it (source==user_message), forces should_persist=false
4. It is shown back / used in-session (allowed_numbers now includes "60")  ← in-session truth
5. On confirmation → RelationshipManager persists it (provenance user_confirmed)
6. GraphRAG sync projects it: a fact node + edge, provenance → the confirmation
7. Later retrieval: Memory/Context surfaces it with provenance; Advisor may reflect "$60k" (it's allowed)
8. Reports/dashboard render it with a ProvenanceBadge ("On-record"/"Confirmed")
```

Until step 5, it is **session/candidate** truth, not persisted. The number is usable in-conversation
(allowed) but isn't a stored fact until confirmed.

---

## 6. Telemetry data flow (observability is its own plane)

```
every agent turn ─▶ Orchestrator builds telemetry envelope
   {turn_id, user_id, llm_status, validator_result, repairs, fallback_reason,
    stages_ms{...}, tokens, graph_edges_available, relationships_referenced,
    confidence, (content: message/response/raw — service-role table only)}
        │
        ├─▶ structured log line (METADATA ONLY — no PII content to app logs)
        └─▶ analytics.advisor_turns  (service-role RLS; full content for diagnostics)
                 └─▶ analytics.advisor_turn_metrics (30-day rollup)
                        └─▶ GET /v1/admin/advisor-metrics (admin only)
```

LLM token spend additionally flows to the cost meter (`ops.llm_usage_meter`). Telemetry **never** blocks the
request and **never** leaks content to application logs.

---

## 7. Privacy & boundaries in data flow

- **Tenant isolation:** every read/write keyed by JWT `user_id`; Supabase RLS enforces it; the LLM only ever
  sees one user's bounded context.
- **Key boundary:** the generation/embedding model is called **only** from the Fly backend; the model API
  key is never present in the Vercel/frontend environment.
- **Content vs metadata:** message/response/raw LLM output live only in the service-role `advisor_turns`
  table; application logs carry metadata only.
- **No mock data:** every surface renders real data or an honest empty state; sandbox/persona data is
  explicitly labeled as such.

---

## 8. Live vs planned

- **Live:** the advisor read path + context build + Compliance + telemetry; document → truth extraction;
  finance ingest; RecommendationOS evidence-or-nothing; 3-store projection; provenance on Life Model.
- **Planned:** a unified, typed "save-path registry" enforcing the table in §4 across all domains; explicit
  per-turn GraphRAG retrieval-set logging (node/edge/doc ids) on the turn record; confidence threading from
  every domain into the turn telemetry.
