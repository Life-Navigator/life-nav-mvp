-- ============================================================================
-- 104: Enterprise GraphRAG Projections & Constitutional Layering (Sprint S)
--
-- Layered constitutional model:
--
--   global         — platform constitution (Sprint L2 + N.3, layer='global')
--      ↓
--   industry       — vertical baseline (financial_services / healthcare /
--                    payroll / education / government / energy)
--      ↓
--   organization   — tenant-specific policies + procedures + terminology
--      ↓
--   user           — per-user overrides (limited; cannot override safety)
--
-- Hard rule (enforced by layer-resolver lib):
-- a lower layer can NEVER override a higher-layer rule whose
-- `is_overridable = FALSE`. Safety / lawfulness / harm rules are
-- always non-overridable.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS projections;

-- ---- Enum helpers --------------------------------------------------------

CREATE OR REPLACE FUNCTION projections.is_layer(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_catalog, pg_temp
AS $$ SELECT p IN ('global','industry','organization','user') $$;

CREATE OR REPLACE FUNCTION projections.is_industry(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_catalog, pg_temp
AS $$
  SELECT p IN ('financial_services','healthcare','payroll','education','government','energy')
$$;

CREATE OR REPLACE FUNCTION projections.is_policy_outcome(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_catalog, pg_temp
AS $$ SELECT p IN ('approved','prohibited','escalate','requires_compliance_review') $$;

CREATE OR REPLACE FUNCTION projections.is_projection_status(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_catalog, pg_temp
AS $$ SELECT p IN ('draft','active','deprecated') $$;

-- ============================================================================
-- 1. projections.enterprise_projections — per-tenant projection metadata
-- ============================================================================
CREATE TABLE IF NOT EXISTS projections.enterprise_projections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL UNIQUE,
  display_name    TEXT NOT NULL,
  industry        TEXT NOT NULL CHECK (projections.is_industry(industry)),
  /** Whether the projection has been activated. Draft projections
   *  are visible only to tenant admins for editing. */
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (projections.is_projection_status(status)),
  /** Hash of the active rule set so retrieval can cache + invalidate. */
  rule_set_version TEXT,
  /** Optional regulator (e.g. 'SEC', 'FINRA', 'HIPAA', 'FERPA'). */
  primary_regulator TEXT,
  /** Hashed compliance certifications relevant to the projection. */
  compliance_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ep_industry ON projections.enterprise_projections(industry);
CREATE INDEX IF NOT EXISTS idx_ep_status   ON projections.enterprise_projections(status);

-- ============================================================================
-- 2. projections.constitutional_layer_rules
--
-- Per-layer rule rows. The composition lookup at retrieval time:
--
--   WHERE (layer = 'global'       AND tenant_id IS NULL AND industry IS NULL)
--      OR (layer = 'industry'     AND industry      = $industry)
--      OR (layer = 'organization' AND tenant_id     = $tenant_id)
--      OR (layer = 'user'         AND tenant_id     = $tenant_id AND user_id = $user_id)
-- ============================================================================
CREATE TABLE IF NOT EXISTS projections.constitutional_layer_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer           TEXT NOT NULL CHECK (projections.is_layer(layer)),
  /** When layer='industry', industry must be set. */
  industry        TEXT CHECK (industry IS NULL OR projections.is_industry(industry)),
  tenant_id       UUID,
  user_id         UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  /** Mirrors governance.constitutional_entities shape for retrieval. */
  entity_kind     TEXT NOT NULL,
  slug            TEXT NOT NULL,
  name            TEXT NOT NULL,
  body            TEXT NOT NULL,
  source          TEXT,
  citation_reference TEXT,
  version         TEXT NOT NULL DEFAULT '1.0.0',
  /** Lower layers can override IFF this is TRUE. Safety / lawfulness
   *  rules are seeded with FALSE. */
  is_overridable  BOOLEAN NOT NULL DEFAULT TRUE,
  review_status   TEXT NOT NULL DEFAULT 'active'
                    CHECK (review_status IN ('active','draft','superseded','retired')),
  tags            TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Functional uniqueness on (layer, industry, tenant_id, user_id, entity_kind,
-- slug, version) where COALESCE collapses NULLs into '' so duplicate rules at
-- the same scope cannot exist. Postgres requires this as a CREATE UNIQUE INDEX
-- rather than an in-table UNIQUE (...) constraint because the expression list
-- contains function calls.
CREATE UNIQUE INDEX IF NOT EXISTS uq_clr_scope_kind_slug
  ON projections.constitutional_layer_rules (
    layer,
    COALESCE(industry, ''),
    COALESCE(tenant_id::TEXT, ''),
    COALESCE(user_id::TEXT, ''),
    entity_kind,
    slug,
    version
  );
CREATE INDEX IF NOT EXISTS idx_clr_layer_industry ON projections.constitutional_layer_rules(layer, industry);
CREATE INDEX IF NOT EXISTS idx_clr_tenant         ON projections.constitutional_layer_rules(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clr_user           ON projections.constitutional_layer_rules(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clr_kind           ON projections.constitutional_layer_rules(entity_kind, review_status);

-- ============================================================================
-- 3. projections.organization_policies — approved / prohibited / escalation
-- ============================================================================
CREATE TABLE IF NOT EXISTS projections.organization_policies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  /** Free-form policy identifier; unique per tenant. */
  policy_key      TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  /** Categories the policy applies to (e.g. 'recommendation.optimizer'). */
  applies_to      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  /** Match pattern run against the recommendation subject text or kind. */
  match_pattern   TEXT,
  outcome         TEXT NOT NULL CHECK (projections.is_policy_outcome(outcome)),
  /** Where to escalate when outcome='escalate' (Slack / email / role). */
  escalation_to   TEXT,
  /** Free-text compliance requirement when outcome='requires_compliance_review'. */
  compliance_note TEXT,
  /** Priority; lower numbers are evaluated first. */
  priority        INT NOT NULL DEFAULT 100,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, policy_key)
);
CREATE INDEX IF NOT EXISTS idx_op_tenant_active ON projections.organization_policies(tenant_id, active);
CREATE INDEX IF NOT EXISTS idx_op_outcome       ON projections.organization_policies(outcome);

-- ============================================================================
-- 4. projections.industry_templates — seeded baseline per vertical
-- ============================================================================
-- A template is a NAMED COLLECTION of rules that a tenant can clone into
-- their `constitutional_layer_rules` at layer='organization'. The
-- `industry_templates` table lists the canonical templates; the rules
-- themselves live as layer='industry' rows in constitutional_layer_rules
-- (so they automatically apply to every tenant in that industry without
-- requiring a copy).
CREATE TABLE IF NOT EXISTS projections.industry_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry        TEXT NOT NULL UNIQUE CHECK (projections.is_industry(industry)),
  display_name    TEXT NOT NULL,
  description     TEXT,
  /** Number of rules currently seeded into the industry layer for this vertical. */
  rule_count      INT NOT NULL DEFAULT 0,
  /** Regulatory references (e.g. 'SEC Rule 17a-4', 'HIPAA 45 CFR 164.312').
      `references` is a reserved Postgres keyword (used by FOREIGN KEY ...
      REFERENCES) so the column name is double-quoted everywhere. */
  "references"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status          TEXT NOT NULL DEFAULT 'active' CHECK (projections.is_projection_status(status)),
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the 6 named industries.
INSERT INTO projections.industry_templates (industry, display_name, description, "references") VALUES
  ('financial_services','Financial Services',  'SEC / FINRA / state-RIA aligned advisory + fiduciary rules', ARRAY['SEC IA-2204','FINRA 2210','Reg BI']),
  ('healthcare',        'Healthcare',          'HIPAA + clinical-safety + scope-of-practice rules',          ARRAY['HIPAA Privacy Rule','HIPAA Security Rule','HHS guidance']),
  ('payroll',           'Payroll',             'Wage-and-hour + tax-withholding + DOL guidance',             ARRAY['FLSA','IRS Pub 15','DOL Wage and Hour']),
  ('education',         'Education',           'FERPA + COPPA + Title IX + accessibility',                   ARRAY['FERPA','COPPA','Title IX','Section 504']),
  ('government',        'Government',          'Public-records + procurement + records-retention',           ARRAY['NIST SP 800-53','FedRAMP Moderate','State records laws']),
  ('energy',            'Energy',              'NERC CIP + DOE guidance + utility-tariff rules',              ARRAY['NERC CIP-002 through CIP-014','DOE guidance'])
ON CONFLICT (industry) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      description  = EXCLUDED.description,
      "references" = EXCLUDED."references",
      updated_at   = NOW();

-- ============================================================================
-- 5. projections.policy_decisions — every policy evaluation, audited
-- ============================================================================
CREATE TABLE IF NOT EXISTS projections.policy_decisions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  user_id         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  /** Subject under evaluation (recommendation_id, simulation_id, etc.). */
  subject_kind    TEXT NOT NULL,
  subject_id      TEXT,
  governance_audit_id UUID,
  /** Which policy fired; null when no policy matched. */
  policy_key      TEXT,
  outcome         TEXT NOT NULL CHECK (projections.is_policy_outcome(outcome) OR outcome = 'allow'),
  reason          TEXT,
  escalated_to    TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pd_tenant_time ON projections.policy_decisions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pd_outcome     ON projections.policy_decisions(outcome) WHERE outcome IN ('prohibited','escalate');

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE projections.enterprise_projections     ENABLE ROW LEVEL SECURITY;
ALTER TABLE projections.constitutional_layer_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE projections.organization_policies      ENABLE ROW LEVEL SECURITY;
ALTER TABLE projections.industry_templates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE projections.policy_decisions           ENABLE ROW LEVEL SECURITY;

-- Tenant-member read for the per-tenant tables, plus global/industry rules
-- visible to authenticated users (so the retrieval cache can pre-fetch).
DROP POLICY IF EXISTS ep_member ON projections.enterprise_projections;
CREATE POLICY ep_member ON projections.enterprise_projections
  FOR SELECT USING (platform.is_tenant_member(tenant_id, auth.uid(), 'viewer'));
DROP POLICY IF EXISTS ep_service ON projections.enterprise_projections;
CREATE POLICY ep_service ON projections.enterprise_projections
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS clr_global ON projections.constitutional_layer_rules;
CREATE POLICY clr_global ON projections.constitutional_layer_rules
  FOR SELECT USING (layer = 'global');
DROP POLICY IF EXISTS clr_industry ON projections.constitutional_layer_rules;
CREATE POLICY clr_industry ON projections.constitutional_layer_rules
  FOR SELECT USING (layer = 'industry');
DROP POLICY IF EXISTS clr_org ON projections.constitutional_layer_rules;
CREATE POLICY clr_org ON projections.constitutional_layer_rules
  FOR SELECT USING (
    layer IN ('organization','user')
    AND tenant_id IS NOT NULL
    AND platform.is_tenant_member(tenant_id, auth.uid(), 'viewer')
  );
DROP POLICY IF EXISTS clr_service ON projections.constitutional_layer_rules;
CREATE POLICY clr_service ON projections.constitutional_layer_rules
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS op_member ON projections.organization_policies;
CREATE POLICY op_member ON projections.organization_policies
  FOR SELECT USING (platform.is_tenant_member(tenant_id, auth.uid(), 'viewer'));
DROP POLICY IF EXISTS op_service ON projections.organization_policies;
CREATE POLICY op_service ON projections.organization_policies
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Industry templates are world-readable.
DROP POLICY IF EXISTS it_public ON projections.industry_templates;
CREATE POLICY it_public ON projections.industry_templates FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS it_service ON projections.industry_templates;
CREATE POLICY it_service ON projections.industry_templates
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS pd_member ON projections.policy_decisions;
CREATE POLICY pd_member ON projections.policy_decisions
  FOR SELECT USING (platform.is_tenant_member(tenant_id, auth.uid(), 'admin'));
DROP POLICY IF EXISTS pd_service ON projections.policy_decisions;
CREATE POLICY pd_service ON projections.policy_decisions
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

GRANT SELECT ON projections.enterprise_projections     TO authenticated;
GRANT SELECT ON projections.constitutional_layer_rules TO authenticated;
GRANT SELECT ON projections.organization_policies      TO authenticated;
GRANT SELECT ON projections.industry_templates         TO authenticated;
GRANT SELECT ON projections.policy_decisions           TO authenticated;

-- Public views.
CREATE OR REPLACE VIEW public.projections_enterprise_projections AS
  SELECT * FROM projections.enterprise_projections;
CREATE OR REPLACE VIEW public.projections_constitutional_layer_rules AS
  SELECT * FROM projections.constitutional_layer_rules;
CREATE OR REPLACE VIEW public.projections_organization_policies AS
  SELECT * FROM projections.organization_policies;
CREATE OR REPLACE VIEW public.projections_industry_templates AS
  SELECT * FROM projections.industry_templates;
CREATE OR REPLACE VIEW public.projections_policy_decisions AS
  SELECT * FROM projections.policy_decisions;

GRANT SELECT ON public.projections_enterprise_projections     TO authenticated;
GRANT SELECT ON public.projections_constitutional_layer_rules TO authenticated;
GRANT SELECT ON public.projections_organization_policies      TO authenticated;
GRANT SELECT ON public.projections_industry_templates         TO authenticated;
GRANT SELECT ON public.projections_policy_decisions           TO authenticated;

-- ============================================================================
-- Seed: a sample of industry-layer rules. Production deployments add more
-- per their regulator + counsel review. Each row has is_overridable=FALSE
-- where safety / lawfulness is at stake.
-- ============================================================================

INSERT INTO projections.constitutional_layer_rules
  (layer, industry, entity_kind, slug, name, body, source, citation_reference, version, is_overridable, review_status, tags)
VALUES
  -- Financial Services
  ('industry','financial_services','GovernanceRule','sec_fiduciary',
    'Fiduciary Standard',
    'When the user is in an advisory relationship, recommendations must serve the user''s best interest; partner-economics may not bias the recommendation.',
    'SEC IA-2204','SEC Interpretation Reg BI','1.0.0', FALSE, 'active', ARRAY['fiduciary','financial']),
  ('industry','financial_services','GovernanceRule','finra_2210_balance',
    'Balanced Communication',
    'Marketing-style language must include balanced presentation of benefits and risks; no promises of outcome.',
    'FINRA 2210','FINRA Rule 2210','1.0.0', FALSE, 'active', ARRAY['communication','financial']),
  ('industry','financial_services','SafetyRule','no_unregistered_advice',
    'No Unregistered Investment Advice',
    'The platform does not give personalized investment recommendations on specific securities without an SEC/state registration in place.',
    'SEC IA-1940','Investment Advisers Act','1.0.0', FALSE, 'active', ARRAY['safety','financial']),
  -- Healthcare
  ('industry','healthcare','SafetyRule','hipaa_minimum_necessary',
    'HIPAA Minimum Necessary',
    'Only the minimum PHI necessary may be processed for the task at hand; broad PHI access is prohibited.',
    'HIPAA Privacy Rule','45 CFR 164.502(b)','1.0.0', FALSE, 'active', ARRAY['privacy','healthcare','phi']),
  ('industry','healthcare','SafetyRule','no_clinical_diagnosis',
    'No Clinical Diagnosis',
    'The platform does not diagnose conditions or replace clinician judgement; it surfaces information and refers to qualified clinicians.',
    'HHS guidance','Scope-of-practice','1.0.0', FALSE, 'active', ARRAY['safety','healthcare']),
  -- Payroll
  ('industry','payroll','GovernanceRule','wage_and_hour',
    'Wage and Hour Compliance',
    'Recommendations affecting compensation must surface FLSA implications; overtime, classification, and pay-period rules are mandatory considerations.',
    'FLSA','Fair Labor Standards Act','1.0.0', FALSE, 'active', ARRAY['compliance','payroll']),
  ('industry','payroll','GovernanceRule','tax_withholding',
    'Tax Withholding Disclosure',
    'Payroll changes must surface federal + state withholding consequences; recommendations are not tax advice.',
    'IRS Pub 15','Employer Tax Guide','1.0.0', FALSE, 'active', ARRAY['compliance','payroll','tax']),
  -- Education
  ('industry','education','SafetyRule','ferpa_education_records',
    'FERPA Education Records',
    'Personally identifiable education records are restricted to authorized recipients; minor records add COPPA / Title IX considerations.',
    'FERPA','20 USC 1232g','1.0.0', FALSE, 'active', ARRAY['privacy','education']),
  ('industry','education','GovernanceRule','coppa_minors',
    'COPPA Minor Protections',
    'For users under 13, recommendations and data flows follow COPPA parental-consent + data-minimization requirements.',
    'COPPA','15 USC 6501','1.0.0', FALSE, 'active', ARRAY['privacy','minors','education']),
  -- Government
  ('industry','government','GovernanceRule','public_records',
    'Public Records Compliance',
    'Recommendations must consider applicable public-records and FOIA implications; sensitive deliberation records must be marked.',
    'State records laws','various','1.0.0', FALSE, 'active', ARRAY['records','government']),
  ('industry','government','GovernanceRule','nist_baselines',
    'NIST Control Baseline',
    'Government deployments default to NIST SP 800-53 Moderate baseline controls; deviations must be documented.',
    'NIST SP 800-53','Moderate baseline','1.0.0', FALSE, 'active', ARRAY['security','government']),
  -- Energy
  ('industry','energy','SafetyRule','nerc_cip_critical',
    'NERC CIP Critical Asset Protection',
    'Recommendations affecting bulk-electric-system operations must respect NERC CIP categorization; changes to BES Cyber Systems follow CIP-007 / CIP-010.',
    'NERC CIP','CIP-002 through CIP-014','1.0.0', FALSE, 'active', ARRAY['safety','energy','critical']),
  ('industry','energy','GovernanceRule','tariff_compliance',
    'Tariff Compliance',
    'Recommendations to utility customers must remain consistent with the applicable filed tariff; cross-tariff arbitrage is prohibited.',
    'FERC + state PUC','tariffs','1.0.0', FALSE, 'active', ARRAY['compliance','energy'])
ON CONFLICT (layer, COALESCE(industry, ''), COALESCE(tenant_id::TEXT, ''), COALESCE(user_id::TEXT, ''), entity_kind, slug, version) DO UPDATE
  SET name = EXCLUDED.name,
      body = EXCLUDED.body,
      source = EXCLUDED.source,
      citation_reference = EXCLUDED.citation_reference,
      review_status = EXCLUDED.review_status,
      is_overridable = EXCLUDED.is_overridable,
      tags = EXCLUDED.tags,
      updated_at = NOW();

-- Update rule_count on the templates.
UPDATE projections.industry_templates t
   SET rule_count = (
     SELECT COUNT(*) FROM projections.constitutional_layer_rules
      WHERE layer = 'industry' AND industry = t.industry AND review_status = 'active'
   ),
       updated_at = NOW();

-- ============================================================================
-- Self-test
-- ============================================================================
DO $$
DECLARE
  expected TEXT[] := ARRAY[
    'enterprise_projections','constitutional_layer_rules',
    'organization_policies','industry_templates','policy_decisions'
  ];
  t TEXT;
  n INT;
BEGIN
  FOREACH t IN ARRAY expected LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
      WHERE ns.nspname='projections' AND c.relname=t AND c.relkind='r'
    ) THEN
      RAISE EXCEPTION '104 self-test: projections.% missing', t;
    END IF;
  END LOOP;
  SELECT COUNT(*) INTO n FROM projections.industry_templates WHERE status = 'active';
  IF n < 6 THEN
    RAISE EXCEPTION '104 self-test: expected 6 industry templates, found %', n;
  END IF;
  SELECT COUNT(*) INTO n FROM projections.constitutional_layer_rules
   WHERE layer = 'industry' AND review_status = 'active';
  IF n < 12 THEN
    RAISE EXCEPTION '104 self-test: expected ≥ 12 seeded industry rules, found %', n;
  END IF;
END $$;
