# Narrative Profile (Phase 1)

**Date:** 2026-06-16 · The narrative is now first-class, never collapsed.

## Stored (separate from objectives)

- **narrative** — the user's verbatim statement (`life_vision.prompts.narrative`).
- **narrative_summary** — deterministic multi-domain summary (`prompts.narrative_summary`).
- **dominant_narrative** — `{key,label,summary,domains,signals,confidence}` computed by `dominant_narrative()` and exposed in `snapshot()` (the surfaced theme).
- **emotional_signals** — distress/burnout/ambition/family/urgency/etc. (`emotional_signals()`), exposed in snapshot.
- **goal_portfolio** — all stated goals with domain/confidence/status (never reduced to one).
- **time horizon / competing priorities / constraints** — captured via FLOW (`time_horizon`, candidate goals, constraints step).

## Principle

No collapse, no single-objective summary, original wording preserved. The objective layer is downstream of this profile. Verified by `test_narrative_survives_ontology_conversion` + the snapshot exposure tests.
