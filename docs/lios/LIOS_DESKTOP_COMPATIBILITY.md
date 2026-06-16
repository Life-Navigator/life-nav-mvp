# LIOS Phase 10 — Desktop Compatibility (Tauri)

**Status legend:** `EXISTS` (built today) · `PARTIAL` (a strong existing component that ports with
work) · `NEW` (roadmap, not yet built).

**Headline — honest:** Phase 10 is **mostly `NEW`/roadmap.** There is no desktop app today. But the
current architecture makes desktop _tractable rather than a rewrite_, for three concrete reasons:

1. **Model independence is already real** (see `LIOS_MODEL_INDEPENDENCE.md`). Swapping cloud models for
   a local model (Ollama/llama.cpp) is a **registry config change + one adapter** behind the existing
   `AdvisorLLM` Protocol — not a re-architecture.
2. **The document-intelligence ingestion worker is already a native Rust binary** with no cloud-only
   dependencies in its core — it is the single best-fit component for a Tauri sidecar.
3. **The data model is portable.** The ontology, the typed life graph, and the canonical Supabase
   schemas are declarative and provider-neutral; they port to local stores without semantic change.

---

## 1. Target Tauri Architecture · `NEW`

```
┌─────────────────────────────────────────────────────────────────────┐
│  Tauri Desktop App                                                    │
│                                                                       │
│  ┌─────────────────────────┐      ┌──────────────────────────────┐   │
│  │  WebView (frontend)      │ IPC  │  Rust core (tauri::command)  │   │
│  │  reuse apps/web React UI │◄────►│  + sidecar processes         │   │
│  └─────────────────────────┘      └───────────┬──────────────────┘   │
│                                                │                      │
│   ┌───────────────┬───────────────┬───────────┼──────────────────┐   │
│   ▼               ▼               ▼            ▼                  ▼   │
│ Local graph   Local vector   Local memory  Ingestion worker  Local   │
│ (SQLite +     (sqlite-vec /  (SQLite)      (REUSE Rust       model    │
│  graph lib)    local embed)                 binary, sidecar) (Ollama/ │
│                                                              llama.cpp)│
│   └───────────────┴───────────────┴────────────┴─────────────────┘   │
│                            │                                          │
│                     Sync engine ◄────────────► Cloud (Supabase/      │
│                  (CRDT / LWW by provenance)     Neo4j/Qdrant/Core-API)│
└─────────────────────────────────────────────────────────────────────┘
```

- **Frontend:** reuse the existing Next.js/React UI (`apps/web`) inside the Tauri WebView. UI calls go
  to a **local Core-API contract** instead of the Fly-hosted FastAPI. Status: `NEW` (the React app
  `EXISTS`; the local binding is new).
- **Rust core:** Tauri commands + sidecars. The biggest sidecar — the ingestion worker — already
  exists as a Rust binary (`apps/ingestion-worker`).
- **Local Core-API:** the FastAPI orchestration tier (`apps/lifenavigator-core-api`) either runs
  bundled as a local server, or its orchestration logic is invoked directly. `NEW`.

---

## 2. Local Ontology · `PARTIAL`

`apps/ingestion-worker/src/ontology.rs` is the executable ontology registry — _"the single source of
truth, in code, for which typed Neo4j relationships each entity emits."_ It is **pure declarative Rust
data** (the `Domain` enum, `EntityType`, `EdgeFrom`, incoming-edge rules). It has **no cloud
dependency** — it just describes the shape of the graph.

- **Ports as-is** into the desktop Rust core. The edge-emission rules are agnostic to whether the
  target store is Aura/Neo4j or a local graph.
- `NEW` work: point `merge_cypher_for` at a local graph backend (below). The ontology _rules_ don't
  change; only the store they write to does.

---

## 3. Local Graph · `NEW` (ports from existing schema)

Today the typed life graph lives in **Neo4j Aura** (personal + central collections; see
`processor.rs`). For desktop:

- **Store:** SQLite + a local graph layer. Options: encode nodes/edges as SQLite tables with recursive
  CTEs for traversal, or embed a local graph engine (e.g. KùzuDB / an in-process Cypher-ish lib).
- **Why it ports:** the graph is _defined by_ `ontology.rs` (node labels, typed edges, tenant
  scoping). The semantics — `(target)-[rel]->(node)`, tenant-scoped MERGE, FK-sourced edges only when
  the field is present (never fabricated) — are store-independent invariants that re-implement against
  any backend.
- **Tenant safety carries over:** in single-user desktop mode there is one tenant; the existing
  _"every edge's target node is MERGEd under the same tenant_id as the source"_ rule becomes trivially
  satisfied, but the code path is unchanged.

---

## 4. Local Memory · `NEW` (schema ports)

Memory and conversational state are persisted in Supabase today (`advisor_turns`, discovery/coverage
tables, the `MemoryAgent` in `app/agents/memory.py`). For desktop:

- **Store:** the same relational shapes in local SQLite. The `MemoryAgent` interface stays; only its
  backing client swaps from `SupabaseClient` to a local SQLite client.
- **Why it ports:** these are ordinary relational tables with no Postgres-only features in the hot
  path; RLS (the multi-tenant security layer) collapses to "single local user," so the policies become
  unnecessary rather than blocking.

---

## 5. Local Vector Search · `NEW` (interface ports)

Today: Qdrant (personal + central), embeddings via `GeminiClient` (`gemini-embedding-001`) in the Rust
worker and the `Retriever`. For desktop:

- **Store:** `sqlite-vec` (or `usearch`/`hnswlib`) for the index.
- **Embeddings:** a **local embedding model** (e.g. a small sentence-transformer via `candle`/ONNX in
  the Rust worker, or an Ollama embedding model). This is the embedding analogue of the model-registry
  swap — the `Retriever`'s embedding call goes through one client, so it becomes a config/adapter swap,
  not a rewrite. (Noted as a gap in `LIOS_MODEL_INDEPENDENCE.md` §6: an embedding registry mirroring
  `MODELS` is the clean form.)
- **Why it ports:** the worker already abstracts the vector store behind `QdrantClient`; a
  `LocalVectorClient` with the same upsert/search surface drops in.

---

## 6. Local Document Intelligence · `PARTIAL` — **strongest existing fit**

**This is the component most ready for desktop.** `apps/ingestion-worker` is a self-contained **Rust
binary** that does the Document Intelligence pipeline: parse → normalize (`normalizer.rs`) → extract
entities (`entities.rs`) → embed + write to Qdrant + Neo4j (`processor.rs`), driven by the declarative
`ontology.rs` registry.

- **It is already native, fast, and dependency-light.** Its Cargo deps are `tokio`, `reqwest`
  (rustls), `serde`, `regex`, `uuid`, `chrono` — all cross-platform, no glibc-only or cloud-SDK
  lock-in. The release profile already strips and LTO-thins the binary.
- **Tauri fit:** ship it as a **Tauri sidecar** (or compile its logic into the Tauri Rust core
  directly). Documents are processed **entirely on-device** — the privacy story writes itself.
- `NEW`/`PARTIAL` work: (a) swap the LLM-extraction calls (`gemini_client.rs`) to a local model
  endpoint; (b) swap `qdrant_client.rs` / `neo4j_client.rs` to the local stores from §3/§5. The
  pipeline orchestration in `processor.rs` and all of `ontology.rs`/`normalizer.rs`/`entities.rs` stay.

---

## 7. Local Model Routing · `PARTIAL` → `NEW` adapter

Because of Phase 9, this is the **easiest** big piece. The `AdvisorLLM` Protocol +
`model_registry.MODELS` + `_llm_factory` already make the model a swappable config:

- Add a `LocalAdvisorLLM` adapter (Ollama HTTP API or llama.cpp server) implementing the same
  `async generate(context, plan) -> Optional[dict]` contract, using the same `ADVISOR_SYSTEM` prompt
  and `parse_advisor_json`, with the same _never-raise → None → deterministic fallback_ behavior.
- Add `MODELS["local_llama"] = {"provider": "local", "model_id": "...", ...}` and a
  `provider == "local"` branch in `_llm_factory`.
- Point the desired ROLEs at it via env (`ROLES[...]["primary"]`), or ship a desktop-default
  `ROLES` profile.

That is the **entire** change to make the advisor run fully offline — no orchestrator, validator, or
prompt edits. The trust spine (validator, number gate, health-safety) runs unchanged in front of the
local model, exactly as it does for Gemini/Claude (the safety floor is model-agnostic — see Phase 9
§5).

---

## 8. Cloud Sync · `NEW`

- **Topology:** local stores are the working set; cloud (Supabase/Neo4j/Qdrant via Core-API) is the
  durable mirror + cross-device hub.
- **Direction:** bidirectional. Local writes queue for push; remote changes pull on connect.
- **Reuse:** the canonical Supabase schema is _already_ the system of record for the cloud product, so
  sync is "reconcile local SQLite against the same canonical tables," not a new data contract. The
  ingestion worker already runs an upsert/delete sync-job model (`complete_sync_job(neo4j_synced,
qdrant_synced, error)` in `processor.rs`) — the same job shape extends to local↔cloud.

---

## 9. Conflict Resolution · `NEW` (reuses existing edge lineage)

- **Strategy:** CRDT for additive collections where possible; **last-writer-wins keyed on
  provenance + timestamp** for scalar facts.
- **Reuse:** the graph edges already carry the lineage we need — tenant scoping, FK provenance
  (`EdgeFrom::PayloadFk`, emitted only when the source field is present — _never a fabricated link_),
  and entity timestamps. LWW resolves on `(updated_at, source)`; a fact confirmed by the user beats one
  inferred, an edge with concrete FK provenance beats a weaker one.
- **Why this is honest-tractable:** we are not inventing a provenance model for sync — Phase 8's
  explainable-graph work (real-edges-only, provenance + citations) already gives every node/edge a
  source and timestamp. Conflict resolution _consumes_ that existing metadata.

---

## 10. Offline Operation · `NEW`

With §3–§7 local, the full loop runs offline: ingest documents → build the local graph + vectors →
retrieve → run the local model through the advisor pipeline → validate via the deterministic trust
spine → respond. Sync (§8) is opportunistic. The **deterministic safety net needs no network at all** —
the health-urgent detector and the number gate are pure local logic and remain the floor offline.

---

## 11. Privacy Modes · `NEW`

| Mode           | Models                                                                | Storage                                    | Sync                             |
| -------------- | --------------------------------------------------------------------- | ------------------------------------------ | -------------------------------- |
| **Local-only** | local model + local embeddings (§5, §7)                               | SQLite/sqlite-vec/local graph              | none — nothing leaves the device |
| **Hybrid**     | local for routine, cloud premium for high-stakes ROLEs (router picks) | local working set + selective cloud mirror | selective                        |
| **Cloud**      | cloud models (today's behavior)                                       | cloud canonical                            | full                             |

The registry makes mode selection a routing policy: a `local-only` profile sets every ROLE's
`primary`/`fallback` to local model keys and disables cloud kill switches. **The same router code**
implements all three modes — only the `ROLES`/flag profile differs.

---

## 12. Enterprise Local Deployment · `NEW`

The same desktop core runs as an on-prem/VPC deployment: local stores → enterprise database; local
model → a self-hosted NIM/vLLM endpoint (another `AdvisorLLM` adapter, §7); the trust spine and
compliance gate (`trust_safety.py`) run unchanged. Tenant scoping in `ontology.rs` —
already cross-tenant-safe by construction — becomes the multi-tenant isolation primitive for an
enterprise install rather than collapsing to one user.

---

## 13. Verdict

Desktop is **roadmap (`NEW`)**, but not a moonshot, because the load-bearing pieces already exist or
port cleanly:

- `EXISTS` / `PARTIAL` foundations: the Rust ingestion worker (native, dependency-light — the standout
  fit); the declarative `ontology.rs`; the canonical, portable Supabase schemas; the provider-agnostic
  `AdvisorLLM` Protocol + model registry; the model-agnostic trust spine; existing edge
  provenance/timestamps for sync.
- `NEW` build: local graph/vector/memory backends, local-model + local-embedding adapters, the local
  Core-API binding, the sync engine, and conflict resolution.

The defining insight: **because no business logic names a model and the heaviest pipeline is already
Rust, "go local" is mostly a matter of swapping stores and pointing the registry at a local model —
the orchestration, ontology, trust spine, and UI come along unchanged.**
