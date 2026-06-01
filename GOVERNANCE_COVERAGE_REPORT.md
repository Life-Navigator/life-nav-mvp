# Governance Coverage Report

Sprint M Phase 4 audit. Every user-facing API route in `apps/web/src/app/api/**` was inspected to determine whether it passes through the Constitutional Governance pipeline (Sprint L + L2).

Categories:

- **GOVERNED** — route already calls `validateAndPersist` (Sprint L) or `reviewAndPersist` (Sprint L2).
- **MUST_WIRE** — route emits user-facing recommendations, advice, simulations, or AI-generated guidance. Required to wire before public launch.
- **EXEMPT** — route is pure CRUD over user data or integration plumbing with no user-facing advisory output.
- **GOVERNANCE_INFRA** — the governance / constitutional endpoints themselves.
- **INTERNAL** — service-role / admin-only paths.

## 1. GOVERNED ✓

| Route                                       | Notes                                                                                              |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `POST /api/provider/portal/recommendations` | Wired in Sprint L; passes through `validateAndPersist`. HTTP 422 + decision returned when blocked. |

## 2. MUST_WIRE — Sprint M closeout

Routes that emit advisory output and MUST be wired through `reviewAndPersist` (or `validateAndPersist` if not stream-responsive) before beta launch.

| Route                                                  | Subject kind                            | Owner    |
| ------------------------------------------------------ | --------------------------------------- | -------- |
| `POST /api/agent/chat`                                 | `advisor_message`                       | Advisor  |
| `POST /api/conversation/analysis`                      | `advisor_message`                       | Advisor  |
| `POST /api/discovery/[id]/turn`                        | `advisor_message`                       | Advisor  |
| `POST /api/optimizer/run`                              | `optimizer_recommendation`              | Decision |
| `POST /api/optimizer/runs/[id]/accept`                 | `optimizer_recommendation` (acceptance) | Decision |
| `POST /api/simulations/create`                         | `simulation_output`                     | Decision |
| `POST /api/simulations/[id]/run`                       | `simulation_output`                     | Decision |
| `POST /api/simulations/compare`                        | `simulation_output`                     | Decision |
| `POST /api/scenario-lab/versions/[versionId]/simulate` | `simulation_output`                     | Decision |
| `GET  /api/goals/[id]/decision-impact`                 | `recommendation`                        | Decision |
| `GET  /api/goals/[id]/catch-up`                        | `recommendation`                        | Decision |
| `GET  /api/goals/[id]/ahead-of-plan`                   | `recommendation`                        | Decision |
| `GET  /api/goals/[id]/probability`                     | `probability_output`                    | Decision |
| `GET  /api/goals/[id]/marginal-impact-ranking`         | `recommendation`                        | Decision |
| `POST /api/explainers/probability`                     | `probability_output`                    | XAI      |
| `POST /api/explainers/tradeoff`                        | `recommendation` (explainer)            | XAI      |
| `POST /api/arcana/catch-up`                            | `arcana_recommendation`                 | Arcana   |
| `POST /api/arcana/readiness`                           | `arcana_recommendation`                 | Arcana   |
| `POST /api/arcana/lead-package`                        | `arcana_recommendation`                 | Arcana   |
| `GET  /api/recommendations/[id]/why`                   | reads through governance audit          | XAI      |
| `GET  /api/recommendations/[id]/evidence`              | reads through governance audit          | XAI      |
| `GET  /api/recommendations/[id]/counterfactuals`       | reads through governance audit          | XAI      |
| `GET  /api/recommendations/[id]/assumptions`           | reads through governance audit          | XAI      |
| `GET  /api/recommendations/[id]/audit-trail`           | reads through governance audit          | XAI      |
| `POST /api/provider/patients/[id]/recommendation`      | `provider_recommendation`               | Provider |
| `POST /api/risk-assessment`                            | `recommendation`                        | Decision |

**Wiring pattern (canonical):**

```ts
const { decision, audit_row } = await validateAndPersist({
  subject: { kind: 'recommendation', text: draftText, ... },
  emitter: { agent_kind: 'optimizer', agent_name: 'optimizer.dynamic_goal' },
  supabase: sb,
  now: new Date().toISOString(),
});
if (!decision.approved) {
  return NextResponse.json({ error: 'governance_blocked', decision }, { status: 422 });
}
// proceed to persist + return draft as the final text
```

For streaming responses (e.g. `advisor.chat`), use `reviewAndPersist` (Sprint L2) and only stream when `ok_to_stream: true`.

## 3. EXEMPT — pure CRUD or integration plumbing

These routes manipulate user-owned records or external integrations and do not emit AI-generated advisory output. They remain RLS-scoped to the user; governance is not required because no recommendation is produced.

### Onboarding (data capture, no advice surfaced)

`/api/onboarding/route.ts`, `/api/onboarding/career-extended/route.ts`, `/api/onboarding/career-goals/route.ts`, `/api/onboarding/commitment-levels/route.ts`, `/api/onboarding/complete/route.ts`, `/api/onboarding/consents/route.ts`, `/api/onboarding/constraints/route.ts`, `/api/onboarding/debts/route.ts`, `/api/onboarding/decision-preferences/route.ts`, `/api/onboarding/domain-risk/route.ts`, `/api/onboarding/education-goals/route.ts`, `/api/onboarding/education-intake/route.ts`, `/api/onboarding/estate/route.ts`, `/api/onboarding/family-lifestyle/route.ts`, `/api/onboarding/financial-goals/route.ts`, `/api/onboarding/financial-profile/route.ts`, `/api/onboarding/goal-discovery/route.ts`, `/api/onboarding/health-goals/route.ts`, `/api/onboarding/health-intake/route.ts`, `/api/onboarding/insurance/route.ts`, `/api/onboarding/life-vision/route.ts`, `/api/onboarding/motivations/route.ts`, `/api/onboarding/persona-goals/route.ts`, `/api/onboarding/profile-summary/route.ts`, `/api/onboarding/risk-profile/route.ts`, `/api/onboarding/sections/route.ts`

### Domain CRUD

`/api/career/{applications,connections,profile,resumes}/...`, `/api/education/{certifications,courses,records,study-logs}/...`, `/api/employer/{jobs,matches,profile}/...`, `/api/jobs/matches/...`, `/api/user-graph/{actions,life-events}/...`, `/api/goals/[id]/route.ts`, `/api/goals/route.ts`, `/api/arcana/intake/{start,upsert}/route.ts`, `/api/arcana/profile/route.ts`, `/api/arcana/lead-package/consent/route.ts`

### Integrations / OAuth / sync

`/api/integrations/credly/...`, `/api/integrations/google/...`, `/api/integrations/linkedin/...`, `/api/integrations/microsoft/...`, `/api/integrations/oauth/...`, `/api/integrations/plaid/...`, `/api/integrations/stripe/...`

### Storage + Profile + Data

`/api/storage/[...path]/route.ts`, `/api/user/{delete,export,password,profile,settings}/...`, `/api/user-sync/route.ts`, `/api/data/{career,education,financial}/upload/route.ts`

### Dashboard read-only summaries

`/api/dashboard/{notifications,summary,tasks}/route.ts`

### Health monitoring (data ingestion + alerts)

`/api/health-monitoring/{alerts,manual-entry,preferences,wearable-event}/route.ts`

### Provider portal CRUD (recommendation surface IS governed)

`/api/provider/portal/{analytics,clients,dashboard,leads,messages}/...` (read paths)
`/api/provider/patients/[id]/view/route.ts`, `/api/provider/patients/route.ts`
`/api/engagements/{grant,route,[id]/revoke}/route.ts`

### Scenario-lab persistence (the _simulate_ surface IS in MUST_WIRE)

`/api/scenario-lab/{documents,health,jobs,pins,plans,reports,scenarios,versions}/...` — non-simulate paths.

### Beta + feedback

`/api/beta/{cohorts,flags,invite}/route.ts`, `/api/feedback/{bug,nps,recommendation,simulation}/route.ts`

### Waitlist

`/api/waitlist/route.ts`

## 4. GOVERNANCE_INFRA

Routes that ARE the governance layer; they validate, retrieve principles, or expose audit:

- `/api/governance/validate/route.ts`
- `/api/governance/audit/[id]/route.ts`
- `/api/governance/principles/route.ts`
- `/api/governance/agents/register/route.ts`
- `/api/constitutional/review/route.ts`
- `/api/constitutional/audit/[id]/route.ts`
- `/api/constitutional/principles/route.ts`

## 5. INTERNAL

`/api/internal/agent/ingest/route.ts` — service-role agent emit path. Not authenticated as a user; emits raw events. Must validate the agent_registry membership AND call `validateAndPersist` for any user-facing payload before queuing for delivery. Listed in MUST_WIRE responsibilities since it can produce user-visible content.

## 6. Recommendation

The 27 MUST_WIRE routes are the bottleneck for "no governance bypasses". Each follows the same wiring pattern; the canonical example is `apps/web/src/app/api/provider/portal/recommendations/route.ts`. The Sprint L2 `reviewAndPersist` middleware (Sprint M Phase 3 retrieval upgrade) is the correct entry point for streaming responses; `validateAndPersist` is correct for one-shot JSON responses.

Wiring estimate: ~10 minutes per route under the existing pattern. The total surface — ~27 routes × 10 min — is ~4.5 person-hours of mechanical refactor. The Sprint M deliverable is the **report** (this document) plus the **plumbing** (live retrieval, middleware, audit columns, observability hooks) — physical wiring of every MUST_WIRE route is the closing punch-list item before opening the beta gate.

## 7. Sprint M closeout punch-list

- [ ] Wire the 27 MUST_WIRE routes through `validateAndPersist` / `reviewAndPersist`.
- [ ] Re-run `verify_088_governance_rls.sql` + `verify_089_constitutional_rls.sql` against the production Supabase project.
- [ ] Add an integration test that scans `apps/web/src/app/api/**` and asserts every MUST_WIRE route imports `validateAndPersist` or `reviewAndPersist`.
- [ ] Disable the `governance.constitutional_live` flag override path so the live retrieval is always on in production cohorts.
- [ ] Enable the `beta.feedback_widget` flag once the in-app widget is live.
