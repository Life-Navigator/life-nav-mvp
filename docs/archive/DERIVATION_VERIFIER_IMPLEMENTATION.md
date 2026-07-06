# DERIVATION_VERIFIER_IMPLEMENTATION.md — Phase 3

## Changes (no architecture change)

### `app/services/advisor_math.py` — `verify_derivations` → 3-tuple `(strict, scenario, kept)`

- Per derivation, operands are classed: **user** (traces to an `allowed_numbers` value, k/M/% expanded), **unit** ({12,52,365,100}), or **other**.
- **strict** = no "other" operands → math verified → value bypasses every gate (it's the user's own math).
- **scenario** = has ≥1 user base AND every "other" operand is a benchmark factor `0 < n ≤ 100` AND a `_SCENARIO_LABEL` is present (on label or value) → math verified → value allowed in prose **except** a possessive personal claim.
- Rejected otherwise (wrong math, no base, factor > 100, missing label). No `eval` — restricted AST over `+ - * /`.

### `app/services/advisor_validator.py`

- `_fabricated_personal_numbers(text, allowed, scenario)`: personal-holding claim → block (scenario value does NOT excuse it); else scenario value → allow; else unlabeled `$` without a benchmark marker → block.
- `_MONEY_CUE` += `tax/taxes/tax bill` so "your tax bill will be $X" is a personal claim.
- Account-name digits (`401(k)`, `403(b)`) skipped — no longer parsed as numbers.
- `validate()` now unions only **strict** into `allowed`; passes **scenario** separately.

### `app/services/advisor_llm.py` (prompt — policy)

NUMBERS §4–5: label scenario figures; record every computed dollar in `derivations`; phrase benchmark results as STANDALONE illustrations, never glued to a possessive holding.

### `app/services/advisor_orchestrator.py` (repair note)

On a number rejection, the repair-retry now instructs the model to (a) add a scenario derivation, (b) rephrase as a standalone labeled illustration, or (c) go qualitative.

## What was deliberately NOT done

- No broad "allow any percentage" regex; benchmark operands are bounded (≤100) and require a real base + label.
- Hedge words alone do not bypass the gate (the possessive-claim block runs first).
- The number gate was not removed or weakened; the trust floor (no fabricated personal figures, no wrong math) is intact and test-proven.
