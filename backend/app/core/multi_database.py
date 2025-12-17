"""
Multi-Database Session Management for Three-Database Architecture.

This module manages connections to:
  - Supabase (Primary): Non-compliance data via Supabase client
      Region: us-east-1 (North Virginia)
      Compute: Small (2-core ARM, 4GB RAM) - scale up as needed
  - CloudSQL HIPAA: Health data via SQLAlchemy async
      Region: us-central1 (Iowa)
  - CloudSQL Financial: Financial data via SQLAlchemy async
      Region: us-central1 (Iowa)

Data Routing:
  - Use get_supabase_client() for: users, career, education, goals, relationships
  - Use get_hipaa_session() for: health_conditions, medications, diagnoses
  - Use get_financial_session() for: accounts, transactions, investments
"""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings
from app.core.logging import logger

if TYPE_CHECKING:
    from supabase import AsyncClient


class DatabaseType(str, Enum):
    """Enum for identifying which database to use."""
    SUPABASE = "supabase"      # Primary - non-compliance data
    HIPAA = "hipaa"            # CloudSQL - health data
    FINANCIAL = "financial"    # CloudSQL - financial data


# ===========================================================================
# Global Engine Registry
# ===========================================================================

_engines: dict[DatabaseType, AsyncEngine] = {}
_session_makers: dict[DatabaseType, async_sessionmaker[AsyncSession]] = {}
_supabase_client: "AsyncClient | None" = None


# ===========================================================================
# Supabase Client (Primary Database)
# ===========================================================================

async def get_supabase_client() -> "AsyncClient":
    """
    Get the Supabase async client for primary database operations.

    Use for:
        - User authentication and sessions
        - Career profiles, job applications
        - Education records, credentials
        - Goals and milestones
        - Relationships and contacts
        - User preferences
        - Realtime subscriptions

    Example:
        client = await get_supabase_client()
        result = await client.table("users").select("*").execute()
    """
    global _supabase_client

    if _supabase_client is None:
        if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
            raise RuntimeError(
                "Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY."
            )

        from supabase import acreate_client

        _supabase_client = await acreate_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_KEY,
        )
        logger.info("Supabase client initialized", url=settings.SUPABASE_URL)

    return _supabase_client


async def close_supabase_client() -> None:
    """Close the Supabase client connection."""
    global _supabase_client

    if _supabase_client is not None:
        await _supabase_client.auth.sign_out()
        _supabase_client = None
        logger.info("Supabase client closed")


# ===========================================================================
# CloudSQL HIPAA Engine (Health Data)
# ===========================================================================

def get_hipaa_engine() -> AsyncEngine:
    """
    Get or create the HIPAA database engine.

    This connects to the isolated CloudSQL instance for health data.
    HIPAA compliance features:
        - Separate network isolation
        - Enhanced audit logging
        - Field-level encryption
        - 7-year data retention
    """
    if DatabaseType.HIPAA not in _engines:
        if not settings.DATABASE_HIPAA_URL:
            raise RuntimeError(
                "HIPAA database not configured. Set DATABASE_HIPAA_URL."
            )

        _engines[DatabaseType.HIPAA] = create_async_engine(
            settings.DATABASE_HIPAA_URL,
            echo=settings.DATABASE_ECHO,
            pool_size=settings.DATABASE_HIPAA_POOL_SIZE,
            max_overflow=settings.DATABASE_HIPAA_MAX_OVERFLOW,
            pool_timeout=settings.DATABASE_POOL_TIMEOUT,
            pool_recycle=settings.DATABASE_POOL_RECYCLE,
            pool_pre_ping=True,
        )

        logger.info(
            "HIPAA database engine created",
            pool_size=settings.DATABASE_HIPAA_POOL_SIZE,
            compliance="HIPAA",
        )

    return _engines[DatabaseType.HIPAA]


def get_hipaa_session_maker() -> async_sessionmaker[AsyncSession]:
    """Get the HIPAA database session maker."""
    if DatabaseType.HIPAA not in _session_makers:
        engine = get_hipaa_engine()
        _session_makers[DatabaseType.HIPAA] = async_sessionmaker(
            engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False,
        )

    return _session_makers[DatabaseType.HIPAA]


async def get_hipaa_session() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency for HIPAA database session.

    Use for:
        - health_conditions
        - medications
        - diagnoses
        - treatments
        - health_records
        - provider_notes
        - hipaa_audit_logs

    Example:
        @app.get("/health/conditions")
        async def get_conditions(db: AsyncSession = Depends(get_hipaa_session)):
            result = await db.execute(select(HealthCondition))
            return result.scalars().all()
    """
    session_maker = get_hipaa_session_maker()
    async with session_maker() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


@asynccontextmanager
async def get_hipaa_session_context() -> AsyncGenerator[AsyncSession, None]:
    """Context manager for HIPAA database session outside FastAPI."""
    session_maker = get_hipaa_session_maker()
    async with session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ===========================================================================
# CloudSQL Financial Engine (Financial Data)
# ===========================================================================

def get_financial_engine() -> AsyncEngine:
    """
    Get or create the Financial database engine.

    This connects to the isolated CloudSQL instance for financial data.
    PCI-DSS/SOX compliance features:
        - Separate network isolation
        - Full statement logging
        - Field-level encryption
        - 7-year data retention
    """
    if DatabaseType.FINANCIAL not in _engines:
        if not settings.DATABASE_FINANCIAL_URL:
            raise RuntimeError(
                "Financial database not configured. Set DATABASE_FINANCIAL_URL."
            )

        _engines[DatabaseType.FINANCIAL] = create_async_engine(
            settings.DATABASE_FINANCIAL_URL,
            echo=settings.DATABASE_ECHO,
            pool_size=settings.DATABASE_FINANCIAL_POOL_SIZE,
            max_overflow=settings.DATABASE_FINANCIAL_MAX_OVERFLOW,
            pool_timeout=settings.DATABASE_POOL_TIMEOUT,
            pool_recycle=settings.DATABASE_POOL_RECYCLE,
            pool_pre_ping=True,
        )

        logger.info(
            "Financial database engine created",
            pool_size=settings.DATABASE_FINANCIAL_POOL_SIZE,
            compliance="PCI-DSS/SOX",
        )

    return _engines[DatabaseType.FINANCIAL]


def get_financial_session_maker() -> async_sessionmaker[AsyncSession]:
    """Get the Financial database session maker."""
    if DatabaseType.FINANCIAL not in _session_makers:
        engine = get_financial_engine()
        _session_makers[DatabaseType.FINANCIAL] = async_sessionmaker(
            engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False,
        )

    return _session_makers[DatabaseType.FINANCIAL]


async def get_financial_session() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency for Financial database session.

    Use for:
        - financial_accounts
        - transactions
        - investments
        - tax_documents
        - plaid_connections
        - stripe_customers
        - financial_audit_logs

    Example:
        @app.get("/finance/accounts")
        async def get_accounts(db: AsyncSession = Depends(get_financial_session)):
            result = await db.execute(select(FinancialAccount))
            return result.scalars().all()
    """
    session_maker = get_financial_session_maker()
    async with session_maker() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


@asynccontextmanager
async def get_financial_session_context() -> AsyncGenerator[AsyncSession, None]:
    """Context manager for Financial database session outside FastAPI."""
    session_maker = get_financial_session_maker()
    async with session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ===========================================================================
# Lifecycle Management
# ===========================================================================

async def init_all_databases() -> None:
    """
    Initialize all database connections.
    Call this during application startup.
    """
    logger.info("Initializing three-database architecture...")

    # Initialize Supabase client
    if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_KEY:
        await get_supabase_client()
        logger.info("Supabase client ready", database="primary")
    else:
        logger.warning("Supabase not configured - skipping primary database")

    # Initialize HIPAA engine
    if settings.DATABASE_HIPAA_URL:
        get_hipaa_engine()
        logger.info("HIPAA database ready", database="hipaa")
    else:
        logger.warning("HIPAA database not configured - skipping")

    # Initialize Financial engine
    if settings.DATABASE_FINANCIAL_URL:
        get_financial_engine()
        logger.info("Financial database ready", database="financial")
    else:
        logger.warning("Financial database not configured - skipping")

    logger.info("Database initialization complete")


async def close_all_databases() -> None:
    """
    Close all database connections.
    Call this during application shutdown.
    """
    logger.info("Closing all database connections...")

    # Close Supabase
    await close_supabase_client()

    # Close SQLAlchemy engines
    for db_type, engine in _engines.items():
        await engine.dispose()
        logger.info(f"{db_type.value} database connection closed")

    _engines.clear()
    _session_makers.clear()

    logger.info("All database connections closed")


async def check_all_databases_health() -> dict[str, bool]:
    """
    Check health of all database connections.

    Returns:
        Dict with database type as key and health status as value.
    """
    from sqlalchemy import text

    health: dict[str, bool] = {}

    # Check Supabase
    try:
        if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_KEY:
            client = await get_supabase_client()
            # Simple health check - list tables
            await client.table("_health_check").select("*").limit(1).execute()
            health["supabase"] = True
        else:
            health["supabase"] = False
    except Exception as e:
        logger.error("Supabase health check failed", error=str(e))
        health["supabase"] = False

    # Check HIPAA database
    try:
        if settings.DATABASE_HIPAA_URL:
            async with get_hipaa_session_context() as session:
                await session.execute(text("SELECT 1"))
            health["hipaa"] = True
        else:
            health["hipaa"] = False
    except Exception as e:
        logger.error("HIPAA database health check failed", error=str(e))
        health["hipaa"] = False

    # Check Financial database
    try:
        if settings.DATABASE_FINANCIAL_URL:
            async with get_financial_session_context() as session:
                await session.execute(text("SELECT 1"))
            health["financial"] = True
        else:
            health["financial"] = False
    except Exception as e:
        logger.error("Financial database health check failed", error=str(e))
        health["financial"] = False

    return health


# ===========================================================================
# Data Routing Helper
# ===========================================================================

# Tables that belong to each database
SUPABASE_TABLES = {
    "users",
    "tenants",
    "user_preferences",
    "career_profiles",
    "job_applications",
    "interviews",
    "education_credentials",
    "courses",
    "certifications",
    "goals",
    "milestones",
    "habits",
    "contacts",
    "relationships",
    "notifications",
    "audit_logs",  # Non-HIPAA audit logs
}

HIPAA_TABLES = {
    "health_conditions",
    "health_records",
    "medications",
    "diagnoses",
    "treatments",
    "medical_appointments",
    "hipaa_audit_logs",
}

FINANCIAL_TABLES = {
    "financial_accounts",
    "transactions",
    "investments",
    "budgets",
    "tax_documents",
    "plaid_connections",
    "stripe_customers",
    "stripe_subscriptions",
    "financial_audit_logs",
}


def get_database_for_table(table_name: str) -> DatabaseType:
    """
    Determine which database a table belongs to.

    Args:
        table_name: Name of the database table

    Returns:
        DatabaseType enum indicating which database to use

    Raises:
        ValueError: If table is not mapped to any database
    """
    if table_name in HIPAA_TABLES:
        return DatabaseType.HIPAA
    elif table_name in FINANCIAL_TABLES:
        return DatabaseType.FINANCIAL
    elif table_name in SUPABASE_TABLES:
        return DatabaseType.SUPABASE
    else:
        # Default to Supabase for unknown tables
        logger.warning(
            f"Table '{table_name}' not explicitly mapped, defaulting to Supabase"
        )
        return DatabaseType.SUPABASE
