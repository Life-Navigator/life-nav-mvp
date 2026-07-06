# BRANCH_INVENTORY.md — Phase 1

**Audit date:** 2026-06-21
**Repo:** github.com/Life-Navigator/life-nav-mvp (single monorepo)
**Main tip:** `0b82ac9` (2026-06-18) — `feat(documents): bridge extracted document facts into life model + Family domain`
**Currently checked out:** `fix/dashboard-advisor-mode-and-floating-chat` (`c50ccff`)
**Method:** `git fetch --all --prune` + `git branch -vv` + `git for-each-ref`. Read-only. No code/branch changes.

## Counts

| Scope                                     | Count             |
| ----------------------------------------- | ----------------- |
| Local branches                            | 16 (incl. `main`) |
| Remote branches (excl. `origin/HEAD`)     | 28                |
| Local-only (no remote tracking)           | 2                 |
| Real-work feature branches (excl. `main`) | 15                |
| Automation noise (dependabot + flyio)     | 15                |

## Real-work branches (human product/code/doc)

| Branch                                         | Loc/Rem        | SHA       | Last commit | Author   | Ahead/Behind main | Checked out | Stale?                   |
| ---------------------------------------------- | -------------- | --------- | ----------- | -------- | ----------------- | ----------- | ------------------------ |
| `main`                                         | both           | `0b82ac9` | 2026-06-18  | T. Riffe | —                 | no          | no                       |
| `fix/dashboard-advisor-mode-and-floating-chat` | both           | `c50ccff` | 2026-06-20  | T. Riffe | **+9 / -0**       | **YES**     | no (ACTIVE)              |
| `fix/onboarding-finance-domains-sprint`        | both           | `34a4d25` | 2026-06-19  | T. Riffe | +7 / -0           | no          | no (subset of ↑)         |
| `advisor/p0-upgrade-2.3.0`                     | both           | `cbd6954` | 2026-06-16  | T. Riffe | 0 / -34           | no          | yes (merged)             |
| `platform/discovery-mode-fix`                  | both           | `1e32954` | 2026-06-16  | T. Riffe | 0 / -35           | no          | yes (merged)             |
| `platform/discovery-intelligence`              | both           | `bcff4f8` | 2026-06-16  | T. Riffe | 0 / -25           | no          | yes (merged)             |
| `platform/main-consolidation`                  | both           | `cb6b172` | 2026-06-16  | T. Riffe | 0 / -31           | no          | yes (merged)             |
| `platform/narrative-question-excellence`       | **local-only** | `c8f01c5` | 2026-06-16  | T. Riffe | 0 / -23           | no          | yes (merged)             |
| `platform/narrative-step-questions`            | **local-only** | `fdcce6c` | 2026-06-16  | T. Riffe | 0 / -21           | no          | yes (merged)             |
| `platform/elite-hardening-streaming`           | both           | `f98a21f` | 2026-06-16  | T. Riffe | +1 / -37          | no          | yes (content in main)    |
| `platform/pilot-p0-blockers`                   | both           | `a1b25da` | 2026-06-16  | T. Riffe | +1 / -103         | no          | yes (content in main)    |
| `docs/lios-architecture`                       | both           | `330bbda` | 2026-06-15  | T. Riffe | 0 / -56           | no          | yes (merged)             |
| `fix/email-brand-redesign`                     | both           | `7039190` | 2026-06-15  | T. Riffe | 0 / -65           | no          | yes (merged)             |
| `fix/p0-advisor-observability-latency-gate`    | both           | `51a9113` | 2026-06-15  | T. Riffe | 0 / -66           | no          | yes (merged)             |
| `fix/platform-trust-stabilization`             | both           | `e0ebce4` | 2026-06-13  | T. Riffe | 0 / -68           | no          | yes (merged)             |
| `backup/old-main-before-mvp-cutover`           | both           | `37e7c6a` | 2026-03-20  | T. Riffe | +18 / -409        | no          | yes (intentional backup) |

## Automation noise (15)

**Dependabot (14):**
`github_actions/actions/download-artifact-8` (Mar 16); `npm_and_yarn/apps/web/minor-and-patch-7662b4bb48` (Jun 17); `.../apps/web/next-ecosystem-c072fdd81a` (Jun 15); `.../apps/web/react-ecosystem-9495476288` (Jun 15); `.../apps/web/supabase-4d90a4729d` (Jun 15); `.../apps/web/testing-4ba4b1bcd5` (Jun 17); `eslint-10.0.3` (Mar 14); `expo-55.0.6` (Mar 14); `expo-calendar-55.0.9` (Mar 14); `lucide-react-0.577.0` (Mar 14); `plaid-41.4.0` (Mar 14); `react-native-permissions-5.5.1` (Mar 14); `testing-library/react-16.3.2` (Mar 14); `uuid-13.0.0` (Mar 14). All remote-only.

**Fly.io (1):** `flyio-new-files` (`4825c29`, 2026-06-02, author "Fly.io") — remote-only, bot-generated.

## Notes

- Branch dates cluster around the 2026-06-13→20 advisor/doc-intelligence sprints. The Mar-14/16 dependabot branches and `backup/old-main-before-mvp-cutover` (Mar 20) predate the MVP cutover.
- Two local-only branches (`narrative-*`) were never pushed; both are already ancestors of `main`.
  </content>
