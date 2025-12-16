"""
Database session management for a multi-database architecture.
- Main (HIPAA-compliant Cloud SQL)
- Financial (PCI-compliant Cloud SQL)
- Supabase (General, non-sensitive data)
"""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any, Callable

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings
from app.core.logging import logger

class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass

# Global engines and session makers
_engine_main: AsyncEngine | None = None
_engine_financial: AsyncEngine | None = None
_engine_supabase: AsyncEngine | None = None

_async_session_maker_main: async_sessionmaker[AsyncSession] | None = None
_async_session_maker_financial: async_sessionmaker[AsyncSession] | None = None
_async_session_maker_supabase: async_sessionmaker[AsyncSession] | None = None


def _create_engine(url: str, **kwargs) -> AsyncEngine:
    """Helper to create and configure a new async engine."""
    if not url:
        raise ValueError("Database URL cannot be empty")

    engine = create_async_engine(
        url,
        echo=settings.DATABASE_ECHO,
        pool_size=settings.DATABASE_POOL_SIZE,
        max_overflow=settings.DATABASE_MAX_OVERFLOW,
        pool_timeout=settings.DATABASE_POOL_TIMEOUT,
        pool_recycle=settings.DATABASE_POOL_RECYCLE,
        pool_pre_ping=True,
    )
    _setup_engine_listeners(engine)
    return engine

def get_main_engine() -> AsyncEngine:
    """Get or create the main database engine."""
    global _engine_main
    if _engine_main is None:
        _engine_main = _create_engine(str(settings.DATABASE_URL))
        logger.info("Main database engine created.")
    return _engine_main

def get_financial_engine() -> AsyncEngine | None:
    """Get or create the financial database engine, if configured."""
    global _engine_financial
    if _engine_financial is None and settings.DATABASE_FINANCIAL_URL:
        _engine_financial = _create_engine(settings.DATABASE_FINANCIAL_URL)
        logger.info("Financial database engine created.")
    return _engine_financial

def get_supabase_engine() -> AsyncEngine | None:
    """Get or create the Supabase database engine, if configured."""
    global _engine_supabase
    if _engine_supabase is None and settings.SUPABASE_URL:
        # Supabase uses a different URL format for direct DB connection
        db_url = settings.SUPABASE_URL.replace('https', 'postgresql').replace('.co', '.com')
        _engine_supabase = _create_engine(db_url)
        logger.info("Supabase database engine created.")
    return _engine_supabase


def _get_session_maker(engine_getter: Callable[..., AsyncEngine | None]) -> async_sessionmaker[AsyncSession] | None:
    """Helper to create a session maker from an engine getter."""
    engine = engine_getter()
    if engine:
        return async_sessionmaker(
            engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False,
        )
    return None

def get_main_session_maker() -> async_sessionmaker[AsyncSession]:
    """Get the session maker for the main database."""
    global _async_session_maker_main
    if _async_session_maker_main is None:
        _async_session_maker_main = _get_session_maker(get_main_engine)
    return _async_session_maker_main

def get_financial_session_maker() -> async_sessionmaker[AsyncSession] | None:
    """Get the session maker for the financial database."""
    global _async_session_maker_financial
    if _async_session_maker_financial is None:
        _async_session_maker_financial = _get_session_maker(get_financial_engine)
    return _async_session_maker_financial

def get_supabase_session_maker() -> async_sessionmaker[AsyncSession] | None:
    """Get the session maker for the Supabase database."""
    global _async_session_maker_supabase
    if _async_session_maker_supabase is None:
        _async_session_maker_supabase = _get_session_maker(get_supabase_engine)
    return _async_session_maker_supabase


async def _get_session(session_maker: async_sessionmaker[AsyncSession] | None) -> AsyncGenerator[AsyncSession, None]:
    """Generic dependency for getting a database session."""
    if not session_maker:
        raise RuntimeError("Database not configured for this session type.")
    async with session_maker() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

async def get_main_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for the main database session."""
    yield await _get_session(get_main_session_maker())

async def get_financial_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for the financial database session."""
    yield await _get_session(get_financial_session_maker())

async def get_supabase_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for the Supabase database session."""
    yield await _get_session(get_supabase_session_maker())


# Alias for backward compatibility - defaults to main database
get_session = get_main_session


@asynccontextmanager
async def get_session_context(db_type: str = "main") -> AsyncGenerator[AsyncSession, None]:
    """Context manager for getting a database session outside FastAPI."""
    session_makers = {
        "main": get_main_session_maker,
        "financial": get_financial_session_maker,
        "supabase": get_supabase_session_maker,
    }
    session_maker = session_makers.get(db_type)()
    if not session_maker:
        raise RuntimeError(f"Database not configured for type: {db_type}")

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
    """Set RLS context. Assumes function exists on the database."""
    await session.execute(
        text("SELECT set_session_context(:user_id, :tenant_id)"),
        {"user_id": user_id, "tenant_id": tenant_id},
    )

async def clear_tenant_context(session: AsyncSession) -> None:
    """Clear RLS context."""
    await session.execute(text("SELECT clear_session_context()"))


def _setup_engine_listeners(engine: AsyncEngine) -> None:
    """Set up diagnostic event listeners for an engine."""
    @event.listens_for(engine.sync_engine, "connect")
    def receive_connect(dbapi_conn: Any, connection_record: Any) -> None:
        logger.debug(f"Database connection established for {engine.url.database}")

    @event.listens_for(engine.sync_engine, "close")
    def receive_close(dbapi_conn: Any, connection_record: Any) -> None:
        logger.debug(f"Database connection closed for {engine.url.database}")


async def init_db() -> None:
    """Initialize database connections and create tables if needed (dev mode only)."""
    # In production, tables are managed via migrations
    # This function ensures engines are initialized
    get_main_engine()
    get_financial_engine()
    get_supabase_engine()
    logger.info("Database engines initialized.")


async def close_db() -> None:
    """Close all database connections."""
    global _engine_main, _engine_financial, _engine_supabase
    global _async_session_maker_main, _async_session_maker_financial, _async_session_maker_supabase

    for engine in [_engine_main, _engine_financial, _engine_supabase]:
        if engine:
            await engine.dispose()

    _engine_main = _engine_financial = _engine_supabase = None
    _async_session_maker_main = _async_session_maker_financial = _async_session_maker_supabase = None
    logger.info("All database connections closed.")


async def check_db_health(db_type: str = "main") -> bool:
    """Check health of a specific database."""
    try:
        async with get_session_context(db_type) as session:
            await session.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error(f"{db_type} database health check failed", error=str(e))
        return False
