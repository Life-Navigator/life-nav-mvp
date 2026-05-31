-- ==========================================================================
-- 066: Family / Lifestyle Intake
--
--   * profiles  — additive columns for marital status, dependents
--   * public.family_lifestyle_profile  — singleton intake snapshot
--   * public.children_education_goals  — per-child education goals
-- ==========================================================================

-- -------------------------------------------------------------------------
-- 1. profiles additions
-- -------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS marital_status TEXT
    CHECK (marital_status IS NULL OR marital_status IN (
      'single', 'partnered', 'married', 'separated', 'divorced', 'widowed', 'prefer_not_to_say'
    )),
  ADD COLUMN IF NOT EXISTS dependents_count INT
    CHECK (dependents_count IS NULL OR dependents_count >= 0);


-- -------------------------------------------------------------------------
-- 2. family_lifestyle_profile  (one row per user)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.family_lifestyle_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,

  has_elder_care_responsibilities BOOLEAN,
  elder_care_notes TEXT,
  caregiving_hours_per_week NUMERIC,
  family_financial_obligations_monthly NUMERIC,

  -- Geographic context
  willing_to_relocate TEXT
    CHECK (willing_to_relocate IS NULL OR willing_to_relocate IN ('no', 'regional', 'national', 'international')),
  must_stay_near_family BOOLEAN,
  travel_frequency_target TEXT
    CHECK (travel_frequency_target IS NULL OR travel_frequency_target IN ('rarely', 'occasional', 'frequent', 'extensive')),
  travel_budget_annual NUMERIC,

  -- Goals / priorities
  lifestyle_goals TEXT,                             -- free-text
  household_priorities TEXT[] DEFAULT '{}',         -- ordered priority labels

  source TEXT NOT NULL DEFAULT 'onboarding',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.family_lifestyle_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flp_owner_all" ON public.family_lifestyle_profile
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "flp_service_role" ON public.family_lifestyle_profile
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER set_flp_updated_at
  BEFORE UPDATE ON public.family_lifestyle_profile
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 3. children_education_goals  (per-child education target)
--   References public.family_members(id) but is also keyed by user_id so
--   RLS reads cleanly without joining.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.children_education_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  family_member_id UUID REFERENCES public.family_members(id) ON DELETE SET NULL,

  child_name_hint TEXT,                              -- optional shadow if family_member_id is null
  child_birth_year INT CHECK (child_birth_year IS NULL OR child_birth_year BETWEEN 1900 AND 2200),

  target_degree TEXT,                                -- 'bachelor', 'graduate', ...
  target_institution TEXT,
  target_institution_type TEXT
    CHECK (target_institution_type IS NULL OR target_institution_type IN (
      'public_in_state', 'public_out_state', 'private', 'community_college', 'trade_school', 'bootcamp', 'no_preference'
    )),
  estimated_total_cost NUMERIC,
  savings_vehicle TEXT,                              -- '529', 'utma', 'savings', 'none', ...
  current_savings NUMERIC,
  monthly_contribution NUMERIC,
  funding_source TEXT[],                             -- ['parents', 'grandparents', 'scholarships', 'loans', 'work_study']

  source TEXT NOT NULL DEFAULT 'onboarding',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_child_ed_goals_user
  ON public.children_education_goals(user_id);

ALTER TABLE public.children_education_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "child_ed_goals_owner_all" ON public.children_education_goals
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "child_ed_goals_service_role" ON public.children_education_goals
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER set_child_ed_goals_updated_at
  BEFORE UPDATE ON public.children_education_goals
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
