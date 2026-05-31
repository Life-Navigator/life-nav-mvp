-- ==========================================================================
-- 060: User Graph Foundation
--
-- Adds the structured tables required by the Decision Optimization Platform:
--   - user_life_vision
--   - user_constraints
--   - user_decision_preferences
--   - user_commitment_levels
--   - user_motivations
--   - user_domain_risk_tolerance
--   - user_capabilities
--   - user_outcomes
--   - user_decisions
--   - user_recommendations
--
-- Conventions:
--   * uuid pk, user_id -> profiles(id) on delete cascade
--   * created_at / updated_at (TIMESTAMPTZ NOT NULL)
--   * source TEXT (e.g. 'onboarding', 'manual', 'ai_inferred', 'integration')
--   * confidence_score NUMERIC(3,2) in [0.00, 1.00] where applicable
--   * metadata JSONB DEFAULT '{}'
--   * RLS on; auth.uid() = user_id; service_role bypass for backend jobs
--   * core.set_updated_at() triggers (defined in 009_mvp_ingestion_pipeline.sql)
-- ==========================================================================


-- -------------------------------------------------------------------------
-- 1. user_life_vision
-- One row per (user_id, horizon). Captures vision per time horizon, plus
-- free-form definition_of_success and fears_to_avoid.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_life_vision (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  horizon TEXT NOT NULL
    CHECK (horizon IN ('1_year', '3_year', '5_year', '10_year', 'definition_of_success', 'fears_to_avoid')),
  vision_text TEXT,
  domains TEXT[] DEFAULT '{}',           -- which life areas this vision touches
  source TEXT NOT NULL DEFAULT 'onboarding',
  confidence_score NUMERIC(3,2) CHECK (confidence_score IS NULL OR (confidence_score BETWEEN 0 AND 1)),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, horizon)
);

CREATE INDEX IF NOT EXISTS idx_user_life_vision_user
  ON public.user_life_vision(user_id);
CREATE INDEX IF NOT EXISTS idx_user_life_vision_user_created
  ON public.user_life_vision(user_id, created_at DESC);

ALTER TABLE public.user_life_vision ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_life_vision_owner_all"
  ON public.user_life_vision
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_life_vision_service_role"
  ON public.user_life_vision
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER set_user_life_vision_updated_at
  BEFORE UPDATE ON public.user_life_vision
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 2. user_constraints
-- Hard or soft constraints across the five canonical dimensions.
-- A user may have many constraints per dimension.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_constraints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dimension TEXT NOT NULL
    CHECK (dimension IN ('time', 'money', 'health', 'family', 'geography', 'other')),
  severity TEXT NOT NULL DEFAULT 'soft'
    CHECK (severity IN ('hard', 'soft')),
  description TEXT NOT NULL,
  value_numeric NUMERIC,                 -- optional quantitative form (e.g. hours/week, $/month)
  value_unit TEXT,                       -- e.g. 'hours_per_week', 'usd_per_month', 'miles'
  starts_at DATE,
  ends_at DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  source TEXT NOT NULL DEFAULT 'onboarding',
  confidence_score NUMERIC(3,2) CHECK (confidence_score IS NULL OR (confidence_score BETWEEN 0 AND 1)),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_constraints_user
  ON public.user_constraints(user_id);
CREATE INDEX IF NOT EXISTS idx_user_constraints_user_dim_active
  ON public.user_constraints(user_id, dimension, is_active);
CREATE INDEX IF NOT EXISTS idx_user_constraints_user_created
  ON public.user_constraints(user_id, created_at DESC);

ALTER TABLE public.user_constraints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_constraints_owner_all"
  ON public.user_constraints
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_constraints_service_role"
  ON public.user_constraints
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER set_user_constraints_updated_at
  BEFORE UPDATE ON public.user_constraints
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 3. user_decision_preferences
-- The four canonical decision axes; weights sum is informational, not enforced.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_decision_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  axis TEXT NOT NULL
    CHECK (axis IN ('speed', 'certainty', 'flexibility', 'upside')),
  weight NUMERIC(3,2) NOT NULL CHECK (weight BETWEEN 0 AND 1),
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'onboarding',
  confidence_score NUMERIC(3,2) CHECK (confidence_score IS NULL OR (confidence_score BETWEEN 0 AND 1)),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, axis)
);

CREATE INDEX IF NOT EXISTS idx_user_decision_prefs_user
  ON public.user_decision_preferences(user_id);

ALTER TABLE public.user_decision_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_decision_prefs_owner_all"
  ON public.user_decision_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_decision_prefs_service_role"
  ON public.user_decision_preferences
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER set_user_decision_prefs_updated_at
  BEFORE UPDATE ON public.user_decision_preferences
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 4. user_commitment_levels
-- How much energy / time can the user invest per domain over a given window.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_commitment_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  domain TEXT NOT NULL
    CHECK (domain IN ('financial', 'career', 'education', 'health', 'family', 'wellness', 'lifestyle', 'overall')),
  hours_per_week NUMERIC(5,2) CHECK (hours_per_week IS NULL OR hours_per_week >= 0),
  energy_level TEXT
    CHECK (energy_level IS NULL OR energy_level IN ('low', 'medium', 'high')),
  duration_weeks INT CHECK (duration_weeks IS NULL OR duration_weeks > 0),
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'onboarding',
  confidence_score NUMERIC(3,2) CHECK (confidence_score IS NULL OR (confidence_score BETWEEN 0 AND 1)),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_user_commitment_user
  ON public.user_commitment_levels(user_id);

ALTER TABLE public.user_commitment_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_commitment_owner_all"
  ON public.user_commitment_levels
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_commitment_service_role"
  ON public.user_commitment_levels
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER set_user_commitment_updated_at
  BEFORE UPDATE ON public.user_commitment_levels
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 5. user_motivations
-- The "why" behind a goal or set of goals. Optional FK to goals.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_motivations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES public.goals(id) ON DELETE CASCADE,
  motivation_text TEXT NOT NULL,
  motivation_type TEXT
    CHECK (motivation_type IS NULL OR motivation_type IN ('intrinsic', 'extrinsic', 'values_based', 'identity', 'fear_based')),
  intensity INT CHECK (intensity IS NULL OR (intensity BETWEEN 1 AND 10)),
  source TEXT NOT NULL DEFAULT 'onboarding',
  confidence_score NUMERIC(3,2) CHECK (confidence_score IS NULL OR (confidence_score BETWEEN 0 AND 1)),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_motivations_user
  ON public.user_motivations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_motivations_goal
  ON public.user_motivations(goal_id) WHERE goal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_motivations_user_created
  ON public.user_motivations(user_id, created_at DESC);

ALTER TABLE public.user_motivations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_motivations_owner_all"
  ON public.user_motivations
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_motivations_service_role"
  ON public.user_motivations
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER set_user_motivations_updated_at
  BEFORE UPDATE ON public.user_motivations
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 6. user_domain_risk_tolerance
-- One row per (user_id, domain). Domains: financial, career, education,
-- health, entrepreneurship.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_domain_risk_tolerance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  domain TEXT NOT NULL
    CHECK (domain IN ('financial', 'career', 'education', 'health', 'entrepreneurship')),
  tolerance_score NUMERIC(3,2) NOT NULL CHECK (tolerance_score BETWEEN 0 AND 1),
  qualitative_level TEXT
    CHECK (qualitative_level IS NULL OR qualitative_level IN ('very_conservative', 'conservative', 'moderate', 'growth_oriented', 'aggressive')),
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'onboarding',
  confidence_score NUMERIC(3,2) CHECK (confidence_score IS NULL OR (confidence_score BETWEEN 0 AND 1)),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_user_domain_risk_user
  ON public.user_domain_risk_tolerance(user_id);

ALTER TABLE public.user_domain_risk_tolerance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_domain_risk_owner_all"
  ON public.user_domain_risk_tolerance
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_domain_risk_service_role"
  ON public.user_domain_risk_tolerance
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER set_user_domain_risk_updated_at
  BEFORE UPDATE ON public.user_domain_risk_tolerance
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 7. user_capabilities
-- Self-assessed (or system-inferred) capabilities/skills used by the
-- decision engine to weight feasibility of recommendations.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  capability_name TEXT NOT NULL,
  domain TEXT,                            -- optional categorization
  proficiency_level TEXT NOT NULL DEFAULT 'novice'
    CHECK (proficiency_level IN ('novice', 'intermediate', 'advanced', 'expert')),
  self_assessed BOOLEAN NOT NULL DEFAULT TRUE,
  evidence TEXT,                          -- optional supporting note
  last_used_at DATE,
  source TEXT NOT NULL DEFAULT 'onboarding',
  confidence_score NUMERIC(3,2) CHECK (confidence_score IS NULL OR (confidence_score BETWEEN 0 AND 1)),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, capability_name)
);

CREATE INDEX IF NOT EXISTS idx_user_capabilities_user
  ON public.user_capabilities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_capabilities_user_domain
  ON public.user_capabilities(user_id, domain);

ALTER TABLE public.user_capabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_capabilities_owner_all"
  ON public.user_capabilities
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_capabilities_service_role"
  ON public.user_capabilities
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER set_user_capabilities_updated_at
  BEFORE UPDATE ON public.user_capabilities
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 9. user_decisions  (declared before user_recommendations and user_outcomes
-- so their FK targets exist)
-- A record that a user weighed options and chose one. The decision engine
-- and graphrag pipeline consume these to learn preferences.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  decision_type TEXT,                     -- e.g. 'investment_allocation', 'job_offer', 'enrollment'
  title TEXT NOT NULL,
  description TEXT,
  options_considered JSONB NOT NULL DEFAULT '[]',
  chosen_option JSONB,                    -- snapshot of the selected option
  rationale TEXT,
  reversibility TEXT
    CHECK (reversibility IS NULL OR reversibility IN ('reversible', 'partial', 'irreversible')),
  status TEXT NOT NULL DEFAULT 'made'
    CHECK (status IN ('considering', 'made', 'reverted', 'superseded')),
  made_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'manual',
  confidence_score NUMERIC(3,2) CHECK (confidence_score IS NULL OR (confidence_score BETWEEN 0 AND 1)),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_decisions_user
  ON public.user_decisions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_decisions_user_status
  ON public.user_decisions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_decisions_user_created
  ON public.user_decisions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_decisions_goal
  ON public.user_decisions(goal_id) WHERE goal_id IS NOT NULL;

ALTER TABLE public.user_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_decisions_owner_all"
  ON public.user_decisions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_decisions_service_role"
  ON public.user_decisions
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER set_user_decisions_updated_at
  BEFORE UPDATE ON public.user_decisions
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 10. user_recommendations
-- Output of the recommendation engine; lifecycle: pending -> accepted /
-- rejected / expired / snoozed.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  decision_id UUID REFERENCES public.user_decisions(id) ON DELETE SET NULL,
  source_agent TEXT NOT NULL DEFAULT 'system',
  action TEXT NOT NULL,
  rationale TEXT,
  expected_impact TEXT,                   -- 'low' | 'medium' | 'high' (kept open as TEXT)
  priority INT NOT NULL DEFAULT 50 CHECK (priority BETWEEN 0 AND 100),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'snoozed', 'completed')),
  expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  snoozed_until TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'system',
  confidence_score NUMERIC(3,2) CHECK (confidence_score IS NULL OR (confidence_score BETWEEN 0 AND 1)),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_recommendations_user
  ON public.user_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_recommendations_user_status
  ON public.user_recommendations(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_recommendations_user_priority
  ON public.user_recommendations(user_id, priority DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_recommendations_goal
  ON public.user_recommendations(goal_id) WHERE goal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_recommendations_decision
  ON public.user_recommendations(decision_id) WHERE decision_id IS NOT NULL;

ALTER TABLE public.user_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_recommendations_owner_all"
  ON public.user_recommendations
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_recommendations_service_role"
  ON public.user_recommendations
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER set_user_recommendations_updated_at
  BEFORE UPDATE ON public.user_recommendations
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 8. user_outcomes
-- Observed result of a goal, decision, or recommendation. The Decision
-- Engine's feedback loop reads this table.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  decision_id UUID REFERENCES public.user_decisions(id) ON DELETE SET NULL,
  recommendation_id UUID REFERENCES public.user_recommendations(id) ON DELETE SET NULL,
  outcome_type TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (outcome_type IN ('achieved', 'missed', 'abandoned', 'in_progress', 'exceeded', 'deferred')),
  observed_value NUMERIC,
  observed_unit TEXT,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attribution_confidence NUMERIC(3,2) CHECK (attribution_confidence IS NULL OR (attribution_confidence BETWEEN 0 AND 1)),
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  confidence_score NUMERIC(3,2) CHECK (confidence_score IS NULL OR (confidence_score BETWEEN 0 AND 1)),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    goal_id IS NOT NULL
    OR decision_id IS NOT NULL
    OR recommendation_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_user_outcomes_user
  ON public.user_outcomes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_outcomes_user_observed
  ON public.user_outcomes(user_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_outcomes_goal
  ON public.user_outcomes(goal_id) WHERE goal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_outcomes_decision
  ON public.user_outcomes(decision_id) WHERE decision_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_outcomes_recommendation
  ON public.user_outcomes(recommendation_id) WHERE recommendation_id IS NOT NULL;

ALTER TABLE public.user_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_outcomes_owner_all"
  ON public.user_outcomes
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_outcomes_service_role"
  ON public.user_outcomes
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER set_user_outcomes_updated_at
  BEFORE UPDATE ON public.user_outcomes
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- Backfill: ensure profiles has an onboarding-step marker we can flip when
-- the new step set is captured. (No-op if columns already exist.)
-- -------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_graph_captured_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.user_graph_captured_at IS
  'Timestamp when the user first completed the extended user-graph onboarding (vision/constraints/preferences/risk/commitment/motivations).';
