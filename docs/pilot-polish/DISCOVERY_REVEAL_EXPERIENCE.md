# Discovery Reveal Experience — "Arcana's Understanding Of Your Life"

Sprint: **Pilot Polish — make Arcana's intelligence VISIBLE.**
Scope owned: the discovery/onboarding **completion** flow in `apps/web`.

## What this is

When the advisor-led discovery conversation completes, the user used to see a small,
generic 3-column interstitial ("Top priorities / Top risks / Top opportunities") sourced from the
in-memory advisor `panel`, then was auto-pushed to the dashboard after a fixed 3.2s timer.

It now shows a full-screen **End-of-Discovery Reveal** that reads like a trusted advisor summarizing
the conversation back to you, sourced from the **canonical** life model (`/api/life/my-life`), with a
staged streaming reveal and an explicit "Take me to my dashboard" handoff.

## Where discovery completes (the interception point)

The canonical discovery chat is the advisor page (`/conversation` and the old client-side
`DiscoveryChat`/`ConversationalShell` are legacy/redirects — see `apps/web/src/app/conversation/page.tsx:7`
which redirects to `/dashboard/advisor`).

Completion path in the advisor page:

1. User confirms (or skips) on the Life Model review screen → `finishOnboarding()`
   (`apps/web/src/app/dashboard/advisor/page.tsx:179`).
2. `finishOnboarding` POSTs `/api/onboarding/advisor-complete` (persists `onboarding_completed`),
   then sets `setTransitioning(true)`.
3. The `transitioning` branch renders the reveal instead of immediately navigating.

This is exactly the "intercept before the dashboard redirect" point the task called for.

## Files changed (file:line)

### NEW — `apps/web/src/components/onboarding/DiscoveryReveal.tsx`

Self-contained reveal component. `DiscoveryReveal({ onContinue })`:

- Fetches `/api/life/my-life` (`cache: 'no-store'`) on mount (`:83`).
- Staged reveal state machine `stage` 0→1→2 (`:78`):
  - **0** — advisor "reflecting" (~900ms beat, `:100`) before the narrative appears.
  - **1** — the Current Narrative types in via the existing `StreamingText`.
  - **2** — supporting sections + goal chips fade up once the narrative finishes typing
    (`onDone` → `setStage(2)`, `:200`).
- Safety auto-advance: 14s `setTimeout` calls `onContinue` if the user hasn't (`:111`) so they are
  never trapped; explicit CTAs call `goNow()` (`:117`) which is idempotent via `advancedRef`.

### CHANGED — `apps/web/src/app/dashboard/advisor/page.tsx`

- `:11` — import `DiscoveryReveal`.
- `~:202–207` — `finishOnboarding` now only sets `setTransitioning(true)` (`:207`); **removed** the
  `setTimeout(() => router.push('/dashboard'), 3200)` fixed timer. Navigation is now reveal-driven.
- `~:410–416` — the `transitioning` branch now returns
  `<DiscoveryReveal onContinue={() => router.push('/dashboard')} />` (`:416`), replacing the old
  generic 3-column `panel`-based interstitial.

No other files touched. Dashboard page, `LifeBrief.tsx`, recommendations, Sidebar, and graph pages
were left untouched (owned by other agents). `StreamingText` and `ArcanaStatus` were reused, not modified.

## Data mapping (real fields → reveal sections)

All from `/api/life/my-life` (web pass-through `apps/web/src/app/api/life/my-life/route.ts`),
backend core-api v121. `first(...)` picks the first non-empty string from a priority list.

| Reveal section                 | Source field(s), in priority order                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Headline                       | `life_brief.headline` → fallback copy                                                                                                 |
| Your Current Narrative         | `narrative_explanation.narrative` → `life_brief.situation` → `life_brief.body`                                                        |
| What You're Building (chips)   | `life_brief.goals_held[]`                                                                                                             |
| What's Competing For Your Time | `life_brief.tension` → `what_matters_most.reasoning`                                                                                  |
| Biggest Opportunity            | `what_matters_most.opportunities[0]`                                                                                                  |
| Biggest Risk                   | `life_brief.stakes` → `what_matters_most.risks[0]`                                                                                    |
| Recommended Next Move          | `life_brief.next_move`                                                                                                                |
| Provenance footer              | `life_brief.confidence_pct` (→ `narrative_explanation.confidence_pct`), `narrative_explanation.confidence_label`, `life_brief.source` |

Each supporting card renders **only** if its field resolves to real content — no empty advisor cards.
If `ready=true` but none of tension/opportunity/risk/next_move exist, a single honest "I have your
core picture; more will surface here, grounded in your real situation, never assumptions" card shows.

## Empty-state handling (No mock data — ever)

`life_brief.ready === false` → the honest "still getting to know you" reveal:

- Headline = `life_brief.headline` if present, else _"I'm still getting to know you."_
- Body = `life_brief.body` if present, else gentle copy explaining the picture will sharpen.
- A single "Go to my dashboard" CTA + `source` provenance.
- **Never** fabricates a narrative, opportunity, risk, or next move.

Loading state: a quiet "Arcana is composing what it understands about you…" line (no skeleton of
fake data).

## Design / brand

- Reuses the LifeBrief navy→teal hero gradient (`from-[#0f172a] via-[#13294b] to-[#0d3a4a]`, teal
  accents) so the reveal is visually continuous with the dashboard's Life Brief.
- Reuses `StreamingText` (respects `prefers-reduced-motion`, `ARCANA_STREAMING_ENABLED` flag → if
  streaming is off, the narrative renders instantly and `stage` advances immediately).
- Supporting cards use the existing tone palette (amber / emerald / rose / indigo) + `lucide-react`
  icons already in the dependency set.

## Type-check

`pnpm -C apps/web type-check` → **passes clean** (no errors).

## Residual / P1

- **Streaming feel for sections**: supporting cards fade in on mount-after-`stage>=2`; the
  `transition-opacity` utility is decorative (mount already does the reveal). A true per-card stagger
  would need a small reveal-order hook — deferred (low value, more code).
- **No `narrative_explanation` shared type**: it isn't typed anywhere else in `apps/web`, so the
  shape is declared inline in `DiscoveryReveal.tsx` from the documented backend contract. If/when a
  shared `MyLife` type lands, this component should adopt it.
- **Auto-advance window (14s)** is a heuristic; a reader who pauses mid-narrative on a slow read
  could be advanced. The explicit CTA is the primary path; consider making auto-advance opt-in or
  longer if pilot feedback shows it's abrupt.
- **Skip path**: a user who _skips_ discovery also reaches this reveal (via `finishOnboarding(true)`),
  where it will typically render the honest `ready=false` empty state — intended and correct.
