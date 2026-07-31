# R-3 · Test Results

**20/20 passing.** Full core-api suite green. **Contract verification only — all stores faked.**

## Coverage

| Requirement                             | Test                                                           | Result |
| --------------------------------------- | -------------------------------------------------------------- | ------ |
| Authenticated owner can report          | `test_authenticated_owner_can_report_their_own_response`       | ✅     |
| All seven categories                    | `test_every_required_category_is_accepted` (×7)                | ✅     |
| Harmful/privacy triaged high            | `test_harmful_and_privacy_reports_are_triaged_high_on_arrival` | ✅     |
| **Another user's turn rejected**        | `test_another_users_turn_is_rejected`                          | ✅     |
| **No enumeration oracle**               | `test_foreign_turn_and_missing_turn_are_indistinguishable`     | ✅     |
| **No cross-tenant sentinel leak**       | `test_no_tenant_b_sentinel_ever_reaches_a_tenant_a_report`     | ✅     |
| Unauthenticated rejected                | `test_unauthenticated_submission_is_rejected`                  | ✅     |
| Client cannot supply identity/metadata  | `test_client_cannot_supply_identity_or_metadata`               | ✅     |
| **`llm_response_raw` never persisted**  | `test_llm_response_raw_is_never_persisted`                     | ✅     |
| No graph writes                         | `test_report_does_not_write_to_the_graph`                      | ✅     |
| Invalid category / overlong explanation | 2 tests                                                        | ✅     |
| Duplicate returns existing report       | `test_duplicate_same_category_returns_the_existing_report`     | ✅     |
| Different category = new report         | `test_a_different_category_is_a_new_report`                    | ✅     |

## Mutation proofs — the gates were demonstrated failing

| #            | Mutation                                                      | Result       |
| ------------ | ------------------------------------------------------------- | ------------ |
| **MUT-R3-1** | drop the `user_id` filter from the ownership query            | **3 failed** |
| **MUT-R3-2** | distinguish "not yours" from "not found" (enumeration oracle) | **1 failed** |
| **MUT-R3-3** | copy `llm_response_raw` into the snapshot                     | **1 failed** |
| **MUT-R3-4** | accept a caller-supplied `tenant_id`                          | **1 failed** |

All restored from a file copy — **not `git checkout`**, since these files are uncommitted. Suite
returned to 20/20.

## Not tested

Browser E2E, accessibility, reviewer authorization UI — **no UI was built**. Migration never
applied. Endpoint never called over HTTP.
