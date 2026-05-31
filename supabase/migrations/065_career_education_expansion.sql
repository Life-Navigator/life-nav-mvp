-- ==========================================================================
-- 065: Career & Education Intake Expansion
--   * Adds missing columns on public.career_profiles
--   * Creates public.education_intake (singleton-ish: target credential set)
--   * Creates public.education_credentials for licenses / target credentials
-- ==========================================================================

-- -------------------------------------------------------------------------
-- 1. career_profiles  — additive columns
-- -------------------------------------------------------------------------
ALTER TABLE public.career_profiles
  ADD COLUMN IF NOT EXISTS current_income NUMERIC,
  ADD COLUMN IF NOT EXISTS income_trajectory TEXT
    CHECK (income_trajectory IS NULL OR income_trajectory IN ('declining', 'stable', 'growing', 'rapidly_growing')),
  ADD COLUMN IF NOT EXISTS promotion_target TEXT,
  ADD COLUMN IF NOT EXISTS target_income NUMERIC,
  ADD COLUMN IF NOT EXISTS time_for_upskilling_hours_per_week NUMERIC,
  ADD COLUMN IF NOT EXISTS job_change_willingness TEXT
    CHECK (job_change_willingness IS NULL OR job_change_willingness IN ('not_open', 'passive', 'active', 'actively_searching')),
  ADD COLUMN IF NOT EXISTS entrepreneurial_interest TEXT
    CHECK (entrepreneurial_interest IS NULL OR entrepreneurial_interest IN ('none', 'curious', 'side_hustle', 'committed', 'currently_running')),
  ADD COLUMN IF NOT EXISTS networking_capacity TEXT
    CHECK (networking_capacity IS NULL OR networking_capacity IN ('very_low', 'low', 'moderate', 'high', 'very_high')),
  ADD COLUMN IF NOT EXISTS relocation_willingness TEXT
    CHECK (relocation_willingness IS NULL OR relocation_willingness IN ('not_willing', 'regional_only', 'national', 'international')),
  ADD COLUMN IF NOT EXISTS skill_gaps TEXT[] DEFAULT '{}';


-- -------------------------------------------------------------------------
-- 2. public.education_intake  (one row per user)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.education_intake (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,

  highest_completed_degree TEXT,                    -- 'high_school' | 'bachelor' | ...
  current_program TEXT,                             -- free-text program name
  current_institution TEXT,
  expected_completion_date DATE,

  tuition_budget_total NUMERIC,
  tuition_budget_annual NUMERIC,
  willing_to_take_loans BOOLEAN,
  expected_roi_preference TEXT
    CHECK (expected_roi_preference IS NULL OR expected_roi_preference IN ('fast_payback', 'balanced', 'long_term_value')),
  credential_urgency TEXT
    CHECK (credential_urgency IS NULL OR credential_urgency IN ('none', 'within_year', 'within_2_years', 'within_5_years')),
  time_available_for_study_hours_per_week NUMERIC,

  has_gi_bill BOOLEAN,
  gi_bill_remaining_months NUMERIC,
  has_va_benefits BOOLEAN,
  employer_tuition_reimbursement_annual NUMERIC,
  scholarships_summary TEXT,
  desired_schools TEXT[] DEFAULT '{}',
  financing_options TEXT[] DEFAULT '{}',            -- ['529', 'savings', 'gi_bill', 'loans', ...]

  source TEXT NOT NULL DEFAULT 'onboarding',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.education_intake ENABLE ROW LEVEL SECURITY;
CREATE POLICY "education_intake_owner_all" ON public.education_intake
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "education_intake_service_role" ON public.education_intake
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER set_education_intake_updated_at
  BEFORE UPDATE ON public.education_intake
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 3. public.education_credentials
--   Licenses + target credentials. Differs from public.education_records
--   (formal degrees) and public.courses (in-progress / completed courses).
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.education_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  credential_kind TEXT NOT NULL
    CHECK (credential_kind IN ('certification', 'license', 'badge', 'target_credential')),
  name TEXT NOT NULL,
  issuer TEXT,
  issued_at DATE,
  expires_at DATE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'in_progress', 'target', 'lapsed')),
  url TEXT,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'onboarding',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ed_credentials_user        ON public.education_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_ed_credentials_user_status ON public.education_credentials(user_id, status);

ALTER TABLE public.education_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "education_credentials_owner_all" ON public.education_credentials
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "education_credentials_service_role" ON public.education_credentials
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER set_ed_credentials_updated_at
  BEFORE UPDATE ON public.education_credentials
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
