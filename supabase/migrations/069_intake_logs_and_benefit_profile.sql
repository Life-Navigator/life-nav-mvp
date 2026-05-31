-- ==========================================================================
-- 069: Daily logs + benefit profile + health profile singleton
--
-- Closes the small gap from the Prompt-1 table list against migrations 060–068:
--
--   * health_meta.workout_logs           (daily/per-session log)
--   * health_meta.supplement_logs        (per-day supplement intake log)
--   * health_meta.medication_logs        (per-day medication adherence log)
--   * health_meta.health_profile         (one-row summary per user)
--   * public.benefit_profiles            (combined employer + government
--                                          benefits snapshot, distinct from
--                                          finance.employer_benefits which is
--                                          comp/401k-focused)
--
-- All health_meta tables continue to ride the is_health_enabled() gate from
-- migration 038, with service_role bypass.
-- ==========================================================================

-- -------------------------------------------------------------------------
-- 1. health_meta.workout_logs
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS health_meta.workout_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modality TEXT NOT NULL,                            -- 'strength' | 'run' | 'swim' | 'yoga' | ...
  session_name TEXT,
  duration_minutes INT CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
  intensity TEXT CHECK (intensity IS NULL OR intensity IN ('light', 'moderate', 'hard', 'max')),
  rpe INT CHECK (rpe IS NULL OR (rpe BETWEEN 1 AND 10)),
  calories_burned NUMERIC,
  distance_m NUMERIC,
  avg_heart_rate_bpm NUMERIC,
  max_heart_rate_bpm NUMERIC,
  notes TEXT,
  exercises JSONB NOT NULL DEFAULT '[]',             -- [{name,sets,reps,load,unit,notes}]
  source TEXT NOT NULL DEFAULT 'manual',
  confidence_score NUMERIC(3,2)
    CHECK (confidence_score IS NULL OR (confidence_score BETWEEN 0 AND 1)),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_workout_logs_user_time
  ON health_meta.workout_logs(user_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_workout_logs_user_modality
  ON health_meta.workout_logs(user_id, modality);
ALTER TABLE health_meta.workout_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "health_gate_workouts" ON health_meta.workout_logs
  FOR ALL USING (public.is_health_enabled() AND auth.uid() = user_id)
  WITH CHECK (public.is_health_enabled() AND auth.uid() = user_id);
CREATE POLICY "service_workouts" ON health_meta.workout_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_workout_logs_updated_at
  BEFORE UPDATE ON health_meta.workout_logs
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 2. health_meta.supplement_logs (per-day adherence)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS health_meta.supplement_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  supplement_id UUID REFERENCES health_meta.supplements(id) ON DELETE SET NULL,
  observed_on DATE NOT NULL,
  name TEXT NOT NULL,
  taken_doses INT NOT NULL DEFAULT 1 CHECK (taken_doses >= 0),
  planned_doses INT NOT NULL DEFAULT 1 CHECK (planned_doses >= 0),
  dose TEXT,
  unit TEXT,
  adherence_score INT
    CHECK (adherence_score IS NULL OR (adherence_score BETWEEN 0 AND 10)),
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name, observed_on)
);
CREATE INDEX IF NOT EXISTS idx_supplement_logs_user_day
  ON health_meta.supplement_logs(user_id, observed_on DESC);
ALTER TABLE health_meta.supplement_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "health_gate_supplog" ON health_meta.supplement_logs
  FOR ALL USING (public.is_health_enabled() AND auth.uid() = user_id)
  WITH CHECK (public.is_health_enabled() AND auth.uid() = user_id);
CREATE POLICY "service_supplog" ON health_meta.supplement_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_supplement_logs_updated_at
  BEFORE UPDATE ON health_meta.supplement_logs
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 3. health_meta.medication_logs (per-day adherence)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS health_meta.medication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  medication_id UUID REFERENCES health_meta.medications(id) ON DELETE SET NULL,
  observed_on DATE NOT NULL,
  name TEXT NOT NULL,
  taken_doses INT NOT NULL DEFAULT 1 CHECK (taken_doses >= 0),
  planned_doses INT NOT NULL DEFAULT 1 CHECK (planned_doses >= 0),
  dose TEXT,
  unit TEXT,
  side_effects TEXT,
  notes_encrypted TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name, observed_on)
);
CREATE INDEX IF NOT EXISTS idx_medication_logs_user_day
  ON health_meta.medication_logs(user_id, observed_on DESC);
ALTER TABLE health_meta.medication_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "health_gate_medlog" ON health_meta.medication_logs
  FOR ALL USING (public.is_health_enabled() AND auth.uid() = user_id)
  WITH CHECK (public.is_health_enabled() AND auth.uid() = user_id);
CREATE POLICY "service_medlog" ON health_meta.medication_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_medication_logs_updated_at
  BEFORE UPDATE ON health_meta.medication_logs
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 4. health_meta.health_profile (one-row summary per user)
--   This is the "single source of truth" surface for downstream agents.
--   It complements training_profile + nutrition_profile from 063 by
--   surfacing high-level intent (goals, preferences, communication style).
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS health_meta.health_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  primary_health_goal TEXT,                          -- 'fat_loss','muscle_gain','longevity','energy','performance', ...
  secondary_health_goals TEXT[] DEFAULT '{}',
  arcana_optimization_consented BOOLEAN DEFAULT FALSE,
  share_with_physician BOOLEAN DEFAULT FALSE,
  preferred_communication_cadence TEXT
    CHECK (preferred_communication_cadence IS NULL OR
           preferred_communication_cadence IN ('daily','weekly','biweekly','monthly')),
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'onboarding',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE health_meta.health_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "health_gate_profile" ON health_meta.health_profile
  FOR ALL USING (public.is_health_enabled() AND auth.uid() = user_id)
  WITH CHECK (public.is_health_enabled() AND auth.uid() = user_id);
CREATE POLICY "service_health_profile" ON health_meta.health_profile
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_health_profile_updated_at
  BEFORE UPDATE ON health_meta.health_profile
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 5. public.benefit_profiles (employer + government benefits snapshot)
--   Distinct from finance.employer_benefits (comp / 401k focused). This
--   captures the wider benefits surface — wellness stipends, education
--   reimbursement programs, dependent care FSA, ESPP, etc.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.benefit_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  has_employer_wellness_stipend BOOLEAN,
  wellness_stipend_annual NUMERIC,
  has_education_reimbursement BOOLEAN,
  education_reimbursement_annual NUMERIC,
  has_commuter_benefits BOOLEAN,
  has_dependent_care_fsa BOOLEAN,
  dependent_care_fsa_election NUMERIC,
  has_espp BOOLEAN,
  espp_discount_percent NUMERIC,
  has_legal_plan BOOLEAN,
  has_pet_insurance BOOLEAN,
  has_va_benefits BOOLEAN,
  has_medicare BOOLEAN,
  has_medicaid BOOLEAN,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'onboarding',
  confidence_score NUMERIC(3,2)
    CHECK (confidence_score IS NULL OR (confidence_score BETWEEN 0 AND 1)),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.benefit_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "benefit_profiles_owner_all" ON public.benefit_profiles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "benefit_profiles_service_role" ON public.benefit_profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_benefit_profiles_updated_at
  BEFORE UPDATE ON public.benefit_profiles
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
