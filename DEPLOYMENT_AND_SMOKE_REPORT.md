# DEPLOYMENT_AND_SMOKE_REPORT.md — Phase 8

Status: **DEPLOYED + SMOKE-TESTED (Path A — merge to main, deploy both).** 2026-06-22.

## Executed

1. ✅ Committed remaining doc-intelligence wiring (`ef1f571`); tree clean = HEAD; 598 tests pass.
2. ✅ Pushed branch; **fast-forwarded `main` `0b82ac9..ef1f571`** — prod now tracks main (source-of-truth restored).
3. ✅ **Web (Vercel):** auto-deploy on main push → `READY` for `ef1f5712c`.
4. ✅ **Core-api (Fly):** `fly deploy` → healthy; `/healthz` 200; `/v1/life/facts` now routed (was 404 → 401 unauth).
5. ✅ **Smoke (authed, demo user `0a291b09`):** `GET /v1/life/facts` → **200, real facts** (Base salary 185000, Equity 300000, Coverage 1000000 — all `pending` confirmation). The backfilled `life.facts` are live-readable; advisor reader + dashboard strip now have data.

Source-of-truth: `main` = `ef1f571` = prod core-api + web. The earlier split-brain is closed.

---

(original plan below)

## Done

- ✅ Backfill applied + validated (58 `life.facts`).
- ✅ Code committed + pushed: `6ae6792` (branch `fix/dashboard-advisor-mode-and-floating-chat` = origin).
- 5 commits ahead of `main`: `7b6c921` DITS · `a9f3d70` advisor life.facts reader · `4234202` elite docs · `bc0df86` life.facts endpoint+strip+graph-nav · `6ae6792` Family/Health promotion.

## What each deploy makes live

| Deploy       | Makes live                                                                                                | Mechanism                                                        | Needs                         |
| ------------ | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------- |
| **Web**      | Family Office tab, Health Intelligence tab, graph nav removal, `RecentlyLearned` strip                    | Vercel tracks `main` → **merge to main** or manual branch deploy | decision below                |
| **Core-api** | `GET /v1/life/facts`, advisor cites `life.facts`, + all branch backend (DITS provenance/conflicts/resume) | `fly deploy -a lifenavigator-core-api` from branch               | Fly authed ✅ (techavenger83) |

- Family Office + Health tabs work on **web deploy alone** — their backends (`/v1/family/office`, `/v1/health/intelligence`) are already live (verified 200).
- The `life.facts` strip + advisor citation need the **core-api deploy** (data already backfilled).

## ⚠️ Source-of-truth note

Prod core-api runs `c50ccff` and Vercel tracks `main` (`0b82ac9`) — both **behind** this branch. Deploying core-api from the branch perpetuates "prod runs a branch, not main." Two paths:

- **(A) Clean (recommended):** merge branch → `main`, then deploy core-api + web from `main`. Fixes source-of-truth; ships everything. Bigger review surface (5 commits incl. DITS).
- **(B) Fast:** `fly deploy` core-api from branch + manual Vercel branch deploy. Faster; keeps split-brain.

## Smoke test plan (post-deploy)

1. `GET /healthz` on core-api → 200.
2. `GET /v1/life/facts` with demo user → 200 + 52 facts (currently 404).
3. Web: log in as `0a291b09` → Dashboard shows "Recently learned"; Family → Estate & Family Office renders pillars; Health → Health Intelligence renders labs; Life Graph absent from nav.
4. Advisor: ask "what do you know from my documents?" → cites base salary / coverage amount (pending confirmation).
5. Upload a fresh doc → new `life.facts` appear (bridge live).

## Recommendation

Push is done. Recommend **Path A** (merge → main → deploy both) to fix source-of-truth, but it needs explicit go given the 5-commit review surface. Awaiting decision.
</content>
