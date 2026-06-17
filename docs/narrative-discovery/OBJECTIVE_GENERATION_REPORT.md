# Objective Generation (Phase 8)

**Date:** 2026-06-16 · Objectives are reflections of the narrative, not its driver.

## New order

Narrative → goal portfolio → conflicts → constraints → **then** objectives. In `snapshot()`:

- `dominant_narrative` is computed first (the theme).
- `goal_portfolio` holds all stated goals.
- `objectives` are the ranked, candidate-protected outputs (confirmed user goals lead; persona seeds stay candidates); `primary_objective` is a secondary "top confirmed goal", not the surfaced theme.

## Effect

The wrong/None single objective (career for a family story, family for a career story) no longer defines onboarding — the dominant narrative does. Objectives exist to be acted on later; they don't steer discovery.

## Honest scope

Objectives are still created by `discover_goal` (one per stated root). The architectural win is that they're **demoted below the narrative** and candidate-protected. A future step is to generate one ranked objective per portfolio goal so the objective list mirrors the full narrative (today the portfolio covers that role; the single primary_objective can lag).
