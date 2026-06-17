# Pilot Readiness Report — 20-Person Private Beta

**Date:** 2026-06-16 · **Audience:** VC partners, angels, executives, advisors, power AI users.

## Success criteria

| Criterion                       |                Status                | Notes                                                                                   |
| ------------------------------- | :----------------------------------: | --------------------------------------------------------------------------------------- |
| Routing operational             |                  ✅                  | registry-driven, default-off; 27 tests; live Opus needs Vertex SA                       |
| Health safety operational       |             ✅ **LIVE**              | deployed + verified (chest-pain → safety reply, 988 for SI)                             |
| Usage tracking operational      |    ✅ code/migration/RPC + tests     | activate: apply migration + `USAGE_TRACKING_ENABLED`                                    |
| Analytics operational           |    ✅ endpoints + service + tests    | `/v1/admin/pilot-analytics` live (200); full data post-migration; charted UI = frontend |
| Premium enforcement operational |       ✅ logic + tiers + tests       | activate: limits + DB ledger read snapshot                                              |
| Pilot feedback operational      | ✅ endpoint LIVE + migration + tests | `/v1/feedback` 200; persists post-migration; needs a UI button                          |

All backend pieces are built, tested (442 green), and deployed default-safe. The advisor clears 7.5 with one
flag (Gemini Pro), and the health-safety floor is already live.

## Final verdict: **READY_FOR_20_PERSON_PILOT — YES, conditional on a short go-live checklist.**

The safety-critical floor is live and the platform is sound. To run the pilot with feedback capture + analytics

- the best advisor, complete this concrete, low-risk checklist (hours, not a sprint):

1. **Apply the migration** `20260616120000_pilot_routing.sql` (creates model_usage + pilot_feedback + view +
   RPC; additive, RLS-scoped). → feedback persists, usage tracks, analytics fill in.
2. **Flip the advisor to Gemini Pro:** `MODEL_ROUTER_ENABLED=true` + `GEMINI_PRO_ADVISOR_ENABLED=true` (7.60 >
   Flash 6.66). (Or set `GEMINI_GENERATION_MODEL=gemini-2.5-pro` for the simple single-model route.)
3. **Enable tracking:** `USAGE_TRACKING_ENABLED=true` (limits can stay off initially).
4. **Wire the feedback widget** in the web app to `POST /v1/feedback` (thumbs + a periodic NPS prompt). API is
   ready; this is a small frontend add.
5. **(Optional, for premium finance/health):** stand up a **Vertex service account**, then
   `PREMIUM_ROUTING_ENABLED=true` + `CLAUDE_OPUS_4_8_ENABLED=true` → finance 8.82 / health 8.88. Not required
   for launch; Gemini Pro + the safety net is a strong pilot baseline.

## What's already done (no action)

Health-safety net (live), routing engine + graceful degradation + kill switches (deployed, default-off),
feedback + analytics endpoints (deployed, degrade gracefully), usage ledger schema + write path + atomic RPC,
4-tier plan config, full test coverage.

## Honest caveats

- Premium (Opus) routing needs durable Vertex auth (the gcloud-token path expires) — that's why it's gated off.
- Plan-limit **enforcement** (read) runs on the in-memory ledger today; DB-backed enforcement is a small
  snapshot follow-up. **Tracking** is DB-backed.
- The analytics **dashboard UI** is a frontend task; the data/endpoints are ready.
- The migration is **not yet applied to prod** (additive + RLS; apply via your Supabase pipeline).

**Bottom line: ship the pilot on Gemini Pro + the live health-safety net after the 4-step checklist; layer in
premium finance/health (Opus) once the Vertex service account is in place.**
