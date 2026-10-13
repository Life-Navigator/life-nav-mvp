-- ============================================================================
-- Inputs the B2 tax-treatment rules need (Milestone 3.1)
--
-- Eleven treatment rules were built in Phase B2 and none of them reached the advisor, because the
-- facts their statutory tests turn on were nowhere in the schema. These are those facts.
--
-- WHY THE HEALTH-PLAN DETAILS ARE STORED RATHER THAN ASKED EACH TIME
-- -----------------------------------------------------------------
-- A deductible and an out-of-pocket maximum are standing attributes of someone's coverage for a
-- whole plan year, and whether a plan is HDHP-qualifying is a threshold test against them
-- (IRC 223(c)(2), $1,700/$3,400 deductible and $8,500/$17,000 out-of-pocket for 2026). Re-asking
-- every turn would be the wrong shape AND would make the answer depend on the user's memory.
--
-- WHAT IS DELIBERATELY NOT HERE
-- -----------------------------
-- `heloc_proceeds_used_for`, margin interest, business interest and an IRA contribution under
-- consideration are NOT stored. Deductibility of HELOC interest traces to what the money bought
-- (IRC 163(h)(3)) — it can differ per draw and is not a standing attribute of a person, so it is a
-- per-turn fact. Storing it would turn one draw's use into a permanent characteristic.
-- ============================================================================

ALTER TABLE finance.user_financial_profile
  -- HDHP qualification (IRC 223(c)(2)). Amounts as the plan states them, not as tiers.
  ADD COLUMN IF NOT EXISTS health_coverage_tier     TEXT
    CHECK (health_coverage_tier IS NULL OR health_coverage_tier IN ('self_only', 'family')),
  ADD COLUMN IF NOT EXISTS hdhp_annual_deductible   NUMERIC,
  ADD COLUMN IF NOT EXISTS hdhp_out_of_pocket_max   NUMERIC,
  -- HSA funding, split because the tax treatment differs: a payroll contribution escapes FICA as
  -- well as income tax, a direct one does not.
  ADD COLUMN IF NOT EXISTS hsa_annual_contribution  NUMERIC,
  ADD COLUMN IF NOT EXISTS hsa_through_payroll      BOOLEAN,
  ADD COLUMN IF NOT EXISTS hsa_employer_contribution NUMERIC,
  -- FSA type decides HSA compatibility outright: a general-purpose FSA disqualifies an HSA for the
  -- whole plan year, a limited-purpose one does not. `fsa_election_amount` cannot tell them apart.
  ADD COLUMN IF NOT EXISTS fsa_type                 TEXT
    CHECK (fsa_type IS NULL OR fsa_type IN ('general_purpose', 'limited_purpose',
                                            'dependent_care', 'none')),
  -- Decides whether a traditional IRA contribution is deductible at the user's income
  -- (IRC 219(g)). Nullable on purpose: "not covered" makes the contribution fully deductible at
  -- ANY income, so a false default would hand a high earner a deduction they cannot take.
  ADD COLUMN IF NOT EXISTS covered_by_workplace_plan BOOLEAN;

ALTER TABLE finance.tax_profiles
  -- Form 1098-E box 1. The actual interest paid, never balance x rate: the approximation is wrong
  -- by the whole amortization schedule and overstates the deduction early in a loan's life.
  ADD COLUMN IF NOT EXISTS student_loan_interest_paid NUMERIC;

COMMENT ON COLUMN finance.user_financial_profile.fsa_type IS
  'A general-purpose FSA disqualifies an HSA for the entire plan year (IRC 223(c)(1)); a limited-purpose FSA does not. Election amount cannot distinguish them.';
COMMENT ON COLUMN finance.user_financial_profile.covered_by_workplace_plan IS
  'IRC 219(g). NULL means unknown, never "not covered" — the false default would make a traditional IRA fully deductible at any income.';
COMMENT ON COLUMN finance.user_financial_profile.hsa_through_payroll IS
  'Payroll HSA contributions escape FICA as well as income tax; direct contributions do not.';
COMMENT ON COLUMN finance.tax_profiles.student_loan_interest_paid IS
  'Form 1098-E box 1 — interest actually paid, not derived from balance and rate.';

-- No RLS change needed: both tables already carry owner-scoped FOR ALL policies that cover new
-- columns. Every column is nullable with no default, so an absent fact stays absent and the
-- resolver reports a gap rather than a determination.
