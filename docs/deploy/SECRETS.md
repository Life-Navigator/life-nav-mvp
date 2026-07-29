# Secrets and Deployment Automation

**Owner:** Lead Principal Engineer · **Date:** 2026-07-29
**Status:** automation shipped; secret population and rotation are OWNER ACTIONS (see §6).

GitHub is the single source of truth for every credential. CI pushes them outward — to Fly, to Supabase
Edge Functions — on each deploy. Nothing is set by hand on a platform console, because hand-set values
drift silently and never appear in a diff.

```
                    ┌─────────────────────────┐
                    │  GitHub repo secrets    │  ← the only place a human types a credential
                    └───────────┬─────────────┘
                                │  (on push to main)
        ┌───────────────────────┼────────────────────────┐
        ▼                       ▼                        ▼
  scripts/ci/fly_secrets.sh   supabase secrets set    Vercel (see §4 — NOT synced from here)
  per-app manifest            + supabase db push
        │
        ▼
  3 Fly apps, least privilege
```

---

## 1. Why this exists

Two credentials leaked while CI passed on every commit (`CREDENTIAL_INCIDENT_REPORT.md`), the second one
a **production database password, public on `origin/main` for five weeks**. Both got there the same way:
a credential was needed somewhere, so it was typed into a file. Every value in a file is a value that can
be committed.

A second, quieter class of failure motivated the validation logic: **an unset GitHub secret expands to an
empty string, not an error.** `flyctl secrets set QDRANT_API_KEY=` deploys an app that cannot reach
Qdrant, and the symptom is "retrieval returns nothing" — indistinguishable from a user with no data. The
same shape as the traversal defect fixed in `59869f8d`. So the tooling refuses to deploy on a missing or
empty required secret rather than shipping a silently broken service.

---

## 2. Repository secrets to create

**Settings → Secrets and variables → Actions → New repository secret.** Names are case-sensitive and must
match exactly.

### Core credentials

| Secret                                            | Used by                                 | Notes                                                                                                 |
| ------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `FLY_API_TOKEN`                                   | all 3 Fly deploys                       | `flyctl tokens create org`. The current one is a **personal** stopgap — replace it with an org token. |
| `SUPABASE_URL`                                    | core-api, worker                        | `https://<ref>.supabase.co`                                                                           |
| `SUPABASE_ANON_KEY`                               | core-api                                | Public-safe, but kept here so one place governs all of them.                                          |
| `SUPABASE_JWT_SECRET`                             | core-api, **api-gateway**               | The gateway's _only_ Supabase value — it verifies tokens, it never calls Supabase.                    |
| `SUPABASE_SERVICE_ROLE_KEY`                       | core-api, worker                        | **Bypasses every RLS policy.** Never give this to api-gateway (§3).                                   |
| `SUPABASE_ACCESS_TOKEN`                           | edge functions, migrations              | Management PAT from supabase.com/dashboard/account/tokens                                             |
| `SUPABASE_PROJECT_REF`                            | edge functions, migrations              | Project ref, e.g. `diwkyyahglnqmyledsey`                                                              |
| `SUPABASE_DB_PASSWORD`                            | migrations                              | **The value exposed in LN-SEC-2026-0729-02.** Rotate before setting (§6).                             |
| `GEMINI_API_KEY`                                  | core-api, worker, api-gateway, edge fns | Backend only — never reaches Vercel.                                                                  |
| `QDRANT_URL` / `QDRANT_API_KEY`                   | core-api, worker, api-gateway, edge fns |                                                                                                       |
| `NEO4J_URI` / `NEO4J_USERNAME` / `NEO4J_PASSWORD` | core-api, worker, api-gateway, edge fns |                                                                                                       |
| `PLAID_CLIENT_ID` / `PLAID_CLIENT_SECRET`         | core-api (optional)                     | Backend only.                                                                                         |
| `PRIVATE_BETA_ALLOWLIST`                          | core-api (optional)                     | Comma-separated emails. A secret because it is personal data.                                         |
| `ADMIN_EMAILS`                                    | core-api (optional)                     | Same reasoning.                                                                                       |

### Repository **variables** (not secrets)

**Settings → Secrets and variables → Actions → Variables.** These are configuration, they are not
sensitive, and burying them in the secret store makes production behaviour unreadable to whoever is
debugging it.

| Variable                                                                  | Default     | Effect                                                                    |
| ------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------- |
| `GRAPH_GROUNDING_ENABLED`                                                 | `false`     | Master switch for graph retrieval.                                        |
| `GRAPH_RETRIEVAL_V2`                                                      | `true`      | Semantic engine vs legacy flat retriever. Inert while the above is false. |
| `MODEL_PROVIDER`                                                          | `ai_studio` | `vertex` to use ADC instead of an API key.                                |
| `VERTEX_PROJECT` / `VERTEX_REGION`                                        | —           | Only read when `MODEL_PROVIDER=vertex`.                                   |
| `PLAID_ENV`                                                               | `sandbox`   |                                                                           |
| `PRIVATE_BETA_ENABLED`                                                    | —           | Beta gate.                                                                |
| `WORKER_BATCH_SIZE`, `WORKER_MAX_RETRIES`, `WORKER_POLL_INTERVAL_SECONDS` | —           | Worker tuning.                                                            |

---

## 3. Least privilege is enforced, not documented

`scripts/ci/fly_secrets.sh` holds a per-app manifest. The manifests differ **on purpose**:

|                             | core-api | ingestion-worker        | api-gateway                  |
| --------------------------- | -------- | ----------------------- | ---------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅       | ✅                      | ❌ **never**                 |
| `SUPABASE_JWT_SECRET`       | ✅       | ❌ (verifies no tokens) | ✅ (its only Supabase value) |
| Store credentials           | ✅       | ✅                      | ✅                           |

The gateway's three Supabase variables were removed on 2026-07-29 after an audit found **zero read sites**
(`GATEWAY_PRIVILEGE_REDUCTION.md`); `app/config.py` raises if code reaches for them. A naive "sync all
secrets to all apps" step would hand the RLS bypass straight back with nothing in the diff to notice. The
manifest is what prevents that, and the env-var count per job in `deploy-fly.yml` (8 vs 22) makes the
asymmetry visible in review.

Verify a manifest without touching Fly:

```bash
scripts/ci/fly_secrets.sh api-gateway --check-only
```

---

## 4. Vercel — deliberately NOT synced from GitHub

The web app deploys through **Vercel's own Git integration**, not through Actions, so its environment
variables live in Vercel project settings. Two reasons not to change that:

1. Vercel builds run on push regardless of whether Actions succeeded. Syncing env vars from a workflow
   would create a race in which a build starts before its configuration lands.
2. `NEXT_PUBLIC_*` values are compiled into the client bundle. They are not secrets and treating them as
   such implies a confidentiality the browser does not provide.

**The frontend must never hold `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, or any store credential.**
All model and store access goes through the Fly backend. To inspect what is actually set:

```bash
vercel env ls production
```

---

## 5. GCP / Vertex — use Workload Identity Federation, not a key

Vertex is reached via **Application Default Credentials**; org policy disallows API keys
(`vertex-adc-model-auth`). Do **not** put a service-account JSON key in a GitHub secret — it is a
long-lived credential of exactly the kind this document exists to eliminate.

Use keyless OIDC instead:

```yaml
permissions:
  id-token: write
steps:
  - uses: google-github-actions/auth@v2
    with:
      workload_identity_provider: projects/<num>/locations/global/workloadIdentityPools/<pool>/providers/<provider>
      service_account: <sa>@<project>.iam.gserviceaccount.com
```

GitHub mints a short-lived token per run; nothing durable is stored. Note that Vertex from **Fly** is a
separate problem — Fly machines are not GitHub runners and cannot use this federation. That path remains
blocked on the owner-run `gcloud auth application-default login`, which is the longest-lead-time item in
the remediation plan.

---

## 6. Cutover runbook — rotate everything, then populate

Ordered so that no window exists in which a rotated credential is live but unset.

1. **Rotate at each provider.** Supabase DB password (**LN-SEC-2026-0729-02 — this one is public**),
   Supabase service-role key + JWT secret, Gemini key, Qdrant key, Neo4j password, Fly org token
   (replacing the personal stopgap), Supabase management PAT.
2. **Set every value in GitHub repo secrets** using the names in §2.
3. **Set the repository variables** in §2. Leave `GRAPH_GROUNDING_ENABLED=false` — it is gated on a
   measured retrieval win, not a config edit (`evals/retrieval/`).
4. **Verify manifests before deploying:**
   ```bash
   for a in core-api ingestion-worker api-gateway; do scripts/ci/fly_secrets.sh $a --check-only; done
   ```
   With the values exported locally this passes only when every required name is present and non-empty.
5. **Push to `main`.** CI stages each app's secrets, deploys the three Fly apps, syncs Edge Function
   secrets, and applies pending migrations.
6. **Confirm the old credentials are dead** — the previous incident was only closed by testing that the
   old value was rejected. Do this from a machine that is not a production host.
7. **Purge the now-unused values** from Fly (`flyctl secrets unset`) and any local `.env`.

### Still owner-blocked after this

| Item                                        | Why it cannot be automated                                                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `gcloud auth application-default login`     | Interactive; gates Phase 8 live eval and the Vertex advisor path.                                                                           |
| Supabase auth-log review (residual **R-3**) | Console-only; now covers a real database credential, not just synthetic accounts.                                                           |
| Session revocation (residual **R-1**)       | GoTrue admin endpoint returned 404.                                                                                                         |
| Git-history decision (residual **R-2**)     | Rotation makes the historical values inert. Rewriting ~30 branches removes a string, not a risk. Recommendation stands: **do not rewrite**. |

---

## 7. Local development

Never export a production credential into a shell for routine work.

`apps/lifenavigator-core-api/.env` is gitignored (`**/.env`) and read automatically by `Settings`. That is
the correct home for local values, including the Qdrant/Neo4j credentials the retrieval eval needs:

```bash
cd apps/lifenavigator-core-api
python evals/retrieval/build_golden.py survey     # proves connectivity, prints no secrets
```

Before committing, `gitleaks` runs in the pre-commit hook. Install it — a warning-only hook is what let
the second credential through:

```bash
# linux arm64; use _linux_x64 on Intel
curl -sSL https://github.com/gitleaks/gitleaks/releases/download/v8.28.0/gitleaks_8.28.0_linux_arm64.tar.gz \
  | tar -xz -C ~/.local/bin gitleaks
scripts/security/gitleaks_canary.sh    # proves the scanner detects planted credentials
```
