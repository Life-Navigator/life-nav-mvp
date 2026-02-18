-- ==========================================================================
-- MVP Integrations/Auth hardening for Supabase-first deployment
-- - secure token vault in core schema
-- - service-role-only RPCs for token writes/deletes
-- - sync status metadata into public.integrations (no secrets)
-- ==========================================================================

CREATE TABLE IF NOT EXISTS core.integration_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft', 'plaid')),
  external_account_id TEXT,
  external_email TEXT,
  scope TEXT,
  access_token_encrypted BYTEA NOT NULL,
  refresh_token_encrypted BYTEA,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_integration_tokens_user_provider
  ON core.integration_tokens(user_id, provider);

ALTER TABLE core.integration_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mvp_integration_tokens_service_role" ON core.integration_tokens;
CREATE POLICY "mvp_integration_tokens_service_role" ON core.integration_tokens
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trigger_integration_tokens_updated_at ON core.integration_tokens;
CREATE TRIGGER trigger_integration_tokens_updated_at
  BEFORE UPDATE ON core.integration_tokens
  FOR EACH ROW
  EXECUTE FUNCTION core.set_updated_at();

CREATE OR REPLACE FUNCTION core.map_integration_provider(p_provider TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE lower(coalesce(p_provider, ''))
    WHEN 'google' THEN 'google_calendar'
    WHEN 'microsoft' THEN 'outlook_calendar'
    WHEN 'plaid' THEN 'plaid'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION core.upsert_integration_token(
  p_user_id UUID,
  p_provider TEXT,
  p_access_token TEXT,
  p_refresh_token TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_scope TEXT DEFAULT NULL,
  p_external_account_id TEXT DEFAULT NULL,
  p_external_email TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_encryption_key TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = core, public
AS $$
DECLARE
  v_provider TEXT := lower(coalesce(p_provider, ''));
  v_key TEXT;
  v_id UUID;
  v_public_provider TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  IF v_provider NOT IN ('google', 'microsoft', 'plaid') THEN
    RAISE EXCEPTION 'Unsupported provider: %', p_provider;
  END IF;

  IF coalesce(p_access_token, '') = '' THEN
    RAISE EXCEPTION 'p_access_token is required';
  END IF;

  v_key := coalesce(nullif(p_encryption_key, ''), current_setting('app.settings.encryption_key', true));
  IF coalesce(v_key, '') = '' THEN
    RAISE EXCEPTION 'Encryption key not provided';
  END IF;

  INSERT INTO core.integration_tokens (
    user_id,
    provider,
    external_account_id,
    external_email,
    scope,
    access_token_encrypted,
    refresh_token_encrypted,
    expires_at,
    metadata
  ) VALUES (
    p_user_id,
    v_provider,
    p_external_account_id,
    p_external_email,
    p_scope,
    core.encrypt_text(p_access_token, v_key),
    CASE WHEN p_refresh_token IS NULL THEN NULL ELSE core.encrypt_text(p_refresh_token, v_key) END,
    p_expires_at,
    coalesce(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT (user_id, provider) DO UPDATE
    SET external_account_id = EXCLUDED.external_account_id,
        external_email = EXCLUDED.external_email,
        scope = EXCLUDED.scope,
        access_token_encrypted = EXCLUDED.access_token_encrypted,
        refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
        expires_at = EXCLUDED.expires_at,
        metadata = EXCLUDED.metadata,
        updated_at = now()
  RETURNING id INTO v_id;

  v_public_provider := core.map_integration_provider(v_provider);
  IF v_public_provider IS NOT NULL THEN
    INSERT INTO public.integrations (
      user_id,
      provider,
      status,
      scopes,
      metadata,
      last_sync_at,
      updated_at
    ) VALUES (
      p_user_id,
      v_public_provider,
      'connected',
      CASE
        WHEN coalesce(p_scope, '') = '' THEN '[]'::jsonb
        ELSE to_jsonb(regexp_split_to_array(trim(p_scope), '\s+'))
      END,
      jsonb_build_object(
        'account_id', p_external_account_id,
        'email', p_external_email,
        'source', 'core.integration_tokens'
      ) || coalesce(p_metadata, '{}'::jsonb),
      now(),
      now()
    )
    ON CONFLICT (user_id, provider) DO UPDATE
      SET status = 'connected',
          error_message = NULL,
          error_code = NULL,
          scopes = EXCLUDED.scopes,
          metadata = EXCLUDED.metadata,
          last_sync_at = now(),
          updated_at = now();
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION core.disconnect_integration(
  p_user_id UUID,
  p_provider TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = core, public
AS $$
DECLARE
  v_provider TEXT := lower(coalesce(p_provider, ''));
  v_public_provider TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  IF v_provider NOT IN ('google', 'microsoft', 'plaid') THEN
    RAISE EXCEPTION 'Unsupported provider: %', p_provider;
  END IF;

  DELETE FROM core.integration_tokens
  WHERE user_id = p_user_id
    AND provider = v_provider;

  v_public_provider := core.map_integration_provider(v_provider);
  IF v_public_provider IS NOT NULL THEN
    UPDATE public.integrations
      SET status = 'disconnected',
          updated_at = now()
    WHERE user_id = p_user_id
      AND provider = v_public_provider;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION core.upsert_integration_token(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION core.disconnect_integration(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION core.map_integration_provider(TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION core.upsert_integration_token(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, JSONB, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION core.disconnect_integration(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION core.map_integration_provider(TEXT) TO service_role;
