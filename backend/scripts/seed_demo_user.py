#!/usr/bin/env python3
"""
Seed script to create a demo user for development/testing.

Usage:
    cd backend
    source venv/bin/activate
    python scripts/seed_demo_user.py
"""

import asyncio
import sys
from pathlib import Path

# Add the backend directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent))

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import bcrypt

from app.core.database import get_session_context
from app.models.user import Organization, Tenant, User, UserTenant, UserTenantRole


def get_password_hash(password: str) -> str:
    """Hash password using bcrypt directly."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


# Demo user credentials
DEMO_EMAIL = "demo@lifenavigator.app"
DEMO_PASSWORD = "DemoUser2024!"
DEMO_FIRST_NAME = "Demo"
DEMO_LAST_NAME = "User"
DEMO_TENANT_NAME = "Demo Workspace"


async def seed_demo_user():
    """Create demo user if it doesn't exist."""
    async with get_session_context() as db:
        # Check if demo user already exists
        result = await db.execute(select(User).where(User.email == DEMO_EMAIL))
        existing_user = result.scalar_one_or_none()

        if existing_user:
            print(f"Demo user already exists: {DEMO_EMAIL}")
            return

        print(f"Creating demo user: {DEMO_EMAIL}")

        # Hash password
        hashed_password = get_password_hash(DEMO_PASSWORD)

        # Create organization
        org = Organization(
            name=DEMO_TENANT_NAME,
            slug="demo-workspace",
            email=DEMO_EMAIL,
        )
        db.add(org)
        await db.flush()

        # Create tenant
        tenant = Tenant(
            organization_id=org.id,
            name=DEMO_TENANT_NAME,
            slug="demo-workspace",
        )
        db.add(tenant)
        await db.flush()

        # Create user
        user = User(
            email=DEMO_EMAIL,
            password_hash=hashed_password,
            first_name=DEMO_FIRST_NAME,
            last_name=DEMO_LAST_NAME,
            display_name=f"{DEMO_FIRST_NAME} {DEMO_LAST_NAME}",
            status="active",
            email_verified_at=datetime.utcnow(),  # Pre-verify for demo
        )
        db.add(user)
        await db.flush()

        # Create user-tenant membership with owner role
        user_tenant = UserTenant(
            user_id=user.id,
            tenant_id=tenant.id,
            role=UserTenantRole.OWNER,
            joined_at=datetime.utcnow(),
            status="active",
        )
        db.add(user_tenant)

        await db.commit()

        print(f"Demo user created successfully!")
        print(f"  Email: {DEMO_EMAIL}")
        print(f"  Password: {DEMO_PASSWORD}")
        print(f"  Tenant: {DEMO_TENANT_NAME}")


if __name__ == "__main__":
    print("=" * 60)
    print("Life Navigator - Demo User Seeder")
    print("=" * 60)
    asyncio.run(seed_demo_user())
    print("=" * 60)
    print("Done!")
