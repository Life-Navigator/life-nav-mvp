-- =============================================================================
-- Migration 004: Enable pgvector and Vector Search Extensions
-- =============================================================================
-- Description: Enables pgvector for vector similarity search and related
--              extensions for the GraphRAG hybrid search system
-- Prerequisites: PostgreSQL 11+ with pgvector available
-- =============================================================================

-- Enable vector extension for embeddings and similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable pg_trgm for fuzzy text search (complements vector search)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enable btree_gin for composite indexes with vectors
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- Create vector embeddings table for caching
CREATE TABLE IF NOT EXISTS vector_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    content_hash VARCHAR(64) NOT NULL,  -- SHA256 hash of content
    embedding vector(384) NOT NULL,     -- 384 dimensions for all-MiniLM-L6-v2
    model_name VARCHAR(100) NOT NULL DEFAULT 'all-MiniLM-L6-v2',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Ensure one embedding per entity per model
    UNIQUE (tenant_id, entity_type, entity_id, model_name)
);

-- Create HNSW index for fast approximate nearest neighbor search
-- HNSW (Hierarchical Navigable Small World) is optimal for high recall
CREATE INDEX IF NOT EXISTS idx_embeddings_vector_hnsw
ON vector_embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Alternative IVFFlat index (commented out - use HNSW for better recall)
-- CREATE INDEX IF NOT EXISTS idx_embeddings_vector_ivfflat
-- ON vector_embeddings
-- USING ivfflat (embedding vector_cosine_ops)
-- WITH (lists = 100);

-- Index for tenant isolation (RLS)
CREATE INDEX IF NOT EXISTS idx_embeddings_tenant_id
ON vector_embeddings (tenant_id);

-- Composite index for entity lookups
CREATE INDEX IF NOT EXISTS idx_embeddings_entity
ON vector_embeddings (entity_type, entity_id);

-- Index for content hash (deduplication)
CREATE INDEX IF NOT EXISTS idx_embeddings_content_hash
ON vector_embeddings (content_hash);

-- Enable Row-Level Security for multi-tenant isolation
ALTER TABLE vector_embeddings ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can only access embeddings from their tenant
CREATE POLICY tenant_isolation_policy ON vector_embeddings
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- RLS policy: Service accounts can access all embeddings
CREATE POLICY service_account_policy ON vector_embeddings
    FOR ALL
    TO service_account
    USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_vector_embeddings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trigger_update_vector_embeddings_updated_at
    BEFORE UPDATE ON vector_embeddings
    FOR EACH ROW
    EXECUTE FUNCTION update_vector_embeddings_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON vector_embeddings TO authenticated;
GRANT ALL ON vector_embeddings TO service_account;

-- Create helper function for cosine similarity search
CREATE OR REPLACE FUNCTION search_embeddings_by_similarity(
    p_tenant_id UUID,
    p_query_embedding vector(384),
    p_entity_type VARCHAR(100) DEFAULT NULL,
    p_limit INT DEFAULT 10,
    p_min_similarity FLOAT DEFAULT 0.5
)
RETURNS TABLE(
    entity_id UUID,
    entity_type VARCHAR(100),
    similarity FLOAT,
    content_hash VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ve.entity_id,
        ve.entity_type,
        1 - (ve.embedding <=> p_query_embedding) AS similarity,
        ve.content_hash,
        ve.created_at
    FROM vector_embeddings ve
    WHERE ve.tenant_id = p_tenant_id
        AND (p_entity_type IS NULL OR ve.entity_type = p_entity_type)
        AND (1 - (ve.embedding <=> p_query_embedding)) >= p_min_similarity
    ORDER BY ve.embedding <=> p_query_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on search function
GRANT EXECUTE ON FUNCTION search_embeddings_by_similarity TO authenticated;

-- Create function for batch embedding upsert
CREATE OR REPLACE FUNCTION upsert_embedding(
    p_tenant_id UUID,
    p_entity_type VARCHAR(100),
    p_entity_id UUID,
    p_content_hash VARCHAR(64),
    p_embedding vector(384),
    p_model_name VARCHAR(100) DEFAULT 'all-MiniLM-L6-v2'
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO vector_embeddings (
        tenant_id,
        entity_type,
        entity_id,
        content_hash,
        embedding,
        model_name
    ) VALUES (
        p_tenant_id,
        p_entity_type,
        p_entity_id,
        p_content_hash,
        p_embedding,
        p_model_name
    )
    ON CONFLICT (tenant_id, entity_type, entity_id, model_name)
    DO UPDATE SET
        content_hash = EXCLUDED.content_hash,
        embedding = EXCLUDED.embedding,
        updated_at = CURRENT_TIMESTAMP
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on upsert function
GRANT EXECUTE ON FUNCTION upsert_embedding TO authenticated;

-- Create statistics table for vector search analytics
CREATE TABLE IF NOT EXISTS vector_search_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    query_hash VARCHAR(64) NOT NULL,
    entity_type VARCHAR(100),
    results_count INT NOT NULL,
    avg_similarity FLOAT,
    search_duration_ms INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_vector_search_stats_tenant
ON vector_search_stats (tenant_id, created_at DESC);

-- Enable RLS on stats table
ALTER TABLE vector_search_stats ENABLE ROW LEVEL SECURITY;

-- RLS policy for stats
CREATE POLICY stats_tenant_isolation_policy ON vector_search_stats
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Grant permissions on stats
GRANT SELECT, INSERT ON vector_search_stats TO authenticated;

-- Comment tables and important columns
COMMENT ON TABLE vector_embeddings IS 'Cached vector embeddings for entities, enabling fast similarity search';
COMMENT ON COLUMN vector_embeddings.embedding IS 'Vector embedding (384 dimensions for all-MiniLM-L6-v2 model)';
COMMENT ON COLUMN vector_embeddings.content_hash IS 'SHA256 hash of source content to detect changes';
COMMENT ON INDEX idx_embeddings_vector_hnsw IS 'HNSW index for approximate nearest neighbor search with high recall';

COMMENT ON TABLE vector_search_stats IS 'Analytics and monitoring for vector similarity searches';

COMMENT ON FUNCTION search_embeddings_by_similarity IS 'Search embeddings by cosine similarity with tenant isolation';
COMMENT ON FUNCTION upsert_embedding IS 'Insert or update embedding with deduplication by content hash';

-- Performance tuning tips (for DBA reference)
-- Run ANALYZE after bulk inserts to update statistics
-- ANALYZE vector_embeddings;

-- Monitor index usage
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
-- FROM pg_stat_user_indexes
-- WHERE tablename = 'vector_embeddings';

-- Vacuum regularly for optimal HNSW performance
-- VACUUM ANALYZE vector_embeddings;
