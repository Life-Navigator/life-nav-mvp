-- ==========================================================================
-- 061: User Graph Expansion
--   * Adds user_actions and user_life_events
--   * Backfills a `domain` column on the 10 user_graph tables from 060
--   * Expands the decision-preference axes set (downside / stress / cost /
--     long_term_net_worth / healthspan / family_stability)
-- ==========================================================================

-- -------------------------------------------------------------------------
-- 1. domain column on the existing user-graph tables
-- -------------------------------------------------------------------------
ALTER TABLE public.user_life_vision
  ADD COLUMN IF NOT EXISTS domain TEXT;
ALTER TABLE public.user_constraints
  ADD COLUMN IF NOT EXISTS domain TEXT;
ALTER TABLE public.user_decision_preferences
  ADD COLUMN IF NOT EXISTS domain TEXT;
ALTER TABLE public.user_commitment_levels
  ADD COLUMN IF NOT EXISTS domain TEXT;
ALTER TABLE public.user_motivations
  ADD COLUMN IF NOT EXISTS domain TEXT;
ALTER TABLE public.user_domain_risk_tolerance
  ADD COLUMN IF NOT EXISTS domain_meta TEXT;          -- domain already exists; meta for sub-domain
ALTER TABLE public.user_capabilities
  ADD COLUMN IF NOT EXISTS domain_meta TEXT;          -- domain already exists; meta for sub-domain
ALTER TABLE public.user_decisions
  ADD COLUMN IF NOT EXISTS domain TEXT;
ALTER TABLE public.user_recommendations
  ADD COLUMN IF NOT EXISTS domain TEXT;
ALTER TABLE public.user_outcomes
  ADD COLUMN IF NOT EXISTS domain TEXT;

-- Backfill existing rows where we can infer a domain.
UPDATE public.user_constraints
   SET domain = CASE dimension
     WHEN 'money'     THEN 'financial'
     WHEN 'time'      THEN 'lifestyle'
     WHEN 'health'    THEN 'health'
     WHEN 'family'    THEN 'family'
     WHEN 'geography' THEN 'lifestyle'
     ELSE 'overall'
   END
 WHERE domain IS NULL;

UPDATE public.user_commitment_levels
   SET domain = domain   -- no-op (column existed before; new domain col simply mirrors)
 WHERE FALSE;

-- -------------------------------------------------------------------------
-- 2. Expand decision-preference axes
-- -------------------------------------------------------------------------
ALTER TABLE public.user_decision_preferences
  DROP CONSTRAINT IF EXISTS user_decision_preferences_axis_check;

ALTER TABLE public.user_decision_preferences
  ADD CONSTRAINT user_decision_preferences_axis_check
  CHECK (axis IN (
    'speed',
    'certainty',
    'flexibility',
    'upside',
    'minimize_downside',
    'minimize_stress',
    'minimize_cost',
    'maximize_long_term_net_worth',
    'maximize_healthspan',
    'maximize_family_stability'
  ));

-- -------------------------------------------------------------------------
-- 3. user_actions
--   A first-party log of actions the user takes, with optional FK back to
--   the goal / decision / recommendation that motivated them. Decision
--   Engine reads this to attribute outcomes.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  domain TEXT,                                  -- 'financial' | 'career' | ...
  action_type TEXT NOT NULL,                    -- e.g. 'opened_account', 'submitted_application'
  action_title TEXT NOT NULL,
  description TEXT,
  goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  decision_id UUID REFERENCES public.user_decisions(id) ON DELETE SET NULL,
  recommendation_id UUID REFERENCES public.user_recommendations(id) ON DELETE SET NULL,
  taken_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effort_minutes INT CHECK (effort_minutes IS NULL OR effort_minutes >= 0),
  cost_amount NUMERIC,
  cost_currency TEXT DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  source TEXT NOT NULL DEFAULT 'manual',
  confidence_score NUMERIC(3,2) CHECK (confidence_score IS NULL OR (confidence_score BETWEEN 0 AND 1)),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_actions_user           ON public.user_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_actions_user_taken     ON public.user_actions(user_id, taken_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_actions_user_domain    ON public.user_actions(user_id, domain);
CREATE INDEX IF NOT EXISTS idx_user_actions_goal           ON public.user_actions(goal_id) WHERE goal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_actions_decision       ON public.user_actions(decision_id) WHERE decision_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_actions_recommendation ON public.user_actions(recommendation_id) WHERE recommendation_id IS NOT NULL;

ALTER TABLE public.user_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_actions_owner_all" ON public.user_actions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_actions_service_role" ON public.user_actions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER set_user_actions_updated_at
  BEFORE UPDATE ON public.user_actions
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 4. user_life_events
--   Significant life events that warrant re-running personalization
--   (marriage, divorce, birth, job change, relocation, diagnosis, layoff).
--   Both observed and anticipated events are captured.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_life_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  domain TEXT,
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'marriage', 'divorce', 'birth', 'death',
      'job_change', 'job_loss', 'promotion',
      'relocation', 'home_purchase', 'home_sale',
      'enrollment', 'graduation',
      'diagnosis', 'recovery', 'injury',
      'inheritance', 'windfall', 'major_purchase',
      'retirement', 'pet_added', 'other'
    )),
  event_title TEXT NOT NULL,
  description TEXT,
  occurred_at DATE,                  -- when it happened (if observed)
  expected_at DATE,                  -- when it is expected (if anticipated)
  is_anticipated BOOLEAN NOT NULL DEFAULT FALSE,
  impact_level TEXT
    CHECK (impact_level IS NULL OR impact_level IN ('low', 'medium', 'high', 'major')),
  related_goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  confidence_score NUMERIC(3,2) CHECK (confidence_score IS NULL OR (confidence_score BETWEEN 0 AND 1)),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (occurred_at IS NOT NULL OR expected_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_user_life_events_user          ON public.user_life_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_life_events_user_occurred ON public.user_life_events(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_life_events_user_expected ON public.user_life_events(user_id, expected_at);
CREATE INDEX IF NOT EXISTS idx_user_life_events_user_type     ON public.user_life_events(user_id, event_type);

ALTER TABLE public.user_life_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_life_events_owner_all" ON public.user_life_events
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_life_events_service_role" ON public.user_life_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER set_user_life_events_updated_at
  BEFORE UPDATE ON public.user_life_events
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
