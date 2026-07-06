# BRANCH_MERGE_STATUS.md — Phase 2

**Method:** `git merge-base --is-ancestor <branch> main`, `git log --oneline main..<branch>`, `git diff --stat main...<branch>`. Read-only.

## Classification key

- **MERGED** — branch is an ancestor of `main` (fully contained).
- **SUPERSET_OF_MAIN** — 0 behind, ≥1 ahead; contains main + real unported work.
- **UNMERGED_ACTIVE** — ahead of main, recent, work in progress.
- **UNMERGED_STALE** — ahead by SHA but old; content may already be in main via squash.
- **BEHIND_MAIN** — only behind, nothing unique.
- **UNKNOWN** — indeterminate.

## Results

| Branch                                         | `--is-ancestor` | Ahead/Behind | Classification                          | Note                                                      |
| ---------------------------------------------- | --------------- | ------------ | --------------------------------------- | --------------------------------------------------------- |
| `fix/dashboard-advisor-mode-and-floating-chat` | NO              | +9 / -0      | **SUPERSET_OF_MAIN / UNMERGED_ACTIVE**  | The live production branch; not yet ported to main        |
| `fix/onboarding-finance-domains-sprint`        | NO              | +7 / -0      | **SUPERSET_OF_MAIN**                    | All 7 commits are a strict subset of the dashboard branch |
| `platform/elite-hardening-streaming`           | NO              | +1 / -37     | **UNMERGED_STALE**                      | Content squash-landed in main as `68cad15`                |
| `platform/pilot-p0-blockers`                   | NO              | +1 / -103    | **UNMERGED_STALE**                      | Content squash-landed in main as `8753aff`                |
| `backup/old-main-before-mvp-cutover`           | NO              | +18 / -409   | **UNMERGED_STALE (intentional backup)** | Pre-cutover rollback ref; never to be merged              |
| `advisor/p0-upgrade-2.3.0`                     | YES             | 0 / -34      | **MERGED**                              |                                                           |
| `docs/lios-architecture`                       | YES             | 0 / -56      | **MERGED**                              |                                                           |
| `fix/email-brand-redesign`                     | YES             | 0 / -65      | **MERGED**                              |                                                           |
| `fix/p0-advisor-observability-latency-gate`    | YES             | 0 / -66      | **MERGED**                              |                                                           |
| `fix/platform-trust-stabilization`             | YES             | 0 / -68      | **MERGED**                              |                                                           |
| `platform/discovery-intelligence`              | YES             | 0 / -25      | **MERGED**                              |                                                           |
| `platform/discovery-mode-fix`                  | YES             | 0 / -35      | **MERGED**                              |                                                           |
| `platform/main-consolidation`                  | YES             | 0 / -31      | **MERGED**                              |                                                           |
| `platform/narrative-question-excellence`       | YES             | 0 / -23      | **MERGED** (local-only)                 |                                                           |
| `platform/narrative-step-questions`            | YES             | 0 / -21      | **MERGED** (local-only)                 |                                                           |

## Summary

- **MERGED:** 10 branches — fully contained in main, safe to close.
- **SUPERSET_OF_MAIN (real unported work):** 2 — `fix/dashboard-…` and its subset `fix/onboarding-finance-…`.
- **UNMERGED_STALE, content already in main:** 2 — `platform/elite-hardening-streaming`, `platform/pilot-p0-blockers` (verify diff, then archive).
- **Intentional backup:** 1 — `backup/old-main-before-mvp-cutover`.

## Critical nuance — squash merges

`git merge-base --is-ancestor` reports `NO` for `elite-hardening-streaming` and `pilot-p0-blockers`, but `main` history contains commits with **identical subjects** (`68cad15 feat: add elite hardening audit and Arcana approved-response streaming`; `8753aff fix(pilot): resolve 7 P0 pilot blockers …`). The work was re-landed via squash/cherry-pick, so the branch pointers are stale, not the work. Two-dot diffs are dominated by how far behind (-37 / -103) the branches are, not by genuine unported content. Treat both as **content-merged**.
</content>
