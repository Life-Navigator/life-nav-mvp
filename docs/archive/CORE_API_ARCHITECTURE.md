# CORE API ARCHITECTURE — `lifenavigator-core-api`

**Date:** 2026-06-07 · **Status:** DESIGN ONLY · **Runtime:** FastAPI (Python 3.12) on Fly.io.

The orchestration tier. "Core API orchestrates." Sits between Vercel (rendering) and Supabase/GraphRAG/Gemini.

---

## 1. Responsibilities

**Does:** authenticate users (verify Supabase JWT), load user context, read/write Supabase (RLS-scoped reads + service-role writes), query GraphRAG (Qdrant + Neo4j), call Gemini behind the Trust/Safety gate, assemble complete domain view-models, expose versioned `/v1/*` JSON contracts.

**Does NOT:** render HTML, hold browser sessions/cookies, run embeddings batch sync (that's the worker), or store data of record (that's Supabase).

---

## 2. Module layout

```
lifenavigator-core-api/
├── app/
│   ├── main.py                 # FastAPI app, lifespan, router mount, /healthz
│   ├── settings.py             # pydantic-settings; all secrets from env (Fly)
│   ├── deps.py                 # DI: current_user, supabase clients, graph clients
│   ├── middleware/
│   │   ├── auth.py             # verify Supabase JWT (SUPABASE_JWT_SECRET) → UserContext
│   │   ├── request_id.py       # correlation id + structured logging
│   │   └── ratelimit.py        # reuse economic.* budgets/rate-limit semantics
│   ├── clients/
│   │   ├── supabase.py         # anon(JWT-scoped) + service-role clients
│   │   ├── qdrant.py           # async REST; user-filtered search
│   │   ├── neo4j.py            # Aura Query API v2; tenant_id-filtered Cypher
│   │   └── gemini.py           # embed + generate; retry/backoff; cost meter
│   ├── governance/
│   │   └── trust_safety.py     # constitutional + character + injection gate (port of lib/governance)
│   ├── grounding/
│   │   ├── retriever.py        # vector + graph fusion (port of graphrag-query)
│   │   └── context.py          # build domain chat context (G contract)
│   ├── domains/                # ONE module per domain — the heart of the API
│   │   ├── base.py             # DomainService ABC: summary(), write(), context(), recommendations()
│   │   ├── finance.py
│   │   ├── health.py
│   │   ├── career.py
│   │   ├── education.py
│   │   ├── family.py
│   │   ├── goals.py
│   │   ├── risk.py
│   │   ├── calendar.py
│   │   ├── roadmap.py          # derived (no own store)
│   │   └── scenarios.py
│   ├── agents/                 # domain agents + orchestrator (Phase 9)
│   │   ├── registry.py         # mirrors lib/governance/agent-registry.ts
│   │   └── orchestrator.py
│   ├── recommendations/
│   │   └── engine.py           # H contract assembly (port recommendations.ts)
│   ├── contracts/              # pydantic response models == DOMAIN_DATA_CONTRACTS.md
│   │   ├── common.py           # Freshness, Confidence, Recommendation, Money, ViewModel[T]
│   │   └── <domain>.py
│   └── routers/
│       ├── finance.py … scenarios.py
│       ├── life_profile.py     # GET /v1/life-profile
│       ├── chat.py             # POST /v1/chat/context, POST /v1/chat (Phase 2+)
│       └── recommendations.py
├── tests/
├── Dockerfile
└── fly.toml
```

**Pattern:** every router is a thin shell; the `DomainService` does the work. A new domain = one `domains/<x>.py` + one `contracts/<x>.py` + one `routers/<x>.py`, all conforming to `base.DomainService`. This is what keeps it from becoming a mess.

---

## 3. `DomainService` interface (the contract that prevents drift)

```python
class DomainService(ABC):
    domain: str                                  # "finance"
    entity_types: list[str]                      # worker EntityType strings this domain owns

    async def summary(self, ctx: UserContext) -> DomainViewModel: ...      # F contract
    async def detail(self, ctx: UserContext, **q) -> DomainViewModel: ...
    async def write(self, ctx: UserContext, payload: BaseModel) -> WriteResult: ...  # service-role + auto-trigger
    async def chat_context(self, ctx: UserContext) -> DomainChatContext: ...         # G contract
    async def recommendations(self, ctx: UserContext) -> list[Recommendation]: ...   # H contract
    async def freshness(self, ctx: UserContext) -> Freshness: ...
```

`life-profile`, `chat`, and `recommendations` routers iterate registered `DomainService`s — so adding a domain auto-joins the unified views with zero edits to those routers.

---

## 4. Authentication & user context

- Vercel forwards the **user's Supabase JWT** as `Authorization: Bearer <access_token>` (server-to-server; the browser session cookie never leaves Vercel).
- `middleware/auth.py` verifies the JWT signature against `SUPABASE_JWT_SECRET` (already a Fly secret on api-gateway), extracts `sub` → `user_id`, builds `UserContext{user_id, jwt, roles, tenant_id=user_id}`.
- **Two Supabase clients per request:**
  - **anon/JWT-scoped** (`Authorization: Bearer <user jwt>`) for RLS-respecting reads where owner-scoping is desired.
  - **service-role** for writes and cross-cutting reads (audit, metering) — never exposed outward.
- This matches today's split (`lib/supabase/server.ts` `createServerSupabaseClient` vs `createServiceRoleClient`) and the migration-116 RLS model.

---

## 5. Secrets (Fly only — never Vercel)

Already present on `lifenavigator-api-gateway` (reuse the same set): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`, `GEMINI_API_KEY`, `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_PERSONAL_COLLECTION`, `NEO4J_URI/USERNAME/PASSWORD/PERSONAL_DATABASE`, `GRAPHRAG_WORKER_SECRET`, `ALLOWED_ORIGINS`. Plus a `CORE_API_DB_URL` (pooler `POSTGRES_URL`) for direct SQL where PostgREST is awkward.

`GEMINI_API_KEY` placement obeys `ARCHITECTURE_BOUNDARIES.md`: Fly + Edge only.

---

## 6. Grounding (ported from `graphrag-query`)

- **Qdrant:** embed query with `gemini-embedding-001` (3072-dim — MUST match the worker), search `life_navigator` filtered to the user. Same model/dim contract as today (the dimension-mismatch trap is documented in `GRAPH_REPROCESSING_FINAL_REPORT.md`).
- **Neo4j:** Aura Query API v2 (`/db/<db>/query/v2`), every Cypher filters `tenant_id = $user_id`. Domain services request typed subgraphs (e.g. finance: `(:UserProfile)-[:OWNS]->(:FinancialAccount)-[:HAS_TRANSACTION]->(:TransactionSummary)`).
- **Fusion:** vector + graph results merged (reuse the existing fused-result scoring) into `DomainChatContext`.
- CENTRAL_CONTEXT stays stripped until Phase 8 seeds `ln_central`.

---

## 7. Trust/Safety gate (mandatory on AI output)

`governance/trust_safety.py` ports the existing `lib/governance` + `lib/constitutional` stack: every Gemini-generated payload (chat, recommendations, decision analysis) is buffered server-side, run through governance + character + injection checks, and only released on pass — otherwise a safe fallback. Audit rows written service-role to `governance.decision_governance_audit` (the migration-116 write model). No `?stream` bypass.

---

## 8. Deployment (Fly.io)

```toml
# fly.toml (sketch)
app = "lifenavigator-core-api"
primary_region = "iad"
[build]
  dockerfile = "Dockerfile"     # python:3.12-slim + uvicorn/gunicorn
[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = "suspend"
  min_machines_running = 1
[[http_service.checks]]
  path = "/healthz"
[env]
  LOG_LEVEL = "info"
  GEMINI_EMBEDDING_MODEL = "gemini-embedding-001"
```

- Co-located with the worker + api-gateway in `iad` (low-latency to Supabase/Qdrant/Neo4j).
- `min_machines_running = 1` (suspend, not stop) to avoid cold-start on chat.
- CORS locked to `ALLOWED_ORIGINS` (lifenavigator.tech).
- Health: `/healthz` (liveness) + `/readyz` (checks Supabase/Qdrant/Neo4j reachability).
- Observability: structured JSON logs (reuse worker telemetry redaction rules — never log PII or keys), request-id correlation, per-domain latency + token-cost metrics into `ops.llm_usage_meter`.

---

## 9. Relationship to existing services

| Existing                 | Disposition                                                                                                                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api-gateway` (Fly) | Becomes/!is renamed-to or superseded by core-api, OR core-api is a new app and api-gateway is retired once parity is reached. (Recommend: build core-api fresh, retire api-gateway at Phase 3.) |
| `graphrag-query` Edge fn | Stays until Phase 2/3 ports context assembly into core-api; then Edge becomes a thin fallback or is retired.                                                                                    |
| `graphrag-sync` Edge fn  | Retire (legacy text-embedding-004; superseded by the Rust worker).                                                                                                                              |
| Vercel `/api/*` routes   | Converted to thin proxies to `/v1/*` (or deleted where the page can call core-api directly server-side).                                                                                        |
| Worker                   | Unchanged role; gains enum variants.                                                                                                                                                            |

---

## 10. Why FastAPI (vs extending the Rust worker or Next routes)

- The worker is a batch sync loop, not a request/response API — wrong shape for orchestration.
- Next.js routes are the thing we're moving logic OUT of (and they can't hold Gemini keys per policy).
- FastAPI gives typed pydantic contracts (1:1 with `DOMAIN_DATA_CONTRACTS.md`), async I/O for fan-out to Supabase/Qdrant/Neo4j/Gemini, first-class OpenAPI for the frontend client, and a clean DI model for the `DomainService` pattern. Python also matches the existing agent/governance porting surface and ML ecosystem.
