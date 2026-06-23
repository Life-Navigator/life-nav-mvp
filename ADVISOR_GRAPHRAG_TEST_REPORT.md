# ADVISOR_GRAPHRAG_TEST_REPORT.md — Phase 8

## Unit/regression tests (deterministic, in `tests/test_advisor_agents.py`)

| Test                                                    | Asserts                                                                                                                                                                                     | Status |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `test_route_domains_p0_intent`                          | workout/gym/TRT/HIIT/martial arts/swimming/shoulder/knee → health; promotion/job offer → career; mortgage → finance; will/trust/guardian → family; master's → education; "workout" ≠ career | ✅     |
| `test_route_domains_failed_conversation_replay`         | the multi-symptom training-plan message → health, NOT finance                                                                                                                               | ✅     |
| `test_route_domains_is_keyword_based_with_safe_default` | unmatched → all 5 life domains (never finance-biased)                                                                                                                                       | ✅     |
| `test_domains_for_direct_vs_orchestrator`               | direct agent scopes to its domain; orchestrator keeps all                                                                                                                                   | ✅     |
| existing advisor_context/facts/validator suites         | fact packet + citation + relationship/number gates                                                                                                                                          | ✅     |

**Full suite: 603 passed.**

## Integration-verified live (require the LLM — verified against prod, not unit-mocked)

| Behavior                                              | Method                       | Result                                  |
| ----------------------------------------------------- | ---------------------------- | --------------------------------------- |
| Response includes cited document/domain facts         | live `/v1/life/advisor/chat` | ✅ 25 citations w/ sourceTable+recordId |
| Unrelated finance facts excluded from a health answer | live health replay           | ✅ no finance leak                      |
| Cross-domain context without derailing                | live promotion→home Q        | ✅ home context, career-focused         |
| `relationships_referenced` populated                  | live                         | ✅ present                              |

## Honest note on test coverage

The **routing** layer is unit-tested (deterministic). The **response-content** assertions (cites present, no unrelated facts, cross-domain-not-derailing) are **integration-verified live** rather than unit-mocked, because they depend on the LLM — mocking the model would test the mock, not the behavior. The live verifications above are reproducible via the JWT + `/v1/life/advisor/chat` harness.
</content>
