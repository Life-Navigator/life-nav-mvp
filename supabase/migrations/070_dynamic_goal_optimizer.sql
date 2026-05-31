-- ==========================================================================
-- 070: Dynamic Goal Optimizer
--
--   * goal_interpretations           — AI/engine inferred true goal
--   * goal_optimizer_runs            — one row per optimizer execution
--   * goal_optimizer_inputs          — frozen input snapshot
--   * goal_optimizer_assumptions     — explicit assumption set
--   * goal_optimizer_allocations     — recommended per-category split
--   * goal_optimizer_tradeoffs       — pairwise tradeoff notes
--   * goal_optimizer_recommendations — the human-readable plan
--   * goal_optimizer_outcomes        — observed result for closing the loop
--
-- All tables: uuid PK, user_id FK CASCADE, source/confidence_score/metadata,
-- updated_at trigger, owner+service_role RLS.
-- ==========================================================================

-- -------------------------------------------------------------------------
-- 1. goal_interpretations
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.goal_interpretations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES public.goals(id) ON DELETE CASCADE,
  stated_goal TEXT NOT NULL,
  inferred_true_goal TEXT NOT NULL,
  alternate_interpretations TEXT[] DEFAULT '{}',
  clarifying_questions JSONB NOT NULL DEFAULT '[]',
  confidence_score NUMERIC(3,2)
    CHECK (confidence_score IS NULL OR (confidence_score BETWEEN 0 AND 1)),
  source TEXT NOT NULL DEFAULT 'engine',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_goal_interp_user
  ON public.goal_interpretations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_goal_interp_goal
  ON public.goal_interpretations(goal_id) WHERE goal_id IS NOT NULL;
ALTER TABLE public.goal_interpretations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gi_owner_all" ON public.goal_interpretations
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gi_service_role" ON public.goal_interpretations
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_goal_interp_updated_at
  BEFORE UPDATE ON public.goal_interpretations
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 2. goal_optimizer_runs (parent — one row per execution)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.goal_optimizer_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  interpretation_id UUID REFERENCES public.goal_interpretations(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('queued', 'running', 'completed', 'failed', 'superseded')),
  engine_version TEXT NOT NULL DEFAULT 'v1',
  monthly_surplus NUMERIC,                           -- discretionary $ allocated
  total_allocation NUMERIC,                          -- sum of allocations (should equal surplus)
  next_best_action TEXT,
  summary TEXT,
  confidence_score NUMERIC(3,2)
    CHECK (confidence_score IS NULL OR (confidence_score BETWEEN 0 AND 1)),
  source TEXT NOT NULL DEFAULT 'engine',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_optimizer_runs_user
  ON public.goal_optimizer_runs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_optimizer_runs_user_status
  ON public.goal_optimizer_runs(user_id, status);
ALTER TABLE public.goal_optimizer_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gor_owner_all" ON public.goal_optimizer_runs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gor_service_role" ON public.goal_optimizer_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_optimizer_runs_updated_at
  BEFORE UPDATE ON public.goal_optimizer_runs
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 3. goal_optimizer_inputs (frozen snapshot of what the engine read)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.goal_optimizer_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES public.goal_optimizer_runs(id) ON DELETE CASCADE,
  inputs JSONB NOT NULL DEFAULT '{}',                -- canonical input snapshot
  source TEXT NOT NULL DEFAULT 'engine',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_optimizer_inputs_run
  ON public.goal_optimizer_inputs(run_id);
ALTER TABLE public.goal_optimizer_inputs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goi_owner_all" ON public.goal_optimizer_inputs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "goi_service_role" ON public.goal_optimizer_inputs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_optimizer_inputs_updated_at
  BEFORE UPDATE ON public.goal_optimizer_inputs
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 4. goal_optimizer_assumptions
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.goal_optimizer_assumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES public.goal_optimizer_runs(id) ON DELETE CASCADE,
  assumption_key TEXT NOT NULL,                      -- 'expected_return_pct','inflation_pct',...
  assumption_value JSONB NOT NULL,
  rationale TEXT,
  source TEXT NOT NULL DEFAULT 'engine',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_optimizer_assumptions_run
  ON public.goal_optimizer_assumptions(run_id);
ALTER TABLE public.goal_optimizer_assumptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goa_owner_all" ON public.goal_optimizer_assumptions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "goa_service_role" ON public.goal_optimizer_assumptions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_optimizer_assumptions_updated_at
  BEFORE UPDATE ON public.goal_optimizer_assumptions
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 5. goal_optimizer_allocations (per-category recommended split)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.goal_optimizer_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES public.goal_optimizer_runs(id) ON DELETE CASCADE,
  category TEXT NOT NULL
    CHECK (category IN (
      'emergency_fund', 'high_interest_debt', 'low_interest_debt',
      'retirement_match', 'retirement_contribution', 'hsa_contribution',
      'taxable_investing', 'education_investment', 'career_development',
      'insurance_gap_coverage', 'health_wellness_investment',
      'home_down_payment_fund', 'cash_reserve'
    )),
  amount_usd NUMERIC NOT NULL DEFAULT 0,
  share_pct NUMERIC(5,2) CHECK (share_pct IS NULL OR share_pct BETWEEN 0 AND 100),
  priority INT NOT NULL DEFAULT 50 CHECK (priority BETWEEN 0 AND 100),
  rationale TEXT,
  category_score NUMERIC,                            -- raw deterministic score
  source TEXT NOT NULL DEFAULT 'engine',
  confidence_score NUMERIC(3,2)
    CHECK (confidence_score IS NULL OR (confidence_score BETWEEN 0 AND 1)),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (run_id, category)
);
CREATE INDEX IF NOT EXISTS idx_optimizer_alloc_user
  ON public.goal_optimizer_allocations(user_id);
CREATE INDEX IF NOT EXISTS idx_optimizer_alloc_run_priority
  ON public.goal_optimizer_allocations(run_id, priority DESC);
ALTER TABLE public.goal_optimizer_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goal_alloc_owner_all" ON public.goal_optimizer_allocations
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "goal_alloc_service_role" ON public.goal_optimizer_allocations
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_optimizer_alloc_updated_at
  BEFORE UPDATE ON public.goal_optimizer_allocations
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 6. goal_optimizer_tradeoffs (pairwise)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.goal_optimizer_tradeoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES public.goal_optimizer_runs(id) ON DELETE CASCADE,
  axis_a TEXT NOT NULL,                              -- e.g. 'pay_debt'
  axis_b TEXT NOT NULL,                              -- e.g. 'invest_taxable'
  tradeoff_summary TEXT NOT NULL,
  favored_axis TEXT,                                  -- 'a' | 'b' | 'balanced'
  source TEXT NOT NULL DEFAULT 'engine',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_optimizer_tradeoffs_run
  ON public.goal_optimizer_tradeoffs(run_id);
ALTER TABLE public.goal_optimizer_tradeoffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "got_owner_all" ON public.goal_optimizer_tradeoffs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "got_service_role" ON public.goal_optimizer_tradeoffs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_optimizer_tradeoffs_updated_at
  BEFORE UPDATE ON public.goal_optimizer_tradeoffs
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 7. goal_optimizer_recommendations (the user-facing plan)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.goal_optimizer_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES public.goal_optimizer_runs(id) ON DELETE CASCADE,
  user_recommendation_id UUID REFERENCES public.user_recommendations(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','rejected','modified','expired')),
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'engine',
  confidence_score NUMERIC(3,2)
    CHECK (confidence_score IS NULL OR (confidence_score BETWEEN 0 AND 1)),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_optimizer_rec_user
  ON public.goal_optimizer_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_optimizer_rec_run_status
  ON public.goal_optimizer_recommendations(run_id, status);
ALTER TABLE public.goal_optimizer_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gor_rec_owner_all" ON public.goal_optimizer_recommendations
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gor_rec_service_role" ON public.goal_optimizer_recommendations
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_optimizer_rec_updated_at
  BEFORE UPDATE ON public.goal_optimizer_recommendations
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 8. goal_optimizer_outcomes (close-the-loop)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.goal_optimizer_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES public.goal_optimizer_runs(id) ON DELETE CASCADE,
  user_outcome_id UUID REFERENCES public.user_outcomes(id) ON DELETE SET NULL,
  observed_metric TEXT NOT NULL,                     -- 'net_worth_delta','debt_balance','emergency_months'...
  observed_value NUMERIC NOT NULL,
  observed_unit TEXT,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attribution_confidence NUMERIC(3,2)
    CHECK (attribution_confidence IS NULL OR (attribution_confidence BETWEEN 0 AND 1)),
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'engine',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_optimizer_outcomes_run
  ON public.goal_optimizer_outcomes(run_id);
ALTER TABLE public.goal_optimizer_outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goo_owner_all" ON public.goal_optimizer_outcomes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "goo_service_role" ON public.goal_optimizer_outcomes
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_optimizer_outcomes_updated_at
  BEFORE UPDATE ON public.goal_optimizer_outcomes
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
