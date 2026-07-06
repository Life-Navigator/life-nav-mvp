# RECOMMENDATION_DELTA.md — Phase 3 (HONEST: not real yet)

## Finding

Same root as the readiness delta: the recommendation engine collects from **domain modules / documents / life_objectives**, not from `life.facts`. So an action's `life.facts` write does not add/change/resolve a recommendation — a "New / Changed / Resolved recommendation" panel after an action would be **fabricated**.

## What's true today

- The recommendations roadmap (`/dashboard/recommendations`) is advisor-grade and recomputes on load (stale-while-revalidate).
- The Impact Card honestly lists the **areas** the change affects (e.g. "Retirement assumptions") rather than inventing a recommendation diff.

## What it would take (documented)

Wire the actions to the domain tables (READINESS_DELTA.md), then call the existing per-domain `POST /v1/{domain}/recommendations/generate` after apply, diff the recommendation set (by finding_key) before/after, and render New/Changed/Resolved. Not built — would otherwise show a fake diff.
