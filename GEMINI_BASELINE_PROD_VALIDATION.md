# GEMINI_BASELINE_PROD_VALIDATION.md — Phase 4

## Status: BLOCKED — pending deploy (Phase 3 not executed; see GEMINI_BASELINE_DEPLOY_REPORT.md)

Cannot run production smoke until the baseline is deployed (held on the Option 1/2 auth decision). The validation is otherwise ready — local pipeline proof already exists (CRITICAL_CONVERSATION_REPLAY.md: 6/6 enhanced, answer-first; finance benchmark math passes; health coaching passes).

## Smoke runbook (run immediately after deploy)

Hit the live `/v1/life/advisor/chat` for each, assert on the response metadata + content:

| Prompt                 | Assert                                                                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Workout/nutrition plan | `provider=vertex_gemini` (Opt 2) or `google_aistudio` (Opt 1), `model=gemini-2.5-pro`\*, `llm_status=enhanced`, concrete plan |
| Home affordability     | benchmark math survives (no `fallback:invented numbers`)                                                                      |
| Promotion impact       | answer-first, clear position                                                                                                  |
| New child              | prioritized action list                                                                                                       |
| Estate planning        | will/guardianship guidance, professional-referral only where legal                                                            |
| Education decision     | takes a position                                                                                                              |

Also verify: no `advisor_model_fallback` warnings in `flyctl logs`; citations present on grounded turns; **action cards still work** (POST /v1/life/advisor/action/{detect,apply}); finance overview page renders canonical data.

\*On Option 1 confirm the API key's project serves gemini-2.5-pro; otherwise model=gemini-2.5-flash on that path.

## Status until deployed: BLOCKED (no prod change made).
