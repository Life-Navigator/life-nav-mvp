# BRANCH_CLEANUP_PLAN.md — Phase 7

No branch is deleted or merged in this sprint. This is the recommended plan, pending owner (T. Riffe) approval.

## Port To Main (valuable unmerged work) — do FIRST

| Branch                                         | Action                                                                                   | Reason                                            | Risk                                                                                   | Approval     |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------ |
| `fix/dashboard-advisor-mode-and-floating-chat` | **Fast-forward `main` → `c50ccff`**, then commit working-tree 165–167 + PDF fixes on top | It is the live production code; main is behind it | LOW (0 behind → clean FF). Resolve migration ordering per Phase 5 before any `db push` | **Required** |

After the FF, branch #1 and main are equal → reclassify #1 for archival.

## Close Now (merged or content-in-main, obsolete)

| Branch                                      | Action                                 | Reason                                                            | Risk                              |
| ------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------- | --------------------------------- |
| `advisor/p0-upgrade-2.3.0`                  | ARCHIVE                                | ancestor of main                                                  | none                              |
| `docs/lios-architecture`                    | ARCHIVE                                | ancestor of main                                                  | none                              |
| `fix/email-brand-redesign`                  | ARCHIVE                                | ancestor of main                                                  | none                              |
| `fix/p0-advisor-observability-latency-gate` | ARCHIVE                                | ancestor of main                                                  | none                              |
| `fix/platform-trust-stabilization`          | ARCHIVE                                | ancestor of main                                                  | none                              |
| `platform/discovery-intelligence`           | ARCHIVE                                | ancestor of main                                                  | none                              |
| `platform/discovery-mode-fix`               | ARCHIVE                                | ancestor of main                                                  | none                              |
| `platform/main-consolidation`               | ARCHIVE                                | cutover complete                                                  | none                              |
| `platform/narrative-question-excellence`    | DELETE_AFTER_CONFIRMATION (local-only) | merged; never pushed                                              | none                              |
| `platform/narrative-step-questions`         | DELETE_AFTER_CONFIRMATION (local-only) | merged; never pushed                                              | none                              |
| `fix/onboarding-finance-domains-sprint`     | ARCHIVE (after FF)                     | strict subset of #1                                               | none                              |
| `platform/elite-hardening-streaming`        | ARCHIVE                                | content in main (`68cad15`) — verify 11 docs + test present first | LOW                               |
| `platform/pilot-p0-blockers`                | ARCHIVE                                | content in main (`8753aff`)                                       | **do NOT merge** (3363 deletions) |

## Keep Temporarily (rollback / safety)

| Branch                               | Action | Reason                   | Risk                   |
| ------------------------------------ | ------ | ------------------------ | ---------------------- |
| `backup/old-main-before-mvp-cutover` | KEEP   | pre-cutover rollback ref | **never merge/deploy** |

## Delete Later (after pilot / after confirmation)

| Group                                          | Action                                                                                   | Reason                              |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------- |
| 13 Dependabot npm + 1 Dependabot actions       | IGNORE_AUTOMATION; merge security bumps via PR on own cadence, let stale ones auto-close | bot-managed                         |
| `flyio-new-files`                              | review once → DELETE_AFTER_CONFIRMATION                                                  | one-off Fly.io bot branch (Jun 2)   |
| `fix/dashboard-…` + `fix/onboarding-finance-…` | DELETE_AFTER_CONFIRMATION **after** FF + pilot                                           | redundant once main = their content |

## Recommended order of operations (no execution this sprint)

1. Commit working-tree 165–167 + `conflicts.py`/`resume.py`/tests + PDF fixes onto `fix/dashboard-…`.
2. Get a Supabase token → `db push --dry-run` to clear the 161–167 ordering question.
3. Fast-forward `main` → branch #1; re-point Vercel + Fly at `main`; redeploy.
4. Archive the 10 merged + 2 subset/stale branches; keep the backup; leave automation to Dependabot.
5. After pilot, delete the archived feature branches.
   </content>
