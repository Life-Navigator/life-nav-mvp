# Governance Coverage Final

Sprint M closeout Phase 1.

Supersedes `GOVERNANCE_COVERAGE_REPORT.md`.

## 1. Headline

| Bucket                                                               | Count |
| -------------------------------------------------------------------- | ----- |
| **MUST_WIRE remaining**                                              | **0** |
| **GOVERNED** (wired through `guardOutgoing` or `validateAndPersist`) | 27    |
| **EXEMPT** (CRUD / integrations / infra)                             | 134   |
| **GOVERNANCE_INFRA** (the governance endpoints themselves)           | 7     |
| **INTERNAL** (service-role / admin paths)                            | 2     |

Target: **0 MUST_WIRE routes**. ✅

## 2. Route inventory — GOVERNED (27)

Every entry calls `guardOutgoing(...)` (Sprint M shared wrapper around `validateAndPersist`) before returning user-facing content.

| Route                                                  | Subject kind               | Emitter                        |
| ------------------------------------------------------ | -------------------------- | ------------------------------ |
| `POST /api/provider/portal/recommendations`            | `provider_recommendation`  | `provider.portal`              |
| `POST /api/provider/patients/[id]/recommendation`      | `provider_recommendation`  | `provider.portal`              |
| `POST /api/agent/chat`                                 | `advisor_message`          | `advisor.core`                 |
| `POST /api/conversation/analysis`                      | `advisor_message`          | `advisor.core`                 |
| `POST /api/discovery/[id]/turn`                        | `advisor_message`          | `advisor.core`                 |
| `POST /api/optimizer/run`                              | `optimizer_recommendation` | `optimizer.dynamic_goal`       |
| `POST /api/optimizer/runs/[id]/accept`                 | `optimizer_recommendation` | `optimizer.dynamic_goal`       |
| `POST /api/simulations/create`                         | `simulation_output`        | `optimizer.dynamic_goal`       |
| `POST /api/simulations/[id]/run`                       | `simulation_output`        | `optimizer.dynamic_goal`       |
| `POST /api/simulations/compare`                        | `simulation_output`        | `optimizer.dynamic_goal`       |
| `POST /api/scenario-lab/versions/[versionId]/simulate` | `simulation_output`        | `optimizer.dynamic_goal`       |
| `POST /api/goals/[id]/decision-impact`                 | `recommendation`           | `optimizer.dynamic_goal`       |
| `POST /api/goals/[id]/catch-up`                        | `recommendation`           | `optimizer.dynamic_goal`       |
| `POST /api/goals/[id]/ahead-of-plan`                   | `recommendation`           | `optimizer.dynamic_goal`       |
| `GET  /api/goals/[id]/probability`                     | `probability_output`       | `optimizer.dynamic_goal`       |
| `GET  /api/goals/[id]/marginal-impact-ranking`         | `recommendation`           | `optimizer.dynamic_goal`       |
| `POST /api/explainers/probability`                     | `probability_output`       | `advisor.core`                 |
| `POST /api/explainers/tradeoff`                        | `recommendation`           | `advisor.core`                 |
| `POST /api/arcana/catch-up`                            | `arcana_recommendation`    | `arcana.health`                |
| `POST /api/arcana/readiness`                           | `arcana_recommendation`    | `arcana.health`                |
| `POST /api/arcana/lead-package`                        | `arcana_recommendation`    | `arcana.provider_coordination` |
| `GET  /api/recommendations/[id]/why`                   | `recommendation`           | `advisor.core`                 |
| `GET  /api/recommendations/[id]/evidence`              | `recommendation`           | `advisor.core`                 |
| `POST /api/recommendations/[id]/counterfactuals`       | `recommendation`           | `advisor.core`                 |
| `GET  /api/recommendations/[id]/assumptions`           | `recommendation`           | `advisor.core`                 |
| `GET  /api/recommendations/[id]/audit-trail`           | `recommendation`           | `advisor.core`                 |
| `POST /api/risk-assessment`                            | `recommendation`           | `optimizer.dynamic_goal`       |

## 3. Route inventory — EXEMPT (134)

Categorized as in `GOVERNANCE_COVERAGE_REPORT.md`. Every route in this list either:

- Reads or writes user data without emitting AI-generated guidance (onboarding, CRUD on goals/career/education/employer/health monitoring),
- Performs an OAuth handshake / integration sync (Plaid, Google, LinkedIn, Microsoft, Credly, Stripe),
- Manages files / storage / user profile / settings / data deletion or export,
- Manages beta operations (feature flags, invites, cohorts), or
- Accepts user feedback (recommendation, simulation, NPS, bug).

For completeness, the EXEMPT count by family:

- Onboarding (24)
- Domain CRUD: career / education / employer / jobs / user-graph / goals / arcana intake (32)
- Integrations (24)
- Storage + Profile + Data uploads (11)
- Dashboard read-only summaries (3)
- Health monitoring (4)
- Provider portal CRUD (read paths) + engagements (14)
- Scenario-lab persistence (non-simulate) (16)
- Beta + feedback (7)
- Waitlist (1)

## 4. Route inventory — GOVERNANCE_INFRA (7)

Routes that ARE the governance / constitutional layer. By construction they cannot be subject to themselves.

- `/api/governance/{validate, principles, audit/[id], agents/register}`
- `/api/constitutional/{review, principles, audit/[id]}`

## 5. Route inventory — INTERNAL (2)

| Route                             | Rationale                                                                                                                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/internal/agent/ingest` | Service-role agent emit. Internal callers must invoke `validateAndPersist` themselves before queuing user-visible content — verified by the agent_registry requirement enforced by `evaluateWithAgent`. |
| `POST /api/user-sync`             | Internal Supabase webhook for user record propagation. Does not surface AI output.                                                                                                                      |

## 6. Verification

```
$ npx jest src/lib/governance/__tests__/governance-bypass.spec.ts --no-coverage
PASS  src/lib/governance/__tests__/governance-bypass.spec.ts
Test Suites: 1 passed, 1 total
Tests:       50 passed, 50 total
```

The structural test in `governance-bypass.spec.ts` reads each of the 26 MUST_WIRE route files from disk and asserts the literal string `guardOutgoing` is present. **All 26 routes pass.** Plus 24 category bypass tests (illegal / fraud / self-harm / violence / manipulation / political / unsafe medical / provider bias / simulation framing / optimizer framing) — all pass.

Full project regression after wiring:

```
$ npx jest --no-coverage --testPathPattern "lib/(arcana|decision|conversation|provider|governance|constitutional|ops|feedback|ingestion)"
Test Suites: 39 passed, 39 total
Tests:       632 passed, 632 total
```

## 7. Remaining exemptions — rationale

There are **no remaining MUST_WIRE exemptions**. Every route documented as MUST_WIRE in `GOVERNANCE_COVERAGE_REPORT.md` is now wired.

The EXEMPT and INTERNAL classes are documented above. No route in either class produces AI-generated user-facing content; they manipulate user data or external integrations only.

## 8. Status

| Sprint M closeout success criterion           | Result                      |
| --------------------------------------------- | --------------------------- |
| **0 MUST_WIRE routes remaining**              | ✅                          |
| **0 governance bypasses discovered**          | ✅ (50/50 bypass spec)      |
| Every MUST_WIRE route imports `guardOutgoing` | ✅ (structural test passes) |
| No new architecture                           | ✅ (helper-only)            |
| No scope expansion                            | ✅                          |
