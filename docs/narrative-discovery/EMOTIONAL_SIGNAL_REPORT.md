# Emotional Signal Layer (Phase 7)

**Date:** 2026-06-16 · Read the person's state, not just their goals.

## `emotional_signals(text)` (`app/services/life_discovery.py`)

Deterministic keyword signals from the user's own words:

- **distress** (overwhelmed/worried/barely/under stress), **money_stress** (debt/losing my apartment/no savings),
- **burnout** (constantly working/missing important years/travel frequently/not sure pushing harder),
- **money_fine** (financially fine/comp is good), **ambition** (director/promotion/startup/MBA),
- **family**, **family_deprioritized** (don't have children/prioritizing my career), **urgency** (in a year/this year/soon).

## Effect (the persona-D fix)

Distress + money_stress ⇒ dominant narrative = **financial stabilization** immediately (was: no objective / None). Burnout ⇒ **health & life balance** even when money is fine. family_deprioritized ⇒ career path not reframed to family.

## Validation

`test_emotional_signals_detects_distress_and_burnout`; persona D now yields `financial_stabilization` (was None) — `test_dominant_narrative_per_persona[D_stress]`, end-to-end tests.

## Honest scope

Keyword-based, not a learned sentiment model — appropriate for LLM-free discovery and sufficient to drive the stabilize/balance ordering. Easy to extend.
