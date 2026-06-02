-- ============================================================================
-- 103: Enterprise Readiness & SOC 2 Foundation (Sprint R)
--
-- Tables to support:
--   * asset inventory (infrastructure / databases / providers / integrations)
--   * vendor management (the 7 named vendors + future additions)
--   * quarterly access reviews
--   * privileged-role audit trail
--   * secret-rotation schedule
--   * incidents + vulnerability tracking
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS enterprise;

-- ---- Enum helpers --------------------------------------------------------

CREATE OR REPLACE FUNCTION enterprise.is_asset_kind(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_catalog, pg_temp
AS $$
  SELECT p IN (
    'infrastructure','database','storage','provider','integration',
    'queue','observability','identity','source_code','secrets_store'
  )
$$;

CREATE OR REPLACE FUNCTION enterprise.is_vendor_status(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_catalog, pg_temp
AS $$ SELECT p IN ('active','pending_review','deprecated','offboarded') $$;

CREATE OR REPLACE FUNCTION enterprise.is_review_status(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_catalog, pg_temp
AS $$ SELECT p IN ('scheduled','in_progress','completed','overdue') $$;

CREATE OR REPLACE FUNCTION enterprise.is_incident_severity(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_catalog, pg_temp
AS $$ SELECT p IN ('SEV1','SEV2','SEV3','SEV4') $$;

-- ============================================================================
-- 1. enterprise.assets — infrastructure / database / provider catalog
-- ============================================================================
CREATE TABLE IF NOT EXISTS enterprise.assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_kind      TEXT NOT NULL CHECK (enterprise.is_asset_kind(asset_kind)),
  name            TEXT NOT NULL,
  owner_team      TEXT NOT NULL,
  description     TEXT,
  /** Data classification: public | internal | confidential | regulated */
  data_class      TEXT NOT NULL DEFAULT 'internal'
                    CHECK (data_class IN ('public','internal','confidential','regulated')),
  /** Where it runs (region / provider). */
  hosted_in       TEXT,
  /** Optional FK-ish reference to a vendor row when the asset is hosted by a third party. */
  vendor_id       UUID,
  /** Production / staging / dev. */
  environment     TEXT NOT NULL DEFAULT 'production'
                    CHECK (environment IN ('production','staging','development')),
  /** Whether the asset is in scope for SOC 2. */
  soc2_in_scope   BOOLEAN NOT NULL DEFAULT TRUE,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (asset_kind, name)
);
CREATE INDEX IF NOT EXISTS idx_assets_kind     ON enterprise.assets(asset_kind);
CREATE INDEX IF NOT EXISTS idx_assets_soc2     ON enterprise.assets(soc2_in_scope) WHERE soc2_in_scope = TRUE;
CREATE INDEX IF NOT EXISTS idx_assets_vendor   ON enterprise.assets(vendor_id) WHERE vendor_id IS NOT NULL;

-- ============================================================================
-- 2. enterprise.vendors — vendor registry
-- ============================================================================
CREATE TABLE IF NOT EXISTS enterprise.vendors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_key      TEXT NOT NULL UNIQUE,    -- 'gemini','supabase','plaid', etc.
  display_name    TEXT NOT NULL,
  /** What category of risk this vendor introduces. */
  risk_tier       TEXT NOT NULL CHECK (risk_tier IN ('high','medium','low')),
  /** Subprocesses the vendor itself relies on; informational. */
  subprocessors   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  /** Contract URL or doc reference. */
  contract_ref    TEXT,
  /** Data shared. */
  data_shared     TEXT,
  /** SOC 2 / ISO 27001 / etc. certifications relevant. */
  certifications  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  /** Whether a DPA / BAA / SCC is in place. */
  dpa_signed      BOOLEAN NOT NULL DEFAULT FALSE,
  baa_signed      BOOLEAN NOT NULL DEFAULT FALSE,
  /** Last full vendor review date (security questionnaire etc.). */
  last_reviewed_at DATE,
  next_review_due  DATE,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (enterprise.is_vendor_status(status)),
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vendors_status ON enterprise.vendors(status);
CREATE INDEX IF NOT EXISTS idx_vendors_review_due ON enterprise.vendors(next_review_due)
  WHERE status = 'active';

-- ============================================================================
-- 3. enterprise.access_reviews — quarterly role review records
-- ============================================================================
CREATE TABLE IF NOT EXISTS enterprise.access_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_period   TEXT NOT NULL,                 -- '2026-Q2'
  scope           TEXT NOT NULL,                 -- 'platform_admin','db_admin','tenant_owner', etc.
  status          TEXT NOT NULL DEFAULT 'scheduled' CHECK (enterprise.is_review_status(status)),
  /** Reviewer who signs off. */
  reviewer_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  scheduled_for   DATE NOT NULL,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  /** Number of subjects evaluated in this review. */
  subjects_total  INT NOT NULL DEFAULT 0,
  subjects_revoked INT NOT NULL DEFAULT 0,
  subjects_modified INT NOT NULL DEFAULT 0,
  /** Free-text findings written by the reviewer. */
  findings        TEXT,
  evidence_ref    TEXT,                          -- link or doc id
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (review_period, scope)
);
CREATE INDEX IF NOT EXISTS idx_ar_status ON enterprise.access_reviews(status)
  WHERE status IN ('scheduled','in_progress','overdue');

-- ============================================================================
-- 4. enterprise.admin_audit_log — privileged-action audit
-- ============================================================================
CREATE TABLE IF NOT EXISTS enterprise.admin_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  /** What role the actor was acting under (e.g. 'platform_admin'). */
  actor_role      TEXT NOT NULL,
  action          TEXT NOT NULL,           -- 'override.user_budget','reset.password',...
  /** What the action targeted. */
  target_kind     TEXT NOT NULL,           -- 'user','tenant','vendor','asset','breaker'
  target_id       TEXT,
  /** Optional structured before / after snapshot. */
  before_state    JSONB,
  after_state     JSONB,
  reason          TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_aal_actor   ON enterprise.admin_audit_log(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aal_target  ON enterprise.admin_audit_log(target_kind, target_id);
CREATE INDEX IF NOT EXISTS idx_aal_action  ON enterprise.admin_audit_log(action, created_at DESC);

-- ============================================================================
-- 5. enterprise.secret_rotation_schedule — rotation tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS enterprise.secret_rotation_schedule (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_key          TEXT NOT NULL UNIQUE,
  owner_team          TEXT NOT NULL,
  /** Rotation cadence in days. */
  rotation_period_days INT NOT NULL CHECK (rotation_period_days > 0),
  last_rotated_at     TIMESTAMPTZ,
  next_due_at         TIMESTAMPTZ,
  /** Where the secret lives (env-var name or GSM path). */
  storage_location    TEXT NOT NULL,
  vendor_id           UUID REFERENCES enterprise.vendors(id) ON DELETE SET NULL,
  /** Last rotation method: 'manual', 'gsm_managed', 'iam_rotated' */
  rotation_method     TEXT NOT NULL DEFAULT 'manual',
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_srs_due ON enterprise.secret_rotation_schedule(next_due_at);

-- ============================================================================
-- 6. enterprise.incidents — security + operational incident log
-- ============================================================================
CREATE TABLE IF NOT EXISTS enterprise.incidents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_key    TEXT NOT NULL UNIQUE,    -- 'INC-2026-0001'
  severity        TEXT NOT NULL CHECK (enterprise.is_incident_severity(severity)),
  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','mitigated','resolved','postmortem_pending','closed')),
  title           TEXT NOT NULL,
  summary         TEXT,
  /** Affected assets / vendors. */
  affected_assets TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  detected_at     TIMESTAMPTZ NOT NULL,
  mitigated_at    TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  /** Free-text postmortem link or summary. */
  postmortem_ref  TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inc_severity ON enterprise.incidents(severity, status);
CREATE INDEX IF NOT EXISTS idx_inc_open ON enterprise.incidents(status)
  WHERE status IN ('open','mitigated','postmortem_pending');

-- ============================================================================
-- 7. enterprise.vulnerabilities — vuln tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS enterprise.vulnerabilities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vuln_key        TEXT NOT NULL,                          -- CVE id or internal id
  severity        TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','accepted','mitigated','closed')),
  asset_id        UUID REFERENCES enterprise.assets(id) ON DELETE SET NULL,
  package_or_path TEXT NOT NULL,
  remediation     TEXT,
  due_at          TIMESTAMPTZ,
  closed_at       TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (vuln_key, asset_id)
);
CREATE INDEX IF NOT EXISTS idx_vuln_open ON enterprise.vulnerabilities(severity, status)
  WHERE status IN ('open','accepted');

-- ============================================================================
-- RLS — service-role only across the board. Operators read via the
-- privileged dashboard route, which itself runs under the service-role
-- client (gated by the operator_dashboard.read feature flag).
-- ============================================================================
ALTER TABLE enterprise.assets                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise.vendors                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise.access_reviews           ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise.admin_audit_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise.secret_rotation_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise.incidents                ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise.vulnerabilities          ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS asset_service ON enterprise.assets;
CREATE POLICY asset_service ON enterprise.assets FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS vendor_service ON enterprise.vendors;
CREATE POLICY vendor_service ON enterprise.vendors FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS ar_service ON enterprise.access_reviews;
CREATE POLICY ar_service ON enterprise.access_reviews FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS aal_service ON enterprise.admin_audit_log;
CREATE POLICY aal_service ON enterprise.admin_audit_log FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS srs_service ON enterprise.secret_rotation_schedule;
CREATE POLICY srs_service ON enterprise.secret_rotation_schedule FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS inc_service ON enterprise.incidents;
CREATE POLICY inc_service ON enterprise.incidents FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS vuln_service ON enterprise.vulnerabilities;
CREATE POLICY vuln_service ON enterprise.vulnerabilities FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ============================================================================
-- Seed: 7 named vendors per the Sprint R spec
-- ============================================================================
INSERT INTO enterprise.vendors (vendor_key, display_name, risk_tier, data_shared, subprocessors, certifications, dpa_signed, baa_signed, last_reviewed_at, next_review_due, status)
VALUES
  ('gemini',  'Google Gemini (Vertex AI)', 'high',   'Prompts; no PHI without BAA',           ARRAY['Google Cloud'],         ARRAY['SOC 2','ISO 27001','HIPAA-eligible via BAA'], TRUE,  FALSE, CURRENT_DATE, CURRENT_DATE + 365, 'active'),
  ('supabase','Supabase',                 'high',   'All application data',                  ARRAY['AWS'],                  ARRAY['SOC 2','HIPAA via BAA'],                       TRUE,  FALSE, CURRENT_DATE, CURRENT_DATE + 365, 'active'),
  ('flyio',   'Fly.io',                   'medium', 'Workers / background jobs',             ARRAY['various'],              ARRAY['SOC 2 (in progress)'],                         FALSE, FALSE, CURRENT_DATE, CURRENT_DATE + 180, 'active'),
  ('neo4j',   'Neo4j Aura',               'medium', 'Graph projection data (de-identified)', ARRAY['AWS / GCP'],            ARRAY['SOC 2','ISO 27001'],                            TRUE,  FALSE, CURRENT_DATE, CURRENT_DATE + 365, 'active'),
  ('qdrant',  'Qdrant Cloud',             'medium', 'Vector embeddings',                      ARRAY['AWS'],                  ARRAY['SOC 2 (in progress)'],                         FALSE, FALSE, CURRENT_DATE, CURRENT_DATE + 180, 'active'),
  ('plaid',   'Plaid',                    'high',   'Financial account / institution tokens', ARRAY['AWS'],                  ARRAY['SOC 2','ISO 27001','PCI DSS Service Provider'], TRUE,  FALSE, CURRENT_DATE, CURRENT_DATE + 365, 'active'),
  ('vercel',  'Vercel',                   'medium', 'Application runtime + logs',             ARRAY['AWS'],                  ARRAY['SOC 2','ISO 27001'],                            TRUE,  FALSE, CURRENT_DATE, CURRENT_DATE + 365, 'active')
ON CONFLICT (vendor_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  risk_tier = EXCLUDED.risk_tier,
  data_shared = EXCLUDED.data_shared,
  subprocessors = EXCLUDED.subprocessors,
  certifications = EXCLUDED.certifications,
  status = EXCLUDED.status,
  updated_at = NOW();

-- ============================================================================
-- Seed: representative asset catalog
-- ============================================================================
INSERT INTO enterprise.assets (asset_kind, name, owner_team, description, data_class, hosted_in, environment, soc2_in_scope)
VALUES
  ('infrastructure','vercel.production',     'platform',  'Next.js frontend + API routes',       'confidential','vercel-iad1',  'production', TRUE),
  ('infrastructure','fly.io.workers',         'platform',  'Rust ingestion + background jobs',    'confidential','fly-iad',      'production', TRUE),
  ('database',       'supabase.postgres',     'platform',  'Primary application database',        'confidential','supabase-us', 'production', TRUE),
  ('storage',        'supabase.storage',      'platform',  'Multimodal upload bucket',            'confidential','supabase-us', 'production', TRUE),
  ('database',       'neo4j.aura',            'graph',     'Graph projection (de-identified)',    'confidential','neo4j-aws',   'production', TRUE),
  ('database',       'qdrant.cloud',          'graph',     'Vector embeddings',                   'confidential','qdrant-aws',  'production', TRUE),
  ('provider',       'gemini.api',            'platform',  'Primary LLM provider',                'confidential','google-us',   'production', TRUE),
  ('integration',    'plaid.api',             'integrations','Bank + payroll integration',         'regulated',   'plaid-us',    'production', TRUE),
  ('observability',  'sentry',                'platform',  'Application error tracking',          'internal',    'sentry-us',   'production', TRUE),
  ('identity',       'supabase.auth',         'platform',  'User authentication',                 'confidential','supabase-us', 'production', TRUE),
  ('secrets_store',  'gcp.secret_manager',    'platform',  'Production secret store',             'regulated',   'google-us',   'production', TRUE),
  ('source_code',    'github.lifenav',        'platform',  'Application source',                  'confidential','github-us',   'production', TRUE)
ON CONFLICT (asset_kind, name) DO UPDATE SET
  owner_team = EXCLUDED.owner_team,
  description = EXCLUDED.description,
  data_class = EXCLUDED.data_class,
  hosted_in = EXCLUDED.hosted_in,
  updated_at = NOW();

-- ============================================================================
-- Seed: secret rotation schedule (representative)
-- ============================================================================
INSERT INTO enterprise.secret_rotation_schedule (secret_key, owner_team, rotation_period_days, last_rotated_at, next_due_at, storage_location, rotation_method)
VALUES
  ('GEMINI_API_KEY',             'platform',   90,  NOW(), NOW() + INTERVAL '90 days',  'gsm:lifenavigator-prod/gemini-api-key',          'manual'),
  ('SUPABASE_SERVICE_ROLE_KEY',  'platform',   180, NOW(), NOW() + INTERVAL '180 days', 'gsm:lifenavigator-prod/supabase-service-role',   'manual'),
  ('PLAID_CLIENT_SECRET',        'integrations',90,  NOW(), NOW() + INTERVAL '90 days',  'gsm:lifenavigator-prod/plaid-client-secret',     'manual'),
  ('OPENAI_API_KEY',             'platform',   90,  NOW(), NOW() + INTERVAL '90 days',  'gsm:lifenavigator-prod/openai-api-key',          'manual'),
  ('ANTHROPIC_API_KEY',          'platform',   90,  NOW(), NOW() + INTERVAL '90 days',  'gsm:lifenavigator-prod/anthropic-api-key',       'manual'),
  ('AZURE_OPENAI_API_KEY',       'platform',   90,  NOW(), NOW() + INTERVAL '90 days',  'gsm:lifenavigator-prod/azure-openai-api-key',    'manual'),
  ('VIRUSTOTAL_API_KEY',         'platform',   180, NOW(), NOW() + INTERVAL '180 days', 'gsm:lifenavigator-prod/virustotal-api-key',      'manual'),
  ('SMTP_PASS',                  'platform',   180, NOW(), NOW() + INTERVAL '180 days', 'gsm:lifenavigator-prod/smtp-pass',               'manual')
ON CONFLICT (secret_key) DO UPDATE SET
  owner_team = EXCLUDED.owner_team,
  rotation_period_days = EXCLUDED.rotation_period_days,
  storage_location = EXCLUDED.storage_location,
  updated_at = NOW();

-- ============================================================================
-- Self-test
-- ============================================================================
DO $$
DECLARE
  expected TEXT[] := ARRAY[
    'assets','vendors','access_reviews','admin_audit_log',
    'secret_rotation_schedule','incidents','vulnerabilities'
  ];
  t TEXT;
  n INT;
BEGIN
  FOREACH t IN ARRAY expected LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
      WHERE ns.nspname='enterprise' AND c.relname=t AND c.relkind='r'
    ) THEN
      RAISE EXCEPTION '103 self-test: enterprise.% missing', t;
    END IF;
  END LOOP;
  SELECT COUNT(*) INTO n FROM enterprise.vendors WHERE status = 'active';
  IF n < 7 THEN
    RAISE EXCEPTION '103 self-test: expected 7+ seeded vendors, found %', n;
  END IF;
END $$;
