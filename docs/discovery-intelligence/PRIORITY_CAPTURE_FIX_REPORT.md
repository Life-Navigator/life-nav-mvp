# Priority Capture Fix Report (Phase 2)

**Date:** 2026-06-16 · Fixes the no-op "which matters most" step.

## The bug

The `priority` FLOW step (`relationship_manager.py`, `kind="context"`, prompt "Of everything you shared, which matters most?") had **no handler** in `answer()`. The user's answer was marked answered but **never written and never re-ranked** anything — the audit's decisive finding.

## The fix

Added a `kind == "context"` branch in `RelationshipManager.answer()`:

1. **Classify** the free-text answer to a root objective: `priority_root = self._life.classify_priority(ans)` (`life_discovery.classify_priority` → `analyze()` → root).
2. **Persist** the user's priority to `life_vision.prompts`: `user_priority` (verbatim) + `user_priority_root`.
3. **Confirm + promote** the chosen objective: `UPDATE life.life_objectives SET confirmed=true, origin='user', updated_at=now() WHERE root_objective_key = <priority_root> AND status='active'`. This turns a candidate into a confirmed objective AND bumps recency — so both the `user_priority` and `recency` terms of the score now favor it.

## Effect on ranking

`rank_objectives(..., priority_root=...)` reads `user_priority_root` (via `snapshot`/`objectives_plan`) and applies the heaviest weight (`3.0·user_priority`). The user's stated priority now **outranks** persona-seeded confidence.

## Tests

- `test_priority_answer_confirms_and_promotes_objective` — answering the priority step with a family/wedding statement sets `user_priority_root=family_stability` and makes family the **primary** objective over a high-confidence persona FI.
- `test_validation_example_*` — the priority/tradeoff path end-to-end.

## Files

`apps/lifenavigator-core-api/app/services/relationship_manager.py` (`answer()` context branch), `app/services/life_discovery.py` (`classify_priority`).
