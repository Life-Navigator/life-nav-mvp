# BRANCH_GOVERNANCE_EXECUTIVE_SUMMARY.md — Phase 8

**Audit date:** 2026-06-21 · **Repo:** Life-Navigator/life-nav-mvp · **Scope:** audit only (no merges, deletes, deploys, or migrations).

## The 10 questions

**1. How many local branches?** 16 (including `main`).

**2. How many remote branches?** 28 (excluding `origin/HEAD`).

**3. How many are real work?** 15 real-work feature branches + `main`.

**4. How many are automation noise?** 15 (14 Dependabot + 1 Fly.io `flyio-new-files`).

**5. How many contain unmerged work?** 5 are not ancestors of main, but only **1** carries genuinely unported product work: `fix/dashboard-advisor-mode-and-floating-chat` (+9/-0). Of the rest: 1 is a strict subset of it (`fix/onboarding-finance-domains-sprint`), 2 are squash-landed in main already (`elite-hardening-streaming` → `68cad15`, `pilot-p0-blockers` → `8753aff`), 1 is the rollback backup.

**6. Which branches matter before Monday pilot?** Exactly one: **`fix/dashboard-advisor-mode-and-floating-chat`** — it is the live production core-api and the home of the unported migrations 161–164 (plus the uncommitted 165–167 + PDF fixes). Everything pilot-facing flows through getting this onto `main`.

**7. Which branches should never be deployed from?** `backup/old-main-before-mvp-cutover` (-409, reverts the cutover) and `platform/pilot-p0-blockers` (-103, 3363 deletions). Also: never fire a `main` deploy until main is fast-forwarded, or prod will regress.

**8. Which branches need cherry-picking?** None strictly. Optional safety check: confirm the 11 `docs/elite-hardening/*` files + the streaming test from `elite-hardening-streaming` are all present in main; cherry-pick any individual missing doc. Everything else is whole-branch FF or already-merged.

**9. Is branch sprawl currently a pilot risk?** **Sprawl itself: LOW** — 12 of 15 real branches are spent, single author, clearly named. **But the source-of-truth split is a real risk:** production runs a feature branch, not main.

**10. What exact cleanup should happen next?**

1. Commit working-tree 165–167 + `conflicts.py`/`resume.py`/tests + PDF fixes onto branch #1.
2. Supabase token → `db push --dry-run` to clear the 161–167 ordering question.
3. Fast-forward `main` → `c50ccff`; re-point Vercel + Fly at `main`; redeploy.
4. Archive 10 merged + 2 subset/stale branches; keep the backup; leave Dependabot alone.

## Headline risk

**Split-brain source of truth.** `main` (`0b82ac9`, Jun 18) is **behind production**. Core-api was deployed Jun 20 from `fix/dashboard-advisor-mode-and-floating-chat` (`c50ccff`), carrying 9 commits + migrations 161–164 that never landed on main. Any `main`-triggered deploy would regress production and drop the live advisor stack. Plus migrations 165–167 + the PDF fixes exist **only in the working tree** — on no branch at all.

---

# FINAL STATUS: **BRANCH_GOVERNANCE_RISK**

Not because of branch sprawl (that is manageable), but because **`main` is not the deployed source of truth** and unported migrations/working-tree changes sit between branch and production. Clears to **BRANCH_GOVERNANCE_CLEAR** once: (a) working-tree 165–167 + PDF work is committed, (b) `main` is fast-forwarded to the advisor branch, and (c) all deploys are re-pointed at `main`.
</content>
