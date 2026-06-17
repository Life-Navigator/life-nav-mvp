# Pilot Dashboard Walkthrough

**Date:** 2026-06-17 · `/dashboard/pilot-analytics` (admin-only) · data: `GET /v1/admin/pilot-analytics`.

## Access

Admin-gated. A non-admin (or unauthenticated) request gets a 403 from core-api, which the proxy passes
through and the page renders as an **"Admin only"** state. Loading and error states are handled.

## Layout (top → bottom)

1. **Pilot Success Gates** — the decision row. Each card shows the metric, its value, the gate threshold,
   and a pass/below-gate color:
   | Card | Source | Gate |
   | --- | --- | --- |
   | Narrative Accuracy | `instruments.averages.narrative_accuracy` | > 8.5 |
   | Trust | `instruments.averages.trust` | > 8.0 |
   | Recommendation Quality | `instruments.averages.recommendation_quality` | > 8.0 |
   | Return Intent | `instruments.averages.return_intent` | > 8.0 |
   | NPS | `feedback.nps_score` | > 50 |
   | Insight Rate | `instruments.insight_rate` | > 70% |
   | Holy-Shit Rate | `instruments.holy_shit_rate` | > 50% |
   A gate is scored only when its response count > 0; otherwise it reads **"No responses yet"** (never a
   fabricated number or a fake pass). Strict greater-than (8.5 exactly = below gate).

2. **Secondary metrics** (averages, count-gated, no pass/fail): understanding, personalization, usefulness,
   actionability, and the executive trio (would_pay, recommend_to_clients, solves_problem).

3. **Advisor & safety:** `advisor.enhanced_rate` (count-gated by total_turns), `safety.safety_fallback_turns`,
   and `instruments.total_feedback_rows`.

## Honest thin-data behavior

The whole point of the dashboard is to **measure reality**, so it never hides how thin the data is:

- `total_feedback_rows === 0` → a page-level "No responses yet" empty state.
- Any individual metric with 0 responses → "No responses yet" on that card.
- Response counts are shown next to averages so a "9.0 from 1 response" is never mistaken for a trend.

## Reading it during the pilot

1. After each of the first 3–5 users, open the dashboard.
2. Check the **gate row** — any red gate is a concrete fix target before the 20-person launch.
3. Cross-read averages vs **response counts** — don't act on n<3.
4. Use **Insight Rate** + **Holy-Shit Rate** as the "did it land?" signals; **Return Intent** + **NPS** as the "will they come back / refer?" signals.
5. Free-text (`comment`, `context.understood_well`, misunderstandings) is stored per row in `pilot_feedback` for qualitative review (not surfaced as a number).

## Where the numbers come from

Every value traces to a real `analytics.pilot_feedback` row submitted by a user through an instrument —
no synthetic seeding. If you see a number, a user produced it.
