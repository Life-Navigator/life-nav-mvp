# VERTEX_PROD_SMOKE_REPORT.md — Phase 6

## Status: BLOCKED — pending deploy (Phase 5). Runbook ready; local pipeline already proven (CRITICAL_CONVERSATION_REPLAY.md 6/6).

Run against live `/v1/life/advisor/chat` after deploy:

| #   | Prompt                 | Assert                                                                              |
| --- | ---------------------- | ----------------------------------------------------------------------------------- |
| 1   | Workout/nutrition plan | provider=vertex_gemini · model=gemini-2.5-pro · llm_status=enhanced · concrete plan |
| 2   | Home affordability     | benchmark/scenario math survives (no `fallback:invented numbers`)                   |
| 3   | Emergency fund         | "3-6 months → $…" passes                                                            |
| 4   | Promotion impact       | answer-first, clear position                                                        |
| 5   | New child              | prioritized action list                                                             |
| 6   | Estate planning        | will/guardianship; professional-referral only where legal                           |
| 7   | Education decision     | takes a position                                                                    |

Cross-checks: **no API-key path** (provider never `google_aistudio`); **no fallback** (`flyctl logs | grep advisor_model_fallback` empty); **action loop works** (POST /v1/life/advisor/action/{detect,apply}); **evidence drawer** present (`reasoning` + `citations` on responses).

## Pass = all 7 enhanced on vertex_gemini/gemini-2.5-pro, 0 fallbacks, action loop + drawer intact.
