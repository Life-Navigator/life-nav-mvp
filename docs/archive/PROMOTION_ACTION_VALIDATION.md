# PROMOTION_ACTION_VALIDATION.md

Action: **promotion** · domain: **career** · verified live against prod (real user, JWT).

## Flow verified

| Step                                             | Result                                                                                              |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Detect ("I just got promoted to Staff Engineer") | ✅ → action=`promotion` with impact + fields (NO write)                                             |
| Impact preview shown before write                | ✅ Compensation, Retirement projections, Taxes, Home-purchase timeline                              |
| Approval required                                | ✅ apply is a separate call; detect never writes                                                    |
| Apply (approved) writes via IngestionService     | ✅ facts: title, base_salary, annual_bonus, equity_grant                                            |
| Persisted in life.facts                          | ✅ `confirmation_status=confirmed`, `submitted_by=arcana-action-loop`                               |
| Surfaces on next read                            | ✅ confirmed facts → dashboard "Recently learned" + advisor citations; readiness recomputes on read |

## No silent change

Nothing is written on detection or while the card is open. The write happens only on **Approve & update**. Re-approving is idempotent (deterministic id), never a duplicate.
