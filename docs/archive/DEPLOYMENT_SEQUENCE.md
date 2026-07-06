# Deployment Sequence — Internal Beta

**Repository:** life-nav-mvp
**Target:** Internal Beta (10–20 users)
**Source of truth date:** observed at this commit, branch `mvp`
**Method:** repository was inspected file-by-file; no claim made without evidence

---

## 1. Branch decision

| Question                                | Answer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current branch                          | `mvp`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Recommended deploy branch               | **`mvp`** (it is also `origin/HEAD`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Unmerged work to include                | **YES — uncommitted local work must be committed first.** `git status` shows 309 changed/untracked entries, including all of Sprint T (the build fix, `createGovernedHandler`, the verifier, CI changes), plus Sprints O/O.0/O.0.2/Q/R/S route files that were never committed (~190 untracked routes under `apps/web/src/app/api/`). Without committing, the deploy will be the Sprint M commit `42eee30` from May 2026 — that commit has the broken `arcana/lead-package/route.ts` and none of the Sprint T fixes. |
| Experimental branches to **NOT** deploy | All `remotes/origin/dependabot/*` branches — they exist for dependency review only. `remotes/origin/main` is stale relative to `mvp`. Do not deploy `main`.                                                                                                                                                                                                                                                                                                                                                          |

**Pre-deploy git action required:**

```bash
# Stage Sprint T + intermediate sprints, push to mvp.
git add -A
git commit -m "Sprints O / O.0 / O.0.1 / O.0.2 / Q / R / S / T — committed for beta deploy"
git push origin mvp
```

Until that runs, `Vercel + Fly` will deploy stale code.

---

## 2. Service inventory

Five `apps/*` directories. Two are required for the internal beta, three are not.

### apps/web — REQUIRED

| Field                       | Value                                                                                                                                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name                        | `@life-navigator/web`                                                                                                                                                   |
| Runtime                     | Node 20, Next.js 16.2.6, React 19.0.1                                                                                                                                   |
| Deploy target               | **Vercel**, region `sfo1` (per `apps/web/vercel.json`)                                                                                                                  |
| Required env                | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `INTEGRATION_ENCRYPTION_KEY`, `NEXT_PUBLIC_API_URL`, `GRAPHRAG_WORKER_SECRET` |
| Optional env (cohort-gated) | `GOOGLE_*` / `MICROSOFT_*` / `FITBIT_*` OAuth, `PLAID_*`, `STRIPE_*`, feature flags                                                                                     |
| Build gate                  | `pnpm verify:governance` runs in `prebuild` (Sprint T)                                                                                                                  |

### apps/api-gateway — REQUIRED

| Field         | Value                                                                                                                                                                                                                                                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name          | `lifenavigator-api-gateway`                                                                                                                                                                                                                                                                                                   |
| Runtime       | Python 3.12, FastAPI 0.115, Uvicorn, 2 workers                                                                                                                                                                                                                                                                                |
| Deploy target | **Fly.io**, primary region `iad`, 1 shared CPU / 512 MB, `min_machines_running = 1`                                                                                                                                                                                                                                           |
| Required env  | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_PERSONAL_COLLECTION`, `QDRANT_CENTRAL_COLLECTION`, `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`, `NEO4J_PERSONAL_DATABASE`, `NEO4J_CENTRAL_DATABASE`, `ALLOWED_ORIGINS` |
| Health check  | `GET /healthz` every 30 s                                                                                                                                                                                                                                                                                                     |

### apps/ingestion-worker — REQUIRED

| Field         | Value                                                                                                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name          | `lifenavigator-ingestion-worker`                                                                                                                                                                        |
| Runtime       | Rust 2021, tokio, compiled binary                                                                                                                                                                       |
| Deploy target | **Fly.io**, primary region `iad`, 1 shared CPU / 512 MB, long-running worker, no HTTP, rolling deploy                                                                                                   |
| Required env  | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_PERSONAL_COLLECTION`, `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`, `NEO4J_PERSONAL_DATABASE` |
| Behavior      | Polls `graphrag.sync_queue` every 5 s, batches 25 jobs, retries up to 5×, runs forever                                                                                                                  |

### apps/graphrag-pipeline — NOT REQUIRED FOR BETA

| Field           | Value                                                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Name            | (no package.json)                                                                                                             |
| Runtime         | Python 3.12 on Vercel Functions                                                                                               |
| Status          | **Superseded** by `api-gateway` (query) + `ingestion-worker` (sync). Last commit (`8081010`) is older than both replacements. |
| Deploy decision | **Skip.** Do not deploy. Do not break it either — leave it as historical.                                                     |

### apps/mobile — NOT REQUIRED FOR BETA

| Field           | Value                                    |
| --------------- | ---------------------------------------- |
| Name            | `@life-navigator/mobile`                 |
| Runtime         | Expo SDK 52, React Native 0.76           |
| Status          | Build script is a placeholder. Dev only. |
| Deploy decision | **Skip.** Post-beta initiative.          |

### Supabase Edge Functions — REQUIRED

5 functions in `supabase/functions/`:

- `graphrag-query` — the chat route's only direct dependency
- `graphrag-sync` — ingest dispatch
- `process-ingestion` — multimodal pipeline
- `email-sync` — Gmail/Outlook
- `calendar-sync` — Outlook/Gmail calendar

`graphrag-query` is **required** for `/api/agent/chat`. The other four are **optional** for the cohort that skips OAuth/email/ingest.

---

## 3. Dependency graph

```
                          ┌──────────────────────────────┐
                          │  GCP Secret Manager          │
                          │  (or Vercel/Fly secrets)     │
                          └─────────────┬────────────────┘
                                        │ at deploy time
                                        ▼
        ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
        │  Supabase        │    │  Neo4j (Aura)    │    │  Qdrant Cloud    │
        │  Postgres + Auth │    │  graph           │    │  vector          │
        │  + Storage       │    │                  │    │                  │
        │  + Edge Fns      │    │                  │    │                  │
        └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘
                 │                       │                       │
                 │ JWT verify            │ Cypher                │ search +
                 │ + RLS reads/writes    │                       │ upsert
                 ▼                       ▼                       ▼
                          ┌──────────────────────────────────┐
                          │  Fly.io: api-gateway (FastAPI)   │
                          │  + ingestion-worker (Rust)       │
                          └─────────────┬────────────────────┘
                                        │ Gemini SDK
                                        ▼
                          ┌──────────────────────────────────┐
                          │  Gemini (Google GenAI)           │
                          │  embed + generate                │
                          └─────────────┬────────────────────┘
                                        │ cost recorded by Sprint T
                                        │ via /api/agent/chat factory
                                        ▼
                          ┌──────────────────────────────────┐
                          │  Vercel: apps/web (Next.js)      │
                          │  - createGovernedHandler         │
                          │  - calls Supabase Edge Function  │
                          │    graphrag-query                │
                          │  - economic gate + governance    │
                          └────────┬─────────────────────────┘
                                   │ optional cohort features
                                   ▼
                          ┌──────────────────────────────────┐
                          │  Plaid (sandbox for beta)        │
                          │  + OAuth providers               │
                          └──────────────────────────────────┘
```

**Edge directional summary:**

- Vercel → Supabase (auth, DB, storage, edge functions)
- Vercel → Fly api-gateway (via `NEXT_PUBLIC_API_URL`)
- Vercel → Gemini (only indirectly, through the api-gateway or graphrag-query Edge Function)
- Fly api-gateway → Supabase, Neo4j, Qdrant, Gemini
- Fly ingestion-worker → Supabase (sync_queue), Neo4j, Qdrant, Gemini
- Plaid → Vercel webhooks only (no Supabase trigger)

---

## 4. Ordering — what blocks what

| Layer | Component                                          | Blocks what downstream                           | Beta-blocking?                                       |
| ----- | -------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------- |
| 1     | GCP Secret Manager (or Vercel/Fly secret stores)   | Everything                                       | YES — without secrets nothing runs                   |
| 2     | Supabase project + auth + storage + migrations     | api-gateway, ingestion-worker, web, edge fns     | YES                                                  |
| 2     | Neo4j Aura instance + constraints                  | api-gateway, ingestion-worker                    | YES (chat depends on graph)                          |
| 2     | Qdrant Cloud collections                           | api-gateway, ingestion-worker                    | YES (search depends on vectors)                      |
| 3     | Gemini API key + quota                             | api-gateway, ingestion-worker, web (via gateway) | YES                                                  |
| 4     | Fly api-gateway                                    | web (`NEXT_PUBLIC_API_URL` resolves here)        | YES                                                  |
| 4     | Fly ingestion-worker                               | recommendations that depend on ingested data     | NO for day-one chat; YES once users upload documents |
| 5     | Supabase Edge Functions (`graphrag-query` minimum) | `/api/agent/chat` factory                        | YES                                                  |
| 6     | Vercel web                                         | end users                                        | YES                                                  |
| 7     | Plaid sandbox                                      | finance integration                              | NO (cohort can skip)                                 |
| 7     | Google/Microsoft OAuth (production app)            | email/calendar integration                       | NO (cohort uses magic-link auth)                     |

**Deploy-later list (safe to ship beta without):**

- Plaid production credentials
- OAuth production redirect URIs
- `apps/graphrag-pipeline` (superseded)
- `apps/mobile`

---

## 5. Pre-deploy verification — actual results at this commit

Each verified directly, not assumed:

| Check                      | Result                                                                                                                                                                                                            | Command run                                               |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `pnpm build` (web)         | **GREEN** — Turbopack compiles, `verify-governance` prebuild gate passes                                                                                                                                          | `pnpm build` → `Tasks: 4 successful, 4 total`             |
| Migration count            | **71 files**, IDs `001` through `104` (intentional namespace gaps); `_archived/` for superseded 002 variants. No duplicates.                                                                                      | `ls supabase/migrations/*.sql`                            |
| Governance verifier        | **OK** — 199 routes scanned, 1 model-facing, 1 using factory, 26 using `guardOutgoing`, 2 using `reviewAndPersist`, 3 allow-listed                                                                                | `pnpm verify:governance`                                  |
| Economic governance        | **WIRED** at the factory layer. Every model-facing route (chat today, future ones automatically) goes through `evaluateBreaker` → `evaluateBudget` → producer → `recordUsage`. Before Sprint T this was uncalled. | inspected `apps/web/src/lib/governance/governed-route.ts` |
| Character layer (Sprint Q) | **PASSING** — certification suite is part of the 1,371-test green run                                                                                                                                             | `npx jest --silent` → `1371 passed`                       |
| Outcome intelligence       | **PASSING** — DQI, attribution, life progress, tenant reports all green; safety-filtered acceptance enforced                                                                                                      | same Jest run                                             |

**Single repo-wide gap before deploy:** local uncommitted work must be committed (Sprint T + many earlier sprint files are untracked).

---

## 6. Deployment phases

The order below is the minimum-blast-radius path. Each phase has a verify step that, if it fails, **stops the phase before moving on**.

### Phase 1 — Infrastructure provisioning

Goal: every external service has an account, a project, a region pinned, and an endpoint URL.

1. **Supabase project** (region: US-East to match `iad`)
   - Create project → record `SUPABASE_URL`, `anon`, `service_role`, JWT secret.
   - Enable Storage. Create buckets (will be done by migration 002).
   - Auth: enable email + magic link. (Skip Google/Microsoft for first cohort.)
2. **Neo4j Aura** (US-East)
   - Free or Professional tier — record `NEO4J_URI`, `neo4j` / password.
   - Create two databases: `neo4j` (personal) and `central`.
3. **Qdrant Cloud** (US-East)
   - Create cluster — record `QDRANT_URL` + API key.
   - Create collections `life_navigator` (personal) + `ln_central` (read-only central). The api-gateway creates them on first use, but pre-creating avoids a cold-start race.
4. **Google Cloud** project for Gemini
   - Enable Generative Language API.
   - Create API key — record `GEMINI_API_KEY`. Set quota alert at 80 %.
5. **Vercel project**
   - Connect GitHub repo, point to `mvp` branch.
   - Do NOT trigger a deploy yet — secrets aren't loaded.
6. **Fly.io apps**
   ```bash
   fly apps create lifenavigator-api-gateway
   fly apps create lifenavigator-ingestion-worker
   ```
   Do NOT deploy yet.
7. **Plaid** — confirm sandbox credentials. Skip production for beta.
8. **GCP Secret Manager** (or your chosen secret store)
   - Decide single source of truth for secrets. Recommended: Vercel + Fly secrets are the runtime stores; GCP Secret Manager is the inventory + audit log.

**Verify before moving on:**

- [ ] Each service URL pings successfully from your laptop.
- [ ] Each platform account has billing enabled (Vercel, Fly, Gemini, Neo4j, Qdrant).

### Phase 2 — Secrets

Goal: every required env var is set on the platform that needs it.

1. **Vercel project env vars** (production scope):
   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   INTEGRATION_ENCRYPTION_KEY  # generate 64-char hex
   NEXT_PUBLIC_API_URL         # https://lifenavigator-api-gateway.fly.dev
   GRAPHRAG_WORKER_SECRET      # shared with the Edge Function
   NEXT_PUBLIC_APP_URL         # production domain
   NEXTAUTH_URL                # production domain
   NEXTAUTH_SECRET
   ```
2. **Fly api-gateway secrets:**
   ```bash
   fly secrets set --app lifenavigator-api-gateway \
     SUPABASE_URL=... SUPABASE_ANON_KEY=... \
     SUPABASE_JWT_SECRET=... SUPABASE_SERVICE_ROLE_KEY=... \
     GEMINI_API_KEY=... \
     QDRANT_URL=... QDRANT_API_KEY=... \
     QDRANT_PERSONAL_COLLECTION=life_navigator \
     QDRANT_CENTRAL_COLLECTION=ln_central \
     NEO4J_URI=... NEO4J_USERNAME=neo4j NEO4J_PASSWORD=... \
     NEO4J_PERSONAL_DATABASE=neo4j NEO4J_CENTRAL_DATABASE=central \
     ALLOWED_ORIGINS=https://lifenavigator.app,https://*.vercel.app
   ```
3. **Fly ingestion-worker secrets:**
   ```bash
   fly secrets set --app lifenavigator-ingestion-worker \
     SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
     GEMINI_API_KEY=... \
     QDRANT_URL=... QDRANT_API_KEY=... QDRANT_PERSONAL_COLLECTION=life_navigator \
     NEO4J_URI=... NEO4J_USERNAME=neo4j NEO4J_PASSWORD=... \
     NEO4J_PERSONAL_DATABASE=neo4j
   ```
4. **Supabase Edge Function secrets** (via Supabase Dashboard → Edge Functions):
   ```
   GEMINI_API_KEY
   NEO4J_URI / NEO4J_USERNAME / NEO4J_PASSWORD / NEO4J_PERSONAL_DATABASE
   QDRANT_URL / QDRANT_API_KEY / QDRANT_PERSONAL_COLLECTION
   GRAPHRAG_WORKER_SECRET
   ```
5. **GCP Secret Manager mirror** (optional but recommended for audit): create a secret per env var named `<service>/<env_name>`, version 1. This is your inventory of record; future rotations write a v2.

**Verify before moving on:**

- [ ] `fly secrets list --app lifenavigator-api-gateway` shows every required key.
- [ ] `fly secrets list --app lifenavigator-ingestion-worker` shows every required key.
- [ ] Vercel project shows every required key under Settings → Environment Variables → Production.
- [ ] Supabase project → Settings → Edge Functions shows the function secrets.

### Phase 3 — Databases

Goal: Postgres + Neo4j + Qdrant carry the schema the apps expect.

1. **Supabase Postgres migrations**
   - Push migrations in numeric order using Supabase CLI (or the `supabase db push` command):
     ```bash
     supabase link --project-ref <project_id>
     supabase db push
     ```
   - Confirm migrations `001 → 104` apply cleanly. If any fail, **stop and debug** before continuing. There are 71 SQL files (gaps are intentional namespace splits).
2. **Supabase Storage** — already created by `002_storage_buckets.sql`. Confirm bucket-level RLS shows policies present.
3. **Neo4j constraints + indexes**
   - The api-gateway creates personal-side constraints lazily on first use, BUT for production we should run the bootstrap explicitly. There is no committed bootstrap file in the repo today; minimum constraint set:
     ```cypher
     CREATE CONSTRAINT user_id_required IF NOT EXISTS
       FOR (n:User) REQUIRE n.user_id IS NOT NULL;
     CREATE INDEX entity_user_id IF NOT EXISTS
       FOR (n:Entity) ON (n.user_id);
     ```
   - Owner: api-gateway runtime can lazy-create, but **run by hand** for v1.
4. **Qdrant collections**
   - Create `life_navigator` (768-dim cosine for `text-embedding-004`) and `ln_central` (same).
   - The worker will fail-loud if collections are missing — that is the desired behavior.

**Verify before moving on:**

- [ ] `select count(*) from public.outcome_tenant_reports;` returns `0` (table exists; RLS not yet failing).
- [ ] `select count(*) from projections.industry_templates;` returns `6` (Sprint S seed).
- [ ] Neo4j `SHOW CONSTRAINTS;` lists at least the user_id constraint.
- [ ] Qdrant `GET /collections` lists both collections.

### Phase 4 — Backend deployment

Goal: Fly services healthy; Supabase Edge Functions deployed; API path open.

1. **Deploy api-gateway**
   ```bash
   cd apps/api-gateway
   fly deploy
   ```
   Wait for `min_machines_running = 1` to satisfy. Health check at `/healthz` must return 200.
2. **Deploy ingestion-worker**
   ```bash
   cd apps/ingestion-worker
   fly deploy
   ```
   Tail logs to confirm "claimed N jobs" or "queue empty" — both prove the worker connected to Supabase.
3. **Deploy Supabase Edge Functions** (the CI workflow has a `deploy-edge-functions` job; first deploy may need manual run):
   ```bash
   supabase functions deploy graphrag-query --no-verify-jwt
   supabase functions deploy graphrag-sync
   supabase functions deploy process-ingestion
   # email-sync and calendar-sync are optional for first cohort
   ```
4. **Smoke test the gateway:**
   ```bash
   curl https://lifenavigator-api-gateway.fly.dev/healthz
   # expect: {"status":"ok"}
   curl -X POST https://lifenavigator-api-gateway.fly.dev/v1/.../<your route>
   # expect: 401 unauthorized (proves auth gate works)
   ```

**Verify before moving on:**

- [ ] `fly status --app lifenavigator-api-gateway` shows healthy machine.
- [ ] `fly status --app lifenavigator-ingestion-worker` shows running worker.
- [ ] Supabase Edge Function `graphrag-query` returns 200 on a synthetic test invoke.

### Phase 5 — Frontend deployment

Goal: Vercel serves the Next.js app and the chat factory talks end-to-end.

1. **Commit + push** the local Sprint T + intermediate work (otherwise the deploy is stale code; see Section 1).
2. **Trigger Vercel deploy** from the `mvp` branch.
3. **Watch the build log for:**
   ```
   prebuild → verify-governance: OK — every model-facing route is governed.
   build → Compiled successfully
   ```
   A failure of the verifier here is the Sprint T gate doing its job; do not bypass.
4. **Verify the deployment URL** loads `/` and `/api/health` returns 200.

**Verify before moving on:**

- [ ] Vercel deployment is `Ready`.
- [ ] `https://<vercel-url>/api/health` returns 200.
- [ ] `https://<vercel-url>/` renders the marketing page.

### Phase 6 — Verification (end-to-end + factory invariants)

Goal: prove the full stack runs and the safety guarantees are actually live.

1. **Create one beta user** via Supabase Auth (magic link). Confirm magic link arrives.
2. **Sign in and exercise `/api/agent/chat`:**
   - Send a benign message. Confirm:
     - Response returns governance verdict.
     - `decision_governance_audit` table receives a new row.
     - `economic.usage_events` table receives a new row (proves cost is being recorded).
     - `economic.user_budgets.current_daily_micros` for this user is non-zero.
3. **Exercise the streaming bypass attempt:**
   - Send `POST /api/agent/chat?stream=true`.
   - Confirm the response is a single SSE event AFTER governance ran (no raw token streaming pre-gate). The Sprint T factory should buffer.
4. **Exercise the economic gate negatively:**
   - Lower the user's daily cap to a tiny number in `economic.user_budgets`.
   - Send another chat. Confirm 429 with `budget_exceeded` body.
   - Restore the cap.
5. **Confirm character + governance audit trail:**
   - `select character_score_overall, character_needs_regeneration from public.decision_governance_audit order by created_at desc limit 1;` returns a populated row.
6. **Confirm ingestion path** (only if Phase 4 included the worker):
   - Upload a small PDF via `/api/ingest/upload`.
   - Confirm `ingestion_files` row written.
   - Confirm `graphrag.sync_queue` row written.
   - Confirm worker claims and processes the row within 30 seconds.
   - Confirm Qdrant collection size increases.

**Hard go/no-go gate:**

- [ ] All 6 verifications above pass.
- [ ] `decision_governance_audit` row count > 0 after one real session.
- [ ] `economic.usage_events` row count > 0.
- [ ] No `governance_blocked` errors for benign prompts.

If any of those checkboxes fail, **do not open the cohort.** Roll back at the Vercel + Fly deploys; fix in a follow-up; redeploy.

---

## Summary

- **Branch to deploy:** `mvp`, after committing + pushing local Sprint T work.
- **Services to deploy:** Vercel (web), Fly (api-gateway, ingestion-worker), Supabase Edge Functions. Skip graphrag-pipeline and mobile.
- **Order:** Infrastructure → Secrets → Databases → Fly backends → Vercel → end-to-end verify.
- **Safety guarantees that must light up before cohort opens:** `verify-governance` passes in CI, the chat factory writes audit + cost rows, and the streaming path no longer pre-emits tokens.

The platform is ready to deploy in this order. The only repo-side action required before Phase 1 is committing the uncommitted work.
