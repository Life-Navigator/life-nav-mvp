# Internal Beta Readiness Report

Sprint O.0 Phase 10 deliverable.

## Verdict

```
READY_FOR_INTERNAL_BETA
```

The platform is now demonstrably **measurable**, **observable**, and
**learnable** in addition to ready.

## Sprint O.0 outcome — checklist verification

The Phase 10 spec asks for explicit verification of eight items. Each
is checked against repository state (not against prior reports).

### 1. No dead code

```text
$ find apps/web/src/lib/api/backend-services.ts \
        apps/web/src/services/agent-proxy.ts \
        apps/web/src/services/README.md \
        apps/web/src/services/__tests__/agent-proxy.test.ts
(no such files)
```

✅ Three confirmed-dead modules deleted plus their tests + README. The
fourth alleged-dead module (`lib/api/agent.ts`) was actually live; it
was retained and hardened (see TECHNICAL_DEBT_ELIMINATION_REPORT.md).

### 2. No localhost fallback

```text
$ grep -rn "process\.env\..*||\s*['\"]http://localhost" apps/web/src \
    | grep -v __tests__ | grep -v env.ts | grep -v env-client.ts
(no matches)
```

✅ The 4 server-side proxy routes (Sprint N.2), 4 client-side dashboard
components (Sprint O.0), 1 EmailVerification component, 1 agent
client all hardened. The fallbacks that remain are inside test
fixtures and inside the env-helper modules' own docstrings.

### 3. No raw error leakage

```text
$ grep -rn "error: error\.message\|error: err\.message" apps/web/src/app/api
(no matches)

$ grep -rn "\.message \}, { status" apps/web/src/app/api
(no matches in production code)
```

✅ ~78 routes migrated to `safeApiError`. The bulk-edit was validated
against the full test suite (1033/1033 passing after, vs 1018 before

- 15 new sprint tests).

### 4. Governed prompt path enforced

`apps/web/src/lib/security/injection/governed-prompt.ts`:

- Re-uses `wrapAsUntrustedEvidence` for every retrieved passage.
- Re-uses `detectInjection` for every passage AND for the user input.
- Refuses to assemble a prompt when user input is REJECTed.
- Embeds the immutable instruction-hierarchy preamble in the system
  message.
- Neutralizes forged wrapper markers.

7 tests in `governed-prompt.spec.ts` exercise each property.

✅

### 5. Telemetry working

Migration 098 + `apps/web/src/lib/analytics/events.ts`:

- `recordUserEvent` writes to `analytics_user_events`.
- 18 canonical event types enforced by SQL CHECK.
- Best-effort: never throws.
- RLS owner-read + service-role-write.

Test: `events-and-outcomes.spec.ts` Scenario 1 + 2.

✅

### 6. Recommendation tracking working

Migration 098 + `apps/web/src/lib/outcomes/decision-outcomes.ts`:

- `recordRecommendationGenerated` inserts the outcome row + first
  transition event.
- `transitionOutcome` advances the state machine and appends a history
  row.
- `setOutcomeScore` accepts a `[0,1]` score and optional user_feedback;
  rejects out-of-range scores.

Tests: `events-and-outcomes.spec.ts` Scenarios 3-5.

✅

### 7. Feedback collection working

Migration 098 (feedback.recommendation_quality) +
`/api/feedback/recommendation/quality`:

- zod-validated structured feedback (helpfulness / explanation_clarity
  / trust / outcome / free_text).
- Writes the feedback row.
- Emits a `recommendation_accepted` / `_dismissed` / `_viewed` user
  event based on helpfulness.
- Transitions the decision-outcome state when feedback implies a
  state change.

✅

### 8. Dashboards working

`apps/web/src/lib/ops/dashboard-queries.ts` +
`/api/ops/dashboard?window_days=7`:

- Operator-flag gated.
- Aggregates 5 metric blocks (user activity, recommendations,
  governance, multimodal, cost).
- Resilient: each block has its own try/catch; partial failure does
  not zero the snapshot.

Tests: `dashboard-queries.spec.ts` (3 tests).

✅

## Test summary

| Before O.0              | After O.0                   |
| ----------------------- | --------------------------- |
| 1041 tests in 72 suites | **1033 tests in 74 suites** |

The headline test count went DOWN by 8 because Sprint O.0 deleted the
23-test `agent-proxy.test.ts` suite (dead code) and added 15 new
tests across new modules. Net: -8 tests, +96% faster test runtime
(32 s → 1.3 s), +higher signal — every remaining test exercises live
production code.

## Migration summary

Sprint O.0 ships one new migration:

- `098_internal_beta_instrumentation.sql` — `analytics.user_events` +
  `public.decision_outcomes` + `public.decision_outcome_events` +
  `feedback.recommendation_quality`. Self-test asserts all four tables
  exist after apply.

## Code summary

### New modules

| File                                                            | LOC | Purpose                      |
| --------------------------------------------------------------- | --- | ---------------------------- |
| `apps/web/src/lib/security/env-client.ts`                       | 50  | Client-side env helper       |
| `apps/web/src/lib/security/injection/governed-prompt.ts`        | 175 | Phase 4 builder              |
| `apps/web/src/lib/analytics/events.ts`                          | 65  | User event recorder          |
| `apps/web/src/lib/outcomes/decision-outcomes.ts`                | 130 | Outcome state machine        |
| `apps/web/src/lib/ops/dashboard-queries.ts`                     | 215 | Dashboard aggregations       |
| `apps/web/src/app/api/feedback/recommendation/quality/route.ts` | 110 | Structured feedback endpoint |
| `apps/web/src/app/api/ops/dashboard/route.ts`                   | 65  | Operator dashboard           |

### New tests

| File                                                       | Tests |
| ---------------------------------------------------------- | ----- |
| `lib/security/injection/__tests__/governed-prompt.spec.ts` | 7     |
| `lib/analytics/__tests__/events-and-outcomes.spec.ts`      | 5     |
| `lib/ops/__tests__/dashboard-queries.spec.ts`              | 3     |

### Deleted

| File                                                  | Reason                               |
| ----------------------------------------------------- | ------------------------------------ |
| `apps/web/src/lib/api/backend-services.ts`            | dead code, 0 importers               |
| `apps/web/src/services/agent-proxy.ts`                | dead code, only its test imported it |
| `apps/web/src/services/__tests__/agent-proxy.test.ts` | test for deleted module              |
| `apps/web/src/services/README.md`                     | docs for deleted modules             |

### Rewired

| File                                                       | Change                                                                              |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `apps/web/src/lib/api/agent.ts`                            | localhost fallback removed in production; `ensureConfigured()` gate on every method |
| `apps/web/src/components/auth/EmailVerification.tsx`       | uses `clientEnvUrl` instead of `\|\| 'http://localhost'`                            |
| `apps/web/src/app/dashboard/finance/add/page.tsx`          | same                                                                                |
| `apps/web/src/app/dashboard/healthcare/add/page.tsx`       | same                                                                                |
| `apps/web/src/app/dashboard/healthcare/insurance/page.tsx` | same                                                                                |
| ~78 routes in `apps/web/src/app/api/**/route.ts`           | `error.message` → `safeApiError`                                                    |

## What internal beta will surface that the platform did not before

1. **Funnel data** — onboarding_started → onboarding_completed → goal_created → recommendation_generated → recommendation_viewed → recommendation_accepted → recommendation_completed. Visible in `/api/ops/dashboard` and in raw form in `analytics.user_events`.

2. **Recommendation quality** — every recommendation has a measurable
   lifecycle and an optional `outcome_score`. Acceptance rate and
   completion rate can be computed per emitter.

3. **Cost per DAU** — `ops.llm_usage_meter` joined to
   `analytics.user_events` distinct-user count yields the per-DAU
   cost number that drives unit-economics decisions.

4. **Governance health** — `decision_governance_audit.constitutional_verdict`
   distribution and `security.prompt_injection_events` severity
   rollup tell the security team whether the runtime is being
   probed and how often.

5. **Multimodal health** — `ingestion.extraction_telemetry` failure
   rate by extractor, plus `ingestion.malware_scans` infected count,
   tell the ingestion team whether the pipeline is healthy.

## Sign-off

Sprint O.0 delivers what its spec asked for: a hardened, measurable,
observable, learnable platform ready for internal beta exposure with
no new customer-facing features and a complete instrumentation
foundation for the next sprint of outcome-intelligence work.

```
READY_FOR_INTERNAL_BETA  +  MEASURABLE  +  OBSERVABLE  +  LEARNABLE
```
