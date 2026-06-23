# FINANCE_GATE_TEST_REPORT.md — Phase 2

## Unit tests (`tests/test_gate_refinement.py`) — 11 pass

| Case                                                                       | Expected                     | Result           |
| -------------------------------------------------------------------------- | ---------------------------- | ---------------- |
| "Your net worth is $1,200,000"                                             | block (Tier 1 fabricated)    | ✅ blocked       |
| "Your liquid assets total about $150,000" (hedged)                         | block (hedge ≠ excuse)       | ✅ blocked       |
| "Your retirement success probability is 85%"                               | block (fabricated readiness) | ✅ blocked       |
| "Can you afford the $450,000 home?" (invented price)                       | block                        | ✅ blocked       |
| "A conventional 20% down payment to avoid PMI is $100,000" (grounded 500k) | allow (Tier 2/3)             | ✅ allowed       |
| "Closing costs are often 2-5% and a typical 401k match is ~4%"             | allow (Tier 2)               | ✅ allowed       |
| "A common rule of thumb is a 3-6 month emergency fund"                     | allow (Tier 2)               | ✅ allowed       |
| "An estimated mortgage payment would be about $2,400"                      | allow (Tier 3 labeled)       | ✅ allowed       |
| "For example, a $300,000 mortgage … scenario"                              | allow (Tier 3)               | ✅ allowed       |
| Existing wrong-derivation test ("about $150,000", true=135k)               | block                        | ✅ still blocked |
| Existing invented-number / $90k / $450k tests                              | block                        | ✅ still blocked |

Full suite: **631 pass** (no regressions).

## Live test (Vertex gemini-2.5-pro) — the home-affordability prompt

**Prompt:** "I make $140k and have $60k saved. Can I afford a $500k house?"

- **Before refinement:** `fallback:invented numbers ['100000','5']` → generic deterministic reply.
- **After refinement:** `llm_status=enhanced`, answer-first. Delivered verbatim:
  > "On these numbers, buying a $500,000 house looks like a stretch. Your $60,000 in savings … falls short of the $100,000 needed for a traditional 20% down payment … closing costs (which can be 2-5%) … A homeowner without a 3-6 month emergency fund is in a precarious position…"

The benchmark/scenario numbers (`$100,000` 20%-down, `2-5%`, `3-6 months`) now survive; the user's real `$60,000` is grounded; no fabricated personal figure is asserted. **Finance quality: fixed.**

## Residual

Dollar-dense affordability answers depend on the model labeling scenario figures with a recognized benchmark word. Tuning added `conventional/traditional/standard/typical/recommended/…`; a truly novel phrasing could still trip the gate. The deeper fix (out of scope — no architecture change) is to let `verify_derivations` accept benchmark percentages so "20% of $500k = $100k" verifies as math rather than relying on a label.
