# Decision Intelligence + Outcome Learning — Implementation

LifeNavigator now records the **reasoning behind every decision**,
tracks **what actually happened**, and derives **observational signals**
about how each user makes and follows through on decisions. All three
layers route through an explicit **no-manipulation contract**: signals
are allowed to make recommendations _more useful_, never to nudge,
hide, or coerce.

No new UI. No new dashboards. Intelligence layer only.

## What was built

| Deliverable                                                        | File                                                             |
| ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Migration 079 — schema for 6 tables + `compute_learning_signals()` | `supabase/migrations/079_decision_intelligence.sql`              |
| Types                                                              | `apps/web/src/types/decision-journal.ts`                         |
| `DecisionJournalService`                                           | `apps/web/src/lib/decision/decision-journal-service.ts`          |
| `RecommendationAcceptanceService`                                  | `apps/web/src/lib/decision/recommendation-acceptance-service.ts` |
| `PersonalLearningProfile` + guard                                  | `apps/web/src/lib/decision/personal-learning-profile.ts`         |
| RLS verification SQL                                               | `scripts/validation/verify_079_decision_rls.sql`                 |
| Tests — 3 jest suites                                              | `apps/web/src/lib/decision/__tests__/*.test.ts`                  |
| This doc                                                           | `DECISION_INTELLIGENCE_AND_LEARNING.md`                          |

## Verification snapshot

| Check                                            | Status                                                                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @life-navigator/web tsc --noEmit` | clean                                                                                                                     |
| Jest — new suites                                | **36 passed / 36** (`decision-journal-service` 14, `recommendation-acceptance-service` 7, `personal-learning-profile` 15) |
| Jest — full suite                                | **316 passed / 316** (was 280; +36, zero regressions)                                                                     |
| Migration 079 self-test                          | embedded `DO $$ ... $$` raises if any of the six tables lacks RLS                                                         |
| `verify_079_decision_rls.sql`                    | proves owner-only RLS across all six tables + blocks A-as-B writes                                                        |

---

## 1. Decision Journal (migration 079)

Six tables in a new `decision_intelligence` schema. Every table:
owner-only RLS, service_role escape hatch, `updated_at` trigger,
public read-view at `public.<name>` so the standard Supabase client
can read it.

| Table                       | Purpose                                                                                                                                                                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ----------- | -------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `decision_journals`         | Master record — one row per decision considered or made. Captures **recommendation_summary**, **reasoning**, **assumptions** (JSONB array), **system_confidence_at_decision**, plus lifecycle (`pending → made → rescinded | superseded`). |
| `decision_expectations`     | What we expect to happen. One row per measurable expectation per journal: `dimension`, `expected_value` (or `expected_text`), `expected_unit`, `expected_by`, `confidence`, `rationale`.                                   |
| `decision_outcomes`         | What actually happened. Linked to a journal and optionally to a specific expectation. Carries `observed_value`, `delta_value`, `delta_pct`, `accuracy_score`, `source` (`self_report                                       | computed      | integration | admin`). |
| `decision_reviews`          | Periodic retrospective: `period` (`7_day                                                                                                                                                                                   | 30_day        | 90_day      | 180_day  | 1_year    | final`), `verdict`(six-bucket enum from much_better_than_expected to much_worse_than_expected),`lessons_learned`, `would_repeat`, `sentiment_score`. Unique per `(journal_id, period)`. |
| `recommendation_acceptance` | Per-action lifecycle: `action_id`, `recommendation_summary`, `status` (`accepted                                                                                                                                           | rejected      | modified    | deferred | completed | abandoned`), `modified_to`, `reason`, `adherence_score`, `user_satisfaction`, `outcome_quality`. Unique per `(user_id, advisor_run_id, action_id)`.                                     |
| `learning_signals`          | Aggregated observational signals (see §3). Unique per `(user_id, signal_kind, signal_key)`.                                                                                                                                |

### `compute_learning_signals(p_user_id UUID)` — SECURITY DEFINER

Pure observational aggregator over the user's own rows. Idempotent
(`ON CONFLICT DO UPDATE`). Returns the post-compute signal count.

Seven signal families produced per call:

| Signal family                                   | Source                                                | Confidence ramp                        |
| ----------------------------------------------- | ----------------------------------------------------- | -------------------------------------- | --------- | ---------------------- |
| `follow_through_pattern` (per domain + overall) | `recommendation_acceptance.status`                    | < 5 obs → 0.3, < 15 → 0.6, ≥ 15 → 0.85 |
| `decision_tendency` (overall)                   | accept/reject/modify/defer counts                     | same ramp                              |
| `procrastination_indicator` (overall)           | median days from `accepted_at` to `completed_at`      | 0.6 fixed                              |
| `outcome_quality_distribution` (overall)        | mean `accuracy_score` + delta direction counts        | same ramp                              |
| `risk_behavior` (per domain)                    | accepts vs rejects split by `expected_strength < 0.5` | same ramp                              |
| `motivation_trigger` (`top_reasons_accepted`)   | `reason` strings on accepted rows                     | reduced ramp (text)                    |
| `preferred_communication_style` (overall)       | mean length of `reason` + `lessons_learned` → `brief  | balanced                               | detailed` | 0.4 fixed (weak proxy) |

`SECURITY DEFINER` lets a cron / API route call it on a schedule
without giving authenticated users direct write access to
`learning_signals`.

---

## 2. Services

### `DecisionJournalService` (`apps/web/src/lib/decision/decision-journal-service.ts`)

```ts
recordDecision(supabase, { user_id, title, decision_type, reasoning, assumptions[], system_confidence_at_decision, ... }) → DecisionJournal
recordExpectations(supabase, userId, journalId, expectations[])           → DecisionExpectation[]
recordOutcome(supabase, userId, journalId, { expectation_id?, observed_value, ... }) → DecisionOutcome  // auto-fills delta_value/pct/accuracy
recordReview(supabase, userId, journalId, { period, verdict?, lessons_learned, would_repeat, ... }) → DecisionReview
rescindDecision(supabase, journalId, supersededBy?) → void
```

Pure helpers (exported as `__test`) are unit-tested:

- `computeOutcomeDeltas(expected, observed)` — symmetric, bounded `[0,1]` accuracy curve; 50% miss = 0.5, 100% miss = 0.
- `verdictFromAccuracy(delta_pct)` — six-bucket classifier; ±10% = `as_expected`, ±35% = `better/worse`, beyond = `much`.

### `RecommendationAcceptanceService` (`apps/web/src/lib/decision/recommendation-acceptance-service.ts`)

```ts
recordAcceptance(supabase, { user_id, action_id, status, advisor_run_id?, ... }) → RecommendationAcceptance
completeAction(supabase, { user_id, action_id, advisor_run_id?, adherence_score, user_satisfaction, outcome_quality }) → RecommendationAcceptance
loadAcceptanceMetrics(supabase, { user_id, since?, until?, advisor_run_id?, domain? }) → AcceptanceMetrics
```

`AcceptanceMetrics` carries:

```
total · accept_rate · reject_rate · modify_rate · defer_rate
completion_rate (over the accepted-family denominator only)
abandonment_rate
mean_adherence · mean_user_satisfaction · mean_outcome_quality (over completed rows only)
by_domain: { [domain]: { total, accept_rate, completion_rate } }
```

Pure `computeMetrics(rows)` is unit-tested with seven fixture cases.

### `PersonalLearningProfile` (`apps/web/src/lib/decision/personal-learning-profile.ts`)

```ts
loadLearningSignals(supabase, userId)                              → LearningSignal[]
refreshLearningSignals(supabase, userId)                           → number      // calls the SQL function
buildProfile(userId, signals)                                       → LearningProfile
applyToRecommendation(profile, recommendation, { acceptance_history? }) → LearningApplication
```

`LearningApplication` is the structured audit trail:

```ts
{
  output: RecommendationOutput,              // possibly-reordered output
  applied_effects: LearningEffect[],         // which of the 4 whitelisted effects ran
  rejected_mutations: string[],              // names of forbidden changes the structural guard reverted
  phrasing_hint?: 'detailed' | 'balanced' | 'brief',
  self_diagnostics?: { follow_through_rate, procrastination_median_days, accept_rate }
}
```

---

## 3. The no-manipulation contract

> **"Never use this for manipulation. Use only to improve
> recommendations."** — sprint spec.

### What the learning layer IS allowed to do (whitelist)

```ts
export const ALLOWED_LEARNING_EFFECTS = [
  'reorder_actions_within_same_horizon',
  'add_phrasing_hint',
  'dedupe_repeat_rejected_actions',
  'surface_self_diagnostics',
];
```

1. **Reorder within a horizon.** Inside each timeline bucket (`now`,
   `this_quarter`, `this_year`, `long_term`) the layer may re-sort
   actions by `expected_strength`. The bucket assignments themselves
   never change.
2. **Add a phrasing hint.** Set `phrasing_hint: 'brief' | 'balanced' | 'detailed'`
   on the output for downstream LLM phrasing. Optional and additive —
   does not change content.
3. **De-dup repeat-rejected actions.** If the user has rejected an
   action with the same summary ≥ 3 times, demote it to the **end** of
   the timeline. The action is _not removed_ — it stays visible so the
   user can still see what the deterministic engine recommends.
4. **Surface self-diagnostics.** Expose the user's own follow-through
   rate, procrastination median, and accept rate **back to them**. This
   is transparency, not manipulation.

### What the learning layer IS NOT allowed to do (enforced)

- Add, remove, or rename actions.
- Change `action_id`, `domain`, or `expected_strength` on any action.
- Drop or alter `tradeoffs`, `risks`, `assumptions`, `cross_domain_impacts`,
  `pathway`, `supporting_goals`, `blocked_goals`.
- Adjust the deterministic `confidence_score`.
- Hide `blocked_goals` warnings or `contradictions`.
- Delay or time-gate surfacing (no `delay_until` / `surface_at` field
  exists by design).
- Use signals to coerce a specific decision (no "you have low
  follow-through, so we'll only show you the easy option" path).

### How the contract is enforced

`applyToRecommendation` runs two structural guards:

1. **Action-set guard.** After every allowed effect runs, `actionsHaveSameIds(before, after)` is asserted. If any id was added, removed, or changed, the entire `required_actions / recommended_sequence / timeline` triplet is reverted to the pre-effect snapshot and the violation is recorded.
2. **Protected-keys guard.** Each key in `PROTECTED_KEYS` is compared by `JSON.stringify` against the before-snapshot. Any difference triggers a byte-level revert and a `rejected_mutations` entry naming the key.

```ts
const PROTECTED_KEYS = [
  'root_goal',
  'supporting_goals',
  'blocked_goals',
  'confidence_score',
  'tradeoffs',
  'risks',
  'assumptions',
  'cross_domain_impacts',
  'pathway',
  'simulation_summary',
];
```

Tests verify each of these guarantees (`personal-learning-profile.test.ts`, 15 cases):

```
✓ whitelist is exactly the 4 documented effects
✓ signal with support_count < 5 is ignored
✓ reorders within a horizon by expected_strength desc (no add/remove)
✓ demotes (but never removes) actions matching ≥ 3 prior rejections
✓ cannot drop an action — invariant restored
✓ confidence_score is byte-identical after apply()
✓ tradeoffs / risks / assumptions / cross_domain_impacts / pathway preserved
✓ root_goal cannot be altered
✓ blocked_goals stay surfaced — learning cannot hide them
✓ procrastination signal does not delay surfacing — output is returned immediately, not gated by timing
   (… plus 5 more)
```

### MIN_SUPPORT threshold

Even within the whitelist, no signal is acted on with fewer than
**5 underlying observations** (`buildProfile` filters by `support_count`).
Five is the floor; the SQL function's confidence ramp tops out at 15.
This prevents premature behavior changes based on a single rejected
recommendation.

### User-facing transparency

`LearningApplication.applied_effects` and `LearningApplication.rejected_mutations`
are exposed to the calling route so the UI (when it ships) can show a
"why this order changed" affordance. The contract is: **the user can
always ask why and the answer is a concrete enumerable list of effects.**

---

## 4. Integration with the rest of the system

```
AdvisorReasoningService.reason()
            │
            ▼
    RecommendationOutput  (deterministic, immutable downstream)
            │
            ▼
PersonalLearningProfile.applyToRecommendation(profile, output)
            │  (reorder/phrasing-hint/dedup/self-diagnostics only;
            │   guards revert any forbidden change)
            ▼
        LearningApplication { output, applied_effects, rejected_mutations,
                               phrasing_hint, self_diagnostics }
            │
            ▼
  AdvisorConversationAgent.respond(...)
            │  - reads applied_effects + self_diagnostics
            │  - the deterministic_recommendation field still equals
            │    the original AdvisorReasoningService output (the
            │    conversation agent's own bypass guard is independent)
            ▼
        ConversationTurn → route handler → user
```

After each turn the route should call
`RecommendationAcceptanceService.recordAcceptance(...)` for any action
the user touched. On a schedule (or after N acceptances) call
`refreshLearningSignals(userId)` to recompute the
`learning_signals` rows that drive the next session.

---

## Apply + verify

```bash
psql "$DATABASE_URL" -f supabase/migrations/079_decision_intelligence.sql
psql "$DATABASE_URL" -f scripts/validation/verify_079_decision_rls.sql

pnpm --filter @life-navigator/web test \
  --testPathPattern='decision-journal-service|recommendation-acceptance-service|personal-learning-profile'
```

Expected:

- Migration applies cleanly, self-test passes, no destructive
  statements.
- RLS verifier prints `ALL PASS` (every per-table sweep + both
  cross-user write attempts blocked).
- Jest reports 36 / 36 in the three new suites; full suite 316 / 316.

---

## Open follow-ups (out of scope this sprint)

- **Cron**: schedule `compute_learning_signals(user_id)` per active
  user (e.g., daily). Today it must be invoked explicitly via
  `refreshLearningSignals()`.
- **Outcome attribution worker**: auto-fill `decision_outcomes` from
  changes in `user_financial_profile`, `health_metrics`, and
  `goal_optimizer_outcomes` so the user does not have to self-report.
- **Decision Journal UI**: the spec explicitly forbids new UI this
  sprint. When the UI is built, it must surface `applied_effects` and
  `rejected_mutations` as part of the transparency commitment.
- **Time-series storage of signals**: `learning_signals` currently
  stores the _latest_ aggregate. A history table (`learning_signals_history`)
  would let us show the user how their patterns are changing over
  time. Add when the UI requests it.
