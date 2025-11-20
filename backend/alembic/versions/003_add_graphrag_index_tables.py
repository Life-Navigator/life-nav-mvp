"""Add GraphRAG index tracking tables

Revision ID: 003_graphrag_index
Revises: 002_encrypted_mfa
Create Date: 2025-01-20

This migration adds tables for GraphRAG index management:
- graphrag_index_jobs: Track rebuild job status and progress
- graphrag_index_metrics: Store current index metrics and health
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '003_graphrag_index'
down_revision = '002_encrypted_mfa'
branch_labels = None
depends_on = None


def upgrade():
    # Create index_status enum
    index_status_enum = postgresql.ENUM(
        'pending', 'running', 'completed', 'failed', 'cancelled',
        name='indexstatus',
        create_type=True
    )
    index_status_enum.create(op.get_bind())

    # Create index_type enum
    index_type_enum = postgresql.ENUM(
        'full', 'incremental', 'delta_sync',
        name='indextype',
        create_type=True
    )
    index_type_enum.create(op.get_bind())

    # Create graphrag_index_jobs table
    op.create_table(
        'graphrag_index_jobs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),

        # Tenant & user context
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),

        # Job metadata
        sa.Column('status', index_status_enum, nullable=False, server_default='pending'),
        sa.Column('index_type', index_type_enum, nullable=False, server_default='full'),

        # Progress tracking
        sa.Column('total_entities', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('processed_entities', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('failed_entities', sa.Integer(), nullable=False, server_default='0'),

        # Entity type breakdown
        sa.Column('entity_counts', postgresql.JSONB(), nullable=False, server_default='{}'),

        # Timing
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('duration_seconds', sa.Integer(), nullable=True),

        # Error tracking
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('error_trace', sa.Text(), nullable=True),
        sa.Column('retry_count', sa.Integer(), nullable=False, server_default='0'),

        # Celery task tracking
        sa.Column('celery_task_id', sa.String(255), nullable=True),

        # Performance metrics
        sa.Column('entities_per_second', sa.Float(), nullable=True),
        sa.Column('peak_memory_mb', sa.Integer(), nullable=True),

        # Configuration
        sa.Column('config', postgresql.JSONB(), nullable=False, server_default='{}'),
        sa.Column('metadata', postgresql.JSONB(), nullable=False, server_default='{}'),

        # Foreign keys
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
    )

    # Create indexes for graphrag_index_jobs
    op.create_index('idx_graphrag_jobs_tenant', 'graphrag_index_jobs', ['tenant_id'])
    op.create_index('idx_graphrag_jobs_user', 'graphrag_index_jobs', ['user_id'])
    op.create_index('idx_graphrag_jobs_status', 'graphrag_index_jobs', ['status'])
    op.create_index('idx_graphrag_jobs_celery_task', 'graphrag_index_jobs', ['celery_task_id'], unique=True)
    op.create_index('idx_graphrag_jobs_created', 'graphrag_index_jobs', ['created_at'])

    # Create graphrag_index_metrics table
    op.create_table(
        'graphrag_index_metrics',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),

        # Tenant context (one metrics record per tenant)
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False, unique=True),

        # Entity statistics
        sa.Column('total_entities', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('entity_types', postgresql.JSONB(), nullable=False, server_default='{}'),

        # Relationship statistics
        sa.Column('total_relationships', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('relationship_types', postgresql.JSONB(), nullable=False, server_default='{}'),

        # Vector index statistics
        sa.Column('total_vectors', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('vector_dimension', sa.Integer(), nullable=False, server_default='1536'),

        # Index health
        sa.Column('last_rebuild_at', sa.DateTime(), nullable=True),
        sa.Column('last_rebuild_job_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('is_healthy', sa.Boolean(), nullable=False, server_default='true'),

        # Quality metrics
        sa.Column('avg_entity_completeness', sa.Float(), nullable=True),
        sa.Column('orphaned_entities', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('duplicate_entities', sa.Integer(), nullable=False, server_default='0'),

        # Performance metrics
        sa.Column('avg_query_latency_ms', sa.Integer(), nullable=True),
        sa.Column('queries_per_second', sa.Float(), nullable=True),

        # Storage metrics
        sa.Column('neo4j_size_mb', sa.Integer(), nullable=True),
        sa.Column('qdrant_size_mb', sa.Integer(), nullable=True),
        sa.Column('graphdb_size_mb', sa.Integer(), nullable=True),

        # Metadata
        sa.Column('metadata', postgresql.JSONB(), nullable=False, server_default='{}'),

        # Foreign keys
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['last_rebuild_job_id'], ['graphrag_index_jobs.id']),
    )

    # Create indexes for graphrag_index_metrics
    op.create_index('idx_graphrag_metrics_tenant', 'graphrag_index_metrics', ['tenant_id'], unique=True)
    op.create_index('idx_graphrag_metrics_updated', 'graphrag_index_metrics', ['updated_at'])


def downgrade():
    # Drop tables
    op.drop_table('graphrag_index_metrics')
    op.drop_table('graphrag_index_jobs')

    # Drop enums
    op.execute('DROP TYPE indextype')
    op.execute('DROP TYPE indexstatus')
