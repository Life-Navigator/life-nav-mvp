# Dashboard Reorder Report (Monday Pilot UX Cleanup)

**Scope:** Layout / hierarchy / polish only. No new intelligence, models, or data. No
architecture rebuild. No fabricated data — every honest empty state preserved.

## Final top-to-bottom order

1. **DashboardClient** — operational overview (Welcome back · Financial / Healthcare / Career /
   Education / Family Overviews · Alerts & Notifications · Active Goals · Quick Actions). Now the
   FIRST thing the user sees.
2. **LifeBrief** — compact, collapsible narrative card (was a full-bleed dark hero). See
   `LIFE_BRIEF_COLLAPSE_REPORT.md`.
3. **ExecutiveSummary** — the page's SINGLE readiness ring + grounded vision / next-best-action /
   priorities / risks / opportunities / goal progress.
4. **MissionControl** — enriched next-best-action + onboarding/activation CTA. Its own
   readiness/index ring is hidden.

`LifeIntelligence` is removed from the dashboard (internal reasoning surface).

## File:line changes

### `apps/web/src/app/dashboard/page.tsx`

- **Lines 1–8 (imports):** Removed `import LifeIntelligence from '@/components/dashboard/LifeIntelligence'`.
  Replaced with an explanatory comment noting the component file is intentionally kept (can live
  behind "My Life" later) and must not be re-added without that decision.
- **Lines ~64–89 (render):** Reordered the JSX tree. `<DashboardClient .../>` now renders FIRST,
  followed by the `<div>` wrapper containing `<LifeBrief />`, `<ExecutiveSummary />`,
  `<MissionControl />` (in that order). `<LifeIntelligence />` usage deleted. Wrapper padding
  changed from `pt-6` to `pb-6` since it is no longer the top of the page. Added an ordering
  comment documenting the new top→bottom sequence.

### `apps/web/src/components/dashboard/DashboardClient.tsx`

- **Above `interface DashboardData`:** Added `const SHOW_FEATURE_VOTING = false;` with a comment
  explaining the pilot gate and how to re-enable.
- **"Future Modules Voting Section" (the `Help Shape the Future` block, ~line 1070):** Wrapped the
  entire voting `<div>` in `{SHOW_FEATURE_VOTING && ( ... )}`. The voting modules (Habit Tracker,
  Social Network, AI Life Coach, Milestone Celebrations), the `votedModules` UI, the `handleVote`
  handler, the `futureModules` list, and the `votedModules`/`setVotedModules` state are all kept
  intact — just gated. Flip the flag to `true` to restore.

### `apps/web/src/components/dashboard/MissionControl.tsx`

- Removed the `RING` color-map constant (only the hidden ring used it).
- Removed `const s = d.status;` and `const ring = RING[...]` (now unused after the ring removal).
- Removed the "Your Life Readiness" status tile (the `w-20 h-20 rounded-full border-4` ring showing
  `s.index` + `s.headline` + `s.summary`). Replaced the 3-column grid with a single-column grid so
  the Next-Best-Action card spans the full width. The NBA, journey progress, gaps, and
  missing-documents sections are unchanged.

### `apps/web/src/components/dashboard/ExecutiveSummary.tsx`

- Removed the "· {confidence}% confidence" and "· {discovery_completion_pct}% discovered" debug tags
  from the confirmed-vision primary-objective line.
- Removed the "(inferred from your onboarding)" label and the "{X}% discovered so far" sentence from
  the still-forming branch. (The `objective_inferred` / `confidence_pct` /
  `discovery_completion_pct` fields remain in the interface — just no longer rendered here.)

### `apps/web/src/components/dashboard/LifeIntelligence.tsx`

- **Unchanged.** File retained, no longer imported/rendered by the dashboard.

## Feature-voting gate

`SHOW_FEATURE_VOTING` (in `DashboardClient.tsx`) is `false` for the pilot. The entire
"Help Shape the Future" voting UI is wrapped behind it. No code was deleted — re-enable by setting
the flag to `true`.

## LifeIntelligence removal

Removed from `page.tsx` import + render. The component (`LifeIntelligence.tsx`) is pure internal
reasoning (primary/competing objectives + confidence%) and is kept on disk for a future "My Life"
surface.

## Ring reconciliation (single ring rule)

The dashboard previously showed **two** readiness rings:

- ExecutiveSummary's `ReadinessRing` (SVG ring, `life_readiness.overall`).
- MissionControl's status circle (`Your Life Readiness`, `status.index`).

**Resolution:** ExecutiveSummary keeps THE single ring. MissionControl's ring/status tile is
removed entirely. MissionControl now renders only the next-best-action (full width) + journey +
gaps.

## Verification

- `pnpm -C apps/web type-check` — PASS (0 errors).
- `eslint` on all 5 changed files — PASS (0 errors, 0 warnings).
- `jest` MissionControl.test.tsx + ExecutiveSummary.test.tsx — 8/8 PASS.
