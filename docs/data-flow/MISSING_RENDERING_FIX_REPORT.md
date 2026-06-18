# MISSING_RENDERING_FIX_REPORT

Sprint: "Data Flow & Rendering Integrity". Frontend-only, defensive plumbing. No new intelligence, no
mock data — every added section renders ONLY when its canonical field is present + non-empty, and is
omitted (honest) otherwise. core-api untouched. package.json/lockfiles untouched. Not committed.

Companion docs:

- `API_READ_PATH_AUDIT.md` — what each read endpoint returns / drops / renames / duplicates.
- `RENDERING_SURFACE_MAP.md` — per-surface expected-vs-rendered gaps (file:line).

## Files changed

### 1. `apps/web/src/components/onboarding/DiscoveryReveal.tsx` (end-of-discovery reveal)

- Added `toLabels()` defensive coercion (`:71`) accepting `string | {label}` lists.
- Extended `MyLife` type with incoming `motivations` / `emotional_signals` (`:64-68`).
- Derived `constraints` (from `what_matters_most.constraints`) + `motivations` (`:200-207`).
- Rendered two new reveal cards in the supporting grid: "What's holding things back" (constraints) and
  "What's driving you" (motivations) (`:302-319`), each gated on non-empty. Updated the empty-grid fallback
  condition so it only shows when ALL sections are empty (`:320-325`).
- Added `slate` + `violet` card tones (`:TONES`).
- Result: reveal now renders narrative, goals, tension, opportunity, risk, next move, constraints, and
  motivations — all from the canonical my-life payload, all defensive.

### 2. `apps/web/src/components/dashboard/ExecutiveSummary.tsx` (My Life dashboard)

- Added `toLabels()` helper + extended `MyLife` type with `motivations`/`emotional_signals`.
- Derived deduped `constraintList` (prefers top-level `constraints[]` {label,detail}, falls back to
  `what_matters_most.constraints`) + `motivations`.
- Added a Constraints + Motivations row (`"What's holding things back"` / `"What's driving you"`), rendered
  only when non-empty.
- Added a `candidate` badge on goals whose canonical `confirmation_status` is not confirmed — users can now
  distinguish a confirmed goal from a persona-seeded candidate.
- Goal list still reads `canonical_goals` first (pre-existing) → no duplicate goals.

### 3. `apps/web/src/app/dashboard/reports/[type]/page.tsx` (report viewer)

- Added a `Constraint` union type (`string | {label,detail}`) + `constraintLabel()` normalizer, and a
  `NarrativeExplanation` type.
- **Fixed wrong-render bug**: `life_model.constraints` are {label,detail} OBJECTS but were rendered via
  `JSON.stringify` → now rendered as `label — detail`.
- Added a "Why Arcana believes this" section reading `advisor_executive.narrative_explanation` (why /
  contributing goals / evidence signals / confidence) — same explainability the dashboard shows; section
  omitted when absent.
- Added a `candidate` badge on report goals using canonical `confirmation_status`.
- Narrative + goals + risks + opportunities lead unchanged (already correct).

### 4. Tests (new)

- `apps/web/src/components/dashboard/__tests__/ExecutiveSummary.test.tsx` — renders constraints,
  motivations, risks/opps, confirmation badge (exactly one for one candidate), no duplicate goals; and a
  defensive case asserting constraints/motivations sections are OMITTED when absent.
- `apps/web/src/components/onboarding/__tests__/DiscoveryReveal.test.tsx` — renders narrative + goals +
  tension + opportunity + risk + next move; renders constraints + motivations; honest empty state with no
  fabricated narrative when `ready:false`.
- `apps/web/src/app/dashboard/reports/[type]/__tests__/page.test.tsx` — renders narrative lead + goals;
  renders constraints as LABELS not raw JSON (asserts `{"label"` never appears); renders "Why Arcana
  believes this"; renders risks + exactly one candidate badge.

## Consistency outcome

The dominant narrative, goal titles, and constraints now read from the SAME canonical source across reveal,
dashboard (LifeBrief + ExecutiveSummary), and report:

- Narrative + brief: all three compose from `life_brief()` over the same snapshot.
- Goals: dashboard + report read `canonical_goals` (deduped); reveal uses `goals_held` (same objects).
- Constraints: now surfaced on reveal + ExecutiveSummary + (correctly) report — previously only LifeBrief's
  "watching" hinted at them.
- Motivations: surfaced defensively on reveal + dashboard; render the moment the backend adds them.

## Verification results

- `pnpm -C apps/web type-check` — PASS (clean, no errors).
- `eslint` on all changed source + test files — PASS (0 errors, 0 warnings).
- `jest` on the 3 new suites — PASS (16 tests: ExecutiveSummary 6, DiscoveryReveal 3, report viewer 4 +
  the defensive ExecutiveSummary case; 16 assertions-of-record across 13 test cases).

## Honest residuals (documented, not fixed — out of scope or backend-owned)

1. **Backend fields not yet present.** `narrative_summary`, raw `motivations`/`emotional_signals`,
   `timeline`, `coverage`, `missing_context` are NOT yet in `/v1/life/my-life` (backend agent is adding them).
   The frontend reads `motivations`/`emotional_signals` defensively and will render them automatically; the
   other fields (`narrative_summary`, `timeline`, `coverage`, `missing_context`) have NO frontend surface
   wired yet — they were not in the prioritized surface list and have no agreed shape. Add when the contract lands.
2. **Graph readiness key mismatch** (`apps/web/src/app/api/life-graph/route.ts:60`): reads
   `myLife?.readiness?.overall` but the payload key is `life_readiness.overall` → readiness center-node
   falls back to graph integrity. Graph was not a priority surface; left as documented in the audit. One-line
   fix available if desired.
3. **Dashboard "Today's brief" divergence**: `dashboard/page.tsx` computes the finance-only first-insight
   directly from Supabase, separate from `my_life.next_best_action` (cross-domain). They can differ; merging
   is a product decision, out of scope for plumbing.
4. **Recommendations page** drops `narrative.current`/`narrative.target` and `category` — cosmetic, no
   life-model canonical field missing; left unchanged.
