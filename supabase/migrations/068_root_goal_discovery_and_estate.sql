-- ==========================================================================
-- 068: Root-Goal Discovery, Driver Scoring, Estate Planning, Consent Layer
--
-- New surface area for the Conversational Onboarding system:
--   1. Extends public.goals with root-goal + driver-scoring columns
--   2. New public.goal_discovery_turns — audit log of the drill-down
--   3. New public.estate_planning_profile (singleton) + estate_beneficiaries
--   4. Extends core.consent_records with purpose + scope
--   5. New core.user_integration_consents — per-integration grants
--   6. GraphRAG sync triggers for the new surface
-- ==========================================================================


-- -------------------------------------------------------------------------
-- 1. public.goals — extend with root-goal discovery + driver scoring
-- -------------------------------------------------------------------------
ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS stated_goal TEXT,
  ADD COLUMN IF NOT EXISTS need_behind_need TEXT,
  ADD COLUMN IF NOT EXISTS root_goal TEXT,
  ADD COLUMN IF NOT EXISTS success_definition TEXT,
  ADD COLUMN IF NOT EXISTS consequence_of_inaction TEXT,
  ADD COLUMN IF NOT EXISTS urgency TEXT
    CHECK (urgency IS NULL OR urgency IN ('low', 'medium', 'high', 'critical')),
  ADD COLUMN IF NOT EXISTS financial_security_score NUMERIC(3,2)
    CHECK (financial_security_score IS NULL OR (financial_security_score BETWEEN 0 AND 1)),
  ADD COLUMN IF NOT EXISTS image_score NUMERIC(3,2)
    CHECK (image_score IS NULL OR (image_score BETWEEN 0 AND 1)),
  ADD COLUMN IF NOT EXISTS performance_score NUMERIC(3,2)
    CHECK (performance_score IS NULL OR (performance_score BETWEEN 0 AND 1)),
  ADD COLUMN IF NOT EXISTS dominant_driver TEXT
    CHECK (dominant_driver IS NULL OR dominant_driver IN ('financial_security', 'image', 'performance')),
  ADD COLUMN IF NOT EXISTS secondary_driver TEXT
    CHECK (secondary_driver IS NULL OR secondary_driver IN ('financial_security', 'image', 'performance')),
  ADD COLUMN IF NOT EXISTS root_goal_confidence_score NUMERIC(3,2)
    CHECK (root_goal_confidence_score IS NULL OR (root_goal_confidence_score BETWEEN 0 AND 1)),
  ADD COLUMN IF NOT EXISTS discovery_completed_at TIMESTAMPTZ;


-- -------------------------------------------------------------------------
-- 2. public.goal_discovery_turns
--   One row per discovery prompt + answer turn. The transcript that
--   produced the stored root_goal / driver scores; useful for re-running
--   the engine after a model change and for explanation in the UI.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.goal_discovery_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES public.goals(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,                          -- groups turns for one discovery session
  turn_index INT NOT NULL CHECK (turn_index >= 0),
  prompt_kind TEXT NOT NULL
    CHECK (prompt_kind IN ('what_accomplish', 'what_unlock', 'why_important', 'success_definition',
                            'consequence_of_inaction', 'urgency', 'confirmation', 'free_text', 'agent_summary')),
  prompt_text TEXT NOT NULL,
  user_answer TEXT,
  detected_drivers JSONB NOT NULL DEFAULT '{}',      -- {financial_security, image, performance} per-turn scores
  inferred_root_goal TEXT,
  confidence_after_turn NUMERIC(3,2)
    CHECK (confidence_after_turn IS NULL OR (confidence_after_turn BETWEEN 0 AND 1)),
  agent_persona TEXT,                                -- 'financial_advisor' | 'physician_intake' | ...
  source TEXT NOT NULL DEFAULT 'onboarding',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gdt_user_session
  ON public.goal_discovery_turns(user_id, session_id, turn_index);
CREATE INDEX IF NOT EXISTS idx_gdt_goal
  ON public.goal_discovery_turns(goal_id) WHERE goal_id IS NOT NULL;

ALTER TABLE public.goal_discovery_turns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gdt_owner_all" ON public.goal_discovery_turns
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gdt_service_role" ON public.goal_discovery_turns
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- -------------------------------------------------------------------------
-- 3. Estate planning
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.estate_planning_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Will / trust
  has_will BOOLEAN,
  will_last_updated DATE,
  has_living_trust BOOLEAN,
  trust_type TEXT,                                   -- 'revocable', 'irrevocable', 'special_needs', ...
  trust_last_updated DATE,

  -- Powers of attorney
  has_financial_poa BOOLEAN,
  financial_poa_holder TEXT,
  has_healthcare_poa BOOLEAN,
  healthcare_poa_holder TEXT,

  -- Directives
  has_healthcare_directive BOOLEAN,
  has_living_will BOOLEAN,
  has_hipaa_release BOOLEAN,

  -- Guardianship
  has_minor_children BOOLEAN,
  guardian_designated BOOLEAN,
  guardian_name TEXT,
  guardian_relationship TEXT,
  alternate_guardian_name TEXT,

  -- Charitable & legacy
  charitable_intent TEXT,                            -- free text
  legacy_goals TEXT,

  -- Business continuity
  owns_business BOOLEAN,
  has_business_continuity_plan BOOLEAN,
  business_continuity_notes TEXT,

  -- Digital assets
  digital_asset_inventory_status TEXT
    CHECK (digital_asset_inventory_status IS NULL OR digital_asset_inventory_status IN ('none', 'partial', 'complete')),
  digital_asset_access_method TEXT,                  -- e.g. 'password_manager', 'sealed_letter', 'attorney'

  -- Concerns / open items the user wants to address
  open_concerns TEXT,

  source TEXT NOT NULL DEFAULT 'onboarding',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.estate_planning_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "epp_owner_all" ON public.estate_planning_profile
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "epp_service_role" ON public.estate_planning_profile
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_epp_updated_at
  BEFORE UPDATE ON public.estate_planning_profile
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


CREATE TABLE IF NOT EXISTS public.estate_beneficiaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  family_member_id UUID REFERENCES public.family_members(id) ON DELETE SET NULL,
  beneficiary_name TEXT NOT NULL,
  relationship TEXT,
  asset_class TEXT,                                  -- 'will_residual', 'retirement_account', 'life_insurance', 'trust', 'specific_bequest'
  asset_reference TEXT,                              -- e.g. account name / policy number (free-text label only — not encrypted)
  allocation_percent NUMERIC(5,2)
    CHECK (allocation_percent IS NULL OR allocation_percent BETWEEN 0 AND 100),
  is_contingent BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'onboarding',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_estate_benef_user
  ON public.estate_beneficiaries(user_id);
CREATE INDEX IF NOT EXISTS idx_estate_benef_user_class
  ON public.estate_beneficiaries(user_id, asset_class);

ALTER TABLE public.estate_beneficiaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "estate_benef_owner_all" ON public.estate_beneficiaries
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "estate_benef_service_role" ON public.estate_beneficiaries
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_estate_benef_updated_at
  BEFORE UPDATE ON public.estate_beneficiaries
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 4. Consent architecture — extend the existing core.consent_records
-- -------------------------------------------------------------------------
ALTER TABLE core.consent_records
  ADD COLUMN IF NOT EXISTS purpose TEXT,                  -- 'onboarding_intake', 'arcana_lead', 'plaid_link', ...
  ADD COLUMN IF NOT EXISTS scope JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- An explicit DELETE policy mirrored on the owner so they can fully erase
-- consent rows if desired (the existing policies only allow SELECT/INSERT).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'core' AND tablename = 'consent_records'
      AND policyname = 'users_update_own_consent'
  ) THEN
    CREATE POLICY "users_update_own_consent" ON core.consent_records
      FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'core' AND tablename = 'consent_records'
      AND policyname = 'users_delete_own_consent'
  ) THEN
    CREATE POLICY "users_delete_own_consent" ON core.consent_records
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END$$;


-- -------------------------------------------------------------------------
-- 5. core.user_integration_consents
--   Per-integration consent grants (Plaid, Google, Microsoft, document
--   upload, etc.) with scope detail, expiry, and revocation. Distinct
--   from core.consent_records (which covers terms/marketing/etc.) so we
--   can model OAuth-style scopes cleanly.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS core.user_integration_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  integration TEXT NOT NULL,                         -- 'plaid' | 'google_drive' | 'gmail' | 'google_calendar' | 'microsoft' | 'document_upload' | 'arcana_lead_sharing' | 'advisor_access' | 'wearable_health_connect' | 'other'
  purpose TEXT NOT NULL,                             -- 'transaction_sync', 'lead_generation', 'session_calendar_sync', ...
  scope JSONB NOT NULL DEFAULT '{}',                 -- per-integration shape (e.g. plaid products: ['transactions','liabilities'])
  granted BOOLEAN NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  consent_version TEXT,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, integration, purpose)
);

CREATE INDEX IF NOT EXISTS idx_uic_user
  ON core.user_integration_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_uic_user_active
  ON core.user_integration_consents(user_id, integration)
  WHERE granted = TRUE AND revoked_at IS NULL;

ALTER TABLE core.user_integration_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uic_owner_select" ON core.user_integration_consents
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "uic_owner_insert" ON core.user_integration_consents
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "uic_owner_update" ON core.user_integration_consents
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "uic_service_role" ON core.user_integration_consents
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER set_uic_updated_at
  BEFORE UPDATE ON core.user_integration_consents
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 6. Helper RPC: record / revoke integration consent
--   Records a grant idempotently (UPSERT on user_id+integration+purpose),
--   stamps IP / UA captured at the API layer, and audit-logs the change.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION core.record_integration_consent(
  p_integration TEXT,
  p_purpose TEXT,
  p_scope JSONB DEFAULT '{}'::jsonb,
  p_consent_version TEXT DEFAULT NULL,
  p_ip INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = core, public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'record_integration_consent requires an authenticated user';
  END IF;

  INSERT INTO core.user_integration_consents
    (user_id, integration, purpose, scope, granted, granted_at, revoked_at,
     expires_at, consent_version, ip_address, user_agent)
  VALUES
    (v_user, p_integration, p_purpose, COALESCE(p_scope, '{}'::jsonb), TRUE,
     NOW(), NULL, p_expires_at, p_consent_version, p_ip, p_user_agent)
  ON CONFLICT (user_id, integration, purpose)
  DO UPDATE SET
    granted = TRUE,
    scope = EXCLUDED.scope,
    granted_at = NOW(),
    revoked_at = NULL,
    expires_at = EXCLUDED.expires_at,
    consent_version = EXCLUDED.consent_version,
    ip_address = EXCLUDED.ip_address,
    user_agent = EXCLUDED.user_agent,
    updated_at = NOW()
  RETURNING id INTO v_id;

  INSERT INTO core.security_audit_log
    (user_id, action, resource_type, resource_id, ip_address, user_agent, metadata)
  VALUES
    (v_user, 'integration_consent_granted', 'integration', p_integration,
     p_ip, p_user_agent,
     jsonb_build_object('purpose', p_purpose, 'scope', p_scope));

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION core.revoke_integration_consent(
  p_integration TEXT,
  p_purpose TEXT,
  p_ip INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = core, public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_rows INT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'revoke_integration_consent requires an authenticated user';
  END IF;

  UPDATE core.user_integration_consents
     SET granted = FALSE,
         revoked_at = NOW(),
         updated_at = NOW()
   WHERE user_id = v_user
     AND integration = p_integration
     AND purpose = p_purpose
     AND granted = TRUE;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  INSERT INTO core.security_audit_log
    (user_id, action, resource_type, resource_id, ip_address, user_agent, metadata)
  VALUES
    (v_user, 'integration_consent_revoked', 'integration', p_integration,
     p_ip, p_user_agent,
     jsonb_build_object('purpose', p_purpose, 'rows_affected', v_rows));

  RETURN v_rows > 0;
END;
$$;

REVOKE ALL ON FUNCTION core.record_integration_consent(TEXT, TEXT, JSONB, TEXT, INET, TEXT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION core.revoke_integration_consent(TEXT, TEXT, INET, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.record_integration_consent(TEXT, TEXT, JSONB, TEXT, INET, TEXT, TIMESTAMPTZ) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.revoke_integration_consent(TEXT, TEXT, INET, TEXT) TO authenticated, service_role;


-- -------------------------------------------------------------------------
-- 7. GraphRAG sync triggers for the new surface
--   Mirrors the pattern from 055. enqueue_sync expects p_entity_id UUID
--   so we pass the raw uuid.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION graphrag.trigger_goal_discovery_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(
      OLD.user_id, 'goal_discovery_turn', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb
    );
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(
      NEW.user_id, 'goal_discovery_turn', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'goal_id', NEW.goal_id,
        'session_id', NEW.session_id,
        'turn_index', NEW.turn_index,
        'prompt_kind', NEW.prompt_kind,
        'user_answer', NEW.user_answer,
        'inferred_root_goal', NEW.inferred_root_goal,
        'confidence_after_turn', NEW.confidence_after_turn,
        'agent_persona', NEW.agent_persona,
        'detected_drivers', NEW.detected_drivers
      )
    );
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trigger_graphrag_goal_discovery_sync ON public.goal_discovery_turns;
CREATE TRIGGER trigger_graphrag_goal_discovery_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.goal_discovery_turns
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_goal_discovery_sync();


CREATE OR REPLACE FUNCTION graphrag.trigger_estate_profile_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(
      OLD.user_id, 'estate_profile', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb
    );
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(
      NEW.user_id, 'estate_profile', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'has_will', NEW.has_will,
        'has_living_trust', NEW.has_living_trust,
        'has_financial_poa', NEW.has_financial_poa,
        'has_healthcare_poa', NEW.has_healthcare_poa,
        'has_healthcare_directive', NEW.has_healthcare_directive,
        'has_minor_children', NEW.has_minor_children,
        'guardian_designated', NEW.guardian_designated,
        'owns_business', NEW.owns_business,
        'digital_asset_inventory_status', NEW.digital_asset_inventory_status,
        'charitable_intent', NEW.charitable_intent
      )
    );
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trigger_graphrag_estate_profile_sync ON public.estate_planning_profile;
CREATE TRIGGER trigger_graphrag_estate_profile_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.estate_planning_profile
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_estate_profile_sync();


CREATE OR REPLACE FUNCTION graphrag.trigger_estate_beneficiary_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(
      OLD.user_id, 'estate_beneficiary', OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb
    );
    RETURN OLD;
  ELSE
    PERFORM graphrag.enqueue_sync(
      NEW.user_id, 'estate_beneficiary', NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert',
      jsonb_build_object(
        'beneficiary_name', NEW.beneficiary_name,
        'relationship', NEW.relationship,
        'asset_class', NEW.asset_class,
        'allocation_percent', NEW.allocation_percent,
        'is_contingent', NEW.is_contingent
      )
    );
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trigger_graphrag_estate_beneficiary_sync ON public.estate_beneficiaries;
CREATE TRIGGER trigger_graphrag_estate_beneficiary_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.estate_beneficiaries
  FOR EACH ROW EXECUTE FUNCTION graphrag.trigger_estate_beneficiary_sync();
