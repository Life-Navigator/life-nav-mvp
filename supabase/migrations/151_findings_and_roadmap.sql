-- 151 — Sprint 28: Finding registry + prioritization formula inputs on recommendations.
-- A FINDING is the underlying problem (one canonical key); many module recs collapse to it. The
-- formula inputs (impact/confidence/urgency/evidence/effort) are stored visibly, not hidden.
ALTER TABLE recommendations.recommendations ADD COLUMN IF NOT EXISTS finding_key TEXT;
ALTER TABLE recommendations.recommendations ADD COLUMN IF NOT EXISTS finding_label TEXT;
ALTER TABLE recommendations.recommendations ADD COLUMN IF NOT EXISTS formula JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_recos_finding ON recommendations.recommendations(user_id, finding_key);
