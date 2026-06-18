# MISSING_PERSISTENCE_FIX_REPORT

Sprint: **Data Flow & Rendering Integrity**. Plumbing only — surface what discovery already understands
into the canonical `/v1/life/my-life` contract. No new intelligence, no fabrication, no auto-promotion.

## What changed (file:line)

### `app/services/my_life.py` — `my_life()` return + two helpers

- Added a **Canonical Rendering Contract block** to the `my_life()` return: `dominant_narrative`,
  `narrative_summary` (= `dominant_narrative.summary`), `goal_portfolio`, `motivations`,
  `emotional_signals`, `timeline`, `coverage`, `missing_context`. `constraints` + `canonical_goals`
  were already present; left intact.
- `_motivations_from_signals()` — maps `snapshot.emotional_signals` to human phrasing via
  `_MOTIVATION_PHRASES`. Every entry is `provenance_type="advisor_inferred"`. **No new extractor, no
  write to `life.motivations`** — see decision below.
- `_timeline_passthrough()` — reads `life_vision.prompts.time_horizon` (raw free text) + goals tagged
  `future_goal` in the portfolio. Returns `structured: false`. **No date parsing.**
- `coverage` / `missing_context` composed from `discovery_health()` — honest missing areas, never backfilled.

### `tests/test_my_life.py` (+4 tests)

- `test_my_life_exposes_full_canonical_contract` — every contract field present.
- `test_my_life_timeline_is_passthrough_not_parsed` — `time_horizon` surfaced verbatim, `structured=false`.
- `test_my_life_motivations_are_inferred_from_signals_never_confirmed` — motivations always `advisor_inferred`.
- `test_my_life_coverage_is_honest_about_missing_areas` — missing areas → honest `missing_context`.

### `tests/test_relationship_manager.py` (+4 tests)

- `test_multi_goal_statement_persists_every_candidate_goal` — wedding/home/family/promotion/education/fitness
  all accumulate in `life.candidate_goals`, not collapsed.
- `test_answered_constraint_persists_to_life_constraints` — money/energy constraint answer → `life.constraints`.
- `test_dominant_narrative_persists_and_returns_in_snapshot` — narrative persists to `prompts.narrative` + returns.
- `test_candidate_goals_are_not_auto_promoted_to_confirmed_objectives` — candidate/future stays candidate.

## The motivations decision (honest)

`life.motivations` (migration 154:40) exists but discovery **never writes it**. The motivational signal is
ALREADY captured deterministically as `emotional_signals` (life_discovery.py:254) and exposed in the
snapshot. Per the brief, I chose to **expose `emotional_signals` as `motivations`** (labeled inferred)
rather than build a new clause extractor or write speculative rows. There is no cleanly pre-extracted
motivation clause to persist without a parser, so **no `life.motivations` row is written**. If a future
sprint wants persisted motivations, the honest hook is a dedicated motivation clause in the goal turn —
out of scope here (no new intelligence).

## Test results

`.venv/bin/python -m pytest -q` (apps/lifenavigator-core-api): **523 passed, 7 warnings**.
Scoped files (`test_my_life`, `test_relationship_manager`, `test_life_discovery`): **38 passed**.

## Residual gaps deliberately NOT over-built (and why)

1. **Structured date parsing** ("next June" → a real date). Free text is passed through verbatim
   (`timeline.structured=false`). Parsing natural-language dates is new intelligence + a fabrication risk
   (guessing the year) — explicitly excluded by the brief.
2. **Multi-constraint extraction from the opening statement.** Only the _answered_ constraint step writes a
   row (+ any conflict/affordability constraints `_detect_constraints` already finds). Splitting "money is
   tight AND energy drained" into two constraint rows needs a new extractor — out of scope.
3. **Persisted `life.motivations` rows.** Exposed via emotional_signals instead (see decision above). No
   parser built; no rows fabricated.
4. **Promoting candidate goals.** Untouched by design — only an explicit user priority confirms one
   objective (relationship_manager.py:307). Candidates stay candidates; future_goal stays future_goal.
5. **`life.risks` from discovery.** Left unwritten — TRUST RULE: risks come from the Recommendation OS.
