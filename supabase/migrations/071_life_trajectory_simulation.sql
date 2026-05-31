-- ==========================================================================
-- 071: Life Trajectory Simulation Engine
--
--   life_scenarios + scenario_versions + decisions + assumptions +
--   outputs + metrics + events + comparisons + trajectory_snapshots
--
-- Modeled on the existing Scenario Lab pattern (versions, audit log) so
-- the simulator can swap in / out without changing the visualisation
-- shell.
-- ==========================================================================

-- 1. life_scenarios (parent)
CREATE TABLE IF NOT EXISTS public.life_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  domain TEXT,                                       -- 'financial' | 'career' | 'health' | 'multi'
  primary_goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','archived')),
  source TEXT NOT NULL DEFAULT 'user',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_life_scenarios_user
  ON public.life_scenarios(user_id);
ALTER TABLE public.life_scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ls_owner_all" ON public.life_scenarios
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ls_service_role" ON public.life_scenarios
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_life_scenarios_updated_at
  BEFORE UPDATE ON public.life_scenarios
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

-- 2. life_scenario_versions
CREATE TABLE IF NOT EXISTS public.life_scenario_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scenario_id UUID NOT NULL REFERENCES public.life_scenarios(id) ON DELETE CASCADE,
  version_index INT NOT NULL CHECK (version_index >= 0),
  label TEXT,                                        -- 'conservative' | 'balanced' | 'aggressive' | 'goal_optimized'
  horizon_years INT NOT NULL CHECK (horizon_years > 0 AND horizon_years <= 60),
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created','simulating','completed','failed')),
  ran_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'engine',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (scenario_id, version_index)
);
CREATE INDEX IF NOT EXISTS idx_lsv_user      ON public.life_scenario_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_lsv_scenario  ON public.life_scenario_versions(scenario_id);
ALTER TABLE public.life_scenario_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lsv_owner_all" ON public.life_scenario_versions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lsv_service_role" ON public.life_scenario_versions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_lsv_updated_at
  BEFORE UPDATE ON public.life_scenario_versions
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

-- 3. life_scenario_decisions
CREATE TABLE IF NOT EXISTS public.life_scenario_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scenario_version_id UUID NOT NULL REFERENCES public.life_scenario_versions(id) ON DELETE CASCADE,
  decision_type TEXT NOT NULL,                       -- 'pay_debt','invest_taxable','enrollment',...
  description TEXT,
  at_month INT NOT NULL DEFAULT 0 CHECK (at_month >= 0),
  amount NUMERIC,
  parameters JSONB NOT NULL DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'engine',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lsd_version_month
  ON public.life_scenario_decisions(scenario_version_id, at_month);
ALTER TABLE public.life_scenario_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lsd_owner_all" ON public.life_scenario_decisions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lsd_service_role" ON public.life_scenario_decisions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_lsd_updated_at
  BEFORE UPDATE ON public.life_scenario_decisions
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

-- 4. life_scenario_assumptions
CREATE TABLE IF NOT EXISTS public.life_scenario_assumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scenario_version_id UUID NOT NULL REFERENCES public.life_scenario_versions(id) ON DELETE CASCADE,
  assumption_key TEXT NOT NULL,
  assumption_value JSONB NOT NULL,
  rationale TEXT,
  source TEXT NOT NULL DEFAULT 'engine',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (scenario_version_id, assumption_key)
);
ALTER TABLE public.life_scenario_assumptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lsa_owner_all" ON public.life_scenario_assumptions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lsa_service_role" ON public.life_scenario_assumptions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_lsa_updated_at
  BEFORE UPDATE ON public.life_scenario_assumptions
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

-- 5. life_scenario_outputs (top-level summary per version)
CREATE TABLE IF NOT EXISTS public.life_scenario_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scenario_version_id UUID NOT NULL UNIQUE REFERENCES public.life_scenario_versions(id) ON DELETE CASCADE,
  final_net_worth NUMERIC,
  final_debt NUMERIC,
  final_annual_income NUMERIC,
  retirement_ready BOOLEAN,
  emergency_fund_months_final NUMERIC,
  health_cost_exposure_final NUMERIC,
  education_roi_pct NUMERIC,
  recommended BOOLEAN NOT NULL DEFAULT FALSE,
  rationale TEXT,
  risks JSONB NOT NULL DEFAULT '[]',
  upside_factors JSONB NOT NULL DEFAULT '[]',
  source TEXT NOT NULL DEFAULT 'engine',
  confidence_score NUMERIC(3,2)
    CHECK (confidence_score IS NULL OR (confidence_score BETWEEN 0 AND 1)),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.life_scenario_outputs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lso_owner_all" ON public.life_scenario_outputs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lso_service_role" ON public.life_scenario_outputs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_lso_updated_at
  BEFORE UPDATE ON public.life_scenario_outputs
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

-- 6. life_scenario_metrics (per-period time series)
CREATE TABLE IF NOT EXISTS public.life_scenario_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scenario_version_id UUID NOT NULL REFERENCES public.life_scenario_versions(id) ON DELETE CASCADE,
  at_month INT NOT NULL CHECK (at_month >= 0),
  metric_key TEXT NOT NULL,                          -- 'net_worth','cash_flow','debt_total','emergency_months',...
  metric_value NUMERIC NOT NULL,
  source TEXT NOT NULL DEFAULT 'engine',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (scenario_version_id, at_month, metric_key)
);
CREATE INDEX IF NOT EXISTS idx_lsm_version_month_key
  ON public.life_scenario_metrics(scenario_version_id, metric_key, at_month);
ALTER TABLE public.life_scenario_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lsm_owner_all" ON public.life_scenario_metrics
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lsm_service_role" ON public.life_scenario_metrics
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_lsm_updated_at
  BEFORE UPDATE ON public.life_scenario_metrics
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

-- 7. life_scenario_events (discrete events on the timeline)
CREATE TABLE IF NOT EXISTS public.life_scenario_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scenario_version_id UUID NOT NULL REFERENCES public.life_scenario_versions(id) ON DELETE CASCADE,
  at_month INT NOT NULL CHECK (at_month >= 0),
  event_type TEXT NOT NULL,                          -- 'job_change','home_purchase','retirement',...
  description TEXT,
  impact JSONB NOT NULL DEFAULT '{}',                -- deltas applied at this event
  source TEXT NOT NULL DEFAULT 'engine',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lse_version_month
  ON public.life_scenario_events(scenario_version_id, at_month);
ALTER TABLE public.life_scenario_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lse_owner_all" ON public.life_scenario_events
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lse_service_role" ON public.life_scenario_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_lse_updated_at
  BEFORE UPDATE ON public.life_scenario_events
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

-- 8. life_scenario_comparisons
CREATE TABLE IF NOT EXISTS public.life_scenario_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scenario_id UUID NOT NULL REFERENCES public.life_scenarios(id) ON DELETE CASCADE,
  version_a_id UUID NOT NULL REFERENCES public.life_scenario_versions(id) ON DELETE CASCADE,
  version_b_id UUID NOT NULL REFERENCES public.life_scenario_versions(id) ON DELETE CASCADE,
  comparison_summary TEXT,
  favored_version_id UUID REFERENCES public.life_scenario_versions(id) ON DELETE SET NULL,
  diffs JSONB NOT NULL DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'engine',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (version_a_id <> version_b_id)
);
ALTER TABLE public.life_scenario_comparisons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lsc_owner_all" ON public.life_scenario_comparisons
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lsc_service_role" ON public.life_scenario_comparisons
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_lsc_updated_at
  BEFORE UPDATE ON public.life_scenario_comparisons
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

-- 9. life_trajectory_snapshots (point-in-time freezes for dashboards)
CREATE TABLE IF NOT EXISTS public.life_trajectory_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  taken_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  net_worth NUMERIC,
  annual_income NUMERIC,
  monthly_cash_flow NUMERIC,
  total_debt NUMERIC,
  emergency_months NUMERIC,
  health_cost_exposure NUMERIC,
  retirement_readiness_pct NUMERIC,
  source TEXT NOT NULL DEFAULT 'engine',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lts_user_time
  ON public.life_trajectory_snapshots(user_id, taken_at DESC);
ALTER TABLE public.life_trajectory_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lts_owner_all" ON public.life_trajectory_snapshots
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lts_service_role" ON public.life_trajectory_snapshots
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_lts_updated_at
  BEFORE UPDATE ON public.life_trajectory_snapshots
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
