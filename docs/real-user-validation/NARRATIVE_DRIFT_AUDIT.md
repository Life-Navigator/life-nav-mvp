# Narrative Drift Audit

**Date:** 2026-06-16 · Continue each conversation with a major life event; the narrative is re-derived from the updated goal set (stateless recompute).

| User      | Before                  | New information                                            | After                   | Reason                                                                    | Handled?                |
| --------- | ----------------------- | ---------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------- | ----------------------- |
| 1 Family  | family_foundation       | "We unexpectedly found out we are pregnant."               | family_foundation       | pregnancy fits + intensifies the family theme                             | ✅ absorbed             |
| 2 Founder | legacy_entrepreneurship | "I may raise venture capital."                             | legacy_entrepreneurship | VC reinforces the entrepreneurship/legacy build                           | ✅ absorbed             |
| 3 Burnout | health_life_balance     | "My doctor told me my blood pressure is dangerously high." | health_life_balance     | a health-critical event intensifies the health theme                      | ✅ absorbed/intensified |
| 4 Career  | career_acceleration     | "I am getting married next year."                          | **family_foundation**   | a major life event (marriage) is NOT ignored — the narrative evolves      | ✅ evolved              |
| 5 Crisis  | financial_stabilization | "I received a promotion and a significant raise."          | financial_stabilization | a raise accelerates stabilization but the $18k debt + housing risk remain | ✅ correctly stable     |

## Pass criteria

- **Evolves on a real event:** ✅ (U4 marriage → family).
- **Not sticky / not locked:** ✅ — the theme is recomputed every turn from the current goal set; U4 demonstrates a flip when the situation changes.
- **Does not ignore major events:** ✅ (pregnancy, BP-crisis, VC, marriage, raise all reflected).

## Honest limitation (documented)

Drift works on **addition** (new info enters the goal set → recompute absorbs it). Drift on **resolution/subtraction** is weaker: because the recompute concatenates the conversation, a goal the user explicitly RESOLVES ("my debt is now cleared") is not removed, so a crisis theme could persist longer than warranted. U5 staying `financial_stabilization` after a raise is **correct** (debt remains), but if a later turn said "debt cleared", today's engine would not promptly evolve. Fix path: mark resolved goals and weight the latest turn — tracked, not blocking (no persona stuck on a resolved crisis in the validation set).
