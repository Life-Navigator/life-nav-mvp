# Conflict Detection (Phase 4)

**Date:** 2026-06-16 · Discovery sees that the goals compete.

## Mechanisms

1. **Cross-goal competition (narrative level):** `RelationshipManager._competing_goal_labels()` collapses the user's stated goals to distinct life domains; ≥2 ⇒ the goals compete for time/money/energy, and the next question becomes a concrete tradeoff/postpone question naming two of the user's actual goals.
2. **Objective conflict map (structured):** `LifeDiscoveryService._CONFLICTS` encodes classic tradeoffs (financial_independence↔family_stability = money; career_growth↔family_stability = time; education↔FI = timeline; career↔health = time; …), and `objectives_plan()` returns detected `conflicts`.

## Resource axes

The tradeoff framing ("if one needed to move more slowly so the others could succeed, which would be easiest to postpone?") surfaces the user's own binding constraint (time/money/energy) rather than asserting it; `_CONFLICTS` names the axis per pair when a structured tradeoff is needed.

## Honest scope

This is domain-distinctness + a curated conflict map (deterministic), not a quantitative ConflictGraph with weighted edges. It reliably triggers the right tradeoff question for multi-domain goal sets (validated for personas A/B/C). A full weighted ConflictGraph is a future enhancement.
