# UNMERGED_WORK_AUDIT.md — Phase 4

Five branches are not ancestors of `main`. Only **one** carries genuinely unported product work; the others are a subset, two squash-landed copies, and the rollback backup.

---

## 1. `fix/dashboard-advisor-mode-and-floating-chat` ⭐ THE ONE THAT MATTERS

- **Ahead/behind main:** +9 / -0 (clean superset). **Currently checked out.** Deployed to `lifenavigator-core-api` (Jun 20).
- **Diffstat vs main:** 103 files, +9002 / -751.
- **Footprint:** 81 `apps/web/src` files, **12 core-api router/service files**, **4 migrations (161–164)**, 5 backend test files.
- **Commits not in main:** `c50ccff` Chat Command Center · `4b462eb` advisor-mode for dashboard/floating chat · `34a4d25` Career+Education in advisor PDF (Phase 9) · `d0f822e` career/edu fact packet + citation gate (Phase 8) · `da0d536` grounded Life Brief (Phase 6) · `23d6afb` readiness scoring (Phase 7) · `81b764a` C&E snapshots (Phase 5) · `fdd4595` history CRUD · `5ccad8f` onboarding/finance fixes.

| Question                       | Answer                                                                                                                                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What is in it?                 | Advisor Chat Command Center (projects/threads/citations), Career+Education intelligence + readiness scoring, advisor-vs-onboarding mode fix, Life Brief, fact packet with provenance + citation gate. |
| Why not merged?                | Active sprint branch; main cutover was paused mid-advisor-stack. It was deployed to prod **directly from the branch** instead of merging to main first.                                               |
| Still needed?                  | **Yes — it IS the current product** and the running core-api.                                                                                                                                         |
| Merge / cherry-pick / abandon? | **MERGE to main** (fast-forward possible: 0 behind).                                                                                                                                                  |
| Conflicts with main?           | None — strict superset, FF-clean.                                                                                                                                                                     |
| Safe for production?           | Already in production. Carries migrations 161–164 (see MIGRATION_BRANCH_AUDIT) + the **uncommitted** 165–167 and PDF fixes not yet on any branch.                                                     |

---

## 2. `fix/onboarding-finance-domains-sprint`

- **Ahead/behind:** +7 / -0. **All 7 commits are a strict subset** of branch #1 (`git log dashboard..onboarding` → empty).
- **What/why/needed:** Phases 5–9 onboarding+finance work; not merged because it was folded into branch #1, which added 2 more commits on top.
- **Action:** **ARCHIVE** after #1 lands. Nothing unique to port. No conflict. Safe (already in prod via #1).

---

## 3. `platform/elite-hardening-streaming`

- **Ahead/behind:** +1 / -37. Unique commit `f98a21f`: Arcana approved-response streaming (`StreamingText.tsx`, `arcana/streaming.ts` + test) + 11 `docs/elite-hardening/*` reports (16 files, +1620).
- **Why not merged (by SHA):** Re-landed in main via squash as `68cad15` (identical subject).
- **Needed / action:** Content present in main → **ARCHIVE**. ⚠️ Before deleting, confirm the 11 elite-hardening docs and the streaming test all exist in main; if any doc is missing, **CHERRY_PICK** just that file. No migrations. Not dangerous.

---

## 4. `platform/pilot-p0-blockers`

- **Ahead/behind:** +1 / -103 (very stale). Unique commit `a1b25da`: 7 P0 pilot fixes — **mass deletions** of over-promised healthcare/education stub pages (`-3363` lines), CTA/disclaimer/fake-chat fixes, `AdviceDisclaimer.tsx`.
- **Why not merged (by SHA):** Re-landed in main via squash as `8753aff` (identical subject).
- **Needed / action:** Content present in main → **ARCHIVE**. ⚠️ **Dangerous if ever merged directly** — its 3363 deletions are against a 103-commits-old tree and would clobber newer work. Never merge; verify-then-archive. No migrations.

---

## 5. `backup/old-main-before-mvp-cutover`

- **Ahead/behind:** +18 / -409. Pre-cutover main snapshot (Mar 20): Plaid compliance, GraphRAG pipeline fixes, Vercel/Qdrant config.
- **Why not merged:** Intentional rollback ref, not feature work. 409 behind.
- **Needed / action:** **KEEP** as rollback safety. ⚠️ **Never merge or deploy** — merging would revert the entire MVP cutover. Highest-risk branch if touched.

---

## Cross-cutting

- **Overlap with production areas:** Only #1 touches current prod code (core-api services/routers, web app). #3/#4 touch web but their content is already in main. #5 touches legacy pre-cutover tree.
- **Migrations included:** Only #1 carries migrations not on main (161–164). #2 carries 161–163 (subset of #1). #3/#4/#5 add none beyond main.
- **Docs/tests:** #1 has backend tests (`test_pdf_renderer`, `test_report_engine`, `test_advisor_*`). #3 has a streaming test + docs. #4 is deletions + one disclaimer component.
- **Uncommitted, on NO branch:** migrations `165_document_field_provenance`, `166_field_conflicts`, `167_resume_imports`, new services `conflicts.py`/`resume.py`, their tests, and the PDF-renderer fixes — all in the working tree only. These must be committed onto #1 (or main) before they can be ported or deployed.
  </content>
