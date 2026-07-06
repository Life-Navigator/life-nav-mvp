# Recommendation Quality Audit

For every surfaced recommendation: why generated, what evidence, what assumptions, what data is missing,
confidence — and would it survive expert review?

## The generation contract (code-enforced)

`RecommendationOS.write()` (`app/services/recommendations_os.py`) is the single write path. It enforces:

- **No recommendation without evidence.** A rec with empty `evidence` returns `None` and is not persisted
  ("no recommendation without evidence" guard). This is the core anti-fabrication rule.
- Every row carries: `source_module` (which engine produced it), `rec_type`
  (ACTION/RISK/OPPORTUNITY/DEPENDENCY/INFORMATION), `confidence`, `evidence` (`[{statement, source_table}]`),
  `assumptions` (`[{label, value}]`), `impacted_domains`, `rank_score`, `narrative` (current/target/delta/why),
  `created_at`/`updated_at`.
- The dashboard now sources risks/opportunities from this engine only (archetype templates removed at the
  source in `discover_goal`) — so a dashboard risk/opportunity is, by construction, recommendation-generated
  with evidence.

## This run (12 fresh personas)

- Fresh users with no data/documents produced **zero recommendations** — the honest empty state, not
  fabricated cards. ✅ Correct ("shut up gracefully when it doesn't know enough"). This means the _quality_
  of generated recs was not exercised by this fresh-user sample.

## Real example (from the Life-Graph sprint, seeded data-rich user)

A seeded recommendation rendered with full lineage, demonstrating the evidence chain works end-to-end:

- **Title:** "Increase 401k to full employer match" · `rec_type` ACTION · `confidence` 0.82 · `rank_score` 0.91
- **Evidence:** `[{statement: "401k statement: contributing 3% vs 6% match", source_table: "documents:401k_statement"}]`
- **Assumptions:** `[{label: "Tax treatment", value: "pre-tax traditional 401k"}]`
- **Impacted domains:** finance, family
- Surfaced in the graph as a `recommendation` node linked `evidenced_by → evidence → from_source` (the
  source table is the citation).

## Would it survive expert review?

| Dimension            | Assessment                                                                                                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Evidence-backed      | ✅ Yes — every rec must cite ≥1 evidence statement with a source_table; no evidence ⇒ no rec.                                                                                                                   |
| Assumptions explicit | ✅ Yes — assumptions are a first-class field and rendered separately (not as facts).                                                                                                                            |
| Confidence present   | ✅ Yes — numeric, surfaced.                                                                                                                                                                                     |
| Missing-data named   | ⚠️ Partial — `quantified_impact.unlocked_capabilities` lists what better data would unlock, but there is no explicit per-rec "missing inputs" field; the advisor names missing inputs conversationally instead. |
| Not a goal           | ✅ Yes — recommendations never auto-become goals (verified: no rec→goal path).                                                                                                                                  |
| Boundary/disclaimer  | ✅ Yes — family/estate carry the "not legal/financial advice" boundary.                                                                                                                                         |

**Verdict:** the recommendation _structure_ is expert-grade (evidence + assumptions + confidence +
boundary). A CFP/CPA reviewing a generated rec would see its basis. The open question is **coverage** —
how many high-value recs the engines actually produce for a data-rich user — which this fresh-user sample
did not measure.

## Gaps / recommended additions

1. **Add an explicit `missing_inputs` field** per recommendation (today it's implicit in
   `unlocked_capabilities` + conversational). Makes "what data is missing" inspectable.
2. **Run the eval with data-rich personas** (seed finance accounts + a 401k/insurance document) so
   recommendation _coverage and quality_ are measured, not just the empty-state correctness.
3. **Persist which recs the advisor referenced per turn** (observability audit) so rec influence on
   conversation is traceable.
4. No fabrication risk found: the empty-when-no-data behavior is the correct, trust-preserving default.
