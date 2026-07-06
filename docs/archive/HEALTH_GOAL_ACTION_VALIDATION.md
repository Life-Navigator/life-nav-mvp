# HEALTH_GOAL_ACTION_VALIDATION.md

Action: **health_goal** · domain: **health** · verified live against prod (real user, JWT).

## Flow verified

| Step                                                   | Result                                                                                              |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Detect ("I want to lose 30 pounds before the wedding") | ✅ → action=`health_goal` with impact + fields (NO write)                                           |
| Impact preview shown before write                      | ✅ Health goals, Readiness, Recommendations                                                         |
| Approval required                                      | ✅ apply is a separate call; detect never writes                                                    |
| Apply (approved) writes via IngestionService           | ✅ facts: goal, goal_target_date                                                                    |
| Persisted in life.facts                                | ✅ `confirmation_status=confirmed`, `submitted_by=arcana-action-loop`                               |
| Surfaces on next read                                  | ✅ confirmed facts → dashboard "Recently learned" + advisor citations; readiness recomputes on read |

## No silent change

Nothing is written on detection or while the card is open. The write happens only on **Approve & update**. Re-approving is idempotent (deterministic id), never a duplicate.
