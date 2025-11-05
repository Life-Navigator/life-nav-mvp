-- Create schema for explainability, audit, and provenance tables
-- This script runs automatically after base schema setup

-- Audit events table
CREATE TABLE IF NOT EXISTS agents.audit_events (
    event_id UUID PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    agent_id VARCHAR(255) NOT NULL,
    agent_type VARCHAR(50) NOT NULL,
    task_id UUID,
    correlation_id VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    data_sources TEXT[],
    parent_event_id UUID,
    ip_address VARCHAR(50),
    user_agent TEXT,
    session_id VARCHAR(255),
    contains_pii BOOLEAN DEFAULT FALSE,
    contains_phi BOOLEAN DEFAULT FALSE,
    compliance_tags TEXT[],
    CONSTRAINT fk_parent_event FOREIGN KEY (parent_event_id)
        REFERENCES agents.audit_events(event_id) ON DELETE SET NULL
);

-- Indexes for fast audit querying
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON agents.audit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_agent_type ON agents.audit_events(agent_type);
CREATE INDEX IF NOT EXISTS idx_audit_event_type ON agents.audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_task_id ON agents.audit_events(task_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON agents.audit_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_correlation ON agents.audit_events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_audit_compliance ON agents.audit_events USING GIN(compliance_tags);

-- Reasoning chains table
CREATE TABLE IF NOT EXISTS agents.reasoning_chains (
    chain_id UUID PRIMARY KEY,
    task_id VARCHAR(255) NOT NULL,
    agent_type VARCHAR(50) NOT NULL,
    steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'in_progress'
);

CREATE INDEX IF NOT EXISTS idx_reasoning_task ON agents.reasoning_chains(task_id);
CREATE INDEX IF NOT EXISTS idx_reasoning_status ON agents.reasoning_chains(status);
CREATE INDEX IF NOT EXISTS idx_reasoning_started ON agents.reasoning_chains(started_at DESC);

-- Decision provenance table
CREATE TABLE IF NOT EXISTS agents.decision_provenance (
    decision_id UUID PRIMARY KEY,
    task_id VARCHAR(255) NOT NULL,
    agent_type VARCHAR(50) NOT NULL,
    decision_description TEXT NOT NULL,
    decision_output JSONB NOT NULL DEFAULT '{}'::jsonb,
    primary_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
    secondary_sources JSONB DEFAULT '[]'::jsonb,
    transformations TEXT[],
    calculations JSONB DEFAULT '[]'::jsonb,
    data_quality_score FLOAT NOT NULL CHECK (data_quality_score >= 0.0 AND data_quality_score <= 1.0),
    confidence_score FLOAT NOT NULL CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    timestamp TIMESTAMPTZ NOT NULL,
    reasoning_chain_id UUID REFERENCES agents.reasoning_chains(chain_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_provenance_task ON agents.decision_provenance(task_id);
CREATE INDEX IF NOT EXISTS idx_provenance_confidence ON agents.decision_provenance(confidence_score);
CREATE INDEX IF NOT EXISTS idx_provenance_timestamp ON agents.decision_provenance(timestamp DESC);

-- Recovery strategies table (for storing custom strategies)
CREATE TABLE IF NOT EXISTS agents.recovery_strategies (
    strategy_id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    applicable_errors TEXT[] NOT NULL,
    priority INTEGER NOT NULL CHECK (priority >= 1 AND priority <= 10),
    max_retries INTEGER DEFAULT 3,
    requires_user_input BOOLEAN DEFAULT FALSE,
    requires_data_refresh BOOLEAN DEFAULT FALSE,
    fallback_agent_type VARCHAR(50),
    fallback_data_source VARCHAR(255),
    degraded_output_acceptable BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recovery_priority ON agents.recovery_strategies(priority DESC);
CREATE INDEX IF NOT EXISTS idx_recovery_errors ON agents.recovery_strategies USING GIN(applicable_errors);

-- Plan explanations table
CREATE TABLE IF NOT EXISTS agents.plan_explanations (
    plan_id UUID PRIMARY KEY,
    task_id VARCHAR(255) NOT NULL,
    agent_type VARCHAR(50) NOT NULL,
    objective TEXT NOT NULL,
    rationale TEXT NOT NULL,
    assumptions TEXT[],
    constraints TEXT[],
    subtasks JSONB DEFAULT '[]'::jsonb,
    execution_order TEXT[],
    critical_path TEXT[],
    risks JSONB DEFAULT '[]'::jsonb,
    fallback_strategies JSONB DEFAULT '[]'::jsonb,
    required_data TEXT[],
    data_quality_requirements JSONB DEFAULT '{}'::jsonb,
    success_metrics TEXT[],
    estimated_confidence FLOAT CHECK (estimated_confidence >= 0.0 AND estimated_confidence <= 1.0),
    estimated_duration_seconds FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_task ON agents.plan_explanations(task_id);
CREATE INDEX IF NOT EXISTS idx_plan_confidence ON agents.plan_explanations(estimated_confidence);

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA agents TO lna_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA agents TO lna_user;

-- Create view for audit trail summary
CREATE OR REPLACE VIEW agents.audit_summary AS
SELECT
    user_id,
    agent_type,
    event_type,
    DATE(timestamp) as event_date,
    COUNT(*) as event_count
FROM agents.audit_events
GROUP BY user_id, agent_type, event_type, DATE(timestamp);

GRANT SELECT ON agents.audit_summary TO lna_user;

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'Explainability schema initialized successfully';
END $$;
