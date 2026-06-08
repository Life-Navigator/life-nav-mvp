-- 145_documents_storage_bucket.sql — private Storage bucket for uploaded source documents
-- (Sprint 11). Binary files live here (not in the documents table); the Core API uploads via
-- service-role and serves owner-scoped signed URLs. 25MB limit; pdf/text/image only.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documents', 'documents', false, 26214400, ARRAY['application/pdf','text/plain','image/png','image/jpeg'])
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
