# Narrative Question Engine (Phase 2)

**Date:** 2026-06-16 · `narrative_question(narrative_key, goals, signals)` in `app/services/life_discovery.py`.

## Inputs

- **Dominant narrative** (`dominant_narrative()`) — the life story.
- **Goal portfolio / competing goals** (`_competing_goal_labels`, concrete goals preferred over context/feelings).
- **Emotional signals** (`emotional_signals`).
- **Narrative text** (the user's verbatim statement).

## Output

A single question that PROVES understanding — it references the user's goals, the conflict between them, the constraint, or the emotional state. Returns `None` only if no narrative is known (then the FLOW prompt is used; rare). It never emits a generic question.

## Wiring

`RelationshipManager.state()` calls it for the `priority` step; `converse()` now recomputes `state()` **after** persisting candidate goals so the engine sees the full goal set + narrative. Robustness: `dominant_narrative()` also reads domains from the raw narrative text, so family/career are detected even before per-goal rows exist.

## Guarantee

Every priority question references actual context. Verified live (v118): 5/5 contextual, 0 generic.
