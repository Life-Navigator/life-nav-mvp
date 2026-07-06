# HEALTH_ROUTING_REGRESSION_TESTS.md

Added to `tests/test_advisor_agents.py` (`test_route_domains_p0_intent` + `test_route_domains_failed_conversation_replay`). All pass (603 total).

## Required cases (all green)

| Message                 | Expected  | Result |
| ----------------------- | --------- | ------ |
| workout plan            | health    | ✅     |
| gym plan                | health    | ✅     |
| TRT                     | health    | ✅     |
| HIIT                    | health    | ✅     |
| martial arts            | health    | ✅     |
| swimming                | health    | ✅     |
| shoulder injury         | health    | ✅     |
| knee arthritis          | health    | ✅     |
| promotion               | career    | ✅     |
| job offer               | career    | ✅     |
| mortgage / down payment | finance   | ✅     |
| will / trust / guardian | family    | ✅     |
| master's degree         | education | ✅     |

## Guards

- `route_domains("workout") == ["health"]` — `"work"` must not fire career (the original substring bug).
- `set(route_domains("hello")) == {finance, career, education, health, family}` — broad/unmatched grounds in all domains, **never finance-biased**.
- Failed-conversation replay: multi-symptom training-plan message → `health` present, `finance` absent.

## How to run

```
cd apps/lifenavigator-core-api && .venv/bin/python -m pytest tests/test_advisor_agents.py -q
```

</content>
