-- 166_field_conflicts.sql
--
-- Document Intelligence Trust Sprint — Phase 6 conflict detection.
--
-- When two sources disagree about the same fact (an uploaded document vs the user's profile, or two
-- documents), we stop silently accepting one. We record the conflict, BOTH competing sources, a
-- recommended resolution (by precedence), and a review lifecycle so the user decides. No silent
-- overwrite. Additive + idempotent. 116-RLS (user-owns-rows + service-role), mirroring 143.

CREATE TABLE IF NOT EXISTS documents.field_conflicts (
  id                UUID PRIMARY KEY,
  user_id           UUID NOT NULL,
  tenant_id         UUID NOT NULL,
  domain            TEXT NOT NULL,                       -- career | finance | family | education | health | core
  conflict_type     TEXT NOT NULL,                       -- e.g. current_role_mismatch, insurance_coverage_mismatch
  field_key         TEXT NOT NULL,                       -- canonical concept key (e.g. current_role)
  status            TEXT NOT NULL DEFAULT 'open',
  severity          TEXT NOT NULL DEFAULT 'medium',
  winning_value     TEXT,                                -- set on resolution (never auto-applied)
  winning_source_id UUID,                                -- the field_conflict_items row that won
  notes             TEXT,                                -- recommended resolution path / 'potential' qualifier
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at       TIMESTAMPTZ,
  resolved_by       UUID,
  resolution_method TEXT,
  CONSTRAINT field_conflicts_status_chk
    CHECK (status IN ('open','user_resolved','system_resolved','ignored')),
  CONSTRAINT field_conflicts_severity_chk
    CHECK (severity IN ('low','medium','high','critical'))
);

CREATE TABLE IF NOT EXISTS documents.field_conflict_items (
  id                 UUID PRIMARY KEY,
  conflict_id        UUID NOT NULL REFERENCES documents.field_conflicts(id) ON DELETE CASCADE,
  user_id            UUID NOT NULL,
  tenant_id          UUID NOT NULL,
  source_type        TEXT NOT NULL,                      -- document | domain
  source_table       TEXT NOT NULL,                      -- e.g. documents.document_fields, career.experience_records
  source_record_id   UUID,
  source_document_id UUID,
  document_field_id  UUID,
  value              TEXT NOT NULL,                      -- the raw value as found
  normalized_value   TEXT,                               -- deterministic normalization used for comparison
  confidence         NUMERIC,
  review_status      TEXT,                               -- user_entered | user_confirmed | extracted | inferred | needs_review
  page_number        INT,
  section            TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_field_conflicts_user ON documents.field_conflicts (user_id, status);
CREATE INDEX IF NOT EXISTS idx_field_conflict_items_conflict ON documents.field_conflict_items (conflict_id);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['field_conflicts','field_conflict_items'] LOOP
    EXECUTE format('ALTER TABLE documents.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE documents.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$DROP POLICY IF EXISTS users_own_%1$s ON documents.%1$I$p$, t);
    EXECUTE format('CREATE POLICY users_own_%1$s ON documents.%1$I FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())', t);
    EXECUTE format($p$DROP POLICY IF EXISTS service_%1$s ON documents.%1$I$p$, t);
    EXECUTE format('CREATE POLICY service_%1$s ON documents.%1$I FOR ALL TO service_role USING (true) WITH CHECK (true)', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON documents.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON documents.%I TO service_role', t);
  END LOOP;
END $$;
