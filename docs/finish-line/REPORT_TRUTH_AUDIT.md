# Report Truth Audit

**Date:** 2026-06-16 · Scope: `apps/lifenavigator-core-api/app/services/report_engine.py` + `pdf_renderer.py`, traced to `life_discovery.snapshot()`, `recommendations_os.py`, `readiness.py`, domain `summary()`.

## Verdict: MOSTLY TRUSTWORTHY — fix D1 + D2 before pilot

No report element is fabricated, templated, or placeholder; body content is fully canonical and reproducible (`content_hash` neutralizes timestamps + list order, `report_engine.py:33-64`; `test_report_engine.py:91`); the no-evidence-no-rec gate is enforced upstream. The two defects below are _divergences from the dashboard's trust gates_, not invention.

## Element trace

| Element                                                    | Code                       | Canonical source                       | Verdict                                                                                                |
| ---------------------------------------------------------- | -------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Life Model (vision/objective/themes/constraints/tradeoffs) | `report_engine.py:140-160` | `snapshot()` + `objectives_plan()`     | ✅ Canonical; omitted if no objectives (`:147`); tradeoffs deterministic (`life_discovery.py:943-950`) |
| Exec — readiness                                           | `:200-205`                 | `readiness.assess()`                   | ✅ Recomputed from live domains; honest empty on failure                                               |
| Exec — objective/vision                                    | `:209-215,262-266`         | `snapshot()`                           | ✅                                                                                                     |
| Exec — recommendations + evidence + assumptions            | `:217-249`                 | `recommendations_os.roadmap()`         | ✅ Gated; evidence+source_table per rec                                                                |
| Exec — next best action / 90-day plan                      | `:243-247`                 | roadmap                                | ✅                                                                                                     |
| **Exec — risks/opportunities**                             | **`:271-272`**             | **`snap.top_risks/top_opportunities`** | ⚠️ **D1 — bypasses OS grounding gate**                                                                 |
| **Exec — goals**                                           | **`:251-258`**             | **`public.goals` direct**              | ⚠️ **D2 — no confirmed/candidate filter**                                                              |
| Exec — missing data / appendix counts                      | `:260-277`                 | derived from recs                      | ✅                                                                                                     |
| Prioritized Recs section                                   | `:179-194`                 | `prioritize(top=5)`                    | ✅ Gated                                                                                               |
| Tool Calculations                                          | `:119-138`                 | `tools.tool_runs`                      | ✅ Verbatim; omitted if none                                                                           |
| Domain reports overview                                    | `:307-358`                 | `svc.summary()` `vm.data`              | ✅ Canonical, raw-dumped (O1)                                                                          |
| Finance trend                                              | `:328-346`                 | `TrendAnalyzer.trends()`               | ✅ Omitted unless `has_history`; flat-not-fabricated                                                   |
| Education (9 sections)                                     | `:360-383`                 | `education_report.py`                  | ✅ Evidence appendix + citations; honest verdict (`:164-173`)                                          |
| Decision                                                   | `:385-408`                 | `decision.decisions`                   | ✅ Honest empty prompt                                                                                 |
| Compensation                                               | `:281-305`                 | `comp.analyze()`                       | ✅ Honest stub if unwired                                                                              |
| Charts / Citations                                         | throughout                 | cited series / evidence source_tables  | ✅ No invented points                                                                                  |
| PDF empty-states / money fmt                               | `pdf_renderer.py:183-321`  | present values only                    | ✅ Renders `—`, never invents                                                                          |

## Defects

- **D1 (HIGH):** report risks/opps are not routed through the OS + `GENERIC_RISK_OPP_LABELS` filter the dashboard uses (cf. `my_life.py:105-106`). Live risk is currently LOW (nothing writes `life.risks`/`life.opportunities` anymore — TRUST RULE at `life_discovery.py:829-834`), but the day a row appears, the report shows an ungrounded risk the dashboard would hide → two truths for one user. **Fix:** build risks/opps from the OS `recs` already assembled in `_advisor_executive_section` (`report_engine.py:217-242`) by `rec_type`.
- **D2 (MEDIUM):** persona-bridge goals shown as "tracked." `report_engine.py:251-258` SELECTs `public.goals` with no `confirmed`/`origin` filter; `public.goals` is written by both user discovery (`life_discovery.py:826`) and persona seeding (`life_bridge.py`). The dashboard candidate-protects (`snapshot()` separates `candidate_objectives`, `life_discovery.py:881-915`); the report doesn't. **Fix:** filter/label by `origin`/`confirmed`, or read goals from `snapshot()`.
- **D3 (LOW):** readiness recomputed at render (`:200-205`) — deterministic and traced; a PDF score can shift between generations as data changes. Cosmetic.

## Integrity gates verified present

No-evidence-no-rec (`recommendations_os.py:67-69`); no archetype risks/opps/deps persisted (`life_discovery.py:829-859`); rec-quality gates with `==0` thresholds (`:587-625`); reproducible hash; honest empties everywhere; confidence-basis honesty (`readiness.py:157-158`).

## Observations

- **O1:** domain `summary()` is the trust boundary for raw `vm.data` dumps (out of the two-file scope; worth a follow-up).
- **O2:** `pdf_renderer.py:394` verdict fallback never fires.
- **O3:** `/v1/platform/sample` hardcoded numbers are correctly labeled `is_sample:true` (`platform_router.py:104-126`).

## Status after this sprint

D2 (goal filter) and the narrative-lead gap are addressed in code this sprint (see EXECUTIVE_SUMMARY). D1 is low live-risk and is queued as the next backend fix; tracked here so it is never silently shipped.
