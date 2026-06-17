# Discovery Priority Engine (Phase 1)

**Date:** 2026-06-16 · Branch `platform/discovery-intelligence`. Replaces confidence-only ranking with a weighted, person-first score. Deploy gated on approval.

## Before → After

- **Before:** `primary = max(objectives, key=confidence)` (`life_discovery.py:488`). One signal — confidence — decided the focus. Persona-seeded objectives with high seeded confidence always won.
- **After:** `rank_objectives()` / `score_objective()` (`life_discovery.py`, new) — confidence is one of **six** weighted signals, and unconfirmed persona seeds are penalized and excluded from primary.

## The score

```
score = 3.0·user_priority      # 1 if this root == the user's stated "matters most", else 0
      + 1.5·horizon_urgency    # deadline words in the goal text (wedding, months, this year…) → 0..1
      + 1.2·life_significance  # terminal life goals > instrumental means (table below)
      + 1.0·recency            # newer updated_at (ties = equal; no position artifact)
      + 0.8·dependency_impact  # breadth of cross-domain dependencies the objective unlocks (0..1)
      + 0.6·confidence         # the old sole signal, now the LEAST weighted
score ·= 0.15  if the objective is unconfirmed (persona-seeded candidate)   # candidate protection
```

### Life-significance weights (`_ROOT_SIGNIFICANCE`)

| Root                   | Weight | Why                                                        |
| ---------------------- | ------ | ---------------------------------------------------------- |
| family_stability       | 1.00   | terminal — what people actually want                       |
| homeownership          | 0.95   | terminal                                                   |
| health_longevity       | 0.90   | terminal                                                   |
| legacy                 | 0.70   | terminal, longer-horizon                                   |
| career_growth          | 0.65   | **instrumental** (a means)                                 |
| education_advancement  | 0.60   | **instrumental**                                           |
| financial_independence | 0.45   | **instrumental** — money is the spine, not the destination |

**Design principle:** terminal life goals (family/home/health) lead on significance; instrumental goals (career/education/finance) lead only when the user **prioritizes** them or they're **urgent**. This is why a persona's "financial independence" no longer hijacks the conversation, and why "promotion" becomes primary when the user says it matters (not by default).

## Where it's used

- `snapshot()` — primary = top **confirmed** objective by score (None if none confirmed); candidates surfaced separately.
- `objectives_plan()` — `priority_rank` is now the weighted-score rank, not confidence rank.

## Tunability & honesty

- Weights are module-level constants (`_W_PRIORITY … _W_CONF`), easy to tune. They encode a deliberate stance (priority/urgency/significance over confidence), validated by tests.
- `horizon_urgency` and `life_significance` are **heuristics** (keyword + root table), not learned — appropriate for deterministic, LLM-free discovery. Documented as such.

## Tests

`test_discovery_intelligence.py`: `test_user_priority_outranks_persona_goal`, `test_explicit_priority_wins_even_at_lower_confidence`, `test_terminal_life_goal_outranks_finance_on_significance` (family/home/health), `test_instrumental_goal_leads_when_user_prioritizes_it` (career/education), `test_wedding_urgency_lifts_family_to_primary`, `test_unconfirmed_persona_goal_is_penalized`. All pass.
