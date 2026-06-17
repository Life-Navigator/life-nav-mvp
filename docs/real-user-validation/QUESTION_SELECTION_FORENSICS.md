# Question Selection Forensics

**Date:** 2026-06-16 · How the next question is chosen (`RelationshipManager.state()`).

## Decision rule (priority step)

```
narrative = dominant_narrative(candidate_goals, narrative_text)
competing = distinct-domain stated goals (concrete goals preferred over context/feelings)
if narrative ∈ {family_foundation, career_acceleration, legacy_entrepreneurship} and competing ≥ 2:
    → concrete TRADEOFF: "…{goal A} and {goal B}… which would be easiest to postpone?"
elif narrative has a warm opener (financial_stabilization, health_life_balance, …):
    → NARRATIVE OPENER (acknowledges the situation, asks a focused question)
else:
    → generic priority question (fallback)
```

Inputs: narrative (dominant_narrative), goals (candidate_goals, filtered to concrete pursuits), conflict (competing-domain count), constraint/emotional (signals via the narrative). Confidence is NOT an input to question selection.

## Per-user (competing questions considered → why the winner)

- **U1/U2 (active multi-pursuit):** tradeoff chosen over the generic "which matters most?" because there are ≥2 concrete competing goals — the tradeoff is more useful and human. Concrete-goal filter ensures it names "credit card / wedding", not "I am…" fragments.
- **U3 (burnout):** the tradeoff was REJECTED (it would read "would you postpone your children?"); the warm balance opener wins because the narrative is health/life-balance, not an ambition juggling act.
- **U4 (career):** career opener (role/credential/network) — narrative-specific, more directive than a generic priority ask.
- **U5 (crisis):** warm stabilization opener wins over the generic question — acknowledges distress and focuses on the urgent pressure.

## Forensic guarantee

No question is selected from the highest-confidence objective, the persona seed, or an ontology slot. Every question originates from the narrative → conflict/constraint → priority chain. Tests: `test_crisis_gets_warm_stabilization_question_not_tradeoff`, `test_burnout_gets_balance_question_not_postpone_children`, `test_multipursuit_gets_concrete_tradeoff`, `test_discovery_question_surfaces_tradeoff_when_goals_compete`.
