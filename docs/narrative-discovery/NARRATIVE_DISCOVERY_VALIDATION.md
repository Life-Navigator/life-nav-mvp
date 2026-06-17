# Narrative Discovery Validation (Phase 9) + Final Status

**Date:** 2026-06-16 · Branch `platform/discovery-intelligence`. Code + tests complete; **deploy gated**.

## Validation — all 4 personas, through the real pipeline

| Persona               | Expected dominant theme | **Result (clean)**           | **Result (with financial persona seed)** |
| --------------------- | ----------------------- | ---------------------------- | ---------------------------------------- |
| A — Family Builder    | Family foundation       | ✅ `family_foundation`       | ✅ `family_foundation`                   |
| B — Burnout Executive | Health/family balance   | ✅ `health_life_balance`     | ✅ `health_life_balance`                 |
| C — Career Maximizer  | Career acceleration     | ✅ `career_acceleration`     | ✅ `career_acceleration`                 |
| D — Financial Stress  | Financial stabilization | ✅ `financial_stabilization` | ✅ `financial_stabilization`             |

**4/4 — clean and seeded. No partial credit needed.** (Previous sprint: 0/4.) Persona seeds never override the user's life story.

## Tests (`tests/test_discovery_intelligence.py` — 30 passed)

`test_dominant_narrative_per_persona` (×4), `test_emotional_signals_detects_distress_and_burnout`, `test_narrative_validation_end_to_end_clean` (×4), `test_narrative_validation_with_persona_seed` (×4), plus the earlier 17 ranking/candidate-protection/priority/narrative tests. **Full core-api suite: 479 passed, no regression.**

## Final questions

1. **Narratives before objectives?** Yes — `dominant_narrative()` computes the theme from the whole goal set; objectives are downstream outputs.
2. **Multiple goals coexist?** Yes — `goal_portfolio` keeps every stated goal (≥2 asserted).
3. **Discovery follows the life story?** Yes — theme + question both derive from the user's goals/signals.
4. **Conflicts detected?** Yes — competing-goal detection + `_CONFLICTS` (domain-level heuristic; honest scope).
5. **Constraints discovered?** Yes — constraint step + emotional-signal constraints (severity not yet quantified).
6. **Question selection from narrative?** Yes — narrative→priority→constraint→conflict; ontology last.
7. **Dominant life themes identified?** Yes — 4/4.
8. **All 4 validation personas pass?** **Yes — 4/4, clean and seeded.**
9. **Would a human advisor ask similarly?** 3/4 clearly yes; persona D's theme is right, question could be warmer (`HUMAN_ADVISOR_ALIGNMENT_REPORT.md`).
10. **Materially more human?** Yes — leads with the life story + the real tradeoff, never "financial independence."

## Honest scope (carried forward)

- The narrative/conflict/constraint/emotional layers are **deterministic heuristics** (discovery is LLM-free) — they hit 4/4 and are driven by the user's own words, but they're rule-based, not learned.
- The single `primary_objective` can still lag the narrative (e.g. shows "Advance your career" for persona A) — it's now demoted below `dominant_narrative` and not the surfaced theme; aligning it fully is a tracked follow-up (`OBJECTIVE_GENERATION_REPORT.md`).
- Persona D's next question could be warmer (a stabilization-specific opener).
- Bridge re-ingest/supersede risk (from the prior failure analysis): re-confirm `public.goals` ≠ `life.goals` in prod and that unconfirmed never supersedes confirmed before deploy.

## Status

### NARRATIVE_DISCOVERY_READY (code + tests; deploy gated)

All 10 phases implemented; 4/4 personas pass clean and seeded; 479 tests green. **Not yet deployed.** To go live: apply migration `20260616140000_discovery_intelligence.sql`, deploy core-api from this branch (or merge to `main`), and run one live synthetic-user trace of the four personas. Per the sprint rule ("do not deploy unless all validation personas pass"), deployment is now **permitted** — pending your go on the gated production steps.

## Changed files

`app/services/life_discovery.py` (narrative engine, ranking, snapshot), `life_bridge.py`, `relationship_manager.py`; `supabase/migrations/20260616140000_discovery_intelligence.sql`; `tests/test_discovery_intelligence.py`. Docs: `docs/narrative-discovery/` (10).
