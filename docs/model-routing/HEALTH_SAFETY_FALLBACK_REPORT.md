# Health Safety Fallback Report

**Status: IMPLEMENTED, DEFAULT-ON, DEPLOYED, VERIFIED LIVE.** Fixes the observed Gemini Pro chest-pain failure
(it fell back to a generic life-vision prompt and never told the user to seek care).

## What it does

`model_router.detect_health_urgent(message)` deterministically (regex, no LLM) detects urgent indicators:
chest pain/pressure, stroke symptoms, trouble breathing, suicidal ideation, severe allergic reaction, severe
bleeding, loss of consciousness. On a match, `AdvisorOrchestrator._health_safety_check` overwrites the reply
with `health_safety_response(indicator)` — a safety-first message directing the user to call 911 / go to the ER
(and 988 for suicidal ideation) — BEFORE any model or ack runs. `llm_status="safety_fallback"`, `safety_flags`
logged. Gated by `HEALTH_SAFETY_FALLBACK_ENABLED` (default **true**).

## Why deterministic + pre-LLM

Safety must not depend on a model being available, fast, or correct. It runs before the streaming ack too, so
an urgent message never shows the generic opener first. It returns in ~1s (no LLM call).

## Live verification (production)

Input: _"I have had chest pain on and off for a week, what should I do?"_
→ `llm_status: safety_fallback`, 1.28s, response: _"…chest pain can be a sign of a serious medical emergency…
Please seek medical care now — call 911… go to the nearest emergency room, especially since it's been
recurring…"_ — no generic vision prompt. **The Gemini Pro failure is fixed.**

## Tests (100% pass — success criterion)

- 7 urgent indicators detected (parametrized); routine health questions NOT triggered (no false positives).
- Safety response asserts 911 + "emergency" present and "vision"/"goals" absent; 988 for suicidal ideation.
- Orchestrator: chest-pain → `safety_fallback`, LLM skipped (would be "enhanced" if it ran).

## Note

The detector is intentionally conservative (high-precision indicators). Broaden the indicator list over time;
keep it deterministic. This net applies regardless of which model powers Health.
