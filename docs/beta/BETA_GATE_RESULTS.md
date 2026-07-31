# Beta Gate Results — evidence table

**Commit `5fbdef00` · deployed web `dpl_8ctNCH5UraEWCN37rVLLC5s4SAqA` · 2026-07-30**
Scale: PASS · FAIL · PARTIAL · UNMEASURED · N/A

| Gate                          | Result                  | Evidence                                                                                                                                                                         | Severity     | Owner        | Minimum corrective action                                                                   |
| ----------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------ | ------------------------------------------------------------------------------------------- |
| **A** Auth & tenant isolation | **UNMEASURED**          | No credentials. CI enforces both-endpoint tenant binding, single writer, read-only clients (mutation-proven) — code-level only                                                   | **Critical** | Security     | 2 synthetic tenants; run UI/API/retrieval/citation/download probes; require zero disclosure |
| **B** Core usability          | **UNMEASURED**          | Web 200; journeys never completed                                                                                                                                                | **Critical** | Product      | Complete J1–J3 as a user, unaided                                                           |
| **C** AI response reporting   | **PARTIAL**             | `analytics.py:40` pilot feedback (thumbs/trust/comment); `analytics.advisor_turns`; routes for bug/nps/pilot/recommendation/simulation. **No categorized response-level report** | **Critical** | Product + AI | Add the 7 report categories bound to a response id; verify the reconstruction payload       |
| **D** Feedback & support      | **PARTIAL**             | `feedback.bug_reports`, `overall_feedback`, `nps_responses`, `recommendation_feedback`, `simulation_feedback`                                                                    | High         | Support      | Confirm a queue with owner, severity, status; a secure spreadsheet is acceptable            |
| **E** AI safety & grounding   | **UNMEASURED**          | 11 scenarios never run against deployment; no golden set exists (ADR-004 blocked)                                                                                                | **Critical** | AI/Retrieval | Run the 11 scenarios; record unsupported-claim and citation-correctness rates               |
| **F** Data control & privacy  | **PARTIAL**             | `/legal` routes exist; consent tables exist                                                                                                                                      | High         | Privacy      | Verify consent recorded with version+timestamp; confirm no secrets client-side              |
| **G** Operational containment | **PARTIAL (strongest)** | `ops.feature_flags`, `user_feature_flag_overrides`, `beta_invites`, `cohorts`, `llm_usage_meter` (migration 090); `GRAPH_GROUNDING_ENABLED=false`                                | High         | Platform Ops | Exercise one non-destructive flag disable; name the incident owner                          |
| **H** Deployment confidence   | **PARTIAL**             | Version identifiable. **Audited commit `5fbdef00` ≠ deployed (`origin/main` `91922cbd`)**                                                                                        | High         | Eng Lead     | Audit the actual RC; confirm required checks passed on it                                   |
| **I** Accessibility           | **UNMEASURED**          | Never measured — on record in the scorecard                                                                                                                                      | Medium       | UX           | axe on auth, onboarding, shell, dashboard, advisor, settings                                |
| **J** Performance             | **PARTIAL**             | `/healthz` 0.269s, `/readyz` 0.124s, web 0.480s — **measured**. Journey latency unmeasured                                                                                       | Medium       | Platform Ops | Measure advisor response + citation open under synthetic cohort load                        |

## Measured facts (reproducible)

```
GET https://lifenavigator-core-api.fly.dev/healthz  → 200  0.269s  {"status":"ok"}
GET https://lifenavigator-core-api.fly.dev/readyz   → 200  0.124s
     {"status":"ok","services":{"supabase":true,"qdrant":true,"neo4j":true,"gemini":true}}
GET https://lifenavigator.tech                      → 200  0.480s  dpl_8ctNCH5UraEWCN37rVLLC5s4SAqA
```

No authenticated request was made. No customer data was accessed. No cross-tenant probe was run.
