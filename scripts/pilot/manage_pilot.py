#!/usr/bin/env python3
"""
Pilot User Management CLI

Manage pilot program users: add, remove, list, and modify pilot access.

Usage:
    python manage_pilot.py add --email user@example.com --duration 90
    python manage_pilot.py add --email user@example.com --role investor
    python manage_pilot.py list --role pilot
    python manage_pilot.py list --all
    python manage_pilot.py info --email user@example.com
    python manage_pilot.py revoke --email user@example.com
    python manage_pilot.py extend --email user@example.com --days 30
    python manage_pilot.py promote --email user@example.com --role admin

Environment Variables:
    DATABASE_URL: PostgreSQL connection string (required)
"""

import argparse
import asyncio
import os
import sys
from datetime import datetime, timedelta
from typing import Optional

# Add the backend app to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../backend'))

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker


# Pilot role and user type enums (matching the model)
PILOT_ROLES = ['waitlist', 'investor', 'pilot', 'admin']
USER_TYPES = ['civilian', 'military', 'veteran']


def get_database_url() -> str:
    """Get database URL from environment."""
    url = os.environ.get('DATABASE_URL')
    if not url:
        # Try to load from .env file
        env_paths = [
            os.path.join(os.path.dirname(__file__), '../../.env'),
            os.path.join(os.path.dirname(__file__), '../../backend/.env'),
        ]
        for env_path in env_paths:
            if os.path.exists(env_path):
                with open(env_path) as f:
                    for line in f:
                        if line.startswith('DATABASE_URL='):
                            url = line.split('=', 1)[1].strip().strip('"\'')
                            break
                if url:
                    break

    if not url:
        print("ERROR: DATABASE_URL environment variable not set")
        print("Set it or create a .env file with DATABASE_URL=postgresql://...")
        sys.exit(1)

    # Convert to async driver if needed
    if url.startswith('postgresql://'):
        url = url.replace('postgresql://', 'postgresql+asyncpg://')
    elif url.startswith('postgres://'):
        url = url.replace('postgres://', 'postgresql+asyncpg://')

    return url


async def get_session() -> AsyncSession:
    """Create database session."""
    engine = create_async_engine(get_database_url(), echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    return async_session()


async def get_user_by_email(session: AsyncSession, email: str):
    """Get user by email address."""
    from app.models.user import User
    result = await session.execute(
        select(User).where(User.email == email, User.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def add_pilot(
    email: str,
    role: str = 'pilot',
    duration_days: int = 90,
    user_type: str = 'civilian',
    notes: Optional[str] = None
) -> bool:
    """Add or upgrade a user to pilot access."""
    from app.models.user import User, PilotRole, UserType

    if role not in PILOT_ROLES:
        print(f"ERROR: Invalid role '{role}'. Must be one of: {PILOT_ROLES}")
        return False

    if user_type not in USER_TYPES:
        print(f"ERROR: Invalid user type '{user_type}'. Must be one of: {USER_TYPES}")
        return False

    async with await get_session() as session:
        user = await get_user_by_email(session, email)

        if not user:
            print(f"ERROR: User with email '{email}' not found")
            return False

        # Set pilot fields
        user.pilot_role = PilotRole(role)
        user.pilot_enabled = True
        user.pilot_start_at = datetime.utcnow()
        user.pilot_end_at = datetime.utcnow() + timedelta(days=duration_days)
        user.user_type = UserType(user_type)

        if notes:
            user.pilot_notes = notes

        # Assign waitlist position if new pilot
        if role == 'pilot':
            # Get max waitlist position
            result = await session.execute(
                select(func.max(User.waitlist_position))
            )
            max_pos = result.scalar() or 0
            user.waitlist_position = max_pos + 1

        await session.commit()

        print(f"SUCCESS: User '{email}' granted {role} access")
        print(f"  - Role: {role}")
        print(f"  - Enabled: True")
        print(f"  - Start: {user.pilot_start_at}")
        print(f"  - End: {user.pilot_end_at}")
        print(f"  - Duration: {duration_days} days")
        print(f"  - User Type: {user_type}")

        return True


async def revoke_pilot(email: str) -> bool:
    """Revoke pilot access from a user."""
    from app.models.user import User, PilotRole

    async with await get_session() as session:
        user = await get_user_by_email(session, email)

        if not user:
            print(f"ERROR: User with email '{email}' not found")
            return False

        old_role = user.pilot_role

        # Reset pilot fields
        user.pilot_role = PilotRole.WAITLIST
        user.pilot_enabled = False
        user.pilot_end_at = datetime.utcnow()  # Expire immediately
        user.pilot_notes = f"Revoked on {datetime.utcnow().isoformat()} (was: {old_role})"

        await session.commit()

        print(f"SUCCESS: Pilot access revoked for '{email}'")
        print(f"  - Previous role: {old_role}")
        print(f"  - New role: waitlist")

        return True


async def extend_pilot(email: str, days: int) -> bool:
    """Extend pilot access duration."""
    from app.models.user import User

    async with await get_session() as session:
        user = await get_user_by_email(session, email)

        if not user:
            print(f"ERROR: User with email '{email}' not found")
            return False

        if user.pilot_role.value not in ['pilot', 'admin']:
            print(f"ERROR: User '{email}' is not a pilot user (role: {user.pilot_role})")
            return False

        old_end = user.pilot_end_at

        if user.pilot_end_at:
            # Extend from current end date
            user.pilot_end_at = user.pilot_end_at + timedelta(days=days)
        else:
            # Set new end date from now
            user.pilot_end_at = datetime.utcnow() + timedelta(days=days)

        await session.commit()

        print(f"SUCCESS: Extended pilot access for '{email}'")
        print(f"  - Previous end: {old_end}")
        print(f"  - New end: {user.pilot_end_at}")
        print(f"  - Extended by: {days} days")

        return True


async def promote_user(email: str, role: str) -> bool:
    """Promote user to a different role."""
    from app.models.user import User, PilotRole

    if role not in PILOT_ROLES:
        print(f"ERROR: Invalid role '{role}'. Must be one of: {PILOT_ROLES}")
        return False

    async with await get_session() as session:
        user = await get_user_by_email(session, email)

        if not user:
            print(f"ERROR: User with email '{email}' not found")
            return False

        old_role = user.pilot_role

        user.pilot_role = PilotRole(role)
        user.pilot_enabled = role in ['pilot', 'admin', 'investor']

        await session.commit()

        print(f"SUCCESS: User '{email}' promoted")
        print(f"  - Previous role: {old_role}")
        print(f"  - New role: {role}")

        return True


async def get_user_info(email: str) -> bool:
    """Display detailed user pilot information."""
    async with await get_session() as session:
        user = await get_user_by_email(session, email)

        if not user:
            print(f"ERROR: User with email '{email}' not found")
            return False

        print(f"\nUser: {email}")
        print(f"  ID: {user.id}")
        print(f"  Name: {user.first_name} {user.last_name}")
        print(f"  Status: {user.status}")
        print(f"\nPilot Access:")
        print(f"  Role: {user.pilot_role}")
        print(f"  Enabled: {user.pilot_enabled}")
        print(f"  Start: {user.pilot_start_at}")
        print(f"  End: {user.pilot_end_at}")
        print(f"  User Type: {user.user_type}")
        print(f"  Waitlist Position: {user.waitlist_position}")

        # Access check
        print(f"\nAccess Status:")
        print(f"  Can Access Pilot App: {user.can_access_pilot_app()}")
        print(f"  Can Access Investor Dashboard: {user.can_access_investor_dashboard()}")
        print(f"  Is Admin: {user.is_admin()}")
        print(f"  Pilot Window Active: {user.is_pilot_window_active()}")

        days_remaining = user.get_pilot_days_remaining()
        if days_remaining is not None:
            print(f"  Days Remaining: {days_remaining}")

        if user.pilot_notes:
            print(f"\nNotes: {user.pilot_notes}")

        return True


async def list_users(role: Optional[str] = None, show_all: bool = False) -> bool:
    """List pilot users."""
    from app.models.user import User, PilotRole

    async with await get_session() as session:
        query = select(User).where(User.deleted_at.is_(None))

        if role and role in PILOT_ROLES:
            query = query.where(User.pilot_role == PilotRole(role))
        elif not show_all:
            # By default, show only non-waitlist users
            query = query.where(User.pilot_role != PilotRole.WAITLIST)

        query = query.order_by(User.pilot_role, User.created_at)

        result = await session.execute(query)
        users = result.scalars().all()

        if not users:
            print("No users found matching criteria")
            return True

        print(f"\n{'Email':<35} {'Role':<10} {'Enabled':<8} {'End Date':<12} {'Days Left':<10}")
        print("-" * 85)

        for user in users:
            days = user.get_pilot_days_remaining()
            days_str = str(days) if days is not None else "N/A"
            end_str = user.pilot_end_at.strftime("%Y-%m-%d") if user.pilot_end_at else "N/A"

            print(f"{user.email:<35} {user.pilot_role.value:<10} {str(user.pilot_enabled):<8} {end_str:<12} {days_str:<10}")

        print(f"\nTotal: {len(users)} users")
        return True


async def get_stats() -> bool:
    """Display pilot program statistics."""
    from app.models.user import User, PilotRole

    async with await get_session() as session:
        # Count by role
        print("\nPilot Program Statistics")
        print("=" * 40)

        for role in PILOT_ROLES:
            result = await session.execute(
                select(func.count(User.id)).where(
                    User.pilot_role == PilotRole(role),
                    User.deleted_at.is_(None)
                )
            )
            count = result.scalar()
            print(f"  {role.capitalize():<15}: {count}")

        # Active pilots
        now = datetime.utcnow()
        result = await session.execute(
            select(func.count(User.id)).where(
                User.pilot_role == PilotRole.PILOT,
                User.pilot_enabled == True,
                User.pilot_start_at <= now,
                (User.pilot_end_at.is_(None) | (User.pilot_end_at > now)),
                User.deleted_at.is_(None)
            )
        )
        active_count = result.scalar()
        print(f"\n  Active Pilots: {active_count}")

        # Expiring soon (7 days)
        soon = now + timedelta(days=7)
        result = await session.execute(
            select(func.count(User.id)).where(
                User.pilot_role == PilotRole.PILOT,
                User.pilot_enabled == True,
                User.pilot_end_at.isnot(None),
                User.pilot_end_at > now,
                User.pilot_end_at <= soon,
                User.deleted_at.is_(None)
            )
        )
        expiring_count = result.scalar()
        print(f"  Expiring Soon: {expiring_count}")

        return True


def main():
    parser = argparse.ArgumentParser(
        description="Manage LifeNavigator pilot program users",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    subparsers = parser.add_subparsers(dest='command', help='Available commands')

    # Add command
    add_parser = subparsers.add_parser('add', help='Add user to pilot program')
    add_parser.add_argument('--email', required=True, help='User email address')
    add_parser.add_argument('--role', default='pilot', choices=PILOT_ROLES, help='Pilot role')
    add_parser.add_argument('--duration', type=int, default=90, help='Access duration in days')
    add_parser.add_argument('--user-type', default='civilian', choices=USER_TYPES, help='User type')
    add_parser.add_argument('--notes', help='Admin notes')

    # Revoke command
    revoke_parser = subparsers.add_parser('revoke', help='Revoke pilot access')
    revoke_parser.add_argument('--email', required=True, help='User email address')

    # Extend command
    extend_parser = subparsers.add_parser('extend', help='Extend pilot access duration')
    extend_parser.add_argument('--email', required=True, help='User email address')
    extend_parser.add_argument('--days', type=int, required=True, help='Days to extend')

    # Promote command
    promote_parser = subparsers.add_parser('promote', help='Change user role')
    promote_parser.add_argument('--email', required=True, help='User email address')
    promote_parser.add_argument('--role', required=True, choices=PILOT_ROLES, help='New role')

    # Info command
    info_parser = subparsers.add_parser('info', help='Show user pilot information')
    info_parser.add_argument('--email', required=True, help='User email address')

    # List command
    list_parser = subparsers.add_parser('list', help='List pilot users')
    list_parser.add_argument('--role', choices=PILOT_ROLES, help='Filter by role')
    list_parser.add_argument('--all', action='store_true', help='Show all users including waitlist')

    # Stats command
    subparsers.add_parser('stats', help='Show pilot program statistics')

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    # Run the appropriate command
    if args.command == 'add':
        success = asyncio.run(add_pilot(
            email=args.email,
            role=args.role,
            duration_days=args.duration,
            user_type=args.user_type,
            notes=args.notes
        ))
    elif args.command == 'revoke':
        success = asyncio.run(revoke_pilot(args.email))
    elif args.command == 'extend':
        success = asyncio.run(extend_pilot(args.email, args.days))
    elif args.command == 'promote':
        success = asyncio.run(promote_user(args.email, args.role))
    elif args.command == 'info':
        success = asyncio.run(get_user_info(args.email))
    elif args.command == 'list':
        success = asyncio.run(list_users(role=args.role, show_all=args.all))
    elif args.command == 'stats':
        success = asyncio.run(get_stats())
    else:
        parser.print_help()
        sys.exit(1)

    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
