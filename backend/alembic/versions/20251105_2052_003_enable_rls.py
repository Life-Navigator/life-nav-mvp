"""Enable Row-Level Security for multi-tenant isolation

Revision ID: 003_enable_rls
Revises: 002_domain_tables
Create Date: 2025-11-05 20:52:00

This migration enables Row-Level Security (RLS) on all 43 tables to enforce
multi-tenant data isolation at the PostgreSQL level. This is critical for
HIPAA compliance and data security.

Creates:
- Session context functions (set_session_context, current_tenant_id, validate_tenant_access)
- RLS policies on all tenant-scoped tables
- Audit log policies
- Performance indexes for RLS

"""
from typing import Sequence, Union
from pathlib import Path

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '003_enable_rls'
down_revision: Union[str, None] = '002_domain_tables'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def load_sql_file(filename: str) -> str:
    """Load SQL from migration file."""
    migrations_dir = Path(__file__).parent.parent.parent / "app" / "db" / "migrations"
    sql_file = migrations_dir / filename
    return sql_file.read_text()


def upgrade() -> None:
    """Upgrade database schema."""

    # Load and execute the RLS setup SQL
    sql = load_sql_file("003_enable_rls.sql")
    op.execute(sql)


def downgrade() -> None:
    """Downgrade database schema."""

    # Disable RLS and drop policies on all tables
    op.execute("""
    -- Disable RLS on all tables
    ALTER TABLE financial_accounts DISABLE ROW LEVEL SECURITY;
    ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
    ALTER TABLE budgets DISABLE ROW LEVEL SECURITY;
    ALTER TABLE career_profiles DISABLE ROW LEVEL SECURITY;
    ALTER TABLE job_applications DISABLE ROW LEVEL SECURITY;
    ALTER TABLE interviews DISABLE ROW LEVEL SECURITY;
    ALTER TABLE education_credentials DISABLE ROW LEVEL SECURITY;
    ALTER TABLE courses DISABLE ROW LEVEL SECURITY;
    ALTER TABLE goals DISABLE ROW LEVEL SECURITY;
    ALTER TABLE milestones DISABLE ROW LEVEL SECURITY;
    ALTER TABLE health_conditions DISABLE ROW LEVEL SECURITY;
    ALTER TABLE medications DISABLE ROW LEVEL SECURITY;
    ALTER TABLE contacts DISABLE ROW LEVEL SECURITY;
    ALTER TABLE contact_interactions DISABLE ROW LEVEL SECURITY;
    ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;

    -- Drop session context functions
    DROP FUNCTION IF EXISTS current_tenant_id();
    DROP FUNCTION IF EXISTS current_user_id();
    DROP FUNCTION IF EXISTS validate_tenant_access(UUID);
    DROP FUNCTION IF EXISTS set_session_context(UUID, UUID);
    """)
