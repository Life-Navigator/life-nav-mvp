# ARCANA_CHAT_TEST_REPORT.md — Phase 8

## Regression tests (deterministic, tests/test_advisor_hybrid.py) — 603 pass

| Test                                                                       | Asserts                                                                                                                                                                                                                                                                            | Status |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `test_advisor_mode_renders_conversational_not_six_section` (rewritten)     | advisor message has frame+recommendation as prose; NO `**My read:**`/`**The tradeoffs:**`/`**What we know:**`/`**What would change this:**`/`licensed professional`; `reasoning` carries tradeoffs/what_we_know/what_we_still_need; message clean of discovery-forbidden artifacts | ✅     |
| `test_orchestrator_enhances_text_on_valid_llm` (updated)                   | enhanced; question present; no section headers                                                                                                                                                                                                                                     | ✅     |
| `test_advisor_stream_still_enhances` (updated)                             | streaming path: recommendation as prose, no `**My read:**`                                                                                                                                                                                                                         | ✅     |
| `test_discovery_*` (unchanged)                                             | discovery stays conversational, untouched, no advisor artifacts                                                                                                                                                                                                                    | ✅     |
| `test_health_safety_wins_before_discovery_mode` (unchanged)                | urgent-care fallback still fires first                                                                                                                                                                                                                                             | ✅     |
| `test_discovery_contract_violations_detects_advisor_artifacts` (unchanged) | tripwire function still detects the headers if they ever reappear                                                                                                                                                                                                                  | ✅     |

## Coverage vs the requested test list

- Advisor chat does NOT emit six-section markdown by default → ✅ unit + live.
- Discovery can still use discovery format → ✅ (separate path, untouched).
- Health/finance/estate return conversational answers → ✅ live (ARCANA_CONVERSATION_VALIDATION).
- Markdown report headers don't leak → ✅ unit asserts absence.
- Citations preserved → ✅ live (25).
- Evidence present but not dumped → ✅ `reasoning` structured field.
- Safety fallback still works for urgent danger → ✅ unit (chest-pain test).

## Honest note

Response-content behaviors (gives a plan, no finance leak) are LLM-dependent and **integration-verified live**, not unit-mocked (mocking the model would test the mock). Reproducible via the JWT + `/v1/life/advisor/chat` harness.
