# Fly Redeploy Readiness Report

**Date:** 2026-06-02
**Repository:** `life-nav-mvp`
**Targets:** `lifenavigator-api-gateway` (first), then `lifenavigator-ingestion-worker`

---

## Final verdict

```
NOT_READY_MISSING_APP
```

The local repo is in the correct shape to deploy from. Two operator-side
preconditions remain:

1. `flyctl` is installed at `~/.fly/bin/flyctl` but **not authenticated**. Until you run `flyctl auth login`, none of the Fly-side verifications (Steps 2, 4, 6, 7, 8) can execute from this session.
2. The previous deploy log proved the Fly app does **not exist** in your org. Until `fly apps create lifenavigator-api-gateway` runs (after auth), `fly deploy` will still fail with `app not found`.

Both are deterministic next actions, not problems with the code or the config. The verdict will flip to `READY_TO_REDEPLOY_API_GATEWAY` after both are cleared, and to `API_GATEWAY_DEPLOYED_READY_FOR_WORKER` after the api-gateway deploy + `/healthz` returns 200.

---

## Step 1 — Git verification ✓

| Check                             | Observed                                   | Status                              |
| --------------------------------- | ------------------------------------------ | ----------------------------------- |
| current branch                    | `mvp`                                      | ✓                                   |
| local HEAD                        | `88c521b09292aa9861889c434a7daaf10eeb8c30` | ✓                                   |
| origin/mvp                        | `df73bda08c8957deec5719302673bb5a8936278e` | ⚠ origin is one commit behind local |
| working tree clean?               | YES (`git status --short` = empty)         | ✓                                   |
| Is `df73bda` an ancestor of HEAD? | YES                                        | ✓                                   |

**The one-commit gap is documentation only.** `88c521b` (`docs(deploy): FLY_API_GATEWAY_DEPLOYMENT_FIX_REPORT`) touches a single markdown file at the repo root. It does NOT change `apps/api-gateway/**`. The api-gateway build artifact from HEAD is byte-identical to the build artifact from `origin/mvp`.

You can either:

- **A (cleaner):** push the docs commit first so origin matches local —

  ```bash
  git push origin mvp
  ```

- **B (zero-risk for this deploy):** proceed; the api-gateway code is unchanged between `df73bda` and `88c521b`. Push the docs after the deploy is verified.

Either is acceptable; A is what the original prompt's success criteria requires.

## Step 2 — Fly app verification ⏸ blocked on auth

I cannot run `fly orgs list` or `fly apps list` from this session because `flyctl auth whoami` returns `Error: no access token available. Please login with 'flyctl auth login'`.

You must run, from your terminal (`!` prefix invokes inline if Claude Code's command-bang is enabled):

```bash
~/.fly/bin/flyctl auth login
```

This opens a browser for OAuth. After completion:

```bash
~/.fly/bin/flyctl auth whoami      # expect: your email
~/.fly/bin/flyctl orgs list         # capture <ORG_SLUG>
~/.fly/bin/flyctl apps list         # expect: lifenavigator-api-gateway MISSING
                                    #         lifenavigator-ingestion-worker MISSING
```

Then create the apps that are missing. Do NOT use `fly launch` — the committed `fly.toml` and `Dockerfile` are the source of truth:

```bash
~/.fly/bin/flyctl apps create lifenavigator-api-gateway --org <ORG_SLUG>
~/.fly/bin/flyctl apps create lifenavigator-ingestion-worker --org <ORG_SLUG>
```

> **Fill in once executed:**
>
> ORG_SLUG = `__________`
> api-gateway existed beforehand? = `YES / NO`
> ingestion-worker existed beforehand? = `YES / NO`
> creation result(s) = `__________`

## Step 3 — API gateway + worker config verification ✓

Verified directly from the committed files at HEAD (`88c521b`):

### `apps/api-gateway/fly.toml`

| Field                          | Value                       | Match expected?                                        |
| ------------------------------ | --------------------------- | ------------------------------------------------------ |
| `app`                          | `lifenavigator-api-gateway` | ✓                                                      |
| `primary_region`               | `iad` (US-East)             | ✓                                                      |
| `[build].dockerfile`           | `Dockerfile`                | ✓                                                      |
| `[http_service].internal_port` | `8080`                      | ✓ matches Dockerfile `EXPOSE 8080` + `--port 8080`     |
| `[[http_service.checks]].path` | `/healthz`                  | ✓ matches handler at `apps/api-gateway/app/main.py:59` |

### `apps/api-gateway/Dockerfile`

| Layer      | Value                                                         |
| ---------- | ------------------------------------------------------------- |
| Base image | `python:3.12-slim`                                            |
| `ENV PORT` | `8080`                                                        |
| `EXPOSE`   | `8080`                                                        |
| `CMD`      | `uvicorn app.main:app --host 0.0.0.0 --port 8080 --workers 2` |

The FastAPI app is correctly wired: container listens on `:8080`, fly.toml's HTTP service routes there, fly's HTTP health check probes `/healthz`, the route handler exists in code. **No generated Fly config is needed; do NOT run `fly launch`.**

### `apps/ingestion-worker/fly.toml` (for Step 8 use)

| Field                | Value                                                         |
| -------------------- | ------------------------------------------------------------- |
| `app`                | `lifenavigator-ingestion-worker`                              |
| `primary_region`     | `iad`                                                         |
| `[build].dockerfile` | `Dockerfile`                                                  |
| `[processes].worker` | `ingestion-worker` (the compiled binary name)                 |
| `[http_service]`     | **absent** — long-running worker, no HTTP, no health endpoint |

### `apps/ingestion-worker/Dockerfile`

| Layer         | Value                       |
| ------------- | --------------------------- |
| Builder stage | `rust:1.83-slim AS builder` |
| Runtime stage | `debian:bookworm-slim`      |
| `ENTRYPOINT`  | `["ingestion-worker"]`      |

Two-stage Rust build; binary copied into a slim debian runtime; no public port. Correct shape for a background worker.

## Step 4 — Secret readiness ⏸ blocked on auth

Cannot run `fly secrets list` without `flyctl auth`. Here are the **expected** secret sets per app (from `.env.example` + Dockerfile + fly.toml inspection):

### api-gateway — 15 secrets required

```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_JWT_SECRET
SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY
QDRANT_URL
QDRANT_API_KEY
QDRANT_PERSONAL_COLLECTION
QDRANT_CENTRAL_COLLECTION
NEO4J_URI
NEO4J_USERNAME
NEO4J_PASSWORD
NEO4J_PERSONAL_DATABASE
NEO4J_CENTRAL_DATABASE
ALLOWED_ORIGINS
```

Stage them once the app exists:

```bash
~/.fly/bin/flyctl secrets set -a lifenavigator-api-gateway --stage \
  SUPABASE_URL='https://<project>.supabase.co' \
  SUPABASE_ANON_KEY='<anon-jwt>' \
  SUPABASE_JWT_SECRET='<jwt-secret>' \
  SUPABASE_SERVICE_ROLE_KEY='<service-role-jwt>' \
  GEMINI_API_KEY='<AIza...>' \
  QDRANT_URL='https://<cluster>.qdrant.io:6333' \
  QDRANT_API_KEY='<qdrant-key>' \
  QDRANT_PERSONAL_COLLECTION='life_navigator' \
  QDRANT_CENTRAL_COLLECTION='ln_central' \
  NEO4J_URI='neo4j+s://<id>.databases.neo4j.io' \
  NEO4J_USERNAME='neo4j' \
  NEO4J_PASSWORD='<neo4j-password>' \
  NEO4J_PERSONAL_DATABASE='neo4j' \
  NEO4J_CENTRAL_DATABASE='central' \
  ALLOWED_ORIGINS='https://lifenavigator.app,https://*.vercel.app'
```

`--stage` defers restart until the next `fly deploy`, avoiding a wasted machine cycle.

### ingestion-worker — 10 secrets required

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY
QDRANT_URL
QDRANT_API_KEY
QDRANT_PERSONAL_COLLECTION
NEO4J_URI
NEO4J_USERNAME
NEO4J_PASSWORD
NEO4J_PERSONAL_DATABASE
```

Note: the worker uses `SUPABASE_SERVICE_ROLE_KEY` (not anon — it claims cross-user from `graphrag.sync_queue`) and does NOT need `NEO4J_CENTRAL_DATABASE`, `QDRANT_CENTRAL_COLLECTION`, `SUPABASE_JWT_SECRET`, `SUPABASE_ANON_KEY`, or `ALLOWED_ORIGINS`.

```bash
~/.fly/bin/flyctl secrets set -a lifenavigator-ingestion-worker --stage \
  SUPABASE_URL='https://<project>.supabase.co' \
  SUPABASE_SERVICE_ROLE_KEY='<service-role-jwt>' \
  GEMINI_API_KEY='<AIza...>' \
  QDRANT_URL='https://<cluster>.qdrant.io:6333' \
  QDRANT_API_KEY='<qdrant-key>' \
  QDRANT_PERSONAL_COLLECTION='life_navigator' \
  NEO4J_URI='neo4j+s://<id>.databases.neo4j.io' \
  NEO4J_USERNAME='neo4j' \
  NEO4J_PASSWORD='<neo4j-password>' \
  NEO4J_PERSONAL_DATABASE='neo4j'
```

> **Fill in once executed:**
>
> api-gateway secrets present after `fly secrets list`? = `15 of 15 / __ of 15 / staged`
> worker secrets present after `fly secrets list`? = `10 of 10 / __ of 10 / staged`

## Step 5 — Redeploy command (api-gateway)

After Steps 2 and 4 are confirmed:

```bash
cd apps/api-gateway
pwd                                                # must show .../life-nav-mvp/apps/api-gateway
ls fly.toml Dockerfile                             # must both exist
~/.fly/bin/flyctl deploy -a lifenavigator-api-gateway --remote-only
```

`--remote-only` builds on Fly's remote builder (no local Docker required).

## Step 6 — Deploy log verification

The deploy log must **not** show `42eee30`. Two ways to confirm:

1. The deploy log header lists the working tree's source. Inspect for:

   ```
   ==> Building image with Docker
   --> docker buildx build ...
   ```

   If the build is driven by `fly deploy --remote-only` from your local checkout, the SHA in the log will reflect HEAD. To cross-verify, record:

   ```bash
   git rev-parse HEAD                               # 88c521b...
   ```

   immediately before deploy. The deploy is shipping THAT tree.

2. **The Fly + GitHub integration is the failure mode that produced `42eee30`.** Until the integration is disconnected or repointed to branch `mvp` HEAD, do not re-trigger it. The manual `fly deploy --remote-only` in Step 5 bypasses GitHub entirely.

> **If the deploy log shows `42eee30` or any SHA before `df73bda`:** the GitHub integration is still firing. Disconnect it in the Fly dashboard (App → Settings → GitHub Integration → Disconnect) and rerun Step 5 from your local checkout.

## Step 7 — Health verification (api-gateway)

After the deploy reports success:

```bash
~/.fly/bin/flyctl status -a lifenavigator-api-gateway
# expect: at least one machine in `started`, region iad, image label deployment-<id>

~/.fly/bin/flyctl logs -a lifenavigator-api-gateway
# expect: uvicorn startup lines, no Python tracebacks, no "settings.X is required" errors

curl -fsS https://lifenavigator-api-gateway.fly.dev/healthz
# expect: {"status":"ok"}

# Verify auth gate (proves middleware is loaded — should refuse unauth):
curl -sS -o /dev/null -w "%{http_code}\n" \
  https://lifenavigator-api-gateway.fly.dev/api/compliance/check
# expect: 401
```

A failure pattern to watch for in `fly logs`:

- `settings.GEMINI_API_KEY is required` → missing secret; re-stage and redeploy.
- `Connection refused (neo4j+s://...)` → Neo4j credentials wrong or instance unreachable from `iad`.
- `Could not connect to Qdrant` → same for Qdrant.

> **Fill in once executed:**
>
> `/healthz` HTTP status = `__________`
> compliance route status (expect 401) = `__________`
> startup logs clean? = `YES / NO + first error line`

## Step 8 — Worker readiness

**Only run this section after the api-gateway is healthy (Step 7 all checks ✓).** The worker depends on the same Neo4j + Qdrant + Supabase + Gemini secrets; if any of those didn't work for the gateway, they won't work for the worker either, and you'll burn a deploy diagnosing the same secret bug twice.

```bash
~/.fly/bin/flyctl secrets list -a lifenavigator-ingestion-worker
# If missing any of the 10 keys listed in Step 4, run the Step-4 worker secrets-set command.

cd apps/ingestion-worker
~/.fly/bin/flyctl deploy -a lifenavigator-ingestion-worker --remote-only

~/.fly/bin/flyctl status -a lifenavigator-ingestion-worker
# expect: one machine in `started`, no HTTP checks (this app has none).

~/.fly/bin/flyctl logs -a lifenavigator-ingestion-worker | head -40
# expect:
#   INFO ingestion_worker: starting (region=iad)
#   INFO ingestion_worker::queue: claimed 0 jobs from sync_queue
# every WORKER_POLL_INTERVAL_SECONDS (=5s).
```

If the worker's first 30 s of logs show the queue-claim line above, the Supabase service-role + GraphRAG sync_queue read path is live.

---

## Summary — what is and is not blocking

| Layer                                           | State                                                  | Block?                                 |
| ----------------------------------------------- | ------------------------------------------------------ | -------------------------------------- |
| Local git tree                                  | clean, on `mvp`, `df73bda` in history                  | ✗ no                                   |
| Local repo vs origin                            | one docs-only commit ahead                             | ✗ no (push optional)                   |
| `apps/api-gateway/fly.toml` + Dockerfile        | correct, port + healthcheck match                      | ✗ no                                   |
| `apps/ingestion-worker/fly.toml` + Dockerfile   | correct, worker entry good                             | ✗ no                                   |
| `flyctl` installed                              | `~/.fly/bin/flyctl v0.4.57`                            | ✗ no                                   |
| `flyctl` authenticated                          | **NO** — `no access token available`                   | **YES — must run `flyctl auth login`** |
| Fly app `lifenavigator-api-gateway` exists      | unknown (prior log said `app not found` → presumed NO) | **YES — must run `fly apps create`**   |
| Fly app `lifenavigator-ingestion-worker` exists | unknown                                                | **YES — must run `fly apps create`**   |
| Fly secrets staged on api-gateway               | unknown (presumed empty on new app)                    | **YES — must stage 15**                |
| Fly secrets staged on ingestion-worker          | unknown (presumed empty on new app)                    | **YES — must stage 10**                |
| Fly + GitHub integration safe to use            | **NO** — produced the `42eee30` failure                | sidestep with manual `fly deploy`      |

---

## Exact next-command sequence (run from your shell)

```bash
# 1. Authenticate Fly CLI (browser).
~/.fly/bin/flyctl auth login

# 2. Confirm.
~/.fly/bin/flyctl auth whoami
~/.fly/bin/flyctl orgs list                  # capture <ORG_SLUG>
~/.fly/bin/flyctl apps list                   # confirm both apps missing

# 3. Create both apps.
~/.fly/bin/flyctl apps create lifenavigator-api-gateway     --org <ORG_SLUG>
~/.fly/bin/flyctl apps create lifenavigator-ingestion-worker --org <ORG_SLUG>

# 4. Stage api-gateway secrets (15 keys — see Step 4 above).
~/.fly/bin/flyctl secrets set -a lifenavigator-api-gateway --stage \
  SUPABASE_URL='...' SUPABASE_ANON_KEY='...' ... ALLOWED_ORIGINS='...'

# 5. Deploy api-gateway.
cd apps/api-gateway
~/.fly/bin/flyctl deploy -a lifenavigator-api-gateway --remote-only

# 6. Verify api-gateway.
curl -fsS https://lifenavigator-api-gateway.fly.dev/healthz

# 7. Stage worker secrets (10 keys — see Step 4 above).
~/.fly/bin/flyctl secrets set -a lifenavigator-ingestion-worker --stage \
  SUPABASE_URL='...' SUPABASE_SERVICE_ROLE_KEY='...' ... NEO4J_PERSONAL_DATABASE='neo4j'

# 8. Deploy worker.
cd ../ingestion-worker
~/.fly/bin/flyctl deploy -a lifenavigator-ingestion-worker --remote-only

# 9. Tail worker.
~/.fly/bin/flyctl logs -a lifenavigator-ingestion-worker | head -40
```

When Step 6 returns `{"status":"ok"}`, the verdict in this report flips to:

```
API_GATEWAY_DEPLOYED_READY_FOR_WORKER
```

When Step 9 shows the queue-claim log line, both Fly apps are live.

---

## Final verdict (at this commit, this session)

```
NOT_READY_MISSING_APP
```
