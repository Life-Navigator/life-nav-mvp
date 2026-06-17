# Narrative Explainability — "Why Arcana Believes This"

Sprint: Pilot Polish — make Arcana's intelligence VISIBLE.
Scope: surface EXISTING `narrative_explanation` + `life_brief.watching` / `life_brief.could_change`
already computed by the live core-api (v121). No new models/agents/infra/DB. No fabricated data —
honest empty states only.

## Goal

Make the dominant-narrative reasoning legible on the dashboard: WHY Arcana settled on this life
narrative, WHICH goals contributed, WHAT evidence supports it, and HOW confident it is — plus the two
forward-looking grounded lists (what it's watching, what could change the plan).

## Design

`LifeBrief.tsx` already renders the narrative hero (headline / body / goals chips / confidence). This
sprint adds, below the hero (same component, stacked in a `space-y-3` wrapper):

1. Two inline sections inside the hero card:
   - **What Arcana is watching** (`life_brief.watching[]`) — open dependencies + active constraints.
   - **What could change the plan** (`life_brief.could_change[]`) — remaining grounded risks / deadlines.
     Rendered side-by-side (`sm:grid-cols-2`); each renders only when its list is non-empty.

2. A new sibling card **"Why Arcana believes this"** (`WhyArcanaBelieves` component, defined in the same
   file and imported-by-render), reading `narrative_explanation`:
   - "Why this narrative" — the `why` sentence.
   - "Which goals contributed" — `contributing_goals[]` as indigo chips.
   - "What evidence supports it" — `evidence_signals[]` as a bullet list.
   - Confidence — `confidence_label` + `confidence_pct` + `source` as provenance footer.

Honest empty states: `narrative_explanation` is `null` until a narrative exists → `WhyArcanaBelieves`
returns `null` (renders nothing). `watching` / `could_change` empty → those sections are omitted. The
hero's existing `ready:false` "still forming" state is untouched.

## Files changed (file:line)

- `apps/web/src/components/dashboard/LifeBrief.tsx`
  - L12: import added icons `Lightbulb, Eye, GitCompareArrows`.
  - L23-24: `LifeBriefData` extended with `watching?: string[]` and `could_change?: string[]`.
  - L29-39: new `NarrativeExplanation` interface (mirror of backend shape).
  - L41-66: added `why` state + populated from `m.narrative_explanation` in the existing fetch.
  - L~91-178: ready-state return wrapped in `space-y-3`; added "What Arcana is watching" /
    "What could change the plan" grid; appended `<WhyArcanaBelieves why={why} />`.
  - L~180-262: new `WhyArcanaBelieves` function component.

No web route change needed: `apps/web/src/app/api/life/my-life/route.ts` already passes the full
`/v1/life/my-life` body through, so `narrative_explanation` and `life_brief.watching/could_change`
arrive untouched.

## Data mapping

Source: `GET /v1/life/my-life` (core-api).

- `my_life.py:209` returns top-level `narrative_explanation` (= `snap.narrative_explanation`).
- `narrative_explanation()` shape: `life_discovery.py:564-572`
  → `{ narrative, why, contributing_goals[], evidence_signals[], confidence_pct, confidence_label, source }`,
  or `None` (life_discovery.py:542-543) when no narrative.
- `life_brief()` shape: `life_discovery.py:498-513`
  → adds `watching[]` (life_discovery.py:488-490, from `open_dependencies` + `active_constraints`)
  and `could_change[]` (life_discovery.py:494-496, remaining grounded `risks[1:]` + optional urgency note).

| UI element                      | Backend field                                       |
| ------------------------------- | --------------------------------------------------- |
| "Why this narrative"            | `narrative_explanation.why`                         |
| "Which goals contributed" chips | `narrative_explanation.contributing_goals[]`        |
| "What evidence supports it"     | `narrative_explanation.evidence_signals[]`          |
| Confidence label + pct + source | `narrative_explanation.confidence_label/pct/source` |
| "What Arcana is watching"       | `life_brief.watching[]`                             |
| "What could change the plan"    | `life_brief.could_change[]`                         |

## Honest gaps (do NOT fabricate)

- **"What changed recently"** — no such field exists in the backend yet. NOT rendered. **P2**: would
  require a snapshot diff over time in core-api (new persisted state) — out of this sprint's scope (no
  new DB/infra). Documented here so it isn't silently re-invented.
- `evidence_signals` are humanized emotional-signal phrases (life_discovery.py:517-526), not raw source
  rows — this is the deepest provenance the narrative layer currently exposes. Recommendation-level
  evidence (source tables) lives on the recommendations surface (see RECOMMENDATION_VISIBILITY.md).

## Verification

- `pnpm -C apps/web type-check` → pass.
- `npx eslint` on `LifeBrief.tsx` → clean.
