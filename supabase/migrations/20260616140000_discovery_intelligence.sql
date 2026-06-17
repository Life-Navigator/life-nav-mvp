-- Discovery Intelligence: candidate-goal protection + user-priority capture.
--
-- Persona/bridge-seeded objectives must remain CANDIDATE (unconfirmed) until the user actually states or
-- confirms them, so they can never auto-become the PRIMARY objective (the "Reach financial independence"
-- bug). User-stated goals are confirmed. `origin` records where an objective came from.
--
-- Additive + idempotent. Existing rows default confirmed=true (pre-existing objectives were user-driven in
-- practice); the bridge writes confirmed=false / origin='persona_bridge' for seeded goals going forward.
ALTER TABLE life.life_objectives ADD COLUMN IF NOT EXISTS confirmed BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE life.life_objectives ADD COLUMN IF NOT EXISTS origin TEXT;  -- 'user' | 'persona_bridge'
