# NEW_CHILD_ACTION_VALIDATION.md

Action: **new_child** · domain: **family** · verified live against prod (real user, JWT).

## Flow verified

| Step                                         | Result                                                                                              |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Detect ("We're having a baby in June")       | ✅ → action=`new_child` with impact + fields (NO write)                                             |
| Impact preview shown before write            | ✅ Life insurance, Estate planning & guardianship, Emergency fund, College savings, Cash flow       |
| Approval required                            | ✅ apply is a separate call; detect never writes                                                    |
| Apply (approved) writes via IngestionService | ✅ facts: expecting_child, child_due_date                                                           |
| Persisted in life.facts                      | ✅ `confirmation_status=confirmed`, `submitted_by=arcana-action-loop`                               |
| Surfaces on next read                        | ✅ confirmed facts → dashboard "Recently learned" + advisor citations; readiness recomputes on read |

## No silent change

Nothing is written on detection or while the card is open. The write happens only on **Approve & update**. Re-approving is idempotent (deterministic id), never a duplicate.
