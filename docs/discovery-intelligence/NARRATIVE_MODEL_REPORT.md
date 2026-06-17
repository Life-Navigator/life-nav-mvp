# Narrative Model Report (Phase 3)

**Date:** 2026-06-16 · Preserve the user's story, separate from the ontology.

## What was added

When the user answers the open `primary_goal` step (their list of goals in their own words), `RelationshipManager.answer()` now stores, in `life_vision.prompts` (separate from `life_objectives`):

- **`narrative`** — the user's **verbatim** statement (never collapsed into one objective).
- **`narrative_summary`** — a deterministic, multi-domain summary built from the extracted goal domains + a horizon cue, e.g. _"You're building across family, career, education, health over the next 1–2 years."_ (domains via `_goal_domain` on each candidate goal; horizon from time/wedding/promotion cues).

`snapshot()` now exposes both `narrative` and `user_priority` alongside `objectives`.

## Why

The audit showed the pipeline collapsed a rich narrative into a single (wrong) objective. Keeping the narrative as a first-class, separate artifact means the story survives ontology conversion and can ground later turns/UI without being reduced to one root.

## Honest scope

- The summary is **deterministic/template-based** (discovery runs no LLM). It captures the domains + horizon faithfully but is not a fluent LLM paraphrase. The **verbatim narrative** is always preserved, so no fidelity is lost; a richer summary can be layered later (e.g., in advisor mode) without changing this storage.
- Stored in the existing `life_vision.prompts` jsonb — **no migration** needed for the narrative.

## Tests

`test_narrative_survives_ontology_conversion` — after stating the 7-goal sentence, `prompts.narrative` equals the user's exact words and `prompts.narrative_summary` is populated.

## Files

`apps/lifenavigator-core-api/app/services/relationship_manager.py` (goal branch), `app/services/life_discovery.py` (`snapshot` exposes `narrative`/`user_priority`).
