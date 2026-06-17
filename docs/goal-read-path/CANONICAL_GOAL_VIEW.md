# Canonical Goal View

**Date:** 2026-06-17 · Implementation: `app/services/canonical_goals.py` (`CanonicalGoalsService.canonical_goals`). Tests: `tests/test_canonical_goals.py` (7).

## What it returns

One list of canonical goals, each:

```
{ id,                    // stable, deterministic per user (cg_<normalized-title>)
  title, domain, status,
  confirmation_status,   // confirmed | candidate
  confidence, priority, timeframe,
  progress,              // ONLY from public.goals when present; else null (never invented)
  source_store,          // the authoritative store this canonical goal came from
  source_ids: [{store,id}...],   // every contributing store row
  related_narrative, related_objective, why_chain,
  cluster,               // conservative goal family (home/debt/education/...) or null
  dependencies, risks,
  provenance: { merged_from:[stores], is_duplicate_merge:bool } }
```

## How it's built

1. Collect entries from all four stores (objectives via `snapshot().objectives`, `life.goals`, `public.goals`, candidate portfolio via `snapshot().goal_portfolio`).
2. **Merge** entries sharing a normalized title; the most authoritative source (priority order) supplies title/status/confirmation; `progress` is attached from any `public.goals` member; all `source_ids` are kept.
3. **Cluster** (group, not merge) related-but-distinct goals via a conservative keyword map.
4. **Rank** by confirmation (confirmed first) → source priority → confidence.

Honest empty: returns `[]` when nothing is grounded → the caller shows _"Arcana is still learning your goals."_

## Surfacing

- `GET /v1/life/goals` → `{ goals, count, empty_message, source }`.
- `GET /v1/life/my-life` → `canonical_goals` field (so the dashboard reads it without an extra round-trip).
- Report `_advisor_executive_section` goals are built from it.

## What it does NOT do

No migration, no write, no delete, no destructive merge. Internally the four stores remain; only the
user-visible read is unified. Write-path convergence remains the (deferred) `GOAL_MIGRATION_PLAN`.
