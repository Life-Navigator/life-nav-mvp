# WORKOUT_PROMPT_REPLAY.md

The original failing scenario, replayed live on Vertex Gemini 2.5 Pro through the real advisor pipeline (prompt → validator → compose).

## Prompt

> "Build me a workout and nutrition plan to lose 20 pounds. I have a knee issue."

## Result: **PASS — concrete plan returned**

- `provider=vertex_gemini`, `model=gemini-2.5-pro`, `llm_status=enhanced` (NOT fallback), 6,534 tokens.
- The scoped number gate let the coaching numbers through (the whole point of the prior fix): "500 calories/day deficit", "~1 pound/week", "3x per week", "1-2 fists of vegetables", knee-safe movements — none of these are nuked anymore.

## Actual composed answer (excerpt, verbatim)

> The task is to design a workout and nutrition plan to achieve a 20-pound weight loss, with the critical constraint of accommodating a knee issue. The key drivers are creating a sustainable caloric deficit and selecting exercises that build strength and burn calories without aggravating your knee.
>
> **Nutrition Framework (The 80%):** … a deficit of around **500 calories per day** … about **1 pound of loss per week** … focus on protein and fiber … a palm-sized portion of lean protein … 1-2 fists of vegetables …
>
> **Workout Framework (The 20%):** … **Strength Training (3x per week)** … knee-friendly movements … Goblet Squats (to a pain-free depth), Romanian Deadlifts, Glute Bridges …

## Before vs after

- **Before** (gemini-2.5-flash + restrictive number gate + forced decision-frame): the request was reshaped into a decision memo, and rep/calorie numbers tripped the number gate → discarded to a generic fallback. No usable plan.
- **After** (Vertex gemini-2.5-pro + personal-$-only gate + optional question): a concrete, knee-aware plan with real coaching numbers, delivered as an answer — not an interrogation. The closing question is now optional and advancing, not mandatory.

## Verdict

The headline failure (workout/nutrition gave no plan) is **FIXED** and verified live on the key-free Vertex path.
