-- ==========================================================================
-- 032: Career Domain
-- Career profiles, job applications, connections, resumes
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.career_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_title TEXT,
  current_company TEXT,
  industry TEXT,
  years_of_experience INT,
  desired_title TEXT,
  desired_salary_min NUMERIC,
  desired_salary_max NUMERIC,
  skills TEXT[] DEFAULT '{}',
  certifications TEXT[] DEFAULT '{}',
  linkedin_url TEXT,
  github_url TEXT,
  portfolio_url TEXT,
  summary TEXT,
  work_arrangement TEXT, -- remote, hybrid, onsite
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.career_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_career" ON public.career_profiles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  position TEXT NOT NULL,
  location TEXT,
  salary_min NUMERIC,
  salary_max NUMERIC,
  status TEXT NOT NULL DEFAULT 'saved', -- saved, applied, phone_screen, interview, offer, rejected, accepted, withdrawn
  applied_date DATE,
  source TEXT, -- linkedin, indeed, referral, company_site, other
  job_url TEXT,
  contact_name TEXT,
  contact_email TEXT,
  notes TEXT,
  next_step TEXT,
  next_step_date DATE,
  interview_dates JSONB DEFAULT '[]',
  offer_details JSONB,
  match_score INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_applications_user ON public.job_applications(user_id, status);
CREATE INDEX idx_applications_date ON public.job_applications(user_id, applied_date DESC);

ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_apps" ON public.job_applications
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.career_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  company TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  relationship_type TEXT, -- colleague, mentor, recruiter, friend, other
  strength TEXT DEFAULT 'acquaintance', -- close, professional, acquaintance
  notes TEXT,
  last_contacted_at TIMESTAMPTZ,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_connections_user ON public.career_connections(user_id);

ALTER TABLE public.career_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_connections" ON public.career_connections
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My Resume',
  version INT NOT NULL DEFAULT 1,
  content JSONB, -- structured resume content
  storage_path TEXT, -- path in Supabase storage
  format TEXT DEFAULT 'pdf', -- pdf, docx
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  ats_score INT,
  ai_suggestions JSONB,
  target_role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_resumes_user ON public.resumes(user_id);

ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_resumes" ON public.resumes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Updated_at triggers
CREATE TRIGGER set_career_profiles_updated_at BEFORE UPDATE ON public.career_profiles
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER set_applications_updated_at BEFORE UPDATE ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER set_connections_updated_at BEFORE UPDATE ON public.career_connections
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER set_resumes_updated_at BEFORE UPDATE ON public.resumes
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
