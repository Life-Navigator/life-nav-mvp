"""Add encrypted MFA fields

Revision ID: 002_encrypted_mfa
Revises: 001
Create Date: 2025-01-20

This migration adds field-level encryption for MFA secrets using envelope encryption.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002_encrypted_mfa'
down_revision = '001'  # Replace with actual previous revision
branch_labels = None
depends_on = None


def upgrade():
    # Add encrypted MFA fields
    op.add_column(
        'users',
        sa.Column('mfa_secret_encrypted', sa.Text(), nullable=True)
    )
    op.add_column(
        'users',
        sa.Column('mfa_secret_dek', sa.Text(), nullable=True)
    )

    # Create index for faster lookups
    op.create_index(
        'idx_users_mfa_enabled',
        'users',
        ['mfa_enabled'],
        unique=False
    )

    # Note: Old mfa_secret column kept for backward compatibility
    # Will be removed in future migration after data migration


def downgrade():
    # Remove indexes
    op.drop_index('idx_users_mfa_enabled', table_name='users')

    # Remove encrypted columns
    op.drop_column('users', 'mfa_secret_dek')
    op.drop_column('users', 'mfa_secret_encrypted')
