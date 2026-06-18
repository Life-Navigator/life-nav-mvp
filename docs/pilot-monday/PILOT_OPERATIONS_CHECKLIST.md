# Pilot Operations Checklist (Monday)

**Date:** 2026-06-18 · Verified live where possible.

| Item                                    | Status                 | Detail                                                                                                                                                                                                                                   |
| --------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core API healthy                        | ✅                     | `lifenavigator-core-api` **v125** complete; `/healthz` 200; my-life/goals/feedback/admin all routing (401/405 auth-gated).                                                                                                               |
| Web (Vercel) healthy                    | ✅                     | `https://lifenavigator.tech` → 200. Deploys on push to `main`.                                                                                                                                                                           |
| Migrations applied                      | ✅                     | `pilot_routing` (pilot_feedback + model_usage + summary view), `mcp_ingestion`, `pilot_feedback_metrics` — applied + verified in prod (migration sprint).                                                                                |
| Tests green                             | ✅                     | 525 core-api; web type-check clean; pilot rendering/instrument/integration suites pass.                                                                                                                                                  |
| Rollback documented                     | ✅                     | `flyctl releases rollback` (core-api → v124/earlier); Vercel instant rollback; DB rollback SQL in `docs/migration-execution/MIGRATION_ROLLBACK_PLAN.md`.                                                                                 |
| Edge trust-breaks fixed                 | ✅                     | `/settings/integrations` 404 → `/dashboard/integrations`; OAuth-unconfigured raw-JSON → graceful redirect; stray `/email` app → redirect to coming-soon; dashboard hero enriched; graph readiness read fixed; report impact-key fixed.   |
| Feedback capture                        | ✅ (with caveat)       | Instruments live; pilot_feedback columns applied. **Caveat:** `/v1/feedback` + proxy return `ok:true,stored:false` on a write failure (silent loss) — verify a real write stores in the live smoke.                                      |
| 🔴 **Supabase keys rotated**            | ❌ **PENDING (owner)** | The exposed PAT + service-role/anon keys must be rotated before external users. **Hard blocker.**                                                                                                                                        |
| 🟠 Google OAuth configured              | ❌ Pending (owner)     | `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI` + `INTEGRATION_ENCRYPTION_KEY` in Vercel. **Not a blocker** — calendar now degrades gracefully if absent (Connect → honest redirect, no dead-end). Calendar simply won't be functional until set. |
| 🟠 Microsoft OAuth configured           | ❌ Pending (owner)     | `MICROSOFT_CLIENT_ID/SECRET/TENANT_ID`. Same: optional; degrades gracefully.                                                                                                                                                             |
| Env vars correct                        | ⚠️                     | Confirm `NEXT_PUBLIC_APP_URL=https://lifenavigator.tech` + Supabase + Gemini (Fly) set. Google/MS optional per above.                                                                                                                    |
| Pilot users loaded                      | ⏳ owner               | Add the 20 invitees as Supabase users (magic-link) + as Google OAuth **test users** if calendar is enabled.                                                                                                                              |
| Feedback / support / bug-triage process | ⏳ owner               | Pilot analytics dashboard at `/dashboard/pilot-analytics` (admin); define a support inbox + triage owner.                                                                                                                                |

## The two things that gate launch (both fast)

1. 🔴 **Rotate the Supabase PAT + service-role/anon keys** (minutes; security — non-negotiable).
2. 🟠 **One 10-minute live UI smoke** with a magic-link test user: onboarding → reveal → dashboard → recommendations → report → submit feedback → confirm it appears in `/dashboard/pilot-analytics` (proves the full path + that feedback actually stores).

Everything else is GO.
