-- ==========================================================================
-- 037: Documents & Feature Management
-- User documents, feature votes, feature waitlist
-- ==========================================================================

-- User documents (resumes, certificates, etc.)
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document_type TEXT NOT NULL, -- resume, certificate, transcript, id, tax_form, contract, other
  storage_path TEXT NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'documents',
  file_size_bytes BIGINT,
  mime_type TEXT,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_user ON public.documents(user_id, document_type);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_docs" ON public.documents
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Feature votes
CREATE TABLE IF NOT EXISTS public.feature_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  vote INT NOT NULL DEFAULT 1, -- 1 = upvote
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, feature_key)
);

ALTER TABLE public.feature_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_votes" ON public.feature_votes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Feature waitlist
CREATE TABLE IF NOT EXISTS public.feature_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  priority INT NOT NULL DEFAULT 0,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, feature_key)
);

ALTER TABLE public.feature_waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_waitlist" ON public.feature_waitlist
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Triggers
CREATE TRIGGER set_documents_updated_at BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
