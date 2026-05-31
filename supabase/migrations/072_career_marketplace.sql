-- ==========================================================================
-- 072: Career Marketplace
--   Employers post jobs, the matching engine surfaces candidates, the
--   user controls visibility, and candidate identity is not exposed to
--   the employer without explicit consent.
-- ==========================================================================

-- -------------------------------------------------------------------------
-- 1. employer_profiles
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name TEXT NOT NULL,
  display_name TEXT,
  industry TEXT,
  size_band TEXT CHECK (size_band IS NULL OR size_band IN
    ('1-10','11-50','51-200','201-500','501-1000','1001-5000','5000+')),
  website TEXT,
  hq_city TEXT,
  hq_country TEXT,
  description TEXT,
  veteran_friendly BOOLEAN NOT NULL DEFAULT FALSE,
  -- Subscription / billing posture
  subscription_tier TEXT NOT NULL DEFAULT 'free'
    CHECK (subscription_tier IN ('free','starter','pro','enterprise')),
  status TEXT NOT NULL DEFAULT 'pending_verification'
    CHECK (status IN ('pending_verification','verified','suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_employer_status ON public.employer_profiles(status);
ALTER TABLE public.employer_profiles ENABLE ROW LEVEL SECURITY;
-- Verified employer profiles are publicly readable so users see who posted.
CREATE POLICY "employer_profile_public_read" ON public.employer_profiles
  FOR SELECT USING (status = 'verified');
CREATE POLICY "employer_profile_service_role" ON public.employer_profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_employer_profiles_updated_at
  BEFORE UPDATE ON public.employer_profiles
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

-- -------------------------------------------------------------------------
-- 2. employer_users — links a Supabase auth user to an employer profile
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employer_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id UUID NOT NULL REFERENCES public.employer_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner','admin','recruiter','member')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employer_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_employer_users_user ON public.employer_users(user_id);
ALTER TABLE public.employer_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employer_users_self_select" ON public.employer_users
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "employer_users_service_role" ON public.employer_users
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_employer_users_updated_at
  BEFORE UPDATE ON public.employer_users
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

-- Helper: is the calling user a member of <employer_id>?
CREATE OR REPLACE FUNCTION public.is_employer_member(p_employer_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employer_users
     WHERE employer_id = p_employer_id
       AND user_id = auth.uid()
       AND is_active = TRUE
  );
$$;
REVOKE ALL ON FUNCTION public.is_employer_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_employer_member(UUID) TO authenticated, service_role;

-- -------------------------------------------------------------------------
-- 3. employer_job_posts (+ requirements, benefits, locations, pricing)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employer_job_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id UUID NOT NULL REFERENCES public.employer_profiles(id) ON DELETE CASCADE,
  posted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  industry TEXT,
  employment_type TEXT
    CHECK (employment_type IS NULL OR employment_type IN
      ('full_time','part_time','contract','internship','apprenticeship','temporary')),
  remote_mode TEXT
    CHECK (remote_mode IS NULL OR remote_mode IN ('remote','hybrid','on_site')),
  experience_level TEXT
    CHECK (experience_level IS NULL OR experience_level IN
      ('intern','entry','mid','senior','lead','principal','executive')),
  salary_min NUMERIC,
  salary_max NUMERIC,
  salary_currency TEXT DEFAULT 'USD',
  clearance_required TEXT,
  travel_pct NUMERIC,
  apply_instructions TEXT,
  apply_url TEXT,
  veteran_friendly BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','published','paused','expired','archived')),
  expires_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'employer',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_jobs_status_published
  ON public.employer_job_posts(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_employer
  ON public.employer_job_posts(employer_id, status);
ALTER TABLE public.employer_job_posts ENABLE ROW LEVEL SECURITY;
-- Published posts are publicly readable.
CREATE POLICY "jobs_public_read" ON public.employer_job_posts
  FOR SELECT USING (status = 'published');
-- Employer members can see their own posts in any status + update them.
CREATE POLICY "jobs_employer_member_all" ON public.employer_job_posts
  FOR ALL USING (public.is_employer_member(employer_id))
  WITH CHECK (public.is_employer_member(employer_id));
CREATE POLICY "jobs_service_role" ON public.employer_job_posts
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_employer_job_posts_updated_at
  BEFORE UPDATE ON public.employer_job_posts
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

CREATE TABLE IF NOT EXISTS public.employer_job_post_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_post_id UUID NOT NULL REFERENCES public.employer_job_posts(id) ON DELETE CASCADE,
  requirement_kind TEXT NOT NULL
    CHECK (requirement_kind IN ('skill_required','skill_preferred','certification','education','experience_years')),
  value TEXT NOT NULL,                                -- e.g. 'python', 'bachelor', 'aws_solutions_architect'
  weight NUMERIC NOT NULL DEFAULT 1.0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_job_reqs_post
  ON public.employer_job_post_requirements(job_post_id);
ALTER TABLE public.employer_job_post_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_reqs_public_read" ON public.employer_job_post_requirements
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.employer_job_posts p
             WHERE p.id = job_post_id AND p.status = 'published')
  );
CREATE POLICY "job_reqs_employer_member" ON public.employer_job_post_requirements
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.employer_job_posts p
             WHERE p.id = job_post_id AND public.is_employer_member(p.employer_id))
  );
CREATE POLICY "job_reqs_service_role" ON public.employer_job_post_requirements
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.employer_job_post_benefits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_post_id UUID NOT NULL REFERENCES public.employer_job_posts(id) ON DELETE CASCADE,
  benefit_key TEXT NOT NULL,                          -- 'health_insurance','401k_match','tuition_reimbursement',...
  details TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.employer_job_post_benefits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_benefits_public_read" ON public.employer_job_post_benefits
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.employer_job_posts p
             WHERE p.id = job_post_id AND p.status = 'published')
  );
CREATE POLICY "job_benefits_employer_member" ON public.employer_job_post_benefits
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.employer_job_posts p
             WHERE p.id = job_post_id AND public.is_employer_member(p.employer_id))
  );
CREATE POLICY "job_benefits_service_role" ON public.employer_job_post_benefits
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.employer_job_post_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_post_id UUID NOT NULL REFERENCES public.employer_job_posts(id) ON DELETE CASCADE,
  city TEXT,
  state TEXT,
  country TEXT,
  postal_code TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.employer_job_post_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_locations_public_read" ON public.employer_job_post_locations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.employer_job_posts p
             WHERE p.id = job_post_id AND p.status = 'published')
  );
CREATE POLICY "job_locations_employer_member" ON public.employer_job_post_locations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.employer_job_posts p
             WHERE p.id = job_post_id AND public.is_employer_member(p.employer_id))
  );

CREATE TABLE IF NOT EXISTS public.employer_job_post_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_post_id UUID NOT NULL UNIQUE REFERENCES public.employer_job_posts(id) ON DELETE CASCADE,
  posting_fee_usd NUMERIC NOT NULL DEFAULT 0,
  featured_placement BOOLEAN NOT NULL DEFAULT FALSE,
  featured_fee_usd NUMERIC NOT NULL DEFAULT 0,
  paid BOOLEAN NOT NULL DEFAULT FALSE,
  paid_at TIMESTAMPTZ,
  stripe_payment_intent_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.employer_job_post_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_pricing_employer_member" ON public.employer_job_post_pricing
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.employer_job_posts p
             WHERE p.id = job_post_id AND public.is_employer_member(p.employer_id))
  );
CREATE POLICY "job_pricing_service_role" ON public.employer_job_post_pricing
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_job_pricing_updated_at
  BEFORE UPDATE ON public.employer_job_post_pricing
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

-- -------------------------------------------------------------------------
-- 4. candidate_career_profiles — visibility + privacy settings
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.candidate_career_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  visibility TEXT NOT NULL DEFAULT 'hidden'
    CHECK (visibility IN ('hidden','anonymous','selected_employers','open')),
  open_to_introductions BOOLEAN NOT NULL DEFAULT FALSE,
  veteran_status_voluntary BOOLEAN,                  -- user-supplied + opt-in only
  open_to_clearance_required BOOLEAN,
  desired_commute_minutes INT,
  desired_industries TEXT[] DEFAULT '{}',
  desired_locations TEXT[] DEFAULT '{}',
  availability_timeline TEXT,                        -- 'immediate' | '30_days' | '60_days' | '90_days' | 'passive'
  source TEXT NOT NULL DEFAULT 'onboarding',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.candidate_career_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "candidate_owner_all" ON public.candidate_career_profiles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "candidate_service_role" ON public.candidate_career_profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_candidate_profile_updated_at
  BEFORE UPDATE ON public.candidate_career_profiles
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

-- -------------------------------------------------------------------------
-- 5. job_candidate_matches — produced by the matching engine
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_candidate_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_post_id UUID NOT NULL REFERENCES public.employer_job_posts(id) ON DELETE CASCADE,
  employer_id UUID NOT NULL REFERENCES public.employer_profiles(id) ON DELETE CASCADE,
  match_score NUMERIC(5,2) NOT NULL,                 -- 0..100
  skills_score NUMERIC(5,2),
  certifications_score NUMERIC(5,2),
  education_score NUMERIC(5,2),
  salary_fit_score NUMERIC(5,2),
  location_fit_score NUMERIC(5,2),
  growth_alignment_score NUMERIC(5,2),
  candidate_visibility_at_match TEXT,                -- snapshot of candidate.visibility at the time
  employer_facing_summary TEXT,                      -- anonymized summary the employer can see
  missing_requirements JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'surfaced'
    CHECK (status IN ('surfaced','saved','dismissed','applied','intro_requested','intro_consented','intro_declined','expired')),
  source TEXT NOT NULL DEFAULT 'engine',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, job_post_id)
);
CREATE INDEX IF NOT EXISTS idx_jcm_user_status
  ON public.job_candidate_matches(user_id, status);
CREATE INDEX IF NOT EXISTS idx_jcm_employer_status
  ON public.job_candidate_matches(employer_id, status);
ALTER TABLE public.job_candidate_matches ENABLE ROW LEVEL SECURITY;
-- The candidate (user) always sees their own matches.
CREATE POLICY "jcm_user_select" ON public.job_candidate_matches
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "jcm_user_update" ON public.job_candidate_matches
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- Employers see ONLY the match score + employer_facing_summary fields via a view (defined below).
-- Direct table access for employers is blocked except for status updates after intro consent.
CREATE POLICY "jcm_employer_post_consent" ON public.job_candidate_matches
  FOR SELECT USING (
    public.is_employer_member(employer_id)
    AND status IN ('intro_consented','applied')
  );
CREATE POLICY "jcm_service_role" ON public.job_candidate_matches
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_jcm_updated_at
  BEFORE UPDATE ON public.job_candidate_matches
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

-- Employer-facing anonymized view (no user_id exposed).
CREATE OR REPLACE VIEW public.employer_match_anonymized AS
SELECT
  m.id,
  m.job_post_id,
  m.employer_id,
  m.match_score,
  m.skills_score,
  m.certifications_score,
  m.education_score,
  m.salary_fit_score,
  m.location_fit_score,
  m.growth_alignment_score,
  m.employer_facing_summary,
  m.missing_requirements,
  m.status,
  m.created_at
FROM public.job_candidate_matches m
WHERE m.status IN ('surfaced','saved','intro_requested','intro_consented','applied');
GRANT SELECT ON public.employer_match_anonymized TO authenticated;

-- -------------------------------------------------------------------------
-- 6. job_match_feedback, employer_candidate_messages, employer_billing_events,
--    job_post_analytics
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_match_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES public.job_candidate_matches(id) ON DELETE CASCADE,
  feedback TEXT,                                      -- 'relevant','irrelevant','salary_off','location_off','skill_mismatch',...
  comment TEXT,
  source TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.job_match_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jmf_owner_all" ON public.job_match_feedback
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "jmf_service_role" ON public.job_match_feedback
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.employer_candidate_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.job_candidate_matches(id) ON DELETE CASCADE,
  employer_id UUID NOT NULL REFERENCES public.employer_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  from_party TEXT NOT NULL CHECK (from_party IN ('employer','candidate')),
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ecm_match ON public.employer_candidate_messages(match_id);
ALTER TABLE public.employer_candidate_messages ENABLE ROW LEVEL SECURITY;
-- The candidate and the employer team can both read.
CREATE POLICY "ecm_candidate_access" ON public.employer_candidate_messages
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ecm_employer_access" ON public.employer_candidate_messages
  FOR ALL USING (public.is_employer_member(employer_id))
  WITH CHECK (public.is_employer_member(employer_id));
CREATE POLICY "ecm_service_role" ON public.employer_candidate_messages
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.employer_billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id UUID NOT NULL REFERENCES public.employer_profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,                          -- 'job_post_fee','featured_fee','subscription','candidate_intro_fee'
  amount_cents INT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  stripe_payment_intent_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.employer_billing_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ebe_employer_member" ON public.employer_billing_events
  FOR SELECT USING (public.is_employer_member(employer_id));
CREATE POLICY "ebe_service_role" ON public.employer_billing_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.job_post_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_post_id UUID NOT NULL REFERENCES public.employer_job_posts(id) ON DELETE CASCADE,
  metric_key TEXT NOT NULL,                          -- 'views','matches','intros_requested','applications','hires'
  metric_value NUMERIC NOT NULL DEFAULT 0,
  observed_on DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_post_id, metric_key, observed_on)
);
ALTER TABLE public.job_post_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jpa_employer_member" ON public.job_post_analytics
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.employer_job_posts p
             WHERE p.id = job_post_id AND public.is_employer_member(p.employer_id))
  );
CREATE POLICY "jpa_service_role" ON public.job_post_analytics
  FOR ALL TO service_role USING (true) WITH CHECK (true);
