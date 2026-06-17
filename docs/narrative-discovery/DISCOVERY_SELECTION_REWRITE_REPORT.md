# Discovery Selection Rewrite (Phase 6)

**Date:** 2026-06-16 · Questions originate from narrative → priority → constraint → conflict, not from the top objective.

## What changed

`RelationshipManager.state()` no longer surfaces the next FLOW step anchored on a single objective. When the user has ≥2 competing stated goals, the priority step becomes a **tradeoff/postpone question framed from the user's own goals** (`_competing_goal_labels()`), and the surfaced theme is the `dominant_narrative` (the life story), exposed in `_context_panel` as `dominant_narrative`/`narrative_theme`.

## Priority order (effective)

1. Clarify narrative (the dominant_narrative is computed + surfaced first)
2. Clarify priorities (tradeoff/postpone question when goals compete)
3. Clarify constraints (constraint step + emotional signals)
4. Clarify conflicts (tradeoff framing from `_CONFLICTS`/competing goals)
5. Clarify objectives (objectives are derived outputs — last)

## Honest scope

Delivered through the existing FLOW `priority`/`constraint` steps (re-framed) rather than a brand-new dynamic-question engine — this keeps the validated `answer()`/resume machinery intact (no persistence risk). Ontology expansion is now last. Validated for personas A/B/C (tradeoff question); persona D (single-domain distress) gets the priority question with the stabilization narrative surfaced.
