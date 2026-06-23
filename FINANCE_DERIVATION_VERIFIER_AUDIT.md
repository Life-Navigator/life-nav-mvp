# FINANCE_DERIVATION_VERIFIER_AUDIT.md — Phase 1

## The pipeline (file:line)

`advisor_validator.validate()` → number gate:

1. `verify_derivations(derivations, allowed_numbers)` (`advisor_math.py`) — checks the model's structured `derivations`.
2. `allowed = allowed_numbers | strict_verified`.
3. `_fabricated_personal_numbers(visible, allowed, scenario_verified)` (`advisor_validator.py`) — scans prose for financial-looking numbers (`_FIN_NUM` = `$…`, `…%`, or `\d{3,}`) and returns the blocked ones.
4. Any blocked number → `validate` fails → orchestrator repair-retry (`_is_repairable`) → else deterministic fallback.

## What passed / blocked BEFORE this sprint

- **Passed:** the user's own numbers; derivations whose every operand traced to a user number + the unit constants {12,52,365,100}; (after the prior sprint) benchmark/scenario numbers carrying a hedge word.
- **Blocked (the bottleneck):** a derivation operand that was a **benchmark** (e.g. `20` in `500000*20/100`) was NOT a user number and NOT a unit constant → the whole derivation was rejected → the computed `$100,000` wasn't allowed → if the prose cited it, the turn fell back.

## Why dollar-dense home-affordability still failed

Two compounding causes (both verified live):

1. **No benchmark operand support** — `20`, `3`, `6`, `15` couldn't appear in a verified derivation, so "20% of $500k = $100k" had no path to verification.
2. **Possessive adjacency** — the model writes computed figures glued to the user's stated holding ("your $140k salary, that's $21,000"), so the personal-holding detector (correctly) treated the _computed_ figure as a personal claim.
3. **Account-name false positive** — `401(k)` was parsed as the number `401`.

→ Fixes in DERIVATION_VERIFIER_IMPLEMENTATION.md + ALLOWED_DERIVATION_PATTERNS.md.
