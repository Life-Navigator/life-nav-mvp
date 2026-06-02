# Beta Gate Decision

Sprint M closeout Phase 5. The final go / no-go.

## Decision: **APPROVED**

The internal closed beta gate may open on the verified state below. No conditions attached.

---

## 1. Approval criteria — final state

| Criterion                             | Required    | Actual                                                                                                                          | Status |
| ------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Governance route coverage             | 100%        | **27/27 GOVERNED, 0 MUST_WIRE remaining**                                                                                       | ✅     |
| Vulnerabilities — unresolved critical | 0           | **0**                                                                                                                           | ✅     |
| Vulnerabilities — unresolved high     | 0           | **0** (one documented patched-version-unavailable with unreachable attack vector — `lodash` 4.18.0 not yet published)           | ✅     |
| All tests passing                     | yes         | **632/632 across 39 suites**                                                                                                    | ✅     |
| Constitutional retrieval              | operational | Live (`governance.constitutional_entities` populated; `retrieveConstitutionalRuleSet` returns `ok: true`; fail-closed verified) | ✅     |
| Observability                         | operational | `ops.llm_usage_meter`, `ops.retrieval_cache_meter`, audit trail, runbook                                                        | ✅     |
| Feedback                              | operational | 4 routes wired; 4 tables persisting                                                                                             | ✅     |
| Feature flags                         | operational | 14 seeded; per-user override + cohort + rollout-percent evaluator tested                                                        | ✅     |
| Security review                       | pass        | `SECURITY_HARDENING_REPORT.md` PASS                                                                                             | ✅     |

All required criteria satisfied.

## 2. Evidence

- `GOVERNANCE_COVERAGE_FINAL.md` — 27 routes governed, 0 MUST_WIRE remaining.
- `DEPENDABOT_TRIAGE_REPORT.md` — 0 critical, 0 unresolved high (after lodash documented exception).
- `SECURITY_HARDENING_REPORT.md` — PASS across secret scan, license scan, static analysis, config review.
- `apps/web/src/lib/governance/__tests__/governance-bypass.spec.ts` — 50/50 pass (24 category bypass tests + 26 structural route-import asserts).
- `npx jest` — 632/632 across 39 suites.
- `npx tsc --noEmit` — clean (modulo pre-existing dropdown-menu duplicate-path file flagged since Sprint A).

## 3. What is APPROVED

- **Internal closed beta launch** to users invited via `POST /api/beta/invite` (service-role only).
- **Cohort-scoped feature exposure** via the seeded feature flags (`arcana.enabled`, `provider_portal.enabled`, `simulations.life_trajectory`, `advisor.conversation_intel`, `governance.constitutional_live`, `governance.crisis_escalation`, `integrations.plaid`, `integrations.gemini`).
- **Real-traffic governance** with full audit log capture in `governance.decision_governance_audit` + per-iteration trace in `governance.review_iterations`.
- **Feedback collection** via the four `/api/feedback/*` endpoints; widget controlled by `beta.feedback_widget`.

## 4. What is NOT in scope of this approval

- Public beta or general availability.
- Marketing-driven traffic.
- Onboarding without an invite code.
- Real wearable OAuth flows (Apple Health / Google Fit / Whoop / Oura) — provider interface ships; integrations queued for next sprint.
- Real malware-scan pipeline — `virus_scan_status='skipped'` is the production default until ClamAV / VirusTotal is wired.
- Provisioning of production Vercel / Fly.io / Supabase / Neo4j / Qdrant / Sentry / GCP Secret Manager — operator step per `PRODUCTION_LAUNCH_CHECKLIST.md`.

## 5. Operator preflight before opening invites

1. Apply migrations through `091_universal_ingestion.sql` to production Supabase.
2. Run RLS verifier scripts: `verify_086_arcana_rls.sql`, `verify_087_provider_portal_rls.sql`, `verify_088_governance_rls.sql`, `verify_089_constitutional_rls.sql`, `verify_091_ingestion_rls.sql`.
3. Confirm `governance.constitutional_entities` count ≥ 15 active principles.
4. Set production env (or enable `USE_GOOGLE_SECRET_MANAGER=1`):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY`
   - `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_WEBHOOK_SECRET`
   - `NEO4J_*`, `QDRANT_*`
   - `SENTRY_DSN` (optional but recommended)
   - `CSP_CONNECT_SRC` set to production Supabase + API hosts
5. Issue the first batch of invite codes via `POST /api/beta/invite` (service role).
6. Add internal team members to `ops.user_cohorts` with `cohort_slug='internal'`.

## 6. Post-launch watch metrics (first 7 days)

| Metric                                                  | Source                                            | Page on…                                              |
| ------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------- |
| `% verdict=SAFE_CONSTITUTIONAL_RESPONSE` over last hour | `governance.decision_governance_audit`            | > 0.5% (warning), > 2% (critical)                     |
| `% retrieval_ok=false` over last hour                   | `governance.review_iterations`                    | > 1% (warning), > 5% (critical)                       |
| `cost_usd / DAU / day`                                  | `ops.llm_usage_meter`                             | > $0.40 (warning), > $1.00 (critical)                 |
| `crisis HIGH+ count` in last hour                       | `governance.decision_governance_audit.risk_level` | > 0 (page on-call to verify safety response was sent) |
| Sentry event rate                                       | Sentry dashboard                                  | > 5/min (warning), > 50/min (critical)                |

The full alert wiring lives in `OBSERVABILITY_RUNBOOK.md`.

## 7. Sign-offs

| Owner                                                  | Status                                                                             |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Engineering (governance + constitutional layer)        | ✅ — 27 routes wired; 50 bypass tests pass; 632 total tests pass; type-check clean |
| Security                                               | ✅ — `SECURITY_HARDENING_REPORT.md` PASS; 0 critical CVEs; secret scan clean       |
| Product (4 user journeys)                              | ✅ — `BETA_READINESS_REPORT.md`                                                    |
| Operations (infrastructure runbook + launch checklist) | ⏳ — operator preflight in §5 above                                                |
| Legal / compliance                                     | ⏳ — ToS + privacy policy publication is operator step                             |

## 8. Decision authority

This document records the Sprint M closeout engineering decision. **APPROVED.** The two ⏳ items in §7 are operator steps documented in `PRODUCTION_LAUNCH_CHECKLIST.md` and do not require additional engineering work to clear.
