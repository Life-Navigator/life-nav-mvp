# Dominant Narrative Accuracy (Real-User Gate)

**Date:** 2026-06-16 · Branch `platform/discovery-intelligence`. Real pipeline, 5 users.

| User               | Statement gist                                                                                           | Expected                               | **Got**                   | ✓   |
| ------------------ | -------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------- | --- |
| 1 Family Builder   | credit card, down payment, wedding (1yr), house, start a family, fitness, promotion@NVIDIA, Masters AI   | Family foundation (balancing the rest) | `family_foundation`       | ✅  |
| 2 Founder/Legacy   | building a company to change decisions, legacy for family, balancing family/health/law/career/businesses | Legacy & entrepreneurship              | `legacy_entrepreneurship` | ✅  |
| 3 Burnout Exec     | good money, two kids, travel constantly, exhausted, weight gain, missing family                          | Health & life balance                  | `health_life_balance`     | ✅  |
| 4 Career Maximizer | 28, AI, director by 40, sacrifice comfort, MBA/lab/company                                               | Career acceleration                    | `career_acceleration`     | ✅  |
| 5 Financial Crisis | $18k debt, can't pay, losing apartment, relationship stress, overwhelmed                                 | Financial stabilization                | `financial_stabilization` | ✅  |

**5/5.** The founder (legacy, not "financial independence" or "career") and the crisis (stabilization, not "no objective" — the prior failure) are the hard cases; both correct. No persona-seed contamination (validated seeded too). Engine: `dominant_narrative()` + `emotional_signals()` in `app/services/life_discovery.py`. Tests: `test_dominant_narrative_per_persona`, `test_dominant_narrative_founder_legacy`, end-to-end clean + seeded.
