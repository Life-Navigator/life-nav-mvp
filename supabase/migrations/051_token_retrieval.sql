-- ==========================================================================
-- 051: Token Retrieval RPC
-- Service-role-only function to decrypt integration tokens for Edge Functions.
-- ==========================================================================

CREATE OR REPLACE FUNCTION core.get_integration_token(
  p_user_id UUID,
  p_provider TEXT,
  p_encryption_key TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  scope TEXT,
  external_account_id TEXT,
  external_email TEXT,
  metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = core, public
AS $$
DECLARE
  v_key TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  v_key := coalesce(nullif(p_encryption_key, ''), current_setting('app.settings.encryption_key', true));
  IF coalesce(v_key, '') = '' THEN
    RAISE EXCEPTION 'Encryption key not provided';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    core.decrypt_text(t.access_token_encrypted, v_key) AS access_token,
    core.decrypt_text(t.refresh_token_encrypted, v_key) AS refresh_token,
    t.expires_at,
    t.scope,
    t.external_account_id,
    t.external_email,
    t.metadata
  FROM core.integration_tokens t
  WHERE t.user_id = p_user_id
    AND t.provider = lower(coalesce(p_provider, ''));
END;
$$;

-- Service-role only — never expose to client
REVOKE ALL ON FUNCTION core.get_integration_token(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.get_integration_token(UUID, TEXT, TEXT) TO service_role;

-- Utility: get all connected users for a provider (for batch sync workers)
CREATE OR REPLACE FUNCTION core.get_sync_eligible_users(
  p_provider TEXT,
  p_limit INT DEFAULT 100
)
RETURNS TABLE (
  user_id UUID,
  external_email TEXT,
  expires_at TIMESTAMPTZ,
  last_synced TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = core, public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.user_id,
    t.external_email,
    t.expires_at,
    COALESCE(
      (SELECT es.last_synced_at FROM public.email_sync_state es
       WHERE es.user_id = t.user_id AND es.provider = t.provider),
      '1970-01-01'::TIMESTAMPTZ
    ) AS last_synced
  FROM core.integration_tokens t
  WHERE t.provider = lower(coalesce(p_provider, ''))
  ORDER BY last_synced ASC
  LIMIT GREATEST(COALESCE(p_limit, 100), 1);
END;
$$;

REVOKE ALL ON FUNCTION core.get_sync_eligible_users(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.get_sync_eligible_users(TEXT, INT) TO service_role;
