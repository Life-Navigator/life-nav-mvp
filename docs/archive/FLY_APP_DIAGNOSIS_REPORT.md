# Fly App Diagnosis Report

**Date:** 2026-06-02
**Repository:** `life-nav-mvp`
**Symptom under investigation:** `https://life-nav-mvp.fly.dev/` returns HTTP 404 after a deploy that Fly reported as "successful".
**Investigator account:** `techavenger83@gmail.com` (Fly org `personal`)

---

## Verdict

```
LIFE-NAV-MVP IS A REAL DEPLOY OF THE COMMITTED API-GATEWAY CODE — IT IS NOT A ROGUE.
THE 404 IS CAUSED BY (a) FLY TRIAL MACHINES AUTO-STOPPING AT 5 MIN + (b) NO SECRETS SET.
LIFENAVIGATOR-API-GATEWAY DOES NOT EXIST.
```

This contradicts my earlier hypothesis that `life-nav-mvp` was an accidental auto-launch from the GitHub integration. The data shows it was a manual `fly launch` you ran against the api-gateway code, and the deploy actually worked — uvicorn started, served requests, then got SIGINT'd by Fly's trial-machine timer.

---

## Questions 1–6 — answered from the actual `flyctl` output

### 1. Which Fly apps currently exist?

```
NAME         OWNER     STATUS     LATEST DEPLOY
life-nav-mvp personal  suspended  17m18s ago
```

**One app: `life-nav-mvp`. That's it.** `lifenavigator-api-gateway` does not exist. `lifenavigator-ingestion-worker` does not exist.

### 2. Which app was deployed by mistake?

**Neither — but the wrong NAME was used.** `life-nav-mvp` is your FastAPI code running correctly. Evidence from `fly logs`:

```
INFO:     Waiting for application shutdown.
INFO:     Application shutdown complete.
INFO:     Finished server process [649]
```

These are uvicorn lifecycle messages. The container started, ran the FastAPI app, and shut down cleanly. The image label is `life-nav-mvp:deployment-0aa97a0cf6f9f71f524410a98dda816d`, deployed by you 19 min ago (release v1).

Looking at `fly config show -a life-nav-mvp` vs the committed `apps/api-gateway/fly.toml`:

| Field                | Committed                   | Deployed           | Match?                |
| -------------------- | --------------------------- | ------------------ | --------------------- |
| `app`                | `lifenavigator-api-gateway` | `life-nav-mvp`     | **NO** — wrong name   |
| `primary_region`     | `iad`                       | `lax`              | **NO** — wrong region |
| `internal_port`      | `8080`                      | `8080`             | yes                   |
| health check `path`  | `/healthz`                  | `/healthz`         | yes                   |
| `[env]`              | GEMINI + LOG_LEVEL          | GEMINI + LOG_LEVEL | yes                   |
| `[build].dockerfile` | `Dockerfile`                | `Dockerfile`       | yes                   |
| VM                   | 1 CPU / 512 MB              | 1 CPU / 512 MB     | yes                   |

So `life-nav-mvp` is the committed api-gateway config with two field overrides (app name → `life-nav-mvp`, region → `lax`). This is the signature of someone running `fly launch` on top of the committed fly.toml and either typing the repo name when prompted, or accepting a default that derived from the parent directory.

### 3. Does `lifenavigator-api-gateway` exist?

**NO.**

```
$ fly status -a lifenavigator-api-gateway
Error: Could not find App "lifenavigator-api-gateway"

$ fly config show -a lifenavigator-api-gateway
Error: app not found (Request ID: 01KT4YX2VCHX8WRA3ASKEAWCJX-lax)
```

### 4. Should `life-nav-mvp` be destroyed?

**Depends on your preference. Both options are defensible.**

#### Option A — Keep `life-nav-mvp`, update the committed config

You already have a working deploy of the FastAPI app under this name. To keep it:

1. Edit `apps/api-gateway/fly.toml`: change `app = "lifenavigator-api-gateway"` → `app = "life-nav-mvp"`, and `primary_region = "iad"` → `primary_region = "lax"`.
2. Update every doc that mentions `lifenavigator-api-gateway` (DEPLOYMENT_SEQUENCE.md, FLY_PROVISIONING_RUNBOOK.md, FLY_API_GATEWAY_DEPLOYMENT_FIX_REPORT.md, etc.).
3. Update Vercel's `NEXT_PUBLIC_API_URL` to `https://life-nav-mvp.fly.dev`.

#### Option B — Destroy `life-nav-mvp`, deploy under the committed name (RECOMMENDED)

The committed config is the audit trail. Naming everything `lifenavigator-api-gateway` keeps the Sprint S/T documentation honest:

```bash
~/.fly/bin/flyctl apps destroy life-nav-mvp
~/.fly/bin/flyctl apps create lifenavigator-api-gateway --org personal
# then secrets + deploy from apps/api-gateway/
```

You lose 19 minutes of trial-deploy work, no user-facing data because no secrets were set, no customers because no DNS is wired.

### 5. What exact commands should be run next?

#### Why the deploy 404s right now — read first

The single line in `fly logs` that explains everything:

```
runner[817152a9de3468] lax [warn] Trial machine stopping.
To run for longer than 5m0s, add a credit card by visiting https://fly.io/trial.
```

The Fly account is on the unverified trial. Trial VMs run for 5 minutes total per instance, then Fly kills them with SIGINT. The two machines listed in `fly status` are both in `stopped` state for exactly this reason. The app status is `suspended` — that's what Fly calls it after the trial timer fires.

Also: `fly secrets list -a life-nav-mvp` returned ZERO secrets. So even if the trial issue were fixed, the FastAPI app would crash at request time as soon as it tried to load `SUPABASE_URL`, `GEMINI_API_KEY`, etc. The current container only "works" because uvicorn started before it ever tried to call upstream — the moment a real request comes in, it would 500 on missing config.

#### The two paths

Both start with the same prerequisite:

```bash
# REQUIRED before either path will work:
# Add a credit card at https://fly.io/trial . Without it, every deploy
# gets killed at 5 minutes regardless of which app name you use.
```

##### Path A (keep `life-nav-mvp`)

```bash
# 1. Edit apps/api-gateway/fly.toml: app = "life-nav-mvp", primary_region = "lax"
# 2. Update related docs.
# 3. Set the 15 secrets:
~/.fly/bin/flyctl secrets set -a life-nav-mvp --stage \
  SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_JWT_SECRET=... \
  SUPABASE_SERVICE_ROLE_KEY=... GEMINI_API_KEY=... \
  QDRANT_URL=... QDRANT_API_KEY=... \
  QDRANT_PERSONAL_COLLECTION='life_navigator' QDRANT_CENTRAL_COLLECTION='ln_central' \
  NEO4J_URI=... NEO4J_USERNAME='neo4j' NEO4J_PASSWORD=... \
  NEO4J_PERSONAL_DATABASE='neo4j' NEO4J_CENTRAL_DATABASE='central' \
  ALLOWED_ORIGINS='https://lifenavigator.app,https://*.vercel.app'

# 4. Resume the suspended app + deploy.
cd apps/api-gateway
~/.fly/bin/flyctl deploy -a life-nav-mvp --remote-only
~/.fly/bin/flyctl status -a life-nav-mvp        # expect at least one machine `started` in lax

# 5. Verify.
curl -fsS https://life-nav-mvp.fly.dev/healthz   # expect {"status":"ok"}
```

##### Path B (destroy + redeploy under committed name — RECOMMENDED)

```bash
# 1. Destroy the misnamed app.
~/.fly/bin/flyctl apps destroy life-nav-mvp     # answers `y`

# 2. Create the real app per the committed config.
~/.fly/bin/flyctl apps create lifenavigator-api-gateway --org personal

# 3. Stage the 15 secrets (same list as Path A, just different -a target).
~/.fly/bin/flyctl secrets set -a lifenavigator-api-gateway --stage \
  SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_JWT_SECRET=... \
  SUPABASE_SERVICE_ROLE_KEY=... GEMINI_API_KEY=... \
  QDRANT_URL=... QDRANT_API_KEY=... \
  QDRANT_PERSONAL_COLLECTION='life_navigator' QDRANT_CENTRAL_COLLECTION='ln_central' \
  NEO4J_URI=... NEO4J_USERNAME='neo4j' NEO4J_PASSWORD=... \
  NEO4J_PERSONAL_DATABASE='neo4j' NEO4J_CENTRAL_DATABASE='central' \
  ALLOWED_ORIGINS='https://lifenavigator.app,https://*.vercel.app'

# 4. Deploy from apps/api-gateway/ — the cd is mandatory.
cd apps/api-gateway
~/.fly/bin/flyctl deploy -a lifenavigator-api-gateway --remote-only

# 5. Verify.
curl -fsS https://lifenavigator-api-gateway.fly.dev/healthz   # expect {"status":"ok"}
```

### 6. What URL should return `/healthz`?

Depends on which path you take:

| Path                                        | URL                                                 |
| ------------------------------------------- | --------------------------------------------------- |
| A (keep `life-nav-mvp`)                     | `https://life-nav-mvp.fly.dev/healthz`              |
| B (destroy + recreate under committed name) | `https://lifenavigator-api-gateway.fly.dev/healthz` |

In either case, the same FastAPI app responds. Fly assigns `https://<app-name>.fly.dev` automatically; the handler at `apps/api-gateway/app/main.py:59` does the work.

---

## Other findings from this inspection

- **Region drift.** The deployed app is in `lax`, not `iad`. The committed config says `iad`. Path B fixes this (`iad`); Path A locks in `lax`. Practical difference for an internal-beta is small (a few ms latency for SFO/IAD-resident users), but it should match the runbook.
- **`fly orgs list`** confirms the only org is `personal` (Timothy Riffe). No team org exists yet. For an internal beta this is fine; for production you may want a team org.
- **No secrets staged on `life-nav-mvp`.** If you take Path A and run the deploy without staging the 15 secrets first, the FastAPI app will start but fail every real request. The current deploy "works" only at the uvicorn level — the upstream calls would all fail.

---

## Field summary (now factual, not placeholders)

```
Org slug                          : personal
Apps that exist                   : life-nav-mvp (only)
Apps that should exist            : lifenavigator-api-gateway, lifenavigator-ingestion-worker
App that's running                : life-nav-mvp (config differs from committed: name + region)
App pinned to old commit 42eee30? : NO — it's running release v1 from a recent fly launch + deploy
Trial limit hit?                  : YES — trial machines stop at 5 min; credit card required at https://fly.io/trial
Secrets configured on running app : 0 of 15 required
fly status                        : life-nav-mvp suspended; both machines stopped in lax
Cause of 404                      : machines stopped by trial timeout AND no secrets to serve real requests
Recommended path                  : Path B — destroy life-nav-mvp, create lifenavigator-api-gateway per committed config
```

---

## Next single command

If you accept Path B:

```bash
# 1. First, add a credit card at https://fly.io/trial — without this every redeploy hits the same 5-min wall.
# 2. Then:
~/.fly/bin/flyctl apps destroy life-nav-mvp
```

If you prefer Path A:

```bash
# 1. Add the credit card first.
# 2. Then resume + stage secrets, in that order. I can prep the apps/api-gateway/fly.toml edit in the repo if you want.
```

Either way the credit card is the blocking step. Without it, no Fly app on this account will stay up.
