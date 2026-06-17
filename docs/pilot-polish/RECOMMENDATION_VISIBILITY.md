# Recommendation Impact Visibility

Sprint: Pilot Polish — make Arcana's intelligence VISIBLE.
Scope: surface ALREADY-COMPUTED recommendation fields that were dropped or buried. No new
models/agents/infra/DB. No fabricated data — honest empty states only.

## Goal

The recommendations roadmap already computes WHY each rec exists, its quantified impact, confidence,
supporting evidence, and the ranking rationale — but several of these were hidden in a collapsed drawer
or not tied to the lead card. This sprint pulls "impact" up to the card face and surfaces "why this is
#1" on the top action.

## Surface

`apps/web/src/app/dashboard/recommendations/page.tsx` (the Now / Next / Later roadmap). It reads
`GET /api/recommendations` → core-api `GET /v1/recommendations/roadmap`. An explainability drawer
(`Explainability`, page.tsx:104-251) already existed and is REUSED (not duplicated); it already renders
`why`, evidence, source lineage, assumptions, confidence + formula, and expected impact.

## What changed

1. **"Why this is #1"** badge on the lead ("Now") card — surfaces `roadmap.why_now`
   (= `prioritize.why_ranking.why_number_one`; both come from `_why_first()`, recommendations_os.py:504-522).
   Previously this string was shown as faint header text detached from the card; now it sits on the lead
   card itself with a trophy icon. Only rendered when `lead && whyNumberOne` (honest empty otherwise).

2. **Estimated-impact chips on the card face** — a new `impactChips(a)` helper pulls every
   already-computed `quantified_impact` datapoint (`financial_impact_annual`, `readiness_before/after`,
   `coverage_gap`, `estimated_value`) plus `expected_benefit` into green chips, shown up front instead of
   only the prior single `financial_impact / readiness` line. Renders only when at least one chip exists.

3. **Supporting-evidence count** on the card meta line (`N supporting datapoint(s)`), computed from the
   already-delivered `evidence[]` — signals there is real grounding before the user opens the drawer.

4. Drawer toggle label updated to "Why, impact & evidence" to advertise what's inside.

The full `why` / evidence / source-lineage / assumptions / confidence-formula / expected-impact detail
remains in the reused `Explainability` drawer — no new rendering path was created.

## Files changed (file:line)

- `apps/web/src/app/dashboard/recommendations/page.tsx`
  - L13-14: import `Trophy, TrendingUp`.
  - new `impactChips(Action): string[]` helper (just above `Card`).
  - `Card` signature: added `whyNumberOne?: string` prop; computes `chips` + `evidenceCount`.
  - `Card` body: "Why this is #1" badge (lead only); impact chips block; evidence-count in meta line;
    drawer label "Why, impact & evidence".
  - "Now" section: removed duplicate header `why_now`; passes `whyNumberOne={d.why_now}` to the lead `Card`.

No web route change: `apps/web/src/app/api/recommendations/route.ts` already proxies
`/v1/recommendations/roadmap` and passes the full body through.

## Data mapping

Source: `GET /v1/recommendations/roadmap` → each action shaped by `_shape()` (recommendations_os.py:488-502);
`why_now` from `_why_first()` (recommendations_os.py:504-522, 553).

| UI element                  | Backend field                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| "Why this is #1" (lead)     | `roadmap.why_now` (= `why_ranking.why_number_one`)                                                                       |
| "Why this matters" (drawer) | `action.narrative.why` ?? `action.why`                                                                                   |
| Impact chips                | `action.quantified_impact.{financial_impact_annual,readiness_*,coverage_gap,estimated_value}`, `action.expected_benefit` |
| Supporting datapoint count  | `action.evidence[]` (statement/source_table)                                                                             |
| Confidence                  | `action.confidence` (×100)                                                                                               |
| Source lineage / data used  | `action.evidence[].source_table / .statement` (drawer)                                                                   |

Note: `prioritize` (recommendations_os.py:524-534) returns the same per-action shape plus top-level
`why_ranking.ranked_above`, `needs_more_information[]`, `blocked_by`. The roadmap endpoint (what this page
consumes) already exposes the equivalents (`blocked_by`, `conflicts`, `why_now`) — so we surfaced the
ranking rationale from `why_now` without switching endpoints or adding a new route.

## Honest gaps (do NOT fabricate)

- **"What happens if ignored"** — no such field exists. NOT rendered. There is no per-action link to a
  dependent RISK rec in the roadmap shape, so we cannot derive it without inventing it. **P1**: would
  require core-api to attach a linked-RISK reference (or a real consequence projection) to each action.
  Omitted intentionally.
- **Affected goals** — the drawer still shows "none linked yet" (page.tsx:246); `_shape()` does not emit a
  per-action goals link. Honest empty preserved.
- Impact chips render literally what the backend computed; no chip is shown when no quantified field is
  present (e.g. INFORMATION-type recs) — never a placeholder number.

## Verification

- `pnpm -C apps/web type-check` → pass.
- `npx eslint` on `recommendations/page.tsx` → clean.
