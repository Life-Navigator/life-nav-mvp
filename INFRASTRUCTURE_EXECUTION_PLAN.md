# Infrastructure Execution Plan — Internal Beta

**Date:** 2026-06-02
**Decisions locked in by operator:**

- **Supabase:** Path B — use existing `lifenavigator-production` (ref `diwkyyahglnqmyledsey`). Do not create a new project.
- **Fly:** Path B — destroy `life-nav-mvp`, create `lifenavigator-api-gateway` + `lifenavigator-ingestion-worker` per committed config.

---

## Supabase migration safety verdict

```
SAFE_TO_PUSH_WITH_REPAIR
```

The 42 missing migrations are safe to push against `lifenavigator-production` with two caveats: (a) at least one `--dry-run` cycle first to expose any schema-shape collision against tables already in the DB, and (b) the user has stated no real users + no production data, which is what makes the residual risk acceptable.

### Why SAFE_TO_PUSH_WITH_REPAIR, not SAFE_TO_PUSH

Verified across all 42 missing migrations (`061-064, 066-069, 071-104`):

| Risk pattern                   | Found?                                    | Notes                                                                               |
| ------------------------------ | ----------------------------------------- | ----------------------------------------------------------------------------------- |
| `DROP TABLE` (non-idempotent)  | **none**                                  | safe                                                                                |
| `DROP TABLE IF EXISTS`         | none                                      | not needed; tables created with IF NOT EXISTS                                       |
| `DROP SCHEMA` (non-idempotent) | **none**                                  | safe                                                                                |
| `DROP SCHEMA IF EXISTS`        | none                                      | safe — schemas use IF NOT EXISTS for creation                                       |
| `ALTER COLUMN … TYPE`          | **none**                                  | no data-altering type changes                                                       |
| `TRUNCATE`                     | **none**                                  | safe                                                                                |
| `DELETE FROM`                  | **none**                                  | safe                                                                                |
| `CREATE TABLE` total           | 40+ (all with `IF NOT EXISTS`)            | conflict-safe if schema-shape matches                                               |
| `CREATE SCHEMA`                | 14 new schemas (all with `IF NOT EXISTS`) | safe; new schemas are namespace-isolated from `public`                              |
| `DROP POLICY IF EXISTS`        | yes, hundreds                             | this is the standard idempotent "drop and recreate policy" idiom; expected and safe |

**The 13 migrations flagged "destructive" by the first pass all turned out to be DROP POLICY IF EXISTS for RLS re-creation.** That's the textbook pattern for re-runnable migrations. No content-destructive operations exist.

### The residual risk (the "WITH REPAIR" part)

1. **The remote migration history is non-contiguous.** Remote has applied 001-011, 020, 030-040, 050-051, 055, 060, 065, 070 — but NOT 061-064, 066-069. This means at some point migrations 061-064 + 066-069 were skipped (or applied via dashboard SQL editor without registering). Pushing them now does two things:
   - Re-applies the SQL (idempotent if tables exist with the right shape; ERROR if a table exists with a different shape from what these migrations assume).
   - Registers the migration in the history table, fixing the audit trail.
2. **14 new schemas (governance, character, economic, outcome, enterprise, projections, etc.) will spring into existence.** The deployed Edge Functions (March 2026) never reference these schemas — they didn't exist when those functions were deployed — so the existing functions won't break.
3. **Some migrations between 071 and 104 may have inter-dependencies** (e.g. migration 092 may reference an object built in 091). Push them in numeric order via `supabase db push --include-all` and the dry-run will surface any ordering issue.

The reason "REPAIR" matters: if a single migration fails mid-stream, the subsequent ones don't apply, and the remote ends up in a half-state. Repair means re-run from where it stopped after fixing the conflict.

### How to do the safe push (the operator action)

```bash
export SUPABASE_ACCESS_TOKEN='sbp_...'           # the token
export SUPABASE_DB_PASSWORD='<from dashboard>'    # NOT the access token

# Step 1 — Show what would happen, change nothing.
supabase db push --linked --include-all --dry-run -p "$SUPABASE_DB_PASSWORD"

# Step 2 — If dry-run is clean, do the real push.
supabase db push --linked --include-all -p "$SUPABASE_DB_PASSWORD"

# Step 3 — Confirm.
supabase migration list                          # all rows should show both Local + Remote filled
```

I will run steps 1–3 from this session if you provide `SUPABASE_DB_PASSWORD`.

---

## 1. Current status

### Code + git

| Item                                    | Status                                                           |
| --------------------------------------- | ---------------------------------------------------------------- |
| Branch                                  | `mvp`                                                            |
| Local HEAD                              | `88c521b` (one docs-only commit ahead of `origin/mvp = df73bda`) |
| Working tree                            | clean                                                            |
| Sprint T bundle landed in `origin/mvp`? | YES (`df73bda`)                                                  |
| `pnpm build`                            | green (verify-governance prebuild gate passes)                   |
| `npx jest`                              | 1371 / 1371 passing                                              |
| `pnpm verify:governance`                | OK — every model-facing route governed                           |

### Auth + tooling (this session)

| Tool                                              | Installed? | Authenticated?                        |
| ------------------------------------------------- | ---------- | ------------------------------------- |
| `flyctl v0.4.57` at `~/.fly/bin/`                 | ✓          | ✓ techavenger83@gmail.com             |
| `vercel v48.10.6` at `~/.local/share/pnpm/`       | ✓          | ✗                                     |
| `supabase v2.104.0` at `~/.npm-global/bin/`       | ✓          | ✓ via `SUPABASE_ACCESS_TOKEN` env var |
| `gcloud SDK 552.0.0` at `~/google-cloud-sdk/bin/` | ✓          | ✗                                     |

### External services

| Service                                   | State                                                                                                                                                                                                                       |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fly: `life-nav-mvp`**                   | exists, suspended (was on trial), 2 machines `stopped` in `lax`, no secrets. Credit card now added.                                                                                                                         |
| **Fly: `lifenavigator-api-gateway`**      | does NOT exist                                                                                                                                                                                                              |
| **Fly: `lifenavigator-ingestion-worker`** | does NOT exist                                                                                                                                                                                                              |
| **Supabase: `lifenavigator-production`**  | CLI linked. 42 missing migrations. 11 Edge Functions deployed (5 overlap with repo, 6 remote-only: document-ocr + 5 Plaid). 16 secrets set with **drift** (`QDRANT_COLLECTION` singular vs. needed `_PERSONAL`/`_CENTRAL`). |
| **Vercel**                                | unknown — CLI unauthenticated. From Supabase's `OWNER` field on three projects, a Vercel org `icfg_zisfQsrOI3DyZrT3gO83ZZz5` is already linked to LifeNavigator Supabase projects.                                          |
| **Neo4j Aura**                            | not provisioned                                                                                                                                                                                                             |
| **Qdrant Cloud**                          | not provisioned                                                                                                                                                                                                             |
| **Gemini API key**                        | minted at some point (it's set as a Supabase secret), but value not in our hand here                                                                                                                                        |
| **GCP Secret Manager**                    | not configured (optional audit ledger; not on the critical path for beta)                                                                                                                                                   |

### Repo-side config noted but not committed

`supabase/config.toml` has one local edit (removed `min_password_length = 8` because CLI v2.104 rejects it at every nesting level). Local-only; doesn't affect the linked project. Will commit with the next batch if you approve.

---

## 2. Remaining blockers

In priority order — every blocker below has a deterministic next action:

| #   | Blocker                                                                                                                                                                                                       | Resolution                                                                                                                    | Who                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 1   | Need `SUPABASE_DB_PASSWORD` to run `supabase db push --dry-run` against the linked production project                                                                                                         | Get from https://supabase.com/dashboard/project/diwkyyahglnqmyledsey/settings/database (or reset password there if forgotten) | you                                |
| 2   | Fly `lifenavigator-api-gateway` doesn't exist; `lifenavigator-ingestion-worker` doesn't exist                                                                                                                 | I run `fly apps create` for both, then `fly apps destroy life-nav-mvp` (in either order — they're independent)                | me, once you confirm card is added |
| 3   | Neo4j Aura instance not provisioned                                                                                                                                                                           | Console-only; create AuraDB Free at https://console.neo4j.io and save URI + password                                          | you                                |
| 4   | Qdrant Cloud cluster not provisioned                                                                                                                                                                          | Console-only; create cluster at https://cloud.qdrant.io and save URL + API key                                                | you                                |
| 5   | Gemini API key value not available to this session                                                                                                                                                            | Either (a) paste the key here, or (b) mint a new one at https://aistudio.google.com/app/apikey                                | you                                |
| 6   | Vercel CLI not authenticated                                                                                                                                                                                  | Mint token at https://vercel.com/account/tokens (1-day scope) + tell me team slug                                             | you                                |
| 7   | `QDRANT_COLLECTION` (singular) → must be split into `QDRANT_PERSONAL_COLLECTION='life_navigator'` + `QDRANT_CENTRAL_COLLECTION='ln_central'` on both Supabase Edge Function secrets AND new Fly apps' secrets | I do it once secrets are minted                                                                                               | me                                 |
| 8   | `GRAPHRAG_PIPELINE_URL` set on Supabase Edge Function secrets, but the Python service it points at is superseded by the Fly api-gateway                                                                       | Replace with Fly api-gateway URL after gateway deploys                                                                        | me                                 |
| 9   | Some migrations between 061-104 may collide with whatever was applied manually since 070                                                                                                                      | Run dry-run, expect zero or a handful of errors, fix forward                                                                  | me + you depending on error        |
| 10  | Vercel deploy is on stale `42eee30` (Sprint M) — needs to repoint to `df73bda` or later                                                                                                                       | Re-trigger deploy after Vercel env vars are set + Vercel project URL is established                                           | me                                 |

---

## 3. Exact credentials still required

Paste in one block when ready (treat each as day-scoped; rotate after we're done):

```
SUPABASE_DB_PASSWORD=<value>            # from project Database settings, blocker #1
GEMINI_API_KEY=AIza...                  # from AI Studio, blocker #5
VERCEL_TOKEN=<value>                    # from Vercel account tokens, blocker #6
VERCEL_TEAM_SLUG=<value>                # tells me which scope to target
NEO4J_URI=neo4j+s://<id>.databases.neo4j.io   # from Neo4j Aura console, blocker #3
NEO4J_PASSWORD=<value>                  # from Neo4j Aura console
QDRANT_URL=https://<id>.aws.cloud.qdrant.io:6333   # from Qdrant Cloud, blocker #4
QDRANT_API_KEY=qd_...                   # from Qdrant Cloud
```

Optional (not blocking beta):

```
PLAID_CLIENT_ID=...           # sandbox; only if finance integration is in scope for first cohort
PLAID_SANDBOX_SECRET=...
```

**Credentials I do NOT need:**

- Fly billing card number — you handle in dashboard
- Vercel password / GitHub credentials
- Stripe / OAuth client secrets (deferred for first cohort)

---

## 4. Exact next command to execute

You decide the parallelism here. Three orthogonal tracks; each unblocked by a different action you take.

### Track A — Supabase repair (you give me `SUPABASE_DB_PASSWORD`)

```bash
export SUPABASE_DB_PASSWORD='<value>'
supabase db push --linked --include-all --dry-run -p "$SUPABASE_DB_PASSWORD"
```

If dry-run is clean, I follow up with:

```bash
supabase db push --linked --include-all -p "$SUPABASE_DB_PASSWORD"
supabase migration list                          # confirm all 71 are Remote-applied
supabase functions deploy graphrag-query
supabase functions deploy graphrag-sync
supabase functions deploy process-ingestion
supabase functions deploy calendar-sync          # optional first cohort
supabase functions deploy email-sync             # optional first cohort
```

Then I split QDRANT_COLLECTION → PERSONAL+CENTRAL and replace GRAPHRAG_PIPELINE_URL:

```bash
supabase secrets unset QDRANT_COLLECTION GRAPHRAG_PIPELINE_URL
supabase secrets set \
  QDRANT_PERSONAL_COLLECTION='life_navigator' \
  QDRANT_CENTRAL_COLLECTION='ln_central' \
  GRAPHRAG_PIPELINE_URL='https://lifenavigator-api-gateway.fly.dev'    # after Fly deploys
```

### Track B — Fly destroy + create (no operator action needed; card is added)

```bash
~/.fly/bin/flyctl apps destroy life-nav-mvp --yes
~/.fly/bin/flyctl apps create lifenavigator-api-gateway     --org personal
~/.fly/bin/flyctl apps create lifenavigator-ingestion-worker --org personal
```

(I'll run these once you say "go" — destroy is one-way.)

### Track C — Provisioning (only you can do — console-only)

```
1. Open https://console.neo4j.io → create AuraDB Free → save URI + password
2. Open https://cloud.qdrant.io → create cluster (region us-east) → save URL + API key
3. Open https://aistudio.google.com/app/apikey → mint key (skip if you can fetch the existing one from the Supabase secret)
4. Open https://vercel.com/account/tokens → mint 1-day token + note team slug
```

When all three are returned, paste them back in one block.

### Single next command

If I had to pick one to do first, it's **Track B** — it's pre-approved, has no external dependencies, takes 60 seconds, and unblocks the Fly secret-staging step.

```bash
~/.fly/bin/flyctl apps destroy life-nav-mvp --yes
```

Tell me "go" and I run Track B end-to-end (destroy + 2 creates), then sit waiting for Track A's password and Track C's credentials.

---

## 5. Estimated time to beta-ready

| Phase                                              | Wall-clock                   | Owner                             | Parallel?                       |
| -------------------------------------------------- | ---------------------------- | --------------------------------- | ------------------------------- |
| Track B (Fly destroy + 2 creates)                  | 2 min                        | me                                | yes                             |
| Track C-a (Neo4j Aura create)                      | 5–8 min                      | you                               | yes                             |
| Track C-b (Qdrant cluster create)                  | 5–8 min                      | you                               | yes                             |
| Track C-c (Gemini key)                             | 1 min                        | you                               | yes                             |
| Track C-d (Vercel token + team slug)               | 2 min                        | you                               | yes                             |
| Track A (Supabase push + edge-fn deploy)           | 8–12 min                     | me, after you provide DB password | gated on password               |
| Fly secret-staging (api-gateway: 15 keys)          | 1 min                        | me, after Track C complete        | gated                           |
| Fly secret-staging (worker: 10 keys)               | 1 min                        | me, after Track C complete        | gated                           |
| Fly api-gateway deploy + `/healthz` verify         | 4–6 min                      | me                                | sequential after secrets        |
| Fly worker deploy + log-tail verify                | 4–6 min                      | me                                | sequential after gateway        |
| Vercel project link + env vars + redeploy          | 5–8 min                      | me                                | parallel with Fly worker deploy |
| End-to-end smoke (auth → chat → audit row written) | 5 min                        | me + you                          | sequential after Vercel         |
| **TOTAL (parallelized)**                           | **45–60 minutes wall-clock** | mixed                             |                                 |

The bottleneck is **whichever of {Neo4j, Qdrant, Vercel token, Gemini key, DB password} you finish last**. If you can have them ready in 15 minutes from now, beta-ready in roughly 60 minutes.

**Critical-path note:** the Fly api-gateway will fail health check until Supabase migrations are applied (the FastAPI app expects governance/character/economic schemas to exist). So Track A must finish before Fly deploy verification. Sequence them as: Track B (creates) → Track A (Supabase) → Track C (provision) → Fly secret-set → Fly deploy → Vercel redeploy.

---

## Summary

You said yes to Path B Supabase + Path B Fly with the explicit "no real users / no production data" rationale. Given that, the safety profile of the 42 missing migrations is acceptable — no irreversibly destructive operations, all CREATE statements idempotent, the risk is operational (mid-push failure) not data-loss.

To start: **(a) say "go" for Fly Track B**, **(b) paste me the Track C credentials when ready**, and **(c) give me `SUPABASE_DB_PASSWORD`** to do the Supabase dry-run + push. With those three actions on your side, the rest is mechanical and I'll drive from here.
