# Post Sprint O.0 Verification Audit

Audit A — strict evidence-based verification.

## Verdict

```
READY_WITH_FIXES
```

The platform is clean, observable, and architecturally measurable.
What it is NOT YET is measurable in practice — the instrumentation
helpers ship without enough call sites to make the dashboard
non-empty for real beta traffic. One blocker, three caveats, full
detail below.

---

## Section 1 — Technical Debt Verification

### 1.1 Dead code

```text
$ find apps/web/src/lib/api/backend-services.ts \
        apps/web/src/services/agent-proxy.ts \
        apps/web/src/services/README.md \
        apps/web/src/lib/cache apps/web/src/lib/architecture \
        apps/web/src/lib/agents apps/web/src/app/test-agent
(no such file or directory — for all 7)
```

✅ **PASS.**

### 1.2 Stale imports

```text
$ grep -rln "from.*lib/api/backend-services\|from.*services/agent-proxy" apps/web/src
(zero matches)
```

✅ **PASS.**

### 1.3 Duplicate services / orphan modules

`services/` directory contains: `__tests__/` (now empty after agent-proxy
test deletion). The directory itself is empty other than its `__tests__`
subdirectory. Minor cosmetic finding — recommend `git rm -r src/services`
in a follow-up — but not a runtime issue.

⚠️ **MINOR FINDING — empty `services/` directory not deleted.**

### 1.4 Localhost fallbacks

```text
$ grep -rn "process\.env\..*||\s*['\"]http://localhost" apps/web/src \
    | grep -v __tests__ | grep -v env.ts | grep -v env-client.ts
(zero matches)
```

✅ **PASS.**

### Section 1 verdict — PASS (one cosmetic finding)

---

## Section 2 — Error Handling Verification

### 2.1 safeApiError adoption

```text
$ grep -rln safeApiError apps/web/src/app/api | wc -l
108 routes
```

### 2.2 Raw error.message leakage

```text
$ grep -rn "error: error\.message\|error: err\.message\|error: (err as Error)\.message\|error: e\.message" apps/web/src/app/api | grep -v __tests__
(zero matches)

$ grep -rn "\.message \}, { status" apps/web/src/app/api | grep -v __tests__
(zero matches)
```

### 2.3 Stack trace leaks

```text
$ grep -rn "stack:\|stack_trace\|\.stack\b" apps/web/src/app/api | grep -v __tests__
(zero matches in error-response payloads)
```

### 2.4 Provider payload leakage

```text
$ grep -rn "JSON\.stringify(err" apps/web/src/app/api | grep -v __tests__
(zero matches)

$ grep -rn "details: error instanceof Error" apps/web/src/app/api
(zero matches)
```

### Section 2 verdict — PASS

---

## Section 3 — Governed Prompt Verification

### 3.1 Builder exists and chains correctly

`lib/security/injection/governed-prompt.ts`:

```text
line 27:  detectInjection,
line 28:  wrapAsUntrustedEvidence,
line 110: export function buildGovernedPrompt(inputs: BuildInputs): BuildResult {
line 117:   const verdict = detectInjection({...});
line 134:   const wrap = wrapAsUntrustedEvidence(verdict.sanitized_text, p.origin, {...});
line 143:   const user_verdict = detectInjection({...});
```

The mandatory chain `Retrieval → wrapAsUntrustedEvidence → buildGovernedPrompt`
is enforced inside the builder for every passage.

### 3.2 Bypass paths

```text
$ grep -rn buildGovernedPrompt apps/web/src/app/api | grep -v __tests__
(zero matches)
```

`buildGovernedPrompt` has **zero production callers**. This is
documented and acceptable BECAUSE there are no LLM-driven routes
today — Sprint N.2 deleted the multi-agent orchestration engine that
would have been the consumer.

The remaining direct provider calls are:

```text
src/lib/ingestion/extractors/vision-prod.ts: provider.vision({ image_bytes })
src/lib/ingestion/extractors/speech-prod.ts: provider.speech({ audio_bytes })
src/lib/ingestion/extractors/video-prod.ts:  provider.video({ video_bytes })
```

These are **media-content extractors**, not retrieval-augmented chat
routes. They pass raw image/audio/video bytes to the provider with a
hardcoded extraction prompt; they never assemble retrieved knowledge

- user input. The governed-prompt path does not apply to media
  extraction.

### 3.3 Enforcement gap

The architecture document says "Future LLM-driven routes MUST use it"
but no CI check enforces this today. A future route author could
import a BYOM provider directly and ship a chat handler that
concatenates retrieved content into a system prompt without going
through the builder.

⚠️ **MINOR FINDING — no CI lint forces buildGovernedPrompt usage for
new LLM-driven routes.** Recommended fix is a 30-line eslint rule
or a CI bash check.

### Section 3 verdict — PASS (with documented gap that has no current consumer)

---

## Section 4 — Telemetry Verification

### 4.1 Helper exists and is correctly tested

`lib/analytics/events.ts` defines `recordUserEvent` with the 18
canonical event types. `analytics/__tests__/events-and-outcomes.spec.ts`
proves the happy path + the best-effort swallow behavior.

### 4.2 Production call sites

```text
$ grep -rn recordUserEvent apps/web/src | grep -v __tests__ | grep -v events.ts
src/app/api/feedback/recommendation/quality/route.ts:13: import { recordUserEvent } from '@/lib/analytics/events';
src/app/api/feedback/recommendation/quality/route.ts:70: await recordUserEvent(sb, {...});
```

`recordUserEvent` has **exactly one production call site**: the
recommendation-feedback route. None of the 18 declared event types
actually fire from their natural origin:

| Event type                    | Should fire from                             | Actually fires from         |
| ----------------------------- | -------------------------------------------- | --------------------------- |
| `onboarding_started`          | `/api/onboarding/*` (start)                  | NEVER                       |
| `onboarding_completed`        | `/api/onboarding/complete`                   | NEVER                       |
| `goal_created`                | `/api/goals` POST                            | NEVER                       |
| `goal_updated`                | `/api/goals/[id]` PATCH                      | NEVER                       |
| `document_uploaded`           | `/api/ingest/upload`                         | NEVER                       |
| `plaid_connected`             | `/api/integrations/plaid/exchange`           | NEVER                       |
| `recommendation_generated`    | recommendation generation routes             | NEVER                       |
| `recommendation_viewed`       | client view event                            | quality feedback route only |
| `recommendation_accepted`     | client accept event                          | quality feedback route only |
| `recommendation_ignored`      | TTL job                                      | NEVER                       |
| `recommendation_dismissed`    | client dismiss event                         | quality feedback route only |
| `recommendation_completed`    | feedback `outcome='improved'`                | quality feedback route only |
| `simulation_run`              | `/api/simulations/[id]/run`                  | NEVER                       |
| `simulation_compared`         | `/api/simulations/compare`                   | NEVER                       |
| `arcana_intake_started`       | `/api/arcana/intake/start`                   | NEVER                       |
| `arcana_intake_completed`     | `/api/arcana/intake/upsert` (final)          | NEVER                       |
| `provider_referral_generated` | `/api/provider/patients/[id]/recommendation` | NEVER                       |
| `provider_referral_accepted`  | provider referral acceptance                 | NEVER                       |

🚫 **BLOCKER — 15 of 18 event types have zero call sites. The remaining
3 fire only via the feedback route.**

This means `/api/ops/dashboard` will return DAU = 0 and WAU = 0 for
real internal-beta traffic because `analytics.user_events` will only
gain rows when users submit recommendation feedback. The funnel,
retention, and per-DAU cost numbers will be wrong.

### Section 4 verdict — NOT_READY for measurement (architecture is correct; wiring is missing)

---

## Section 5 — Recommendation Lifecycle Verification

### 5.1 Schema + helpers

Migration 098 verified present with `decision_outcomes` and
`decision_outcome_events` tables. Helpers
`recordRecommendationGenerated`, `transitionOutcome`, `setOutcomeScore`
exist and pass their unit tests.

### 5.2 Production call sites

```text
$ grep -rn recordRecommendationGenerated apps/web/src | grep -v __tests__ | grep -v decision-outcomes.ts
(zero matches)

$ grep -rn transitionOutcome apps/web/src | grep -v __tests__ | grep -v decision-outcomes.ts
src/app/api/feedback/recommendation/quality/route.ts:14: import { transitionOutcome } from '@/lib/outcomes/decision-outcomes';
src/app/api/feedback/recommendation/quality/route.ts:88: await transitionOutcome(sb, {...}, 'completed', {...});
src/app/api/feedback/recommendation/quality/route.ts:95: await transitionOutcome(sb, {...}, 'dismissed', {...});
src/app/api/feedback/recommendation/quality/route.ts:102: await transitionOutcome(sb, {...}, 'accepted', {...});
```

`recordRecommendationGenerated` has **zero production callers**. The
recommendation-generating routes (`/api/optimizer/run`,
`/api/recommendations/[id]/*`, `/api/arcana/*`,
`/api/provider/patients/[id]/recommendation`) do not register a
`decision_outcomes` row when they emit a recommendation.

`transitionOutcome` only fires from the feedback route. Since the row
is never created by `recordRecommendationGenerated`, the `eq('recommendation_id', ...)`
filter in `transitionOutcome` matches zero rows on first call.

🚫 **BLOCKER — recommendation lifecycle is unmeasurable until generating
routes register outcomes.** The state machine works in isolation;
nothing kicks it off.

### 5.3 Required wiring (the fix)

Each recommendation-emitting route needs roughly:

```ts
const g = await guardOutgoing({...});
if (!g.ok) return g.response;
const audit_id = g.constitutional?.governance?.input_hash;   // or audit_row_id
await recordRecommendationGenerated(supabase, {
  user_id: user.id,
  recommendation_id: rec_id,
  governance_audit_id: audit_id,
}, { source: 'optimizer.dynamic_goal' });
await recordUserEvent(supabase, {
  user_id: user.id,
  event_type: 'recommendation_generated',
  subject_kind: 'recommendation',
  subject_id: rec_id,
});
return NextResponse.json({...});
```

~10 routes need this. ~1 person-day of mechanical work.

### Section 5 verdict — NOT_READY for measurement

---

## Section 6 — Dashboard Verification

### 6.1 Endpoint + helper

```text
$ ls apps/web/src/lib/ops/dashboard-queries.ts \
       apps/web/src/app/api/ops/dashboard/route.ts
(both present)
```

3 dashboard-queries tests pass.

### 6.2 Authorization

Verified — `operator_dashboard.read` flag gate plus per-user override.
Default-deny.

### 6.3 Empty-result behavior

`computeDashboardSnapshot` wraps each metric block in its own
`try/catch` and returns zeros on failure. This is correct in principle
but means **the dashboard will silently report zeros across all five
metric blocks because of the §4 + §5 blockers**, with no indication
to the operator that the data is missing because the wiring is
incomplete rather than because beta traffic is zero.

⚠️ **MINOR FINDING — dashboard cannot distinguish "no data" from
"no wiring".** Recommendation: add a `data_freshness` field to the
snapshot reporting the most-recent timestamp seen in each source
table; operators can spot a stale source instantly.

### Section 6 verdict — PASS (architecture); BLOCKED downstream by §4 + §5

---

## Section 7 — Internal Beta Operator Verification

### 7.1 Runbooks

```text
$ ls /home/riffe007/.../INTERNAL_BETA_LAUNCH_RUNBOOK.md \
      /home/riffe007/.../INTERNAL_BETA_READINESS_REPORT.md \
      /home/riffe007/.../INTERNAL_BETA_DASHBOARD.md
(all three present)
```

### 7.2 Alerts

The runbook §3.1 documents 5 alert conditions with SQL. None are
auto-provisioned — they require operator configuration in their
monitoring stack. The runbook calls this out explicitly.

### 7.3 Onboarding process

Documented in runbook §4.1. Uses `ops.beta_invites` + SMTP email.

### 7.4 Feedback collection

```text
$ ls src/app/api/feedback/{bug,nps,recommendation,simulation,recommendation/quality}/route.ts
all present
```

### Section 7 verdict — PASS

---

## Summary

| Section                      | Status         | Notes                                                                        |
| ---------------------------- | -------------- | ---------------------------------------------------------------------------- |
| 1 — Technical Debt           | PASS           | One cosmetic finding: empty `services/` dir                                  |
| 2 — Error Handling           | PASS           | 108 routes adopted safeApiError; zero leakage                                |
| 3 — Governed Prompt          | PASS           | Builder ships; no production consumer today (acceptable); no CI lint (minor) |
| 4 — Telemetry                | **NOT_READY**  | 15 of 18 event types have zero call sites                                    |
| 5 — Recommendation Lifecycle | **NOT_READY**  | `recordRecommendationGenerated` has zero production callers                  |
| 6 — Dashboard                | PASS but EMPTY | Architecture correct; data sources will be empty                             |
| 7 — Operator                 | PASS           | Runbooks + feedback endpoints in place                                       |

## Why the verdict is READY_WITH_FIXES, not NOT_READY

A NOT_READY verdict is reserved for unsafe-to-launch states: governance
bypass, malware bypass, security regression, raw secret leakage. None
of those exist post-O.0.

What does exist is a measurement gap: the dashboard's promises about
DAU/funnel/recommendation acceptance cannot be honored by the data
that the runtime produces, because the recording helpers are not yet
called from the routes that should call them. The platform CAN safely
host internal beta users — it just cannot accurately MEASURE that
hosting.

## The fix backlog

### BLOCKERS (required before users)

1. **Wire `recordUserEvent` into the natural origin route for each of
   the 15 missing event types.** Mechanical sweep, ~6 hours.

2. **Wire `recordRecommendationGenerated` into the 10 routes that emit
   recommendations.** Same sweep, ~3 hours.

### Closed Beta items

3. Delete the now-empty `services/` directory.
4. Add a CI bash check that any new route importing a BYOM provider
   also imports `buildGovernedPrompt`.
5. Add `data_freshness` to the dashboard snapshot.
6. Auto-provision the 5 alert rules documented in the runbook into the
   monitoring stack.

After blockers 1 + 2 are landed (one engineering day), the verdict
becomes **READY_FOR_INTERNAL_BETA** with no caveats. The architecture
shipped this sprint is the correct architecture; only the integration
calls are missing.
