-- ============================================================================
-- Life Navigator - Robust Storage Configuration
-- ============================================================================
-- Run in Supabase SQL Editor
-- Policies must still be added via Dashboard (see instructions below)
-- ============================================================================

-- ============================================================================
-- BUCKETS WITH PRODUCTION SETTINGS
-- ============================================================================

-- AVATARS: User profile pictures (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152,  -- 2MB (reduced - avatars don't need to be huge)
  ARRAY['image/jpeg', 'image/png', 'image/webp']  -- No GIF (security risk)
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- GOAL-IMAGES: Vision board, progress photos (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'goal-images',
  'goal-images',
  false,
  5242880,  -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ACHIEVEMENT-BADGES: System badges (public, admin-only upload)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'achievement-badges',
  'achievement-badges',
  true,
  524288,  -- 512KB (badges should be small)
  ARRAY['image/png', 'image/svg+xml', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- FEEDBACK-ATTACHMENTS: Bug reports, screenshots (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feedback-attachments',
  'feedback-attachments',
  false,
  10485760,  -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- PUBLIC-ASSETS: Marketing content (public, admin-only upload)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'public-assets',
  'public-assets',
  true,
  52428800,  -- 50MB
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/svg+xml',
    'video/mp4', 'video/webm',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- DOCUMENTS: User documents like resumes, certificates (private, encrypted reference)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  20971520,  -- 20MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================================
-- STORAGE QUOTA TRACKING TABLE
-- ============================================================================
-- Track per-user storage usage to enforce quotas

CREATE TABLE IF NOT EXISTS public.user_storage_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Usage by bucket (bytes)
  avatars_bytes BIGINT DEFAULT 0,
  goal_images_bytes BIGINT DEFAULT 0,
  feedback_bytes BIGINT DEFAULT 0,
  documents_bytes BIGINT DEFAULT 0,

  -- Totals
  total_bytes BIGINT DEFAULT 0,
  file_count INT DEFAULT 0,

  -- Quotas (can be customized per user/tier)
  quota_bytes BIGINT DEFAULT 104857600,  -- 100MB default

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

CREATE INDEX idx_storage_usage_user ON public.user_storage_usage(user_id);

ALTER TABLE public.user_storage_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own storage usage" ON public.user_storage_usage
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================================
-- FILE METADATA TABLE
-- ============================================================================
-- Track uploaded files for audit, cleanup, and management

CREATE TABLE IF NOT EXISTS public.file_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- File info
  bucket_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,

  -- Security
  checksum_sha256 TEXT,  -- For integrity verification
  is_scanned BOOLEAN DEFAULT FALSE,  -- Virus scan status
  scan_result TEXT,  -- 'clean', 'infected', 'error'
  scanned_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Lifecycle
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,  -- For temporary files

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(bucket_id, file_path)
);

CREATE INDEX idx_file_uploads_user ON public.file_uploads(user_id);
CREATE INDEX idx_file_uploads_bucket ON public.file_uploads(bucket_id);
CREATE INDEX idx_file_uploads_created ON public.file_uploads(created_at DESC);
CREATE INDEX idx_file_uploads_expires ON public.file_uploads(expires_at) WHERE expires_at IS NOT NULL;

ALTER TABLE public.file_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own uploads" ON public.file_uploads
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own uploads" ON public.file_uploads
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- STORAGE TRIGGERS
-- ============================================================================

-- Initialize storage usage for new users
CREATE OR REPLACE FUNCTION public.init_user_storage()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_storage_usage (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created_init_storage ON public.profiles;
CREATE TRIGGER on_profile_created_init_storage
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.init_user_storage();

-- ============================================================================
-- STORAGE HELPER FUNCTIONS
-- ============================================================================

-- Check if user has quota remaining
CREATE OR REPLACE FUNCTION public.check_storage_quota(
  p_user_id UUID,
  p_file_size BIGINT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_usage BIGINT;
  v_quota BIGINT;
BEGIN
  SELECT total_bytes, quota_bytes INTO v_current_usage, v_quota
  FROM public.user_storage_usage
  WHERE user_id = p_user_id;

  IF v_current_usage IS NULL THEN
    -- New user, initialize
    INSERT INTO public.user_storage_usage (user_id) VALUES (p_user_id);
    v_current_usage := 0;
    v_quota := 104857600;  -- 100MB default
  END IF;

  RETURN (v_current_usage + p_file_size) <= v_quota;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update storage usage after upload
CREATE OR REPLACE FUNCTION public.update_storage_usage(
  p_user_id UUID,
  p_bucket_id TEXT,
  p_bytes_delta BIGINT
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.user_storage_usage (user_id, total_bytes, file_count)
  VALUES (p_user_id, GREATEST(0, p_bytes_delta), CASE WHEN p_bytes_delta > 0 THEN 1 ELSE 0 END)
  ON CONFLICT (user_id) DO UPDATE SET
    total_bytes = GREATEST(0, user_storage_usage.total_bytes + p_bytes_delta),
    file_count = GREATEST(0, user_storage_usage.file_count + CASE WHEN p_bytes_delta > 0 THEN 1 ELSE -1 END),
    avatars_bytes = CASE WHEN p_bucket_id = 'avatars'
      THEN GREATEST(0, user_storage_usage.avatars_bytes + p_bytes_delta)
      ELSE user_storage_usage.avatars_bytes END,
    goal_images_bytes = CASE WHEN p_bucket_id = 'goal-images'
      THEN GREATEST(0, user_storage_usage.goal_images_bytes + p_bytes_delta)
      ELSE user_storage_usage.goal_images_bytes END,
    feedback_bytes = CASE WHEN p_bucket_id = 'feedback-attachments'
      THEN GREATEST(0, user_storage_usage.feedback_bytes + p_bytes_delta)
      ELSE user_storage_usage.feedback_bytes END,
    documents_bytes = CASE WHEN p_bucket_id = 'documents'
      THEN GREATEST(0, user_storage_usage.documents_bytes + p_bytes_delta)
      ELSE user_storage_usage.documents_bytes END,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Generate secure file path (prevents path traversal)
CREATE OR REPLACE FUNCTION public.generate_secure_file_path(
  p_user_id UUID,
  p_bucket_id TEXT,
  p_original_filename TEXT
)
RETURNS TEXT AS $$
DECLARE
  v_safe_filename TEXT;
  v_extension TEXT;
  v_uuid TEXT;
BEGIN
  -- Extract extension (lowercase)
  v_extension := LOWER(COALESCE(
    NULLIF(regexp_replace(p_original_filename, '^.*\.', ''), p_original_filename),
    ''
  ));

  -- Only allow safe extensions
  IF v_extension NOT IN ('jpg', 'jpeg', 'png', 'webp', 'pdf', 'svg', 'mp4', 'webm') THEN
    v_extension := 'bin';
  END IF;

  -- Generate UUID for filename
  v_uuid := gen_random_uuid()::TEXT;

  -- Build path: user_id/uuid.extension
  RETURN p_user_id::TEXT || '/' || v_uuid || '.' || v_extension;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CLEANUP FUNCTION (Run periodically via cron)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_files()
RETURNS TABLE(deleted_count INT, freed_bytes BIGINT) AS $$
DECLARE
  v_deleted_count INT := 0;
  v_freed_bytes BIGINT := 0;
  v_record RECORD;
BEGIN
  -- Find expired files
  FOR v_record IN
    SELECT id, user_id, bucket_id, file_path, file_size
    FROM public.file_uploads
    WHERE expires_at IS NOT NULL
      AND expires_at < NOW()
      AND is_deleted = FALSE
  LOOP
    -- Mark as deleted (actual storage deletion happens via Edge Function)
    UPDATE public.file_uploads
    SET is_deleted = TRUE, deleted_at = NOW()
    WHERE id = v_record.id;

    -- Update storage usage
    PERFORM public.update_storage_usage(
      v_record.user_id,
      v_record.bucket_id,
      -v_record.file_size
    );

    v_deleted_count := v_deleted_count + 1;
    v_freed_bytes := v_freed_bytes + v_record.file_size;
  END LOOP;

  deleted_count := v_deleted_count;
  freed_bytes := v_freed_bytes;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.user_storage_usage IS 'Per-user storage quota tracking';
COMMENT ON TABLE public.file_uploads IS 'File upload metadata and audit trail';
COMMENT ON FUNCTION public.check_storage_quota IS 'Check if user has remaining storage quota';
COMMENT ON FUNCTION public.update_storage_usage IS 'Update user storage usage after upload/delete';
COMMENT ON FUNCTION public.generate_secure_file_path IS 'Generate safe file path preventing traversal attacks';
COMMENT ON FUNCTION public.cleanup_expired_files IS 'Clean up expired temporary files (run via cron)';
