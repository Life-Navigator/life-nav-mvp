-- Create base schema for Life Navigator Agents
-- This script runs automatically after extensions are enabled

-- Create schema for agent system
CREATE SCHEMA IF NOT EXISTS agents;

-- Create schema for GraphRAG data
CREATE SCHEMA IF NOT EXISTS graphrag;

-- Create schema for messaging
CREATE SCHEMA IF NOT EXISTS messaging;

-- Set search path
ALTER DATABASE life_navigator_agents SET search_path TO agents, graphrag, messaging, public;

-- Create enum types for agent states
CREATE TYPE agents.agent_state AS ENUM (
    'idle',
    'processing',
    'completed',
    'error',
    'shutdown'
);

CREATE TYPE agents.agent_type AS ENUM (
    'orchestrator',
    'domain_manager',
    'specialist',
    'tool_user'
);

CREATE TYPE agents.task_status AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'failed',
    'cancelled'
);

-- Example table: Agent metadata (to be expanded in Phase 2)
CREATE TABLE IF NOT EXISTS agents.agent_metadata (
    agent_id VARCHAR(255) PRIMARY KEY,
    agent_type agents.agent_type NOT NULL,
    name VARCHAR(255) NOT NULL,
    state agents.agent_state DEFAULT 'idle',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create index on agent state for fast queries
CREATE INDEX IF NOT EXISTS idx_agent_metadata_state ON agents.agent_metadata(state);
CREATE INDEX IF NOT EXISTS idx_agent_metadata_type ON agents.agent_metadata(agent_type);

-- Example table: Task tracking (to be expanded in Phase 2)
CREATE TABLE IF NOT EXISTS agents.tasks (
    task_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id VARCHAR(255) REFERENCES agents.agent_metadata(agent_id),
    task_type VARCHAR(255) NOT NULL,
    status agents.task_status DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    payload JSONB NOT NULL,
    result JSONB,
    error TEXT
);

-- Create indexes for task queries
CREATE INDEX IF NOT EXISTS idx_tasks_agent_id ON agents.tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON agents.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON agents.tasks(created_at DESC);

-- Grant permissions to application user
GRANT USAGE ON SCHEMA agents, graphrag, messaging TO lna_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA agents, graphrag, messaging TO lna_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA agents, graphrag, messaging TO lna_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA agents, graphrag, messaging GRANT ALL ON TABLES TO lna_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA agents, graphrag, messaging GRANT ALL ON SEQUENCES TO lna_user;

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'Database schema initialized successfully';
END $$;
