-- ==========================================================================
-- 063: Health / Arcana Intake Expansion
--
--   Every table created here lives under the existing `health_meta` schema
--   and is gated by `public.is_health_enabled()` so the data structures
--   exist before the feature flips on. The gating pattern matches the
--   tables added in 038_health_locked.sql.
--
--   When the health feature ships, flipping is_health_enabled() to TRUE
--   atomically unlocks all of these tables for owner reads/writes.
--
--   Service role bypasses the gate so Arcana lead generation, GraphRAG
--   sync, and ingestion workers can run regardless.
-- ==========================================================================

-- -------------------------------------------------------------------------
-- 1. body_measurements  (time-series anthropometrics)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS health_meta.body_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  height_cm NUMERIC,
  weight_kg NUMERIC,
  target_weight_kg NUMERIC,
  body_fat_percent NUMERIC,
  muscle_mass_kg NUMERIC,
  waist_cm NUMERIC,
  neck_cm NUMERIC,
  chest_cm NUMERIC,
  shoulders_cm NUMERIC,
  left_arm_cm NUMERIC,
  right_arm_cm NUMERIC,
  hips_cm NUMERIC,
  left_thigh_cm NUMERIC,
  right_thigh_cm NUMERIC,
  progress_photo_keys TEXT[] DEFAULT '{}',           -- storage keys; signed URLs minted on read

  source TEXT NOT NULL DEFAULT 'manual',
  confidence_score NUMERIC(3,2)
    CHECK (confidence_score IS NULL OR (confidence_score BETWEEN 0 AND 1)),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_body_meas_user_time
  ON health_meta.body_measurements(user_id, measured_at DESC);

ALTER TABLE health_meta.body_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "health_gate_body_meas" ON health_meta.body_measurements
  FOR ALL USING (public.is_health_enabled() AND auth.uid() = user_id)
  WITH CHECK (public.is_health_enabled() AND auth.uid() = user_id);
CREATE POLICY "service_body_meas" ON health_meta.body_measurements
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_body_meas_updated_at
  BEFORE UPDATE ON health_meta.body_measurements
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 2. training_profile  (singleton snapshot of training context)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS health_meta.training_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_level TEXT
    CHECK (activity_level IS NULL OR activity_level IN (
      'sedentary', 'lightly_active', 'moderately_active', 'very_active', 'athlete'
    )),
  years_training INT CHECK (years_training IS NULL OR years_training >= 0),
  training_history TEXT,
  preferred_modalities TEXT[] DEFAULT '{}',          -- ['strength','run','swim','yoga',...]
  disliked_modalities TEXT[] DEFAULT '{}',
  sessions_per_week_target INT,
  session_duration_minutes_target INT,
  walking_tolerance_minutes INT,
  running_tolerance_minutes INT,
  swimming_access BOOLEAN DEFAULT FALSE,
  gym_access BOOLEAN DEFAULT FALSE,
  available_equipment TEXT[] DEFAULT '{}',
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'onboarding',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE health_meta.training_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "health_gate_training" ON health_meta.training_profile
  FOR ALL USING (public.is_health_enabled() AND auth.uid() = user_id)
  WITH CHECK (public.is_health_enabled() AND auth.uid() = user_id);
CREATE POLICY "service_training" ON health_meta.training_profile
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_training_updated_at
  BEFORE UPDATE ON health_meta.training_profile
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 3. injuries  (list)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS health_meta.injuries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body_region TEXT NOT NULL
    CHECK (body_region IN (
      'shoulder', 'elbow', 'wrist', 'neck', 'upper_back', 'lower_back',
      'hip', 'knee', 'ankle', 'foot', 'core', 'chest', 'other'
    )),
  side TEXT CHECK (side IS NULL OR side IN ('left', 'right', 'bilateral', 'na')),
  description TEXT,
  severity TEXT
    CHECK (severity IS NULL OR severity IN ('mild', 'moderate', 'severe', 'chronic')),
  pain_score INT CHECK (pain_score IS NULL OR (pain_score BETWEEN 0 AND 10)),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'managed', 'resolved')),
  onset_date DATE,
  resolution_date DATE,
  affects_modalities TEXT[] DEFAULT '{}',            -- modalities to avoid
  notes_encrypted TEXT,
  source TEXT NOT NULL DEFAULT 'onboarding',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_injuries_user
  ON health_meta.injuries(user_id, status);

ALTER TABLE health_meta.injuries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "health_gate_injuries" ON health_meta.injuries
  FOR ALL USING (public.is_health_enabled() AND auth.uid() = user_id)
  WITH CHECK (public.is_health_enabled() AND auth.uid() = user_id);
CREATE POLICY "service_injuries" ON health_meta.injuries
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_injuries_updated_at
  BEFORE UPDATE ON health_meta.injuries
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 4. mobility_limitations  (list)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS health_meta.mobility_limitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  region TEXT NOT NULL,
  movement TEXT NOT NULL,                             -- 'overhead_press', 'deep_squat', etc.
  severity TEXT
    CHECK (severity IS NULL OR severity IN ('mild', 'moderate', 'severe')),
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'onboarding',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mobility_user
  ON health_meta.mobility_limitations(user_id);

ALTER TABLE health_meta.mobility_limitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "health_gate_mobility" ON health_meta.mobility_limitations
  FOR ALL USING (public.is_health_enabled() AND auth.uid() = user_id)
  WITH CHECK (public.is_health_enabled() AND auth.uid() = user_id);
CREATE POLICY "service_mobility" ON health_meta.mobility_limitations
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_mobility_updated_at
  BEFORE UPDATE ON health_meta.mobility_limitations
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 5. daily_wellbeing  (per-day check-in: sleep / energy / mood / stress)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS health_meta.daily_wellbeing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  observed_on DATE NOT NULL,

  sleep_hours NUMERIC(4,1),
  sleep_quality INT CHECK (sleep_quality IS NULL OR (sleep_quality BETWEEN 0 AND 10)),
  wakeups INT,
  energy_score INT CHECK (energy_score IS NULL OR (energy_score BETWEEN 0 AND 10)),
  recovery_score INT CHECK (recovery_score IS NULL OR (recovery_score BETWEEN 0 AND 10)),
  soreness_score INT CHECK (soreness_score IS NULL OR (soreness_score BETWEEN 0 AND 10)),
  stress_score INT CHECK (stress_score IS NULL OR (stress_score BETWEEN 0 AND 10)),
  mood_score INT CHECK (mood_score IS NULL OR (mood_score BETWEEN 0 AND 10)),
  focus_score INT CHECK (focus_score IS NULL OR (focus_score BETWEEN 0 AND 10)),
  libido_score INT CHECK (libido_score IS NULL OR (libido_score BETWEEN 0 AND 10)),

  notes TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, observed_on)
);

CREATE INDEX IF NOT EXISTS idx_daily_wellbeing_user_day
  ON health_meta.daily_wellbeing(user_id, observed_on DESC);

ALTER TABLE health_meta.daily_wellbeing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "health_gate_wellbeing" ON health_meta.daily_wellbeing
  FOR ALL USING (public.is_health_enabled() AND auth.uid() = user_id)
  WITH CHECK (public.is_health_enabled() AND auth.uid() = user_id);
CREATE POLICY "service_wellbeing" ON health_meta.daily_wellbeing
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_wellbeing_updated_at
  BEFORE UPDATE ON health_meta.daily_wellbeing
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 6. vitals_log  (point-in-time vitals: RHR, HRV, BP, glucose)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS health_meta.vitals_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resting_heart_rate_bpm NUMERIC,
  heart_rate_variability_ms NUMERIC,
  systolic_bp_mmhg NUMERIC,
  diastolic_bp_mmhg NUMERIC,
  glucose_mg_dl NUMERIC,
  spo2_percent NUMERIC,
  body_temp_c NUMERIC,
  source TEXT NOT NULL DEFAULT 'manual',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vitals_user_time
  ON health_meta.vitals_log(user_id, observed_at DESC);

ALTER TABLE health_meta.vitals_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "health_gate_vitals" ON health_meta.vitals_log
  FOR ALL USING (public.is_health_enabled() AND auth.uid() = user_id)
  WITH CHECK (public.is_health_enabled() AND auth.uid() = user_id);
CREATE POLICY "service_vitals" ON health_meta.vitals_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_vitals_updated_at
  BEFORE UPDATE ON health_meta.vitals_log
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 7. labs  (lab panels and individual results)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS health_meta.lab_panels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  drawn_at DATE NOT NULL,
  provider TEXT,
  panel_name TEXT NOT NULL,                          -- 'cmp', 'cbc', 'lipid', 'testosterone', ...
  document_key TEXT,                                 -- storage key (PDF)
  notes_encrypted TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_panels_user_date
  ON health_meta.lab_panels(user_id, drawn_at DESC);

ALTER TABLE health_meta.lab_panels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "health_gate_lab_panels" ON health_meta.lab_panels
  FOR ALL USING (public.is_health_enabled() AND auth.uid() = user_id)
  WITH CHECK (public.is_health_enabled() AND auth.uid() = user_id);
CREATE POLICY "service_lab_panels" ON health_meta.lab_panels
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_lab_panels_updated_at
  BEFORE UPDATE ON health_meta.lab_panels
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


CREATE TABLE IF NOT EXISTS health_meta.lab_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  panel_id UUID REFERENCES health_meta.lab_panels(id) ON DELETE CASCADE,
  analyte TEXT NOT NULL,                             -- 'total_testosterone', 'hba1c', ...
  value NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  reference_range_low NUMERIC,
  reference_range_high NUMERIC,
  flagged TEXT
    CHECK (flagged IS NULL OR flagged IN ('low', 'high', 'critical', 'normal')),
  source TEXT NOT NULL DEFAULT 'manual',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_results_user_analyte
  ON health_meta.lab_results(user_id, analyte, created_at DESC);

ALTER TABLE health_meta.lab_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "health_gate_lab_results" ON health_meta.lab_results
  FOR ALL USING (public.is_health_enabled() AND auth.uid() = user_id)
  WITH CHECK (public.is_health_enabled() AND auth.uid() = user_id);
CREATE POLICY "service_lab_results" ON health_meta.lab_results
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_lab_results_updated_at
  BEFORE UPDATE ON health_meta.lab_results
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 8. medications, supplements, interventions
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS health_meta.medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dose TEXT,
  unit TEXT,
  frequency TEXT,                                    -- 'daily', '2x/week', etc.
  route TEXT,                                        -- 'oral', 'injection', 'topical'
  prescriber TEXT,
  reason TEXT,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes_encrypted TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_medications_user_active
  ON health_meta.medications(user_id, is_active);
ALTER TABLE health_meta.medications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "health_gate_meds" ON health_meta.medications
  FOR ALL USING (public.is_health_enabled() AND auth.uid() = user_id)
  WITH CHECK (public.is_health_enabled() AND auth.uid() = user_id);
CREATE POLICY "service_meds" ON health_meta.medications
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_meds_updated_at
  BEFORE UPDATE ON health_meta.medications
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


CREATE TABLE IF NOT EXISTS health_meta.supplements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,                                     -- 'vitamin', 'mineral', 'protein', 'creatine'
  dose TEXT,
  unit TEXT,
  frequency TEXT,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  source TEXT NOT NULL DEFAULT 'manual',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_supplements_user_active
  ON health_meta.supplements(user_id, is_active);
ALTER TABLE health_meta.supplements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "health_gate_supps" ON health_meta.supplements
  FOR ALL USING (public.is_health_enabled() AND auth.uid() = user_id)
  WITH CHECK (public.is_health_enabled() AND auth.uid() = user_id);
CREATE POLICY "service_supps" ON health_meta.supplements
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_supps_updated_at
  BEFORE UPDATE ON health_meta.supplements
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


CREATE TABLE IF NOT EXISTS health_meta.interventions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  intervention_type TEXT NOT NULL,                   -- 'trt', 'peptide', 'nad', 'nmn', 'nac', 'iv_therapy', 'sauna', 'cold_plunge', ...
  protocol_name TEXT,
  dose TEXT,
  unit TEXT,
  frequency TEXT,
  start_date DATE,
  end_date DATE,
  prescriber TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes_encrypted TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_interventions_user_active
  ON health_meta.interventions(user_id, is_active);
ALTER TABLE health_meta.interventions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "health_gate_interventions" ON health_meta.interventions
  FOR ALL USING (public.is_health_enabled() AND auth.uid() = user_id)
  WITH CHECK (public.is_health_enabled() AND auth.uid() = user_id);
CREATE POLICY "service_interventions" ON health_meta.interventions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_interventions_updated_at
  BEFORE UPDATE ON health_meta.interventions
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 9. nutrition_profile (singleton) + diet_log (per day)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS health_meta.nutrition_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  diet_type TEXT,                                    -- 'omnivore', 'mediterranean', 'keto', 'vegan', 'carnivore', 'other'
  daily_calorie_target NUMERIC,
  protein_target_g NUMERIC,
  carb_target_g NUMERIC,
  fat_target_g NUMERIC,
  fiber_target_g NUMERIC,
  water_target_ml NUMERIC,
  alcohol_drinks_per_week_target NUMERIC,
  caffeine_mg_per_day_target NUMERIC,
  food_allergies TEXT[] DEFAULT '{}',
  preferences TEXT,
  source TEXT NOT NULL DEFAULT 'onboarding',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE health_meta.nutrition_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "health_gate_nut_profile" ON health_meta.nutrition_profile
  FOR ALL USING (public.is_health_enabled() AND auth.uid() = user_id)
  WITH CHECK (public.is_health_enabled() AND auth.uid() = user_id);
CREATE POLICY "service_nut_profile" ON health_meta.nutrition_profile
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_nut_profile_updated_at
  BEFORE UPDATE ON health_meta.nutrition_profile
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


CREATE TABLE IF NOT EXISTS health_meta.diet_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  observed_on DATE NOT NULL,
  calories NUMERIC,
  protein_g NUMERIC,
  carb_g NUMERIC,
  fat_g NUMERIC,
  fiber_g NUMERIC,
  water_ml NUMERIC,
  alcohol_drinks NUMERIC,
  caffeine_mg NUMERIC,
  adherence_score INT CHECK (adherence_score IS NULL OR (adherence_score BETWEEN 0 AND 10)),
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, observed_on)
);
CREATE INDEX IF NOT EXISTS idx_diet_log_user_day
  ON health_meta.diet_log(user_id, observed_on DESC);
ALTER TABLE health_meta.diet_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "health_gate_diet_log" ON health_meta.diet_log
  FOR ALL USING (public.is_health_enabled() AND auth.uid() = user_id)
  WITH CHECK (public.is_health_enabled() AND auth.uid() = user_id);
CREATE POLICY "service_diet_log" ON health_meta.diet_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_diet_log_updated_at
  BEFORE UPDATE ON health_meta.diet_log
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
