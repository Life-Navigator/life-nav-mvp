"""Enable pgvector for semantic search

Revision ID: 004_enable_pgvector
Revises: 003_enable_rls
Create Date: 2025-11-05 20:53:00

This migration enables pgvector extension and creates the vector embeddings
table for semantic search integration with the GraphRAG service.

Creates:
- pgvector extension
- vector_embeddings table with 384-dimensional vectors (all-MiniLM-L6-v2)
- HNSW index for fast approximate nearest neighbor search
- Helper functions for embedding management
- RLS policies for embeddings

"""
from typing import Sequence, Union
from pathlib import Path

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '004_enable_pgvector'
down_revision: Union[str, None] = '003_enable_rls'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def load_sql_file(filename: str) -> str:
    """Load SQL from migration file."""
    migrations_dir = Path(__file__).parent.parent.parent / "app" / "db" / "migrations"
    sql_file = migrations_dir / filename
    return sql_file.read_text()


def upgrade() -> None:
    """Upgrade database schema."""

    # Load and execute the pgvector setup SQL
    sql = load_sql_file("004_enable_pgvector.sql")
    op.execute(sql)


def downgrade() -> None:
    """Downgrade database schema."""

    # Drop pgvector components
    op.execute("""
    -- Drop functions
    DROP FUNCTION IF EXISTS upsert_embedding(UUID, VARCHAR, UUID, TEXT, VECTOR, VARCHAR);
    DROP FUNCTION IF EXISTS search_embeddings_by_similarity(VECTOR, INTEGER, UUID);

    -- Drop indexes
    DROP INDEX IF EXISTS idx_embeddings_vector_hnsw;
    DROP INDEX IF EXISTS idx_embeddings_tenant;
    DROP INDEX IF EXISTS idx_embeddings_entity;
    DROP INDEX IF EXISTS idx_embeddings_content_hash;

    -- Disable RLS
    ALTER TABLE vector_embeddings DISABLE ROW LEVEL SECURITY;

    -- Drop table
    DROP TABLE IF EXISTS vector_embeddings CASCADE;

    -- Drop extension
    DROP EXTENSION IF EXISTS vector;
    """)
