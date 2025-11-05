"""
Database configuration and session management
"""

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool
from typing import AsyncGenerator
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

# Create async engine
engine = create_async_engine(
    settings.DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://'),
    echo=settings.DEBUG,
    future=True,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_pre_ping=True,  # Verify connections before using
    poolclass=NullPool if settings.ENVIRONMENT == "development" else None,
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Create declarative base
Base = declarative_base()

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency to get database session
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception as e:
            await session.rollback()
            logger.error(f"Database session error: {str(e)}")
            raise
        finally:
            await session.close()

async def init_db():
    """
    Initialize database - create all tables
    """
    async with engine.begin() as conn:
        # Import all models to ensure they're registered
        from app.models import financial_profile  # noqa
        
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created successfully")

async def close_db():
    """
    Close database connections
    """
    await engine.dispose()
    logger.info("Database connections closed")

class DatabaseManager:
    """
    Database manager for complex operations
    """
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def execute_transaction(self, operations):
        """
        Execute multiple operations in a single transaction
        """
        try:
            for operation in operations:
                await operation(self.session)
            await self.session.commit()
            return True
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Transaction failed: {str(e)}")
            raise
    
    async def bulk_insert(self, model_class, records):
        """
        Bulk insert records
        """
        try:
            self.session.add_all([model_class(**record) for record in records])
            await self.session.commit()
            return True
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Bulk insert failed: {str(e)}")
            raise
    
    async def upsert(self, model_class, **kwargs):
        """
        Insert or update a record
        """
        from sqlalchemy import select
        from sqlalchemy.dialects.postgresql import insert
        
        stmt = insert(model_class).values(**kwargs)
        stmt = stmt.on_conflict_do_update(
            index_elements=['id'],
            set_=kwargs
        )
        
        await self.session.execute(stmt)
        await self.session.commit()
        return True