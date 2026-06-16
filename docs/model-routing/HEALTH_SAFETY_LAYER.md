# Health Safety Layer (Pilot Readiness)

**Status: LIVE IN PRODUCTION, default-ON, verified.** Full detail in `HEALTH_SAFETY_FALLBACK_REPORT.md`; this
is the pilot summary.

## What it does

Deterministic, model-free detection (`model_router.detect_health_urgent`) of urgent indicators — chest pain,
stroke symptoms, trouble breathing, suicidal ideation, severe allergic reaction, severe bleeding, loss of
consciousness — runs **before any model and before the streaming ack** (`AdvisorOrchestrator._health_safety_check`,
gated by `HEALTH_SAFETY_FALLBACK_ENABLED`, default true). On a match it returns a safety-first reply
(call 911 / nearest ER; 988 for suicidal ideation), `llm_status="safety_fallback"`, logs a `safety_flags`
event. Never the generic life-vision prompt.

## Why this matters for the pilot

A 20-person beta with executives/investors will stress-test edge cases; an urgent medical message must never
get a generic chatbot reply. This fixes the observed Gemini Pro chest-pain failure and is model-independent.

## Verified live

"I have had chest pain on and off for a week" → safety_fallback in ~1.3s with 911/ER guidance (blocking + the
streaming ack both confirmed). 7 indicators unit-tested + no false positives on routine health questions.

## Hardening (post-pilot): broaden indicators, localize emergency numbers by region, add a crisis-resources

block for mental-health cases. Keep it deterministic.
