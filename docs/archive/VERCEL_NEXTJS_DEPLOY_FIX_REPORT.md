# Vercel Next.js Deploy Fix Report

**Date:** 2026-06-03
**Error:** `No Output Directory named 'public' found after the Build completed.`
**Full analysis:** see `VERCEL_CONFIGURATION_AUDIT.md`.

---

## Root cause

The error comes from a **rogue duplicate Vercel project**, not from the project that runs the app. Three Vercel projects point at `Life-Navigator/life-nav-mvp`:

- `life-nav-mvp-web` → **correctly** Next.js / `apps/web` / Node 20.x — **already live in production** with the governed chat verified (`/api/agent/chat` → 200).
- `graphrag-pipeline` → Python (`@vercel/python`), Framework=Other — correct for it; leave alone.
- **`life-navigator-monorepo`** → Framework=**Other**, Root=**`./`**, Output=**`public`**, Node=**24.x** — **this is the failure.** Next builds `.next` under `apps/web`, but a generic project rooted at `./` looks for a static `public/` at the repo root → the error.

## Current vs corrected settings (`life-navigator-monorepo`)

| Setting                    | Current (broken) | Corrected                                               |
| -------------------------- | ---------------- | ------------------------------------------------------- |
| Framework Preset           | Other            | **Next.js**                                             |
| Root Directory             | `./`             | **apps/web**                                            |
| Build Command              | (none)           | **blank** (Next default) or `pnpm build`                |
| Install Command            | (none)           | **blank** (pnpm via `packageManager`) or `pnpm install` |
| Output Directory           | None → `public`  | **blank** (Next → `.next`). **Never `public`.**         |
| Node Version               | 24.x             | **20.x**                                                |
| Include Files Outside Root | on               | **on** (required)                                       |

## Does vercel.json need changes? — No

`apps/web/vercel.json` is already correct (`framework: nextjs`, `installCommand: pnpm install`, `buildCommand: next build`) and does not conflict. It is only read when Root Directory = `apps/web`; the rogue project ignores it today because its root is `./`. No root `vercel.json` exists, and none should be added.

## Does the project root need changing? — Yes (for the rogue project)

The Next.js app root is **`apps/web`**, not `./`. `life-nav-mvp-web` already uses `apps/web`. The rogue project's `./` is the problem.

## Recommendation

**Use `life-nav-mvp-web` and delete `life-navigator-monorepo`** (no custom domain, redundant, would otherwise double-build every push and needs ~25 env vars re-added). `life-nav-mvp-web` already satisfies every requested setting and is serving `mvp@8c26f42`.

If you instead want `life-navigator-monorepo` to be the app: apply the corrected settings above, copy all env vars from `life-nav-mvp-web` (see audit §5), then retire `life-nav-mvp-web`.

## Redeploy

- **`mvp` HEAD is `98f8db3`** (≥ `8c26f42`). `98f8db3` only changes a Supabase Edge Function, so the `apps/web` build is identical to `8c26f42`.
- `life-nav-mvp-web` production already serves this build. To re-trigger explicitly (CLI):
  ```
  VERCEL_ORG_ID=team_uflrwiS0oWnbSXttHk2ou0MO VERCEL_PROJECT_ID=prj_Ecx1NQfhwva1Y2DxYzD4GXhCIrLu \
    vercel deploy --prod --token <token>
  ```
  or in the dashboard: `life-nav-mvp-web` → Deployments → redeploy the latest `mvp` build to Production.
- **Also set `life-nav-mvp-web` Production Branch → `mvp`** (Settings → Git). It currently tracks `main`; the Vercel API can't change this, so it must be done in the UI.

## UI steps (if reconfiguring the rogue project)

1. Vercel → project **`life-navigator-monorepo`** → Settings → Build & Deployment.
2. Framework Preset → **Next.js**.
3. Root Directory → **`apps/web`**; ensure **"Include source files outside of the Root Directory"** is checked.
4. Build Command → leave **Override off** (or `pnpm build`).
5. Output Directory → leave **Override off** (blank). Remove any `public` value.
6. Install Command → leave **Override off** (or `pnpm install`).
7. Settings → General → Node.js Version → **20.x**.
8. Add the env vars from audit §5 (Production + Preview).
9. Deployments → redeploy `mvp` (`8c26f42` or newer) to Production.
