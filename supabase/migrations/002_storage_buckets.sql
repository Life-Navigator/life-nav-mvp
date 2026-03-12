-- ============================================================================
-- Life Navigator - Supabase Storage Buckets
-- ============================================================================
-- Storage configuration for non-sensitive blob data
-- HIPAA/PCI documents MUST be stored in DGX secure storage
-- ============================================================================

-- ============================================================================
-- BUCKET: avatars
-- Purpose: User profile pictures
-- Access: Public read, authenticated write (own avatar only)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,  -- Public bucket
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- BUCKET: goal-images
-- Purpose: Images associated with goals (vision board, progress photos)
-- Access: Private - user can only access their own
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'goal-images',
  'goal-images',
  false,  -- Private bucket
  10485760,  -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- BUCKET: achievement-badges
-- Purpose: Custom achievement badge images
-- Access: Public read (everyone can see badges)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'achievement-badges',
  'achievement-badges',
  true,  -- Public bucket
  2097152,  -- 2MB limit
  ARRAY['image/png', 'image/svg+xml', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- BUCKET: feedback-attachments
-- Purpose: Screenshots/images attached to feedback reports
-- Access: Private - only submitter and admins
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feedback-attachments',
  'feedback-attachments',
  false,  -- Private bucket
  20971520,  -- 20MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- BUCKET: public-assets
-- Purpose: Public marketing/educational content
-- Access: Public read
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'public-assets',
  'public-assets',
  true,  -- Public bucket
  52428800,  -- 50MB limit
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'video/mp4', 'video/webm',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STORAGE POLICIES
-- ============================================================================

-- Avatars: Users can upload/update their own avatar
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Avatars are publicly viewable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Goal Images: Users can only access their own goal images
CREATE POLICY "Users can manage own goal images"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'goal-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Achievement Badges: Public read
CREATE POLICY "Achievement badges are publicly viewable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'achievement-badges');

-- Feedback Attachments: Users can upload and view their own
CREATE POLICY "Users can upload feedback attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'feedback-attachments' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own feedback attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'feedback-attachments' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Public Assets: Anyone can read
CREATE POLICY "Public assets are viewable by all"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'public-assets');

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE storage.objects IS 'Supabase storage - NON-SENSITIVE files only. HIPAA/PCI documents go to DGX.';
