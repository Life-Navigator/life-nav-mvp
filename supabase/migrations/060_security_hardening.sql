-- ==========================================================================
-- 060: Security Hardening Migration
-- Addresses all findings from the comprehensive RLS audit.
-- Run after all previous migrations (001-055).
-- ==========================================================================

-- ==========================================================================
-- SECTION 1: Enable RLS on tables that were missing it
-- ==========================================================================

-- CRITICAL: waitlist_entries contains PII (email, name, phone)
ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "waitlist_service_role_only" ON public.waitlist_entries;
CREATE POLICY "waitlist_service_role_only" ON public.waitlist_entries
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- notification_templates: system data, read-only for users
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notification_templates_read" ON public.notification_templates;
CREATE POLICY "notification_templates_read" ON public.notification_templates
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "notification_templates_service" ON public.notification_templates;
CREATE POLICY "notification_templates_service" ON public.notification_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- challenges: public game data, read-only for users
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "challenges_read" ON public.challenges;
CREATE POLICY "challenges_read" ON public.challenges
  FOR SELECT TO authenticated USING (is_active = TRUE);
DROP POLICY IF EXISTS "challenges_service" ON public.challenges;
CREATE POLICY "challenges_service" ON public.challenges
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- announcements: public content, filtered by active + publish date
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "announcements_read" ON public.announcements;
CREATE POLICY "announcements_read" ON public.announcements
  FOR SELECT TO authenticated
  USING (is_active = TRUE AND publish_at <= NOW() AND (expires_at IS NULL OR expires_at > NOW()));
DROP POLICY IF EXISTS "announcements_service" ON public.announcements;
CREATE POLICY "announcements_service" ON public.announcements
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ==========================================================================
-- SECTION 2: Fix overly permissive policies on sensitive tables
-- ==========================================================================

-- finance.plaid_items: Replace FOR ALL with granular policies
-- Users should NOT be able to UPDATE access_token_encrypted directly
DROP POLICY IF EXISTS "users_own_plaid" ON finance.plaid_items;

-- Users can read their own items (status, institution info — NOT access token)
CREATE POLICY "plaid_items_user_select" ON finance.plaid_items
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete their own items (disconnection is handled via Edge Function)
CREATE POLICY "plaid_items_user_delete" ON finance.plaid_items
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- INSERT and UPDATE restricted to service_role (Edge Functions handle this)
-- The existing "service_plaid" policy already covers service_role FOR ALL


-- ==========================================================================
-- SECTION 3: Fix graphrag.enqueue_sync auth vulnerability
-- ==========================================================================

-- Replace the function to add auth.uid() check
CREATE OR REPLACE FUNCTION graphrag.enqueue_sync(
  p_user_id UUID,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_source_table TEXT,
  p_operation TEXT DEFAULT 'upsert',
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = graphrag, public
AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Security: verify caller owns this data or is service_role
  -- Trigger functions run as SECURITY DEFINER (owner), so they pass through.
  -- Direct RPC calls from authenticated users must match auth.uid().
  IF current_setting('role', true) = 'authenticated' AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Cannot enqueue sync for another user';
  END IF;

  INSERT INTO graphrag.sync_queue (
    user_id, entity_type, entity_id, source_table, operation, payload
  ) VALUES (
    p_user_id, p_entity_type, p_entity_id, p_source_table, p_operation, p_payload
  )
  ON CONFLICT (entity_id) DO UPDATE SET
    operation = EXCLUDED.operation,
    payload = EXCLUDED.payload,
    sync_status = 'pending',
    attempts = 0,
    last_error = NULL,
    updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Keep grants as-is (triggers need authenticated context to fire)
REVOKE ALL ON FUNCTION graphrag.enqueue_sync(UUID, TEXT, UUID, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION graphrag.enqueue_sync(UUID, TEXT, UUID, TEXT, TEXT, JSONB) TO service_role, authenticated;


-- ==========================================================================
-- SECTION 4: Make audit log append-only for service_role
-- ==========================================================================

-- Drop the blanket service_role policy and replace with granular ones
DROP POLICY IF EXISTS "security_audit_service" ON core.security_audit_log;
DROP POLICY IF EXISTS "mvp_security_audit_service" ON core.security_audit_log;

-- Service role can only INSERT and SELECT (append-only, no tampering)
CREATE POLICY "audit_log_service_insert" ON core.security_audit_log
  FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "audit_log_service_select" ON core.security_audit_log
  FOR SELECT TO service_role USING (true);


-- ==========================================================================
-- SECTION 5: Add missing service_role policies on finance tables
-- ==========================================================================

DROP POLICY IF EXISTS "assets_service" ON finance.assets;
CREATE POLICY "assets_service" ON finance.assets
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "asset_loans_service" ON finance.asset_loans;
CREATE POLICY "asset_loans_service" ON finance.asset_loans
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "investment_holdings_service" ON finance.investment_holdings;
CREATE POLICY "investment_holdings_service" ON finance.investment_holdings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "financial_goals_service" ON finance.financial_goals;
CREATE POLICY "financial_goals_service" ON finance.financial_goals
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tax_profiles_service" ON finance.tax_profiles;
CREATE POLICY "tax_profiles_service" ON finance.tax_profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "employer_benefits_service" ON finance.employer_benefits;
CREATE POLICY "employer_benefits_service" ON finance.employer_benefits
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "retirement_plans_service" ON finance.retirement_plans;
CREATE POLICY "retirement_plans_service" ON finance.retirement_plans
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ==========================================================================
-- SECTION 6: Remove redundant SELECT policies (cleanup)
-- ==========================================================================

-- goals: has both "FOR SELECT" and "FOR ALL" with same check — drop redundant SELECT
DROP POLICY IF EXISTS "Users can view own goals" ON public.goals;

-- user_preferences: same pattern
DROP POLICY IF EXISTS "Users can view own preferences" ON public.user_preferences;


-- ==========================================================================
-- SECTION 7: Tighten login_attempts to append-only
-- ==========================================================================

DROP POLICY IF EXISTS "mvp_login_attempts_service" ON core.login_attempts;

CREATE POLICY "login_attempts_service_insert" ON core.login_attempts
  FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "login_attempts_service_select" ON core.login_attempts
  FOR SELECT TO service_role USING (true);
-- UPDATE allowed for marking attempts as locked out
CREATE POLICY "login_attempts_service_update" ON core.login_attempts
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);


-- ==========================================================================
-- SECTION 8: Add plaid_account_id column to financial_accounts (for linking)
-- ==========================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'finance'
      AND table_name = 'financial_accounts'
      AND column_name = 'plaid_account_id'
  ) THEN
    ALTER TABLE finance.financial_accounts ADD COLUMN plaid_account_id TEXT UNIQUE;
  END IF;
END$$;


-- ==========================================================================
-- SECTION 9: Ensure graphrag schema is grantable to PostgREST
-- ==========================================================================

-- Grant schema usage (required for Edge Functions to call RPCs in this schema)
GRANT USAGE ON SCHEMA graphrag TO service_role;
GRANT USAGE ON SCHEMA core TO service_role;
GRANT USAGE ON SCHEMA finance TO service_role;
GRANT USAGE ON SCHEMA health_meta TO service_role;


-- ==========================================================================
-- DONE
-- ==========================================================================
