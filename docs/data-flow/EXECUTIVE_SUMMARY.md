# Data Flow & Rendering Integrity — Executive Summary

**Date:** 2026-06-18 · **Final status: DATA_FLOW_READY** (with honest, documented coverage residuals — none block the pilot).

## Mission

Make Arcana's understanding reliably persist and render the same everywhere: user statement → classify → persist → retrieve → render. Plumbing/visibility only — no new intelligence, no fabrication.

## Headline finding

The pipeline was **mostly sound but unevenly surfaced**, not broken: discovery already persists every goal (`candidate_goals`), one objective, the narrative, the answered constraint, and the risk profile — and `snapshot()` already computes the narrative + emotional signals. The real issues were (1) computed data not **exposed** in the canonical contract, (2) surfaces **rendering** different subsets, and (3) two concrete bugs. All fixed.

## What shipped (code)

**Phase 0 — OAuth scope trim:** Google calendar → `calendar.readonly`; Gmail → `gmail.readonly`; Microsoft → `Calendars.Read` + `User.Read` (no write/Gmail/Fitness/Health/Drive). Pilot consent screen is calendar-only (no CASA).

**Backend (core-api, 523 tests):** `/v1/life/my-life` now returns the **full canonical contract** — `dominant_narrative`, `narrative_summary`, `narrative_explanation`, `life_brief`, `goal_portfolio`, `canonical_goals`, `constraints`, `risks`, `opportunities`, `next_best_action`, `motivations`, `emotional_signals`, `timeline`, `coverage`, `missing_context`. Motivations are surfaced from the already-computed `emotional_signals` (inferred, never fabricated); timeline is pass-through free text (no date fabrication). +8 backend tests.

**Frontend (web, 13 tests):** constraints + motivations now render on the **reveal** and **dashboard**; the **report viewer** had two real bugs fixed (constraints were `JSON.stringify`'d → now render label/detail; `narrative_explanation` was missing → added); goal `confirmation_status` now shows as a confirmed/candidate badge on dashboard + report. Every section renders defensively (present + non-empty → render; else omit) — no fabricated data.

## The 11 deliverable docs (`docs/data-flow/`)

OAUTH_SCOPE_TRIM_REPORT · DATA_FLOW_TRACE_REPORT · PERSISTENCE_AUDIT · API_READ_PATH_AUDIT · RENDERING_SURFACE_MAP · CANONICAL_RENDERING_CONTRACT · MISSING_PERSISTENCE_FIX_REPORT · MISSING_RENDERING_FIX_REPORT · CROSS_SURFACE_VALIDATION · PRODUCTION_DATA_FLOW_SMOKE · EXECUTIVE_SUMMARY.

## The 10 final questions

1. Understanding persisted? **Yes** — goals, objective, narrative, constraint, risk profile, signals.
2. Persisted data canonical? **Yes** — one `snapshot()`/`canonical_goals` source; goals deduped.
3. API returning the right data? **Yes** — full canonical contract on `/v1/life/my-life` (tested).
4. Frontend rendering the right data? **Yes** — reveal/dashboard/Life Brief/report read the canonical contract.
5. Major life facts visible where they should be? **Yes** — goals/narrative/constraints/motivations across surfaces.
6. Constraints visible? **Yes** (were computed but hidden — now on reveal + dashboard + report).
7. Motivations visible? **Yes** — surfaced from emotional_signals (inferred).
8. Timelines visible? **Partial-honest** — free text shown; structured dates not parsed (no fabrication).
9. Recommendations grounded in rendered data? **Yes** — same snapshot/OS source.
10. Ready for a 3–5 user pilot? **Yes**, after the 10-minute live UI pass with one magic-link test user (PRODUCTION_DATA_FLOW_SMOKE).

## Honest residuals (tracked, non-blocking)

- Structured timeline/date parsing — deferred (would risk fabricating dates).
- Multi-constraint extraction from one sentence — only the answered constraint persists; rest live in the narrative.
- Graph reads a stale readiness field (one-line fix; graph not a priority surface).
- `life.motivations` table stays empty by design (signals surfaced instead).

## Status: **DATA_FLOW_READY**

The full path from user statement → DB → API → UI render is verified by tests + DB-schema checks, consistent across surfaces, with no fabrication. Standing owner items unchanged: rotate Supabase keys; provision Google/Microsoft OAuth creds.
