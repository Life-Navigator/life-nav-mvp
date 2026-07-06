# Validator Improvement Plan (P0.3)

**Rule:** do not weaken safety. No fabricated facts, risks, goals, recommendations, or unsupported
financial claims may pass. _Allow richer behavior_ where the rule was cosmetic, not protective.

Every rule in `app/services/advisor_validator.py` is classified below: **Safe / Too Strict / Needs
Rewrite / Dead Code / Unused**, with the action taken.

## Rule classification

| #   | Rule                                          | Code                                               | Class                  | Action                                                                                                            |
| --- | --------------------------------------------- | -------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1   | Output must be a JSON object                  | `not isinstance(result, dict)` → reject            | **Safe**               | Keep — malformed output must fall back.                                                                           |
| 2   | No advice / medical / legal / tax             | `_ADVICE` regex → reject                           | **Safe**               | Keep unchanged. Core safety; recommendations come from the rec engine, not the advisor.                           |
| 3   | No invented financial numbers                 | `_FIN_NUM` ∉ `allowed_numbers` → reject            | **Safe**               | Keep unchanged. Anti-fabrication spine.                                                                           |
| 4   | Must ask a question or summarize              | `not next_q and not summary` → reject              | **Safe**               | Keep — an empty turn is useless; fallback is correct.                                                             |
| 5   | **Multiple questions**                        | `next_q.count("?") > 1` → reject                   | **Too Strict** → fixed | **Rewritten as REPAIR.** Trim to the first question, accept, tag `multi_question_trimmed`. Was 100% of fallbacks. |
| 6   | Cited relationship must be a real edge        | `_check_relationships` (invalid citation) → reject | **Safe**               | Keep. GraphRAG citation contract ("no cited edge ⇒ no claim").                                                    |
| 7   | Relationship asserted ⇒ needs supporting edge | `_RELATION` + `_check_relationships` → reject      | **Safe**               | Keep. Prevents invented graph reasoning.                                                                          |
| R1  | Force `should_persist = False`                | accept-path repair                                 | **Safe**               | Keep. The LLM never persists; persistence is deterministic.                                                       |
| R2  | Drop rejected candidate goals                 | accept-path repair                                 | **Safe**               | Keep. Never resurrect a goal the user declined.                                                                   |
| R3  | Facts must be `source == "user_message"`      | accept-path repair                                 | **Safe**               | Keep. Drops fabricated-source facts; categories stay separate.                                                    |
| R4  | Keep only valid relationship citations        | accept-path repair                                 | **Safe**               | Keep. Strips unsupported citations even on accept.                                                                |

**Dead Code / Unused:** none found. Every regex (`_RELATION`, `_ADVICE`, `_FIN_NUM`) and helper
(`_pair_supported`, `_financial_numbers`, `_norm`) is on a live path.

## The one change (shipped)

**Rule 5: REJECT → REPAIR.** Diff in `advisor_validator.py`:

- Removed: `if next_q.count("?") > 1: reasons.append("more than one question")` (the reject).
- Added helper `_first_question(text)` — returns text up to and including the **first** `?`.
- Added accept-path repair:
  ```python
  if next_q.count("?") > 1:
      trimmed = _first_question(next_q)
      if trimmed and trimmed != next_q:
          safe["next_question"] = trimmed
          repairs.append("multi_question_trimmed")
  safe["_repairs"] = repairs
  ```

**Why this is safe:** trimming removes content, never adds it. The kept first question is the LLM's own
words, already passed every safety gate (advice/numbers/relationships are checked over the _whole_ visible
text _before_ the repair). A single choice-question ("a, b, or c?") has one `?` and is left untouched.

## Tests added (`tests/test_advisor_hybrid.py`)

- `test_validator_repairs_multiple_questions_instead_of_rejecting` — multi-question now `ok=True`,
  `next_question` trimmed to the first, `_repairs == ["multi_question_trimmed"]`.
- `test_validator_keeps_single_choice_question_untouched` — one-`?` choice question passes unchanged, no
  spurious repair.
- `test_gemini_advisor_llm_captures_token_usage` — telemetry plumbing (P0.1).
- `test_orchestrator_trace_mode_returns_diagnostics` — trace gate (P0.5).

All 397 backend tests pass (`.venv/bin/pytest`).

## Safety regression guard

The existing safety tests remain and still pass unchanged:
`test_validator_rejects_invented_financial_number`, `test_validator_rejects_recommendation_language`,
`test_validator_rejects_medical_advice`, `test_validator_drops_rejected_goal_and_nonuser_facts`,
`test_validator_accepts_clean_output_and_forces_no_persist`. No safety gate was modified.

## Remaining (gated on deploy)

Re-run `apps/web/advisor-eval.mjs` against the deployed backend and confirm the live fallback rate is
**<5%** with the rejection-type histogram now empty for `more than one question`. Tracked in
`BETA_READINESS_REPORT.md`.
