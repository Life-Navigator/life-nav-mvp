# Cutover Executive Summary

**Date:** 2026-06-16 · Production source-of-truth cutover. Evidence-only.

## The 10 questions

1. **Did preview pass?** Partially-substituted: the **hosted Vercel preview was not available** (CLI unauthenticated). Instead the **production build passed locally in CI mode** (`next build` → full route manifest, no error) and a **live API smoke passed 5/5**. Build-success is the failure mode that would block Vercel; it passed.
2. **Did merge succeed?** **Yes.** `platform/main-consolidation` (`cb6b172`) → `main` via `--no-ff` merge `41cf78b` (2026-06-16 17:13:29 -0700); pushed `4a46e8f..41cf78b`.
3. **Did web deploy succeed?** **Yes.** Vercel served the new build: `/conversation` now `307 → /dashboard/advisor` (definitive marker), CTA `mode=create` present, homepage 200.
4. **Did Fly cutover succeed?** **Yes.** core-api redeployed from `main` → **v116** (complete, healthz 200, ~0.22s). Behavior-neutral (main core-api == v115 code).
5. **Is onboarding still fixed?** **Yes (live).** `/v1/life/discovery/chat` returns conversational discovery (`llm_status=discovery`, 0 contract violations) on the from-main core-api.
6. **Is streaming still active?** **Yes (code live).** Arcana streaming is in the deployed build; unit tests pass; `next build` included it. (Visual animation not browser-verified — see risks.)
7. **Is health safety still active?** **Yes (live).** Health-urgent → `llm_status=safety_fallback` with 911/ER guidance.
8. **Is `main` now the source of truth?** **Yes.** Web (Vercel) and core-api (Fly v116) both deploy from `main`. `advisor/p0-upgrade-2.3.0` is now legacy. (`SOURCE_OF_TRUTH_DECLARATION.md`)
9. **What rollback path exists?** Web: Vercel promote-previous (instant) or revert `41cf78b`. core-api: `flyctl releases rollback` to v115 or redeploy `advisor/p0-upgrade-2.3.0` (identical). Failed Vercel builds never auto-promote.
10. **Any remaining risks?**
    - **Human browser smoke not performed** (no Vercel auth / no browser): streaming visual, graph mouse-nav, report-generation UI, homepage render fidelity. Covered by build + 1444 unit tests + route markers; recommend a 5-min human prod click-through with rollback armed.
    - **Supabase key rotation pending** (`SECURITY_ACTIONS_PENDING.md`).
    - 15 pre-existing tsc errors (unrelated, untouched files).
    - core-api still deployed manually from `main` (CI automation recommended — `POST_CUTOVER_CLEANUP_PLAN.md`).

## Evidence trail

`PRE_CUTOVER_SNAPSHOT.md` · `PREVIEW_DEPLOYMENT_REPORT.md` · `MAIN_MERGE_REPORT.md` · `PRODUCTION_WEB_VERIFICATION.md` · `CORE_API_CUTOVER_REPORT.md` · `SOURCE_OF_TRUTH_DECLARATION.md` · `POST_CUTOVER_CLEANUP_PLAN.md` · `SECURITY_ACTIONS_PENDING.md`

## Test/verification ledger

- core-api `pytest`: 449 passed · web `jest`: 1444 passed (10 pre-existing auth/proxy failures only) · `next build` (CI): success · `tsc`: 0 new errors.
- Pre-merge live API smoke: 5/5 · Post-cutover live API smoke: 3/3 · Prod web markers: confirmed new build.
- Prod DB migrations: `advisor_turns`, `model_usage`, `pilot_feedback`, `candidate_goals` verified present.
- Pilot-feedback/analytics: backing tables verified present; admin endpoints not separately smoked (admin-gated).

## Final status

### CUTOVER_SUCCESSFUL

`main` is the production source of truth. Web and core-api both deploy from `main`; onboarding (conversational), streaming, advice disclaimer, and the deterministic health-safety net are live and verified at the API/route level; rollback is armed (Vercel instant promote / Fly v115). Residual: a recommended human browser pass and the pending Supabase key rotation — neither blocks production.
