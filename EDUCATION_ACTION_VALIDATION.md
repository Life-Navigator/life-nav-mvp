# EDUCATION_ACTION_VALIDATION.md

Action: **degree_enrollment** · domain: **education** · verified live against prod (real user, JWT).

## Flow verified

| Step                                         | Result                                                                                              |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Detect ("I enrolled in the UT AI master's")  | ✅ → action=`degree_enrollment` with impact + fields (NO write)                                     |
| Impact preview shown before write            | ✅ Education profile, Time commitment, Cash flow (tuition), Career trajectory                       |
| Approval required                            | ✅ apply is a separate call; detect never writes                                                    |
| Apply (approved) writes via IngestionService | ✅ facts: enrollment, tuition, program_duration                                                     |
| Persisted in life.facts                      | ✅ `confirmation_status=confirmed`, `submitted_by=arcana-action-loop`                               |
| Surfaces on next read                        | ✅ confirmed facts → dashboard "Recently learned" + advisor citations; readiness recomputes on read |

## No silent change

Nothing is written on detection or while the card is open. The write happens only on **Approve & update**. Re-approving is idempotent (deterministic id), never a duplicate.
