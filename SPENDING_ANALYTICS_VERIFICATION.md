# SPENDING_ANALYTICS_VERIFICATION.md

**Instruction:** "Verify spending analytics with an expense-heavy user before changing SpendingTrends logic. Do not guess. If expense transactions exist and SpendingTrends still returns empty, trace `/api/finance/analytics → spending_trends` and fix the actual computation/mapping."

**Result: SpendingTrends WORKS. No code change made.** The empty state was honest for the user it was first observed on.

## What I traced (no guessing)

1. **My first pass had a query bug**, not a product bug: I checked `transaction_type='debit'`, but the real value is **`'expense'`**. Correcting it: **697 expense transactions exist** across 911 total (distinct types = `expense, income`).
2. **`category` is NULL on all 911 transactions.** But the analytics handles this — `src/app/api/finance/analytics/route.ts:58`: `cat = (t) => (t.category || 'Other')…` → uncategorized expenses bucket into **"Other"**. So NULL categories do **not** break it.
3. The computation filters to the **last 30 days** (`route.ts:63`, `cut30`). Checked the expense-heavy user (`gttdizfezdytqoqpul@…`): **93 expenses, 81 within the last 30 days** (dates 2026-05-14 → 06-11). So the window includes plenty of expenses → `spending_trends` should populate.

## Live verification (Playwright, expense-heavy onboarded user, dark mode)

Rendered `/dashboard/finance` as the 81-recent-expense user:

- **Spending Trends chart renders** with a real axis (`$0 / $350 / $700 / $1050 / $1400`) and date axis (`May 22 → Jun 10`). **Not** the "No Spending Data" empty state.
- The "No Spending Data" message seen earlier was on a **different** user (`recon-…`) who has **only salary income, zero expenses** → an **honest** empty state.

## Conclusion

- Expense transactions exist **and** SpendingTrends renders them → **the computation/mapping is correct**.
- The empty state appears only when a user genuinely has no recent expense transactions — which is the correct, honest behavior (no fabricated spend).
- Per the instruction ("don't change logic if it works"), **`SpendingTrends` and `/api/finance/analytics` were left unchanged.**

## Optional future polish (not a bug, not done)

- Categories are NULL in the seed data, so all spend buckets as "Other." If/when real Plaid categories flow in, the category breakdown enriches automatically (the code already keys on `category`).
- The 30-day spend window is intentional for "trends"; if product wants longer, parameterize `cut30` — but it is not causing the reported empty state.

## Status: VERIFIED CORRECT — NO CHANGE

</content>
