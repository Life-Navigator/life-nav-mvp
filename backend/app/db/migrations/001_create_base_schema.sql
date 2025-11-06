-- =============================================================================
-- Migration 001: Create Base Schema - Multi-tenant Foundation
-- =============================================================================
-- Description: Creates core tables for multi-tenant architecture with
--              organizations, tenants, users, and authentication
-- Prerequisites: PostgreSQL 15+ with UUID support
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- Core Multi-tenancy Tables
-- =============================================================================

-- Organizations (top-level entity for B2B SaaS)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    website VARCHAR(255),
    industry VARCHAR(100),
    company_size VARCHAR(50),  -- small, medium, large, enterprise
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'churned')),

    -- Subscription & billing
    subscription_tier VARCHAR(50) DEFAULT 'free' CHECK (subscription_tier IN ('free', 'basic', 'pro', 'enterprise')),
    subscription_status VARCHAR(50) DEFAULT 'active',
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    subscription_ends_at TIMESTAMP WITH TIME ZONE,

    -- Metadata
    settings JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_status ON organizations(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_organizations_subscription ON organizations(subscription_tier, subscription_status);

-- Tenants (workspaces within organizations - enables B2B2C model)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    type VARCHAR(50) DEFAULT 'workspace' CHECK (type IN ('workspace', 'team', 'department')),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),

    -- HIPAA compliance settings
    hipaa_enabled BOOLEAN DEFAULT true,
    encryption_at_rest BOOLEAN DEFAULT true,
    audit_log_enabled BOOLEAN DEFAULT true,
    data_retention_days INTEGER DEFAULT 2555,  -- 7 years for HIPAA

    -- Metadata
    settings JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,

    UNIQUE (organization_id, slug)
);

CREATE INDEX idx_tenants_organization ON tenants(organization_id);
CREATE INDEX idx_tenants_slug ON tenants(organization_id, slug);
CREATE INDEX idx_tenants_status ON tenants(status) WHERE deleted_at IS NULL;

-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT false,
    phone VARCHAR(20),
    phone_verified BOOLEAN DEFAULT false,

    -- Profile
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    display_name VARCHAR(200),
    avatar_url VARCHAR(500),
    timezone VARCHAR(50) DEFAULT 'America/New_York',
    locale VARCHAR(10) DEFAULT 'en-US',

    -- Authentication (using Supabase Auth)
    auth_provider VARCHAR(50) DEFAULT 'email' CHECK (auth_provider IN ('email', 'google', 'microsoft', 'apple')),
    auth_provider_id VARCHAR(255),
    password_hash VARCHAR(255),  -- BCrypt hash if email auth
    mfa_enabled BOOLEAN DEFAULT false,
    mfa_secret VARCHAR(255),

    -- Status
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deactivated', 'deleted')),
    last_login_at TIMESTAMP WITH TIME ZONE,
    email_verified_at TIMESTAMP WITH TIME ZONE,

    -- Metadata
    preferences JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_auth_provider ON users(auth_provider, auth_provider_id);

-- User-Tenant Membership (many-to-many with roles)
CREATE TABLE user_tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'guest')),
    permissions JSONB DEFAULT '[]',  -- Additional fine-grained permissions

    -- Status
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
    invited_by UUID REFERENCES users(id),
    invited_at TIMESTAMP WITH TIME ZONE,
    joined_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (user_id, tenant_id)
);

CREATE INDEX idx_user_tenants_user ON user_tenants(user_id);
CREATE INDEX idx_user_tenants_tenant ON user_tenants(tenant_id);
CREATE INDEX idx_user_tenants_role ON user_tenants(role);

-- =============================================================================
-- Audit Logging (HIPAA Compliance)
-- =============================================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Event details
    event_type VARCHAR(100) NOT NULL,  -- e.g., 'user.login', 'data.read', 'data.write', 'data.delete'
    event_category VARCHAR(50) NOT NULL CHECK (event_category IN ('auth', 'data', 'admin', 'system')),
    severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical')),

    -- Resource information
    resource_type VARCHAR(100),  -- e.g., 'financial_account', 'goal', 'health_condition'
    resource_id UUID,
    resource_changes JSONB,  -- Before/after state for data changes

    -- Request context
    ip_address INET,
    user_agent TEXT,
    request_id UUID,
    session_id UUID,

    -- Additional metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamp (immutable - no updated_at)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Partition audit_logs by month for better performance
-- This should be managed by a maintenance script
-- Example: CREATE TABLE audit_logs_2025_01 PARTITION OF audit_logs
--          FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- =============================================================================
-- Helper Functions
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all relevant tables
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_tenants_updated_at
    BEFORE UPDATE ON user_tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to get current user's tenant ID (for RLS)
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN current_setting('app.current_tenant_id', true)::UUID;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if current user has role
CREATE OR REPLACE FUNCTION current_user_has_role(required_role VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    user_role VARCHAR;
BEGIN
    SELECT role INTO user_role
    FROM user_tenants
    WHERE user_id = current_setting('app.current_user_id', true)::UUID
        AND tenant_id = current_tenant_id();

    RETURN CASE required_role
        WHEN 'owner' THEN user_role = 'owner'
        WHEN 'admin' THEN user_role IN ('owner', 'admin')
        WHEN 'member' THEN user_role IN ('owner', 'admin', 'member')
        ELSE false
    END;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =============================================================================
-- Database Roles
-- =============================================================================

-- Create application roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated;
    END IF;

    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'service_account') THEN
        CREATE ROLE service_account;
    END IF;

    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anonymous') THEN
        CREATE ROLE anonymous;
    END IF;
END
$$;

-- Grant base permissions
GRANT USAGE ON SCHEMA public TO authenticated, service_account;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_account;

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON TABLE organizations IS 'Top-level organizations for B2B SaaS model';
COMMENT ON TABLE tenants IS 'Workspaces within organizations for multi-tenant isolation';
COMMENT ON TABLE users IS 'User accounts with authentication and profile data';
COMMENT ON TABLE user_tenants IS 'User membership in tenants with role-based access control';
COMMENT ON TABLE audit_logs IS 'Immutable audit trail for HIPAA compliance';

COMMENT ON FUNCTION current_tenant_id() IS 'Returns the current tenant ID from session context';
COMMENT ON FUNCTION current_user_has_role(VARCHAR) IS 'Checks if current user has required role in current tenant';
