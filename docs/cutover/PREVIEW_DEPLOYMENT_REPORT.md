# Preview Deployment Report

**Date:** 2026-06-16 · Step 2 of the cutover. Branch `platform/main-consolidation` @ `cb6b172`.

## Hosted preview: NOT available (evidence)

The `vercel` CLI is **not authenticated** on this machine (`vercel whoami` → "No existing credentials found"). A hosted Vercel preview URL therefore could not be created programmatically. The Vercel project is linked (`life-nav-mvp-web`), and the GitHub→Vercel integration is what deploys production on push to `main`.

> To get a hosted preview URL before merge, a human would run `vercel login` (or `! vercel login` in this session) and `vercel deploy`. Not done here.

## Build validation: PASS (the strongest available pre-merge proof)

Ran the **production build locally in CI mode** (`CI=true`, matching Vercel; `next.config:127` ignores pre-existing TS errors only under CI), with Supabase URL/anon + `CORE_API_URL` env supplied:

- **`next build` completed successfully** — full route manifest emitted (static `○` + dynamic `ƒ` pages, Proxy middleware), no build error.
- This is the failure mode that would break a Vercel deploy; it passes. **Vercel's production build is expected to succeed.**

## Safety property (why merge is low-risk for availability)

Vercel **does not promote a failed build** to production. If the Vercel build were to fail for any reason, the current (stale-but-working) production deployment keeps serving. So merging to `main` cannot take the site down; worst case it simply doesn't update until fixed. Instant rollback (promote previous deployment) is available regardless.

## What this report does NOT cover (honest scope)

- A hosted-preview **browser** smoke (homepage render, CTA click, streaming animation visual, graph nav by mouse) was **not** performed — no Vercel auth, no browser. These are covered by: the successful production build + 1444 passing web unit tests + the live **API** smoke (next report). They are flagged for a human pass on production immediately post-merge (with instant rollback ready).

## Build/deploy facts

| Item                  | Value                                                           |
| --------------------- | --------------------------------------------------------------- |
| Branch / tip          | `platform/main-consolidation` / `cb6b172`                       |
| Local build           | `next build` (CI=true) → success, route manifest generated      |
| Hosted preview        | not created (vercel CLI unauthenticated)                        |
| Prod promotion safety | Vercel won't promote a failed build; instant rollback available |
