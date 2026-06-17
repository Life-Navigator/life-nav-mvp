# Pre-Cutover Snapshot

**Date:** 2026-06-16 · Recorded before making `main` the source of truth. Read-only capture.

## Production state at snapshot

| Component                                    | State                                                                                                                                                                                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **core-api (Fly)**                           | app `lifenavigator-core-api`, **release v115** (deployed ~47m before snapshot, by techavenger83), image `deployment-01KV9BRARX396W7ZNRWHAN3T5G`, digest `sha256:0461175475ac9eb523a9139d7b30277d281cf79888f6793406cfce70c0727e9e`     |
| **core-api deploy source**                   | branch `advisor/p0-upgrade-2.3.0` @ `cbd6954` (manual `fly deploy`)                                                                                                                                                                   |
| **web (Vercel)**                             | project `life-nav-mvp-web` (`prj_Ecx1NQfhwva1Y2DxYzD4GXhCIrLu`, team `team_uflrwiS0oWnbSXttHk2ou0MO`), production branch = `main` @ `4a46e8f` (**stale** — pre-streaming, pre-P0; onboarding fix is backend so it is live regardless) |
| **prior core-api release (rollback target)** | **v114** (~5h39m before snapshot)                                                                                                                                                                                                     |

## Git SHAs

| Ref                                                      | SHA       |
| -------------------------------------------------------- | --------- |
| `origin/main` (stale)                                    | `4a46e8f` |
| `origin/advisor/p0-upgrade-2.3.0` (prod core-api source) | `cbd6954` |
| `origin/platform/main-consolidation` (cutover candidate) | `cb6b172` |

## Tooling reality

- `flyctl`: authenticated (techavenger83@gmail.com) — can deploy/rollback core-api.
- `vercel` CLI: **NOT authenticated** — cannot create a hosted preview or deploy directly. Web deploys occur via the **GitHub→Vercel integration** on push to `main`. Project is linked locally (`.vercel/project.json`).
- `next build` ignores TS errors only under `CI` (`next.config:127 ignoreBuildErrors: !!process.env.CI`) — local build is run with `CI=true` to match Vercel.

## Rollback instructions

**Web (fastest):** Vercel dashboard → `life-nav-mvp-web` → Deployments → promote the previous production deployment (instant). OR `git revert <merge-commit>` on `main` + push (Vercel rebuilds the reverted main). **Safety property:** Vercel does **not** promote a failed build, so a broken build leaves the current production deployment serving.

**core-api (Fly):** `flyctl releases -a lifenavigator-core-api` → roll back to **v115** (current good, = `cbd6954`) via `flyctl deploy` from `advisor/p0-upgrade-2.3.0`, or `flyctl releases rollback` to a prior version. Because consolidated `main` core-api == the v115 code, the Fly cutover is behavior-neutral and reverting the deploy source has no functional effect.

**Branch:** `advisor/p0-upgrade-2.3.0` (`cbd6954`) is retained as the legacy/rollback branch until the cutover is confirmed stable.
