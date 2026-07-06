# Production Launch Checklist

Sprint M Phase 10 deliverable. The list to walk before opening the beta
gate.

## 1. Infrastructure

- [ ] **Vercel** — production project provisioned + custom domain bound + SSL active.
- [ ] **Vercel** — preview deployments use a distinct Supabase project (env segregation verified).
- [ ] **Vercel** — security headers (`Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`, `Referrer-Policy`) configured.
- [ ] **Fly.io** — Rust ingestion worker deployed with autoscaling 1→3, health-check on `/healthz`.
- [ ] **Fly.io** — FastAPI service (if any) deployed with restart-on-fail policy.
- [ ] **Supabase** — production project provisioned; project ID logged in the launch journal.
- [ ] **Supabase** — Point-in-time recovery enabled (minimum 7d).
- [ ] **Supabase** — Daily logical backups verified; restore drill executed once.
- [ ] **Supabase** — Connection pooler (PgBouncer transaction mode) configured.
- [ ] **Neo4j** — production instance provisioned with TLS; weekly snapshot schedule confirmed.
- [ ] **Qdrant** — production cluster provisioned with TLS; snapshot schedule confirmed.

## 2. Secrets

- [ ] All entries in `apps/web/src/lib/secrets/manager.ts::SECRET_REGISTRY` resolved at runtime.
- [ ] `inventorySecrets()` returns `configured: true` for every required key.
- [ ] No secret remains in `.env*` files committed to the repo (grep + git history confirmed).
- [ ] `USE_GOOGLE_SECRET_MANAGER=1` enabled in production, or the env path documented for the operator.
- [ ] Secret rotation policy documented (90-day max age for `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `PLAID_SECRET`).

## 3. Database migrations

- [ ] All migrations through `090_beta_ops_feedback_meter.sql` applied in production.
- [ ] Self-test `DO` blocks in each migration succeeded.
- [ ] RLS verifiers run + passed:
  - `verify_086_arcana_rls.sql`
  - `verify_087_provider_portal_rls.sql`
  - `verify_088_governance_rls.sql`
  - `verify_089_constitutional_rls.sql`
- [ ] At least 15 active `ConstitutionalPrinciple` entities present in `governance.constitutional_entities`.

## 4. Governance

- [ ] Every MUST_WIRE route in `GOVERNANCE_COVERAGE_REPORT.md` is wired through `validateAndPersist` or `reviewAndPersist`.
- [ ] `governance.agent_registry` contains all live agents; non-registered emitters are blocked (test scenario verified in staging).
- [ ] Constitutional retrieval is LIVE (`governance.constitutional_entities` count > 0, `retrieveConstitutionalRuleSet` returns `ok: true` in staging).
- [ ] Constitutional retrieval **fails closed** on simulated DB outage (smoke-tested by detaching the DB role).
- [ ] `verify_089_constitutional_rls.sql` confirms `BLOCK_AND_REDIRECT` is rejected at the enum level.
- [ ] All 8 governance principles + 15 constitutional principles documented; user-facing surface published at `/api/governance/principles` and `/api/constitutional/principles`.

## 5. Monitoring

- [ ] `SENTRY_DSN` configured + a test exception successfully landed.
- [ ] `OTEL_EXPORTER_OTLP_ENDPOINT` configured (optional but logged).
- [ ] `ops.llm_usage_meter` receives writes from at least one LLM-backed route in staging.
- [ ] Dashboards from `OBSERVABILITY_RUNBOOK.md` are stood up.
- [ ] Alert thresholds wired (retrieval failure rate, verdict=SAFE rate, cost/DAU, crisis HIGH+).

## 6. Onboarding

- [ ] New user can sign up + complete onboarding without errors.
- [ ] Onboarding writes to all expected tables; row counts verified for one test user.
- [ ] Plaid sandbox + production credentials separated; production credentials confirmed live by linking a test account.
- [ ] Provider invitation pathway tested with one verified provider profile.

## 7. Feedback

- [ ] The 4 feedback endpoints accept payloads and write rows.
- [ ] `validateNps` enforces 0–10 integer bounds.
- [ ] Bug widget visible in the UI under the `beta.feedback_widget` flag.
- [ ] NPS prompt visible under the `beta.nps_prompt` flag at the configured cadence.

## 8. End-to-end journeys

- [ ] Journey 1 — New User → Goals → Plaid → Recommendations → Simulation — exercised manually.
- [ ] Journey 2 — Arcana Health → Readiness → Provider Matching — exercised manually.
- [ ] Journey 3 — Career Planning → Decision Intelligence → Trajectory Analysis — exercised manually.
- [ ] Journey 4 — Constitutional Governance scenarios (illegal request, crisis, future collapse) — exercised manually + matched against `orchestrator.test.ts`.

## 9. Beta operations

- [ ] First batch of invite codes generated via `POST /api/beta/invite` (service role).
- [ ] At least one user added to `ops.user_cohorts` with `cohort_slug='internal'`.
- [ ] Feature flags `arcana.enabled`, `provider_portal.enabled`, `simulations.life_trajectory`, `advisor.conversation_intel`, `governance.constitutional_live`, `governance.crisis_escalation`, `integrations.plaid`, `integrations.gemini` set to the launch state.
- [ ] Cost circuit-breakers documented; `integrations.gemini` toggle drill executed once.

## 10. Disaster recovery

- [ ] Documented runbook for: Supabase outage, Neo4j outage, Qdrant outage, Gemini outage, Vercel outage.
- [ ] Supabase PITR restore drilled to a staging project.
- [ ] Constitutional retrieval fails closed under DB outage (verified in step §4).
- [ ] Rollback path: previous Vercel deployment + last known good Supabase migration tag.
- [ ] On-call rotation defined; PagerDuty / Opsgenie wired (or fallback contact documented if not).

## 11. Compliance + legal

- [ ] Terms of service + privacy policy published.
- [ ] User-data deletion endpoint (`/api/user/delete`) verified.
- [ ] User-data export endpoint (`/api/user/export`) verified.
- [ ] DPA in place with Supabase, Gemini, Plaid, Neo4j, Qdrant.
- [ ] HIPAA / BAA status documented for the Arcana surface (Arcana ships PHI-minimized; BAA strategy noted in the launch journal).

## 12. Sign-off

- [ ] Engineering — owner sign-off on §§1-5
- [ ] Operations — owner sign-off on §§5-7, §10
- [ ] Product — owner sign-off on §§8-9
- [ ] Legal / compliance — owner sign-off on §11

When all boxes are checked: open the beta gate.

---

### Status snapshot at end of Sprint M

| Area                               | Code                             | Infra                                                                  |
| ---------------------------------- | -------------------------------- | ---------------------------------------------------------------------- |
| Migrations 086-090                 | ✅ committed                     | ⚠ apply to prod required                                               |
| Governance + Constitutional layer  | ✅ shipped                       | ✅ runs in-process                                                     |
| Live constitutional retrieval      | ✅ shipped                       | ⚠ requires populated `constitutional_entities` (089 seed handles this) |
| Secrets adapter                    | ✅ shipped                       | ⚠ env / GSM operator step                                              |
| Feature flags + invites + cohorts  | ✅ shipped + seeded              | n/a                                                                    |
| Feedback (4 routes)                | ✅ shipped                       | n/a                                                                    |
| Observability helpers + cost meter | ✅ shipped                       | ⚠ Sentry DSN + OTel endpoint operator step                             |
| Governance coverage report         | ✅ shipped                       | n/a — 27 MUST_WIRE routes documented                                   |
| 4 user journeys                    | ✅ unit + integration tests      | ⚠ manual smoke tests required against prod URLs                        |
| **Tests**                          | **516 passing across 34 suites** | n/a                                                                    |

The code side of Sprint M is complete. The remaining items are
operator steps documented above.
