# Recommendation Excellence — Final Audit (Monday Pilot Go/No-Go)

**Scope:** every recommendation _surface_, scored against the question "does a single
recommendation answer all 10 advisor questions?" **Audit only — no code changed.**

The engine is strong. The gap is almost entirely **surfacing**: fields the engine
_computes and persists_ are dropped before the user sees them, and two fields
("what happens if ignored", per-rec "tradeoffs") **do not exist** anywhere and must be
called out honestly.

---

## The 10-question rubric (what an elite rec must answer)

| #   | Question                 | Engine field that answers it                                                           | Computed?                                     |
| --- | ------------------------ | -------------------------------------------------------------------------------------- | --------------------------------------------- |
| 1   | Why this?                | `description` / `narrative.why`                                                        | ✅                                            |
| 2   | Why now?                 | `urgency` factor + `time_sensitive`; roadmap `why_now`                                 | ✅ (only the lead)                            |
| 3   | Why #1?                  | `_why_first()` → `why_ranking.why_number_one` + `ranked_above`                         | ✅ (lead only; `ranked_above` never rendered) |
| 4   | Expected impact?         | `quantified_impact.*` (financial_impact_annual, success_delta_pts, coverage_gap, etc.) | ✅                                            |
| 5   | Time horizon?            | —                                                                                      | ❌ **does not exist as a field**              |
| 6   | Dependencies?            | `rec_type=DEPENDENCY` + roadmap `blocked_by`                                           | ⚠️ platform-level, not per-rec                |
| 7   | Tradeoffs?               | `_conflicts()` (resource-level only)                                                   | ⚠️ **no per-rec tradeoff field**              |
| 8   | Confidence?              | `confidence` + full `formula`                                                          | ✅                                            |
| 9   | Evidence?                | `evidence[]` (statement + source_table)                                                | ✅                                            |
| 10  | What happens if ignored? | —                                                                                      | ❌ **does not exist as a field**              |

**Honest baseline:** the engine genuinely answers **7 of 10** for a data-rich rec (1,2,3,4,8,9

- partial 6/7 at the platform level). **#5 time-horizon, #7 per-rec tradeoff, and #10
  cost-of-inaction are NOT fields anywhere** in `recommendations_os.py` (verified: `write()`
  signature lines 56-65 has no `time_horizon`, `tradeoff`, or `if_ignored` parameter; `_shape()`
  lines 488-502 emits nothing of the sort). No surface can render what the engine never produced.
  The ceiling for any surface today is therefore **~8.5/10** without new intelligence — getting
  _to_ that ceiling is pure surfacing work.

---

## Surface 1 — `/dashboard/recommendations` (the Roadmap)

**File:** `apps/web/src/app/dashboard/recommendations/page.tsx`
**Reads:** `roadmap()` (`recommendations_os.py:537-555`) → Now/Next/Later + `blocked_by` + `conflicts` + `why_now`.

**Score: 8.0 / 10** — the strongest surface by far; the reference implementation.

What it nails:

- **Why this** — `a.why` rendered on the card (line 326) and in the drawer (line 129-131).
- **Why now / Why #1** — `why_now` shown as the "Why this is #1" banner on the lead card (lines 298-305). This is `why_ranking.why_number_one`.
- **Expected impact** — `impactChips()` (lines 260-271) surfaces every `quantified_impact` datapoint up front; the drawer (lines 219-233) repeats it.
- **Confidence + evidence** — full visible formula (lines 210-216, 353-355), evidence list + source-table lineage (lines 136-168), assumptions (lines 189-201), confidence % everywhere.
- **Dependencies** — `blocked_by` rendered as "Unlock more by uploading" (lines 531-548).
- **Tradeoffs (resource-level)** — the conflicts banner shows competing recs + suggested sequence (lines 472-481).

Gaps keeping it under 9:

1. **`why_ranking.ranked_above` is computed but never rendered.** `_why_first()` (lines 514-521) produces `ranked_above: [{over, reason}]` — the explicit "#1 beat #2 because higher urgency (0.8 vs 0.5)" comparison. `roadmap()` only forwards `why_now` (the scalar), dropping `ranked_above` entirely (line 553). The single most credible "why #1" sentence is computed and thrown away.
2. **Time horizon (#5) not shown** — does not exist in the engine; the card has no "do this within X" line.
3. **Cost of inaction (#10) absent** — no field; for a RISK like the life-insurance gap, "if ignored, survivors are $X short" _is_ derivable from existing `quantified_impact.risk_reduction` but is framed as a benefit, never as a consequence.
4. **Per-rec tradeoff (#7)** — only the platform-level resource conflict exists; an individual card can't say "doing this delays your emergency fund."

Cheapest fixes (no new intelligence):

- **F1 (highest leverage):** in `roadmap()` return `why_ranking` (the whole object, already built by `_why_first()` on line 553's call site — it computes the full thing then discards `ranked_above`). Render `ranked_above` under the lead card's "Why this is #1" banner. ~5 lines engine + ~8 lines TSX.
- **F2:** re-frame the RISK rec's existing `quantified_impact.risk_reduction` as an "If you do nothing" line in `impactChips()` — pure string re-label of data already on the card.

---

## Surface 2 — Dashboard hero (`MissionControl` "Your next best move")

**File:** `apps/web/src/components/dashboard/MissionControl.tsx` (lines 190-205)
**Reads:** `GET /api/platform/dashboard` → `guidance.py:dashboard()` (lines 45-95), `next_best_action` (lines 71-78).

**Score: 4.5 / 10** — this is the most-seen recommendation surface and the weakest. It is the
biggest single Go/No-Go risk for "feels like elite counsel."

The problem is at the **data layer, not the component.** `guidance.py:76` constructs the NBA from
the OS top action but **only copies `title` and `why`**:

```python
next_action = {"title": ta["title"], "why": ta.get("why") or "", "cta_label": "Review", ...}
```

The OS `_shape()` already attached `quantified_impact`, `formula`, `confidence`, `current_state`,
`target_state`, `evidence`, `why_ranking` to `ta` — **all discarded here.** So the hero shows a
title + one sentence and a "Review" button. It answers **#1 only** (and weakly #6 via the gaps card).

- Why now? ❌ Why #1? ❌ Impact? ❌ (the `$X/yr` is computed and dropped) Confidence? ❌ Evidence? ❌ Horizon? ❌ Tradeoffs? ❌ If ignored? ❌

The irony: the _empty-state sample preview_ (lines 134-163) renders `financial_impact_annual` and
`retirement_success_before_pct → after_pct`, so a brand-new user with **fake** data sees a richer,
more quantified recommendation than a real user with their **own** data. That inverts trust.

Cheapest fixes (no new intelligence — all data already on `ta`):

- **F1:** in `guidance.py:76`, pass through `quantified_impact`, `confidence`, and `why_ranking.why_number_one` onto `next_action`. ~3 lines.
- **F2:** in `MissionControl` lines 196-198, add an impact chip (reuse the exact `impactChips` logic from the recommendations page) + a confidence line + a one-line "why this is #1". ~12 lines TSX.
- **F3:** point the CTA `href` at `/dashboard/recommendations` (the rich roadmap) instead of `/dashboard/readiness` (line 77) so the hero is a doorway to the full explanation rather than a dead end.

These three changes alone move this surface from 4.5 → ~8.

---

## Surface 3 — Report "Prioritized Next Steps" + Executive Briefing recs

**Files:** `report_engine.py:_os_recommendations_section` (lines 179-194) and `_advisor_executive_section` (lines 217-249); rendered by `reports/[type]/page.tsx` `RecCard` (lines 163-220) and `pdf_renderer.py` `_full_html` rec blocks (lines 231-248).

**Score: 7.5 / 10** (executive-briefing path) — strong, audience-appropriate, fully evidenced; the standalone "Prioritized Next Steps" section is thinner (~6/10) but redundant with the briefing.

What the briefing path nails (this is the recs surface CFP/attorney will read):

- Per-rec **why, confidence, expected_impact, evidence (statement + source), assumptions, impacted domains, unlocks** — all carried through (`report_engine.py:232-242`) and rendered both on web (`RecCard` 163-220) and PDF (`_full_html` 231-248).
- `next_best_action` is surfaced as a distinct callout (web 527-535, PDF 189-192).
- Honest empties everywhere ("Impact not yet quantified", line 180).

Gaps keeping it under 9:

1. **Why #1 / ranking rationale absent in the report.** The briefing lists recs in roadmap order but never states _why_ the top one ranks first — `why_ranking` is not read by `_advisor_executive_section` at all. A CFP reading the PDF can't see the prioritization logic that the web roadmap shows.
2. **`expected_impact` composition is lossy** (`report_engine.py:225-231`): it only builds bits from `financial_impact_annual` and a `readiness_before/after` pair that **the engine never sets** (the engine writes `retirement_success_before_pct`/`protection_adequacy_before_pct`, not `readiness_before`). So a 401(k) rec's headline "retirement success 60%→78%" is computed in `quantified_impact` but **does not appear** in the report's impact line — it falls through to `expected_benefit` only if that string happens to carry it. Verified mismatch: `recommendations_os.py:241` builds `estimated_benefit` with the % arrow, but `report_engine.py:228` looks for the wrong keys.
3. **Two recommendation sections coexist** — `_os_recommendations_section` ("Your Prioritized Next Steps", thin: title/why/action/priority/confidence/benefit only, no evidence) AND the briefing's richer block. The thin one is the lower-quality duplicate.
4. **Time horizon / cost-of-inaction** — absent (no field).

Cheapest fixes:

- **F1:** in `report_engine.py:228`, fix the key lookup to read the actual `quantified_impact` keys (`retirement_success_before_pct`/`_after_pct`, `protection_adequacy_before_pct`/`_after_pct`) so the report shows the same impact arrow the engine computed. ~4 lines. _This is a correctness bug, not just polish — the report is currently hiding its best number._
- **F2:** read `why_ranking` from `prioritize()` (already called nowhere in the briefing — call `roadmap()` already returns `why_now`; pass it into the recs section as a one-line "Why this leads"). ~6 lines.
- **F3:** drop or merge `_os_recommendations_section` into the briefing to kill the thin duplicate.

---

## Surface 4 — Life Brief `next_move`

**File:** `life_discovery.py:life_brief()` (lines 416-498); rendered in the report viewer "Current Narrative" (`reports/[type]/page.tsx` 365-386) and dashboard.

**Score: 7.0 / 10** — by design this is a _one-line_ surfacing of the top action, not a full rec card, so it's scored against a narrower bar.

- `next_move` (lines 474-477) surfaces the OS top action **verbatim** (`recommended_action` or `title`) — answers #1 and the "what do I do" intent in plain, human language. Good.
- It deliberately carries **no** impact/confidence/evidence — appropriate for a narrative paragraph, but means it answers only ~1.5 of 10 on its own.

Gap keeping it under 9: the `next_move` line is a dead-end string — it names the action but the reader can't see the dollar impact or jump to the full rec. Cheapest fix: append the single strongest `quantified_impact` bit to the sentence (e.g. "…— worth ~$3,200/yr") using `next_action.quantified_impact` which is already passed in (line 416 signature). ~3 lines. This is a _narrative_ surface so keep it to one number, not a card.

---

## Computed-but-not-rendered fields (the surfacing debt, consolidated)

| Field                                                              | Computed at                     | Rendered?                                        | Where it should appear             |
| ------------------------------------------------------------------ | ------------------------------- | ------------------------------------------------ | ---------------------------------- |
| `why_ranking.ranked_above` ("#1 beat #2 because…")                 | `recommendations_os.py:514-521` | **Nowhere**                                      | roadmap lead card, report briefing |
| `quantified_impact` (all keys) on hero NBA                         | dropped at `guidance.py:76`     | **No**                                           | MissionControl hero                |
| `confidence` / `formula` on hero NBA                               | dropped at `guidance.py:76`     | **No**                                           | MissionControl hero                |
| `retirement_success_*_pct` / `protection_adequacy_*_pct` in report | `recommendations_os.py:241,287` | **No** (wrong key lookup `report_engine.py:228`) | report impact line                 |
| `assumptions` on hero / Life Brief                                 | persisted                       | partial                                          | hero (one-liner)                   |
| `merged_from` (collapsed findings)                                 | `recommendations_os.py:468`     | only roadmap                                     | report                             |

---

## Fields that DO NOT exist (be honest — these are real gaps, not surfacing)

- **Time horizon (#5)** — no `time_horizon` field on `write()` or `_shape()`. Recs say _what_ and _why_ but never _by when_.
- **Per-recommendation tradeoff (#7)** — only `_conflicts()` resource-level grouping exists (`recommendations_os.py:635-655`). An individual rec cannot say "choosing this defers X." Adding it is new intelligence, out of scope for Monday.
- **Cost of inaction / "what happens if ignored" (#10)** — no field. For RISK-type recs the data to phrase it exists (`risk_reduction`, `coverage_gap`) but it's framed as upside, never as consequence. A cheap _re-framing_ (not new data) can fake #10 for RISK recs only; ACTION/OPPORTUNITY recs genuinely can't answer it today.

---

## Per-surface scores

| Surface                                | Score   | Ceiling w/ cheap fixes | Blocker                                                |
| -------------------------------------- | ------- | ---------------------- | ------------------------------------------------------ |
| `/dashboard/recommendations` (Roadmap) | **8.0** | 8.7                    | `ranked_above` dropped; no horizon/if-ignored          |
| Dashboard hero (MissionControl NBA)    | **4.5** | 8.0                    | engine drops all quantified fields at `guidance.py:76` |
| Report recs (Executive Briefing)       | **7.5** | 8.7                    | impact-key mismatch hides the best number; no why-#1   |
| Life Brief `next_move`                 | **7.0** | 8.0                    | one-line, no impact number appended                    |

**Weighted verdict (by user exposure): ~6.5 / 10.** The hero — the most-seen surface — is the
anchor dragging the platform down, and it's the cheapest to fix (3 small changes, all data already
on `ta`). Target >9 is **not reachable** for Monday because #5/#7/#10 are missing _fields_, not
missing rendering. A realistic, honest target after the cheap fixes is **~8.3 weighted.**

---

## TOP 3 FIXES (highest leverage, no new intelligence)

1. **Fix the dashboard hero (`guidance.py:76` + `MissionControl.tsx:196-198`).** Pass `quantified_impact`, `confidence`, and `why_number_one` through onto the NBA and render an impact chip + confidence + one-line "why #1"; repoint the CTA to `/dashboard/recommendations`. Moves the most-seen surface 4.5 → ~8 and removes the "fake sample is richer than my real data" trust inversion. ~15 lines total.

2. **Stop discarding `why_ranking.ranked_above`.** It's fully computed in `_why_first()` (`recommendations_os.py:514-521`) and dropped by `roadmap()` (only `why_now` forwarded, line 553). Return the whole `why_ranking` and render `ranked_above` on the lead card and in the report briefing. This is the single most credible "why this is #1" sentence and it currently dies in the engine.

3. **Fix the report impact-key mismatch (`report_engine.py:228`).** The briefing looks for `readiness_before`/`readiness_after`, but the engine writes `retirement_success_before_pct`/`_after_pct` and `protection_adequacy_before_pct`/`_after_pct`. Correct the lookup so the report shows the recomputed before→after arrow it already calculated — a CFP/CPA reading the PDF currently never sees the strongest quantified outcome in the system.
