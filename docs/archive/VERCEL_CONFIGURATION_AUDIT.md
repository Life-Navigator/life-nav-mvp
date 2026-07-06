# Vercel Configuration Audit

**Date:** 2026-06-03
**Repo:** `Life-Navigator/life-nav-mvp` (pnpm monorepo), branch `mvp`
**Symptom:** `No Output Directory named 'public' found after the Build completed.`

---

## TL;DR

The error is **not** coming from the project that serves the app. There are **three** Vercel projects wired to this one repo, and the failing one is a **misconfigured duplicate**:

| Vercel project                              | Framework   | Root                   | Output            | Node     | Purpose                            | Status                                                   |
| ------------------------------------------- | ----------- | ---------------------- | ----------------- | -------- | ---------------------------------- | -------------------------------------------------------- |
| **`life-nav-mvp-web`** (`prj_Ecx1…`)        | **Next.js** | **apps/web**           | `.next`           | **20.x** | the Next.js web app                | ✅ correct — **production live, governed chat verified** |
| `graphrag-pipeline` (`prj_…`)               | Other       | apps/graphrag-pipeline | —                 | 24.x     | Python GraphRAG (`@vercel/python`) | ✅ correct for a Python project — leave as-is            |
| **`life-navigator-monorepo`** (`prj_FWNN…`) | **Other**   | **`./`**               | **None→`public`** | **24.x** | (rogue duplicate of the web app)   | ❌ **this is the one failing**                           |

`life-navigator-monorepo` builds `mvp` at root `./` with Framework=Other. Next produces `.next` under `apps/web`, but a generic (Other) project at root `./` looks for a **static `public/`** directory at the repo root → _"No Output Directory named 'public'."_

**Recommendation:** don't turn the duplicate into a second copy of the app. **Use `life-nav-mvp-web`** (already correct, already deployed `mvp@8c26f42`, already has every env var, governed chat already verified) and **delete** the rogue `life-navigator-monorepo` project (it has no custom domain). Reconfiguring the duplicate is possible but would require re-adding ~25 env vars and would double-build on every `mvp` push.

---

## 1. Repository structure (verified)

- **Monorepo manager:** pnpm. `pnpm-workspace.yaml` → `packages: ['apps/*', 'packages/*']`. Root `package.json` has **no** npm `workspaces` field (pnpm-only). `packageManager: "pnpm@9.15.0"`.
- **Node:** `engines.node = "20.x"` (root `package.json`). No `.nvmrc` / `.node-version`. → **Node 20.x is the repo's declared version.**
- **Task runner:** `turbo.json` present (tasks: build, lint, type-check, test, dev, clean). Root build script = `turbo run build`.
- **The Next.js app:** `apps/web` (`@life-navigator/web`), `build: "next build"`, Next **16.2.6**. → **`apps/web` is the correct application root.**
- **vercel.json files:**
  - `apps/web/vercel.json` → `{ framework: "nextjs", installCommand: "pnpm install", buildCommand: "next build", … }` — **correct, no conflict.** It is only read when a project's Root Directory = `apps/web`.
  - `apps/graphrag-pipeline/vercel.json` → `@vercel/python` builds — belongs to the `graphrag-pipeline` project only.
  - **No** `vercel.json` at the repo root.

Conclusion: the monorepo fully supports Vercel deployment **from `apps/web`** — pnpm workspace + turbo + the committed `apps/web/vercel.json` all align. The lockfile lives at the repo root, so the build must be allowed to read files **outside** `apps/web` (see §6).

## 2. Current Vercel configuration (live, via API)

### `life-navigator-monorepo` — the failing project

```
framework:                       null   (= "Other")
rootDirectory:                   null   (= repo root "./")
buildCommand:                    null   (zero-config)
installCommand:                  null   (zero-config)
outputDirectory:                 null   (→ "public" if it exists, else ".")
nodeVersion:                     24.x
sourceFilesOutsideRootDirectory: true
git:                             Life-Navigator/life-nav-mvp, productionBranch=main
recent deploys:                  ERROR (mvp@98f8db3), ERROR (mvp@8c26f42)
custom domain:                   none (life-navigator-monorepo.vercel.app only)
```

### `life-nav-mvp-web` — the correct reference (already live)

```
framework:                       nextjs
rootDirectory:                   apps/web
buildCommand:                    null   (Next.js default → next build; apps/web/vercel.json also sets it)
installCommand:                  corepack enable && corepack prepare pnpm@9.15.0 --activate && pnpm install --frozen-lockfile=false
outputDirectory:                 .next
nodeVersion:                     20.x
sourceFilesOutsideRootDirectory: true
git:                             Life-Navigator/life-nav-mvp, productionBranch=main
production:                      serving mvp build; /api/agent/chat round trip = 200, governance APPROVE
```

## 3. Recommended configuration

**Preferred — consolidate on `life-nav-mvp-web` (no changes needed):** it already matches the target spec and is live. Then **delete** `life-navigator-monorepo`. Optionally set `life-nav-mvp-web`'s Production Branch → `mvp` in the dashboard (API can't change it; see the deploy fix report).

**Alternative — if you insist on using `life-navigator-monorepo`,** set it to:

| Setting                    | Value                                                                         |
| -------------------------- | ----------------------------------------------------------------------------- |
| Framework Preset           | **Next.js**                                                                   |
| Root Directory             | **`apps/web`**                                                                |
| Build Command              | **blank / unset** (Next.js default `next build`; or `pnpm build`)             |
| Install Command            | **blank / unset** (Vercel uses pnpm from `packageManager`; or `pnpm install`) |
| Output Directory           | **blank / unset** (Next.js → `.next`). **Never `public`.**                    |
| Node Version               | **20.x** (matches `engines.node`; **not** 24.x)                               |
| Include Files Outside Root | **ON / enabled** (required — see §6)                                          |

…and then add the full env-var set (§5) and retire `life-nav-mvp-web` to avoid two projects building the same app.

## 4. Risks

- **Two live projects on one repo (if you reconfigure instead of delete):** every `mvp` push triggers **two** builds and yields **two** production URLs — confusing and wasteful; risks drift between them.
- **Node 24.x:** reintroduces the corepack/pnpm `URLSearchParams`/`ERR_INVALID_THIS` fetch failures that bit this repo earlier. Pin **20.x**.
- **Output Directory = `public`:** the exact misconfiguration causing the failure. Leaving it blank lets the Next.js preset route to `.next`.
- **Missing env vars on the reconfigured duplicate:** it currently has none of the app's env (it was a static-site project) → API routes, Supabase, governance, etc. would 500 at runtime even after the build succeeds.
- **Root `./` with Framework=Other:** Vercel can't know to serve `.next`; it treats output as a static folder. Setting Framework=Next.js + Root=`apps/web` is what fixes it.

## 5. Required environment variables (only if reconfiguring `life-navigator-monorepo`)

`life-navigator-monorepo` currently has **no app env vars**. To run the app it would need the same set `life-nav-mvp-web` already has (production + preview), including:
`NEXT_PUBLIC_API_URL` (→ Fly gateway), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `SUPABASE_ANON_KEY`, `GRAPHRAG_WORKER_SECRET`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `INTEGRATION_ENCRYPTION_KEY`, the `POSTGRES_*` set, `NEXT_PUBLIC_APP_URL`, and the `NEXT_PUBLIC_ENABLE_*` feature flags. **This is the strongest reason to use `life-nav-mvp-web` instead** — it already has them.

## 6. "Include files outside root directory"

**Must be ENABLED.** This is a pnpm workspace: `apps/web` depends on `packages/*` (`workspace:*`) and the single `pnpm-lock.yaml` lives at the repo root. With Root Directory = `apps/web`, the build must read those parent-level files. Both `-web` projects already have `sourceFilesOutsideRootDirectory: true`. (Vercel auto-detects this for monorepos, but keep it on explicitly.)

## 7. Does deploying from `apps/web` break anything? — verified NO

`life-nav-mvp-web` **already** builds from `apps/web` and was exercised end-to-end this session, so this is observed, not assumed:

| Concern                                | Verdict     | Evidence                                                                           |
| -------------------------------------- | ----------- | ---------------------------------------------------------------------------------- |
| API routes (`apps/web/src/app/api/**`) | ✅ included | `/api/agent/chat` returned 200 on production                                       |
| Supabase integration                   | ✅          | governed handler authenticated via Supabase session; audit rows written            |
| GraphRAG                               | ✅          | chat retrieved + answered via `graphrag-query` Edge Function                       |
| Governance layer                       | ✅          | response `governance.verdict = approved`; `decision_governance_audit` row written  |
| Character layer                        | ✅          | `character_score_overall = 1.000` recorded on the audit row                        |
| Economic governance                    | ✅          | `economic.usage_events` row written (`feature=chat`, `cost_usd_micros=390000`)     |
| Dashboard routes                       | ✅          | part of the same `apps/web` Next.js build (route manifest includes `/dashboard/*`) |
| Authentication                         | ✅          | cookie-based Supabase auth; unauth `/api/agent/chat` → 307 `/auth/login`           |

External services are reached over HTTP via env vars, so the Vercel **build root** has no bearing on them:

| Service                 | Compatible | How the web app reaches it                                        |
| ----------------------- | ---------- | ----------------------------------------------------------------- |
| Fly.io API gateway      | ✅         | `NEXT_PUBLIC_API_URL`                                             |
| Fly.io worker           | ✅         | indirect (Supabase `graphrag.sync_queue`)                         |
| Supabase Edge Functions | ✅         | `${SUPABASE_URL}/functions/v1/graphrag-query` + `x-worker-secret` |
| Neo4j Aura              | ✅         | via the Edge Function / Fly gateway (not from the browser)        |
| Qdrant                  | ✅         | via the Edge Function / Fly gateway (not from the browser)        |

## 8. Validation steps

1. Confirm the deploying commit is `8c26f42` or newer (current `mvp` HEAD = `98f8db3`; `98f8db3` only touches a Supabase Edge Function, not `apps/web`, so the web build is identical to `8c26f42`).
2. Build log should show `Detected Next.js`, install via pnpm 9.15, `✓ Compiled successfully`, **and no "public" lookup**.
3. `curl -I https://<prod-domain>/` → `200`.
4. `curl -sS -o /dev/null -w "%{http_code}" -X POST https://<prod-domain>/api/agent/chat` (unauth) → `307` to `/auth/login` (route present, auth enforced).
5. Authenticated round trip → `200` + a row each in `governance.decision_governance_audit` and `economic.usage_events`.

(Steps 3–5 already pass on `life-nav-mvp-web`.)

---

## Exact settings to enter

If you reconfigure `life-navigator-monorepo` (otherwise just use `life-nav-mvp-web`, which is already set this way):

```
Framework Preset:            Next.js
Root Directory:              apps/web
Build Command:               (blank — Next.js default;  or  pnpm build)
Install Command:             (blank — pnpm via packageManager;  or  pnpm install)
Output Directory:            (blank — Next.js → .next.  NEVER public)
Node Version:                20.x
Include Files Outside Root:  ON (enabled)
```
