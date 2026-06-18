# Dashboard Visual Regression Fix

**Date:** 2026-06-18 · Surgical styling fix. No layout-order, data-logic, feature, or backend changes. **Status: DASHBOARD_VISUAL_FIXED.**

## Root cause

The previous "collapse" sprint, when making the Life Brief compact, **swapped the premium dark navy/teal gradient hero for a pale `indigo-50 → white` light card with gray text** — and the MissionControl Next-Best-Action card was a pale `bg-indigo-50` with `text-gray-500/400` muted copy. Both regressed to low-contrast, washed-out "generic white card" looks (pale text on near-white). Nothing was wrong with the data or layout — only the color treatment.

## Fix

### Your Life Brief (`LifeBrief.tsx`)

Restored the **premium dark gradient** treatment for the compact card (keeping the collapse/expand behavior):

- Card shell: `bg-gradient-to-br from-[#0f172a] via-[#13294b] to-[#0d3a4a]` + `text-white` + `border-indigo-300/40 shadow-md` (was `from-indigo-50 to-white`).
- Headline `text-white`, summary `text-slate-200`, label `text-teal-300` (were gray-900/600/indigo-500).
- Next-move / biggest-risk tiles → `bg-white/[0.06] ring-white/10` with `text-slate-100` body + `text-teal-300`/`text-rose-300` labels (were pale indigo-50/rose-50 tiles with gray text — indigo-on-indigo was the worst offender).
- "View full brief" toggle → `text-teal-300`.
- Expanded detail: goals chips `bg-white/10 text-teal-100`; watching/could-change `bg-white/[0.06] text-slate-200` with teal-300/amber-300 labels; readiness `text-slate-300`; provenance `border-white/10` + `text-slate-400` + chip `bg-white/10 text-slate-200`.
- "Why Arcana believes this" stays a **white sub-card** nested in the expanded dark section → dark text on white = high contrast + clear hierarchy.
- Empty "still forming" state: unchanged (already readable — dark text on light, indigo CTA).

### Your Next Move (`MissionControl.tsx`)

Made the NBA the **bold action card** (distinct from the navy narrative card):

- Card shell: `bg-gradient-to-br from-indigo-600 to-violet-600` + `text-white` + `shadow-md` (was `bg-indigo-50 border-2 border-indigo-200`).
- Title `text-white`, body `text-indigo-50`, impact `text-emerald-200`, "why #1" `text-indigo-100` (bold label `text-white`), confidence `text-indigo-200`.
- CTA → `bg-white text-indigo-700` (high-contrast button on the colored card).

## Before / after behavior

- **Before:** both cards pale/white, gray-on-white and indigo-on-indigo low-contrast; read as generic settings cards.
- **After:** Life Brief = calm premium dark navy/teal; Next Move = bold indigo/violet action card; both high-contrast and readable in light mode. Collapse/expand, data, and order all unchanged.

## Validation

- `pnpm type-check` — PASS. `eslint` (both files) — PASS. `jest` dashboard suites (MissionControl + ExecutiveSummary) — **8/8 PASS** (text-based assertions unaffected — only colors changed).
- States covered by code review: collapsed + expanded Life Brief (both dark/readable), "still forming" empty state (light/readable, unchanged), NBA with recommendation (bold card), NBA confidence/impact/why-#1 (light text on gradient). Overview still first (no order change).
- Screenshots: not available (headless environment) — verified via the rendered class treatments + tests. The standing 10-minute live pilot smoke will visually confirm.

## Files changed

- `apps/web/src/components/dashboard/LifeBrief.tsx`
- `apps/web/src/components/dashboard/MissionControl.tsx`

## Status: **DASHBOARD_VISUAL_FIXED**
