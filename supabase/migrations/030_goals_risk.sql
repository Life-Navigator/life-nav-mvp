-- ==========================================================================
-- 030: Goals Extension & Risk Assessment
-- Extends existing goals table, adds risk assessment system
-- ==========================================================================

-- Extend goals with fields from Prisma model not yet in Supabase
ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS target_value NUMERIC,
  ADD COLUMN IF NOT EXISTS current_value NUMERIC,
  ADD COLUMN IF NOT EXISTS starting_value NUMERIC,
  ADD COLUMN IF NOT EXISTS unit TEXT,
  ADD COLUMN IF NOT EXISTS time_horizon TEXT,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS smart_specific TEXT,
  ADD COLUMN IF NOT EXISTS smart_measurable TEXT,
  ADD COLUMN IF NOT EXISTS smart_achievable TEXT,
  ADD COLUMN IF NOT EXISTS smart_relevant TEXT,
  ADD COLUMN IF NOT EXISTS smart_time_bound TEXT;

-- Goal benefits
CREATE TABLE IF NOT EXISTS public.goal_benefits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  impact_score INT CHECK (impact_score BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_goal_benefits_goal ON public.goal_benefits(goal_id);
ALTER TABLE public.goal_benefits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_benefits" ON public.goal_benefits
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Goal updates / progress entries
CREATE TABLE IF NOT EXISTS public.goal_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  value_at_update NUMERIC,
  percentage_at_update NUMERIC,
  notes TEXT,
  challenges TEXT,
  lessons_learned TEXT,
  next_steps TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_goal_updates_goal ON public.goal_updates(goal_id, created_at DESC);
ALTER TABLE public.goal_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_updates" ON public.goal_updates
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Goal reminders
CREATE TABLE IF NOT EXISTS public.goal_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL DEFAULT 'check_in',
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  message TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_goal_reminders_active ON public.goal_reminders(user_id, is_active, scheduled_at)
  WHERE is_active = TRUE;
ALTER TABLE public.goal_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_reminders" ON public.goal_reminders
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Goal dependencies
CREATE TABLE IF NOT EXISTS public.goal_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  depends_on_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'prerequisite',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(goal_id, depends_on_id),
  CHECK (goal_id != depends_on_id)
);

ALTER TABLE public.goal_dependencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_deps" ON public.goal_dependencies
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.goals WHERE id = goal_id AND user_id = auth.uid())
  );

-- Benefit ranking (user priority rankings)
CREATE TABLE IF NOT EXISTS public.benefit_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  benefit_name TEXT NOT NULL,
  rank_position INT NOT NULL,
  importance_score INT CHECK (importance_score BETWEEN 1 AND 10),
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, category, benefit_name)
);

ALTER TABLE public.benefit_rankings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_rankings" ON public.benefit_rankings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================================
-- Risk Assessment System
-- =========================================

CREATE TABLE IF NOT EXISTS public.risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assessment_type TEXT NOT NULL DEFAULT 'comprehensive',
  status TEXT NOT NULL DEFAULT 'in_progress',
  overall_risk_score NUMERIC,
  risk_tolerance TEXT, -- conservative, moderate, aggressive
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_risk_assessments_user ON public.risk_assessments(user_id, created_at DESC);

ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_assessments" ON public.risk_assessments
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Assessment questions
CREATE TABLE IF NOT EXISTS public.assessment_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.risk_assessments(id) ON DELETE CASCADE,
  question_key TEXT NOT NULL,
  question_text TEXT NOT NULL,
  category TEXT NOT NULL,
  weight NUMERIC NOT NULL DEFAULT 1.0,
  order_index INT NOT NULL,
  options JSONB, -- available answer options
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assessment_questions ON public.assessment_questions(assessment_id, order_index);

ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_questions" ON public.assessment_questions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.risk_assessments WHERE id = assessment_id AND user_id = auth.uid())
  );

-- Assessment answers
CREATE TABLE IF NOT EXISTS public.assessment_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  answer_value JSONB NOT NULL,
  score NUMERIC,
  confidence NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(question_id, user_id)
);

ALTER TABLE public.assessment_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_answers" ON public.assessment_answers
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Risk category scores
CREATE TABLE IF NOT EXISTS public.risk_category_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.risk_assessments(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  score NUMERIC NOT NULL,
  max_score NUMERIC NOT NULL,
  risk_level TEXT, -- low, medium, high, critical
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(assessment_id, category)
);

ALTER TABLE public.risk_category_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_scores" ON public.risk_category_scores
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.risk_assessments WHERE id = assessment_id AND user_id = auth.uid())
  );

-- Risk recommendations
CREATE TABLE IF NOT EXISTS public.risk_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.risk_assessments(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  priority INT NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  action_items JSONB DEFAULT '[]',
  impact_level TEXT, -- low, medium, high
  effort_level TEXT, -- low, medium, high
  status TEXT NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.risk_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_recs" ON public.risk_recommendations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.risk_assessments WHERE id = assessment_id AND user_id = auth.uid())
  );
