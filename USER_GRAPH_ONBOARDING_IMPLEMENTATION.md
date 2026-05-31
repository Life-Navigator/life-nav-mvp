# User Graph & Extended Onboarding — Implementation Notes

This change closes the largest gap surfaced in `LIFENAVIGATOR_PLATFORM_AUDIT.md`:
the onboarding flow captured fewer than half of the categories the
Decision Optimization Platform needs to personalize over. The platform now
has a structured user graph and the onboarding UI that fills it.

Nothing about the existing flow is broken — login, the existing 8-step
questionnaire, the 10-step interactive flow, and the existing `risk-profile`
endpoint all still work. The new capture is **one additional step** inserted
between the risk assessment and the completion screen.

---

## What changed

### 1. Database — `supabase/migrations/060_user_graph_foundation.sql`

Adds **10 new tables** under `public.*`:

| Table                        | Purpose                                                                                                                            |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- | ------- | ----------- |
| `user_life_vision`           | 1y / 3y / 5y / 10y vision, definition of success, fears to avoid. One row per (`user_id`, `horizon`).                              |
| `user_constraints`           | Hard/soft constraints across `time`, `money`, `health`, `family`, `geography`, `other`.                                            |
| `user_decision_preferences`  | Weights (0..1) on the four axes: `speed`, `certainty`, `flexibility`, `upside`. One row per (`user_id`, `axis`).                   |
| `user_commitment_levels`     | Per-domain `hours_per_week`, `energy_level`, `duration_weeks`.                                                                     |
| `user_motivations`           | The "why" behind goals. Optional FK to `goals`. `motivation_type` ∈ {intrinsic, extrinsic, values_based, identity, fear_based}.    |
| `user_domain_risk_tolerance` | Structured per-domain tolerance score for `financial`, `career`, `education`, `health`, `entrepreneurship` (the missing 5th axis). |
| `user_capabilities`          | Self-assessed (or system-inferred) skills used to weight feasibility.                                                              |
| `user_decisions`             | A decision a user made: options considered, chosen option, rationale, reversibility, status, made_at.                              |
| `user_recommendations`       | Engine output. Lifecycle: `pending → accepted                                                                                      | rejected | expired | snoozed | completed`. |
| `user_outcomes`              | Observed result tied to a goal / decision / recommendation. The Decision Engine's feedback loop reads this.                        |

Every table follows the project conventions:

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE`
- `created_at`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` with a
  `core.set_updated_at()` `BEFORE UPDATE` trigger
- `source TEXT NOT NULL DEFAULT 'onboarding'` (other valid values: `manual`,
  `ai_inferred`, `integration`, `system`)
- `confidence_score NUMERIC(3,2)` with `CHECK (… BETWEEN 0 AND 1)` everywhere
  it's applicable
- `metadata JSONB NOT NULL DEFAULT '{}'`
- `CHECK` constraints on every enum-style column (lightweight, easy to
  extend; matches the project's existing pattern of `TEXT + CHECK`)
- Sensible indexes:
  - `user_id` on every table
  - `(user_id, created_at DESC)` for time-series reads
  - `(user_id, status)` and `(user_id, priority DESC, created_at DESC)`
    for `user_recommendations`
  - Partial indexes on nullable FKs (`goal_id`, `decision_id`,
    `recommendation_id`)
  - `UNIQUE(user_id, axis)` / `(user_id, domain)` / `(user_id, horizon)` /
    `(user_id, capability_name)` where the row is naturally singleton

`user_outcomes` enforces `goal_id IS NOT NULL OR decision_id IS NOT NULL OR
recommendation_id IS NOT NULL` so an outcome must reference something.

Also adds a `profiles.user_graph_captured_at` timestamp marker so future code
can ask "did this user complete the extended onboarding?"

### 2. RLS — strict and consistent

Every new table has RLS enabled with two policies:

```sql
-- Owner: full access only to your own rows
CREATE POLICY "<table>_owner_all" ON public.<table>
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role bypass for backend jobs (graphrag-sync, decision engine, etc.)
CREATE POLICY "<table>_service_role" ON public.<table>
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
```

No public-read policy anywhere. No anonymous access.

### 3. API routes

Six new route handlers under `apps/web/src/app/api/onboarding/`:

| Route                                  | Methods    | Behavior                                                                                                               |
| -------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| `/api/onboarding/life-vision`          | POST / GET | Upsert by `(user_id, horizon)`; reads return entries for the current user.                                             |
| `/api/onboarding/constraints`          | POST / GET | Insert N constraints. Optional `replace_existing: true` deletes prior `onboarding`-sourced rows for a clean re-submit. |
| `/api/onboarding/decision-preferences` | POST / GET | Upsert by `(user_id, axis)`.                                                                                           |
| `/api/onboarding/commitment-levels`    | POST / GET | Upsert by `(user_id, domain)`.                                                                                         |
| `/api/onboarding/motivations`          | POST / GET | Insert N motivations (no upsert — they're list-shaped).                                                                |
| `/api/onboarding/domain-risk`          | POST / GET | Upsert by `(user_id, domain)`. Derives `qualitative_level` from the numeric score if not supplied.                     |

All six follow the project's existing onboarding-route pattern: read the
authenticated user from `createServerSupabaseClient().auth.getUser()`,
validate the body with **Zod**, and let RLS enforce ownership. No
`service_role` in the request path. No userId is trusted from the client.

### 4. Onboarding UI

- **`apps/web/src/components/onboarding/UserGraphQuestionnaire.tsx`** — one
  new wizard component with six internal sub-steps (life vision → constraints
  → decision preferences → commitment → domain risk → motivation). It exposes
  the standard `data` / `onChange` / `onNext` / `onBack` / `isSubmitting`
  props so it slots into the existing flow without changes to surrounding
  components. Every field is optional and skippable.
- **`apps/web/src/types/user-graph.ts`** — shared TS types (`UserGraphPayload`
  and per-section input shapes) used by the component, the helper, and
  consumers downstream.
- **`apps/web/src/lib/onboarding/save-user-graph.ts`** — the client helper
  the wizard calls when the user finishes. It fans out one POST per
  populated section and reports per-section success/failure. Failures in any
  one section are **non-blocking**: the rest of onboarding (including
  `/api/onboarding/complete`) still runs, so a flaky request never traps a
  user mid-flow.

### 5. Wiring into the existing flows

- **`/onboarding/questionnaire`** — added `USER_GRAPH` as step 7 between
  `RISK` (6) and `COMPLETE` (8). The previous behavior where the risk
  step's "Complete Setup" button triggered `handleSubmit` is preserved by
  routing `RISK.onNext → nextStep` and `USER_GRAPH.onNext → handleSubmit`.
  `handleSubmit` now calls `saveUserGraph()` after `risk-profile` and before
  `/api/onboarding/complete`.
- **`/onboarding/interactive`** — same pattern. `USER_GRAPH` slots in
  between `RISK` (7) and `ACHIEVEMENTS` (9). The `stepLabels` array picks up
  a new entry, `"Profile"`, so the progress strip stays accurate.

The completion gate (`/api/onboarding/complete`) is unchanged — it still
only requires a display name or a goal, so a user who skips every new field
can still finish onboarding.

### 6. TypeScript types

Both database type files were updated so the web app compiles without
`as any` casts on the new tables:

- `apps/web/src/lib/supabase/types.ts` — the actively-used `Database` shape
  used by `createServerClient<Database>(…)`. Full `Row` / `Insert` /
  `Update` typings for all 10 new tables, plus per-table type aliases
  (`UserLifeVisionRow`, `UserConstraintRow`, …).
- `packages/supabase/src/database.types.ts` — the shared package type file.
  Same tables, shorter shapes (mirrors what `supabase gen types typescript`
  would produce).

Until `pnpm db:gen-types` is rerun against a connected Supabase project,
these are the source of truth.

### 7. Tests / validation

- **`scripts/validation/060_user_graph_rls.sql`** — a one-shot SQL
  validation script that runs as `psql -f`. It:
  1. Seeds two synthetic users (A and B) in `auth.users` + `public.profiles`.
  2. Inserts realistic onboarding-shaped data for User A across all 10
     tables, then asserts each table received the expected rows.
  3. Switches the session to User A
     (`set_config('request.jwt.claims', …, true)` + `SET LOCAL ROLE
authenticated`) and asserts they see exactly their own rows in every
     table; that an attempt to `INSERT … (user_id = user_b, …)` is blocked
     by the RLS `WITH CHECK`; and that an `UPDATE` filtered to user_b
     touches zero rows.
  4. Switches to User B and asserts they see zero rows from User A across
     all 10 tables.
  5. Inserts minimum-field rows as User B (only required columns) to prove
     that missing optional fields do not break completion.
  6. `ROLLBACK`s — no test data survives.

  Run with:

  ```bash
  psql "$DATABASE_URL" -f scripts/validation/060_user_graph_rls.sql
  ```

  Success looks like `NOTICE: ALL ASSERTIONS PASSED`. Any failure raises an
  exception and the script exits non-zero.

- **`apps/web/src/lib/onboarding/__tests__/save-user-graph.test.ts`** — Jest
  tests for the client helper:
  - skips empty sections (no fetch call)
  - POSTs only populated sections with the correct payload shape
  - filters blank-text motivations
  - reports per-section failures without blocking other sections
  - treats a network throw as a failed section, not a thrown error

- **`apps/web/src/app/onboarding/__tests__/onboarding.test.tsx`** — the
  existing test still passes; the new step does not break the intro /
  progress / auth-redirect cases it covers.

Test status:

```
Test Suites: 2 passed, 2 total
Tests:       8 passed, 8 total
```

TypeScript `tsc --noEmit` against both `tsconfig.json` and
`tsconfig.check.json`: **clean**.
ESLint against all new and modified files: **clean**.

---

## How to deploy

1. **Run the migration.** Either:

   ```bash
   supabase db push
   ```

   or paste `supabase/migrations/060_user_graph_foundation.sql` into the
   Supabase SQL editor.

2. **Verify RLS isolation in your dev project.**

   ```bash
   psql "$DATABASE_URL" -f scripts/validation/060_user_graph_rls.sql
   ```

3. **Regenerate the typed database types** when convenient (the manually
   maintained shapes are already correct, so this is non-blocking):

   ```bash
   pnpm db:gen-types
   ```

4. **Smoke test onboarding** end-to-end:
   - Create a fresh account.
   - Walk through the questionnaire all the way to the new "A few more
     things about you" screen.
   - Submit with all six sub-sections filled in, then verify rows landed in
     each of the 10 new tables (filtered by your user_id).
   - Repeat with **every** new sub-section left blank — onboarding should
     still complete and `/dashboard` should still load.

---

## What is intentionally out of scope

These are next-step items, called out so future work doesn't surprise
anyone:

- **GraphRAG sync triggers** for the 10 new tables. The existing pattern
  (`055_graphrag_expanded_triggers.sql`) should be extended in a follow-up
  migration so the new structured data flows into Neo4j + Qdrant.
- **A Decision Engine worker** that consumes `user_decision_preferences`,
  `user_constraints`, `user_commitment_levels`, and
  `user_domain_risk_tolerance` to generate `user_recommendations`. The
  schema is ready; the worker is not in this change.
- **Replacing or augmenting the existing `RiskAssessment` step.** Both flows
  remain — the old `risk_assessments` table continues to be written by
  `/api/onboarding/risk-profile`, and the new
  `user_domain_risk_tolerance` table is written by
  `/api/onboarding/domain-risk` from the new wizard. A future refactor can
  unify them; doing so now would have broken existing analytics.
- **Editing captured user-graph data from settings.** Today's surface is
  onboarding-only. GET endpoints exist on every route so building a
  settings UI later is straightforward.

---

## File map (everything added or changed)

```
supabase/migrations/060_user_graph_foundation.sql                       NEW
scripts/validation/060_user_graph_rls.sql                                NEW

apps/web/src/app/api/onboarding/life-vision/route.ts                     NEW
apps/web/src/app/api/onboarding/constraints/route.ts                     NEW
apps/web/src/app/api/onboarding/decision-preferences/route.ts            NEW
apps/web/src/app/api/onboarding/commitment-levels/route.ts               NEW
apps/web/src/app/api/onboarding/motivations/route.ts                     NEW
apps/web/src/app/api/onboarding/domain-risk/route.ts                     NEW

apps/web/src/components/onboarding/UserGraphQuestionnaire.tsx            NEW
apps/web/src/lib/onboarding/save-user-graph.ts                           NEW
apps/web/src/lib/onboarding/__tests__/save-user-graph.test.ts            NEW
apps/web/src/types/user-graph.ts                                         NEW

apps/web/src/app/onboarding/questionnaire/page.tsx                       MODIFIED
apps/web/src/app/onboarding/interactive/page.tsx                         MODIFIED
apps/web/src/lib/supabase/types.ts                                       MODIFIED
packages/supabase/src/database.types.ts                                  MODIFIED
```
