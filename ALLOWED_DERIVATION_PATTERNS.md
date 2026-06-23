# ALLOWED_DERIVATION_PATTERNS.md — Phase 2

A derivation is `{label, expression, value}`. The verifier (`advisor_math.verify_derivations`) classifies each into one of two tiers, or rejects it.

## STRICT tier (derived from the user's OWN numbers) — bypasses every check

Operands are all user numbers + unit constants {12, 52, 365, 100}; math verified.

- `95000 + 40000 = 135000` ("your liquid assets") — sum of stated amounts.
- `40000 / 5200 ≈ 8` — runway in months from stated figures.

## SCENARIO tier (benchmark factor × a stated/scenario base) — allowed except in a possessive personal claim

Requires: ≥1 user-number base · all other operands are benchmark-scale (0 < n ≤ 100: a percentage or a month/year multiplier) · result verified · a scenario/estimate **label** (`scenario`/`estimate`/`illustration`/`example` or a recognized calc: `down payment`, `closing`, `reserve`, `emergency fund`, `withdrawal`, `savings target`, `months of`, `% of`, `~`).

| Should PASS                            | Expression          | Label                           |
| -------------------------------------- | ------------------- | ------------------------------- |
| 20% down on $500,000 = $100,000        | `500000 * 20 / 100` | "20% down payment scenario"     |
| 3% of $500,000 = $15,000 closing       | `500000 * 3 / 100`  | "estimated closing costs"       |
| 2–5% closing = $10,000–$25,000         | two derivations     | "estimated closing costs"       |
| 6-month reserve at $8,000/mo = $48,000 | `8000 * 6`          | "6-month emergency reserve"     |
| 15% of $140,000 = $21,000/yr           | `140000 * 15 / 100` | "15% retirement savings target" |

## Should FAIL (never verifiable as a scenario)

| Example                                  | Why it fails                                                                                               |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| "Your mortgage payment will be $3,412"   | needs amortization (rate+term), not a simple % of a user number; and possessive → blocked                  |
| "Your retirement success rate is 91%"    | no arithmetic from user numbers; possessive                                                                |
| "Your net worth is $1.4M"                | no derivation; possessive personal claim                                                                   |
| "Your tax bill will be $18,200"          | even if a `*13/100` derivation is faked, it's a possessive claim → blocked regardless of the scenario tier |
| `500000 * 200/100` (factor > 100)        | non-benchmark factor → not a scenario                                                                      |
| `1000000 * 20/100` with no user base     | no real base → fabricated                                                                                  |
| `500000 * 20/100 = 90000`                | math wrong → rejected                                                                                      |
| benchmark derivation with label "result" | no scenario/estimate label → rejected                                                                      |

## Guardrails preserved

- A scenario value is allowed in **neutral** prose only; in a possessive "your <holding> is $X" it is still blocked.
- Hedge words alone never bypass a possessive personal claim (Tier-1 block runs first).
- Wrong math is always rejected (no eval; restricted AST).
