-- ============================================================================
-- Life Navigator - Supabase Storage Buckets (Fixed for SQL Editor)
-- ============================================================================
-- NOTE: Storage POLICIES must be created via Supabase Dashboard UI
-- This file only creates the buckets themselves
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
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

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
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

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
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

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
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

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
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run this to verify buckets were created:
-- SELECT id, name, public, file_size_limit FROM storage.buckets;
