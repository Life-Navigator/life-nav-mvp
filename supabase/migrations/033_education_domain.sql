-- ==========================================================================
-- 033: Education Domain
-- Education records, courses, study logs, degree analysis
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.education_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  institution_name TEXT NOT NULL,
  degree_type TEXT, -- high_school, associate, bachelor, master, doctorate, certificate, bootcamp
  field_of_study TEXT,
  gpa NUMERIC,
  start_date DATE,
  end_date DATE,
  graduation_date DATE,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT DEFAULT 'in_progress', -- in_progress, completed, withdrawn
  achievements TEXT[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_education_user ON public.education_records(user_id);

ALTER TABLE public.education_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_education" ON public.education_records
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_name TEXT NOT NULL,
  provider TEXT, -- coursera, udemy, edx, university, self_study
  instructor TEXT,
  url TEXT,
  duration_hours NUMERIC,
  level TEXT, -- beginner, intermediate, advanced
  status TEXT NOT NULL DEFAULT 'not_started', -- not_started, in_progress, completed, dropped
  progress_percent INT NOT NULL DEFAULT 0,
  rating INT,
  certificate_url TEXT,
  skills_learned TEXT[],
  start_date DATE,
  completion_date DATE,
  cost NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_courses_user ON public.courses(user_id, status);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_courses" ON public.courses
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.study_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  study_date DATE NOT NULL,
  duration_minutes INT NOT NULL,
  topic TEXT,
  notes TEXT,
  productivity_rating INT CHECK (productivity_rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_study_logs_user ON public.study_logs(user_id, study_date DESC);

ALTER TABLE public.study_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_study" ON public.study_logs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.degree_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  degree_name TEXT NOT NULL,
  institution TEXT,
  total_cost NUMERIC,
  expected_salary_increase NUMERIC,
  roi_percent NUMERIC,
  time_to_complete TEXT,
  pros JSONB DEFAULT '[]',
  cons JSONB DEFAULT '[]',
  recommendation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.degree_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_analyses" ON public.degree_analyses
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Triggers
CREATE TRIGGER set_education_updated_at BEFORE UPDATE ON public.education_records
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER set_courses_updated_at BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
