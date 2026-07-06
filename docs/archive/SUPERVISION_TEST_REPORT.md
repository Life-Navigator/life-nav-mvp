# SUPERVISION_TEST_REPORT.md — Phase 10

**680 tests pass.** New: `tests/test_supervision.py` (7) + `tests/test_affordability_gate.py` (16) + prior gate suites.

| Case                                                      | Covered by                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------ |
| unsupported mortgage payment → repaired/flagged           | test_supervision.test_monthly_payment_flagged                      |
| unlabeled scenario down payment → "label it"              | test_supervision.test_unlabeled_scenario_flagged_near_prohibited   |
| benchmark math preserved                                  | test_affordability_gate (20% down, closing, FHA, reserve, savings) |
| unsupported tax bill blocked                              | test_affordability_gate.test_block_tax_bill                        |
| unsupported medical dosing blocked                        | test_gate_refinement.test_health_clinical_blocked                  |
| workout plan passes                                       | test_gate_refinement.test_health_coaching_passes                   |
| legal/affordability verdict flagged                       | test_supervision.test_advice_verdict_flagged                       |
| fabricated number flagged                                 | test_supervision.test_fabricated_number_flagged                    |
| clean answer → no issues                                  | test_supervision.test_clean_answer_no_issues                       |
| trust floor preserved (possessive/wrong-math still block) | test_affordability_gate.\*                                         |

Fallback only fires after ≤2 repairs fail (orchestrator loop; FakeLLM-returns-same tests confirm final fallback).
