-- 20260617130000 — Pilot Intelligence: extend pilot feedback for the full instrument set.
-- The pilot measurement sprint adds instruments beyond the original thumb/trust/usefulness/nps:
-- narrative accuracy, understanding, personalization, actionability, return intent, insight (yes/no),
-- holy-shit/surprise (yes/no), and executive value (would_pay / recommend_to_clients / solves_problem).
-- Rather than a column per instrument (and to allow 0-10 scales), store named scores in a `metrics` JSONB
-- plus two boolean flags + a `kind`/`context`. Additive + idempotent. GATED: apply after key rotation.
ALTER TABLE analytics.pilot_feedback ADD COLUMN IF NOT EXISTS kind             TEXT;
ALTER TABLE analytics.pilot_feedback ADD COLUMN IF NOT EXISTS metrics          JSONB NOT NULL DEFAULT '{}'::jsonb;  -- {narrative_accuracy:9, trust:8, ...} (0-10)
ALTER TABLE analytics.pilot_feedback ADD COLUMN IF NOT EXISTS context          JSONB NOT NULL DEFAULT '{}'::jsonb;  -- {recommendation_id, narrative_key, cohort, ...}
ALTER TABLE analytics.pilot_feedback ADD COLUMN IF NOT EXISTS insight_detected BOOLEAN;                              -- "identified something you hadn't considered?"
ALTER TABLE analytics.pilot_feedback ADD COLUMN IF NOT EXISTS surprised        BOOLEAN;                              -- "holy-shit" — surprised in a useful way?

CREATE INDEX IF NOT EXISTS pilot_feedback_kind_idx ON analytics.pilot_feedback (kind, created_at DESC);

NOTIFY pgrst, 'reload schema';
