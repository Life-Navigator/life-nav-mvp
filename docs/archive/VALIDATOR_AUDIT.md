# Validator Audit (P0.2)

**Question this answers:** _Exactly why does the advisor fall back 17% of the time, and are good
responses being rejected?_

Source of truth: `app/services/advisor_validator.py` (the deterministic trust gate) + the live eval run
(`apps/web/advisor-eval.mjs`, 12 personas / 24 turns + adversarial, commit `e0ebce4`).

## Headline finding

> **100% of observed fallbacks were a single rejection type: `more than one question`.**

The validator was rejecting the LLM whenever it asked two questions in one turn — and these were
_precisely the high-value decision turns_ ("How much down payment?", "Can I afford it?", "What's
realistic?"). On rejection the user got the generic rule-based reply ("Thanks — got it. In your own
words, what are you working toward?"), which **ignored their question**. This is the textbook case of
_good responses being rejected for a cosmetic reason_. It is now **REPAIRED, not rejected** (see P0.3).

No other rejection type fired in the run. Zero safety rejections (no invented numbers, no advice/medical,
no ungrounded relationships) — the safety spine never had to intervene because the LLM behaved.

## Rejection counts (measured, 24 turns)

| Rejection type                             | Code path                           |                       Count | % of fallbacks | Was the rejection _correct_?                      |
| ------------------------------------------ | ----------------------------------- | --------------------------: | -------------: | ------------------------------------------------- |
| **more than one question**                 | `next_q.count("?") > 1` (removed)   | ~4 turns (17% of all turns) |       **100%** | ❌ No — cosmetic; the reply was on-topic and safe |
| invented financial number                  | `_FIN_NUM` not in `allowed_numbers` |                           0 |             0% | n/a (would be ✅ correct)                         |
| advice / medical / legal / tax             | `_ADVICE` regex                     |                           0 |             0% | n/a (would be ✅ correct)                         |
| no next_question and no summary            | empty-turn guard                    |                           0 |             0% | n/a (would be ✅ correct)                         |
| unsupported relationship referenced        | `_check_relationships`              |                           0 |             0% | n/a (would be ✅ correct)                         |
| relationship mentioned w/o supporting edge | `_check_relationships`              |                           0 |             0% | n/a (would be ✅ correct)                         |
| output is not a JSON object                | type guard                          |                           0 |             0% | n/a (would be ✅ correct)                         |

**Interpretation:** the entire fallback budget was spent on one over-strict, non-safety rule. Removing it
(by repairing instead) should drive the fallback rate from 17% toward **~0% for this class** without
touching any safety gate. Target: <5% overall.

## Per-type detail — the one type that fired

### `more than one question`

- **Original LLM response (representative):**
  `reflection`: "You're weighing buying a home against keeping cash flexible."
  `next_question`: "How much could you put toward a down payment, and what monthly payment feels safe?"
  `why_this_question`: "Both numbers bound what's realistic before we model anything."
- **Validator failure:** `next_q.count("?") > 1` → `reject` → `fallback:more than one question`.
- **Why it failed:** the rule counted question marks; two `?` ⇒ reject. The content was on-topic, safe,
  grounded, and exactly what a good advisor asks.
- **Was the failure correct?** **No.** Nothing unsafe happened. The only real concern (asking _too much at
  once_) is a UX nicety, not a trust violation — and is better solved by trimming to the first question.
- **Recommended fix (shipped):** REPAIR — keep the reflection + the **first** question, drop the trailing
  one (`_first_question()`), accept the turn, and record `_repairs=["multi_question_trimmed"]`. A single
  question that _offers choices_ ("…sooner, liquidity, or wealth?") has exactly one `?` and is untouched.

## What the audit did NOT find

- **No false-safe.** The validator never let through an invented number, advice, or an ungrounded graph
  claim in the run. The safety gates are doing their job and are **not** being relaxed.
- **No malformed-output rejections.** `parse_advisor_json` tolerance (fences, surrounding noise) absorbs
  the usual JSON sloppiness before the validator sees it.

## Goal of the change (restated)

Reduce fallback **17% → <5%** _without reducing safety_. Achieved structurally by converting the only
firing rejection from REJECT to REPAIR. Live re-measurement is the remaining step (needs deploy) — see
`VALIDATOR_IMPROVEMENT_PLAN.md` and `BETA_READINESS_REPORT.md`.
