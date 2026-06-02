# Change Management Policy

Owner: Engineering Manager
Version: 1.0
Effective: 2026-06-01
Review cadence: annual

## 1. Purpose

Define how code, schema, infrastructure, and configuration changes
reach production safely and auditably.

## 2. Standard change (default path)

1. **Branch.** Engineer creates a feature branch from `mvp`.
2. **Test.** All tests (currently 1319+) must pass locally.
3. **PR.** Pull request opened with description, test plan, and a
   link to the originating ticket or sprint plan.
4. **CI.** GitHub Actions runs:
   - Type check + lint
   - Full Jest suite
   - `scripts/validation/check_governed_prompt_enforcement.sh`
   - (When migrations touched) verifier scripts under
     `scripts/validation/verify_*.sql`
5. **Review.** At least one approving review from another engineer.
   Sensitive areas (governance, security, character, economic) require
   a second reviewer from the relevant code-owner team.
6. **Merge + deploy.** Squash merge to `mvp`; Vercel auto-deploys
   the resulting commit.
7. **Post-deploy.** Engineer monitors the dashboard for 1 hour after
   merge. Rollback via Vercel deployment list if any alert fires.

## 3. Schema changes (migrations)

All schema changes are SQL migrations under `supabase/migrations/`.
Numbered sequentially. Forward-only — no destructive reversals.
Every migration includes a `DO $$ ... $$` self-test block that fails
to apply if the schema invariants do not hold.

## 4. Infrastructure changes

| System                      | How to change                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------- |
| Vercel project config       | Vercel dashboard with engineering manager + security review for non-trivial changes |
| Supabase project            | Supabase dashboard; record in `enterprise.admin_audit_log`                          |
| Fly.io workers              | `fly` CLI; record in `enterprise.admin_audit_log`                                   |
| Neo4j Aura, Qdrant Cloud    | Provider dashboard; record                                                          |
| Google Cloud Secret Manager | `gcloud secrets versions` with audit log                                            |
| GitHub repository settings  | GitHub Audit Log + record in `enterprise.admin_audit_log`                           |

## 5. Emergency change (incident path)

When an open incident at SEV1 or SEV2 requires an immediate code or
config change:

1. The on-call engineer creates the fix on a branch.
2. CI is required to pass, but the PR review can be done concurrently
   with deployment under SEV1.
3. The fix is recorded on the incident record
   (`enterprise.incidents.metadata.emergency_change`) with a
   reference to the PR.
4. A formal review is required within 5 business days; if the review
   finds issues, the fix is iterated.

## 6. Configuration changes (feature flags, env vars)

| Type                                  | Path                                                                    |
| ------------------------------------- | ----------------------------------------------------------------------- |
| Feature flag (cohort-wide)            | UPDATE `ops.feature_flags` — recorded in `enterprise.admin_audit_log`   |
| Per-user override                     | UPDATE `ops.user_feature_flag_overrides` — recorded                     |
| Production env var                    | Vercel dashboard — recorded; secrets via the rotation framework         |
| Tenant override (model / connector)   | UPDATE `platform.tenant_model_overrides` — recorded                     |
| Operator override on budget / breaker | UPDATE `economic.user_budgets.operator_override` — recorded WITH reason |

## 7. Rollback

- **Code:** Vercel deployment list → "Promote to production" on a
  prior green deployment.
- **Schema:** forward-only; rollback = a new migration that undoes
  the change.
- **Config:** revert the same path used to apply.

## 8. Out of scope

Local development changes are not subject to this policy. Production
deployment is the gate.

## 9. Acceptance

This policy is reviewed annually. Acknowledgement by every engineer
is recorded in the quarterly access review.
