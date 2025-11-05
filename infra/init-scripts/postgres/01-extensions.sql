-- Initialize PostgreSQL extensions for Life Navigator Agents
-- This script runs automatically when the database is first created

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable uuid-ossp for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pg_trgm for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enable btree_gin for advanced indexing
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- Verify extensions
SELECT extname, extversion FROM pg_extension WHERE extname IN ('vector', 'uuid-ossp', 'pg_trgm', 'btree_gin');

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'PostgreSQL extensions initialized successfully';
END $$;
