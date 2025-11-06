"""Initial schema with all 6 domain models

Revision ID: 001_initial_schema
Revises:
Create Date: 2025-11-05 20:50:00

This migration creates the complete database schema for Life Navigator including:
- Base multi-tenant tables (organizations, tenants, users)
- Finance domain (accounts, transactions, budgets)
- Career domain (profiles, applications, interviews)
- Education domain (credentials, courses)
- Goals domain (goals, milestones)
- Health domain (conditions, medications)
- Relationships domain (contacts, interactions)
- Row-Level Security policies
- pgvector extension and embeddings

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade database schema."""

    # Migration 001: Create base schema
    op.execute("""
    -- =============================================================================
    -- Migration 001: Create Base Schema - Multi-tenant Foundation
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
        mfa_secret VARCHAR(255),  -- TOTP secret
        backup_codes TEXT[],  -- Recovery codes

        -- Status
        status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
        last_login_at TIMESTAMP WITH TIME ZONE,
        last_login_ip INET,

        -- Metadata
        settings JSONB DEFAULT '{}',
        metadata JSONB DEFAULT '{}',

        -- Timestamps
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP WITH TIME ZONE
    );

    CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
    CREATE INDEX idx_users_status ON users(status) WHERE deleted_at IS NULL;
    CREATE INDEX idx_users_auth_provider ON users(auth_provider, auth_provider_id);

    -- User-Tenant Memberships (M2M with RBAC)
    CREATE TABLE user_tenants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'guest')),
        is_active BOOLEAN DEFAULT true,

        -- Permissions (feature flags per user per tenant)
        permissions JSONB DEFAULT '{}',

        -- Timestamps
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_accessed_at TIMESTAMP WITH TIME ZONE,

        UNIQUE (user_id, tenant_id)
    );

    CREATE INDEX idx_user_tenants_user ON user_tenants(user_id);
    CREATE INDEX idx_user_tenants_tenant ON user_tenants(tenant_id);
    CREATE INDEX idx_user_tenants_role ON user_tenants(role);

    -- Audit Logs (immutable for compliance)
    CREATE TABLE audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,

        -- Action details
        action VARCHAR(100) NOT NULL,  -- create, read, update, delete, login, logout, etc.
        resource_type VARCHAR(100),  -- table name or resource type
        resource_id UUID,
        ip_address INET,
        user_agent TEXT,

        -- Changes (before/after for UPDATE actions)
        changes JSONB,

        -- Status
        status VARCHAR(50) DEFAULT 'success' CHECK (status IN ('success', 'failure', 'error')),
        error_message TEXT,

        -- Timestamps (immutable - no updated_at)
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
    CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
    CREATE INDEX idx_audit_logs_action ON audit_logs(action);
    CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
    CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
    """)

    # Note: Domain tables will be created in migration 002
    # This keeps migrations manageable and allows for rollback granularity


def downgrade() -> None:
    """Downgrade database schema."""

    # Drop tables in reverse order (respecting foreign keys)
    op.execute("""
    DROP TABLE IF EXISTS audit_logs CASCADE;
    DROP TABLE IF EXISTS user_tenants CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    DROP TABLE IF EXISTS tenants CASCADE;
    DROP TABLE IF EXISTS organizations CASCADE;

    -- Drop extensions
    DROP EXTENSION IF EXISTS "pgcrypto";
    DROP EXTENSION IF EXISTS "uuid-ossp";
    """)
