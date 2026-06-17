# Goal Confirmation Policy (Phase 4)

**Date:** 2026-06-16 · Persona goals are candidates, not the user's confirmed focus.

## Policy

- A **persona/bridge-seeded** goal is a **CANDIDATE**: `confirmed=false`, `origin='persona_bridge'`. It may be _surfaced_ as a "possible goal" but may **never** become the primary objective.
- A **user-stated/confirmed** goal is `confirmed=true`, `origin='user'`. Only confirmed objectives are eligible to be primary.
- A persona seed **never downgrades** an objective the user already confirmed.
- A candidate is **promoted to confirmed** only when the user states it (the FLOW `goal` step) or explicitly prioritizes it (the `priority` step).

## Implementation

- **Schema** (`supabase/migrations/20260616140000_discovery_intelligence.sql`): `life.life_objectives` gains `confirmed BOOLEAN NOT NULL DEFAULT true` and `origin TEXT`. Additive/idempotent.
- **`discover_goal(..., confirmed=True, origin='user')`** (`life_discovery.py`): writes the flags; if a persona seed targets a root the user already owns/confirmed, it preserves the existing confirmed/user values (no downgrade).
- **Bridge** (`life_bridge.py`): seeds persona goals with `confirmed=False, origin='persona_bridge'`.
- **`snapshot()`**: `primary_objective` is chosen **only from confirmed** objectives (None if none confirmed); unconfirmed ones are returned as `candidate_objectives` with `confirmed: false`.
- **Priority step** promotes the chosen objective to `confirmed=true, origin='user'`.

## UX contract (the audit's BAD → GOOD)

- **BAD:** "Primary Objective: Reach Financial Independence" (from a persona seed).
- **GOOD:** primary = a user-confirmed goal; the persona seed appears as a **candidate** ("Possible goal: Financial independence — unconfirmed") and is never asserted as the focus.

## Tests

`test_persona_fi_cannot_be_primary_without_confirmation`, `test_confirmed_family_is_primary_over_persona_fi`, `test_bridge_seeds_persona_goals_as_unconfirmed_candidates`, `test_user_goal_is_confirmed_and_can_lead`, `test_unconfirmed_persona_goal_is_penalized`.

## Migration note

Existing rows default `confirmed=true` (historically user-driven). New persona seeds write `confirmed=false`. The migration must be applied before the from-`main` deploy (gated).
