# Advisor P0 Upgrade — Implementation Report

**Sprint:** LifeNavigator Advisor P0 Upgrade — First Implementation Sprint
**Date:** 2026-06-15
**Prompt version:** `advisor-hybrid-2.2.0` → **`advisor-hybrid-2.3.0`**
**Scope rule honored:** No LIOS runtime, no Vertex, no Claude, no new agents, no new persistence/schema. _"Use the existing advisor. Make it excellent."_

---

## What shipped

All five P0 improvements, implemented inside the existing hybrid advisor
(`AdvisorOrchestrator → AdvisorContextBuilder → GeminiAdvisorLLM → advisor_validator → _compose`).
The deterministic trust spine (`validate()`, output JSON schema, HARD RULES, `_compose`) was left
**byte-for-byte unchanged** — every quality change rides on top of the same Compliance gate.

| P0                                    | Change                                                                                                                                                                                                                                                    | Where                                                                                  |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **P0.1 Cross-turn context retention** | Read recent turns from the existing `analytics.advisor_turns` telemetry table (keyed by `conversation_id`, tenant-scoped by `user_id`), feed as `conversation_so_far` + add prior-turn numbers to `allowed_numbers`. No new memory system, no new schema. | `advisor_orchestrator.py` (`_fetch_history`), `advisor_context.py`, `advisor/page.tsx` |
| **P0.2 Reason before asking**         | 8-step internal reasoning sequence (UNDERSTAND→FRAME→OBJECTIVES→CONSTRAINTS→TRADEOFFS→MISSING INFO→CONFIDENCE→BEST NEXT MOVE); steps 1–7 private, only step 8 spoken.                                                                                     | `advisor_llm.py` (system prompt)                                                       |
| **P0.3 Decision framing**             | Dedicated DECISION FRAMING block: name the real decision, the deciding variables, the central tradeoff — then ask the single most decisive missing variable. Frame the decision, never make it.                                                           | `advisor_llm.py`                                                                       |
| **P0.4 Question quality**             | Question-quality ladder (Level 1 intake → Level 4–5 elite, default 4–5); explicit kill of vision-deflection ("what does success look like to you").                                                                                                       | `advisor_llm.py`                                                                       |
| **P0.5 Voice & executive presence**   | VOICE block: vary openings, declarative not tentative, no therapy/motivational/corporate filler, no restating the question.                                                                                                                               | `advisor_llm.py`                                                                       |
| **Resilience (known P0)**             | One retry on transient LLM `None` (502/timeout/truncated JSON) before degrading to the deterministic opener. Retried output still passes `validate()`.                                                                                                    | `advisor_orchestrator.py` (`_enhance`)                                                 |

---

## Code changes (4 files, +109/−41)

### `app/services/advisor_llm.py` (prompt only)

- `ADVISOR_PROMPT_VERSION = "advisor-hybrid-2.3.0"`.
- Replaced the old "YOU drive / DECISION LOOP / USE WHAT THE USER TOLD YOU / QUESTION QUALITY" sections with:
  REASON BEFORE YOU ASK (8 steps), THEN SPEAK (grounded frame + one sharp question), DECISION FRAMING,
  USE WHAT THE USER ALREADY TOLD YOU (references `conversation_so_far` + `numbers_you_may_reference`,
  kills vision-deflection), QUESTION QUALITY (Level 1/2/4–5 ladder), VOICE.
- **Preserved verbatim:** HARD RULES, RELATIONSHIPS, and the output JSON schema → validator + `_compose` unaffected.

### `app/services/advisor_context.py` (P0.1)

- `AdvisorContext` gains `conversation_so_far: list[dict[str,str]]`; exposed in `prompt_dict()`.
- `build()` now accepts `history`; computes `allowed_numbers` over the message **plus prior user messages**
  so the advisor may reflect numbers the user stated earlier turns (validator still rejects anything else).

### `app/services/advisor_orchestrator.py` (P0.1 + resilience)

- New `_fetch_history(ctx, conversation_id)`: reads up to 6 prior turns from `analytics.advisor_turns`
  (oldest-first), tenant-scoped. Returns `[]` on any error — never breaks the turn.
- `_enhance()` accepts and threads `history`; both `converse()` and `converse_stream()` fetch history first.
- **Retry:** when `self._llm.generate()` returns `None`, retry once (`tr["llm_retry"]=True`) before falling back.

### `apps/web/src/app/dashboard/advisor/page.tsx` (P0.1)

- Stable per-session `conversationId` (crypto.randomUUID) sent on both blocking and streaming chat requests,
  so the backend can correlate turns into one conversation.

---

## Trust preservation (the non-negotiable)

- `advisor_validator.validate()` — **unchanged**. Still the deterministic accept/repair/reject Compliance gate.
- Output JSON schema, HARD RULES, `_compose` — **unchanged**.
- `allowed_numbers` _widened only to the user's own prior-turn numbers_ — never to derived/invented figures.
- The retry feeds the retried output back through the same `validate()` — resilience, not a trust bypass.

Measured result: **0% fabricated numbers** across the 16-scenario multi-turn excellence eval (see
`ADVISOR_EVAL_RESULTS.md`).

---

## Tests

- `66 passed` (advisor + orchestrator) after all edits including the retry.
- New params default safely (`history=None`, `conversation_so_far=[]`) → no existing test affected.

## Validation cost note

The harness defines 16 multi-turn scenarios (turn-1 context-rich, turn-2 needs turn-1 memory) and supports
the full 50 via `SAMPLE=`. A 16-scenario sample was run to respect the live `$4/day` Gemini cap; this is
stated honestly here and in `ADVISOR_EVAL_RESULTS.md`. Each scenario is two live turns against Fly.
