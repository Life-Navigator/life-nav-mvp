-- ==========================================================================
-- 067: Onboarding Section Status
--
--   Lets users skip a section and return to it later, and gives the
--   onboarding hub UI a single source of truth for "what's complete".
--
--   One row per (user_id, section). Sections are an enumerated list that
--   mirrors the hub UI. Status: not_started | in_progress | skipped |
--   completed. Completed sections include a fields_captured snapshot in
--   metadata for fast hub rendering without re-querying every domain table.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.user_onboarding_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  section TEXT NOT NULL
    CHECK (section IN (
      'core_life_vision',
      'financial',
      'career',
      'education',
      'health_wellness',
      'insurance_benefits',
      'family_lifestyle',
      'risk_decision_preferences',
      'commitment_capacity',
      'final_review'
    )),
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'skipped', 'completed')),
  completed_at TIMESTAMPTZ,
  fields_captured JSONB NOT NULL DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'onboarding',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, section)
);

CREATE INDEX IF NOT EXISTS idx_user_onboarding_sections_user
  ON public.user_onboarding_sections(user_id);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_sections_user_status
  ON public.user_onboarding_sections(user_id, status);

ALTER TABLE public.user_onboarding_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_onb_sections_owner_all" ON public.user_onboarding_sections
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_onb_sections_service_role" ON public.user_onboarding_sections
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER set_user_onb_sections_updated_at
  BEFORE UPDATE ON public.user_onboarding_sections
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
