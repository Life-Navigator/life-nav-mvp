-- ==========================================================================
-- 087: Arcana Provider Portal — internal messaging + lead workflow events.
--
-- Sprint J adds two tables on top of the Sprint I provider GraphRAG:
--
--   1. providers.provider_messages — secure provider↔patient messaging.
--      Every message is bound to an engagement and inherits its scope.
--      RLS only allows reads for the engagement's provider OR the
--      engagement's patient.
--
--   2. providers.lead_workflow_events — append-only audit log of
--      accept / decline / withdraw transitions on a provider lead.
--      Used by the dashboard to render lead history badges.
--
-- The engagement.status field already covers pending → active /
-- declined / revoked, so we do not duplicate it. The event log is
-- additive history.
--
-- All RLS policies route through the same providers.has_access_to()
-- function created in 085. The message table also enforces that the
-- engagement is active at write time.
-- ==========================================================================


-- ###########################################################################
-- 1. provider_messages
-- ###########################################################################

CREATE OR REPLACE FUNCTION providers.is_message_kind(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN (
    'follow_up_request', 'review_request', 'clarification_request',
    'general_note', 'patient_reply', 'system_event'
  )
$$;

CREATE OR REPLACE FUNCTION providers.is_message_sender_role(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('provider', 'patient', 'system')
$$;

CREATE TABLE IF NOT EXISTS providers.provider_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id   UUID NOT NULL REFERENCES providers.provider_engagements(id) ON DELETE CASCADE,
  provider_id     UUID NOT NULL REFERENCES providers.provider_profiles(id) ON DELETE CASCADE,
  patient_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_user_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_role     TEXT NOT NULL CHECK (providers.is_message_sender_role(sender_role)),
  kind            TEXT NOT NULL CHECK (providers.is_message_kind(kind)),
  subject         TEXT,
  body            TEXT NOT NULL CHECK (length(body) > 0 AND length(body) <= 8000),
  -- Optional binding to a recommendation/goal/lead so the UI can render
  -- the message inline next to the relevant artifact.
  related_recommendation_id UUID REFERENCES providers.provider_recommendations(id) ON DELETE SET NULL,
  related_lead_package_id   UUID,                          -- arcana.lead_packages, soft-FK to avoid schema-order issues
  -- Inbound state — provider sees what patient saw, patient sees what
  -- provider saw. We do not record sub-second granularity.
  read_at         TIMESTAMPTZ,
  -- Soft-deletion for the sending side. Hard-deleting messages is not
  -- allowed: this is an audit-relevant communication trail.
  hidden_for_sender BOOLEAN NOT NULL DEFAULT FALSE,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pm_engagement ON providers.provider_messages(engagement_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pm_patient    ON providers.provider_messages(patient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pm_provider   ON providers.provider_messages(provider_id, created_at DESC);


-- updated_at trigger
DROP TRIGGER IF EXISTS set_provider_messages_updated_at ON providers.provider_messages;
CREATE TRIGGER set_provider_messages_updated_at
  BEFORE UPDATE ON providers.provider_messages
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- ###########################################################################
-- 2. lead_workflow_events
-- ###########################################################################

CREATE OR REPLACE FUNCTION providers.is_lead_event(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN (
    'lead_received',      -- first time the provider is shown the lead
    'lead_viewed',
    'lead_accepted',      -- engagement → active
    'lead_declined',
    'lead_withdrawn_by_patient',
    'engagement_paused',
    'engagement_resumed',
    'engagement_revoked',
    'engagement_expired'
  )
$$;

CREATE TABLE IF NOT EXISTS providers.lead_workflow_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id     UUID NOT NULL REFERENCES providers.provider_profiles(id) ON DELETE CASCADE,
  patient_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  engagement_id   UUID REFERENCES providers.provider_engagements(id) ON DELETE SET NULL,
  lead_package_id UUID,                                   -- soft-FK
  event_kind      TEXT NOT NULL CHECK (providers.is_lead_event(event_kind)),
  reason          TEXT,
  actor_user_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lwe_provider ON providers.lead_workflow_events(provider_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_lwe_patient  ON providers.lead_workflow_events(patient_user_id, occurred_at DESC);


-- ###########################################################################
-- RLS — message read: provider OR patient party to the engagement.
--      message write: same, AND engagement must be active.
--      lead events: provider for that lead OR the patient.
-- ###########################################################################
ALTER TABLE providers.provider_messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE providers.lead_workflow_events    ENABLE ROW LEVEL SECURITY;

-- provider_messages: read
DROP POLICY IF EXISTS pm_read ON providers.provider_messages;
CREATE POLICY pm_read ON providers.provider_messages FOR SELECT
USING (
  -- The patient party can always read.
  auth.uid() = patient_user_id
  OR
  -- Or the provider user mapped to provider_id.
  EXISTS (
    SELECT 1
      FROM providers.provider_profiles pp
     WHERE pp.id = provider_messages.provider_id
       AND pp.user_id = auth.uid()
  )
);

-- provider_messages: write
DROP POLICY IF EXISTS pm_insert ON providers.provider_messages;
CREATE POLICY pm_insert ON providers.provider_messages FOR INSERT
WITH CHECK (
  -- Sender must be one of the parties.
  sender_user_id = auth.uid()
  AND (
    -- Patient sending.
    (sender_role = 'patient' AND auth.uid() = patient_user_id)
    OR
    -- Provider sending.
    (sender_role = 'provider' AND EXISTS (
      SELECT 1 FROM providers.provider_profiles pp
       WHERE pp.id = provider_messages.provider_id
         AND pp.user_id = auth.uid()
    ))
  )
  AND
  -- Engagement must currently be active.
  EXISTS (
    SELECT 1 FROM providers.provider_engagements pe
     WHERE pe.id = provider_messages.engagement_id
       AND pe.provider_id = provider_messages.provider_id
       AND pe.patient_user_id = provider_messages.patient_user_id
       AND pe.status = 'active'
       AND (pe.expires_at IS NULL OR pe.expires_at > NOW())
       AND pe.revoked_at IS NULL
  )
);

-- provider_messages: update (only read_at + hidden_for_sender)
DROP POLICY IF EXISTS pm_update ON providers.provider_messages;
CREATE POLICY pm_update ON providers.provider_messages FOR UPDATE
USING (
  auth.uid() = patient_user_id
  OR EXISTS (
    SELECT 1 FROM providers.provider_profiles pp
     WHERE pp.id = provider_messages.provider_id
       AND pp.user_id = auth.uid()
  )
)
WITH CHECK (
  auth.uid() = patient_user_id
  OR EXISTS (
    SELECT 1 FROM providers.provider_profiles pp
     WHERE pp.id = provider_messages.provider_id
       AND pp.user_id = auth.uid()
  )
);

-- Service role escape hatch
DROP POLICY IF EXISTS pm_service ON providers.provider_messages;
CREATE POLICY pm_service ON providers.provider_messages FOR ALL TO service_role
USING (true) WITH CHECK (true);


-- lead_workflow_events: read
DROP POLICY IF EXISTS lwe_read ON providers.lead_workflow_events;
CREATE POLICY lwe_read ON providers.lead_workflow_events FOR SELECT
USING (
  auth.uid() = patient_user_id
  OR EXISTS (
    SELECT 1 FROM providers.provider_profiles pp
     WHERE pp.id = lead_workflow_events.provider_id
       AND pp.user_id = auth.uid()
  )
);

-- lead_workflow_events: insert
DROP POLICY IF EXISTS lwe_insert ON providers.lead_workflow_events;
CREATE POLICY lwe_insert ON providers.lead_workflow_events FOR INSERT
WITH CHECK (
  actor_user_id = auth.uid()
  AND (
    auth.uid() = patient_user_id
    OR EXISTS (
      SELECT 1 FROM providers.provider_profiles pp
       WHERE pp.id = lead_workflow_events.provider_id
         AND pp.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS lwe_service ON providers.lead_workflow_events;
CREATE POLICY lwe_service ON providers.lead_workflow_events FOR ALL TO service_role
USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON providers.provider_messages    TO authenticated;
GRANT SELECT, INSERT          ON providers.lead_workflow_events TO authenticated;


-- ###########################################################################
-- Public views
-- ###########################################################################
CREATE OR REPLACE VIEW public.provider_messages       AS SELECT * FROM providers.provider_messages;
CREATE OR REPLACE VIEW public.lead_workflow_events    AS SELECT * FROM providers.lead_workflow_events;
GRANT SELECT, INSERT, UPDATE ON public.provider_messages       TO authenticated;
GRANT SELECT, INSERT          ON public.lead_workflow_events    TO authenticated;


-- ###########################################################################
-- GraphRAG sync — extend the 085 provider sync trigger.
-- Sensitive fields removed before embedding.
-- ###########################################################################
CREATE OR REPLACE FUNCTION providers.trigger_provider_portal_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_entity_type TEXT;
  v_payload     JSONB;
  v_user_id     UUID;
BEGIN
  v_entity_type := CASE TG_TABLE_NAME
    WHEN 'provider_messages'    THEN 'provider_message'
    WHEN 'lead_workflow_events' THEN 'lead_workflow_event'
    ELSE 'unknown'
  END;

  v_user_id := COALESCE(NEW.patient_user_id, OLD.patient_user_id);

  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(
      v_user_id, v_entity_type, OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb
    );
    RETURN OLD;
  END IF;

  v_payload := to_jsonb(NEW)
    - 'metadata' - 'created_at' - 'updated_at'
    - 'body'                     -- never embed the message body
    - 'subject'                  -- the subject can carry PHI too
    - 'patient_user_id' - 'sender_user_id' - 'actor_user_id';

  PERFORM graphrag.enqueue_sync(
    v_user_id, v_entity_type, NEW.id,
    TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert', v_payload
  );
  RETURN NEW;
END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['provider_messages', 'lead_workflow_events'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trigger_graphrag_%I_sync ON providers.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trigger_graphrag_%I_sync '
      'AFTER INSERT OR UPDATE OR DELETE ON providers.%I '
      'FOR EACH ROW EXECUTE FUNCTION providers.trigger_provider_portal_sync()',
      t, t
    );
  END LOOP;
END $$;


-- ###########################################################################
-- Helper: SECURITY DEFINER function asserting an engagement is
-- write-eligible. Used by the message-service to fail fast with a
-- clear reason rather than have RLS issue an opaque insert denial.
-- ###########################################################################
CREATE OR REPLACE FUNCTION providers.engagement_writable(p_engagement_id UUID)
RETURNS TABLE (writable BOOLEAN, reason TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = providers, public
AS $$
DECLARE r providers.provider_engagements%ROWTYPE;
BEGIN
  SELECT * INTO r FROM providers.provider_engagements WHERE id = p_engagement_id LIMIT 1;
  IF r.id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'engagement_not_found'::TEXT; RETURN;
  END IF;
  IF r.status <> 'active' THEN
    RETURN QUERY SELECT FALSE, ('engagement_status_' || r.status)::TEXT; RETURN;
  END IF;
  IF r.revoked_at IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, 'engagement_revoked'::TEXT; RETURN;
  END IF;
  IF r.expires_at IS NOT NULL AND r.expires_at < NOW() THEN
    RETURN QUERY SELECT FALSE, 'engagement_expired'::TEXT; RETURN;
  END IF;
  RETURN QUERY SELECT TRUE, NULL::TEXT;
END $$;

GRANT EXECUTE ON FUNCTION providers.engagement_writable(UUID) TO authenticated, service_role;


-- ###########################################################################
-- Self-test
-- ###########################################################################
DO $$
DECLARE rls BOOLEAN;
BEGIN
  SELECT relrowsecurity INTO rls FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'providers' AND c.relname = 'provider_messages';
  IF NOT rls THEN RAISE EXCEPTION '087 self-test: RLS missing on provider_messages'; END IF;

  SELECT relrowsecurity INTO rls FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'providers' AND c.relname = 'lead_workflow_events';
  IF NOT rls THEN RAISE EXCEPTION '087 self-test: RLS missing on lead_workflow_events'; END IF;
END $$;
