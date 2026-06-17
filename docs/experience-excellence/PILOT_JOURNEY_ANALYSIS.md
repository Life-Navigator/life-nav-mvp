# Pilot Journey Analysis

**Date:** 2026-06-16 · The end-to-end experience of a single pilot user (VC / exec / founder / advisor / attorney / CPA / power-user), step by step, with the real surfaces each step touches and the experience verdict after this sprint.

## The journey

| #   | Step                      | Real surface                                                                                    | State after this sprint                                                                                                 |
| --- | ------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | Land / invite             | magic-link auth (Resend SMTP live, `.tech` domain)                                              | ✅ Works; invite-only beta                                                                                              |
| 2   | Onboarding conversation   | Arcana discovery via `/discovery/chat[/stream]` (LLM-free RelationshipManager, narrative-first) | ✅ Conversational, narrative-aware questions (5/5 personas live, core-api v119)                                         |
| 3   | **The reveal**            | end-of-discovery → dashboard                                                                    | ⚠️ Life Brief is on the dashboard; the full-screen end-of-discovery reveal is the next P0 (HOLY_SHIT_MOMENT_DESIGN.md)  |
| 4   | First dashboard           | `dashboard/page.tsx` → `/v1/life/my-life`                                                       | ✅ **Life Brief now leads** (this sprint); percentages demoted below                                                    |
| 5   | "Why does it think that?" | provenance badges, `/life-graph/explainable`, why_chain                                         | ⚠️ Rich data exists; under-surfaced (EXPLAINABILITY_LAYER.md) — no nav link to the best graph                           |
| 6   | Recommendations           | `/dashboard/recommendations` (full), dashboard hero (thin)                                      | ⚠️ Engine is elite; `why_ranking`/quantified impact dropped on first-impression surfaces (RECOMMENDATION_EXCELLENCE.md) |
| 7   | The Life Graph            | `/life-graph` + `/life-graph/explainable`                                                       | ⚠️ Data layer elite; renders as ontology hairball, not a story (GRAPH_EXPERIENCE_REDESIGN.md)                           |
| 8   | Executive report          | `/dashboard/reports` (download-only)                                                            | ⚠️ Real report engine exists; no in-app viewer; doesn't lead with the brief (EXECUTIVE_REPORT_EXCELLENCE.md)            |
| 9   | Return visit              | recent-intelligence feed, attention/alerts                                                      | ✅ "Feels alive" feed exists; delta-on-brief is a P2                                                                    |

## Where the journey is strong

- **Discovery is genuinely conversational and narrative-aware** — the thing that was "terrible" at the start of this arc is fixed and validated on real personas.
- **The first-impression moment now leads with the person's story** (Life Brief), not our architecture.
- **Trust spine holds:** 0 fabrication; honest empty states; grounded risks/recs only.

## Where the journey still leaks (prioritized)

1. **P0 — The reveal isn't staged.** The brief exists but the highest-attention instant (end of discovery) doesn't yet dramatize it. Frontend-only.
2. **P0 — Best work is invisible on first-impression surfaces.** `why_ranking`, quantified impact, the explainable graph, the report viewer — all built, all under-linked. Surfacing-only.
3. **P1 — Two divergent graph pages** (`/life-graph` vs `/life-graph/explainable`) confuse the trust story; consolidate.
4. **P1 — Goal-progress reconciliation:** ExecutiveSummary reads `/api/goals`, a different store from the life model's `goal_portfolio` (GOAL_PROGRESS_SYSTEM.md §5).

## The pilot-feeling verdict

The **understanding** half ("this gets me") is now real end-to-end through step 4. The **usefulness/depth** half (steps 5–8) is all built in the backend but **under-surfaced** — every remaining gap is an encoding/layout/linking task, not new intelligence. That is exactly the sprint's premise, and it means the path to an excellent pilot is short and low-risk.
