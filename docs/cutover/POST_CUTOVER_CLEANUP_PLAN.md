# Post-Cutover Cleanup Plan

**Date:** 2026-06-16 · **Planning only — execute nothing yet.** All deletions/changes below require a separate explicit go.

## 1. Legacy branch retirement

- `advisor/p0-upgrade-2.3.0` — keep as rollback reference until the cutover is confirmed stable (suggest ≥1 week of prod stability). Then delete local + remote.
- `platform/main-consolidation`, `platform/discovery-mode-fix`, `platform/elite-hardening-streaming`, `platform/pilot-p0-blockers` — fully merged/superseded by `main`; delete after the legacy branch is retired.

## 2. Stale branch review

- `backup/old-main-before-mvp-cutover` — keep (explicit backup).
- `docs/lios-architecture`, `fix/email-brand-redesign`, `fix/p0-advisor-observability-latency-gate`, `fix/platform-trust-stabilization` — review: confirm their content is in `main`; if so, delete; if not, open a tracked task before deleting.

## 3. Dependabot review (16 remote branches)

- Batch-review `origin/dependabot/*` against the consolidated `main`. Merge security-relevant bumps; close the rest. **Lower priority** — do not interleave with the cutover.

## 4. Deployment simplification

- Add CI to **deploy core-api from `main` automatically** (currently manual `flyctl deploy`) — removes the off-`main` deploy risk that caused the original divergence.
- Optionally add a git-SHA label to the Fly image build (the current image carries no git label, making "what's live" hard to pin — see snapshot UNKNOWNs).
- Confirm Vercel production branch = `main` and preview-on-PR is enabled.

## 5. Branch governance

- Protect `main` (require green CI; no direct pushes once CI exists).
- Short-lived feature branches off current `main`; delete after merge.
- One source of truth: never deploy prod from a non-`main` branch again.

## 6. Code cleanup (post-cutover, separate sprint)

- Remove the now-dead scripted-conversation engine + roadmap placeholder components (routes already redirect).
- Address the 15 pre-existing tsc errors (finance/investments, lifeGraph/\*, MotionSection) — unrelated to cutover.
