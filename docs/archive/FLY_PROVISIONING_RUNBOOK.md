# Fly.io Provisioning Runbook — Internal Beta

**Repository:** life-nav-mvp
**Branch:** `mvp`
**Scope:** Provision the two Fly.io apps the internal beta depends on.
**Method:** every fact below was read from the repo at this commit. No assumed configuration.

---

## 1. How many Fly applications are required?

**Two.** Not one, not three.

- `lifenavigator-api-gateway` — public HTTPS service.
- `lifenavigator-ingestion-worker` — long-running background worker, no HTTP.

The repo contains exactly two `fly.toml` files at `apps/api-gateway/fly.toml` and `apps/ingestion-worker/fly.toml`. No other directory ships a Fly configuration. The other apps:

- `apps/web` → Vercel, not Fly.
- `apps/graphrag-pipeline` → superseded by api-gateway + worker; do not deploy.
- `apps/mobile` → Expo dev-only; no production target.

---

## 2. Per-application profile

### App 1 — `lifenavigator-api-gateway`

| Field                                | Value                                                                                                                                                                                                                                                                                                                         | Source                                                         |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| App name                             | `lifenavigator-api-gateway`                                                                                                                                                                                                                                                                                                   | `apps/api-gateway/fly.toml:18` (`app = "..."`)                 |
| Purpose                              | Public HTTPS FastAPI gateway. Verifies Supabase JWTs, fans out to Neo4j + Qdrant + Gemini. Sole backend endpoint the web app talks to.                                                                                                                                                                                        | `apps/api-gateway/app/main.py` + route files                   |
| Working directory for `fly` commands | `apps/api-gateway/` (must `cd` here before `fly deploy`)                                                                                                                                                                                                                                                                      | fly CLI requires the working dir that contains `fly.toml`      |
| `fly.toml` path                      | `apps/api-gateway/fly.toml`                                                                                                                                                                                                                                                                                                   | direct file                                                    |
| Dockerfile path                      | `apps/api-gateway/Dockerfile`                                                                                                                                                                                                                                                                                                 | direct file; referenced by `[build] dockerfile = "Dockerfile"` |
| Container entry                      | `uvicorn app.main:app --host 0.0.0.0 --port 8080 --workers 2`                                                                                                                                                                                                                                                                 | Dockerfile `CMD`                                               |
| Primary region                       | `iad` (US-East)                                                                                                                                                                                                                                                                                                               | fly.toml                                                       |
| CPU                                  | `1` shared CPU                                                                                                                                                                                                                                                                                                                | `[[vm]] cpus = 1, cpu_kind = "shared"`                         |
| RAM                                  | `512 MB`                                                                                                                                                                                                                                                                                                                      | `[[vm]] memory_mb = 512`                                       |
| Persistent volume                    | **None**                                                                                                                                                                                                                                                                                                                      | no `[mounts]` block; state lives in Supabase / Neo4j / Qdrant  |
| HTTP exposed                         | Yes — `internal_port = 8080`, `force_https = true`, `auto_stop_machines = "stop"`, `auto_start_machines = true`, `min_machines_running = 1`                                                                                                                                                                                   | `[http_service]`                                               |
| Health check                         | `GET /healthz`, interval 30 s, timeout 5 s, grace 10 s                                                                                                                                                                                                                                                                        | `[[http_service.checks]]`                                      |
| `/healthz` handler                   | implemented at `apps/api-gateway/app/main.py:59` returning `{"status": "ok"}`                                                                                                                                                                                                                                                 | verified                                                       |
| Built-in env (no secret)             | `LOG_LEVEL=info`, `GEMINI_EMBEDDING_MODEL=text-embedding-004`, `GEMINI_GENERATION_MODEL=gemini-2.0-flash`                                                                                                                                                                                                                     | `[env]` block                                                  |
| Secrets required at runtime          | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_PERSONAL_COLLECTION`, `QDRANT_CENTRAL_COLLECTION`, `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`, `NEO4J_PERSONAL_DATABASE`, `NEO4J_CENTRAL_DATABASE`, `ALLOWED_ORIGINS` | `apps/api-gateway/.env.example` + `deploy.sh` `REQUIRED` array |
| Helper script                        | `apps/api-gateway/deploy.sh` (gates on env presence, runs pytest if `.venv` exists, creates app if missing, stages secrets, deploys, polls `/healthz`)                                                                                                                                                                        | direct file                                                    |

### App 2 — `lifenavigator-ingestion-worker`

| Field                                | Value                                                                                                                                                                                                                                          | Source                                                                    |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| App name                             | `lifenavigator-ingestion-worker`                                                                                                                                                                                                               | `apps/ingestion-worker/fly.toml:14` (`app = "..."`)                       |
| Purpose                              | Long-running Rust worker. Claims jobs from `graphrag.sync_queue` (Supabase), runs Gemini embed → Qdrant upsert → Neo4j write per source row. No public HTTP surface.                                                                           | `apps/ingestion-worker/src/main.rs`                                       |
| Working directory for `fly` commands | `apps/ingestion-worker/`                                                                                                                                                                                                                       | fly CLI requires the directory that contains `fly.toml`                   |
| `fly.toml` path                      | `apps/ingestion-worker/fly.toml`                                                                                                                                                                                                               | direct file                                                               |
| Dockerfile path                      | `apps/ingestion-worker/Dockerfile`                                                                                                                                                                                                             | direct file; `[build] dockerfile = "Dockerfile"`                          |
| Container entry                      | `ENTRYPOINT ["ingestion-worker"]` (compiled Rust binary)                                                                                                                                                                                       | Dockerfile                                                                |
| Process group                        | `worker = "ingestion-worker"`                                                                                                                                                                                                                  | `[processes]`                                                             |
| Primary region                       | `iad` (US-East)                                                                                                                                                                                                                                | fly.toml                                                                  |
| CPU                                  | `1` shared CPU                                                                                                                                                                                                                                 | `[[vm]] cpus = 1, cpu_kind = "shared"`                                    |
| RAM                                  | `512 MB`                                                                                                                                                                                                                                       | `[[vm]] memory_mb = 512`                                                  |
| Persistent volume                    | **None**                                                                                                                                                                                                                                       | no `[mounts]` block; the worker is idempotent and re-claims after restart |
| HTTP exposed                         | **No**                                                                                                                                                                                                                                         | no `[http_service]` block. The worker is a background process.            |
| Health check                         | **No HTTP health check.** Fly health = process liveness (auto-detected). Application health is observable via `fly logs -a lifenavigator-ingestion-worker` (the worker emits structured `info` events per poll cycle and on every job result). | fly.toml has no `[checks]` block                                          |
| Deploy strategy                      | `rolling` — at least one machine processing while a new one starts                                                                                                                                                                             | `[deploy] strategy = "rolling"`                                           |
| Built-in env (no secret)             | `LOG_LEVEL=info`, `WORKER_POLL_INTERVAL_SECONDS=5`, `WORKER_BATCH_SIZE=25`, `WORKER_MAX_RETRIES=5`, `GEMINI_EMBEDDING_MODEL=text-embedding-004`                                                                                                | `[env]` block                                                             |
| Secrets required at runtime          | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_PERSONAL_COLLECTION`, `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`, `NEO4J_PERSONAL_DATABASE`                                        | `apps/ingestion-worker/.env.example`                                      |
| Helper script                        | None — deploy by hand with the commands below.                                                                                                                                                                                                 |

---

## 3. Internal Beta Fly footprint decision

- **One Fly app:** no. The web layer talks to the api-gateway, which itself depends on the worker for ingested content to be queryable.
- **API + worker (two apps):** yes. This is the documented footprint.
- **Additional Fly services:** no. No third Fly app is needed for the beta. Don't add Redis-on-Fly, Postgres-on-Fly, or anything else; the workload's stateful systems are Supabase + Neo4j + Qdrant, all external SaaS.

**Beta = two Fly apps, both in `iad`, both stateless (no volumes), both 1 cpu / 512 MB.**

---

## 4. Exact Fly.io commands

Two notes before the commands:

1. **Do NOT run `fly launch`.** `fly launch` is the scaffolder; it would overwrite `apps/<svc>/fly.toml`, replace the Dockerfile, and re-generate the app name. Both apps already have a complete configuration in the repo. Use `fly apps create` to register the name, then `fly deploy` against the existing config.
2. **CLI installation:** verify `fly` is on PATH before starting. (`brew install flyctl` on macOS, `curl -L https://fly.io/install.sh | sh` elsewhere.) Run `fly auth login` once.

### 4a. `lifenavigator-api-gateway`

```bash
# Working directory for ALL commands in this block:
cd apps/api-gateway

# 1. Register the app (idempotent — skip if it already exists).
fly apps create lifenavigator-api-gateway --org <your-fly-org>

# 2. Set secrets. Replace each placeholder with the real value.
#    --stage defers the restart until `fly deploy` runs; this is the
#    fastest way to avoid two cold starts in a row.
fly secrets set --app lifenavigator-api-gateway --stage \
  SUPABASE_URL="https://<project>.supabase.co" \
  SUPABASE_ANON_KEY="<anon-jwt>" \
  SUPABASE_JWT_SECRET="<jwt-secret>" \
  SUPABASE_SERVICE_ROLE_KEY="<service-role-jwt>" \
  GEMINI_API_KEY="<AIza...>" \
  QDRANT_URL="https://<cluster>.qdrant.io:6333" \
  QDRANT_API_KEY="<qdrant-key>" \
  QDRANT_PERSONAL_COLLECTION="life_navigator" \
  QDRANT_CENTRAL_COLLECTION="ln_central" \
  NEO4J_URI="neo4j+s://<id>.databases.neo4j.io" \
  NEO4J_USERNAME="neo4j" \
  NEO4J_PASSWORD="<neo4j-password>" \
  NEO4J_PERSONAL_DATABASE="neo4j" \
  NEO4J_CENTRAL_DATABASE="central" \
  ALLOWED_ORIGINS="https://lifenavigator.app,https://*.vercel.app"

# 3. Build + deploy. `--remote-only` builds on Fly's builder so you do
#    not need Docker locally.
fly deploy --app lifenavigator-api-gateway --remote-only

# 4. Verify.
fly status --app lifenavigator-api-gateway
curl -fsS https://lifenavigator-api-gateway.fly.dev/healthz
# expect: {"status":"ok"}
```

Alternative one-shot: the repo ships `apps/api-gateway/deploy.sh`, which performs steps 1–4 after you export the required env vars. The result is identical.

### 4b. `lifenavigator-ingestion-worker`

```bash
# Working directory for ALL commands in this block:
cd apps/ingestion-worker

# 1. Register the app.
fly apps create lifenavigator-ingestion-worker --org <your-fly-org>

# 2. Set secrets. Note: this app uses the service-role key, not the
#    anon key, because it reads cross-user from graphrag.sync_queue.
fly secrets set --app lifenavigator-ingestion-worker --stage \
  SUPABASE_URL="https://<project>.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="<service-role-jwt>" \
  GEMINI_API_KEY="<AIza...>" \
  QDRANT_URL="https://<cluster>.qdrant.io:6333" \
  QDRANT_API_KEY="<qdrant-key>" \
  QDRANT_PERSONAL_COLLECTION="life_navigator" \
  NEO4J_URI="neo4j+s://<id>.databases.neo4j.io" \
  NEO4J_USERNAME="neo4j" \
  NEO4J_PASSWORD="<neo4j-password>" \
  NEO4J_PERSONAL_DATABASE="neo4j"

# 3. Build + deploy.
fly deploy --app lifenavigator-ingestion-worker --remote-only

# 4. Verify.
fly status --app lifenavigator-ingestion-worker
fly logs --app lifenavigator-ingestion-worker
# Expect lines like:
#   INFO ingestion_worker::queue: claimed 0 jobs from sync_queue
# every WORKER_POLL_INTERVAL_SECONDS (=5s).
```

---

## 5. Provisioning runbook — step-by-step

The runbook below is meant to be executed once, top to bottom, by an operator with `fly` installed and authenticated. Each step has a precondition and a verification.

### Step 0 — Preconditions

```bash
# Confirm CLI + auth.
fly version
fly auth whoami
# Confirm you are in the repo root.
cd /home/riffe007/Documents/projects/life-nav-mvp
git rev-parse --abbrev-ref HEAD
# expect: mvp
```

If either of the above fails, fix before continuing.

### Step 1 — Export required secret values

Set all 16 secrets (api-gateway needs 16; worker reuses 10 of them) as shell variables. **No secret in this file should be a placeholder by the end of this step.**

```bash
export FLY_ORG="<your-fly-org>"

export SUPABASE_URL="https://<project>.supabase.co"
export SUPABASE_ANON_KEY="<anon-jwt>"
export SUPABASE_JWT_SECRET="<jwt-secret>"
export SUPABASE_SERVICE_ROLE_KEY="<service-role-jwt>"

export GEMINI_API_KEY="<AIza...>"

export QDRANT_URL="https://<cluster>.qdrant.io:6333"
export QDRANT_API_KEY="<qdrant-key>"
export QDRANT_PERSONAL_COLLECTION="life_navigator"
export QDRANT_CENTRAL_COLLECTION="ln_central"

export NEO4J_URI="neo4j+s://<id>.databases.neo4j.io"
export NEO4J_USERNAME="neo4j"
export NEO4J_PASSWORD="<neo4j-password>"
export NEO4J_PERSONAL_DATABASE="neo4j"
export NEO4J_CENTRAL_DATABASE="central"

export ALLOWED_ORIGINS="https://lifenavigator.app,https://*.vercel.app"

# Sanity check — print every variable name, no values. If any is empty, stop.
for v in SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_JWT_SECRET SUPABASE_SERVICE_ROLE_KEY \
         GEMINI_API_KEY \
         QDRANT_URL QDRANT_API_KEY QDRANT_PERSONAL_COLLECTION QDRANT_CENTRAL_COLLECTION \
         NEO4J_URI NEO4J_USERNAME NEO4J_PASSWORD NEO4J_PERSONAL_DATABASE NEO4J_CENTRAL_DATABASE \
         ALLOWED_ORIGINS FLY_ORG; do
  [ -n "${!v}" ] && echo "$v: set" || { echo "$v: MISSING"; exit 1; }
done
```

### Step 2 — Create api-gateway

```bash
cd apps/api-gateway

# Verify config is the committed one (catches accidental fly launch overwrites).
grep '^app = ' fly.toml
# expect: app = "lifenavigator-api-gateway"

# Create.
fly apps create lifenavigator-api-gateway --org "$FLY_ORG"
# If "Name has already been taken", continue — app already exists.
```

### Step 3 — Stage api-gateway secrets

```bash
fly secrets set --app lifenavigator-api-gateway --stage \
  SUPABASE_URL="$SUPABASE_URL" \
  SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
  SUPABASE_JWT_SECRET="$SUPABASE_JWT_SECRET" \
  SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  GEMINI_API_KEY="$GEMINI_API_KEY" \
  QDRANT_URL="$QDRANT_URL" \
  QDRANT_API_KEY="$QDRANT_API_KEY" \
  QDRANT_PERSONAL_COLLECTION="$QDRANT_PERSONAL_COLLECTION" \
  QDRANT_CENTRAL_COLLECTION="$QDRANT_CENTRAL_COLLECTION" \
  NEO4J_URI="$NEO4J_URI" \
  NEO4J_USERNAME="$NEO4J_USERNAME" \
  NEO4J_PASSWORD="$NEO4J_PASSWORD" \
  NEO4J_PERSONAL_DATABASE="$NEO4J_PERSONAL_DATABASE" \
  NEO4J_CENTRAL_DATABASE="$NEO4J_CENTRAL_DATABASE" \
  ALLOWED_ORIGINS="$ALLOWED_ORIGINS"

fly secrets list --app lifenavigator-api-gateway
# expect 15 rows, all with status `staged`
```

### Step 4 — Deploy api-gateway

```bash
fly deploy --app lifenavigator-api-gateway --remote-only

# Verify the machine is healthy.
fly status --app lifenavigator-api-gateway
# expect at least one machine in `started` state.

curl -fsS https://lifenavigator-api-gateway.fly.dev/healthz
# expect: {"status":"ok"}

# Optional: verify JWT gate is up.
curl -s -o /dev/null -w "%{http_code}\n" https://lifenavigator-api-gateway.fly.dev/api/compliance/check
# expect: 401 (proves the auth middleware is loaded)
```

### Step 5 — Create ingestion-worker

```bash
cd ../ingestion-worker

grep '^app = ' fly.toml
# expect: app = "lifenavigator-ingestion-worker"

fly apps create lifenavigator-ingestion-worker --org "$FLY_ORG"
# "Name has already been taken" → continue.
```

### Step 6 — Stage ingestion-worker secrets

```bash
fly secrets set --app lifenavigator-ingestion-worker --stage \
  SUPABASE_URL="$SUPABASE_URL" \
  SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  GEMINI_API_KEY="$GEMINI_API_KEY" \
  QDRANT_URL="$QDRANT_URL" \
  QDRANT_API_KEY="$QDRANT_API_KEY" \
  QDRANT_PERSONAL_COLLECTION="$QDRANT_PERSONAL_COLLECTION" \
  NEO4J_URI="$NEO4J_URI" \
  NEO4J_USERNAME="$NEO4J_USERNAME" \
  NEO4J_PASSWORD="$NEO4J_PASSWORD" \
  NEO4J_PERSONAL_DATABASE="$NEO4J_PERSONAL_DATABASE"

fly secrets list --app lifenavigator-ingestion-worker
# expect 10 rows, all with status `staged`
```

### Step 7 — Deploy ingestion-worker

```bash
fly deploy --app lifenavigator-ingestion-worker --remote-only

fly status --app lifenavigator-ingestion-worker
# expect one machine `started`, no checks (this app has no HTTP health).

# Tail the live log for 30 seconds to confirm the worker loop is running.
fly logs --app lifenavigator-ingestion-worker | head -40
# expect lines like:
#   INFO ingestion_worker: starting (region=iad)
#   INFO ingestion_worker::queue: claimed 0 jobs from sync_queue
```

### Step 8 — End-to-end sanity

```bash
# 1. Gateway returns JSON, not HTML.
curl -fsS https://lifenavigator-api-gateway.fly.dev/healthz | jq .

# 2. Worker is connected to Supabase. From a Supabase SQL shell:
#    select * from graphrag.sync_queue order by created_at desc limit 5;
#    Insert a dummy queue row — the next 5-second poll should claim it.

# 3. Gateway can reach Neo4j + Qdrant. From a tester:
fly ssh console --app lifenavigator-api-gateway
# inside the machine:
#   curl -fsS "$NEO4J_URI" -u "$NEO4J_USERNAME:$NEO4J_PASSWORD" | head -1
#   curl -fsS -H "api-key: $QDRANT_API_KEY" "$QDRANT_URL/collections" | jq .
```

If all three sanity checks pass, the Fly side of the internal-beta deployment is complete.

---

## 6. Rollback + cleanup

If a deploy regresses:

```bash
# Roll back the previous machine image.
fly releases --app lifenavigator-api-gateway
fly deploy --app lifenavigator-api-gateway --image <previous-image-id>

# Or scale to zero to stop billing while you debug.
fly scale count 0 --app lifenavigator-api-gateway
fly scale count 0 --app lifenavigator-ingestion-worker
```

To destroy and start over (only do this if you are sure):

```bash
fly apps destroy lifenavigator-api-gateway
fly apps destroy lifenavigator-ingestion-worker
```

---

## 7. What this runbook does NOT do

- It does not provision Supabase, Neo4j, or Qdrant. Those must already exist with valid credentials before Step 1.
- It does not deploy the Vercel web app. Web deployment is a separate runbook.
- It does not deploy the Supabase Edge Functions (`graphrag-query`, `graphrag-sync`, `process-ingestion`). Those are deployed via `supabase functions deploy`.
- It does not add a Redis or Postgres-on-Fly tier. The internal-beta architecture has no Fly-hosted stateful systems.

The Fly footprint for the internal beta is two stateless apps in `iad`. Nothing more.
