-- ==========================================================================
-- 086: Arcana Health & Performance Activation
--
-- Adds six first-class domains (health / performance / recovery /
-- longevity / body_composition / preventative_care) PLUS a new
-- `arcana` schema with the intake, health-graph, biometrics, labs,
-- lead packages, concierge, and membership tables.
--
-- This is the integration layer: every existing engine (Goal
-- Hierarchy / Probability / Decision Impact / Cross-Domain
-- Attribution / Catch-Up / Ahead-of-Plan / XAI / Conversation
-- Intelligence / Provider GraphRAG) gets new domain coverage for
-- free because we extend the shared `is_domain()` CHECK predicates.
--
-- ETHICAL CONTRACT (enforced by application layer):
--   Arcana RECOMMENDS. Arcana does not DIAGNOSE. Arcana does not
--   PRESCRIBE. Arcana does not PRACTICE MEDICINE. Clinical decisions
--   remain under licensed providers.
-- ==========================================================================


CREATE SCHEMA IF NOT EXISTS arcana;
GRANT USAGE ON SCHEMA arcana TO authenticated, service_role;


-- ###########################################################################
-- Phase 1 — Extend the shared domain enum
-- ###########################################################################
CREATE OR REPLACE FUNCTION central.is_domain(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN (
    'finance','career','education','health','benefits','insurance',
    'estate_planning','entrepreneurship','military_veteran','cross_domain',
    -- Sprint C additions
    'performance','recovery','longevity','body_composition','preventative_care'
  )
$$;

CREATE OR REPLACE FUNCTION decision_intelligence.is_domain(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN (
    'financial','career','education','health','insurance','benefits',
    'estate','entrepreneurship','family','cross_domain',
    'performance','recovery','longevity','body_composition','preventative_care'
  )
$$;


-- ###########################################################################
-- Helper enums local to arcana
-- ###########################################################################
CREATE OR REPLACE FUNCTION arcana.is_assessment_kind(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN (
    'baseline','readiness','goal_discovery','protocol_review',
    'lab_review','progress_review','provider_handoff'
  )
$$;

CREATE OR REPLACE FUNCTION arcana.is_goal_kind(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN (
    'weight_loss','fat_loss','muscle_gain','longevity','recovery',
    'athletic_performance','energy','sleep','hormone_optimization',
    'chronic_condition_management','body_composition','cardiovascular_health',
    'lab_optimization','compliance','custom'
  )
$$;

CREATE OR REPLACE FUNCTION arcana.is_biometric_kind(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN (
    'weight','body_fat_pct','lean_mass','waist_circumference',
    'resting_blood_pressure_systolic','resting_blood_pressure_diastolic',
    'resting_heart_rate','hrv','vo2_max','sleep_duration_min',
    'sleep_efficiency_pct','rem_minutes','deep_minutes',
    'step_count','active_calories','training_load','recovery_score',
    'body_temperature','spo2'
  )
$$;

CREATE OR REPLACE FUNCTION arcana.is_lab_kind(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN (
    -- Standard panels
    'cbc','cmp','lipid_panel',
    -- Hemoglobin A1c
    'a1c',
    -- Vitamins
    'vitamin_d_25oh','vitamin_b12','folate','ferritin',
    -- Sex hormones
    'total_testosterone','free_testosterone','shbg','estradiol',
    'dhea_s','progesterone','prolactin',
    -- Thyroid
    'tsh','free_t3','free_t4','reverse_t3','tpo_antibody',
    -- Inflammation / cardiovascular
    'crp','hs_crp','apo_b','lp_a','homocysteine',
    -- Metabolic
    'fasting_glucose','fasting_insulin','homa_ir','uric_acid',
    -- Cancer screening
    'psa',
    -- Bone / minerals
    'magnesium','calcium_serum','phosphorus',
    -- Other
    'cortisol_am','cortisol_pm','igf_1','custom'
  )
$$;

CREATE OR REPLACE FUNCTION arcana.is_protocol_kind(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('supplement','training','nutrition','sleep','recovery','behavior','medication_note')
$$;

CREATE OR REPLACE FUNCTION arcana.is_membership_tier(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('arcana_core','arcana_performance','arcana_concierge')
$$;

CREATE OR REPLACE FUNCTION arcana.is_intake_source(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('arcana','clinic','coach','physician','trainer','nutritionist','self')
$$;


-- ###########################################################################
-- Phase 2 — Intake: profile + assessment + goals + constraints +
-- capabilities + motivations + readiness
-- ###########################################################################

CREATE TABLE IF NOT EXISTS arcana.arcana_profiles (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  intake_source            TEXT NOT NULL DEFAULT 'arcana'
                           CHECK (arcana.is_intake_source(intake_source)),
  referring_provider_id    UUID REFERENCES providers.provider_profiles(id) ON DELETE SET NULL,
  membership_tier          TEXT CHECK (membership_tier IS NULL OR arcana.is_membership_tier(membership_tier)),
  membership_activated_at  TIMESTAMPTZ,
  -- The three Achieve Global drivers, copied from discovery_sessions
  -- when the user completes intake. Computed by DriverInferenceEngine.
  financial_security_score NUMERIC(3,2) CHECK (financial_security_score IS NULL OR financial_security_score BETWEEN 0 AND 1),
  image_score              NUMERIC(3,2) CHECK (image_score IS NULL OR image_score BETWEEN 0 AND 1),
  performance_score        NUMERIC(3,2) CHECK (performance_score IS NULL OR performance_score BETWEEN 0 AND 1),
  dominant_driver          TEXT CHECK (dominant_driver IS NULL OR dominant_driver IN ('financial_security','image','performance')),
  secondary_driver         TEXT CHECK (secondary_driver IS NULL OR secondary_driver IN ('financial_security','image','performance')),
  -- Readiness — computed by the readiness engine; cached here for fast routing.
  readiness_score          NUMERIC(3,2) CHECK (readiness_score IS NULL OR readiness_score BETWEEN 0 AND 1),
  readiness_factors        JSONB NOT NULL DEFAULT '[]',
  -- Provider lead consent flags (controlled separately by lead_package_consents).
  provider_lead_consent_given BOOLEAN NOT NULL DEFAULT FALSE,
  provider_lead_consent_at TIMESTAMPTZ,
  metadata                 JSONB NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS arcana.arcana_assessments (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  profile_id               UUID NOT NULL REFERENCES arcana.arcana_profiles(id) ON DELETE CASCADE,
  assessment_kind          TEXT NOT NULL CHECK (arcana.is_assessment_kind(assessment_kind)),
  discovery_session_id     UUID REFERENCES decision_intelligence.discovery_sessions(id) ON DELETE SET NULL,
  conducted_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  summary                  TEXT,
  findings                 JSONB NOT NULL DEFAULT '{}',
  confidence               NUMERIC(3,2) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  metadata                 JSONB NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_aassess_user ON arcana.arcana_assessments(user_id, conducted_at DESC);

CREATE TABLE IF NOT EXISTS arcana.arcana_goals (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  profile_id               UUID NOT NULL REFERENCES arcana.arcana_profiles(id) ON DELETE CASCADE,
  -- Link back to the unified goals table so the Goal Hierarchy Engine +
  -- Probability Engine can traverse via the SAME edges.
  goal_id                  UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  goal_kind                TEXT NOT NULL CHECK (arcana.is_goal_kind(goal_kind)),
  domain                   TEXT NOT NULL DEFAULT 'health'
                           CHECK (domain IN ('health','performance','recovery','longevity','body_composition','preventative_care')),
  title                    TEXT NOT NULL,
  description              TEXT,
  target_value             NUMERIC,
  target_unit              TEXT,
  target_date              DATE,
  why_text                 TEXT,                         -- captured during Need-Behind-Need
  motivation_drivers       JSONB NOT NULL DEFAULT '{}',  -- {financial_security, image, performance}
  current_value            NUMERIC,
  baseline_value           NUMERIC,
  metadata                 JSONB NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agoal_user ON arcana.arcana_goals(user_id);

CREATE TABLE IF NOT EXISTS arcana.arcana_constraints (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  profile_id               UUID NOT NULL REFERENCES arcana.arcana_profiles(id) ON DELETE CASCADE,
  constraint_kind          TEXT NOT NULL
                           CHECK (constraint_kind IN ('time','budget','travel','family','work_schedule','injury','medical_restriction','dietary_restriction','equipment_access','other')),
  description              TEXT NOT NULL,
  value_numeric            NUMERIC,                      -- e.g. 5 (hours/week available)
  value_unit               TEXT,                         -- e.g. 'hours_per_week'
  severity                 TEXT NOT NULL DEFAULT 'soft'
                           CHECK (severity IN ('hard','soft')),
  starts_at                DATE,
  ends_at                  DATE,
  is_active                BOOLEAN NOT NULL DEFAULT TRUE,
  metadata                 JSONB NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_aconstr_user ON arcana.arcana_constraints(user_id, is_active);

CREATE TABLE IF NOT EXISTS arcana.arcana_capabilities (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  profile_id               UUID NOT NULL REFERENCES arcana.arcana_profiles(id) ON DELETE CASCADE,
  capability_kind          TEXT NOT NULL
                           CHECK (capability_kind IN ('training_experience','diet_experience','cooking_skill','recovery_habits','equipment_access','gym_access','travel_frequency','sleep_routine','stress_management','other')),
  proficiency              TEXT NOT NULL DEFAULT 'novice'
                           CHECK (proficiency IN ('novice','intermediate','advanced','expert')),
  description              TEXT,
  metadata                 JSONB NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS arcana.arcana_motivations (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  profile_id               UUID NOT NULL REFERENCES arcana.arcana_profiles(id) ON DELETE CASCADE,
  motivation_text          TEXT NOT NULL,
  driver                   TEXT NOT NULL
                           CHECK (driver IN ('financial_security','image','performance','mixed')),
  intensity                INT CHECK (intensity IS NULL OR intensity BETWEEN 1 AND 10),
  surfaced_at_depth        INT,                          -- which Need-Behind-Need depth
  metadata                 JSONB NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS arcana.arcana_readiness (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  profile_id               UUID NOT NULL REFERENCES arcana.arcana_profiles(id) ON DELETE CASCADE,
  computed_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  overall_score            NUMERIC(3,2) NOT NULL CHECK (overall_score BETWEEN 0 AND 1),
  -- Sub-scores for the four readiness dimensions.
  motivation_score         NUMERIC(3,2) CHECK (motivation_score IS NULL OR motivation_score BETWEEN 0 AND 1),
  capability_score         NUMERIC(3,2) CHECK (capability_score IS NULL OR capability_score BETWEEN 0 AND 1),
  capacity_score           NUMERIC(3,2) CHECK (capacity_score IS NULL OR capacity_score BETWEEN 0 AND 1),
  consistency_score        NUMERIC(3,2) CHECK (consistency_score IS NULL OR consistency_score BETWEEN 0 AND 1),
  drivers                  JSONB NOT NULL DEFAULT '[]',
  risks                    JSONB NOT NULL DEFAULT '[]',
  recommended_membership   TEXT CHECK (recommended_membership IS NULL OR arcana.is_membership_tier(recommended_membership)),
  metadata                 JSONB NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_areadiness_user ON arcana.arcana_readiness(user_id, computed_at DESC);


-- ###########################################################################
-- Phase 3 — Health Graph: supplement/training/sleep/recovery protocols
-- and HealthMilestones
-- ###########################################################################

CREATE TABLE IF NOT EXISTS arcana.supplement_protocols (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  profile_id               UUID REFERENCES arcana.arcana_profiles(id) ON DELETE SET NULL,
  supplement_name          TEXT NOT NULL,
  brand                    TEXT,
  dose                     NUMERIC,
  dose_unit                TEXT,
  frequency                TEXT,                         -- e.g. 'daily', 'twice_daily', 'as_needed'
  timing                   TEXT,                         -- e.g. 'AM', 'PM', 'with_meal'
  started_on               DATE,
  ended_on                 DATE,
  source                   TEXT NOT NULL DEFAULT 'self_report'
                           CHECK (source IN ('self_report','provider_recommended','arcana_suggested','imported')),
  -- Critical: NOT prescriptive. This is a journal entry. We do NOT
  -- recommend dosing through this column.
  notes                    TEXT,
  active                   BOOLEAN NOT NULL DEFAULT TRUE,
  metadata                 JSONB NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sp_user ON arcana.supplement_protocols(user_id, active);

CREATE TABLE IF NOT EXISTS arcana.training_protocols (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  profile_id               UUID REFERENCES arcana.arcana_profiles(id) ON DELETE SET NULL,
  protocol_name            TEXT NOT NULL,
  protocol_kind            TEXT NOT NULL DEFAULT 'training'
                           CHECK (arcana.is_protocol_kind(protocol_kind)),
  weekly_structure         JSONB NOT NULL DEFAULT '{}',
  sessions_per_week        INT CHECK (sessions_per_week IS NULL OR sessions_per_week BETWEEN 0 AND 14),
  duration_min_per_session INT,
  periodization_kind       TEXT,                         -- linear / block / conjugate
  started_on               DATE,
  ended_on                 DATE,
  source                   TEXT NOT NULL DEFAULT 'self_report'
                           CHECK (source IN ('self_report','provider_recommended','arcana_suggested','imported')),
  active                   BOOLEAN NOT NULL DEFAULT TRUE,
  metadata                 JSONB NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tp_user ON arcana.training_protocols(user_id, active);

CREATE TABLE IF NOT EXISTS arcana.health_milestones (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  arcana_goal_id           UUID REFERENCES arcana.arcana_goals(id) ON DELETE CASCADE,
  title                    TEXT NOT NULL,
  description              TEXT,
  target_date              DATE,
  achieved_at              TIMESTAMPTZ,
  evidence                 JSONB NOT NULL DEFAULT '[]',
  metadata                 JSONB NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hmile_user ON arcana.health_milestones(user_id);


-- ###########################################################################
-- Phase 4 — Biometrics + Labs
-- ###########################################################################

CREATE TABLE IF NOT EXISTS arcana.biometric_observations (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  metric_kind              TEXT NOT NULL CHECK (arcana.is_biometric_kind(metric_kind)),
  value                    NUMERIC NOT NULL,
  unit                     TEXT,
  -- Reference range for the population (optional; population-level, not personal).
  reference_low            NUMERIC,
  reference_high           NUMERIC,
  source                   TEXT NOT NULL DEFAULT 'self_report'
                           CHECK (source IN ('self_report','wearable','provider_measured','imported','computed')),
  source_wearable          TEXT,                         -- 'apple_health','google_fit','fitbit','garmin','whoop','oura','other'
  collected_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata                 JSONB NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bio_user_kind ON arcana.biometric_observations(user_id, metric_kind, collected_at DESC);

CREATE TABLE IF NOT EXISTS arcana.lab_results (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lab_kind                 TEXT NOT NULL CHECK (arcana.is_lab_kind(lab_kind)),
  panel_name               TEXT,
  ordered_by               TEXT,                          -- provider name (free text)
  ordered_by_provider_id   UUID REFERENCES providers.provider_profiles(id) ON DELETE SET NULL,
  collection_date          DATE NOT NULL,
  result_value             NUMERIC,
  result_text              TEXT,
  unit                     TEXT,
  reference_low            NUMERIC,
  reference_high           NUMERIC,
  flag                     TEXT CHECK (flag IS NULL OR flag IN ('low','normal','borderline','high','critical')),
  lab_source               TEXT,                          -- 'Quest','LabCorp','provider','wearable','custom'
  notes                    TEXT,
  metadata                 JSONB NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lab_user_kind ON arcana.lab_results(user_id, lab_kind, collection_date DESC);


-- ###########################################################################
-- Phase 5 — Wearable abstraction (above health_meta.wearable_metric)
-- ###########################################################################

CREATE TABLE IF NOT EXISTS arcana.wearable_connections (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider                 TEXT NOT NULL
                           CHECK (provider IN ('apple_health','google_fit','fitbit','garmin','whoop','oura','other')),
  status                   TEXT NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','active','paused','revoked','expired','error')),
  connected_at             TIMESTAMPTZ,
  last_sync_at             TIMESTAMPTZ,
  scopes                   TEXT[] NOT NULL DEFAULT '{}',
  -- We deliberately do NOT store OAuth tokens in the schema. Tokens
  -- live in supabase vault / external secrets manager. We store
  -- pointers only.
  vault_reference          TEXT,
  metadata                 JSONB NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT wear_conn_unique UNIQUE (user_id, provider)
);


-- ###########################################################################
-- Phase 6 — Insurance + benefits (extends 064 insurance_plans)
-- ###########################################################################

CREATE TABLE IF NOT EXISTS arcana.insurance_documents (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  insurance_plan_id        UUID REFERENCES public.insurance_plans(id) ON DELETE SET NULL,
  document_kind            TEXT NOT NULL
                           CHECK (document_kind IN ('insurance_card_front','insurance_card_back','plan_document','benefit_summary','eob','sbc','formulary','other')),
  storage_path             TEXT NOT NULL,
  mime_type                TEXT,
  ocr_status               TEXT NOT NULL DEFAULT 'pending'
                           CHECK (ocr_status IN ('pending','processing','succeeded','failed','skipped')),
  extracted_fields         JSONB NOT NULL DEFAULT '{}',
  uploaded_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata                 JSONB NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_idoc_user ON arcana.insurance_documents(user_id, uploaded_at DESC);


-- ###########################################################################
-- Phase 7 — Lead packages + consent
-- ###########################################################################

CREATE TABLE IF NOT EXISTS arcana.lead_package_consents (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_provider_id    UUID REFERENCES providers.provider_profiles(id) ON DELETE SET NULL,
  consent_kind             TEXT NOT NULL DEFAULT 'lead_package'
                           CHECK (consent_kind IN ('lead_package','full_record_share','prescreen_only')),
  -- What sections may be included?
  include_goals            BOOLEAN NOT NULL DEFAULT TRUE,
  include_constraints      BOOLEAN NOT NULL DEFAULT TRUE,
  include_motivation       BOOLEAN NOT NULL DEFAULT TRUE,
  include_biometrics       BOOLEAN NOT NULL DEFAULT TRUE,
  include_labs             BOOLEAN NOT NULL DEFAULT FALSE,    -- opt-in; defaults off
  include_protocols        BOOLEAN NOT NULL DEFAULT TRUE,
  include_supplements      BOOLEAN NOT NULL DEFAULT TRUE,
  include_medications      BOOLEAN NOT NULL DEFAULT FALSE,    -- opt-in
  include_insurance        BOOLEAN NOT NULL DEFAULT FALSE,    -- opt-in
  granted_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at               TIMESTAMPTZ,
  expires_at               TIMESTAMPTZ,
  granted_via              TEXT,                              -- 'app','email','phone','provider_intake'
  metadata                 JSONB NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lpc_user ON arcana.lead_package_consents(user_id, granted_at DESC);

CREATE TABLE IF NOT EXISTS arcana.lead_packages (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  consent_id               UUID NOT NULL REFERENCES arcana.lead_package_consents(id) ON DELETE RESTRICT,
  recipient_provider_id    UUID REFERENCES providers.provider_profiles(id) ON DELETE SET NULL,
  generated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Frozen snapshot at generation time. Once generated, the row is
  -- immutable; revoking consent revokes future ACCESS to it, not the
  -- bytes that already flew.
  payload                  JSONB NOT NULL,
  payload_version          TEXT NOT NULL DEFAULT 'v1',
  readiness_score          NUMERIC(3,2) CHECK (readiness_score IS NULL OR readiness_score BETWEEN 0 AND 1),
  probability_of_success   NUMERIC(3,2) CHECK (probability_of_success IS NULL OR probability_of_success BETWEEN 0 AND 1),
  key_risks                JSONB NOT NULL DEFAULT '[]',
  recommended_discussion_topics JSONB NOT NULL DEFAULT '[]',
  shared_at                TIMESTAMPTZ,
  accessed_count           INT NOT NULL DEFAULT 0,
  -- Once revoked, the row stays but the consent_id row is marked
  -- revoked_at; downstream readers (provider routes) check that
  -- before returning the payload.
  metadata                 JSONB NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lp_user ON arcana.lead_packages(user_id, generated_at DESC);


-- ###########################################################################
-- Phase 13 — Concierge foundation
-- ###########################################################################

CREATE TABLE IF NOT EXISTS arcana.concierge_preferences (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  travel_profile           JSONB NOT NULL DEFAULT '{}',
  gym_access_preferences   JSONB NOT NULL DEFAULT '{}',
  recovery_preferences     JSONB NOT NULL DEFAULT '{}',
  provider_preferences     JSONB NOT NULL DEFAULT '{}',
  metadata                 JSONB NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ###########################################################################
-- Phase 14 — Membership
-- ###########################################################################

CREATE TABLE IF NOT EXISTS arcana.memberships (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  tier                     TEXT NOT NULL CHECK (arcana.is_membership_tier(tier)),
  status                   TEXT NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active','paused','cancelled','expired','trial')),
  started_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  renewed_at               TIMESTAMPTZ,
  ends_at                  TIMESTAMPTZ,
  metadata                 JSONB NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ###########################################################################
-- updated_at triggers on all 14 tables
-- ###########################################################################
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'arcana_profiles','arcana_assessments','arcana_goals','arcana_constraints',
    'arcana_capabilities','arcana_motivations','arcana_readiness',
    'supplement_protocols','training_protocols','health_milestones',
    'biometric_observations','lab_results','wearable_connections',
    'insurance_documents','lead_package_consents','lead_packages',
    'concierge_preferences','memberships'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_%I_updated_at ON arcana.%I; '
      'CREATE TRIGGER set_%I_updated_at BEFORE UPDATE ON arcana.%I '
      'FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();',
      t, t, t, t
    );
  END LOOP;
END $$;


-- ###########################################################################
-- RLS — strict owner-only on every table with service_role escape
-- ###########################################################################
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'arcana_profiles','arcana_assessments','arcana_goals','arcana_constraints',
    'arcana_capabilities','arcana_motivations','arcana_readiness',
    'supplement_protocols','training_protocols','health_milestones',
    'biometric_observations','lab_results','wearable_connections',
    'insurance_documents','lead_package_consents','lead_packages',
    'concierge_preferences','memberships'
  ]
  LOOP
    EXECUTE format('ALTER TABLE arcana.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON arcana.%I FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)',
      t || '_owner_all', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON arcana.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      t || '_service_role', t
    );
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA arcana TO authenticated;


-- ###########################################################################
-- Public read-views
-- ###########################################################################
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'arcana_profiles','arcana_assessments','arcana_goals','arcana_constraints',
    'arcana_capabilities','arcana_motivations','arcana_readiness',
    'supplement_protocols','training_protocols','health_milestones',
    'biometric_observations','lab_results','wearable_connections',
    'insurance_documents','lead_package_consents','lead_packages',
    'concierge_preferences','memberships'
  ]
  LOOP
    EXECUTE format('CREATE OR REPLACE VIEW public.%I AS SELECT * FROM arcana.%I', t, t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  END LOOP;
END $$;


-- ###########################################################################
-- GraphRAG sync — single trigger function covering all 18 tables
-- ###########################################################################
CREATE OR REPLACE FUNCTION arcana.trigger_arcana_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_entity_type TEXT;
  v_payload     JSONB;
BEGIN
  v_entity_type := CASE TG_TABLE_NAME
    WHEN 'arcana_profiles'        THEN 'arcana_profile'
    WHEN 'arcana_assessments'     THEN 'arcana_assessment'
    WHEN 'arcana_goals'           THEN 'arcana_goal'
    WHEN 'arcana_constraints'     THEN 'arcana_constraint'
    WHEN 'arcana_capabilities'    THEN 'arcana_capability'
    WHEN 'arcana_motivations'     THEN 'arcana_motivation'
    WHEN 'arcana_readiness'       THEN 'arcana_readiness'
    WHEN 'supplement_protocols'   THEN 'supplement_protocol'
    WHEN 'training_protocols'     THEN 'training_protocol'
    WHEN 'health_milestones'      THEN 'health_milestone'
    WHEN 'biometric_observations' THEN 'biometric_observation'
    WHEN 'lab_results'            THEN 'lab_result'
    WHEN 'wearable_connections'   THEN 'wearable_connection'
    WHEN 'insurance_documents'    THEN 'arcana_insurance_document'
    WHEN 'lead_package_consents'  THEN 'lead_package_consent'
    WHEN 'lead_packages'          THEN 'lead_package'
    WHEN 'concierge_preferences'  THEN 'concierge_preference'
    WHEN 'memberships'            THEN 'arcana_membership'
    ELSE 'arcana_unknown'
  END;

  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(
      OLD.user_id, v_entity_type, OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb
    );
    RETURN OLD;
  END IF;

  -- Drop sensitive fields from the embedding payload as defense in
  -- depth above the Rust normalizer's strip:
  v_payload := to_jsonb(NEW)
    - 'metadata' - 'created_at' - 'updated_at' - 'user_id'
    - 'vault_reference' - 'storage_path' - 'extracted_fields';

  PERFORM graphrag.enqueue_sync(
    NEW.user_id, v_entity_type, NEW.id,
    TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert', v_payload
  );
  RETURN NEW;
END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'arcana_profiles','arcana_assessments','arcana_goals','arcana_constraints',
    'arcana_capabilities','arcana_motivations','arcana_readiness',
    'supplement_protocols','training_protocols','health_milestones',
    'biometric_observations','lab_results','wearable_connections',
    'insurance_documents','lead_package_consents','lead_packages',
    'concierge_preferences','memberships'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trigger_graphrag_%I_sync ON arcana.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trigger_graphrag_%I_sync '
      'AFTER INSERT OR UPDATE OR DELETE ON arcana.%I '
      'FOR EACH ROW EXECUTE FUNCTION arcana.trigger_arcana_sync()',
      t, t
    );
  END LOOP;
END $$;


-- ###########################################################################
-- Lead-package consent gate — reading a lead_package requires the
-- consent row to be unrevoked + unexpired. A simple SECURITY DEFINER
-- helper that the application layer + RLS policies can both call.
-- ###########################################################################
CREATE OR REPLACE FUNCTION arcana.has_active_lead_consent(p_consent_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = arcana, public
AS $$
DECLARE r arcana.lead_package_consents%ROWTYPE;
BEGIN
  SELECT * INTO r FROM arcana.lead_package_consents WHERE id = p_consent_id LIMIT 1;
  IF r.id IS NULL THEN RETURN FALSE; END IF;
  IF r.revoked_at IS NOT NULL THEN RETURN FALSE; END IF;
  IF r.expires_at IS NOT NULL AND r.expires_at < NOW() THEN RETURN FALSE; END IF;
  RETURN TRUE;
END $$;

GRANT EXECUTE ON FUNCTION arcana.has_active_lead_consent(UUID) TO authenticated, service_role;


-- ###########################################################################
-- Self-test
-- ###########################################################################
DO $$
DECLARE t TEXT; v_rls BOOLEAN;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'arcana_profiles','arcana_goals','biometric_observations','lab_results',
    'lead_packages','lead_package_consents'
  ]
  LOOP
    SELECT relrowsecurity INTO v_rls
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'arcana' AND c.relname = t;
    IF v_rls IS NULL THEN
      RAISE EXCEPTION '086 self-test: missing table arcana.%', t;
    END IF;
    IF NOT v_rls THEN
      RAISE EXCEPTION '086 self-test: RLS not enabled on arcana.%', t;
    END IF;
  END LOOP;
END $$;
