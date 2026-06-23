# HEALTH_POLICY_AUDIT.md — Phase 3

Three layers gate health. Audited for over-blocking.

| Layer                                                                                         | Role                                                                                              | Finding                    |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------- |
| **Urgent-care net** (`advisor_orchestrator.py:_health_safety_check` → `detect_health_urgent`) | Short-circuits true emergencies (chest pain etc.) before the LLM                                  | ✅ Correct — keep          |
| **System prompt** (`advisor_llm.py` ADVICE rules)                                             | Already ALLOWS fitness/nutrition/recovery coaching incl. injury modifications + TRT-with-provider | ✅ Correct after V4 — keep |
| **`_ADVICE` regex** (`advisor_validator.py`)                                                  | The over-blocker                                                                                  | ❌ Was too broad           |

## What over-blocked (before)

The medical regex contained `\bdiagnos(?:e|es|ed|is)\b` (matches a benign "diagnosis" mention) and `\btake\b[^.?!]{0,15}\bmg\b` (matches "take 300mg magnesium", caffeine, creatine, TRT). A sleep/energy answer mentioning a supplement dose tripped it → the whole wellness reply was discarded. Confirmed live: the same prompt fell back on one generation and passed on another (model variance against an over-broad regex).

## What must stay blocked

Diagnosis, prescriptions, medication dosing, treatment plans, interpreting labs/imaging. These are clinical acts the advisor must defer to a licensed professional.

## What must pass (per mission)

Workout plans, nutrition plans, body recomposition, hypertrophy, conditioning, martial arts, swimming, HIIT, mobility, recovery, and TRT discussions under provider supervision.

→ Refinement implemented in HEALTH_GATE_REFINEMENT.md.
