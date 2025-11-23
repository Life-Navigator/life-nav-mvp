"""
Database session management and connection pooling.
Uses async SQLAlchemy with asyncpg driver.
"""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import AsyncAdaptedQueuePool, NullPool

from app.core.config import settings
from app.core.logging import logger


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""

    pass


# Global engine and session maker
_engine: AsyncEngine | None = None
_async_session_maker: async_sessionmaker[AsyncSession] | None = None


def get_engine() -> AsyncEngine:
    """
    Get or create the async database engine.
    Uses connection pooling for production, NullPool for testing.
    """
    global _engine

    if _engine is None:
        # Use AsyncAdaptedQueuePool for all environments (compatible with asyncio)

        _engine = create_async_engine(
            str(settings.DATABASE_URL),
            echo=settings.DATABASE_ECHO,
            pool_size=settings.DATABASE_POOL_SIZE,
            max_overflow=settings.DATABASE_MAX_OVERFLOW,
            pool_timeout=settings.DATABASE_POOL_TIMEOUT,
            pool_recycle=settings.DATABASE_POOL_RECYCLE,
            pool_pre_ping=True,  # Verify connections before using
        )

        # Set up event listeners
        _setup_engine_listeners(_engine)

        logger.info(
            "Database engine created",
            pool_size=settings.DATABASE_POOL_SIZE,
            max_overflow=settings.DATABASE_MAX_OVERFLOW,
        )

    return _engine


def get_session_maker() -> async_sessionmaker[AsyncSession]:
    """Get or create the async session maker."""
    global _async_session_maker

    if _async_session_maker is None:
        engine = get_engine()
        _async_session_maker = async_sessionmaker(
            engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False,
        )

    return _async_session_maker


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency for getting database session.

    Usage:
        @app.get("/users")
        async def get_users(db: AsyncSession = Depends(get_session)):
            result = await db.execute(select(User))
            return result.scalars().all()
    """
    session_maker = get_session_maker()
    async with session_maker() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


@asynccontextmanager
async def get_session_context() -> AsyncGenerator[AsyncSession, None]:
    """
    Context manager for getting database session outside FastAPI.

    Usage:
        async with get_session_context() as session:
            result = await session.execute(select(User))
    """
    session_maker = get_session_maker()
    async with session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def set_tenant_context(session: AsyncSession, tenant_id: str, user_id: str) -> None:
    """
    Set the tenant context for Row-Level Security.
    Must be called before any queries that rely on RLS policies.

    Args:
        session: Database session
        tenant_id: Tenant UUID
        user_id: User UUID
    """
    await session.execute(
        text("SELECT set_session_context(:user_id, :tenant_id)"),
        {"user_id": user_id, "tenant_id": tenant_id},
    )
    logger.debug("Tenant context set", tenant_id=tenant_id, user_id=user_id)


async def clear_tenant_context(session: AsyncSession) -> None:
    """
    Clear the tenant context (for security).
    Should be called after request completes.

    Args:
        session: Database session
    """
    await session.execute(text("SELECT clear_session_context()"))
    logger.debug("Tenant context cleared")


def _setup_engine_listeners(engine: AsyncEngine) -> None:
    """Set up event listeners for the engine."""

    @event.listens_for(engine.sync_engine, "connect")
    def receive_connect(dbapi_conn: Any, connection_record: Any) -> None:
        """Handle new database connections."""
        logger.debug("Database connection established")

    @event.listens_for(engine.sync_engine, "close")
    def receive_close(dbapi_conn: Any, connection_record: Any) -> None:
        """Handle database connection closes."""
        logger.debug("Database connection closed")


async def init_db() -> None:
    """
    Initialize database.
    Creates all tables (if they don't exist).
    Note: In production, use Alembic migrations instead.
    """
    engine = get_engine()
    async with engine.begin() as conn:
        # Import all models to ensure they're registered
        from app.models import (  # noqa: F401
            career,
            education,
            finance,
            goals,
            health,
            relationships,
            user,
        )

        await conn.run_sync(Base.metadata.create_all)
        logger.info("Database initialized")


async def close_db() -> None:
    """Close database connections and dispose of the engine."""
    global _engine, _async_session_maker

    if _engine is not None:
        await _engine.dispose()
        _engine = None
        _async_session_maker = None
        logger.info("Database connections closed")


async def check_db_health() -> bool:
    """
    Check database health.
    Returns True if database is reachable, False otherwise.
    """
    try:
        async with get_session_context() as session:
            await session.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error("Database health check failed", error=str(e))
        return False
