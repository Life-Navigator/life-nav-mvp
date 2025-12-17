-- =============================================================================
-- Migration 003: Enable Row-Level Security (RLS) - Multi-tenant Isolation
-- =============================================================================
-- Description: Enables RLS on all domain tables and creates policies for
--              HIPAA-compliant tenant isolation
-- Prerequisites: 001_create_base_schema.sql, 002_create_domain_tables.sql
-- Security: Ensures users can only access data from their authorized tenant
-- =============================================================================

-- =============================================================================
-- CORE TABLES RLS
-- =============================================================================

-- Organizations (only service accounts and org owners can see)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_service_account_policy ON organizations
    FOR ALL
    TO service_account
    USING (true);

CREATE POLICY org_owner_policy ON organizations
    FOR SELECT
    TO authenticated
    USING (
        id IN (
            SELECT DISTINCT t.organization_id
            FROM tenants t
            JOIN user_tenants ut ON ut.tenant_id = t.id
            WHERE ut.user_id = current_setting('app.current_user_id')::UUID
                AND ut.role = 'owner'
        )
    );

-- Tenants (users can see tenants they belong to)
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_service_account_policy ON tenants
    FOR ALL
    TO service_account
    USING (true);

CREATE POLICY tenant_member_policy ON tenants
    FOR SELECT
    TO authenticated
    USING (
        id IN (
            SELECT tenant_id
            FROM user_tenants
            WHERE user_id = current_setting('app.current_user_id')::UUID
        )
    );

-- Users (users can see themselves and members of their tenants)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_service_account_policy ON users
    FOR ALL
    TO service_account
    USING (true);

CREATE POLICY user_self_policy ON users
    FOR ALL
    TO authenticated
    USING (id = current_setting('app.current_user_id')::UUID);

CREATE POLICY user_tenant_members_policy ON users
    FOR SELECT
    TO authenticated
    USING (
        id IN (
            SELECT DISTINCT ut2.user_id
            FROM user_tenants ut1
            JOIN user_tenants ut2 ON ut1.tenant_id = ut2.tenant_id
            WHERE ut1.user_id = current_setting('app.current_user_id')::UUID
        )
    );

-- User-Tenant memberships
ALTER TABLE user_tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_tenants_service_account_policy ON user_tenants
    FOR ALL
    TO service_account
    USING (true);

CREATE POLICY user_tenants_self_policy ON user_tenants
    FOR ALL
    TO authenticated
    USING (user_id = current_setting('app.current_user_id')::UUID);

CREATE POLICY user_tenants_admin_policy ON user_tenants
    FOR ALL
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id
            FROM user_tenants
            WHERE user_id = current_setting('app.current_user_id')::UUID
                AND role IN ('owner', 'admin')
        )
    );

-- Audit Logs (read-only for authenticated users within tenant)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_logs_service_account_policy ON audit_logs
    FOR ALL
    TO service_account
    USING (true);

CREATE POLICY audit_logs_tenant_read_policy ON audit_logs
    FOR SELECT
    TO authenticated
    USING (tenant_id = current_tenant_id());

CREATE POLICY audit_logs_insert_policy ON audit_logs
    FOR INSERT
    TO authenticated, service_account
    WITH CHECK (true);

-- =============================================================================
-- FINANCE DOMAIN RLS
-- =============================================================================

-- Financial Accounts
ALTER TABLE financial_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY financial_accounts_service_account_policy ON financial_accounts
    FOR ALL
    TO service_account
    USING (true);

CREATE POLICY financial_accounts_tenant_isolation ON financial_accounts
    FOR ALL
    TO authenticated
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY financial_accounts_owner_policy ON financial_accounts
    FOR ALL
    TO authenticated
    USING (
        user_id = current_setting('app.current_user_id')::UUID
        AND tenant_id = current_tenant_id()
    );

-- Transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY transactions_service_account_policy ON transactions
    FOR ALL
    TO service_account
    USING (true);

CREATE POLICY transactions_tenant_isolation ON transactions
    FOR ALL
    TO authenticated
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY transactions_owner_policy ON transactions
    FOR ALL
    TO authenticated
    USING (
        user_id = current_setting('app.current_user_id')::UUID
        AND tenant_id = current_tenant_id()
    );

-- Budgets
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY budgets_service_account_policy ON budgets
    FOR ALL
    TO service_account
    USING (true);

CREATE POLICY budgets_tenant_isolation ON budgets
    FOR ALL
    TO authenticated
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY budgets_owner_policy ON budgets
    FOR ALL
    TO authenticated
    USING (
        user_id = current_setting('app.current_user_id')::UUID
        AND tenant_id = current_tenant_id()
    );

-- =============================================================================
-- CAREER DOMAIN RLS
-- =============================================================================

-- Career Profiles
ALTER TABLE career_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY career_profiles_service_account_policy ON career_profiles
    FOR ALL
    TO service_account
    USING (true);

CREATE POLICY career_profiles_tenant_isolation ON career_profiles
    FOR ALL
    TO authenticated
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY career_profiles_owner_policy ON career_profiles
    FOR ALL
    TO authenticated
    USING (
        user_id = current_setting('app.current_user_id')::UUID
        AND tenant_id = current_tenant_id()
    );

-- Job Applications
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY job_applications_service_account_policy ON job_applications
    FOR ALL
    TO service_account
    USING (true);

CREATE POLICY job_applications_tenant_isolation ON job_applications
    FOR ALL
    TO authenticated
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY job_applications_owner_policy ON job_applications
    FOR ALL
    TO authenticated
    USING (
        user_id = current_setting('app.current_user_id')::UUID
        AND tenant_id = current_tenant_id()
    );

-- Interviews
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY interviews_service_account_policy ON interviews
    FOR ALL
    TO service_account
    USING (true);

CREATE POLICY interviews_tenant_isolation ON interviews
    FOR ALL
    TO authenticated
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY interviews_owner_policy ON interviews
    FOR ALL
    TO authenticated
    USING (
        user_id = current_setting('app.current_user_id')::UUID
        AND tenant_id = current_tenant_id()
    );

-- =============================================================================
-- EDUCATION DOMAIN RLS
-- =============================================================================

-- Education Credentials
ALTER TABLE education_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY education_credentials_service_account_policy ON education_credentials
    FOR ALL
    TO service_account
    USING (true);

CREATE POLICY education_credentials_tenant_isolation ON education_credentials
    FOR ALL
    TO authenticated
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY education_credentials_owner_policy ON education_credentials
    FOR ALL
    TO authenticated
    USING (
        user_id = current_setting('app.current_user_id')::UUID
        AND tenant_id = current_tenant_id()
    );

-- Courses
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY courses_service_account_policy ON courses
    FOR ALL
    TO service_account
    USING (true);

CREATE POLICY courses_tenant_isolation ON courses
    FOR ALL
    TO authenticated
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY courses_owner_policy ON courses
    FOR ALL
    TO authenticated
    USING (
        user_id = current_setting('app.current_user_id')::UUID
        AND tenant_id = current_tenant_id()
    );

-- =============================================================================
-- GOALS DOMAIN RLS
-- =============================================================================

-- Goals
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY goals_service_account_policy ON goals
    FOR ALL
    TO service_account
    USING (true);

CREATE POLICY goals_tenant_isolation ON goals
    FOR ALL
    TO authenticated
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY goals_owner_policy ON goals
    FOR ALL
    TO authenticated
    USING (
        user_id = current_setting('app.current_user_id')::UUID
        AND tenant_id = current_tenant_id()
    );

-- Milestones
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY milestones_service_account_policy ON milestones
    FOR ALL
    TO service_account
    USING (true);

CREATE POLICY milestones_tenant_isolation ON milestones
    FOR ALL
    TO authenticated
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY milestones_owner_policy ON milestones
    FOR ALL
    TO authenticated
    USING (
        user_id = current_setting('app.current_user_id')::UUID
        AND tenant_id = current_tenant_id()
    );

-- =============================================================================
-- HEALTH DOMAIN RLS (Extra strict - HIPAA compliance)
-- =============================================================================

-- Health Conditions
ALTER TABLE health_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY health_conditions_service_account_policy ON health_conditions
    FOR ALL
    TO service_account
    USING (true);

CREATE POLICY health_conditions_tenant_isolation ON health_conditions
    FOR ALL
    TO authenticated
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- HIPAA: Only the data owner can access their own health data
CREATE POLICY health_conditions_owner_only_policy ON health_conditions
    FOR ALL
    TO authenticated
    USING (
        user_id = current_setting('app.current_user_id')::UUID
        AND tenant_id = current_tenant_id()
    );

-- Medications
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY medications_service_account_policy ON medications
    FOR ALL
    TO service_account
    USING (true);

CREATE POLICY medications_tenant_isolation ON medications
    FOR ALL
    TO authenticated
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- HIPAA: Only the data owner can access their own medication data
CREATE POLICY medications_owner_only_policy ON medications
    FOR ALL
    TO authenticated
    USING (
        user_id = current_setting('app.current_user_id')::UUID
        AND tenant_id = current_tenant_id()
    );

-- =============================================================================
-- RELATIONSHIPS DOMAIN RLS
-- =============================================================================

-- Contacts
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY contacts_service_account_policy ON contacts
    FOR ALL
    TO service_account
    USING (true);

CREATE POLICY contacts_tenant_isolation ON contacts
    FOR ALL
    TO authenticated
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY contacts_owner_policy ON contacts
    FOR ALL
    TO authenticated
    USING (
        user_id = current_setting('app.current_user_id')::UUID
        AND tenant_id = current_tenant_id()
    );

-- Contact Interactions
ALTER TABLE contact_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY contact_interactions_service_account_policy ON contact_interactions
    FOR ALL
    TO service_account
    USING (true);

CREATE POLICY contact_interactions_tenant_isolation ON contact_interactions
    FOR ALL
    TO authenticated
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY contact_interactions_owner_policy ON contact_interactions
    FOR ALL
    TO authenticated
    USING (
        user_id = current_setting('app.current_user_id')::UUID
        AND tenant_id = current_tenant_id()
    );

-- =============================================================================
-- RLS Helper Functions
-- =============================================================================

-- Function to set session context (called by app before queries)
CREATE OR REPLACE FUNCTION set_session_context(
    p_user_id UUID,
    p_tenant_id UUID
)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_user_id', p_user_id::text, false);
    PERFORM set_config('app.current_tenant_id', p_tenant_id::text, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clear session context (for security)
CREATE OR REPLACE FUNCTION clear_session_context()
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_user_id', '', false);
    PERFORM set_config('app.current_tenant_id', '', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate tenant access (throws error if unauthorized)
CREATE OR REPLACE FUNCTION validate_tenant_access(p_tenant_id UUID)
RETURNS boolean AS $$
DECLARE
    has_access boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM user_tenants
        WHERE user_id = current_setting('app.current_user_id')::UUID
            AND tenant_id = p_tenant_id
            AND status = 'active'
    ) INTO has_access;

    IF NOT has_access THEN
        RAISE EXCEPTION 'Access denied: User does not have access to tenant %', p_tenant_id;
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION set_session_context TO authenticated, service_account;
GRANT EXECUTE ON FUNCTION clear_session_context TO authenticated, service_account;
GRANT EXECUTE ON FUNCTION validate_tenant_access TO authenticated, service_account;

-- =============================================================================
-- RLS Audit Trigger (Log all RLS policy violations)
-- =============================================================================

CREATE TABLE IF NOT EXISTS rls_violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    operation VARCHAR(10) NOT NULL,
    attempted_user_id UUID,
    attempted_tenant_id UUID,
    target_tenant_id UUID,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rls_violations_user ON rls_violations(attempted_user_id, created_at DESC);
CREATE INDEX idx_rls_violations_table ON rls_violations(table_name, created_at DESC);

-- Function to log RLS violation attempts (called by application)
CREATE OR REPLACE FUNCTION log_rls_violation(
    p_table_name VARCHAR(100),
    p_operation VARCHAR(10),
    p_target_tenant_id UUID,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    INSERT INTO rls_violations (
        table_name,
        operation,
        attempted_user_id,
        attempted_tenant_id,
        target_tenant_id,
        ip_address,
        user_agent
    ) VALUES (
        p_table_name,
        p_operation,
        current_setting('app.current_user_id', true)::UUID,
        current_setting('app.current_tenant_id', true)::UUID,
        p_target_tenant_id,
        p_ip_address,
        p_user_agent
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION log_rls_violation TO authenticated, service_account;

-- =============================================================================
-- Performance Monitoring for RLS
-- =============================================================================

-- View to monitor RLS policy performance
CREATE OR REPLACE VIEW rls_policy_stats AS
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Grant view access to service accounts for monitoring
GRANT SELECT ON rls_policy_stats TO service_account;

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON FUNCTION set_session_context IS 'Sets user and tenant context for RLS enforcement (call at start of each request)';
COMMENT ON FUNCTION clear_session_context IS 'Clears session context for security (call at end of each request)';
COMMENT ON FUNCTION validate_tenant_access IS 'Validates user has access to tenant, throws exception if not';
COMMENT ON FUNCTION log_rls_violation IS 'Logs attempted RLS policy violations for security monitoring';

COMMENT ON TABLE rls_violations IS 'Audit log for RLS policy violation attempts (security monitoring)';
COMMENT ON VIEW rls_policy_stats IS 'Monitor all RLS policies across database tables';

-- =============================================================================
-- RLS Testing Queries (for DBA/Developer reference)
-- =============================================================================

-- Test RLS enforcement
-- SET app.current_user_id = 'user-uuid-here';
-- SET app.current_tenant_id = 'tenant-uuid-here';
-- SELECT * FROM goals;  -- Should only return goals for current tenant
-- RESET app.current_user_id;
-- RESET app.current_tenant_id;

-- Check all policies on a table
-- SELECT * FROM pg_policies WHERE tablename = 'goals';

-- Verify RLS is enabled on all tables
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
