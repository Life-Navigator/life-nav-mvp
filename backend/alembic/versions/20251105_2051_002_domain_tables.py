"""Create domain tables for all 6 modules

Revision ID: 002_domain_tables
Revises: 001_initial_schema
Create Date: 2025-11-05 20:51:00

This migration creates all domain-specific tables:
- Finance: financial_accounts, transactions, budgets
- Career: career_profiles, job_applications, interviews
- Education: education_credentials, courses
- Goals: goals, milestones
- Health: health_conditions, medications
- Relationships: contacts, contact_interactions

Total: 43 tables across 6 domains

"""
from typing import Sequence, Union
from pathlib import Path

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '002_domain_tables'
down_revision: Union[str, None] = '001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def load_sql_file(filename: str) -> str:
    """Load SQL from migration file."""
    migrations_dir = Path(__file__).parent.parent.parent / "app" / "db" / "migrations"
    sql_file = migrations_dir / filename
    return sql_file.read_text()


def upgrade() -> None:
    """Upgrade database schema."""

    # Load and execute the domain tables SQL
    sql = load_sql_file("002_create_domain_tables.sql")
    op.execute(sql)


def downgrade() -> None:
    """Downgrade database schema."""

    # Drop all domain tables in reverse order
    op.execute("""
    -- Relationships domain
    DROP TABLE IF EXISTS contact_interactions CASCADE;
    DROP TABLE IF EXISTS contacts CASCADE;

    -- Health domain
    DROP TABLE IF EXISTS medications CASCADE;
    DROP TABLE IF EXISTS health_conditions CASCADE;

    -- Goals domain
    DROP TABLE IF EXISTS milestones CASCADE;
    DROP TABLE IF EXISTS goals CASCADE;

    -- Education domain
    DROP TABLE IF EXISTS courses CASCADE;
    DROP TABLE IF EXISTS education_credentials CASCADE;

    -- Career domain
    DROP TABLE IF EXISTS interviews CASCADE;
    DROP TABLE IF EXISTS job_applications CASCADE;
    DROP TABLE IF EXISTS career_profiles CASCADE;

    -- Finance domain
    DROP TABLE IF EXISTS budgets CASCADE;
    DROP TABLE IF EXISTS transactions CASCADE;
    DROP TABLE IF EXISTS financial_accounts CASCADE;
    """)
