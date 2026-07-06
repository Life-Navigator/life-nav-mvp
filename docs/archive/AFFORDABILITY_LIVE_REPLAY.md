# AFFORDABILITY_LIVE_REPLAY.md — Phase 4 (live prod, partial pass)

Real prod orchestrator (Vertex Gemini 2.5 Pro, WIF), owner user:

| Prompt                               | Before   | After fix                                                          |
| ------------------------------------ | -------- | ------------------------------------------------------------------ |
| How much for closing costs on $500k? | fallback | ✅ **ENHANCED**                                                    |
| $60k down payment vs emergency fund? | fallback | ✅ **ENHANCED**                                                    |
| Can I afford a $500k home with $60k? | fallback | ⚠️ still fallback (loan balance $440k + over-blocked $15k closing) |
| What if I put 20% down on $500k?     | fallback | ⚠️ fallback ($400k loan = derivation chain)                        |
| FHA on $500k?                        | fallback | ⚠️ fallback (stray % artifact)                                     |

**Net:** basic affordability _planning_ (closing, allocation) now passes with benchmark math; the _verdict_ prompt ("can I afford") and multi-step loan-balance prompts stay conservative. Mortgage payment/DTI/tax/verdicts remain blocked (correct). No fabricated number reaches the user; trust intact.

**To fully clear the verdict prompts (next, owner call):** (a) attribute the prohibited-claim check to the specific number (not whole-window) so a valid closing $ isn't blocked by an unrelated "mortgage payment" in the same answer; (b) auto-accept a single grounded±grounded subtraction (loan balance = price − down). Both are bounded + safe; I held off to avoid more deploy cycles without your go.
