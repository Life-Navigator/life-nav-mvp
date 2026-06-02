# Economic Governance Policy

Sprint O.0.2 Phase 12 deliverable.

This document is the contract between the platform and its operators
about how money is governed.

## The seven rules

### 1. User welfare comes first

Economic decisions never compromise user welfare. The platform will
not refuse a crisis-escalation response to save $0.003. Cost gates
are bypassed for `governance.constitutional_review` — the constitutional
pipeline is always in scope.

### 2. Platform sustainability matters

A user-welfare-first platform must remain solvent to keep helping
users. The $500/month cap exists because losing more money than that
ends the platform for everyone.

### 3. No unlimited consumption

No user, no tenant, no feature gets unbounded spend. Every chargeable
action is metered. Every budget has a cap. Every cap has an
escalation path (operator override) but no silent bypass.

### 4. Learning is prioritized over scale

The internal beta is a learning environment. Quality of feedback >
quantity of users. We onboard 10–20 users intentionally to maximize
signal-per-user-dollar.

### 5. Budget protection is mandatory

`economic.platform_budget.monthly_cap_micros` is the line. The
HARD_STOP at 100% is not aspirational — it's enforced at every
provider call by the `BudgetManager.evaluate` chokepoint. Bypassing
the cap requires explicit `operator_override = TRUE` with a documented
reason.

### 6. Expensive features require justification

Tier 3 features (heavy multimodal reasoning, e.g. video understanding)
require operator approval. Tier 2 features (recommendation, decision
intelligence, simulation, chat) use middle-cost models. Tier 1
features (extraction, tagging, classification, transcription,
constitutional review) use Gemini Flash by default. A feature
incorrectly classified as Tier 2 instead of Tier 1 is a defect; tier
mismatches multiply the per-call cost by ~17×.

### 7. Emergency protections always win

Five protections take precedence over everything else:

- Platform HARD_STOP (100%) → no chargeable call runs.
- Platform EMERGENCY (95%) → only critical features run.
- User BLOCKED (100% of any window) → user is denied.
- AbuseDetector BLOCK action → user is denied + audited.
- CircuitBreaker DISABLED for a feature → feature is denied.

These five may not be overridden without two-operator authorization
(documented in the runbook).

## How this policy is enforced

| Rule | Mechanism                                                                                         |
| ---- | ------------------------------------------------------------------------------------------------- |
| 1    | `governance_review` open-action = PASS; constitutional pipeline never breaks                      |
| 2    | `economic.platform_budget` singleton row + nightly check in dashboard                             |
| 3    | `economic.user_budgets` lazy-created with internal-beta defaults                                  |
| 4    | `BETA_RATE_LIMITS` documented in `lib/economic/types.ts`; rate limiter + abuse detector enforce   |
| 5    | `BudgetManager.evaluate` is the chokepoint; HARD_STOP returns 503                                 |
| 6    | `ModelSelectionPolicy.FEATURE_TIER` is the contract; tier 3 requires `operator_approved_features` |
| 7    | Decision precedence order in `ECONOMIC_GOVERNANCE_ARCHITECTURE.md` §"Decision precedence"         |

## Operator-override workflow

Both `economic.user_budgets.operator_override` and
`economic.platform_budget.operator_override` are boolean. Setting
them to TRUE bypasses the BLOCK/HARD_STOP semantic and downgrades
to WARN/EMERGENCY.

The operator must:

1. Document the override reason in the `operator_override_reason`
   column (audit trail).
2. Set a calendar reminder to revoke the override when the
   exceptional circumstance ends.
3. Notify the on-call channel that the override is active.

There is intentionally no UI for setting the override — it requires
service-role SQL, which is itself audited.

## Decision-rights matrix

| Action                                         | Who                                 |
| ---------------------------------------------- | ----------------------------------- |
| Raise an individual user's daily budget        | Engineer + ops co-sign              |
| Lower a user's daily budget                    | Anyone with operator role           |
| Set `operator_override = TRUE` on a user       | Engineer + ops co-sign              |
| Set `operator_override = TRUE` on the platform | Engineer + ops + finance co-sign    |
| Open a circuit breaker manually                | Anyone with operator role           |
| Close a circuit breaker manually               | Anyone with operator role           |
| Raise platform monthly_cap_micros              | Finance + executive co-sign         |
| Add a new model to `RATE_TABLE`                | Engineer (single-signature; tested) |
| Change `FEATURE_TIER` mapping                  | Engineer + finance co-sign          |

## Auditability

Every economic decision produces a row in:

- `economic.usage_events` (chargeable action), OR
- `economic.abuse_events` (non-chargeable policy event), OR
- `economic.circuit_breakers.updated_at` (breaker state change), OR
- `economic.user_budgets.metadata` (operator override + reason).

The dashboard's `data_freshness` block surfaces any source that hasn't
written in the window — operator can spot wiring drift immediately.

## Out-of-policy events

If any of these is observed, it is a policy violation and triggers a
review:

- `economic.usage_events.cost_usd_micros > 1_000_000` (single $1+ call).
- `economic.user_budgets.current_monthly_micros > monthly_budget_micros`
  AND `operator_override = FALSE`.
- `economic.platform_budget.current_monthly_micros >= monthly_cap_micros`
  AND `operator_override = FALSE`.
- A row in `economic.usage_events` with `provider = NULL` AND
  `cost_usd_micros > 0` (cost without provenance).

The on-call runbook §"Economic policy violations" (out of scope for
this sprint — Closed Beta task) documents the triage workflow.

## Review cadence

- Daily: dashboard `spend.projected_month_end_usd` checked.
- Weekly: review `economic.abuse_events` summary.
- Monthly: reconcile vendor invoices vs `economic.usage_events`
  (Closed Beta task — reconciliation reporting not in MVP scope).
- Per release: re-run the beta cost simulation. A change that
  pushes projection over $350 requires PR sign-off from finance.
