# Report Excellence — Final Audit (Monday Pilot)

**Date:** 2026-06-18 · Web report viewer (the artifact pilot users see first). Honest scoring.

## Lead order — web viewer is correct

`reports/[type]/page.tsx` renders: Executive Summary → **Current Narrative** (Life Brief body + tension + stakes + next_move) → **Why Arcana believes this** (`narrative_explanation`) → Goals → Risks → Opportunities → Constraints → Recommendations → Decision Tradeoffs → Action Plan → Sources. This week's `life_brief`/`dominant_narrative`/`narrative_explanation` wiring is in (`report_engine.py:277-279`; viewer reads them). Constraints normalized to labels (no raw JSON); honest empty states throughout; no fabrication.

## Per-audience score (web viewer)

| Audience | Score     | Note                                                                                         |
| -------- | --------- | -------------------------------------------------------------------------------------------- |
| Spouse   | 8.0       | leads with the plain-language narrative                                                      |
| CFP      | 7.0 → 7.5 | impact-key fix (below) now surfaces retirement-success %; tool-calculations still unrendered |
| CPA      | 6.0 → 6.5 | wants the auditable `tool_calculations` (built but not rendered in viewer — P1)              |
| Attorney | 6.5       | constraints/risks clear; fine                                                                |
| VC       | 6.5       | narrative + goals convey the situation well                                                  |

**Web aggregate ≈ 7.0/10** after this sprint's fixes (target >9 is aspirational — see gaps).

## Fixed this sprint

- **Impact-key mismatch (`report_engine.py:228`)** — the report looked for `readiness_before/after`, which the engine never writes; it writes `retirement_success_before_pct`/`protection_adequacy_before_pct`. Fixed to read the real keys → the strongest computed outcome (e.g. "retirement success 61% → 78%") now shows in report recommendations.

## Honest gaps keeping it under 9 (not fixed — would need new work)

1. **PDF lead order** — `pdf_renderer._full_html` doesn't read `life_brief`/`dominant_narrative`; the emailed PDF leads with a readiness score, not the story. **P1** (the PDF is secondary to the in-app viewer for the pilot; flagged for the week-1 backlog).
2. **`tool_calculations`** — built (`report_engine.py:119-138`) but the viewer renders only `advisor_executive`/`life_model`/`executive_summary`. Surfacing it is the biggest CPA/CFP credibility lift. **P1.**
3. **Sparse-data new users** — a report before any document upload is mostly honest empty states. Pilot onboarding should sequence ≥1 substantive input before report generation. Not a defect (no fabrication), a sequencing note.
4. Rubric items "time horizon / cost-of-inaction" don't exist as fields anywhere → cannot be shown without new intelligence (out of scope).

## Verdict

The in-app report **leads with the narrative and is trustworthy** (no jargon/JSON/fabrication) — good enough for the pilot at ~7/10. The PDF-narrative-lead and tool-calculations surfacing are the two P1 lifts toward 9, scheduled for week 1. Not a launch blocker.
