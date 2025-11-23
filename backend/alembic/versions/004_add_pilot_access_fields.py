"""Add pilot access control fields to users table

Revision ID: 004_pilot_access
Revises: 003_add_graphrag_index_tables
Create Date: 2025-11-22

This migration adds the pilot program access control fields to the users table:
- pilot_role: User's role in the pilot program (waitlist, investor, pilot, admin)
- pilot_enabled: Whether pilot access is currently enabled
- pilot_start_at: Start of pilot access window
- pilot_end_at: End of pilot access window
- user_type: User segmentation type (civilian, military, veteran)
- waitlist_position: Position in waitlist queue
- invited_by_user_id: Referrer user ID
- pilot_notes: Admin notes about the pilot user
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '005_pilot_access'
down_revision: Union[str, None] = '003_graphrag_index'  # Chain from graphrag migration
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add pilot access fields to users table."""

    # Create enum types
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE pilotrole AS ENUM ('waitlist', 'investor', 'pilot', 'admin');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    op.execute("""
        DO $$ BEGIN
            CREATE TYPE usertype AS ENUM ('civilian', 'military', 'veteran');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # Add columns to users table
    op.add_column('users', sa.Column(
        'pilot_role',
        sa.Enum('waitlist', 'investor', 'pilot', 'admin', name='pilotrole'),
        nullable=False,
        server_default='waitlist'
    ))

    op.add_column('users', sa.Column(
        'pilot_enabled',
        sa.Boolean(),
        nullable=False,
        server_default='false'
    ))

    op.add_column('users', sa.Column(
        'pilot_start_at',
        sa.TIMESTAMP(timezone=True),
        nullable=True
    ))

    op.add_column('users', sa.Column(
        'pilot_end_at',
        sa.TIMESTAMP(timezone=True),
        nullable=True
    ))

    op.add_column('users', sa.Column(
        'user_type',
        sa.Enum('civilian', 'military', 'veteran', name='usertype'),
        nullable=False,
        server_default='civilian'
    ))

    op.add_column('users', sa.Column(
        'waitlist_position',
        sa.Integer(),
        nullable=True
    ))

    op.add_column('users', sa.Column(
        'invited_by_user_id',
        sa.dialects.postgresql.UUID(),
        sa.ForeignKey('users.id', ondelete='SET NULL'),
        nullable=True
    ))

    op.add_column('users', sa.Column(
        'pilot_notes',
        sa.Text(),
        nullable=True
    ))

    # Create indexes for efficient querying
    op.create_index('ix_users_pilot_role', 'users', ['pilot_role'])
    op.create_index('ix_users_pilot_enabled', 'users', ['pilot_enabled'])
    op.create_index('ix_users_waitlist_position', 'users', ['waitlist_position'])
    op.create_index('ix_users_user_type', 'users', ['user_type'])

    # Create partial index for active pilots (common query pattern)
    op.execute("""
        CREATE INDEX ix_users_active_pilots
        ON users (pilot_role, pilot_enabled, pilot_end_at)
        WHERE pilot_role = 'pilot' AND pilot_enabled = true;
    """)


def downgrade() -> None:
    """Remove pilot access fields from users table."""

    # Drop indexes
    op.execute("DROP INDEX IF EXISTS ix_users_active_pilots;")
    op.drop_index('ix_users_user_type', 'users')
    op.drop_index('ix_users_waitlist_position', 'users')
    op.drop_index('ix_users_pilot_enabled', 'users')
    op.drop_index('ix_users_pilot_role', 'users')

    # Drop columns
    op.drop_column('users', 'pilot_notes')
    op.drop_column('users', 'invited_by_user_id')
    op.drop_column('users', 'waitlist_position')
    op.drop_column('users', 'user_type')
    op.drop_column('users', 'pilot_end_at')
    op.drop_column('users', 'pilot_start_at')
    op.drop_column('users', 'pilot_enabled')
    op.drop_column('users', 'pilot_role')

    # Drop enum types
    op.execute("DROP TYPE IF EXISTS usertype;")
    op.execute("DROP TYPE IF EXISTS pilotrole;")
