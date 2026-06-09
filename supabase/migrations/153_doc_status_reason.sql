-- 153 — Sprint 32 P0: explain why a document needs review (scanned vs no-fields), never silent.
ALTER TABLE documents.documents ADD COLUMN IF NOT EXISTS status_reason TEXT;
