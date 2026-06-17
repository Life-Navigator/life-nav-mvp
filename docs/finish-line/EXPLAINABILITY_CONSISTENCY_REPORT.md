# Explainability Consistency Report

Sprint: Finish Line · READ-ONLY AUDIT · 2026-06-16
Question: Does every recommendation/insight answer Why? / Evidence? / Confidence? / Tradeoffs? / Assumptions? on EVERY surface?

## Headline verdict: PARTIAL

The explainability _data_ exists and is rich: `recommendations_os._shape` (`recommendations_os.py:488-502`) returns `why`, `evidence`, `confidence`, `formula`, `quantified_impact`, `assumptions`, `narrative`, `impacted_domains`. The problem is **uneven surfacing**: one surface (the Recommendations page drawer) shows nearly everything; the graph node panel shows a strong subset; the dashboard hero and the reports sections each drop different fields; "Tradeoffs" and "Assumptions" are almost never shown together on the same surface; and there is no shared explainability component — each surface re-implements its own.

## The five explainability questions, per surface

Legend: ✔ shown · ◐ partial/buried · ✗ absent

| Surface                                                                       | Why?                               | Evidence?                       | Confidence?               | Tradeoffs?                                   | Assumptions?           | Source/Provenance               |
| ----------------------------------------------------------------------------- | ---------------------------------- | ------------------------------- | ------------------------- | -------------------------------------------- | ---------------------- | ------------------------------- |
| Recommendations page drawer (`recommendations/page.tsx:106` `Explainability`) | ✔                                  | ✔ (statements + source_table)   | ✔ (+ full formula)        | ✗ (conflicts shown page-level, not per-card) | ✔                      | ✔ source_table lineage          |
| Dashboard hero NBA (`ExecutiveSummary.tsx:299`)                               | ◐ (`why` only)                     | ✗                               | ✔ (% only)                | ✗                                            | ✗                      | ✗                               |
| Life Brief (`LifeBrief.tsx`)                                                  | ✔ (narrative `why`)                | ◐ (signals as evidence)         | ✔ (%)                     | ◐ (tension)                                  | ✗                      | ✔ (source line)                 |
| Mission Control top move (`MissionControl.tsx:148`)                           | ◐ (`why`)                          | ✗                               | ✗                         | ✗                                            | ✗                      | ✗                               |
| Graph node panel (`NodeDetailsPanel.tsx`)                                     | ✔ (`reasoningSummary`/description) | ✔ (evidence nodes + citationId) | ✔ (node + edge)           | ✗                                            | ✔ (`node.assumptions`) | ✔ (provenance label + citation) |
| Reports — "Prioritized Next Steps" (`report_engine.py:187`)                   | ✔                                  | ✗ (dropped)                     | ✔                         | ✗                                            | ✗ (dropped)            | ◐ (source_module)               |
| Reports — exec briefing recs (`report_engine.py:232`)                         | ✔                                  | ✔                               | ✔                         | ✗                                            | ✔                      | ✔                               |
| Reports — "Your Life Model" tradeoffs (`report_engine.py:159`)                | n/a                                | n/a                             | n/a                       | ✔ (objective conflicts)                      | n/a                    | n/a                             |
| Advisor (LLM six-section) (`advisor_llm.py:150-169`)                          | ✔ (recommendation)                 | ◐ (what_we_know)                | ✗ (no numeric confidence) | ✔ (tradeoffs[])                              | ✔ (assumptions[])      | ◐ (numbers via derivations)     |
| Advisor chat next-action (`orchestrator.py:270`)                              | ✔                                  | ◐ (evidence in payload)         | ✔ (%)                     | ✗                                            | ✗                      | ◐ (source_module)               |

### Key observations

- **No single surface answers all five.** The Recommendations drawer is the most complete (4/5, missing Tradeoffs). The LLM advisor is the only surface that natively does Tradeoffs (`advisor_llm.py:152`) but it omits a numeric Confidence. The graph panel is the only place that shows provenance/citation IDs.
- **Tradeoffs are the most-dropped field.** They exist in three disconnected forms: per-rec resource `conflicts` (`recommendations_os.py:635`, shown only as a page-level banner on the Recommendations page, `recommendations/page.tsx:427`), objective `conflicts` (`life_discovery.objectives_plan`, surfaced only in the Reports "Life Model" section), and the LLM's `tradeoffs[]`. No recommendation card anywhere shows "the tradeoff of doing THIS."
- **Assumptions** are persisted per-rec (`recommendations_os.py:89`) and shown in the drawer + graph + exec briefing, but absent from the dashboard hero and the "Prioritized Next Steps" report section.
- **ProvenanceBadge is barely used.** `grep ProvenanceBadge` → only `ExecutiveSummary.tsx:218` (the vision/north-star line) and the component file itself. The Life Brief uses an inline confidence chip, not ProvenanceBadge; the recommendations drawer and graph roll their own provenance UI. (The prompt's note that ProvenanceBadge is "used only on vision" is confirmed.)

## Defects

### Defect 1 (P1) — Dashboard hero is explainability-thin

The NBA card (`ExecutiveSummary.tsx:299-332`) renders title + `why` + `expected_benefit` + confidence% only. The same recommendation, one click away on `/dashboard/recommendations`, exposes evidence, source lineage, assumptions, formula, and impact. A user who never opens the drawer never sees _why to trust_ the headline action.

- Fix: add a compact "Why / evidence / confidence" affordance on the hero (the data is already in `next_best_action.quantified_impact` and the prioritized rec). Reuse the drawer's logic.

### Defect 2 (P1) — Reports "Prioritized Next Steps" drops evidence + assumptions

`_os_recommendations_section` (`report_engine.py:187-194`) maps only `{title, why, action, priority, confidence, expected_benefit, source}` — dropping `evidence`, `assumptions`, `quantified_impact` that `_shape` returns. (Same field-drop noted in the Recommendation report, Defect 5.) The exec-briefing section right above it (`report_engine.py:232-242`) keeps them, so the same report is internally inconsistent about how explainable a recommendation is.

- Fix: include evidence/assumptions/impact in the section body.

### Defect 3 (P1) — Tradeoffs never appear at the recommendation level

The resource-conflict engine computes a real per-finding tradeoff and `suggested_sequence` (`recommendations_os.py:635-655`) but it is only rendered as a single amber banner at the top of the Recommendations page (`recommendations/page.tsx:427-436`) and is absent from every other surface and from individual cards. The dashboard, reports recs, and graph nodes show no tradeoff at all.

- Fix: attach the matching conflict to each rec in `_shape`/`prioritize` output and render a "Tradeoff" line per card; surface the same on the dashboard NBA and graph node. Surfacing-only — the conflict data already exists.

### Defect 4 (P2) — Confidence is shown as a bare % with no basis except in the drawer/graph

Only the Recommendations drawer (`recommendations/page.tsx:206-212`) and graph edges expose WHY confidence is what it is (the formula / evidence count). Everywhere else confidence is an unexplained number. The LLM advisor shows no numeric confidence at all.

- Fix: standardize a confidence chip that links confidence to evidence_strength + formula (data already in `formula`).

### Defect 5 (P2) — No shared explainability contract / component

Each surface re-derives explainability from raw rec fields: `Explainability` (`recommendations/page.tsx:106`), `NodeDetailsPanel` (graph), `report_engine` payload mapping, `ExecutiveSummary` hero, `LifeBrief`. They drift (different field subsets, different provenance UI, different "no data" copy). There is no single typed contract for "an explainable recommendation."

- Fix (no new infra): define ONE shape in the OS — `_shape` is already 90% of it (add the conflict/tradeoff) — and ONE shared React component (e.g. promote the drawer's `Explainability` to `components/recommendations/RecExplainability.tsx`) consumed by the recommendations page, the dashboard hero, the reports viewer, and the graph node panel. Each surface chooses density (compact vs full) but reads the same fields, so a field can never be silently dropped on one surface again.

## What IS consistent

- The underlying explainability data is single-sourced and honest: `_shape` (`recommendations_os.py:488`) surfaces only persisted fields; the drawer, graph panel, and exec briefing all render honest empty states ("No evidence attached yet", "No assumptions recorded yet"), never fabricated rationale.
- The graph node panel (`NodeDetailsPanel.tsx`) is a genuinely strong explainability surface: reasoning summary + per-edge provenance label + citationId + confidence + assumptions + missingData — exactly the model to standardize on.
- Recommendation lineage on the graph is real-edges-only with provenance ("persisted_edge" / "computed_connection" / "shared_node"), built from stored rec data (`life_graph_workspace.py:95-166`).

## Recommended single explainability contract (reusing existing components)

1. Backend: ensure `prioritize()`/`roadmap()`/`active()` all flow through `_shape`, and add the per-rec tradeoff (from `_conflicts`) into `_shape`. One payload → all surfaces. (Today `active()` skips `_shape`, which is why the graph diverges — see Recommendation report Defect 3.)
2. Frontend: promote `recommendations/page.tsx`'s `Explainability` into a shared `RecExplainability` with a `density` prop; render it (compact) on the dashboard NBA hero and (full) in the reports viewer; align the graph `NodeDetailsPanel` to read the same field names.
3. Make the five questions mandatory in the shared component (Why / Evidence / Confidence+basis / Tradeoffs / Assumptions), each with an explicit honest-empty state — so a missing field reads as "not recorded yet," never as silently absent.

Net: explainability is rich but unevenly surfaced; no surface answers all five questions, Tradeoffs and Assumptions are the systematic gaps, and the lack of a shared contract guarantees future drift. All fixes are surfacing-only.
