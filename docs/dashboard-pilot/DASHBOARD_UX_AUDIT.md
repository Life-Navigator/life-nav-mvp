# Dashboard UX Audit (before-state)

**Date:** 2026-06-18 · `apps/web/src/app/dashboard/page.tsx` + children. The problem: the dashboard leads with dense narrative + internal reasoning and buries the operational overview at the bottom.

## Current render order (top → bottom)

| #   | Component          | What it shows                                                                                                                                                                                                                                                          | Issue                                                                                                  |
| --- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | `LifeBrief`        | Big dark gradient hero — full narrative paragraph, goal chips, "watching"/"could change", provenance + a "Why Arcana believes this" panel                                                                                                                              | **Too dense for the top**; a wall of text before the user sees what they have                          |
| 2   | `ExecutiveSummary` | Readiness **ring** + vision + primary objective (`· inferred`, `confidence X%`) + NBA + risks/opps + goals + constraints + motivations                                                                                                                                 | Internal-reasoning labels (inferred/confidence) on the dashboard; **readiness ring #1**                |
| 3   | `LifeIntelligence` | Primary objective + `confidence X%`, **Competing objectives**, themes/constraints                                                                                                                                                                                      | **Pure internal/debug reasoning** — exactly what should live behind "Why Arcana believes this"/My Life |
| 4   | `MissionControl`   | Onboarding CTA + enriched Next-Best-Action + an index **ring**                                                                                                                                                                                                         | **Readiness ring #2** (duplicate); NBA overlaps ExecutiveSummary                                       |
| 5   | `DashboardClient`  | **Welcome back · Financial/Healthcare/Career/Education/Family Overview · Alerts & Notifications · Active Goals · Quick Actions** — AND the future-feature **voting** (Help Shape the Future / Habit Tracker / Social Network / AI Life Coach / Milestone Celebrations) | The actual operational overview is **dead last**; future-voting reads as unfinished/internal           |

## Findings vs the four questions the dashboard should answer first

- **Where am I? / What do I have?** → the domain Overviews answer this, but they're at the very bottom.
- **What needs attention?** → Alerts & Active Goals — bottom.
- **What should I do next?** → split across MissionControl NBA + ExecutiveSummary NBA + Alerts preview (duplicated).

## Trust/clutter issues to fix

1. Operational overview (DashboardClient) is last — must move to top.
2. Life Brief is a dense hero — collapse to a compact card with expandable detail.
3. Future-feature voting is visible — gate/hide for the pilot (unfinished-feeling).
4. Internal reasoning (primary/competing objectives, confidence weights, `inferred`/candidate labels, readiness-formula language) is on the main dashboard — move behind "Why Arcana believes this".
5. Two readiness rings (ExecutiveSummary + MissionControl) — keep one.

## Target order (this sprint)

DashboardClient (overview, voting hidden) → compact LifeBrief (expandable) → ExecutiveSummary (one ring, no debug labels) → MissionControl (NBA, no second ring) → LifeIntelligence **removed** from the dashboard.
