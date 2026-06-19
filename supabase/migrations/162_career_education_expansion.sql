-- 162_career_education_expansion.sql
-- Rich career + education history input.
--
-- Career: volunteer work + side projects as first-class tables (employment history
--   already lives in career.experience_records; aspirational jobs in career.career_goals).
-- Education: a licenses table; extend certifications + education_records with issuer/school
--   logo metadata; and a GLOBAL school catalog (shared reference data) powering a
--   searchable school/issuer picker with logos.
--
-- Idempotent. RLS + grants follow the uniform owner-isolation pattern (migrations 122/127).
-- `career`, `education`, `public` are already PostgREST-exposed (migration 156), so no
-- pgrst.db_schemas change is needed here.

-- ============================================================ CAREER
CREATE TABLE IF NOT EXISTS career.volunteer_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID,
  organization TEXT,
  role TEXT,
  cause_area TEXT,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  hours_per_month NUMERIC,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS career.side_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID,
  name TEXT,
  role TEXT,
  project_type TEXT,
  url TEXT,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Display polish for employment history (optional columns).
ALTER TABLE career.experience_records ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE career.experience_records ADD COLUMN IF NOT EXISTS employer_domain TEXT;
ALTER TABLE career.experience_records ADD COLUMN IF NOT EXISTS employer_logo_url TEXT;

CREATE INDEX IF NOT EXISTS idx_c_volunteer_user ON career.volunteer_records(user_id);
CREATE INDEX IF NOT EXISTS idx_c_sideproj_user ON career.side_projects(user_id);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['volunteer_records','side_projects'] LOOP
    EXECUTE format('ALTER TABLE career.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE career.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$DROP POLICY IF EXISTS users_own_%1$s ON career.%1$I$p$, t);
    EXECUTE format(
      'CREATE POLICY users_own_%1$s ON career.%1$I FOR ALL TO authenticated '
      'USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())', t);
    EXECUTE format($p$DROP POLICY IF EXISTS service_%1$s ON career.%1$I$p$, t);
    EXECUTE format(
      'CREATE POLICY service_%1$s ON career.%1$I FOR ALL TO service_role USING (true) WITH CHECK (true)', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON career.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON career.%I TO service_role', t);
  END LOOP;
END $$;

-- ============================================================ EDUCATION
CREATE TABLE IF NOT EXISTS education.licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID,
  name TEXT NOT NULL,
  issuing_authority TEXT,
  license_number TEXT,
  state TEXT,
  issued_date DATE,
  expires_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  issuer_domain TEXT,
  logo_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_e_licenses_user ON education.licenses(user_id);

-- Certificates: extend the existing (unused-by-UI) certifications table for real input.
ALTER TABLE education.certifications ADD COLUMN IF NOT EXISTS issued_date DATE;
ALTER TABLE education.certifications ADD COLUMN IF NOT EXISTS expires_date DATE;
ALTER TABLE education.certifications ADD COLUMN IF NOT EXISTS credential_id TEXT;
ALTER TABLE education.certifications ADD COLUMN IF NOT EXISTS issuer_domain TEXT;
ALTER TABLE education.certifications ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Degrees / high-school records: carry the chosen school's logo for display.
ALTER TABLE public.education_records ADD COLUMN IF NOT EXISTS school_domain TEXT;
ALTER TABLE public.education_records ADD COLUMN IF NOT EXISTS school_logo_url TEXT;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['licenses'] LOOP
    EXECUTE format('ALTER TABLE education.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE education.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$DROP POLICY IF EXISTS users_own_%1$s ON education.%1$I$p$, t);
    EXECUTE format(
      'CREATE POLICY users_own_%1$s ON education.%1$I FOR ALL TO authenticated '
      'USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())', t);
    EXECUTE format($p$DROP POLICY IF EXISTS service_%1$s ON education.%1$I$p$, t);
    EXECUTE format(
      'CREATE POLICY service_%1$s ON education.%1$I FOR ALL TO service_role USING (true) WITH CHECK (true)', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON education.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON education.%I TO service_role', t);
  END LOOP;
END $$;

-- ============================================================ SCHOOL CATALOG (global reference)
-- Shared, read-only reference data for the school/issuer picker. NOT user-scoped:
-- every authenticated user reads the same catalog; only service_role writes.
CREATE TABLE IF NOT EXISTS public.school_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT,
  logo_url TEXT,
  type TEXT,            -- university | college | community_college | high_school | bootcamp | cert_issuer | online
  location TEXT,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_school_catalog_name ON public.school_catalog USING gin (to_tsvector('simple', name));
CREATE UNIQUE INDEX IF NOT EXISTS uq_school_catalog_name_domain ON public.school_catalog(name, COALESCE(domain, ''));

ALTER TABLE public.school_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS read_school_catalog ON public.school_catalog;
CREATE POLICY read_school_catalog ON public.school_catalog FOR SELECT TO authenticated, anon USING (true);
DROP POLICY IF EXISTS service_school_catalog ON public.school_catalog;
CREATE POLICY service_school_catalog ON public.school_catalog FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT ON public.school_catalog TO authenticated, anon;
GRANT ALL ON public.school_catalog TO service_role;

-- Curated seed. logo_url uses Clearbit's free logo endpoint by domain (no API key);
-- the UI falls back to a letter-avatar when a logo 404s. Free-text entry is allowed for
-- anything not listed, so this is a starter set, not an exhaustive registry.
INSERT INTO public.school_catalog (name, domain, logo_url, type, location) VALUES
  ('Harvard University','harvard.edu','https://logo.clearbit.com/harvard.edu','university','Cambridge, MA'),
  ('Stanford University','stanford.edu','https://logo.clearbit.com/stanford.edu','university','Stanford, CA'),
  ('Massachusetts Institute of Technology','mit.edu','https://logo.clearbit.com/mit.edu','university','Cambridge, MA'),
  ('Yale University','yale.edu','https://logo.clearbit.com/yale.edu','university','New Haven, CT'),
  ('Princeton University','princeton.edu','https://logo.clearbit.com/princeton.edu','university','Princeton, NJ'),
  ('Columbia University','columbia.edu','https://logo.clearbit.com/columbia.edu','university','New York, NY'),
  ('University of Pennsylvania','upenn.edu','https://logo.clearbit.com/upenn.edu','university','Philadelphia, PA'),
  ('Cornell University','cornell.edu','https://logo.clearbit.com/cornell.edu','university','Ithaca, NY'),
  ('Brown University','brown.edu','https://logo.clearbit.com/brown.edu','university','Providence, RI'),
  ('Dartmouth College','dartmouth.edu','https://logo.clearbit.com/dartmouth.edu','college','Hanover, NH'),
  ('Duke University','duke.edu','https://logo.clearbit.com/duke.edu','university','Durham, NC'),
  ('Northwestern University','northwestern.edu','https://logo.clearbit.com/northwestern.edu','university','Evanston, IL'),
  ('University of Chicago','uchicago.edu','https://logo.clearbit.com/uchicago.edu','university','Chicago, IL'),
  ('Johns Hopkins University','jhu.edu','https://logo.clearbit.com/jhu.edu','university','Baltimore, MD'),
  ('California Institute of Technology','caltech.edu','https://logo.clearbit.com/caltech.edu','university','Pasadena, CA'),
  ('University of California, Berkeley','berkeley.edu','https://logo.clearbit.com/berkeley.edu','university','Berkeley, CA'),
  ('University of California, Los Angeles','ucla.edu','https://logo.clearbit.com/ucla.edu','university','Los Angeles, CA'),
  ('University of Michigan','umich.edu','https://logo.clearbit.com/umich.edu','university','Ann Arbor, MI'),
  ('New York University','nyu.edu','https://logo.clearbit.com/nyu.edu','university','New York, NY'),
  ('University of Southern California','usc.edu','https://logo.clearbit.com/usc.edu','university','Los Angeles, CA'),
  ('University of Texas at Austin','utexas.edu','https://logo.clearbit.com/utexas.edu','university','Austin, TX'),
  ('Georgia Institute of Technology','gatech.edu','https://logo.clearbit.com/gatech.edu','university','Atlanta, GA'),
  ('University of Washington','washington.edu','https://logo.clearbit.com/washington.edu','university','Seattle, WA'),
  ('Carnegie Mellon University','cmu.edu','https://logo.clearbit.com/cmu.edu','university','Pittsburgh, PA'),
  ('University of Illinois Urbana-Champaign','illinois.edu','https://logo.clearbit.com/illinois.edu','university','Urbana, IL'),
  ('University of Wisconsin-Madison','wisc.edu','https://logo.clearbit.com/wisc.edu','university','Madison, WI'),
  ('University of North Carolina at Chapel Hill','unc.edu','https://logo.clearbit.com/unc.edu','university','Chapel Hill, NC'),
  ('Boston University','bu.edu','https://logo.clearbit.com/bu.edu','university','Boston, MA'),
  ('New York University Stern','stern.nyu.edu','https://logo.clearbit.com/nyu.edu','university','New York, NY'),
  ('Pennsylvania State University','psu.edu','https://logo.clearbit.com/psu.edu','university','University Park, PA'),
  ('Ohio State University','osu.edu','https://logo.clearbit.com/osu.edu','university','Columbus, OH'),
  ('University of Florida','ufl.edu','https://logo.clearbit.com/ufl.edu','university','Gainesville, FL'),
  ('Arizona State University','asu.edu','https://logo.clearbit.com/asu.edu','university','Tempe, AZ'),
  ('Purdue University','purdue.edu','https://logo.clearbit.com/purdue.edu','university','West Lafayette, IN'),
  ('University of Virginia','virginia.edu','https://logo.clearbit.com/virginia.edu','university','Charlottesville, VA'),
  ('University of Notre Dame','nd.edu','https://logo.clearbit.com/nd.edu','university','Notre Dame, IN'),
  ('Vanderbilt University','vanderbilt.edu','https://logo.clearbit.com/vanderbilt.edu','university','Nashville, TN'),
  ('Rice University','rice.edu','https://logo.clearbit.com/rice.edu','university','Houston, TX'),
  ('Emory University','emory.edu','https://logo.clearbit.com/emory.edu','university','Atlanta, GA'),
  ('Georgetown University','georgetown.edu','https://logo.clearbit.com/georgetown.edu','university','Washington, DC'),
  ('University of Toronto','utoronto.ca','https://logo.clearbit.com/utoronto.ca','university','Toronto, ON'),
  ('University of Oxford','ox.ac.uk','https://logo.clearbit.com/ox.ac.uk','university','Oxford, UK'),
  ('University of Cambridge','cam.ac.uk','https://logo.clearbit.com/cam.ac.uk','university','Cambridge, UK'),
  ('London School of Economics','lse.ac.uk','https://logo.clearbit.com/lse.ac.uk','university','London, UK'),
  ('Western Governors University','wgu.edu','https://logo.clearbit.com/wgu.edu','online','Salt Lake City, UT'),
  ('Southern New Hampshire University','snhu.edu','https://logo.clearbit.com/snhu.edu','online','Manchester, NH'),
  ('General Assembly','generalassemb.ly','https://logo.clearbit.com/generalassemb.ly','bootcamp','Online'),
  ('Flatiron School','flatironschool.com','https://logo.clearbit.com/flatironschool.com','bootcamp','Online'),
  ('Coursera','coursera.org','https://logo.clearbit.com/coursera.org','cert_issuer','Online'),
  ('edX','edx.org','https://logo.clearbit.com/edx.org','cert_issuer','Online'),
  ('Udemy','udemy.com','https://logo.clearbit.com/udemy.com','cert_issuer','Online'),
  ('Udacity','udacity.com','https://logo.clearbit.com/udacity.com','cert_issuer','Online'),
  ('LinkedIn Learning','linkedin.com','https://logo.clearbit.com/linkedin.com','cert_issuer','Online'),
  ('Amazon Web Services','aws.amazon.com','https://logo.clearbit.com/aws.amazon.com','cert_issuer','Online'),
  ('Google','google.com','https://logo.clearbit.com/google.com','cert_issuer','Online'),
  ('Microsoft','microsoft.com','https://logo.clearbit.com/microsoft.com','cert_issuer','Online'),
  ('Cisco','cisco.com','https://logo.clearbit.com/cisco.com','cert_issuer','Online'),
  ('CompTIA','comptia.org','https://logo.clearbit.com/comptia.org','cert_issuer','Online'),
  ('Project Management Institute','pmi.org','https://logo.clearbit.com/pmi.org','cert_issuer','Online'),
  ('CFA Institute','cfainstitute.org','https://logo.clearbit.com/cfainstitute.org','cert_issuer','Online')
ON CONFLICT (name, COALESCE(domain, '')) DO NOTHING;
