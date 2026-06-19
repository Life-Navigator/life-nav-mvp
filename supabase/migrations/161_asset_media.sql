-- 161_asset_media.sql
-- Asset media: a picture of the asset + attached documents (deeds, titles, statements).
-- Additive + idempotent. finance.assets and finance.asset_loans already exist (031);
-- this adds the image reference column and an asset_documents link table.
--
-- Files live in the existing private `documents` storage bucket (migration 145).
-- We store the storage PATH (not a public URL); the API signs a short-lived URL on read.

-- 1) Picture of the asset (storage path in the private `documents` bucket).
ALTER TABLE finance.assets
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2) Documents attached to an asset.
CREATE TABLE IF NOT EXISTS finance.asset_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES finance.assets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_id UUID,          -- optional link to the Document Intelligence platform
  file_path TEXT,            -- storage path in the `documents` bucket
  file_name TEXT,
  doc_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_documents_asset ON finance.asset_documents(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_documents_user ON finance.asset_documents(user_id);

ALTER TABLE finance.asset_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_asset_documents" ON finance.asset_documents;
CREATE POLICY "users_own_asset_documents" ON finance.asset_documents
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Default privileges (105) only cover objects created by that role, so grant
-- explicitly for this newly-created table.
GRANT SELECT, INSERT, UPDATE, DELETE ON finance.asset_documents TO authenticated;
GRANT ALL ON finance.asset_documents TO service_role;
