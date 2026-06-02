-- ============================================================================
-- 002_storage_buckets.sql — CANONICAL (Sprint N.2 consolidation)
-- ============================================================================
-- Previously this migration shipped in three conflicting variants:
--   002_storage_buckets.sql        — original, idempotent ON CONFLICT DO NOTHING
--   002_storage_buckets_fixed.sql  — deferred policies to dashboard UI
--   002_storage_buckets_robust.sql — production-grade settings, no policies
--
-- The Sprint N.2 platform-hardening sprint consolidates them into a
-- single canonical file with:
--   * Production-grade bucket sizes from the _robust variant
--   * Removal of image/gif from public buckets (security; GIF parsers
--     have a long history of CVEs)
--   * Idempotent ON CONFLICT DO UPDATE so re-running the migration
--     converges on the canonical settings
--   * CREATE POLICY DDL inline (Supabase Dashboard UI is fine for one-off
--     development; for reproducible production this DDL is the source
--     of truth — see DROP POLICY IF EXISTS guards)
--
-- The two superseded variants are preserved under
-- supabase/migrations/_archived/ for historical traceability.
--
-- HIPAA / PCI documents do NOT belong in any of these buckets — they
-- live in the dedicated `ingestion` bucket gated by the malware scan
-- pipeline (see Sprint N.1 / N.2).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- BUCKET: avatars (public)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  TRUE,
  2097152,  -- 2 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- BUCKET: goal-images (private)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'goal-images',
  'goal-images',
  FALSE,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- BUCKET: achievement-badges (public read)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'achievement-badges',
  'achievement-badges',
  TRUE,
  2097152,  -- 2 MB
  ARRAY['image/png', 'image/svg+xml', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- BUCKET: feedback-attachments (private)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feedback-attachments',
  'feedback-attachments',
  FALSE,
  20971520,  -- 20 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- BUCKET: public-assets (public read)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'public-assets',
  'public-assets',
  TRUE,
  52428800,  -- 50 MB
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/svg+xml',
    'video/mp4', 'video/webm',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- BUCKET: ingestion (private — multimodal upload pipeline target)
-- Created here so the canonical migration covers it; the upload
-- pipeline's `SUPABASE_STORAGE_BUCKET` env var should match this id.
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ingestion',
  'ingestion',
  FALSE,
  2147483648,  -- 2 GB (matches video upper-bound cap in validators.ts)
  NULL         -- NULL = accept any MIME; the application classifier gates this
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================================
-- STORAGE OBJECT POLICIES
-- DROP-and-recreate makes the migration idempotent across re-runs.
-- ============================================================================

-- ---- avatars --------------------------------------------------------------
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Avatars are publicly viewable" ON storage.objects;
CREATE POLICY "Avatars are publicly viewable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- ---- goal-images ----------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage own goal images" ON storage.objects;
CREATE POLICY "Users can manage own goal images"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'goal-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ---- achievement-badges ---------------------------------------------------
DROP POLICY IF EXISTS "Achievement badges are publicly viewable" ON storage.objects;
CREATE POLICY "Achievement badges are publicly viewable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'achievement-badges');

-- ---- feedback-attachments -------------------------------------------------
DROP POLICY IF EXISTS "Users can upload feedback attachments" ON storage.objects;
CREATE POLICY "Users can upload feedback attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'feedback-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can view own feedback attachments" ON storage.objects;
CREATE POLICY "Users can view own feedback attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'feedback-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ---- public-assets --------------------------------------------------------
DROP POLICY IF EXISTS "Public assets are viewable by all" ON storage.objects;
CREATE POLICY "Public assets are viewable by all"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'public-assets');

-- ---- ingestion ------------------------------------------------------------
-- Owner read/write only. The service role uses an authenticated session,
-- so the application is responsible for never exposing bytes without
-- an auth check + signed URL TTL (see lib/storage/object-store.ts).
DROP POLICY IF EXISTS "Users can manage own ingestion objects" ON storage.objects;
CREATE POLICY "Users can manage own ingestion objects"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'ingestion'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'ingestion'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================================
COMMENT ON TABLE storage.objects IS
  'Supabase storage. The ingestion bucket carries user-uploaded multimodal '
  'payloads gated by malware scanning (see Sprint N.1 / N.2). HIPAA/PCI '
  'documents that require BAA-bound providers go through tenant model '
  'overrides per the BYOM resolution order.';
