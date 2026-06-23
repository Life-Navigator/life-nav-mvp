# FINANCE_GATE_REFINEMENT.md — Phase 2

## The three-tier number policy (implemented)

`advisor_validator.py::_fabricated_personal_numbers` + `_BENCHMARK_MARK`.

| Tier                                     | What                                                                  | Rule                                                                                                                                                        | Example                                                                                      |
| ---------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Tier 1 — Proven personal numbers**     | The user's actual net worth / savings / balance / payment / readiness | Allowed ONLY when grounded (user-stated or a verified derivation, i.e. in `allowed_numbers`). **A hedge word does NOT excuse a fabricated personal total.** | "your savings of $60,000" (they said it) ✅ ; "your net worth is $1.2M" (they didn't) ❌     |
| **Tier 2 — Industry benchmarks**         | Conventional rules of thumb                                           | **Always allowed**                                                                                                                                          | "20% down avoids PMI", "closing costs 2-5%", "3-6 month emergency fund", "401k match ~4%" ✅ |
| **Tier 3 — Advisor scenarios/estimates** | A computed illustration                                               | Allowed when **labeled** (about / roughly / estimated / for example / scenario / ~ / conventional / traditional / standard / typical)                       | "a 20% down payment would be about $100,000", "an estimated payment of ~$2,400" ✅           |

## How it decides (per financial-looking number)

1. Grounded (in `allowed_numbers`) → **pass** (Tier 1 satisfied).
2. Else, **personal-holding claim?** (2nd-person + a money-cue noun within a _tight_ 44-char window) → **block** (fabricated personal figure; hedge words don't excuse).
3. Else, **benchmark/estimate marker** in the wider 70-char window → **pass** (Tier 2/3).
4. Else, an unlabeled `$`-amount not tied to the user's state (e.g. an invented price) → **block**.
5. Else (general/coaching number) → **pass**.

The tight personal-holding window is the key refinement: a labeled scenario figure ("$15k in closing costs") is no longer mis-read as the user's holding just because "your savings" appears elsewhere in the sentence.

## Still hard-blocked (trust spine intact)

- Fabricated personal net worth, mortgage payment, retirement success probability, readiness score.
- Invented prices/figures the user never gave and that aren't benchmark-labeled.
- Wrong derivations (the `verify_derivations` math check is unchanged — a hedge word can't smuggle a wrong personal total through; verified by test).

## Prompt change (policy, paired with the gate)

`ADVISOR_SYSTEM` NUMBERS §3–4: benchmarks are encouraged; scenario $ figures must be LABELED; never state the user's actual current figure as a specific number unless grounded.
