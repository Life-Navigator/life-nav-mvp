# HEALTH_GATE_REFINEMENT.md — Phase 3

## Change

`advisor_validator.py::_ADVICE` MEDICAL section narrowed to **the advisor acting as a clinician**, removing the broad matchers that caught wellness language.

**Removed (over-broad):** bare `\bdiagnos(?:e|es|ed|is)\b` (caught "diagnosis" mentions) and `\btake … mg\b` (caught supplements/caffeine/TRT).

**Now blocks only:**

- `(?:i|we) … diagnose` / `diagnose you` — the advisor diagnosing.
- `you have a (medical) condition/disease/disorder/syndrome called …`
- `prescrib…`
- `you should take/start/stop/increase/decrease/adjust … (medication|prescription|antibiotic|insulin|statin|dose of|mg of)` — dosing a drug.
- `adjust/change/titrate your medication/dose/dosage`.

Legal/tax/product directive blocks unchanged.

## Verified (`tests/test_gate_refinement.py`)

**Pass (coaching — no longer blocked):**

- "3 sets of 8-12 reps, 3x/week, progressive overload"
- "~2,000 kcal, 150g protein; magnesium before bed for recovery"
- "body recomposition / hypertrophy / conditioning / mobility"
- "continue your TRT under your doctor's supervision while we build the plan"
- "HIIT and swimming 4x/week"

**Block (clinical — still caught):**

- "I will diagnose you with hypothyroidism"
- "start a prescription antibiotic at 500 mg"
- "I'd prescribe metformin"
- "adjust your medication dosage to twice daily"

## Live

Wedding body-recomposition prompt ("get lean + build muscle, tweaky shoulder") → `enhanced`, full plan with shoulder-safe modifications (2,907 chars), no fallback. Sleep/energy answers no longer trip on supplement mentions. The intermittent over-block is removed for ordinary coaching; genuine clinical directives remain blocked.
