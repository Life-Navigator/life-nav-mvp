-- 075_compliance_knowledge.sql
-- Centralized compliance knowledge base for regulatory document storage,
-- chunking, and vector search via Qdrant compliance_knowledge collection.

-- Schema
CREATE SCHEMA IF NOT EXISTS compliance;

-- Regulatory document metadata
CREATE TABLE compliance.regulatory_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  document_type TEXT NOT NULL,          -- 'regulation', 'ruling', 'guidance', 'statute'
  domain TEXT NOT NULL,                  -- 'finance', 'health', 'legal', 'tax', 'insurance'
  jurisdiction TEXT DEFAULT 'US',
  regulation_code TEXT,                  -- e.g. '15 USC § 80b-2'
  source_url TEXT,
  effective_date DATE,
  storage_path TEXT NOT NULL,
  storage_bucket TEXT DEFAULT 'regulatory-documents',
  status TEXT DEFAULT 'pending',         -- pending, processing, completed, failed
  chunk_count INTEGER DEFAULT 0,
  total_pages INTEGER,
  error_message TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Individual chunks with embedding status
CREATE TABLE compliance.document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES compliance.regulatory_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  section_title TEXT,
  text TEXT NOT NULL,
  token_count INTEGER,
  embedding_status TEXT DEFAULT 'pending',  -- pending, embedded, failed
  qdrant_point_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chunks_document ON compliance.document_chunks(document_id);
CREATE INDEX idx_chunks_status ON compliance.document_chunks(embedding_status);
CREATE INDEX idx_docs_domain ON compliance.regulatory_documents(domain);
CREATE INDEX idx_docs_status ON compliance.regulatory_documents(status);

-- RLS: service_role writes, authenticated users read
ALTER TABLE compliance.regulatory_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance.document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on docs" ON compliance.regulatory_documents
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read docs" ON compliance.regulatory_documents
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role full access on chunks" ON compliance.document_chunks
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read chunks" ON compliance.document_chunks
  FOR SELECT TO authenticated USING (true);

-- Storage bucket (private, service-role upload, 50MB max)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'regulatory-documents', 'regulatory-documents', false, 52428800,
  ARRAY['application/pdf', 'text/plain', 'text/html', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
) ON CONFLICT (id) DO NOTHING;
