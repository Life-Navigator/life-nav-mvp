-- Categorized advisor-response reporting (audit finding R-3).
--
-- WHY: the beta launch audit (4416211f) found five feedback surfaces — bug, nps, pilot,
-- recommendation, simulation — and none that lets a user report a SPECIFIC advisor response across
-- the categories a beta needs. That maps to automatic no-go condition #4: "problematic responses
-- cannot be reported". This table closes it.
--
-- DESIGN NOTES
--
-- 1. Evidence lives in analytics.advisor_turns, which already persists the question, the response,
--    prompt_version, validator outcome, retrieval metadata, confidence and citation source keys.
--    We reference turn_id rather than duplicating it. See §3 for the immutability caveat.
--
-- 2. advisor_turns has NO tenant_id column. Adding one is a separate data-contract decision and is
--    deliberately NOT made here. Tenancy in this platform resolves as `tenant_id = user_id`
--    (advisor_orchestrator.py:998 `tenant = ctx.tenant_id or ctx.user_id`; traversal.py binds
--    `{tenant_id: $user_id}`), so ownership is enforced by joining on the turn's user_id against the
--    authenticated caller. tenant_id is stored here resolved SERVER-SIDE, never from the browser.
--
-- 3. advisor_turns is service_role-only (RLS + FORCE RLS, single service policy) but is NOT provably
--    immutable — service_role holds ALL. So a report captures its own snapshot of the question and
--    response at report time. If the turn is later mutated, the report still means what the reporter
--    saw. This is the "preserve the minimum investigation snapshot" requirement.
--
-- 4. llm_response_raw is NEVER copied here. It is the closest thing the system has to raw model
--    output, and the no-chain-of-thought rule forbids persisting it into a report record.

CREATE SCHEMA IF NOT EXISTS feedback;

CREATE TABLE IF NOT EXISTS feedback.advisor_response_reports (
    report_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- ── what is being reported ──────────────────────────────────────────────
    turn_id            uuid NOT NULL,
    conversation_id    text,

    -- ── who (both resolved SERVER-SIDE from the verified JWT, never the body) ──
    user_id            uuid NOT NULL,
    tenant_id          uuid NOT NULL,

    -- ── the report ──────────────────────────────────────────────────────────
    category           text NOT NULL CHECK (category IN (
                           'wrong_or_unsupported',
                           'inappropriate_or_harmful',
                           'incorrect_or_irrelevant_citation',
                           'outdated_information',
                           'misunderstood_my_situation',
                           'privacy_concern',
                           'other')),
    explanation        text CHECK (explanation IS NULL OR length(explanation) <= 4000),
    created_at         timestamptz NOT NULL DEFAULT now(),

    -- ── investigation snapshot (see design note 3) ──────────────────────────
    question_snapshot  text,
    response_snapshot  text,

    -- ── execution metadata, resolved server-side. NULLABLE BY DESIGN: see the
    --    observability gap in docs/beta/RESPONSE_REPORT_IMPLEMENTATION.md.
    --    Fabricating these would be worse than recording their absence. ──────
    deployment_version text,
    model_provider     text,
    model_name         text,
    prompt_version     text,
    routing_result     jsonb,
    retrieval_channels jsonb,
    citation_refs      jsonb,
    policy_outcomes    jsonb,
    feature_flags      jsonb,

    -- ── triage ──────────────────────────────────────────────────────────────
    severity           text NOT NULL DEFAULT 'unclassified'
                       CHECK (severity IN ('unclassified','low','medium','high','critical')),
    review_status      text NOT NULL DEFAULT 'new'
                       CHECK (review_status IN ('new','investigating','resolved','dismissed','duplicate')),
    assigned_to        text,
    duplicate_of       uuid REFERENCES feedback.advisor_response_reports(report_id),
    resolution_notes   text,
    reviewed_at        timestamptz,
    resolved_at        timestamptz
);

CREATE INDEX IF NOT EXISTS advisor_response_reports_turn_idx
    ON feedback.advisor_response_reports (turn_id);
CREATE INDEX IF NOT EXISTS advisor_response_reports_user_idx
    ON feedback.advisor_response_reports (user_id, created_at DESC);
-- Repeated-failure detection by prompt / model / deployment (review-queue requirement).
CREATE INDEX IF NOT EXISTS advisor_response_reports_triage_idx
    ON feedback.advisor_response_reports (review_status, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS advisor_response_reports_release_idx
    ON feedback.advisor_response_reports (deployment_version, prompt_version, model_name);

-- Duplicate handling: one open report per (user, turn, category). A materially different category
-- is a different report, which is the behaviour the audit asked for.
CREATE UNIQUE INDEX IF NOT EXISTS advisor_response_reports_no_dupe_idx
    ON feedback.advisor_response_reports (user_id, turn_id, category)
    WHERE review_status IN ('new', 'investigating');

ALTER TABLE feedback.advisor_response_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback.advisor_response_reports FORCE ROW LEVEL SECURITY;

-- Service-role only, matching analytics.advisor_turns. The API resolves identity from the verified
-- JWT and writes through the service client; end users never touch this table directly, so there is
-- no authenticated-role policy to widen by mistake.
DROP POLICY IF EXISTS service_advisor_response_reports ON feedback.advisor_response_reports;
CREATE POLICY service_advisor_response_reports
    ON feedback.advisor_response_reports FOR ALL TO service_role
    USING (true) WITH CHECK (true);

GRANT USAGE ON SCHEMA feedback TO service_role;
GRANT ALL ON feedback.advisor_response_reports TO service_role;

COMMENT ON TABLE feedback.advisor_response_reports IS
    'User reports against a specific advisor response (audit finding R-3). References '
    'analytics.advisor_turns for evidence and carries its own question/response snapshot because '
    'that table is service_role-writable and therefore not provably immutable. Never stores '
    'llm_response_raw or any chain-of-thought.';
COMMENT ON COLUMN feedback.advisor_response_reports.tenant_id IS
    'Resolved server-side from the verified JWT (tenant_id = user_id in this platform). NEVER '
    'accepted from the client.';
