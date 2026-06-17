# Discovery Selection Policy (Phase 5)

**Date:** 2026-06-16 · Question selection optimizes understanding, not ontology completion.

## Intended priority order

1. **Clarify user priorities** (when several goals compete)
2. **Resolve conflicts / tradeoffs** (cross-domain competition for time/money/energy)
3. **Identify constraints**
4. **Understand motivations**
5. **Discover timeline**
6. **Expand ontology** (last)

## What changed

`RelationshipManager.state()` no longer just returns the next fixed FLOW step verbatim. When the user has **≥2 competing stated goals** (derived from their own `candidate_goals`, not from the highest-confidence objective), the `priority` step is re-framed into a concrete **tradeoff/postpone** question:

> "You've got several big goals in motion — _{goal A}_ and _{goal B}_ among them. If one needed to move more slowly so the others could succeed, which would be easiest for you to postpone?"

- The competing set comes from `_competing_goal_labels()` (distinct domains across the user's stated goals) — i.e. the **person's narrative**, never the persona seed.
- `state()` also returns `competing_goals` so the UI/advisor can show the real tradeoff.
- The `priority` answer is captured (Phase 2) and re-ranks objectives (Phase 1).

## What did NOT change (deliberately, to limit risk)

- The underlying FLOW steps and the `answer()` machinery are unchanged in shape; the tradeoff question is delivered **through** the existing `priority` (`kind="context"`) step, so it flows through the validated handler — no new dynamic-question plumbing, no risk to resume/persistence.
- Timeline/finance/risk/constraint steps remain available; they're simply no longer allowed to lead when a priority/tradeoff is the more human next move.

## Net effect vs the audit

Before: question selection was **fixed FLOW order + presence backstops**, anchored on the max-confidence (often persona) objective. After: when goals compete, discovery asks the **user's tradeoff** first, framed from the user's own goals.

## Tests

`test_discovery_question_surfaces_tradeoff_when_goals_compete`, `test_validation_example_family_not_financial_independence` (next question contains "postpone", not "financial independence").

## File

`apps/lifenavigator-core-api/app/services/relationship_manager.py` (`state()`, `_competing_goal_labels()`).
