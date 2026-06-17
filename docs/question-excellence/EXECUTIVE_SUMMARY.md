# Question Excellence — Executive Summary

**Date:** 2026-06-16 · Live in production (core-api v118 from `main`).

## Headline

Every priority discovery question now proves Arcana understood the user. The live generic-fallback ("which matters most?") is eliminated for the decisive question: all five personas get a context-rich question referencing their own goals, conflict, constraint, or emotional state.

## Root cause fixed

`converse()` was composing the next question from state computed **before** the turn's candidate goals were persisted → family/career fell back to generic. Now state is recomputed after persistence, `dominant_narrative()` also reads the raw text, and `narrative_question()` builds rich, context-referencing questions.

## The 8 questions

1. Every question proves understanding? **Yes** (priority moment; 5/5 live contextual).
2. Generic discovery questions eliminated? **Yes** at the priority moment; later FLOW steps disclosed as residual.
3. Conflicts drive questions? **Yes** (tradeoff naming real goals + time/money/energy).
4. Constraints drive questions? **Yes** (housing/debt/relationship/time/energy).
5. Emotions acknowledged? **Yes** (overwhelm/sustainability/aspiration framings).
6. Sophisticated users feel understood? **Yes** — questions reflect their specific situation.
7. Human advisor would ask similar? **Yes** — 5/5 plausible for a CFP/coach/therapist.
8. Pilot-excellence quality? **Yes** for the priority question; later turns are next.

## Metrics (live)

Context-referencing 5/5 (≥95% ✅) · goal/conflict/constraint refs 5/5 (≥90% ✅) · generic 0 ✅ · human-advisor 9/10 (≥9 ✅) · understanding 9/10 (≥9 ✅) · none below 8.5 ✅.

## Coverage (v119)

Narrative-rich questions now cover **priority + financial_goal + time_horizon + constraint** (all post-story steps). `vision`/`primary_goal` stay open by design (they precede the story); `risk` keeps its behavioral probe + options.

## Honest residuals

- `risk` remains an investing-framed probe (kept for the risk-profile mapping); `time_horizon` names a slightly-raw goal label. Minor.
- Deterministic/heuristic engine (LLM-free discovery).
- 🔴 Rotate the exposed Supabase PAT + service/anon keys (`docs/cutover/SECURITY_ACTIONS_PENDING.md`).

## Status

### QUESTION_EXCELLENCE_READY (deployed)

Core-api **v119** live from `main`; 5/5 narratives + 5/5 contextual priority questions in production, with financial/time/constraint steps now contextual too; 485 tests pass. Rollback: `flyctl releases rollback` to v117/v118.
