-- ==========================================================================
-- 093: Enterprise Foundation & API Platform
--
-- Sprint P installs the multi-tenant + API-platform + connector +
-- BYOM model registry layer. Schema split into three:
--
--   platform.*    — tenants, tenant users, API keys, usage, quotas
--   connectors.*  — connector catalog, tenant connections, sync state
--   models.*      — BYOM model registry + per-tenant overrides
--
-- RLS strategy:
--   tenants                : visible to tenant admins
--   tenant_api_keys        : visible to tenant admins; full hash never returned to client
--   tenant_api_usage       : visible to tenant admins
--   connector_registry     : world-readable (catalog)
--   tenant_connections     : tenant admins; creds_vault_ref only
--   model_registry         : world-readable (catalog + rates)
--   tenant_model_overrides : tenant admins
-- ==========================================================================

CREATE SCHEMA IF NOT EXISTS platform;
CREATE SCHEMA IF NOT EXISTS connectors;
CREATE SCHEMA IF NOT EXISTS models;
GRANT USAGE ON SCHEMA platform, connectors, models TO authenticated, service_role;


-- ###########################################################################
-- Enums
-- ###########################################################################

CREATE OR REPLACE FUNCTION platform.is_tenant_kind(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('consumer','employer','arcana','enterprise','partner','internal','dev')
$$;

CREATE OR REPLACE FUNCTION platform.is_tenant_isolation(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('shared','industry','dedicated')
$$;

CREATE OR REPLACE FUNCTION platform.is_tenant_role(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('owner','admin','operator','viewer')
$$;

CREATE OR REPLACE FUNCTION platform.is_api_key_status(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('active','rotated','revoked','expired')
$$;

CREATE OR REPLACE FUNCTION connectors.is_kind(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('payroll','brokerage','retirement','bank','health','insurance','other')
$$;

CREATE OR REPLACE FUNCTION connectors.is_connection_status(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('pending','active','syncing','paused','revoked','error','expired')
$$;

CREATE OR REPLACE FUNCTION models.is_modality(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('text','vision','speech','video','embedding','multimodal')
$$;


-- ###########################################################################
-- platform.tenants
-- ###########################################################################

CREATE TABLE IF NOT EXISTS platform.tenants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  tenant_kind   TEXT NOT NULL CHECK (platform.is_tenant_kind(tenant_kind)),
  isolation     TEXT NOT NULL DEFAULT 'shared' CHECK (platform.is_tenant_isolation(isolation)),
  industry_code TEXT,                                      -- NAICS or internal taxonomy
  status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','suspended','closed')),
  data_residency TEXT,                                     -- 'us','eu','ca','other'
  retention_default TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform.tenant_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (platform.is_tenant_role(role)),
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  invited_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  removed_at    TIMESTAMPTZ,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_user_unique UNIQUE (tenant_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_tu_user ON platform.tenant_users(user_id, removed_at);


-- ###########################################################################
-- platform.tenant_api_keys (+ usage + quotas)
-- ###########################################################################

CREATE TABLE IF NOT EXISTS platform.tenant_api_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  prefix          TEXT NOT NULL,                         -- first 8 chars, indexable + shown in UI
  key_hash        TEXT NOT NULL,                         -- sha256 of the full key, hex
  scopes          TEXT[] NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'active' CHECK (platform.is_api_key_status(status)),
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at      TIMESTAMPTZ,
  last_used_at    TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tak_prefix_unique UNIQUE (prefix)
);
CREATE INDEX IF NOT EXISTS idx_tak_tenant ON platform.tenant_api_keys(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_tak_hash   ON platform.tenant_api_keys(key_hash);

CREATE TABLE IF NOT EXISTS platform.tenant_api_usage (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
  api_key_id     UUID REFERENCES platform.tenant_api_keys(id) ON DELETE SET NULL,
  route_path     TEXT NOT NULL,
  method         TEXT NOT NULL,
  status_code    INT NOT NULL,
  latency_ms     INT,
  request_bytes  INT,
  response_bytes INT,
  cost_usd_micros BIGINT NOT NULL DEFAULT 0 CHECK (cost_usd_micros >= 0),
  metadata       JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tau_tenant ON platform.tenant_api_usage(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tau_key    ON platform.tenant_api_usage(api_key_id, created_at DESC);

CREATE TABLE IF NOT EXISTS platform.tenant_quotas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
  quota_kind    TEXT NOT NULL,                           -- 'requests_per_minute','tokens_per_day','storage_gb', ...
  quota_value   NUMERIC NOT NULL CHECK (quota_value >= 0),
  hard_limit    BOOLEAN NOT NULL DEFAULT FALSE,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tq_unique UNIQUE (tenant_id, quota_kind)
);


-- ###########################################################################
-- connectors.connector_registry + tenant_connections
-- ###########################################################################

CREATE TABLE IF NOT EXISTS connectors.connector_registry (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  vendor       TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (connectors.is_kind(kind)),
  auth_flow    TEXT NOT NULL CHECK (auth_flow IN ('oauth2','partner_token','custom','plaid_link','sftp','webhook')),
  docs_url     TEXT,
  enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  beta         BOOLEAN NOT NULL DEFAULT FALSE,
  scopes_supported TEXT[] NOT NULL DEFAULT '{}',
  metadata     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS connectors.tenant_connections (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
  user_id        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  connector_slug TEXT NOT NULL REFERENCES connectors.connector_registry(slug) ON DELETE RESTRICT,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (connectors.is_connection_status(status)),
  display_label  TEXT,
  scopes_granted TEXT[] NOT NULL DEFAULT '{}',
  creds_vault_ref TEXT,                                  -- secret store pointer; never raw creds
  last_sync_at   TIMESTAMPTZ,
  last_sync_error TEXT,
  metadata       JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tc_tenant ON connectors.tenant_connections(tenant_id, status);


-- ###########################################################################
-- models.model_registry + tenant_model_overrides
-- ###########################################################################

CREATE TABLE IF NOT EXISTS models.model_registry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider        TEXT NOT NULL,                         -- 'gemini','openai','anthropic','azure_openai','local'
  model_id        TEXT NOT NULL,                         -- canonical e.g. 'gemini-2.5-pro'
  display_name    TEXT NOT NULL,
  modalities      TEXT[] NOT NULL DEFAULT '{}',
  context_window  INT,
  rate_input_micros_per_ktok  BIGINT,
  rate_output_micros_per_ktok BIGINT,
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  default_for     TEXT[],                                -- e.g. {'text','vision'}
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT mr_unique UNIQUE (provider, model_id)
);

CREATE TABLE IF NOT EXISTS models.tenant_model_overrides (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
  capability      TEXT NOT NULL CHECK (models.is_modality(capability)),
  model_registry_id UUID NOT NULL REFERENCES models.model_registry(id) ON DELETE RESTRICT,
  enforced        BOOLEAN NOT NULL DEFAULT TRUE,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tmo_unique UNIQUE (tenant_id, capability)
);


-- ###########################################################################
-- updated_at triggers
-- ###########################################################################
DO $$
DECLARE t TEXT; s TEXT;
BEGIN
  FOR s, t IN
    SELECT * FROM (VALUES
      ('platform','tenants'),
      ('platform','tenant_users'),
      ('platform','tenant_api_keys'),
      ('platform','tenant_quotas'),
      ('connectors','connector_registry'),
      ('connectors','tenant_connections'),
      ('models','model_registry'),
      ('models','tenant_model_overrides')
    ) AS x(s,t)
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_%I_updated_at ON %I.%I; '
      'CREATE TRIGGER set_%I_updated_at BEFORE UPDATE ON %I.%I '
      'FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();',
      t, s, t, t, s, t
    );
  END LOOP;
END $$;


-- ###########################################################################
-- RLS
-- ###########################################################################
ALTER TABLE platform.tenants              ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.tenant_users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.tenant_api_keys      ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.tenant_api_usage     ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.tenant_quotas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE connectors.connector_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE connectors.tenant_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE models.model_registry         ENABLE ROW LEVEL SECURITY;
ALTER TABLE models.tenant_model_overrides ENABLE ROW LEVEL SECURITY;

-- Membership helper (SECURITY DEFINER to bypass RLS on tenant_users).
CREATE OR REPLACE FUNCTION platform.is_tenant_member(p_tenant_id UUID, p_user_id UUID, p_min_role TEXT DEFAULT 'viewer')
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = platform, public AS $$
DECLARE r TEXT;
BEGIN
  SELECT role INTO r FROM platform.tenant_users
   WHERE tenant_id = p_tenant_id AND user_id = p_user_id AND removed_at IS NULL
   LIMIT 1;
  IF r IS NULL THEN RETURN FALSE; END IF;
  IF p_min_role = 'viewer' THEN RETURN TRUE; END IF;
  IF p_min_role = 'operator' THEN RETURN r IN ('operator','admin','owner'); END IF;
  IF p_min_role = 'admin' THEN RETURN r IN ('admin','owner'); END IF;
  IF p_min_role = 'owner' THEN RETURN r = 'owner'; END IF;
  RETURN FALSE;
END $$;

GRANT EXECUTE ON FUNCTION platform.is_tenant_member(UUID, UUID, TEXT) TO authenticated, service_role;

-- Policies — tenants are visible to members; admin-level rows visible to admins.
DROP POLICY IF EXISTS tenants_member_select ON platform.tenants;
CREATE POLICY tenants_member_select ON platform.tenants
  FOR SELECT USING (platform.is_tenant_member(id, auth.uid(), 'viewer'));
DROP POLICY IF EXISTS tenants_service ON platform.tenants;
CREATE POLICY tenants_service ON platform.tenants FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS tu_self_select ON platform.tenant_users;
CREATE POLICY tu_self_select ON platform.tenant_users
  FOR SELECT USING (auth.uid() = user_id OR platform.is_tenant_member(tenant_id, auth.uid(), 'admin'));
DROP POLICY IF EXISTS tu_service ON platform.tenant_users;
CREATE POLICY tu_service ON platform.tenant_users FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS tak_admin_select ON platform.tenant_api_keys;
CREATE POLICY tak_admin_select ON platform.tenant_api_keys
  FOR SELECT USING (platform.is_tenant_member(tenant_id, auth.uid(), 'admin'));
DROP POLICY IF EXISTS tak_service ON platform.tenant_api_keys;
CREATE POLICY tak_service ON platform.tenant_api_keys FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS tau_admin_select ON platform.tenant_api_usage;
CREATE POLICY tau_admin_select ON platform.tenant_api_usage
  FOR SELECT USING (platform.is_tenant_member(tenant_id, auth.uid(), 'admin'));
DROP POLICY IF EXISTS tau_service ON platform.tenant_api_usage;
CREATE POLICY tau_service ON platform.tenant_api_usage FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS tq_admin_select ON platform.tenant_quotas;
CREATE POLICY tq_admin_select ON platform.tenant_quotas
  FOR SELECT USING (platform.is_tenant_member(tenant_id, auth.uid(), 'admin'));
DROP POLICY IF EXISTS tq_service ON platform.tenant_quotas;
CREATE POLICY tq_service ON platform.tenant_quotas FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Connector registry + model registry are world-readable (catalogs).
DROP POLICY IF EXISTS cr_public_select ON connectors.connector_registry;
CREATE POLICY cr_public_select ON connectors.connector_registry FOR SELECT USING (true);
DROP POLICY IF EXISTS cr_service ON connectors.connector_registry;
CREATE POLICY cr_service ON connectors.connector_registry FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS tcn_member_select ON connectors.tenant_connections;
CREATE POLICY tcn_member_select ON connectors.tenant_connections
  FOR SELECT USING (platform.is_tenant_member(tenant_id, auth.uid(), 'viewer'));
DROP POLICY IF EXISTS tcn_service ON connectors.tenant_connections;
CREATE POLICY tcn_service ON connectors.tenant_connections FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS mr_public_select ON models.model_registry;
CREATE POLICY mr_public_select ON models.model_registry FOR SELECT USING (true);
DROP POLICY IF EXISTS mr_service ON models.model_registry;
CREATE POLICY mr_service ON models.model_registry FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS tmo_member_select ON models.tenant_model_overrides;
CREATE POLICY tmo_member_select ON models.tenant_model_overrides
  FOR SELECT USING (platform.is_tenant_member(tenant_id, auth.uid(), 'admin'));
DROP POLICY IF EXISTS tmo_service ON models.tenant_model_overrides;
CREATE POLICY tmo_service ON models.tenant_model_overrides FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON ALL TABLES IN SCHEMA platform   TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA connectors TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA models     TO authenticated;


-- ###########################################################################
-- Public read-views
-- ###########################################################################
DO $$
DECLARE t TEXT; s TEXT;
BEGIN
  FOR s, t IN
    SELECT * FROM (VALUES
      ('platform','tenants'),
      ('platform','tenant_users'),
      ('platform','tenant_api_keys'),
      ('platform','tenant_api_usage'),
      ('platform','tenant_quotas'),
      ('connectors','connector_registry'),
      ('connectors','tenant_connections'),
      ('models','model_registry'),
      ('models','tenant_model_overrides')
    ) AS x(s,t)
  LOOP
    EXECUTE format('CREATE OR REPLACE VIEW public.%I_%I AS SELECT * FROM %I.%I', s, t, s, t);
    EXECUTE format('GRANT SELECT ON public.%I_%I TO authenticated', s, t);
  END LOOP;
END $$;


-- ###########################################################################
-- Seeds
-- ###########################################################################

-- 12 connector entries (real auth flows; integrations may be implemented at any time).
INSERT INTO connectors.connector_registry (slug, display_name, vendor, kind, auth_flow, scopes_supported, beta, docs_url) VALUES
  ('adp.workforce_now',   'ADP Workforce Now',  'ADP',       'payroll',    'oauth2', ARRAY['payroll.read','employee.read']::text[], TRUE,  'https://developers.adp.com'),
  ('paychex.flex',        'Paychex Flex',       'Paychex',   'payroll',    'oauth2', ARRAY['payroll.read']::text[],                    TRUE,  'https://developer.paychex.com'),
  ('gusto.api',           'Gusto',              'Gusto',     'payroll',    'oauth2', ARRAY['payrolls:read','employees:read']::text[],  FALSE, 'https://docs.gusto.com'),
  ('fidelity.netbenefits','Fidelity NetBenefits','Fidelity', 'retirement', 'partner_token', ARRAY['accounts.read']::text[],            TRUE,  'https://www.fidelity.com'),
  ('schwab.individual',   'Schwab Individual',  'Schwab',    'brokerage',  'oauth2', ARRAY['accounts.read','positions.read']::text[],  TRUE,  'https://developer.schwab.com'),
  ('vanguard.individual', 'Vanguard Individual','Vanguard',  'brokerage',  'partner_token', ARRAY['accounts.read']::text[],            TRUE,  'https://investor.vanguard.com'),
  ('empower.retirement',  'Empower Retirement', 'Empower',   'retirement', 'oauth2', ARRAY['accounts.read']::text[],                   TRUE,  'https://www.empower.com'),
  ('morgan_stanley.wm',   'Morgan Stanley WM',  'Morgan Stanley','brokerage', 'partner_token', ARRAY['accounts.read']::text[],         TRUE,  'https://advisor.morganstanley.com'),
  ('plaid.income',        'Plaid Income',       'Plaid',     'payroll',    'plaid_link', ARRAY['income','identity']::text[],          FALSE, 'https://plaid.com/docs/income/'),
  ('plaid.investments',   'Plaid Investments',  'Plaid',     'brokerage',  'plaid_link', ARRAY['investments']::text[],                FALSE, 'https://plaid.com/docs/investments/'),
  ('plaid.transactions',  'Plaid Transactions', 'Plaid',     'bank',       'plaid_link', ARRAY['transactions']::text[],               FALSE, 'https://plaid.com/docs/transactions/'),
  ('mock.payroll_dev',    'Mock Payroll (dev)', 'LifeNavigator','payroll', 'custom',  ARRAY['payroll.read']::text[],                   FALSE, NULL)
ON CONFLICT (slug) DO NOTHING;

-- BYOM model catalog — rates are stored as micro-USD per 1k tokens.
INSERT INTO models.model_registry
  (provider, model_id, display_name, modalities, context_window, rate_input_micros_per_ktok, rate_output_micros_per_ktok, enabled, default_for) VALUES
  ('gemini',       'gemini-2.5-pro',         'Gemini 2.5 Pro',         ARRAY['text','vision','video','multimodal']::text[], 2000000, 1250, 5000, TRUE, ARRAY['text','vision','video']::text[]),
  ('gemini',       'gemini-2.5-flash',       'Gemini 2.5 Flash',       ARRAY['text','vision','video','multimodal']::text[], 1000000, 75,   300, TRUE, NULL),
  ('gemini',       'gemini-1.5-pro',         'Gemini 1.5 Pro',         ARRAY['text','vision','video','multimodal']::text[], 1000000, 1250, 5000, TRUE, NULL),
  ('gemini',       'gemini-1.5-flash',       'Gemini 1.5 Flash',       ARRAY['text','vision','video','multimodal']::text[], 1000000, 75,   300, TRUE, NULL),
  ('openai',       'gpt-4o',                 'OpenAI GPT-4o',          ARRAY['text','vision','speech','multimodal']::text[], 128000, 2500, 10000, TRUE, NULL),
  ('openai',       'gpt-4o-mini',            'OpenAI GPT-4o Mini',     ARRAY['text','vision','multimodal']::text[],         128000, 150,  600, TRUE, NULL),
  ('openai',       'whisper-1',              'OpenAI Whisper',         ARRAY['speech']::text[],                              NULL,    NULL, NULL, TRUE, ARRAY['speech']::text[]),
  ('anthropic',    'claude-3-5-sonnet',      'Anthropic Claude 3.5 Sonnet', ARRAY['text','vision','multimodal']::text[],     200000, 3000, 15000, TRUE, NULL),
  ('anthropic',    'claude-3-5-haiku',       'Anthropic Claude 3.5 Haiku',  ARRAY['text','vision','multimodal']::text[],     200000, 800,  4000, TRUE, NULL),
  ('azure_openai', 'gpt-4o-az',              'Azure OpenAI GPT-4o',    ARRAY['text','vision','speech','multimodal']::text[], 128000, 2500, 10000, TRUE, NULL),
  ('azure_openai', 'gpt-4o-mini-az',         'Azure OpenAI GPT-4o Mini',ARRAY['text','vision','multimodal']::text[],          128000, 150,  600, TRUE, NULL)
ON CONFLICT (provider, model_id) DO NOTHING;


-- ###########################################################################
-- Self-test
-- ###########################################################################
DO $$
DECLARE n INT; rls BOOLEAN;
BEGIN
  SELECT relrowsecurity INTO rls FROM pg_class c JOIN pg_namespace nsp ON nsp.oid = c.relnamespace
   WHERE nsp.nspname = 'platform' AND c.relname = 'tenant_api_keys';
  IF NOT rls THEN RAISE EXCEPTION '093 self-test: RLS missing on tenant_api_keys'; END IF;

  SELECT COUNT(*) INTO n FROM connectors.connector_registry;
  IF n < 8 THEN RAISE EXCEPTION '093 self-test: connector_registry under-seeded (n=%)', n; END IF;

  SELECT COUNT(*) INTO n FROM models.model_registry WHERE enabled = TRUE;
  IF n < 8 THEN RAISE EXCEPTION '093 self-test: model_registry under-seeded (n=%)', n; END IF;
END $$;
