# Dominant Narrative Engine (Phase 3) — the core architectural change

**Date:** 2026-06-16 · Branch `platform/discovery-intelligence`. Objectives are now **outputs**, not the driver. Deploy gated.

## The flip

Old: `Narrative → analyze() → ONE objective → discovery`. The single objective WAS the theme (and was often wrong).
New: `Narrative → candidate goal set → dominant_narrative() → theme`, with objectives derived afterward.

## `dominant_narrative(candidate_goals, narrative_text)` (`app/services/life_discovery.py`)

Returns a **life STORY** — `{key, label, summary, domains, signals, confidence}` — never an objective. Computed from the **whole** goal set's domain mix + emotional signals, in a stabilize→balance→ambition→family order:

1. **Financial stabilization** — money stress + distress ("debt", "losing my apartment", "overwhelmed"). Stabilize before optimizing.
2. **Health & life balance** — burnout/overwork (and money is not the worry).
3. **Career acceleration** — career/education focus with family deprioritized ("don't have children", "prioritizing my career") + ambition.
4. **Building a family foundation** — family-building present, summarized as balancing the other domains.
5. Fallbacks by strongest present domain; else "Still taking shape".

The theme labels are life stories (`NARRATIVE_THEMES`), not the 7 ontology roots. Persona seeds never participate (they're not in the user's candidate goals).

## Why deterministic

Discovery is LLM-free; the engine is a curated rule+signal layer (documented, tunable). It is honest about being heuristic — but it is **driven by the user's own words across all domains**, which is the architectural point.

## Validation (the bar)

4/4 personas produce the correct dominant narrative — **clean and with a financial persona seed** (`test_dominant_narrative_per_persona`, `test_narrative_validation_end_to_end_clean`, `test_narrative_validation_with_persona_seed`). See `NARRATIVE_DISCOVERY_VALIDATION.md`.

## Surfaced everywhere

`snapshot()` exposes `dominant_narrative` (+ `goal_portfolio`, `emotional_signals`); `RelationshipManager._context_panel` exposes `dominant_narrative`/`narrative_theme` as the lead, with the single `primary_objective` demoted to a secondary output.
