"""Create API keys tables

Revision ID: 001_api_keys
Revises:
Create Date: 2025-01-20

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001_api_keys'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Create api_keys table
    op.create_table(
        'api_keys',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('key_hash', sa.String(length=64), nullable=False),
        sa.Column('key_prefix', sa.String(length=16), nullable=False),
        sa.Column(
            'status',
            sa.Enum('active', 'revoked', 'expired', 'suspended', name='apikeystatus'),
            nullable=False,
        ),
        sa.Column('scopes', postgresql.ARRAY(sa.String(length=100)), nullable=False),
        sa.Column('rate_limit_per_minute', sa.Integer(), nullable=False),
        sa.Column('rate_limit_per_hour', sa.Integer(), nullable=False),
        sa.Column('allowed_ips', postgresql.ARRAY(sa.String(length=45)), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('last_used_at', sa.DateTime(), nullable=True),
        sa.Column('last_used_ip', sa.String(length=45), nullable=True),
        sa.Column('total_requests', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default='{}'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('revoked_at', sa.DateTime(), nullable=True),
        sa.Column('revoked_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('revocation_reason', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    # Create indexes
    op.create_index('idx_api_key_hash', 'api_keys', ['key_hash'], unique=True)
    op.create_index('idx_api_key_user_status', 'api_keys', ['user_id', 'status'])
    op.create_index('idx_api_key_created', 'api_keys', ['created_at'])
    op.create_index('idx_api_keys_user_id', 'api_keys', ['user_id'])

    # Create api_key_usage table
    op.create_table(
        'api_key_usage',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('api_key_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('timestamp', sa.DateTime(), nullable=False),
        sa.Column('endpoint', sa.String(length=255), nullable=False),
        sa.Column('method', sa.String(length=10), nullable=False),
        sa.Column('status_code', sa.Integer(), nullable=False),
        sa.Column('response_time_ms', sa.Integer(), nullable=False),
        sa.Column('ip_address', sa.String(length=45), nullable=False),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default='{}'),
        sa.ForeignKeyConstraint(['api_key_id'], ['api_keys.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    # Create indexes for usage table
    op.create_index('idx_usage_key_timestamp', 'api_key_usage', ['api_key_id', 'timestamp'])
    op.create_index('idx_usage_timestamp', 'api_key_usage', ['timestamp'])
    op.create_index('idx_usage_api_key_id', 'api_key_usage', ['api_key_id'])

    # Create api_key_rate_limits table
    op.create_table(
        'api_key_rate_limits',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('api_key_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('window_type', sa.String(length=10), nullable=False),
        sa.Column('window_start', sa.DateTime(), nullable=False),
        sa.Column('request_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['api_key_id'], ['api_keys.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    # Create indexes for rate limits
    op.create_index('idx_rate_limit_key_window', 'api_key_rate_limits', ['api_key_id', 'window_start'])
    op.create_index('idx_rate_limits_api_key_id', 'api_key_rate_limits', ['api_key_id'])

    # Create foreign key constraints (if users table exists)
    # Note: Uncomment if you have a users table in this service
    # op.create_foreign_key('fk_api_keys_user_id', 'api_keys', 'users', ['user_id'], ['id'], ondelete='CASCADE')
    # op.create_foreign_key('fk_api_keys_revoked_by', 'api_keys', 'users', ['revoked_by'], ['id'])


def downgrade():
    # Drop tables in reverse order
    op.drop_table('api_key_rate_limits')
    op.drop_table('api_key_usage')
    op.drop_table('api_keys')

    # Drop enum types
    op.execute('DROP TYPE apikeystatus')
