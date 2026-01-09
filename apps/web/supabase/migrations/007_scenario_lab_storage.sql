-- ============================================================================
-- Scenario Lab - Storage Buckets and Policies
-- ============================================================================
-- This migration creates storage buckets for Scenario Lab
-- Run AFTER 006_scenario_lab_rls.sql
-- ============================================================================

-- ============================================================================
-- BUCKET: scenario-docs (Uploaded Documents)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'scenario-docs',
  'scenario-docs',
  FALSE,  -- Private bucket
  10485760,  -- 10MB limit
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for scenario-docs
-- Path structure: {user_id}/{scenario_id}/{filename}

CREATE POLICY "Users can upload own documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'scenario-docs' AND
    auth.uid()::text = (storage.foldername(name))[1]  -- First folder = user_id
  );

CREATE POLICY "Users can view own documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'scenario-docs' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update own documents"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'scenario-docs' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'scenario-docs' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================================
-- BUCKET: scenario-reports (Generated PDF Reports)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'scenario-reports',
  'scenario-reports',
  FALSE,  -- Private bucket
  52428800,  -- 50MB limit
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for scenario-reports
-- Path structure: {user_id}/{scenario_id}/{report_id}.pdf

CREATE POLICY "Users can upload own reports"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'scenario-reports' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own reports"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'scenario-reports' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own reports"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'scenario-reports' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
