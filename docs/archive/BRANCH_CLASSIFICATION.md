# BRANCH_CLASSIFICATION.md — Phase 3

**Owner of all human branches:** Timothy Riffe (solo author across every real-work branch).

## Real Work Branches

| Branch                                         | Purpose                                                                                                                | Relevance now                                      | Pilot-relevant?    | Action                                |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------ | ------------------------------------- |
| `fix/dashboard-advisor-mode-and-floating-chat` | Advisor Chat Command Center + Career/Education intelligence + advisor-mode fixes (Phases 5–9). Live-deployed core-api. | **HIGH — the production branch**                   | **YES (critical)** | **MERGE** (port to main)              |
| `fix/onboarding-finance-domains-sprint`        | Onboarding round-trip, finance domains, asset CRUD (Phases 5–9).                                                       | Superseded — strict subset of the dashboard branch | Indirect (via ↑)   | **ARCHIVE** (after dashboard→main)    |
| `platform/elite-hardening-streaming`           | Elite hardening audit + Arcana approved-response streaming.                                                            | Content already in main (`68cad15`)                | Already shipped    | **ARCHIVE** (verify diff first)       |
| `platform/pilot-p0-blockers`                   | 7 P0 pilot blockers (CTAs, fake chat, disclaimer, stubs).                                                              | Content already in main (`8753aff`)                | Already shipped    | **ARCHIVE** (verify diff first)       |
| `backup/old-main-before-mvp-cutover`           | Snapshot of pre-MVP-cutover main (Mar 20).                                                                             | Rollback safety only                               | No (never deploy)  | **KEEP** (rollback ref)               |
| `advisor/p0-upgrade-2.3.0`                     | Advisor P0 upgrade 2.3.0 (cross-turn ctx, framing).                                                                    | Merged                                             | Shipped            | **ARCHIVE**                           |
| `platform/discovery-mode-fix`                  | Discovery vs advisor mode separation.                                                                                  | Merged                                             | Shipped            | **ARCHIVE**                           |
| `platform/discovery-intelligence`              | Narrative-aware discovery questions.                                                                                   | Merged                                             | Shipped            | **ARCHIVE**                           |
| `platform/main-consolidation`                  | Branch-consolidation / main-cutover staging.                                                                           | Merged (cutover done)                              | Shipped            | **ARCHIVE**                           |
| `platform/narrative-question-excellence`       | Discovery question quality.                                                                                            | Merged (local-only)                                | Shipped            | **DELETE_AFTER_CONFIRMATION** (local) |
| `platform/narrative-step-questions`            | Narrative-aware step questions.                                                                                        | Merged (local-only)                                | Shipped            | **DELETE_AFTER_CONFIRMATION** (local) |
| `docs/lios-architecture`                       | LIOS design-doc corpus.                                                                                                | Merged                                             | No                 | **ARCHIVE**                           |
| `fix/email-brand-redesign`                     | Navy+teal transactional email system.                                                                                  | Merged                                             | Indirect           | **ARCHIVE**                           |
| `fix/p0-advisor-observability-latency-gate`    | Advisor streaming/observability/latency gate.                                                                          | Merged                                             | Shipped            | **ARCHIVE**                           |
| `fix/platform-trust-stabilization`             | Advisor eval & observability sprint.                                                                                   | Merged                                             | Shipped            | **ARCHIVE**                           |

## Automation Noise

| Group                       | Branches                                                                                                                                                                                   | Action                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Dependabot — npm/yarn       | 13 (eslint, expo, expo-calendar, lucide-react, plaid, react-native-permissions, testing-library/react, uuid, apps/web minor-and-patch, next-ecosystem, react-ecosystem, supabase, testing) | **IGNORE_AUTOMATION** (let Dependabot manage; merge security bumps via PR on own cadence) |
| Dependabot — github_actions | 1 (download-artifact-8)                                                                                                                                                                    | **IGNORE_AUTOMATION**                                                                     |
| Fly.io bot                  | `flyio-new-files`                                                                                                                                                                          | **IGNORE_AUTOMATION** (review once, then DELETE_AFTER_CONFIRMATION)                       |

## Action legend

KEEP · MERGE · CHERRY_PICK · ARCHIVE · DELETE_AFTER_CONFIRMATION · IGNORE_AUTOMATION

## Summary

- **1 branch must MERGE to main** before pilot: `fix/dashboard-advisor-mode-and-floating-chat`.
- **12 real-work branches are spent** (merged or content-in-main) → ARCHIVE / DELETE_AFTER_CONFIRMATION.
- **1 backup KEEP** (rollback).
- **15 automation branches** → IGNORE_AUTOMATION.
  </content>
