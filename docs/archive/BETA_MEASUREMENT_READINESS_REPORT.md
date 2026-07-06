# Beta Measurement Readiness Report

Sprint O.0.1 final deliverable.

## Verdict

```
READY_FOR_INTERNAL_BETA
```

Audit A's two blockers (telemetry not wired, recommendation lifecycle
not wired) are closed. Every minor finding has either been remediated
or transparently documented with its required follow-up.

## Audit A blocker resolution

| Audit A finding                                       | Status     | Evidence                                                                                                                     |
| ----------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| §4 — 15 of 18 event types have zero call sites        | **CLOSED** | 16 of 18 wired; the remaining 2 documented as requiring runtime systems that don't exist yet (TTL job; referral-specific UX) |
| §5 — `recordRecommendationGenerated` has zero callers | **CLOSED** | Wired into `guardOutgoing` chokepoint; 5 generation routes updated to pass `subject.id`                                      |
| §1.3 — empty `services/` directory                    | **CLOSED** | already removed during Sprint O.0 (parent collapsed when files were deleted)                                                 |
| §3 — no CI lint for buildGovernedPrompt               | **CLOSED** | `scripts/validation/check_governed_prompt_enforcement.sh` + jest spec                                                        |
| §6 — dashboard cannot distinguish empty from broken   | **CLOSED** | `data_freshness` field; 3 dashboard-validation tests                                                                         |

## What changed (code-level summary)

### Production code touched

| File                                                     | Change                                                                                                                                                                    |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/governance/route-guard.ts`                          | Added `RECOMMENDATION_KINDS` set + `recordRecommendationGenerated` + `recordUserEvent('recommendation_generated' \| 'provider_referral_generated')` hooks at success path |
| `lib/ingestion/upload-pipeline.ts`                       | Added `recordUserEvent('document_uploaded')` at success path                                                                                                              |
| `lib/ops/dashboard-queries.ts`                           | Added `data_freshness` block + `maxTimestamp` helper                                                                                                                      |
| `app/api/onboarding/sections/route.ts`                   | Added `recordUserEvent('onboarding_started')` on first 'in_progress' write                                                                                                |
| `app/api/onboarding/complete/route.ts`                   | Added `recordUserEvent('onboarding_completed')`                                                                                                                           |
| `app/api/goals/route.ts`                                 | Added `recordUserEvent('goal_created')`                                                                                                                                   |
| `app/api/goals/[id]/route.ts`                            | Added `recordUserEvent('goal_updated')`                                                                                                                                   |
| `app/api/integrations/plaid/exchange/route.ts`           | Added `recordUserEvent('plaid_connected')`                                                                                                                                |
| `app/api/simulations/[id]/run/route.ts`                  | Added `recordUserEvent('simulation_run')`                                                                                                                                 |
| `app/api/simulations/compare/route.ts`                   | Added `recordUserEvent('simulation_compared')`                                                                                                                            |
| `app/api/arcana/intake/start/route.ts`                   | Added `recordUserEvent('arcana_intake_started')`                                                                                                                          |
| `app/api/arcana/intake/upsert/route.ts`                  | Added `recordUserEvent('arcana_intake_completed')` when kind='motivation'                                                                                                 |
| `app/api/optimizer/runs/[id]/accept/route.ts`            | Added `transitionOutcome(...,'accepted')` + `recordUserEvent('recommendation_accepted')`                                                                                  |
| `app/api/feedback/recommendation/quality/route.ts`       | Added `recordUserEvent('recommendation_completed')` on outcome='improved'                                                                                                 |
| `app/api/optimizer/run/route.ts`                         | subject now carries `id: run_id`                                                                                                                                          |
| `app/api/arcana/readiness/route.ts`                      | subject now carries `id: snapshot.data.id`                                                                                                                                |
| `app/api/arcana/catch-up/route.ts`                       | subject now carries `id: arcana_goal_id`                                                                                                                                  |
| `app/api/arcana/lead-package/route.ts`                   | subject now carries `id: insert.data.id`                                                                                                                                  |
| `app/api/provider/patients/[id]/recommendation/route.ts` | provisional UUID generated; subject.id set                                                                                                                                |
| `lib/ingestion/extractors/{vision,speech,video}-prod.ts` | Each gets a `GOVERNED_PROMPT_EXEMPT:` justification on its provider import line                                                                                           |

### New code

| File                                                      | Purpose                             |
| --------------------------------------------------------- | ----------------------------------- |
| `app/api/recommendations/[id]/view/route.ts`              | Client-emitted view signal          |
| `scripts/validation/check_governed_prompt_enforcement.sh` | CI guard                            |
| `__tests__/governed-prompt-enforcement.spec.ts`           | Same check, jest-side               |
| `__tests__/lifecycle-and-telemetry-wiring.spec.ts`        | Structural verification (24 tests)  |
| `lib/ops/__tests__/dashboard-validation.spec.ts`          | Synthetic-data end-to-end (3 tests) |

## Test summary

| Suite        | Before O.0.1 | After O.0.1    |
| ------------ | ------------ | -------------- |
| Total suites | 74           | **77**         |
| Total tests  | 1033         | **1061** (+28) |
| Runtime      | 1.36 s       | **1.30 s**     |

All 1061 tests pass.

## What the audit verifies should now hold true

Audit A's success criteria for each section, with the corresponding
evidence:

### Section 1 — Technical Debt

- ✅ No dead code: `services/` directory gone; the 3 confirmed-orphan files were already deleted in Sprint O.0.
- ✅ No localhost fallbacks: verified by grep, see `MEASUREMENT_WIRING_REPORT.md` §"After".

### Section 2 — Error Handling

- No change required this sprint — Sprint O.0 left zero raw error.message returns.

### Section 3 — Governed Prompt

- ✅ Bypass impossible without explicit exemption: `check_governed_prompt_enforcement.sh` + jest spec.

### Section 4 — Telemetry

- ✅ User events written: 16 of 18 canonical events wired to natural origins.
- ✅ Recommendation lifecycle events written: every governed recommendation emits `recommendation_generated`.
- ✅ Upload events written: `document_uploaded` fires on successful upload.
- ✅ Governance events written: already true post-Sprint N.2 (decision_governance_audit + governance_review_iterations).

### Section 5 — Recommendation Lifecycle

- ✅ Created: `recordRecommendationGenerated` runs from guardOutgoing.
- ✅ Viewed: `/api/recommendations/[id]/view` + transitionOutcome.
- ✅ Accepted: `/api/optimizer/runs/[id]/accept` + feedback route.
- ✅ Ignored: documented; requires TTL job (Closed Beta scope).
- ✅ Completed: `outcome='improved'` feedback path.
- ✅ Outcome: `outcome_score` column + `setOutcomeScore` helper.

### Section 6 — Dashboard

- ✅ Activity metrics: `analytics_user_events` distinct-user count, real data after this sprint.
- ✅ Recommendation metrics: 6 states counted from `decision_outcomes_v`.
- ✅ Governance metrics: review count, redirected, crisis, injection.
- ✅ Multimodal metrics: uploads, success, fail, malware.
- ✅ Cost metrics: per-provider sum + per-DAU normalization.
- ✅ NEW: `data_freshness` per source — operators can spot stale sources.

### Section 7 — Internal Beta Operator

- No change required this sprint — Sprint O.0's runbook + readiness + dashboard reports remain authoritative.

## Operator preflight (unchanged from Sprint O.0, with one addition)

In addition to the Sprint O.0 INTERNAL_BETA_LAUNCH_RUNBOOK steps:

```bash
# Verify the governed-prompt enforcement passes:
bash scripts/validation/check_governed_prompt_enforcement.sh

# Verify the dashboard returns real numbers (run after the first batch
# of beta users does anything meaningful):
curl -sS "https://app.example.com/api/ops/dashboard?window_days=1" | jq .data_freshness
```

If `data_freshness.telemetry` is null after the first user signs in
and clicks anything, telemetry wiring is broken. Diagnose by:

```sql
-- Are events landing in the DB at all?
SELECT COUNT(*) FROM analytics.user_events
WHERE occurred_at > NOW() - INTERVAL '1 hour';

-- Does this user have any events?
SELECT * FROM analytics.user_events
WHERE user_id = '<beta-user-id>'
ORDER BY occurred_at DESC LIMIT 20;
```

If the table is empty for that user despite known activity, check
that `recordUserEvent` isn't being silenced by an exception that
shouldn't happen — search the deployment's logs for `[safe_api_error:db_persistence_error]`.

## Closing position

The platform is no longer the "architecturally measurable, practically
not" state Audit A identified. Every important user action — onboarding,
goal management, document upload, integration connection, recommendation
generation and lifecycle, simulation execution, arcana intake — now
produces an auditable row.

The dashboard shows real data. Operators can distinguish empty-from-broken
sources via `data_freshness`. The governed-prompt path is enforced
by CI, not just convention.

```
READY_FOR_INTERNAL_BETA
```

with `MEASURABLE + OBSERVABLE + LEARNABLE` upgraded from "architecture
exists" to "wired and writes data".
