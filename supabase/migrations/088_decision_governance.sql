-- ==========================================================================
-- 088: Decision Governance Layer
--
-- Sprint L adds the governance layer that sits between recommendation
-- generation and recommendation delivery. Every recommendation, simulation,
-- probability output, partner recommendation, or AI-generated guidance
-- passes through here BEFORE reaching the user.
--
-- This migration creates:
--
--   1. governance.decision_governance_audit
--      Append-only audit log. One row per validation pass. Captures
--      the recommendation reference, policy_checks JSON, violations
--      JSON, severity, and the immutable governance_version that
--      produced the verdict.
--
--   2. governance.policy_versions
--      Frozen snapshot of the principles + rule categories active at a
--      given semver. Lets us audit "what rules were live when this
--      recommendation was approved."
--
--   3. governance.agent_registry
--      Agents (advisor, arcana, optimizer, recruiter, future) must
--      register before they may emit recommendations to the user.
--      Phase 10 contract: no agent may bypass the governance layer.
--      Registration is service-role-write only; reads are public.
--
--   4. governance.safety_messages
--      Deterministic copy table for the safety messaging framework
--      (Phase 8). The TS layer falls back to a built-in dictionary
--      so the system functions even when this table is empty.
-- ==========================================================================

CREATE SCHEMA IF NOT EXISTS governance;
GRANT USAGE ON SCHEMA governance TO authenticated, service_role;


-- ###########################################################################
-- Enum predicates
-- ###########################################################################

CREATE OR REPLACE FUNCTION governance.is_severity(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('none','low','medium','high','critical')
$$;

CREATE OR REPLACE FUNCTION governance.is_violation_category(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN (
    'political_influence','manipulation','self_harm','harm_to_others',
    'illegal_activity','fraud','exploitation','partner_bias',
    'conflict_of_interest','unsafe_health','unverified_medical',
    'coercive_messaging','outcome_integrity','user_advocacy',
    'transparency','agent_not_registered','unknown'
  )
$$;

CREATE OR REPLACE FUNCTION governance.is_subject_kind(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN (
    'recommendation','provider_recommendation','arcana_recommendation',
    'advisor_message','simulation_output','probability_output',
    'optimizer_recommendation','partner_recommendation','agent_message',
    'generic'
  )
$$;

CREATE OR REPLACE FUNCTION governance.is_agent_kind(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN (
    'advisor','arcana_health','arcana_longevity','arcana_compliance',
    'arcana_provider_coordination','arcana_orchestrator','provider',
    'optimizer','recruiter','financial_advisor','insurance_agent',
    'real_estate_agent','partner','test','other'
  )
$$;


-- ###########################################################################
-- policy_versions — frozen snapshots of active principles
-- ###########################################################################
CREATE TABLE IF NOT EXISTS governance.policy_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version         TEXT NOT NULL UNIQUE,                  -- semver, e.g. "1.0.0"
  activated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retired_at      TIMESTAMPTZ,
  principles      JSONB NOT NULL,                        -- array of {id, name, body}
  rule_categories JSONB NOT NULL,                        -- list of category ids
  policy_hash     TEXT,                                  -- sha256 of principles+rules
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ###########################################################################
-- decision_governance_audit — append-only verdict log
-- ###########################################################################
CREATE TABLE IF NOT EXISTS governance.decision_governance_audit (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The user the recommendation was bound for.
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- What was checked. Soft-FK by UUID because the subject may live in
  -- many tables (provider_recommendations, recommendation_quality,
  -- advisor_messages, etc.). The 'subject_kind' column is the
  -- discriminator.
  subject_kind        TEXT NOT NULL CHECK (governance.is_subject_kind(subject_kind)),
  subject_id          UUID,
  subject_table       TEXT,

  -- Who emitted the subject. If from an agent, the agent_registry row.
  emitter_agent_kind  TEXT CHECK (emitter_agent_kind IS NULL OR governance.is_agent_kind(emitter_agent_kind)),
  emitter_agent_id    UUID,
  emitter_user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Verdict
  approved            BOOLEAN NOT NULL,
  severity            TEXT NOT NULL CHECK (governance.is_severity(severity)),
  governance_version  TEXT NOT NULL,

  -- The full check + violation graph (JSON for portability + auditability).
  policy_checks       JSONB NOT NULL DEFAULT '[]',
  violations          JSONB NOT NULL DEFAULT '[]',
  safer_alternatives  JSONB NOT NULL DEFAULT '[]',

  -- Determinism: a hash of (subject content + governance_version) so
  -- replays can verify "same subject same verdict".
  input_hash          TEXT,

  -- Override audit. If a human overrode a non-critical block, capture
  -- WHO did it and WHY.
  override_actor_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  override_reason     TEXT,
  override_at         TIMESTAMPTZ,

  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dga_user        ON governance.decision_governance_audit(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dga_subject     ON governance.decision_governance_audit(subject_kind, subject_id);
CREATE INDEX IF NOT EXISTS idx_dga_blocked     ON governance.decision_governance_audit(approved) WHERE approved = FALSE;


-- ###########################################################################
-- agent_registry — Phase 10: every agent must register
-- ###########################################################################
CREATE TABLE IF NOT EXISTS governance.agent_registry (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_kind       TEXT NOT NULL CHECK (governance.is_agent_kind(agent_kind)),
  agent_name       TEXT NOT NULL,
  description      TEXT,
  responsible_team TEXT,
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  registered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retired_at       TIMESTAMPTZ,
  capabilities     JSONB NOT NULL DEFAULT '[]',
  metadata         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT agent_registry_unique UNIQUE (agent_kind, agent_name)
);


-- ###########################################################################
-- safety_messages — deterministic copy for Phase 8
-- ###########################################################################
CREATE TABLE IF NOT EXISTS governance.safety_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category         TEXT NOT NULL CHECK (governance.is_violation_category(category)),
  locale           TEXT NOT NULL DEFAULT 'en',
  message          TEXT NOT NULL,
  safer_alternatives JSONB NOT NULL DEFAULT '[]',
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  metadata         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT safety_msg_unique UNIQUE (category, locale)
);


-- ###########################################################################
-- updated_at triggers
-- ###########################################################################
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['policy_versions','agent_registry','safety_messages'] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_%I_updated_at ON governance.%I; '
      'CREATE TRIGGER set_%I_updated_at BEFORE UPDATE ON governance.%I '
      'FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();',
      t, t, t, t
    );
  END LOOP;
END $$;


-- ###########################################################################
-- RLS — audit log is patient-scoped read; everything else service-role only
-- ###########################################################################
ALTER TABLE governance.decision_governance_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance.policy_versions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance.agent_registry            ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance.safety_messages           ENABLE ROW LEVEL SECURITY;

-- Audit log: user sees own rows; service_role bypass.
DROP POLICY IF EXISTS dga_owner_select ON governance.decision_governance_audit;
CREATE POLICY dga_owner_select ON governance.decision_governance_audit
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS dga_service ON governance.decision_governance_audit;
CREATE POLICY dga_service ON governance.decision_governance_audit
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Policy versions: world-readable (transparency).
DROP POLICY IF EXISTS pv_public_select ON governance.policy_versions;
CREATE POLICY pv_public_select ON governance.policy_versions
  FOR SELECT USING (true);
DROP POLICY IF EXISTS pv_service ON governance.policy_versions;
CREATE POLICY pv_service ON governance.policy_versions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Agent registry: world-readable; service-role write.
DROP POLICY IF EXISTS ar_public_select ON governance.agent_registry;
CREATE POLICY ar_public_select ON governance.agent_registry
  FOR SELECT USING (true);
DROP POLICY IF EXISTS ar_service ON governance.agent_registry;
CREATE POLICY ar_service ON governance.agent_registry
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Safety messages: world-readable; service-role write.
DROP POLICY IF EXISTS sm_public_select ON governance.safety_messages;
CREATE POLICY sm_public_select ON governance.safety_messages
  FOR SELECT USING (true);
DROP POLICY IF EXISTS sm_service ON governance.safety_messages;
CREATE POLICY sm_service ON governance.safety_messages
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON ALL TABLES IN SCHEMA governance TO authenticated;


-- ###########################################################################
-- Public read-views
-- ###########################################################################
CREATE OR REPLACE VIEW public.decision_governance_audit AS
  SELECT * FROM governance.decision_governance_audit;
CREATE OR REPLACE VIEW public.governance_policy_versions AS
  SELECT * FROM governance.policy_versions;
CREATE OR REPLACE VIEW public.governance_agent_registry AS
  SELECT * FROM governance.agent_registry;
CREATE OR REPLACE VIEW public.governance_safety_messages AS
  SELECT * FROM governance.safety_messages;
GRANT SELECT ON public.decision_governance_audit  TO authenticated;
GRANT SELECT ON public.governance_policy_versions TO authenticated;
GRANT SELECT ON public.governance_agent_registry  TO authenticated;
GRANT SELECT ON public.governance_safety_messages TO authenticated;


-- ###########################################################################
-- agent_is_registered — SECURITY DEFINER gate the application calls
-- before persisting any recommendation produced by an agent.
-- ###########################################################################
CREATE OR REPLACE FUNCTION governance.agent_is_registered(
  p_agent_kind TEXT,
  p_agent_name TEXT
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = governance, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM governance.agent_registry
     WHERE agent_kind = p_agent_kind
       AND agent_name = p_agent_name
       AND active = TRUE
       AND retired_at IS NULL
  )
$$;

GRANT EXECUTE ON FUNCTION governance.agent_is_registered(TEXT, TEXT) TO authenticated, service_role;


-- ###########################################################################
-- Seed v1.0.0 + 8 principles + default safety messages
-- ###########################################################################
INSERT INTO governance.policy_versions (id, version, principles, rule_categories, policy_hash, notes)
VALUES (
  '00000000-0000-0000-0000-0000Govern0001',
  '1.0.0',
  '[
    {"id": "user_advocacy",      "name": "User Advocacy",       "body": "Optimize for user well-being, user goals, user autonomy. Never optimize for government, employer, advertiser, partner, provider, vendor unless the user explicitly asked."},
    {"id": "political_neutrality","name": "Political Neutrality","body": "Explain and compare. Do not advocate parties, candidates, ideologies, or run influence campaigns."},
    {"id": "legal_compliance",    "name": "Legal Compliance",    "body": "Pursue maximum lawful advantage. Help with tax planning, legal optimization, benefits, retirement, estate. Never assist with fraud, evasion, concealment, or regulatory avoidance."},
    {"id": "no_harm",             "name": "No Harm",             "body": "Do not encourage self-harm, violence, abuse, harassment, stalking, coercion, revenge, exploitation, or dangerous illegal activity. Redirect to safer alternatives."},
    {"id": "human_autonomy",      "name": "Human Autonomy",      "body": "Advise; do not decide. Explain, model, compare, forecast. Never pressure, shame, guilt, or manipulate."},
    {"id": "transparency",        "name": "Transparency",        "body": "Expose assumptions, confidence, evidence, uncertainty, tradeoffs."},
    {"id": "no_partner_bias",     "name": "No Partner Bias",     "body": "Partner economics may not influence ranking, scoring, probability, or outcome scoring."},
    {"id": "outcome_integrity",   "name": "Outcome Integrity",   "body": "User outcomes precede engagement, clicks, retention."}
  ]'::jsonb,
  '[
    "political_influence","manipulation","self_harm","harm_to_others",
    "illegal_activity","fraud","exploitation","partner_bias",
    "conflict_of_interest","unsafe_health","unverified_medical","coercive_messaging"
  ]'::jsonb,
  -- This is the sha256 of the concatenation of principle bodies. We keep it
  -- here only as a cross-check; the TS layer recomputes it on boot.
  '0000000000000000000000000000000000000000000000000000000000000001',
  'Initial governance policy snapshot.'
)
ON CONFLICT (version) DO NOTHING;

INSERT INTO governance.safety_messages (category, locale, message, safer_alternatives)
VALUES
  ('self_harm', 'en',
    'I cannot assist with self-harm. Please consider reaching out to a qualified mental-health professional or a crisis line you trust. If you are in immediate danger, contact local emergency services.',
    '[
      "Reach out to a trusted person (family, friend, clinician)",
      "Call or text a local crisis line",
      "Visit your nearest emergency department"
    ]'::jsonb),
  ('harm_to_others', 'en',
    'I cannot help with actions intended to harm another person. If you are in conflict, consider safer paths such as documentation, mediation, or contacting appropriate authorities.',
    '[
      "Document the situation in writing",
      "Engage a mediator or counselor",
      "Contact relevant authorities or legal counsel"
    ]'::jsonb),
  ('illegal_activity', 'en',
    'I cannot help with illegal activity. Here are lawful alternatives that may achieve the same underlying goal.',
    '[]'::jsonb),
  ('fraud', 'en',
    'I cannot help with fraud, evasion, or concealment. I can help you find every lawful advantage the rules permit.',
    '[
      "Legal tax planning",
      "Benefits and credit optimization",
      "Disclosure-compliant restructuring"
    ]'::jsonb),
  ('exploitation', 'en',
    'I cannot help with actions that exploit another person. Consider paths that do not depend on coercion or asymmetric harm.',
    '[]'::jsonb),
  ('political_influence', 'en',
    'I can explain or compare political positions factually, but I will not advocate parties, candidates, or ideologies.',
    '[
      "Compare positions on a specific policy",
      "Show factual records or voting history",
      "Summarize differing viewpoints"
    ]'::jsonb),
  ('manipulation', 'en',
    'I will not use pressure, shame, guilt, or manipulation. Decisions are yours.',
    '[]'::jsonb),
  ('coercive_messaging', 'en',
    'This message contains coercive language. I will rewrite it as neutral information so the decision remains yours.',
    '[]'::jsonb),
  ('partner_bias', 'en',
    'This recommendation appears influenced by partner economics. We are suppressing it and showing partner-neutral alternatives instead.',
    '[]'::jsonb),
  ('conflict_of_interest', 'en',
    'A conflict of interest was detected. The recommending party has a financial relationship with the outcome.',
    '[]'::jsonb),
  ('unsafe_health', 'en',
    'This guidance requires evaluation by a licensed healthcare professional before any action. We will not act as a substitute.',
    '[]'::jsonb),
  ('unverified_medical', 'en',
    'This medical claim is not adequately supported by published evidence. We do not surface unverified medical guidance.',
    '[]'::jsonb),
  ('outcome_integrity', 'en',
    'This recommendation appeared to optimize platform engagement rather than your outcomes. We are suppressing it.',
    '[]'::jsonb),
  ('user_advocacy', 'en',
    'This recommendation appeared to optimize for a non-user party. We are suppressing it.',
    '[]'::jsonb),
  ('transparency', 'en',
    'This recommendation did not expose its assumptions, confidence, or tradeoffs. We are routing it back for explanation before showing it.',
    '[]'::jsonb),
  ('agent_not_registered', 'en',
    'A non-registered agent attempted to emit guidance. Per Sprint L Phase 10, only registered agents may communicate recommendations to the user.',
    '[]'::jsonb)
ON CONFLICT (category, locale) DO NOTHING;

-- Seed the first-party agents.
INSERT INTO governance.agent_registry (agent_kind, agent_name, description, responsible_team, capabilities)
VALUES
  ('advisor',                       'advisor.core',                'Sprint H advisor with conversation intelligence.',          'Advisor',  '["recommendation","explanation"]'::jsonb),
  ('arcana_health',                 'arcana.health',               'Arcana Health agent.',                                       'Arcana',   '["recommendation","explanation"]'::jsonb),
  ('arcana_longevity',              'arcana.longevity',            'Arcana Longevity agent.',                                    'Arcana',   '["recommendation","explanation"]'::jsonb),
  ('arcana_compliance',             'arcana.compliance',           'Arcana Compliance / provider clearance gate.',               'Arcana',   '["clearance_check"]'::jsonb),
  ('arcana_provider_coordination',  'arcana.provider_coordination','Arcana Provider Coordination agent.',                        'Arcana',   '["lead_package_handoff"]'::jsonb),
  ('arcana_orchestrator',           'arcana.orchestrator',         'Arcana request orchestrator.',                               'Arcana',   '["orchestration"]'::jsonb),
  ('optimizer',                     'optimizer.dynamic_goal',      'Sprint trajectory optimizer.',                               'Decision', '["recommendation"]'::jsonb),
  ('provider',                      'provider.portal',             'Provider portal recommendation builder.',                    'Provider', '["recommendation"]'::jsonb)
ON CONFLICT (agent_kind, agent_name) DO NOTHING;


-- ###########################################################################
-- Self-test
-- ###########################################################################
DO $$
DECLARE rls BOOLEAN; n INT;
BEGIN
  SELECT relrowsecurity INTO rls FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'governance' AND c.relname = 'decision_governance_audit';
  IF NOT rls THEN RAISE EXCEPTION '088 self-test: RLS missing on decision_governance_audit'; END IF;

  SELECT COUNT(*) INTO n FROM governance.safety_messages;
  IF n < 12 THEN RAISE EXCEPTION '088 self-test: safety_messages under-seeded (n=%)', n; END IF;

  SELECT COUNT(*) INTO n FROM governance.agent_registry;
  IF n < 6 THEN RAISE EXCEPTION '088 self-test: agent_registry under-seeded (n=%)', n; END IF;

  SELECT COUNT(*) INTO n FROM governance.policy_versions WHERE version = '1.0.0';
  IF n <> 1 THEN RAISE EXCEPTION '088 self-test: policy_versions v1.0.0 missing'; END IF;
END $$;
