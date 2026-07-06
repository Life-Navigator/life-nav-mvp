# HOME_PURCHASE_ACTION_VALIDATION.md

Action: **home_purchase** · domain: **finance** · verified live against prod (real user, JWT).

## Flow verified

| Step                                         | Result                                                                                              |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Detect ("We bought a house")                 | ✅ → action=`home_purchase` with impact + fields (NO write)                                         |
| Impact preview shown before write            | ✅ Net worth, Liabilities, Cash reserves, Readiness, Retirement assumptions                         |
| Approval required                            | ✅ apply is a separate call; detect never writes                                                    |
| Apply (approved) writes via IngestionService | ✅ facts: purchase_price, down_payment, mortgage_balance                                            |
| Persisted in life.facts                      | ✅ `confirmation_status=confirmed`, `submitted_by=arcana-action-loop`                               |
| Surfaces on next read                        | ✅ confirmed facts → dashboard "Recently learned" + advisor citations; readiness recomputes on read |

## No silent change

Nothing is written on detection or while the card is open. The write happens only on **Approve & update**. Re-approving is idempotent (deterministic id), never a duplicate.
