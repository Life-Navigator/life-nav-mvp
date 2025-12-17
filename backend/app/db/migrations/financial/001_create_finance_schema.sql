-- =============================================================================
-- Financial Database Migration 001: Create Finance Schema
-- =============================================================================
-- Description: Creates isolated financial data tables for PCI-DSS/SOX compliance
-- This database is completely isolated from the Core and HIPAA databases
-- References to tenant_id and user_id are logical (no foreign keys to Core DB)
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- Financial Accounts
-- =============================================================================

CREATE TABLE financial_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,  -- Logical reference to Core DB tenants
    user_id UUID NOT NULL,    -- Logical reference to Core DB users

    -- Account details
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL CHECK (account_type IN (
        'checking', 'savings', 'credit_card', 'investment', 'retirement',
        'loan', 'mortgage', 'student_loan', 'crypto', 'other'
    )),
    institution_name VARCHAR(255),
    account_number_last4 VARCHAR(4),  -- Last 4 digits only for security
    currency VARCHAR(3) DEFAULT 'USD',

    -- Balances
    current_balance DECIMAL(15, 2),
    available_balance DECIMAL(15, 2),
    credit_limit DECIMAL(15, 2),
    interest_rate DECIMAL(5, 2),
    minimum_payment DECIMAL(15, 2),

    -- Integration (Plaid)
    plaid_item_id VARCHAR(255),
    plaid_account_id VARCHAR(255),
    last_synced_at TIMESTAMP WITH TIME ZONE,
    sync_error TEXT,

    -- Status
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'closed')),
    is_manual BOOLEAN DEFAULT false,

    -- Metadata
    metadata JSONB DEFAULT '{}',
    tags TEXT[],

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_financial_accounts_tenant ON financial_accounts(tenant_id);
CREATE INDEX idx_financial_accounts_user ON financial_accounts(user_id);
CREATE INDEX idx_financial_accounts_tenant_user ON financial_accounts(tenant_id, user_id);
CREATE INDEX idx_financial_accounts_type ON financial_accounts(account_type);
CREATE INDEX idx_financial_accounts_plaid ON financial_accounts(plaid_item_id, plaid_account_id);
CREATE INDEX idx_financial_accounts_status ON financial_accounts(status) WHERE deleted_at IS NULL;

-- =============================================================================
-- Transactions
-- =============================================================================

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    account_id UUID NOT NULL REFERENCES financial_accounts(id) ON DELETE CASCADE,

    -- Transaction details
    transaction_date DATE NOT NULL,
    post_date DATE,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    description TEXT NOT NULL,
    merchant_name VARCHAR(255),
    category VARCHAR(100),
    subcategory VARCHAR(100),

    -- Classification
    transaction_type VARCHAR(50) CHECK (transaction_type IN ('debit', 'credit', 'transfer')),
    is_recurring BOOLEAN DEFAULT false,
    is_pending BOOLEAN DEFAULT false,

    -- Integration
    plaid_transaction_id VARCHAR(255),
    external_id VARCHAR(255),

    -- Location
    location JSONB,

    -- Metadata
    metadata JSONB DEFAULT '{}',
    tags TEXT[],
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_transactions_tenant ON transactions(tenant_id);
CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_tenant_user ON transactions(tenant_id, user_id);
CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date DESC);
CREATE INDEX idx_transactions_category ON transactions(category, subcategory);
CREATE INDEX idx_transactions_amount ON transactions(amount);
CREATE INDEX idx_transactions_plaid ON transactions(plaid_transaction_id);

-- =============================================================================
-- Budgets
-- =============================================================================

CREATE TABLE budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,

    -- Budget details
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    period VARCHAR(20) NOT NULL CHECK (period IN ('weekly', 'monthly', 'quarterly', 'yearly')),
    currency VARCHAR(3) DEFAULT 'USD',

    -- Time range
    start_date DATE NOT NULL,
    end_date DATE,

    -- Alerts
    alert_threshold DECIMAL(3, 2) DEFAULT 0.80,
    alert_enabled BOOLEAN DEFAULT true,

    -- Status
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),

    -- Metadata
    metadata JSONB DEFAULT '{}',
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_budgets_tenant ON budgets(tenant_id);
CREATE INDEX idx_budgets_user ON budgets(user_id);
CREATE INDEX idx_budgets_tenant_user ON budgets(tenant_id, user_id);
CREATE INDEX idx_budgets_category ON budgets(category);
CREATE INDEX idx_budgets_period ON budgets(period, start_date);

-- =============================================================================
-- Investments
-- =============================================================================

CREATE TABLE investments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    account_id UUID REFERENCES financial_accounts(id) ON DELETE SET NULL,

    -- Investment details
    symbol VARCHAR(20),
    name VARCHAR(255) NOT NULL,
    investment_type VARCHAR(50) CHECK (investment_type IN (
        'stock', 'etf', 'mutual_fund', 'bond', 'crypto', 'option', 'commodity', 'other'
    )),

    -- Holdings
    quantity DECIMAL(20, 8) NOT NULL,
    cost_basis DECIMAL(15, 2),
    current_price DECIMAL(15, 2),
    current_value DECIMAL(15, 2),
    currency VARCHAR(3) DEFAULT 'USD',

    -- Performance
    total_return DECIMAL(15, 2),
    total_return_percentage DECIMAL(8, 4),
    unrealized_gain_loss DECIMAL(15, 2),
    realized_gain_loss DECIMAL(15, 2),

    -- Dates
    purchase_date DATE,
    last_price_update TIMESTAMP WITH TIME ZONE,

    -- Integration
    plaid_security_id VARCHAR(255),
    external_id VARCHAR(255),

    -- Metadata
    metadata JSONB DEFAULT '{}',
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_investments_tenant ON investments(tenant_id);
CREATE INDEX idx_investments_user ON investments(user_id);
CREATE INDEX idx_investments_tenant_user ON investments(tenant_id, user_id);
CREATE INDEX idx_investments_account ON investments(account_id);
CREATE INDEX idx_investments_symbol ON investments(symbol);
CREATE INDEX idx_investments_type ON investments(investment_type);

-- =============================================================================
-- Tax Documents
-- =============================================================================

CREATE TABLE tax_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,

    -- Document details
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN (
        'w2', '1099_int', '1099_div', '1099_b', '1099_misc', '1099_nec',
        '1099_r', '1098', '1095_a', '1095_b', '1095_c', 'other'
    )),
    tax_year INTEGER NOT NULL,
    issuer_name VARCHAR(255) NOT NULL,
    issuer_ein VARCHAR(20),

    -- Values
    gross_amount DECIMAL(15, 2),
    taxable_amount DECIMAL(15, 2),
    tax_withheld DECIMAL(15, 2),

    -- Document storage
    file_url VARCHAR(500),
    file_name VARCHAR(255),
    file_type VARCHAR(100),
    file_size_bytes INTEGER,

    -- Status
    status VARCHAR(50) DEFAULT 'received' CHECK (status IN (
        'expected', 'received', 'reviewed', 'filed'
    )),
    received_date DATE,
    reviewed_date DATE,

    -- Metadata
    metadata JSONB DEFAULT '{}',
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_tax_documents_tenant ON tax_documents(tenant_id);
CREATE INDEX idx_tax_documents_user ON tax_documents(user_id);
CREATE INDEX idx_tax_documents_tenant_user ON tax_documents(tenant_id, user_id);
CREATE INDEX idx_tax_documents_year ON tax_documents(tax_year DESC);
CREATE INDEX idx_tax_documents_type ON tax_documents(document_type);

-- =============================================================================
-- Plaid Connections
-- =============================================================================

CREATE TABLE plaid_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,

    -- Plaid item details
    plaid_item_id VARCHAR(255) NOT NULL UNIQUE,
    plaid_access_token TEXT NOT NULL,  -- Should be encrypted at rest
    plaid_institution_id VARCHAR(255),
    institution_name VARCHAR(255),

    -- Status
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN (
        'active', 'needs_reauth', 'disconnected', 'error'
    )),
    error_code VARCHAR(100),
    error_message TEXT,

    -- Sync tracking
    last_successful_sync TIMESTAMP WITH TIME ZONE,
    last_sync_attempt TIMESTAMP WITH TIME ZONE,
    sync_cursor TEXT,  -- Plaid cursor for incremental sync

    -- Consent
    consent_expiry TIMESTAMP WITH TIME ZONE,
    products_enabled TEXT[],  -- transactions, investments, etc.

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_plaid_connections_tenant ON plaid_connections(tenant_id);
CREATE INDEX idx_plaid_connections_user ON plaid_connections(user_id);
CREATE INDEX idx_plaid_connections_tenant_user ON plaid_connections(tenant_id, user_id);
CREATE INDEX idx_plaid_connections_item_id ON plaid_connections(plaid_item_id);
CREATE INDEX idx_plaid_connections_status ON plaid_connections(status);

-- =============================================================================
-- Stripe Customers (Payment Processing)
-- =============================================================================

CREATE TABLE stripe_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,

    -- Stripe details
    stripe_customer_id VARCHAR(255) NOT NULL UNIQUE,
    stripe_subscription_id VARCHAR(255),

    -- Subscription
    subscription_status VARCHAR(50) CHECK (subscription_status IN (
        'active', 'past_due', 'unpaid', 'canceled', 'incomplete',
        'incomplete_expired', 'trialing', 'paused'
    )),
    subscription_plan VARCHAR(100),
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,

    -- Payment method
    default_payment_method_id VARCHAR(255),
    default_payment_method_type VARCHAR(50),
    payment_method_last4 VARCHAR(4),
    payment_method_brand VARCHAR(50),

    -- Billing
    billing_email VARCHAR(255),
    billing_name VARCHAR(255),
    billing_address JSONB,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_stripe_customers_tenant ON stripe_customers(tenant_id);
CREATE INDEX idx_stripe_customers_user ON stripe_customers(user_id);
CREATE INDEX idx_stripe_customers_tenant_user ON stripe_customers(tenant_id, user_id);
CREATE INDEX idx_stripe_customers_stripe_id ON stripe_customers(stripe_customer_id);
CREATE INDEX idx_stripe_customers_subscription ON stripe_customers(subscription_status);

-- =============================================================================
-- Stripe Subscriptions (Subscription history and details)
-- =============================================================================

CREATE TABLE stripe_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    customer_id UUID REFERENCES stripe_customers(id) ON DELETE CASCADE,

    -- Stripe subscription details
    stripe_subscription_id VARCHAR(255) NOT NULL UNIQUE,
    stripe_price_id VARCHAR(255),
    stripe_product_id VARCHAR(255),

    -- Plan details
    plan_name VARCHAR(100),
    plan_interval VARCHAR(20),  -- month, year
    plan_amount DECIMAL(10, 2),
    currency VARCHAR(3) DEFAULT 'USD',

    -- Status
    status VARCHAR(50) NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT false,

    -- Dates
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    canceled_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    trial_start TIMESTAMP WITH TIME ZONE,
    trial_end TIMESTAMP WITH TIME ZONE,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_stripe_subscriptions_tenant ON stripe_subscriptions(tenant_id);
CREATE INDEX idx_stripe_subscriptions_user ON stripe_subscriptions(user_id);
CREATE INDEX idx_stripe_subscriptions_customer ON stripe_subscriptions(customer_id);
CREATE INDEX idx_stripe_subscriptions_stripe_id ON stripe_subscriptions(stripe_subscription_id);
CREATE INDEX idx_stripe_subscriptions_status ON stripe_subscriptions(status);

-- =============================================================================
-- Financial Audit Logs (SOX/PCI-DSS Compliance - 7-year retention)
-- =============================================================================

CREATE TABLE financial_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID,  -- User who performed the action
    target_user_id UUID,  -- User whose data was accessed

    -- Event details
    event_type VARCHAR(100) NOT NULL,  -- e.g., 'pii.read', 'payment.process', 'account.link'
    event_action VARCHAR(50) NOT NULL CHECK (event_action IN (
        'create', 'read', 'update', 'delete', 'sync', 'export', 'process_payment'
    )),
    event_description TEXT,

    -- Resource information
    resource_type VARCHAR(100) NOT NULL,  -- Table name
    resource_id UUID,
    resource_data_before JSONB,
    resource_data_after JSONB,

    -- PII access tracking
    pii_accessed BOOLEAN DEFAULT false,
    pii_fields_accessed TEXT[],

    -- Payment tracking (PCI-DSS)
    payment_amount DECIMAL(15, 2),
    payment_currency VARCHAR(3),
    payment_method_type VARCHAR(50),

    -- Request context
    ip_address INET,
    user_agent TEXT,
    request_id UUID,
    session_id UUID,

    -- Additional metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamp (immutable)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Indexes for financial audit logs
CREATE INDEX idx_financial_audit_tenant ON financial_audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_financial_audit_user ON financial_audit_logs(user_id, created_at DESC);
CREATE INDEX idx_financial_audit_target_user ON financial_audit_logs(target_user_id, created_at DESC);
CREATE INDEX idx_financial_audit_event_type ON financial_audit_logs(event_type, created_at DESC);
CREATE INDEX idx_financial_audit_resource ON financial_audit_logs(resource_type, resource_id);
CREATE INDEX idx_financial_audit_created_at ON financial_audit_logs(created_at DESC);

-- =============================================================================
-- Helper Functions
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_financial_accounts_updated_at
    BEFORE UPDATE ON financial_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_budgets_updated_at
    BEFORE UPDATE ON budgets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_investments_updated_at
    BEFORE UPDATE ON investments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tax_documents_updated_at
    BEFORE UPDATE ON tax_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plaid_connections_updated_at
    BEFORE UPDATE ON plaid_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stripe_customers_updated_at
    BEFORE UPDATE ON stripe_customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stripe_subscriptions_updated_at
    BEFORE UPDATE ON stripe_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE plaid_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_audit_logs ENABLE ROW LEVEL SECURITY;

-- Function to get current tenant ID from session
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN current_setting('app.current_tenant_id', true)::UUID;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Tenant isolation policies
CREATE POLICY financial_accounts_tenant_isolation ON financial_accounts
    FOR ALL USING (tenant_id = current_tenant_id());

CREATE POLICY transactions_tenant_isolation ON transactions
    FOR ALL USING (tenant_id = current_tenant_id());

CREATE POLICY budgets_tenant_isolation ON budgets
    FOR ALL USING (tenant_id = current_tenant_id());

CREATE POLICY investments_tenant_isolation ON investments
    FOR ALL USING (tenant_id = current_tenant_id());

CREATE POLICY tax_documents_tenant_isolation ON tax_documents
    FOR ALL USING (tenant_id = current_tenant_id());

CREATE POLICY plaid_connections_tenant_isolation ON plaid_connections
    FOR ALL USING (tenant_id = current_tenant_id());

CREATE POLICY stripe_customers_tenant_isolation ON stripe_customers
    FOR ALL USING (tenant_id = current_tenant_id());

CREATE POLICY stripe_subscriptions_tenant_isolation ON stripe_subscriptions
    FOR ALL USING (tenant_id = current_tenant_id());

CREATE POLICY financial_audit_logs_tenant_isolation ON financial_audit_logs
    FOR ALL USING (tenant_id = current_tenant_id());

-- =============================================================================
-- Database Roles
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'financial_read') THEN
        CREATE ROLE financial_read;
    END IF;

    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'financial_write') THEN
        CREATE ROLE financial_write;
    END IF;

    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'financial_admin') THEN
        CREATE ROLE financial_admin;
    END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO financial_read, financial_write, financial_admin;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO financial_read;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO financial_write;
GRANT ALL ON ALL TABLES IN SCHEMA public TO financial_admin;

-- Audit logs are append-only for SOX compliance
REVOKE UPDATE, DELETE ON financial_audit_logs FROM financial_write;
GRANT INSERT, SELECT ON financial_audit_logs TO financial_write;

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON TABLE financial_accounts IS 'Financial accounts - PCI-DSS protected';
COMMENT ON TABLE transactions IS 'Financial transactions - PCI-DSS protected';
COMMENT ON TABLE budgets IS 'User budgets - PCI-DSS protected';
COMMENT ON TABLE investments IS 'Investment holdings - PCI-DSS protected';
COMMENT ON TABLE tax_documents IS 'Tax documents - PCI-DSS/SOX protected';
COMMENT ON TABLE plaid_connections IS 'Plaid bank connections - PCI-DSS protected (contains encrypted tokens)';
COMMENT ON TABLE stripe_customers IS 'Stripe customer records - PCI-DSS protected';
COMMENT ON TABLE stripe_subscriptions IS 'Stripe subscription records - PCI-DSS protected';
COMMENT ON TABLE financial_audit_logs IS 'Immutable financial audit trail - SOX/PCI-DSS 7 year retention required';
