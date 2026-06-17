# Discovery Mode Fix Report (Step 3)

**Date:** 2026-06-16 · **Branch:** `platform/discovery-mode-fix` (off `origin/advisor/p0-upgrade-2.3.0`).

## The fix (smallest safe change)

Added an explicit **`mode`** to the advisor orchestrator. Onboarding routes now run in `mode="discovery"`; everything else defaults to `mode="advisor"` (unchanged).

### Changes

| File                                   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/services/advisor_orchestrator.py` | `converse(..., mode="advisor")` and `converse_stream(..., mode="advisor")` gained a `mode` param. In **discovery** mode, after the deterministic `RelationshipManager` turn and the health-safety net, the orchestrator returns the RM's conversational reply **verbatim** and **skips `_enhance`** entirely (no LLM call, no `_compose` six-section template, no advice disclaimer, no objective-as-fact). `llm_status="discovery"`. |
| `app/services/advisor_orchestrator.py` | Added `discovery_contract_violations(text)` + `_enforce_discovery_contract()` — a non-mutating tripwire that logs a warning if a discovery turn ever contains advisor artifacts (defense-in-depth; the RM never emits them).                                                                                                                                                                                                          |
| `app/routers/life.py`                  | `/v1/life/discovery/chat` → `converse(..., mode="discovery")`; `/v1/life/discovery/chat/stream` → `converse_stream(..., mode="discovery")`. Docstring updated to describe discovery mode.                                                                                                                                                                                                                                             |

### What discovery mode now does

- Uses the `RelationshipManager` conversational output (one reflection + one natural question).
- Skips `_enhance`, the six-section `_compose`, the tradeoff/"What we know"/"My read"/"What would change this" sections, and the advice disclaimer.
- Never states candidate/inferred goals as confirmed facts (the fact-asserting path — `advisor_context.py:322-323` feeding `advisor_llm` — is only reached by `_enhance`, which discovery skips).
- **Health urgent-care safety net still wins first**, in every mode.

### What advisor mode still does (preserved, unchanged)

- Full six-section LLM-led decision turn via `_enhance` + `_compose`, trust-spine validation, and the scope disclaimer.
- Available through the orchestrator's default `mode="advisor"`. (Note: no route currently invokes advisor mode — `/discovery/chat[/stream]` were the only orchestrator callers; advisor mode is preserved for a future advisor/decision surface. See `MAIN_CONSOLIDATION_PLAN.md`.)

## Tests (Step 6) — all pass (`pytest tests/test_advisor_hybrid.py`, 51 passed)

- `test_discovery_mode_returns_conversational_rm_output` — discovery keeps RM text; `llm_status="discovery"`; zero contract violations — **even when the LLM would have produced the six sections**.
- `test_advisor_mode_still_renders_six_section_template` — advisor mode still emits `**My read:**`, `**The tradeoffs:**`, disclaimer.
- `test_discovery_mode_does_not_state_candidate_goal_as_fact` — no "your primary objective is …".
- `test_discovery_stream_follows_mode` — streaming discovery yields `ack`+`final`, final is conversational, no enhancement.
- `test_advisor_stream_still_enhances` — streaming advisor still enhances.
- `test_health_safety_wins_before_discovery_mode` — chest-pain → `safety_fallback` before discovery returns.
- `test_discovery_contract_violations_detects_advisor_artifacts` — the tripwire detects all six markers and passes a clean turn.

## Smoke test (Step 7)

- **Deterministic smoke (executed):** the tests above are the offline smoke — they prove input like "Reach financial independence" yields a conversational turn, not the six-section block.
- **Live smoke (requires deploy):** a true end-to-end smoke needs the branch deployed (`fly deploy` from `platform/discovery-mode-fix`) + a real Supabase JWT. Not run here (no deploy approval this sprint). Expected once deployed: the opening turn asks one warm question (e.g. _"It sounds like financial independence may matter to you — when you picture it, do you mean work becoming optional, retiring early, or simply feeling secure?"_), with no sections, no disclaimer, no objective-as-fact.

## Safety

No DB writes changed, no flags flipped, no deploy performed. The change is additive + default-safe (advisor mode is the default; only the two onboarding routes opt into discovery mode).
