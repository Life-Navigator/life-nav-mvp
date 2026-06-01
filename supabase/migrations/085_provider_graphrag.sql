-- ==========================================================================
-- 085: Provider GraphRAG — Arcana's moat
--
-- A provider-facing scoped view onto a patient/client's intelligence
-- stack. Providers (physicians, NPs, coaches, nutritionists, trainers)
-- can see:
--
--   * Current State (goal_progress_snapshots, latest probability)
--   * Trajectory (life_trajectory_snapshots filtered by scope)
--   * Probability (goal_probability_distributions filtered by scope)
--   * Risk (trajectory_variance_factors filtered by scope)
--   * Progress (goal_progress_scores filtered by scope)
--   * Recommendations (recommendation_output + their own provider recs)
--
-- ...without seeing UNRELATED user data. Three barriers between a
-- provider and any datum:
--
--   1. Active engagement (status='active', accepted_at IS NOT NULL,
--      revoked_at IS NULL, expires_at > NOW())
--   2. Domain scope (engagement.allowed_domains @> ARRAY['health'])
--   3. Sensitivity ceiling (engagement.max_sensitivity >= row.sensitivity)
--
-- All three are enforced by the SECURITY DEFINER function
-- `providers.has_access_to(...)` plus the RPC
-- `providers.get_patient_view(...)`. Existing RLS on the underlying
-- decision_intelligence tables is NOT relaxed — providers go through
-- the RPC, which queries via the service_role policy after checking
-- access at the function entry.
--
-- Provider identity = Supabase auth user with role='provider' in
-- public.profiles + a row in providers.provider_profiles. A user can
-- be both a patient AND a provider.
-- ==========================================================================

CREATE SCHEMA IF NOT EXISTS providers;
GRANT USAGE ON SCHEMA providers TO authenticated, service_role;


-- -------------------------------------------------------------------------
-- Enums
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION providers.is_provider_type(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('physician','nurse_practitioner','coach','nutritionist','trainer','other_licensed')
$$;

CREATE OR REPLACE FUNCTION providers.is_engagement_status(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('pending','active','paused','revoked','expired','declined')
$$;

CREATE OR REPLACE FUNCTION providers.is_sensitivity_level(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('low','medium','high')
$$;

CREATE OR REPLACE FUNCTION providers.is_provider_domain(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('health','financial','career','education','estate','benefits','insurance','behavioral','rehabilitation')
$$;


-- ###########################################################################
-- 1. provider_profiles — provider identity + credentials
-- ###########################################################################
CREATE TABLE IF NOT EXISTS providers.provider_profiles (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider_type            TEXT NOT NULL CHECK (providers.is_provider_type(provider_type)),
  legal_name               TEXT NOT NULL,
  display_name             TEXT,
  -- Credential metadata. We do NOT verify license here — providers
  -- self-attest at registration and admin verifies out-of-band.
  primary_license_number   TEXT,
  primary_license_state    TEXT,
  primary_license_jurisdiction TEXT,
  -- Specialties / focus areas — free-text array, queryable.
  specialties              TEXT[] NOT NULL DEFAULT '{}',
  primary_domains          TEXT[] NOT NULL DEFAULT '{}'
                           CHECK (
                             primary_domains <@ ARRAY[
                               'health','financial','career','education','estate',
                               'benefits','insurance','behavioral','rehabilitation'
                             ]::text[]
                           ),
  bio                      TEXT,
  contact_email            TEXT,
  contact_phone            TEXT,
  -- Admin-set verification flag.
  verified                 BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at              TIMESTAMPTZ,
  verified_by              TEXT,
  -- Provider's own ToS acceptance.
  tos_accepted_at          TIMESTAMPTZ,
  metadata                 JSONB NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pp_provider_type ON providers.provider_profiles(provider_type);
CREATE INDEX IF NOT EXISTS idx_pp_verified      ON providers.provider_profiles(verified) WHERE verified;


-- ###########################################################################
-- 2. provider_engagements — patient ↔ provider link with consent + scope
-- ###########################################################################
CREATE TABLE IF NOT EXISTS providers.provider_engagements (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id              UUID NOT NULL REFERENCES providers.provider_profiles(id) ON DELETE CASCADE,
  patient_user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status                   TEXT NOT NULL DEFAULT 'pending'
                           CHECK (providers.is_engagement_status(status)),
  -- Scope. Both arrays + max_sensitivity gate every row.
  allowed_domains          TEXT[] NOT NULL DEFAULT '{}'
                           CHECK (
                             allowed_domains <@ ARRAY[
                               'health','financial','career','education','estate',
                               'benefits','insurance','behavioral','rehabilitation'
                             ]::text[]
                           ),
  max_sensitivity          TEXT NOT NULL DEFAULT 'medium'
                           CHECK (providers.is_sensitivity_level(max_sensitivity)),
  -- May the provider issue recommendations? Default yes for active.
  can_issue_recommendations BOOLEAN NOT NULL DEFAULT TRUE,
  -- Patient-initiated invitation OR provider-initiated request.
  initiated_by             TEXT NOT NULL DEFAULT 'patient'
                           CHECK (initiated_by IN ('patient','provider','admin')),
  invited_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at              TIMESTAMPTZ,
  expires_at               TIMESTAMPTZ,
  revoked_at               TIMESTAMPTZ,
  revoked_reason           TEXT,
  notes_for_patient        TEXT,
  notes_for_provider       TEXT,
  metadata                 JSONB NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pe_unique UNIQUE (provider_id, patient_user_id)
);
CREATE INDEX IF NOT EXISTS idx_pe_provider ON providers.provider_engagements(provider_id, status);
CREATE INDEX IF NOT EXISTS idx_pe_patient  ON providers.provider_engagements(patient_user_id, status);


-- ###########################################################################
-- 3. provider_consent_scopes — granular consent overrides
--    For most engagements the engagement row's allowed_domains is
--    enough. But the patient can carve out specific exceptions
--    ("share my Sleep Duration but NOT my Resting Heart Rate"). Those
--    live here.
-- ###########################################################################
CREATE TABLE IF NOT EXISTS providers.provider_consent_scopes (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id            UUID NOT NULL REFERENCES providers.provider_engagements(id) ON DELETE CASCADE,
  patient_user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scope_kind               TEXT NOT NULL
                           CHECK (scope_kind IN ('grant','deny')),
  entity_type              TEXT NOT NULL,         -- e.g. 'health_metric', 'goal_probability_distribution'
  entity_filter            JSONB NOT NULL DEFAULT '{}',
  granted_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at               TIMESTAMPTZ,
  metadata                 JSONB NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pcs_engagement ON providers.provider_consent_scopes(engagement_id);


-- ###########################################################################
-- 4. provider_recommendations — recs issued by providers
--    Distinct from system recommendations. Tagged with provider_id +
--    provider_type so outcome attribution can credit them.
-- ###########################################################################
CREATE TABLE IF NOT EXISTS providers.provider_recommendations (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id              UUID NOT NULL REFERENCES providers.provider_profiles(id) ON DELETE CASCADE,
  patient_user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  engagement_id            UUID NOT NULL REFERENCES providers.provider_engagements(id) ON DELETE CASCADE,
  domain                   TEXT NOT NULL CHECK (providers.is_provider_domain(domain)),
  title                    TEXT NOT NULL,
  body                     TEXT NOT NULL,
  rationale                TEXT,
  related_goal_id          UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  expected_horizon_months  INT CHECK (expected_horizon_months IS NULL OR expected_horizon_months > 0),
  expected_strength        NUMERIC(3,2) CHECK (expected_strength IS NULL OR expected_strength BETWEEN 0 AND 1),
  citations                JSONB NOT NULL DEFAULT '[]',
  issued_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at          TIMESTAMPTZ,
  accepted_at              TIMESTAMPTZ,
  rejected_at              TIMESTAMPTZ,
  rejected_reason          TEXT,
  completed_at             TIMESTAMPTZ,
  superseded_by            UUID REFERENCES providers.provider_recommendations(id) ON DELETE SET NULL,
  status                   TEXT NOT NULL DEFAULT 'issued'
                           CHECK (status IN ('issued','accepted','rejected','modified','completed','abandoned','superseded')),
  metadata                 JSONB NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prec_provider_patient ON providers.provider_recommendations(provider_id, patient_user_id);
CREATE INDEX IF NOT EXISTS idx_prec_patient          ON providers.provider_recommendations(patient_user_id, status);
CREATE INDEX IF NOT EXISTS idx_prec_engagement       ON providers.provider_recommendations(engagement_id);


-- ###########################################################################
-- 5. provider_outcomes — outcomes attributed to provider recs
-- ###########################################################################
CREATE TABLE IF NOT EXISTS providers.provider_outcomes (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id        UUID NOT NULL REFERENCES providers.provider_recommendations(id) ON DELETE CASCADE,
  patient_user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider_id              UUID NOT NULL REFERENCES providers.provider_profiles(id) ON DELETE CASCADE,
  observed_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dimension                TEXT NOT NULL,            -- e.g. 'VO2max', 'fasting_glucose', 'A1C'
  observed_value           NUMERIC,
  observed_unit            TEXT,
  expected_value           NUMERIC,
  delta                    NUMERIC,
  accuracy_score           NUMERIC(3,2) CHECK (accuracy_score IS NULL OR accuracy_score BETWEEN 0 AND 1),
  user_satisfaction        NUMERIC(3,2) CHECK (user_satisfaction IS NULL OR user_satisfaction BETWEEN 0 AND 1),
  outcome_quality          NUMERIC(3,2) CHECK (outcome_quality IS NULL OR outcome_quality BETWEEN 0 AND 1),
  source                   TEXT NOT NULL DEFAULT 'self_report'
                           CHECK (source IN ('self_report','provider_report','wearable','lab','computed')),
  notes                    TEXT,
  metadata                 JSONB NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pout_rec     ON providers.provider_outcomes(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_pout_provider ON providers.provider_outcomes(provider_id, observed_at DESC);


-- ###########################################################################
-- 6. provider_knowledge_entries — provider's own knowledge graph
--    Provider-attributed protocols / notes / templates / reading.
--    These are NOT central knowledge — they're the provider's IP.
-- ###########################################################################
CREATE TABLE IF NOT EXISTS providers.provider_knowledge_entries (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id              UUID NOT NULL REFERENCES providers.provider_profiles(id) ON DELETE CASCADE,
  entry_kind               TEXT NOT NULL DEFAULT 'protocol'
                           CHECK (entry_kind IN ('protocol','template','assessment','reading','reference','case_note')),
  title                    TEXT NOT NULL,
  body                     TEXT NOT NULL,
  domain                   TEXT NOT NULL CHECK (providers.is_provider_domain(domain)),
  tags                     TEXT[] NOT NULL DEFAULT '{}',
  citations                JSONB NOT NULL DEFAULT '[]',
  -- Visibility — most knowledge is provider-private. Some can be
  -- shared with engaged patients.
  visibility               TEXT NOT NULL DEFAULT 'provider_only'
                           CHECK (visibility IN ('provider_only','shared_with_patients','shared_with_providers')),
  version                  INT NOT NULL DEFAULT 1,
  archived_at              TIMESTAMPTZ,
  metadata                 JSONB NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pke_provider_domain ON providers.provider_knowledge_entries(provider_id, domain);


-- ###########################################################################
-- 7. provider_analytics — periodic per-provider rollups
-- ###########################################################################
CREATE TABLE IF NOT EXISTS providers.provider_analytics (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id              UUID NOT NULL REFERENCES providers.provider_profiles(id) ON DELETE CASCADE,
  period_start             DATE NOT NULL,
  period                   TEXT NOT NULL DEFAULT 'monthly'
                           CHECK (period IN ('weekly','monthly','quarterly','annual')),
  active_patient_count     INT NOT NULL DEFAULT 0,
  recommendations_issued   INT NOT NULL DEFAULT 0,
  recommendations_accepted INT NOT NULL DEFAULT 0,
  recommendations_completed INT NOT NULL DEFAULT 0,
  recommendations_rejected INT NOT NULL DEFAULT 0,
  recommendations_abandoned INT NOT NULL DEFAULT 0,
  success_rate             NUMERIC(4,3) CHECK (success_rate IS NULL OR success_rate BETWEEN 0 AND 1),
  completion_rate          NUMERIC(4,3) CHECK (completion_rate IS NULL OR completion_rate BETWEEN 0 AND 1),
  mean_outcome_quality     NUMERIC(4,3) CHECK (mean_outcome_quality IS NULL OR mean_outcome_quality BETWEEN 0 AND 1),
  mean_user_satisfaction   NUMERIC(4,3) CHECK (mean_user_satisfaction IS NULL OR mean_user_satisfaction BETWEEN 0 AND 1),
  computed_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata                 JSONB NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pa_unique UNIQUE (provider_id, period, period_start)
);
CREATE INDEX IF NOT EXISTS idx_pa_provider ON providers.provider_analytics(provider_id, period_start DESC);


-- -------------------------------------------------------------------------
-- updated_at triggers
-- -------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'provider_profiles','provider_engagements','provider_consent_scopes',
    'provider_recommendations','provider_outcomes','provider_knowledge_entries',
    'provider_analytics'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_%I_updated_at ON providers.%I; '
      'CREATE TRIGGER set_%I_updated_at BEFORE UPDATE ON providers.%I '
      'FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();',
      t, t, t, t
    );
  END LOOP;
END $$;


-- ###########################################################################
-- THE KEY FUNCTION — providers.has_access_to
--
-- The single gatekeeper for every provider read against patient data.
-- Three barriers, all of which MUST pass:
--
--   1. Active engagement (status='active', accepted, not expired/revoked)
--   2. Domain in allowed_domains
--   3. Requested sensitivity ≤ engagement.max_sensitivity
--
-- Returns BOOLEAN — no exceptions, no logs, no side effects. Tested by
-- verify_085_provider_rls.sql.
-- ###########################################################################
CREATE OR REPLACE FUNCTION providers.has_access_to(
  p_provider_user_id UUID,
  p_patient_user_id  UUID,
  p_domain           TEXT,
  p_min_sensitivity  TEXT DEFAULT 'low'
) RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = providers, public
AS $$
DECLARE
  v_provider_id UUID;
  v_engagement  providers.provider_engagements%ROWTYPE;
  v_sens_rank   INT;
  v_max_sens_rank INT;
BEGIN
  IF p_provider_user_id IS NULL OR p_patient_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  IF p_provider_user_id = p_patient_user_id THEN
    -- The provider IS the patient querying their own data — fine.
    RETURN TRUE;
  END IF;
  IF NOT providers.is_provider_domain(p_domain) THEN
    RETURN FALSE;
  END IF;
  IF NOT providers.is_sensitivity_level(p_min_sensitivity) THEN
    RETURN FALSE;
  END IF;

  -- 1. Resolve provider_profiles.id from auth user.
  SELECT id INTO v_provider_id
    FROM providers.provider_profiles
   WHERE user_id = p_provider_user_id
     AND verified = TRUE
   LIMIT 1;
  IF v_provider_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 2. Engagement check.
  SELECT * INTO v_engagement
    FROM providers.provider_engagements
   WHERE provider_id = v_provider_id
     AND patient_user_id = p_patient_user_id
   LIMIT 1;
  IF v_engagement.id IS NULL THEN
    RETURN FALSE;
  END IF;
  IF v_engagement.status <> 'active' THEN
    RETURN FALSE;
  END IF;
  IF v_engagement.accepted_at IS NULL THEN
    RETURN FALSE;
  END IF;
  IF v_engagement.revoked_at IS NOT NULL THEN
    RETURN FALSE;
  END IF;
  IF v_engagement.expires_at IS NOT NULL AND v_engagement.expires_at < NOW() THEN
    RETURN FALSE;
  END IF;

  -- 3. Domain check.
  IF NOT (p_domain = ANY(v_engagement.allowed_domains)) THEN
    RETURN FALSE;
  END IF;

  -- 4. Sensitivity check.
  v_sens_rank := CASE p_min_sensitivity
    WHEN 'low' THEN 1
    WHEN 'medium' THEN 2
    WHEN 'high' THEN 3
    ELSE 99
  END;
  v_max_sens_rank := CASE v_engagement.max_sensitivity
    WHEN 'low' THEN 1
    WHEN 'medium' THEN 2
    WHEN 'high' THEN 3
    ELSE 0
  END;
  IF v_sens_rank > v_max_sens_rank THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END $$;

GRANT EXECUTE ON FUNCTION providers.has_access_to(UUID, UUID, TEXT, TEXT)
  TO authenticated, service_role;


-- ###########################################################################
-- RPC — providers.get_patient_summary
--
-- Returns a minimal scoped summary: current state + active goal probability
-- distributions + recent progress scores + recommendation counts.
-- Per-row access is enforced via has_access_to() before the row is selected.
--
-- Any caller can invoke this; the function returns an empty result set
-- when access is not granted.
-- ###########################################################################
CREATE OR REPLACE FUNCTION providers.get_patient_summary(
  p_patient_user_id UUID,
  p_domain          TEXT DEFAULT 'health'
) RETURNS TABLE (
  goal_id            UUID,
  goal_title         TEXT,
  goal_domain        TEXT,
  current_progress   NUMERIC,
  most_likely_prob   NUMERIC,
  probability_range  TEXT,
  confidence         NUMERIC,
  recommendation_count INT,
  last_observation_at TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = providers, public, decision_intelligence
AS $$
BEGIN
  IF NOT providers.has_access_to(auth.uid(), p_patient_user_id, p_domain, 'low') THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT
      g.id AS goal_id,
      g.title AS goal_title,
      g.domain AS goal_domain,
      COALESCE(snap.score, 0)::NUMERIC AS current_progress,
      COALESCE(dist.most_likely, 0)::NUMERIC AS most_likely_prob,
      CASE WHEN dist.most_likely IS NULL
           THEN ''
           ELSE format('%.0f%%–%.0f%%', dist.worst_case * 100, dist.best_case * 100)
      END AS probability_range,
      COALESCE(dist.confidence, 0)::NUMERIC AS confidence,
      COALESCE(rec_count.cnt, 0)::INT AS recommendation_count,
      snap.snapshot_at AS last_observation_at
    FROM public.goals g
    LEFT JOIN LATERAL (
      SELECT score, snapshot_at
        FROM decision_intelligence.goal_progress_snapshots s
       WHERE s.user_id = g.user_id AND s.goal_id = g.id
       ORDER BY s.snapshot_at DESC LIMIT 1
    ) snap ON TRUE
    LEFT JOIN LATERAL (
      SELECT most_likely, worst_case, best_case, confidence
        FROM decision_intelligence.goal_probability_distributions d
       WHERE d.user_id = g.user_id AND d.goal_id = g.id
       ORDER BY d.computed_at DESC LIMIT 1
    ) dist ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS cnt
        FROM providers.provider_recommendations pr
       WHERE pr.patient_user_id = g.user_id
         AND pr.related_goal_id = g.id
    ) rec_count ON TRUE
   WHERE g.user_id = p_patient_user_id
     AND (g.domain = p_domain OR p_domain = 'all');
END $$;

GRANT EXECUTE ON FUNCTION providers.get_patient_summary(UUID, TEXT)
  TO authenticated, service_role;


-- ###########################################################################
-- RLS
--
-- provider_profiles      : owner-only on write; verified profiles publicly readable
-- provider_engagements   : both sides see; either side can revoke
-- provider_consent_scopes: patient-only edit; both sides read for own engagement
-- provider_recommendations: both sides read; provider writes
-- provider_outcomes      : both sides read; provider writes
-- provider_knowledge_entries: provider-private by default
-- provider_analytics     : provider-only
-- ###########################################################################
ALTER TABLE providers.provider_profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE providers.provider_engagements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE providers.provider_consent_scopes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE providers.provider_recommendations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE providers.provider_outcomes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE providers.provider_knowledge_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE providers.provider_analytics         ENABLE ROW LEVEL SECURITY;

-- provider_profiles
CREATE POLICY pp_owner_all ON providers.provider_profiles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY pp_read_verified ON providers.provider_profiles
  FOR SELECT TO authenticated USING (verified = TRUE);
CREATE POLICY pp_service ON providers.provider_profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- provider_engagements — patient OR provider's user_id matches.
CREATE POLICY pe_patient_all ON providers.provider_engagements
  FOR ALL USING (auth.uid() = patient_user_id)
  WITH CHECK (auth.uid() = patient_user_id);
CREATE POLICY pe_provider_read ON providers.provider_engagements
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM providers.provider_profiles pp
       WHERE pp.id = providers.provider_engagements.provider_id
         AND pp.user_id = auth.uid()
    )
  );
CREATE POLICY pe_provider_update_status ON providers.provider_engagements
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM providers.provider_profiles pp
       WHERE pp.id = providers.provider_engagements.provider_id
         AND pp.user_id = auth.uid()
    )
  );
CREATE POLICY pe_service ON providers.provider_engagements
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- provider_consent_scopes — patient owns
CREATE POLICY pcs_patient_all ON providers.provider_consent_scopes
  FOR ALL USING (auth.uid() = patient_user_id)
  WITH CHECK (auth.uid() = patient_user_id);
CREATE POLICY pcs_provider_read ON providers.provider_consent_scopes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM providers.provider_engagements pe
       JOIN providers.provider_profiles pp ON pp.id = pe.provider_id
      WHERE pe.id = providers.provider_consent_scopes.engagement_id
        AND pp.user_id = auth.uid()
    )
  );
CREATE POLICY pcs_service ON providers.provider_consent_scopes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- provider_recommendations
CREATE POLICY prec_patient_read ON providers.provider_recommendations
  FOR SELECT USING (auth.uid() = patient_user_id);
CREATE POLICY prec_patient_update ON providers.provider_recommendations
  FOR UPDATE TO authenticated
  USING (auth.uid() = patient_user_id);
CREATE POLICY prec_provider_read ON providers.provider_recommendations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM providers.provider_profiles pp
       WHERE pp.id = providers.provider_recommendations.provider_id
         AND pp.user_id = auth.uid()
    )
  );
CREATE POLICY prec_provider_write ON providers.provider_recommendations
  FOR INSERT TO authenticated
  WITH CHECK (
    providers.has_access_to(auth.uid(), patient_user_id, domain, 'low')
    AND EXISTS (
      SELECT 1 FROM providers.provider_profiles pp
       WHERE pp.id = providers.provider_recommendations.provider_id
         AND pp.user_id = auth.uid()
    )
  );
CREATE POLICY prec_service ON providers.provider_recommendations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- provider_outcomes
CREATE POLICY pout_patient_read ON providers.provider_outcomes
  FOR SELECT USING (auth.uid() = patient_user_id);
CREATE POLICY pout_provider_read ON providers.provider_outcomes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM providers.provider_profiles pp
       WHERE pp.id = providers.provider_outcomes.provider_id
         AND pp.user_id = auth.uid()
    )
  );
CREATE POLICY pout_provider_write ON providers.provider_outcomes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM providers.provider_profiles pp
       WHERE pp.id = providers.provider_outcomes.provider_id
         AND pp.user_id = auth.uid()
    )
  );
CREATE POLICY pout_service ON providers.provider_outcomes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- provider_knowledge_entries — provider-private (visibility flag for sharing)
CREATE POLICY pke_provider_owner ON providers.provider_knowledge_entries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM providers.provider_profiles pp
       WHERE pp.id = providers.provider_knowledge_entries.provider_id
         AND pp.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM providers.provider_profiles pp
       WHERE pp.id = providers.provider_knowledge_entries.provider_id
         AND pp.user_id = auth.uid()
    )
  );
CREATE POLICY pke_service ON providers.provider_knowledge_entries
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- provider_analytics — provider-only
CREATE POLICY pa_provider_owner ON providers.provider_analytics
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM providers.provider_profiles pp
       WHERE pp.id = providers.provider_analytics.provider_id
         AND pp.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM providers.provider_profiles pp
       WHERE pp.id = providers.provider_analytics.provider_id
         AND pp.user_id = auth.uid()
    )
  );
CREATE POLICY pa_service ON providers.provider_analytics
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON providers.provider_profiles,
     providers.provider_engagements,
     providers.provider_consent_scopes,
     providers.provider_recommendations,
     providers.provider_outcomes,
     providers.provider_knowledge_entries,
     providers.provider_analytics
  TO authenticated;


-- ###########################################################################
-- Public read/write views
-- ###########################################################################
CREATE OR REPLACE VIEW public.provider_profiles          AS SELECT * FROM providers.provider_profiles;
CREATE OR REPLACE VIEW public.provider_engagements       AS SELECT * FROM providers.provider_engagements;
CREATE OR REPLACE VIEW public.provider_consent_scopes    AS SELECT * FROM providers.provider_consent_scopes;
CREATE OR REPLACE VIEW public.provider_recommendations   AS SELECT * FROM providers.provider_recommendations;
CREATE OR REPLACE VIEW public.provider_outcomes          AS SELECT * FROM providers.provider_outcomes;
CREATE OR REPLACE VIEW public.provider_knowledge_entries AS SELECT * FROM providers.provider_knowledge_entries;
CREATE OR REPLACE VIEW public.provider_analytics         AS SELECT * FROM providers.provider_analytics;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.provider_profiles,
     public.provider_engagements,
     public.provider_consent_scopes,
     public.provider_recommendations,
     public.provider_outcomes,
     public.provider_knowledge_entries,
     public.provider_analytics
  TO authenticated;


-- ###########################################################################
-- GraphRAG sync — providers route through enqueue_sync with the
-- *patient's* user_id so the worker can project provider-sourced
-- recommendations into the patient's personal Neo4j sub-graph with a
-- provider-attributed edge. provider_profiles + provider_analytics +
-- provider_knowledge_entries use the provider's user_id.
-- ###########################################################################
CREATE OR REPLACE FUNCTION providers.trigger_provider_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_entity_type TEXT;
  v_owner_id    UUID;
  v_payload     JSONB;
BEGIN
  v_entity_type := CASE TG_TABLE_NAME
    WHEN 'provider_profiles'          THEN 'provider_profile'
    WHEN 'provider_engagements'       THEN 'provider_engagement'
    WHEN 'provider_consent_scopes'    THEN 'provider_consent_scope'
    WHEN 'provider_recommendations'   THEN 'provider_recommendation'
    WHEN 'provider_outcomes'          THEN 'provider_outcome'
    WHEN 'provider_knowledge_entries' THEN 'provider_knowledge_entry'
    WHEN 'provider_analytics'         THEN 'provider_analytics'
    ELSE 'provider_unknown'
  END;

  -- Pick whose user_id to attribute the sync row to.
  IF TG_TABLE_NAME IN ('provider_engagements','provider_consent_scopes','provider_recommendations','provider_outcomes') THEN
    -- Patient-scoped: project into patient's personal graph.
    IF TG_OP = 'DELETE' THEN v_owner_id := OLD.patient_user_id;
    ELSE                     v_owner_id := NEW.patient_user_id;
    END IF;
  ELSIF TG_TABLE_NAME IN ('provider_profiles','provider_knowledge_entries','provider_analytics') THEN
    -- Provider-scoped: project into the provider's own personal graph.
    DECLARE
      v_provider_user_id UUID;
    BEGIN
      IF TG_OP = 'DELETE' THEN
        IF TG_TABLE_NAME = 'provider_profiles' THEN
          v_owner_id := OLD.user_id;
        ELSE
          SELECT user_id INTO v_owner_id FROM providers.provider_profiles WHERE id = OLD.provider_id;
        END IF;
      ELSE
        IF TG_TABLE_NAME = 'provider_profiles' THEN
          v_owner_id := NEW.user_id;
        ELSE
          SELECT user_id INTO v_owner_id FROM providers.provider_profiles WHERE id = NEW.provider_id;
        END IF;
      END IF;
    END;
  END IF;

  IF v_owner_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(
      v_owner_id, v_entity_type, OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb
    );
    RETURN OLD;
  END IF;

  v_payload := to_jsonb(NEW) - 'metadata' - 'created_at' - 'updated_at';
  PERFORM graphrag.enqueue_sync(
    v_owner_id, v_entity_type, NEW.id,
    TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert', v_payload
  );
  RETURN NEW;
END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'provider_profiles','provider_engagements','provider_consent_scopes',
    'provider_recommendations','provider_outcomes','provider_knowledge_entries',
    'provider_analytics'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trigger_graphrag_%I_sync ON providers.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trigger_graphrag_%I_sync '
      'AFTER INSERT OR UPDATE OR DELETE ON providers.%I '
      'FOR EACH ROW EXECUTE FUNCTION providers.trigger_provider_sync()',
      t, t
    );
  END LOOP;
END $$;


-- ###########################################################################
-- Self-test
-- ###########################################################################
DO $$
DECLARE t TEXT; v_rls BOOLEAN;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'provider_profiles','provider_engagements','provider_consent_scopes',
    'provider_recommendations','provider_outcomes','provider_knowledge_entries',
    'provider_analytics'
  ]
  LOOP
    SELECT relrowsecurity INTO v_rls
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'providers' AND c.relname = t;
    IF v_rls IS NULL THEN
      RAISE EXCEPTION '085 self-test: missing table providers.%', t;
    END IF;
    IF NOT v_rls THEN
      RAISE EXCEPTION '085 self-test: RLS not enabled on providers.%', t;
    END IF;
  END LOOP;
END $$;
