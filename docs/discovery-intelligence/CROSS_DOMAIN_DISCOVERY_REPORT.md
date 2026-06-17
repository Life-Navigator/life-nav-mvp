# Cross-Domain Discovery Report (Phase 6)

**Date:** 2026-06-16 · Detect that the user's goals compete, and ask from the conflict.

## The need

For a user juggling wedding, home, family, promotion, master's, and fitness, these compete for the same scarce resources — **time, money, energy**. The next question should come from that **conflict/tradeoff**, not from the highest-confidence objective.

## What's implemented

1. **Competing-goal detection from the user's own goals.** `_competing_goal_labels()` reads `candidate_goals` (the user's stated list), collapses to **distinct life domains** (family/career/education/health/finance via `_goal_domain`), and returns the distinct goals newest-first. ≥2 distinct domains ⇒ the user is juggling competing goals.
2. **Question selected from the conflict.** When competing, the `priority` step becomes the postpone/tradeoff question naming two of the user's actual goals (Phase 5).
3. **Objective-level conflict model (reused).** `LifeDiscoveryService._CONFLICTS` already encodes the classic tradeoffs and `objectives_plan()` returns detected `conflicts` (e.g. financial_independence↔family_stability = "money", career_growth↔family_stability = "time"). These remain available for downstream surfaces.

## Resource axes (time / money / energy)

The conflict framing is resource-agnostic on purpose — "if one needed to move more slowly so the others could succeed, which would be easiest to postpone?" surfaces the user's own sense of the binding constraint (time, money, or energy) rather than the system asserting which. The explicit `_CONFLICTS` map names the axis per pair (money/time) when a structured tradeoff is needed.

## Honest scope

- Detection is **domain-distinctness + the curated `_CONFLICTS` map** (heuristic, deterministic), not a learned resource-contention model. It reliably triggers the tradeoff question for multi-domain goal sets (validated) without overclaiming a quantitative resource simulation.

## Tests

`test_discovery_question_surfaces_tradeoff_when_goals_compete`, `test_validation_example_family_not_financial_independence`.

## Files

`apps/lifenavigator-core-api/app/services/relationship_manager.py` (`_competing_goal_labels`, `state`), `app/services/life_discovery.py` (`_CONFLICTS`, `objectives_plan`).
