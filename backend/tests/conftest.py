"""
Pytest configuration and fixtures for backend tests.

This module provides reusable fixtures for:
- Database session management with test isolation
- FastAPI test client
- Authentication and user creation
- Multi-tenant test data
- RLS (Row-Level Security) context
"""

import asyncio
import os
from typing import AsyncGenerator, Generator
from uuid import UUID, uuid4

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import Session, SessionTransaction

from app.core.config import settings
from app.core.database import Base, get_session, set_tenant_context
from app.core.security import create_access_token, get_password_hash
from app.main import app
from app.models.user import Organization, Tenant, User, UserTenant


# ============================================================================
# Test Database Setup
# ============================================================================

# Use a separate test database
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/lifenavigator_test"
)

# Create async engine for tests
test_engine = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,  # Set to True for SQL query logging
    future=True,
)

# Create session factory
TestSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


# ============================================================================
# Pytest Configuration
# ============================================================================

def pytest_configure(config):
    """Configure pytest with custom markers."""
    config.addinivalue_line("markers", "asyncio: mark test as async")
    config.addinivalue_line("markers", "integration: mark test as integration test")
    config.addinivalue_line("markers", "unit: mark test as unit test")


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create an event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


# ============================================================================
# Database Fixtures
# ============================================================================

@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Create a new database session for each test.

    Uses nested transactions to ensure test isolation:
    - Outer transaction is rolled back after test
    - All changes made during test are discarded
    """
    # Create tables if they don't exist
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Create session
    async with TestSessionLocal() as session:
        # Begin a transaction
        await session.begin()

        yield session

        # Rollback after test
        await session.rollback()


@pytest_asyncio.fixture(scope="function")
async def db_session_with_rls(db_session: AsyncSession, test_tenant: Tenant, test_user: User) -> AsyncSession:
    """
    Database session with RLS context set.

    Automatically sets the tenant and user context for Row-Level Security.
    """
    await set_tenant_context(db_session, str(test_tenant.id), str(test_user.id))
    return db_session


# ============================================================================
# FastAPI Client Fixture
# ============================================================================

@pytest.fixture(scope="function")
def client(db_session: AsyncSession) -> TestClient:
    """
    FastAPI test client with overridden database dependency.

    All requests made with this client will use the test database.
    """
    async def override_get_session() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_session] = override_get_session

    with TestClient(app) as test_client:
        yield test_client

    # Clean up
    app.dependency_overrides.clear()


# ============================================================================
# Authentication Fixtures
# ============================================================================

@pytest_asyncio.fixture(scope="function")
async def test_organization(db_session: AsyncSession) -> Organization:
    """Create a test organization."""
    org = Organization(
        name="Test Organization",
        slug="test-org",
        email="test@example.com",
        subscription_tier="pro",
        subscription_status="active",
    )
    db_session.add(org)
    await db_session.commit()
    await db_session.refresh(org)
    return org


@pytest_asyncio.fixture(scope="function")
async def test_tenant(db_session: AsyncSession, test_organization: Organization) -> Tenant:
    """Create a test tenant."""
    tenant = Tenant(
        organization_id=test_organization.id,
        name="Test Workspace",
        slug="test-workspace",
        hipaa_enabled=True,
        encryption_at_rest=True,
        audit_log_enabled=True,
    )
    db_session.add(tenant)
    await db_session.commit()
    await db_session.refresh(tenant)
    return tenant


@pytest_asyncio.fixture(scope="function")
async def test_user(db_session: AsyncSession) -> User:
    """Create a test user."""
    user = User(
        email="testuser@example.com",
        email_verified=True,
        first_name="Test",
        last_name="User",
        password_hash=get_password_hash("testpassword123"),
        status="active",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture(scope="function")
async def test_user_tenant(
    db_session: AsyncSession,
    test_user: User,
    test_tenant: Tenant
) -> UserTenant:
    """Create a user-tenant membership (owner role)."""
    user_tenant = UserTenant(
        user_id=test_user.id,
        tenant_id=test_tenant.id,
        role="owner",
        is_active=True,
    )
    db_session.add(user_tenant)
    await db_session.commit()
    await db_session.refresh(user_tenant)
    return user_tenant


@pytest.fixture(scope="function")
def auth_token(test_user: User, test_tenant: Tenant) -> str:
    """
    Generate a valid JWT access token for the test user.

    Token includes tenant_id for RLS context.
    """
    return create_access_token(
        data={
            "sub": str(test_user.id),
            "email": test_user.email,
            "tenant_id": str(test_tenant.id),
        }
    )


@pytest.fixture(scope="function")
def auth_headers(auth_token: str) -> dict:
    """HTTP headers with Bearer token authentication."""
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture(scope="function")
def authenticated_client(client: TestClient, auth_headers: dict) -> TestClient:
    """
    Test client with authentication headers pre-set.

    Use this for testing protected endpoints.
    """
    client.headers.update(auth_headers)
    return client


# ============================================================================
# Multi-Tenant Test Fixtures
# ============================================================================

@pytest_asyncio.fixture(scope="function")
async def second_tenant(db_session: AsyncSession, test_organization: Organization) -> Tenant:
    """Create a second tenant for testing tenant isolation."""
    tenant = Tenant(
        organization_id=test_organization.id,
        name="Second Workspace",
        slug="second-workspace",
        hipaa_enabled=True,
    )
    db_session.add(tenant)
    await db_session.commit()
    await db_session.refresh(tenant)
    return tenant


@pytest_asyncio.fixture(scope="function")
async def second_user(db_session: AsyncSession) -> User:
    """Create a second user for testing access controls."""
    user = User(
        email="seconduser@example.com",
        email_verified=True,
        first_name="Second",
        last_name="User",
        password_hash=get_password_hash("password456"),
        status="active",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


# ============================================================================
# Cleanup Fixtures
# ============================================================================

@pytest.fixture(scope="session", autouse=True)
async def cleanup_db():
    """Drop all tables after test session."""
    yield

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
