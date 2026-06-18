# Dashboard Pilot UX Cleanup — Executive Summary

**Date:** 2026-06-18 · **Status: DASHBOARD_PILOT_READY.** Layout/hierarchy/polish only — no new intelligence, models, or architecture.

## The problem

The dashboard led with dense narrative + internal "life-model" reasoning and buried the operational overview (domain cards, alerts, goals, quick actions) at the very bottom. It answered "what does Arcana think?" before "where am I / what do I have / what needs attention / what next?"

## What changed (all 5 required changes shipped)

1. **Core overview moved to the top.** `DashboardClient` (Welcome · Financial/Healthcare/Career/Education/Family Overviews · Alerts & Notifications · Active Goals · Quick Actions) is now the **first** thing the user sees.
2. **Life Brief collapsed.** From a full-bleed dark wall-of-text hero → a compact card (narrative title + 2–3 sentence summary + Next move + Biggest risk) with a **"View full brief"** toggle that reveals the goals, watching/could-change, provenance, and "Why Arcana believes this".
3. **Future-feature voting hidden** (Help Shape the Future / Habit Tracker / Social Network / AI Life Coach / Milestone Celebrations) — gated behind `SHOW_FEATURE_VOTING = false`, code retained.
4. **Internal reasoning moved out.** `LifeIntelligence` (primary/competing objectives + confidence%) removed from the dashboard; ExecutiveSummary's `· inferred` / `confidence X%` / `% discovered` debug labels stripped. The reasoning now lives behind "Why Arcana believes this".
5. **Duplicate readiness rings → one.** MissionControl's readiness/index ring removed; ExecutiveSummary keeps the single ring.

## Verification

- `pnpm type-check` PASS; eslint PASS on all 5 changed files; MissionControl + ExecutiveSummary jest 8/8.
- Structure grep-confirmed: order, voting gate, compact brief, one ring, LifeIntelligence removed.
- Honest residual: the logged-in visual smoke is part of the standing pre-pilot 10-minute live pass.

## Deliverables (`docs/dashboard-pilot/`)

DASHBOARD_UX_AUDIT · DASHBOARD_REORDER_REPORT · LIFE_BRIEF_COLLAPSE_REPORT · PILOT_DASHBOARD_VALIDATION · EXECUTIVE_SUMMARY.

## Result

The dashboard now opens with what the user has and what needs attention, keeps the narrative as a compact (expandable) card, hides unfinished-feeling voting, and shows the model's reasoning only on demand — cleaner, more operational, more trustworthy for Monday. Frontend-only; deploys via Vercel (no core-api change).

## Status: **DASHBOARD_PILOT_READY**
