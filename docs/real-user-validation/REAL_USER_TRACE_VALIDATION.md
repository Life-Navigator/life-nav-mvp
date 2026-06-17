# Real-User Trace Validation

**Date:** 2026-06-16 · Each user traced through the full pipeline (real code, `FakeSupabase`, no network).

## Pipeline traced

`User input → analyze_statement() → candidate goals (per-domain) → goal_portfolio → dominant_narrative() (+ emotional_signals) → competing-goal/conflict detection → question selection`.

## User 1 — Family Builder

- **Candidate goals / domains:** finance (credit card, down payment), family (wedding, house, start a family), health (fitness), career (promotion@NVIDIA), education (Masters AI) → 5 domains.
- **Emotional signals:** ambition, family, urgency ("in a year").
- **Dominant narrative:** `family_foundation` — "Building a family foundation while balancing career, education, finance, health over the next year or two."
- **Question (concrete tradeoff):** "You've got several big goals in motion — Pay off my credit card and For my wedding among them. If one needed to move more slowly so the others could succeed, which would be easiest to postpone?"
- **Why:** active multi-pursuit + ≥2 distinct goals → tradeoff framed from the user's own goals (not the top objective).

## User 2 — Founder / Legacy

- **Domains:** career, education (law school), family, health, finance + legacy signal.
- **Signals:** legacy ("legacy", "build something meaningful", "multiple businesses", "things that matter"), family.
- **Dominant narrative:** `legacy_entrepreneurship` — "Building meaningful companies and a lasting legacy for your family — with career and finances as the means, not the destination." (NOT financial independence; NOT career.)
- **Question:** concrete tradeoff among his ventures/efforts.

## User 3 — Burnout Executive

- **Domains:** health, family, finance (money_fine).
- **Signals:** burnout ("exhausted", "missing time"), money_fine ("make good money").
- **Dominant narrative:** `health_life_balance`.
- **Question (warm, not tradeoff):** "It sounds like your health and time with the people you love matter most right now. If we protected one of those first, which would make the biggest difference?" — deliberately NOT "would you postpone your children?".

## User 4 — Career Maximizer

- **Domains:** career, education; family deprioritized (no kids, prioritizing career).
- **Signals:** ambition.
- **Dominant narrative:** `career_acceleration`.
- **Question:** "It sounds like career momentum is the priority right now. Which move feels most likely to accelerate you — the role, the credential, or the network?"

## User 5 — Financial Crisis

- **Domains:** finance.
- **Signals:** distress ("overwhelmed", "worried"), money_stress ("debt", "losing my apartment").
- **Dominant narrative:** `financial_stabilization` (stabilize before optimize — previously this returned _no objective_).
- **Question (warm):** "It sounds like the most pressing thing is getting back to stable ground. What feels like the most urgent pressure right now — the debt, keeping your housing secure, or something else?"

## Notes (honest)

- Goal portfolio keeps every stated goal (≥2). Conflicts are domain-distinctness + the `_CONFLICTS` map (heuristic). Constraints come from the constraint step + emotional signals (severity not quantified). The single `primary_objective` can lag the narrative and is demoted below it.
