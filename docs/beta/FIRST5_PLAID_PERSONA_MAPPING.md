# First-5 Finance Source / "Plaid Persona" Reconciliation

**Honest source-of-truth:** the first-5 beta accounts use **synthetic finance seeded directly in the database**
(`finance.financial_accounts`, `is_manual=true`, `metadata.source = "synthetic_beta"`). **No Plaid connection is
made.** The dashboard therefore labels them **"Synthetic Beta Persona"** — never "Plaid sandbox persona" (that
label appears only when a real `plaid_account_id` / connected marker exists). Real Plaid is disabled/warning-gated
in beta. This avoids the exact trust break the sprint warns about: no fake Plaid labeling, no story↔data drift.

Match rule used (from the sprint's Part 3): **B — LifeNavigator Synthetic Finance Match.** Source label
"Synthetic Beta Persona". Planning goals (emergency reserve, down payment, etc.) persist separately in
`finance.financial_planning_goals` once that migration is applied (Synthetic Beta Planning Facts).

## Per-persona expected finance (from `scripts/beta/verify_synthetic_accounts.py`, coherent seed)

| beta  | persona            | accounts (type: $)                                                                             | cash   | invest | retire | debt   | **net worth** | story (finance, plain English)                                                                                                           |
| ----- | ------------------ | ---------------------------------------------------------------------------------------------- | ------ | ------ | ------ | ------ | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| beta1 | family_foundation  | Exec Checking 58.2k, Money Mkt 145k (cash); Investment 920k; 401k 410k; Jumbo Mortgage −1,240k | 203.2k | 920k   | 410k   | 1,240k | **≈ +293k**   | Strong assets + cash, but a large mortgage. Sequence wedding cash, emergency reserve, and first-home down payment without overextending. |
| beta2 | young_professional | Checking 8.2k, Savings 14k (cash); Roth IRA 22k; Student Loan −32k                             | 22.2k  | 0      | 22k    | 32k    | **≈ −10k**    | Early career, paying down student loans. Build a 6-month emergency fund, then start investing.                                           |
| beta3 | pre_retirement     | Checking 30k; Brokerage 1,100k; 401k 890k; home paid off (no debt)                             | 30k    | 1,100k | 890k   | 0      | **≈ +2,020k** | High net worth, no debt. Protect the nest egg, plan healthcare/retirement drawdown and estate.                                           |
| beta4 | new_parent         | Checking 12k, Savings 30k (cash); 529 Plan 5k; no debt                                         | 42k    | 5k     | 0      | 0      | **≈ +47k**    | New parent, modest cash, a small 529. Build family protection (life insurance/will) + grow college savings under budget pressure.        |
| beta5 | career_change      | Checking 4k, Savings 6k (cash); Student Loan −28k                                              | 10k    | 0      | 0      | 28k    | **≈ −18k**    | Career changer paying off student debt with limited runway. Sequence debt payoff vs. upskilling.                                         |

Intentional finance shape: beta2/beta5 carry student debt (negative net worth is correct for early-career/
career-change); beta3 is high-net-worth/no-debt; beta1 is asset-rich with a large mortgage.

## Expected-range guardrails (used by the verification SQL, Section 16)

| beta  | net worth range | cash range  | debt range      | min accounts |
| ----- | --------------- | ----------- | --------------- | ------------ |
| beta1 | 200k – 400k     | 150k – 260k | 1,100k – 1,350k | 5            |
| beta2 | −60k – 60k      | 10k – 40k   | 20k – 45k       | 4            |
| beta3 | 1,700k – 2,300k | 10k – 60k   | 0 – 0           | 3            |
| beta4 | 10k – 90k       | 20k – 70k   | 0 – 30k         | 3            |
| beta5 | −60k – 30k      | 3k – 25k    | 20k – 40k       | 3            |

## Source-label expectations (Part 5)

- Seeded beta accounts → **"Synthetic Beta Persona"** (backend `SYNTHETIC = "Synthetic beta persona"` when every
  account carries `metadata.source = "synthetic_beta"`; dashboard renders "Synthetic Beta Persona").
- A failed finance fetch / no accounts → **honest empty state**, never a fake `$0` or fake "Plaid".
- Investment holdings still require provenance (account-balance pseudo-holdings are suppressed at render).

## Re-seed note (founder)

Existing beta accounts were seeded **before** the `metadata.source = "synthetic_beta"` marker and the coherent
beta1 retirement / beta2 student-loan additions. To get the "Synthetic Beta Persona" label + coherent numbers,
**re-run `scripts/beta/verify_synthetic_accounts.py`** (idempotent per account by creation UID) — but resolving
the canonical 5 UIDs + clearing duplicate rows needs a working admin path (Supabase dashboard / Management PAT /
`DATABASE_URL`), which is not available from the build env. See `FIRST5_SYNTHETIC_ACCOUNT_GATE.md` caveats.
