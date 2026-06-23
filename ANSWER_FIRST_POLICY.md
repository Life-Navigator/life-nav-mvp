# ANSWER_FIRST_POLICY.md — Phase 4

## Rule

If sufficient information already exists: **ANSWER.** Don't interrogate, delay, or ask questions first. A missing detail is a reason to **state an assumption and proceed**, then optionally ask ONE refining question — not a reason to stall.

> Bad: "What does your diet look like?"
> Good: "Here's the plan I'd start with; we can tune it once I know X."

## Where it's enforced (no architecture change)

1. **Prompt directive** (`advisor_llm.py` ADVISOR_SYSTEM, top): "ANSWER FIRST, refine second… For a concrete request, deliver the full plan/recommendation, THEN — only if it would genuinely sharpen the advice — ask ONE refining question."
2. **Section 6 optional** (prior sprint): "BEST NEXT QUESTION (only when you need it)… you may deliver the answer WITHOUT a trailing question."
3. **Validator** (`advisor_validator.py:187`, prior sprint): a turn with a substantive `recommendation` no longer requires a `next_question` — answer-only turns are valid.
4. **Required-fields relaxed**: `next_question`/`why_this_question` are populated only when a question is warranted.

## Net behavior

The advisor now leads with the answer/plan/recommendation and treats follow-ups as _refinement after value_, not _gatekeeping before value_. The deterministic completion flag no longer forces a question on every turn.

Validation: ADVISOR_BEHAVIOR_VALIDATION.md + CRITICAL_CONVERSATION_REPLAY.md.
