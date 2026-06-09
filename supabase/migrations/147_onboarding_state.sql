-- 147_onboarding_state.sql — onboarding state on the platform identity (Elite Sprint 23).
ALTER TABLE platform.user_settings ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE platform.user_settings ADD COLUMN IF NOT EXISTS focus_decision TEXT;
ALTER TABLE platform.user_settings ADD COLUMN IF NOT EXISTS onboarding_step INTEGER NOT NULL DEFAULT 0;
