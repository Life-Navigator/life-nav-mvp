-- ============================================================================
-- Itemized deduction components on finance.tax_profiles
--
-- WHY COMPONENTS AND NOT ONE `itemized_deductions` TOTAL
-- -----------------------------------------------------
-- Three of the four large itemized categories are capped or floored, so a single stored total
-- cannot be checked and cannot be corrected:
--
--   * state and local taxes are capped (IRC 164(b)(6)) — $40,400 for 2026, phasing down by 30% of
--     MAGI above $505,000 and never below $10,000;
--   * medical expenses only count above 7.5% of AGI (IRC 213(a));
--   * mortgage interest is limited to interest on $750,000 of acquisition debt.
--
-- Storing the raw amounts the user actually paid lets `tax.itemized_deductions` apply the current
-- year's caps every time it runs. Storing a pre-capped total would freeze last year's law into the
-- user's record, and nothing downstream could tell that it had happened.
--
-- These are amounts PAID, not amounts deductible. The engine computes the deductible figure.
-- ============================================================================

ALTER TABLE finance.tax_profiles
  ADD COLUMN IF NOT EXISTS state_local_taxes_paid     NUMERIC,  -- income/sales + property tax PAID
  ADD COLUMN IF NOT EXISTS mortgage_interest_paid     NUMERIC,  -- from Form 1098
  ADD COLUMN IF NOT EXISTS charitable_contributions   NUMERIC,
  ADD COLUMN IF NOT EXISTS medical_expenses_paid      NUMERIC,  -- gross, before the 7.5% AGI floor
  ADD COLUMN IF NOT EXISTS other_itemized_deductions  NUMERIC,
  -- AGI and MAGI drive the medical floor and the SALT phase-down respectively. `estimated_income`
  -- already exists but is gross income, which is not the same thing and must not stand in for it.
  ADD COLUMN IF NOT EXISTS adjusted_gross_income      NUMERIC,
  ADD COLUMN IF NOT EXISTS modified_agi               NUMERIC,
  -- The child tax credit ($2,200/child for 2026) and the other-dependent credit ($500) are
  -- DIFFERENT amounts, and `dependents` alone cannot tell them apart. Treating every dependent as
  -- a qualifying child overstates the credit by $1,700 per adult dependent — so the split is
  -- stored rather than guessed, and tax.tax_credits stays a named gap until it is known.
  ADD COLUMN IF NOT EXISTS qualifying_children_under_17 INT
    CHECK (qualifying_children_under_17 IS NULL OR qualifying_children_under_17 >= 0);

COMMENT ON COLUMN finance.tax_profiles.state_local_taxes_paid IS
  'State and local income (or sales) plus property tax PAID. Uncapped: tax.itemized_deductions applies the IRC 164(b)(6) cap and its MAGI phase-down.';
COMMENT ON COLUMN finance.tax_profiles.medical_expenses_paid IS
  'Gross unreimbursed medical expenses. The 7.5%-of-AGI floor (IRC 213(a)) is applied by the engine, not stored.';
COMMENT ON COLUMN finance.tax_profiles.adjusted_gross_income IS
  'AGI. Drives the medical-expense floor. Distinct from estimated_income, which is gross.';
COMMENT ON COLUMN finance.tax_profiles.modified_agi IS
  'MAGI for the SALT phase-down. Equals AGI for most filers; differs with foreign/possession income.';
COMMENT ON COLUMN finance.tax_profiles.qualifying_children_under_17 IS
  'Dependents qualifying for the CHILD tax credit. The remainder of `dependents` get the $500 other-dependent credit instead.';

-- No RLS change: finance.tax_profiles already carries `users_own_tax` (FOR ALL, auth.uid() =
-- user_id), which covers new columns automatically. Added columns are nullable with no default so
-- an absent value stays absent — the resolver reports it missing rather than deducting zero.
