# SOURCE_OF_TRUTH_VERIFICATION.md — Phase 6

## Facts collected (read-only)

| Surface                                | State                                                                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `main` tip                             | `0b82ac9` (2026-06-18)                                                                                                 |
| Checked-out branch                     | `fix/dashboard-advisor-mode-and-floating-chat` (`c50ccff`, +9 / -0 vs main)                                            |
| `lifenavigator-core-api` (Fly)         | deployed 2026-06-20 22:00, healthy (`/healthz` → 200). No `/version` endpoint → exact SHA not self-reported.           |
| `lifenavigator-api-gateway` (Fly)      | deployed 2026-06-07, healthy (200)                                                                                     |
| `lifenavigator-ingestion-worker` (Fly) | running (non-HTTP worker), last deploy 2026-06-08                                                                      |
| Web (`lifenavigator.tech`)             | live, 200. Vercel project `life-nav-mvp-web` (`prj_Ecx1…`).                                                            |
| Vercel production branch               | **CONFIRMED = `main`** (Vercel API, 2026-06-21). Repo Life-Navigator/life-nav-mvp, root `apps/web`, Next.js, Node 20.x |
| Prod web → Supabase                    | **CONFIRMED `diwkyyahglnqmyledsey`** (`NEXT_PUBLIC_SUPABASE_URL`, production target)                                   |
| Prod web → API                         | `https://lifenavigator-api-gateway.fly.dev` (web calls **api-gateway**, not core-api)                                  |
| Prod DB migration history              | **DRIFTED** — see MIGRATION_BRANCH_AUDIT (objects exist that history says are unapplied; 165–167 genuinely missing)    |

## Answers

### 1. Is `main` still the production source of truth?

**No — not for `core-api`.** Main is `0b82ac9` (Jun 18). Core-api was deployed Jun 20, **after** main's tip, and the only Jun-20 code is on `fix/dashboard-advisor-mode-and-floating-chat` (`c50ccff`), which was the checked-out branch at deploy time. The running core-api therefore includes **9 commits and 4 migrations (161–164) that are not on main**. Production is ahead of its own source of truth.

### 2. Are any services deploying from old branches?

- **core-api:** deployed from a **feature branch**, not main (the risk above). Not an _old_ branch — a _newer_ one — but it bypasses main.
- **web:** likely tracks `main`/`mvp` (per prior Vercel audit); unconfirmed here. If web tracks `main` while core-api runs the branch, the two tiers are **out of sync** — web at `0b82ac9`, API at `c50ccff`.
- **No service deploys from a stale/old branch** (no deploy off `backup/old-main-…`, `pilot-p0-blockers`, etc.).

### 3. Are any old branches still production-critical?

**No.** Every merged/stale branch's content is in `main`. The only production-critical ref is the feature branch `fix/dashboard-…`, and only because prod was deployed from it. `backup/old-main-before-mvp-cutover` is rollback-only, not in any deploy path.

### 4. Any branch that could accidentally overwrite production behavior?

**Yes — three hazards:**

- **`platform/pilot-p0-blockers`** — a direct merge would apply 3363 deletions against a 103-commits-old tree, clobbering current healthcare/education/advisor code. Never merge.
- **`backup/old-main-before-mvp-cutover`** — merging reverts the entire MVP cutover (409 behind). Never merge/deploy.
- **A push of `main` that does NOT include `fix/dashboard-…`** — if Vercel/Fly are pointed at `main` and a deploy fires, production would **regress** to `0b82ac9`, dropping the live advisor stack and migrations 161–164. This is the most likely accidental-overwrite path.

## Verdict

`main` is the _intended_ source of truth but is **currently behind production**. The fix is to **fast-forward `main` to `c50ccff`** (branch #1 is 0 behind, so FF is clean), commit the working-tree 165–167 + PDF work, then re-point all deploys at `main`. Until then, the repo is in a **split-brain** state: prod core-api = branch, main = older.
</content>
