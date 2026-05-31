# LifeNavigator API Gateway (FastAPI on Fly.io)

This is **Step 7** — the final step of the sequenced build plan
(`/SEQUENCED_BUILD_PLAN.md` at the repo root).

The gateway sits between the Vercel frontend and three downstream
systems:

```
Vercel (Next.js)
      │  Authorization: Bearer <Supabase JWT>
      ▼
[ FastAPI api-gateway  (Fly.io) ]
      │
      ├─ Gemini (embeddings + generation)
      ├─ Qdrant — personal (per-user vectors)
      ├─ Qdrant — central (shared knowledge, read-only)
      └─ Neo4j  — personal + central databases
```

It does **not** talk to Supabase Auth. It only **verifies** the JWT
Supabase Auth already issued. Every protected route reads `user_id`
from the verified JWT and **refuses to read it from the body / query /
headers**.

## Layout

```
apps/api-gateway/
  requirements.txt
  requirements-dev.txt
  Dockerfile
  fly.toml
  .env.example
  pytest.ini
  GRAPHRAG_FASTAPI_COMPLIANCE_IMPLEMENTATION.md   (this file)
  app/
    __init__.py
    config.py              Settings via pydantic-settings
    auth.py                Supabase JWT verification + AuthenticatedUser
    deps.py                FastAPI dependencies for the service clients
    main.py                FastAPI app + route registration + CORS + health checks
    schemas/
      common.py            QueryRequest, RecommendationEnvelope
    services/
      gemini.py            embed + generate
      qdrant.py            personal + central search (with build_personal_filter)
      neo4j_client.py      transactional Cypher (with cypher_filters_personal guard)
      graphrag_personal.py retrieve_personal + RRF fusion
      graphrag_central.py  retrieve_central (read-only)
      compliance.py        check_recommendation (securities/medical/guarantee/cross_user)
      arcana_lead_package.py build_preview + block_or_send + audit
    routes/
      graphrag.py          POST /api/graphrag/query
      recommendations.py   POST /api/recommendations/generate
      simulations.py       POST /api/simulations/{create,compare}
      optimizer.py         POST /api/optimizer/run
      compliance.py        POST /api/compliance/check
      arcana.py            POST /api/arcana/lead-package/{preview,send}
      health_monitoring.py POST /api/health-monitoring/{manual-entry,wearable-event}
  tests/
    conftest.py
    test_auth.py                         (9 tests)
    test_personal_retrieval_filter.py    (10 tests)
    test_compliance.py                   (12 tests, 1 end-to-end)
```

## Core invariants (enforced by tests)

| Invariant                                                                                       | Test                                                                  |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Missing / bad-scheme / wrong-secret / expired / wrong-audience JWTs → 401                       | `test_auth.py`                                                        |
| `verify_jwt` requires `sub`; routes return 401 on missing claim                                 | `test_auth.py::test_token_missing_sub_is_rejected_unit`               |
| Valid JWT propagates `user_id` from `sub` into responses                                        | `test_auth.py::test_valid_token_passes_through_and_user_id_is_echoed` |
| A `user_id` field in the request body NEVER overrides the JWT's `sub`                           | `test_auth.py::test_user_id_comes_only_from_jwt_not_from_body`        |
| Qdrant personal filter carries `tenant_id`, `user_id`, `access_scope='personal'`                | `test_personal_retrieval_filter.py`                                   |
| `build_personal_filter` refuses an empty user_id                                                | same                                                                  |
| Two users produce distinct Qdrant filters                                                       | same                                                                  |
| Neo4j personal params bind `tenant_id` to the authenticated user and refuse override in `extra` | same                                                                  |
| `run_personal` refuses Cypher that doesn't mention `$tenant_id`                                 | same                                                                  |
| The compliance vetter flags all four categories: securities, medical, guarantee, cross_user     | `test_compliance.py`                                                  |
| The compliance route end-to-end returns a violation payload                                     | `test_compliance.py::test_compliance_route_returns_violation_payload` |

**Total: 29 tests passing.**

## Auth contract

Routes depend on `current_user`:

```python
@router.post("/whatever")
async def handler(
    body: SomeBody,
    user: AuthenticatedUser = Depends(current_user),
    ...
):
    # user.user_id is the only trusted identity.
```

`current_user` itself depends on `get_settings` so tests can override
the JWT secret via `app.dependency_overrides`. Production reads it
from `SUPABASE_JWT_SECRET`.

## Personal retrieval contract

Every personal-collection query goes through one of two chokepoints,
both audited by tests:

- **Qdrant**: `build_personal_filter(user_id, domain=None)` returns the
  `{"must": [...]}` clause that pins `tenant_id`, `user_id`,
  `access_scope='personal'`, plus an optional `domain` clause.
  `search_personal(...)` always uses this filter; there is no codepath
  that searches the personal collection without it.

- **Neo4j**: `build_personal_params(user_id, extra=None)` binds
  `tenant_id` to the authenticated user and refuses to let the caller
  override it via `extra`. `run_personal(...)` calls
  `cypher_filters_personal(cypher)` first and raises `ValueError` if
  the statement doesn't reference `$tenant_id`.

Central retrieval is the inverse: it has no tenant filter because the
central collection / database is shared knowledge.

## Compliance contract

`check_recommendation(text)` runs four regex banks:

| Category     | Examples                                                                        |
| ------------ | ------------------------------------------------------------------------------- |
| `securities` | "buy SPY", "I recommend you buy AAPL", "risk-free 8%", "guaranteed 12% returns" |
| `medical`    | "you have diabetes", "take 500 mg of ibuprofen", "stop taking your medication"  |
| `guarantee`  | "guaranteed to cure", "no downside", "100% chance", "will definitely make…"     |
| `cross_user` | "other users typically…", "based on similar users' data…"                       |

When a violation matches, the route layer:

- sets `should_refer_to_partner=True`,
- nulls out `next_best_action`,
- fills `partner_type` with `physician`, `licensed_financial_advisor`,
  or `advisor` depending on the category.

## Arcana lead-package contract

`POST /api/arcana/lead-package/preview` builds the package snapshot
from the user-graph payload the caller assembled. The route returns the
package shape so the UI can show the user what will be shared before
they consent.

`POST /api/arcana/lead-package/send` requires a granted, unrevoked,
unexpired `arcana_lead_sharing` consent in the request body
(`authorize_send` checks all three). If consent is missing or invalid,
the route returns **403** with an `arcana_blocked_no_consent` audit
event. Otherwise it returns the package + `arcana_sent` audit event;
the caller is expected to persist the audit event atomically with the
outbound POST to Arcana's intake endpoint (the outbound call is
**intentionally not implemented in this scaffold** — wire it in once
the partnership contract is final).

## Local dev

```bash
cd apps/api-gateway
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
cp .env.example .env
# Fill in SUPABASE_JWT_SECRET (mandatory) plus the rest if you want
# to hit Qdrant / Neo4j / Gemini for real.

.venv/bin/pytest -q                                  # 29 tests
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8080
```

The 29 tests run with no network access. They fake the JWT secret and
exercise pure logic; the Qdrant / Neo4j / Gemini clients are not
instantiated in test paths.

## Deploy to Fly.io

```bash
cd apps/api-gateway
fly apps create lifenavigator-api-gateway
fly secrets set \
  SUPABASE_URL=...                       \
  SUPABASE_ANON_KEY=...                  \
  SUPABASE_JWT_SECRET=...                \
  SUPABASE_SERVICE_ROLE_KEY=...          \
  GEMINI_API_KEY=...                     \
  QDRANT_URL=...                         \
  QDRANT_API_KEY=...                     \
  QDRANT_PERSONAL_COLLECTION=life_navigator \
  QDRANT_CENTRAL_COLLECTION=ln_central   \
  NEO4J_URI=...                          \
  NEO4J_USERNAME=neo4j                   \
  NEO4J_PASSWORD=...                     \
  NEO4J_PERSONAL_DATABASE=neo4j          \
  NEO4J_CENTRAL_DATABASE=central         \
  ALLOWED_ORIGINS=https://lifenavigator.app,https://*.vercel.app
fly deploy
```

The Dockerfile builds a slim image, installs Python deps, copies the
app, and runs as a non-root user.

## Verification

| Step                                   | Result                                   |
| -------------------------------------- | ---------------------------------------- |
| `python -c "from app.main import app"` | imports cleanly                          |
| `pytest -q`                            | **29 passed, 0 failed**                  |
| Route inventory                        | 13 routes (11 protected, 2 healthchecks) |

## Endpoints

```
GET  /healthz                              public liveness
GET  /readyz                               public readiness
POST /api/graphrag/query                   JWT
POST /api/recommendations/generate         JWT (compliance-vetted)
POST /api/simulations/create               JWT (passthrough to web)
POST /api/simulations/compare              JWT (passthrough to web)
POST /api/optimizer/run                    JWT (passthrough to web)
POST /api/compliance/check                 JWT (returns ok + violations)
POST /api/arcana/lead-package/preview      JWT
POST /api/arcana/lead-package/send         JWT + arcana_lead_sharing consent
POST /api/health-monitoring/manual-entry   JWT (passthrough to web)
POST /api/health-monitoring/wearable-event JWT (passthrough to web)
```

## Intentionally deferred

- **Outbound Arcana intake POST** — the partnership contract /
  endpoint URL is out of scope for this scaffold. The data shape and
  consent / audit gate are in place; flip one switch when ready.
- **Service-role Supabase read** for the Arcana snapshot inside the
  route — today the route accepts the snapshot in the body. Switch to
  reading `finance.*` + `health_meta.*` + `user_*` via service role
  once you decide whether to keep the gateway DB-aware or not.
- **Streaming generation** for the recommendations route — the
  current implementation returns a single JSON envelope. SSE is a
  drop-in once the UI needs it.
- **Per-route rate limits / API keys** — add `slowapi` and `fastapi-limiter`
  when you wire a Redis (Upstash works).
- **Move the optimizer / projector / matcher / alert engine from the
  Next.js app into this gateway** — the passthrough routes
  (`/api/simulations/*`, `/api/optimizer/*`, `/api/health-monitoring/*`)
  document this future. The tradeoff is centralization vs. roundtrips.

---

## Sequenced build plan — completed

This finishes the seven-prompt sequence laid out in
`SEQUENCED_BUILD_PLAN.md`:

| #   | Topic                                          | Status   |
| --- | ---------------------------------------------- | -------- |
| 1   | Schema foundation (migrations 060–073)         | done     |
| 2   | Wearable Monitoring + Alert engine             | done     |
| 3   | Dynamic Goal Optimizer                         | done     |
| 4   | Life Trajectory Simulation                     | done     |
| 5   | Career Marketplace                             | done     |
| 6   | Rust ingestion worker (Fly.io)                 | done     |
| 7   | FastAPI GraphRAG + compliance gateway (Fly.io) | **done** |

The repo now contains:

- ~7 new web-app surfaces (next-dollar optimizer, life trajectory,
  jobs, employer, plus the prior onboarding hub / converse / review).
- A complete Rust crate at `apps/ingestion-worker/` with 22 passing
  tests and a fly.toml ready to deploy.
- A complete FastAPI app at `apps/api-gateway/` with 29 passing tests
  and a fly.toml ready to deploy.
- ~33 new Supabase migrations (`069`–`073`) layered on top of the prior
  user-graph and discovery work.
- Six per-step implementation docs at the repo root.
