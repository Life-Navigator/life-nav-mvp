# Goal Portfolio (Phase 2)

**Date:** 2026-06-16 · Multiple goals coexist; none becomes invisible.

## Change

Old: one objective survived (`analyze()` single pick), the rest vanished from the theme.
New: every stated goal is kept in `candidate_goals` (extracted across all domains) and surfaced as a **goal_portfolio** in `snapshot()` — each with `domain`, `confidence`, and `status` (confirmed / candidate / inferred via `_future_status`).

## Promotion rules

- User-stated goals → confirmed (origin=user). Persona seeds → candidate (origin=persona_bridge), never auto-primary.
- The weighted ranking engine (`rank_objectives`) orders the portfolio by life-priority (user-priority > urgency > significance > recency > deps > confidence), not confidence alone.

## Evidence

`test_narrative_validation_end_to_end_clean` asserts `len(goal_portfolio) >= 2` for the multi-goal personas (goals coexist). The NVIDIA persona's portfolio spans finance/family/career/education/health simultaneously.

## Honest scope

The portfolio comes from the existing `candidate_goals` extraction (good multi-domain coverage). Per-goal "importance" beyond domain/confidence/urgency is heuristic; richer per-goal scoring can layer on `score_objective` later.
