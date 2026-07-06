# FINANCE_REPAIR_LOOP_VALIDATION.md — Phase 6

Live prod (Vertex Gemini 2.5 Pro), supervised loop:

- **"Can I afford a $500,000 home with $60,000 saved?"** → **ENHANCED** (59s, self-repaired). Previously: consistent `fallback:invented numbers`. The loop flagged the un-computable monthly payment + unlabeled down-payment and the model reframed → passed. **This is the headline fix.**
- Unit tests (test_affordability_gate / test_supervision): 20% down on $500k=$100k PASSES; 2-5% closing PASSES; 3.5% FHA (when FHA) PASSES; 6-month reserve PASSES; 15% savings PASSES.
- Still blocked (repaired/removed, never shown as fact): fabricated **monthly payment** (needs rate+term), **DTI**, **tax bill**, arbitrary % (27%), wrong math, possessive net worth/balance.

Benchmark/scenario math now survives via auto-accept OR repair-to-label; fabricated personal finance stays blocked. Trust intact.
