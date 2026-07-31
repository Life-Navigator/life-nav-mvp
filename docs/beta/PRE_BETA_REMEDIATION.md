# Pre-Beta Remediation — minimal list

Ordered by whether it blocks invitations. **Scope reduction and cohort restriction are preferred over
building infrastructure.**

## Must complete before ANY beta user

| ID      | Finding                                               | Impact                                                                              | Sev          | Evidence                                        | Journey | Smallest correction                                             | Owner      | Effort | Verification                                                                      | Blocks invites |
| ------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------ | ----------------------------------------------- | ------- | --------------------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------------------- | -------------- |
| **R-1** | Tenant isolation unverified on deployment             | Cross-tenant disclosure would be catastrophic and is the one automatic no-go        | **Critical** | Gate A UNMEASURED                               | all     | 2 synthetic tenants; probe UI/API/retrieval/citations/downloads | Security   | 0.5d   | zero foreign-tenant data in any surface                                           | **YES**        |
| **R-2** | Primary advisor journey never completed on deployment | If J1→J3 cannot be completed, there is no beta                                      | **Critical** | Gate B UNMEASURED                               | J1–J3   | Complete it unaided as a synthetic user                         | Product    | 0.5d   | journey completes, no operator intervention                                       | **YES**        |
| **R-3** | No categorized advisor-response report                | Automatic no-go #4: users cannot report a harmful/wrong answer against the response | **Critical** | Gate C — 5 feedback routes, none response-level | J4      | Add 7 categories bound to a response id + trace id              | Product+AI | 2d     | submit a report; reconstruct question, response, model, prompt version, citations | **YES**        |
| **R-4** | Named beta incident owner                             | Automatic no-go #10                                                                 | High         | none found                                      | all     | Name a person and a backup                                      | Eng Lead   | 15m    | recorded in the runbook                                                           | **YES**        |
| **R-5** | Audited commit ≠ deployed commit                      | Auditing a branch and launching main proves nothing                                 | High         | `5fbdef00` vs `91922cbd`                        | all     | Re-audit the actual RC                                          | Eng Lead   | 0.5d   | audit cites the deployed SHA                                                      | **YES**        |

## Must complete before expanding the cohort

| ID   | Finding                                                                                        | Owner        | Effort |
| ---- | ---------------------------------------------------------------------------------------------- | ------------ | ------ |
| R-6  | Run the 11 AI-safety scenarios; record unsupported-claim + citation-correctness rates (Gate E) | AI/Retrieval | 2d     |
| R-7  | Exercise one non-destructive feature-disable / rollback (Gate G)                               | Platform Ops | 0.5d   |
| R-8  | Accessibility baseline on the 6 critical surfaces (Gate I)                                     | UX           | 1d     |
| R-9  | Confirm feedback review queue has owner, severity, status (Gate D)                             | Support      | 0.5d   |
| R-10 | Verify consent recorded with version + timestamp (Gate F)                                      | Privacy      | 0.5d   |

## Safe to learn through beta

Confusing labels · minor visual/responsive defects · imperfect-but-safe recommendations · the ~120
off-journey dashboard routes (**hide from beta nav, do not fix**) · noncritical duplication ·
recoverable integration errors · ingestion status UX gaps.

## Post-beta

Provenance completeness (ADR-002) · graph traversal in answers (ADR-008) · transaction edge migration
(ADR-001) · gateway retirement (ADR-009) · preview environment · branch protection · local synthetic
environment.

**Note:** R-1, R-2 and R-5 are _verification_, not construction. R-3 and R-4 are the only items that
build or assign anything. The pre-beta critical path is roughly **2–3 days**, most of it measurement.
