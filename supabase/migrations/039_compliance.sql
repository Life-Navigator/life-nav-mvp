-- ==========================================================================
-- 039: GDPR & Financial Compliance
-- Consent tracking, data export, data deletion
-- ==========================================================================

-- Consent records (GDPR Article 7)
CREATE TABLE IF NOT EXISTS core.consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL, -- terms_of_service, privacy_policy, data_processing, marketing, analytics, third_party_sharing
  version TEXT NOT NULL, -- version of the policy accepted
  granted BOOLEAN NOT NULL,
  ip_address INET,
  user_agent TEXT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_consent_user ON core.consent_records(user_id, consent_type);

ALTER TABLE core.consent_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_view_own_consent" ON core.consent_records
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_consent" ON core.consent_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "service_consent" ON core.consent_records
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- GDPR Data Export (Article 20 - Right to data portability)
CREATE OR REPLACE FUNCTION core.export_user_data(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, finance, health_meta, core
AS $$
DECLARE
  result JSONB;
BEGIN
  -- Only allow users to export their own data
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: can only export own data';
  END IF;

  SELECT jsonb_build_object(
    'exported_at', NOW(),
    'user_id', p_user_id,
    'profile', (SELECT to_jsonb(p) FROM public.profiles p WHERE p.id = p_user_id),
    'preferences', (SELECT to_jsonb(up) FROM public.user_preferences up WHERE up.user_id = p_user_id),
    'goals', (SELECT COALESCE(jsonb_agg(to_jsonb(g)), '[]') FROM public.goals g WHERE g.user_id = p_user_id),
    'habits', (SELECT COALESCE(jsonb_agg(to_jsonb(h)), '[]') FROM public.habits h WHERE h.user_id = p_user_id),
    'career_profile', (SELECT to_jsonb(cp) FROM public.career_profiles cp WHERE cp.user_id = p_user_id),
    'job_applications', (SELECT COALESCE(jsonb_agg(to_jsonb(ja)), '[]') FROM public.job_applications ja WHERE ja.user_id = p_user_id),
    'education_records', (SELECT COALESCE(jsonb_agg(to_jsonb(er)), '[]') FROM public.education_records er WHERE er.user_id = p_user_id),
    'courses', (SELECT COALESCE(jsonb_agg(to_jsonb(c)), '[]') FROM public.courses c WHERE c.user_id = p_user_id),
    'financial_accounts', (SELECT COALESCE(jsonb_agg(to_jsonb(fa) - 'account_number_encrypted' - 'routing_number_encrypted'), '[]') FROM finance.financial_accounts fa WHERE fa.user_id = p_user_id),
    'family_members', (SELECT COALESCE(jsonb_agg(to_jsonb(fm)), '[]') FROM public.family_members fm WHERE fm.user_id = p_user_id),
    'consent_records', (SELECT COALESCE(jsonb_agg(to_jsonb(cr)), '[]') FROM core.consent_records cr WHERE cr.user_id = p_user_id)
  ) INTO result;

  -- Log the export
  INSERT INTO core.security_audit_log (user_id, action, resource_type, metadata)
  VALUES (p_user_id, 'data_export', 'user', jsonb_build_object('requested_at', NOW()));

  RETURN result;
END;
$$;

-- GDPR Data Deletion (Article 17 - Right to erasure)
CREATE OR REPLACE FUNCTION core.delete_user_data(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, finance, health_meta, core
AS $$
BEGIN
  -- Only allow users to delete their own data, or service_role
  IF auth.uid() IS DISTINCT FROM p_user_id AND current_setting('role') != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: can only delete own data';
  END IF;

  -- Log before deletion
  INSERT INTO core.security_audit_log (user_id, action, resource_type, metadata)
  VALUES (p_user_id, 'data_deletion_requested', 'user', jsonb_build_object('requested_at', NOW()));

  -- Delete from all domain tables (CASCADE handles most via FK)
  -- The profile deletion cascades to all child tables
  DELETE FROM public.profiles WHERE id = p_user_id;

  -- Delete auth user (this also triggers cascade)
  -- Note: this must be called from a service_role context
  -- DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION core.export_user_data TO authenticated;
GRANT EXECUTE ON FUNCTION core.delete_user_data TO authenticated;
