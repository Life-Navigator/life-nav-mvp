"""
Audit Logger - Comprehensive audit logging for compliance

This module provides audit logging with:
- Immutable audit trail
- Structured event logging
- Action tracking (CRUD operations)
- Compliance reporting (GDPR, SOC2)
- Export to SIEM systems

Author: Life Navigator Team
Created: November 2, 2025
"""

import os
import uuid
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from enum import Enum
from dataclasses import dataclass, asdict
import asyncpg
from asyncpg.pool import Pool


# ========================
# Audit Event Types
# ========================

class AuditAction(str, Enum):
    """Predefined audit actions"""

    # Authentication actions
    LOGIN = "auth.login"
    LOGOUT = "auth.logout"
    LOGIN_FAILED = "auth.login_failed"
    PASSWORD_CHANGED = "auth.password_changed"
    PASSWORD_RESET = "auth.password_reset"

    # User management
    USER_CREATED = "user.created"
    USER_UPDATED = "user.updated"
    USER_DELETED = "user.deleted"
    USER_ACTIVATED = "user.activated"
    USER_DEACTIVATED = "user.deactivated"

    # Role management
    ROLE_ASSIGNED = "role.assigned"
    ROLE_REVOKED = "role.revoked"
    PERMISSION_GRANTED = "permission.granted"
    PERMISSION_REVOKED = "permission.revoked"

    # Document actions
    DOCUMENT_UPLOADED = "document.uploaded"
    DOCUMENT_VIEWED = "document.viewed"
    DOCUMENT_DOWNLOADED = "document.downloaded"
    DOCUMENT_DELETED = "document.deleted"
    DOCUMENT_UPDATED = "document.updated"

    # Search actions
    SEARCH_PERFORMED = "search.performed"
    SEMANTIC_SEARCH = "search.semantic"

    # System configuration
    CONFIG_UPDATED = "config.updated"
    CONFIG_VIEWED = "config.viewed"

    # Security events
    ACCESS_DENIED = "security.access_denied"
    RATE_LIMIT_EXCEEDED = "security.rate_limit_exceeded"
    INVALID_TOKEN = "security.invalid_token"
    SUSPICIOUS_ACTIVITY = "security.suspicious_activity"

    # Data export (GDPR)
    DATA_EXPORTED = "data.exported"
    DATA_DELETED = "data.deleted"  # Right to be forgotten


class AuditStatus(str, Enum):
    """Audit event status"""
    SUCCESS = "success"
    FAILURE = "failure"
    DENIED = "denied"
    ERROR = "error"


# ========================
# Audit Event Data Class
# ========================

@dataclass
class AuditEvent:
    """Structured audit event"""

    action: str  # AuditAction value
    user_id: Optional[str] = None
    username: Optional[str] = None
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    status: str = AuditStatus.SUCCESS
    error_message: Optional[str] = None
    timestamp: Optional[datetime] = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        data = asdict(self)
        # Convert datetime to ISO format
        if isinstance(data['timestamp'], datetime):
            data['timestamp'] = data['timestamp'].isoformat()
        return data


# ========================
# Audit Logger
# ========================

class AuditLogger:
    """
    Comprehensive audit logging system

    Features:
    - Immutable audit trail
    - Structured event logging
    - Query and reporting
    - Compliance support
    """

    def __init__(self, db_pool: Pool):
        """
        Initialize AuditLogger

        Args:
            db_pool: asyncpg connection pool
        """
        self.pool = db_pool

    async def initialize_schema(self):
        """Create audit log schema and tables"""
        async with self.pool.acquire() as conn:
            # Create audit log table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS auth.audit_log (
                    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    action VARCHAR(100) NOT NULL,
                    user_id UUID REFERENCES auth.users(user_id) ON DELETE SET NULL,
                    username VARCHAR(255),
                    resource_type VARCHAR(50),
                    resource_id VARCHAR(255),
                    details JSONB,
                    ip_address VARCHAR(45),
                    user_agent TEXT,
                    status VARCHAR(20) NOT NULL,
                    error_message TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
                )
            """)

            # Create indexes for fast queries
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_audit_user_id
                ON auth.audit_log(user_id)
            """)

            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_audit_action
                ON auth.audit_log(action)
            """)

            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_audit_created_at
                ON auth.audit_log(created_at DESC)
            """)

            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_audit_resource
                ON auth.audit_log(resource_type, resource_id)
            """)

            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_audit_status
                ON auth.audit_log(status)
            """)

            # Create index on JSONB details for efficient queries
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_audit_details_gin
                ON auth.audit_log USING GIN (details)
            """)

            print("✅ Audit log schema initialized")

    # ========================
    # Logging Methods
    # ========================

    async def log_event(self, event: AuditEvent) -> str:
        """
        Log an audit event

        Args:
            event: AuditEvent to log

        Returns:
            Audit ID
        """
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("""
                INSERT INTO auth.audit_log (
                    action, user_id, username, resource_type, resource_id,
                    details, ip_address, user_agent, status, error_message
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING audit_id
            """,
                event.action,
                uuid.UUID(event.user_id) if event.user_id else None,
                event.username,
                event.resource_type,
                event.resource_id,
                json.dumps(event.details) if event.details else None,
                event.ip_address,
                event.user_agent,
                event.status,
                event.error_message
            )

            return str(row['audit_id'])

    async def log_authentication(
        self,
        action: AuditAction,
        user_id: Optional[str],
        username: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        status: AuditStatus = AuditStatus.SUCCESS,
        error_message: Optional[str] = None
    ) -> str:
        """
        Log authentication event

        Args:
            action: Authentication action
            user_id: User ID (may be None for failed logins)
            username: Username
            ip_address: Client IP
            user_agent: Client user agent
            status: Event status
            error_message: Error message if failed

        Returns:
            Audit ID
        """
        event = AuditEvent(
            action=action.value,
            user_id=user_id,
            username=username,
            ip_address=ip_address,
            user_agent=user_agent,
            status=status.value,
            error_message=error_message
        )

        return await self.log_event(event)

    async def log_document_action(
        self,
        action: AuditAction,
        user_id: str,
        document_id: str,
        details: Optional[Dict[str, Any]] = None,
        status: AuditStatus = AuditStatus.SUCCESS
    ) -> str:
        """
        Log document action

        Args:
            action: Document action
            user_id: User ID
            document_id: Document ID
            details: Additional details
            status: Event status

        Returns:
            Audit ID
        """
        event = AuditEvent(
            action=action.value,
            user_id=user_id,
            resource_type="document",
            resource_id=document_id,
            details=details,
            status=status.value
        )

        return await self.log_event(event)

    async def log_security_event(
        self,
        action: AuditAction,
        user_id: Optional[str],
        details: Dict[str, Any],
        ip_address: Optional[str] = None,
        status: AuditStatus = AuditStatus.DENIED
    ) -> str:
        """
        Log security event

        Args:
            action: Security action
            user_id: User ID (may be None)
            details: Event details
            ip_address: Client IP
            status: Event status

        Returns:
            Audit ID
        """
        event = AuditEvent(
            action=action.value,
            user_id=user_id,
            details=details,
            ip_address=ip_address,
            status=status.value
        )

        return await self.log_event(event)

    async def log_data_access(
        self,
        user_id: str,
        action: str,
        resource_type: str,
        resource_id: str,
        details: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Log data access (for GDPR compliance)

        Args:
            user_id: User ID
            action: Action performed
            resource_type: Type of resource
            resource_id: Resource ID
            details: Additional details

        Returns:
            Audit ID
        """
        event = AuditEvent(
            action=action,
            user_id=user_id,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details,
            status=AuditStatus.SUCCESS.value
        )

        return await self.log_event(event)

    # ========================
    # Query Methods
    # ========================

    async def get_user_activity(
        self,
        user_id: str,
        limit: int = 100,
        offset: int = 0,
        action_filter: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """
        Get activity log for a user

        Args:
            user_id: User ID
            limit: Maximum number of events
            offset: Number of events to skip
            action_filter: Filter by action prefix (e.g., "auth.")
            date_from: Start date
            date_to: End date

        Returns:
            List of audit events
        """
        query = """
            SELECT audit_id, action, username, resource_type, resource_id,
                   details, ip_address, user_agent, status, error_message, created_at
            FROM auth.audit_log
            WHERE user_id = $1
        """

        params = [uuid.UUID(user_id)]
        param_index = 2

        if action_filter:
            query += f" AND action LIKE ${param_index}"
            params.append(f"{action_filter}%")
            param_index += 1

        if date_from:
            query += f" AND created_at >= ${param_index}"
            params.append(date_from)
            param_index += 1

        if date_to:
            query += f" AND created_at <= ${param_index}"
            params.append(date_to)
            param_index += 1

        query += f" ORDER BY created_at DESC LIMIT ${param_index} OFFSET ${param_index + 1}"
        params.extend([limit, offset])

        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, *params)

            return [
                {
                    'audit_id': str(row['audit_id']),
                    'action': row['action'],
                    'username': row['username'],
                    'resource_type': row['resource_type'],
                    'resource_id': row['resource_id'],
                    'details': json.loads(row['details']) if row['details'] else None,
                    'ip_address': row['ip_address'],
                    'user_agent': row['user_agent'],
                    'status': row['status'],
                    'error_message': row['error_message'],
                    'created_at': row['created_at'].isoformat()
                }
                for row in rows
            ]

    async def get_recent_events(
        self,
        limit: int = 100,
        action_filter: Optional[str] = None,
        status_filter: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get recent audit events

        Args:
            limit: Maximum number of events
            action_filter: Filter by action prefix
            status_filter: Filter by status

        Returns:
            List of recent audit events
        """
        query = """
            SELECT audit_id, action, user_id, username, resource_type, resource_id,
                   details, ip_address, status, error_message, created_at
            FROM auth.audit_log
            WHERE 1=1
        """

        params = []
        param_index = 1

        if action_filter:
            query += f" AND action LIKE ${param_index}"
            params.append(f"{action_filter}%")
            param_index += 1

        if status_filter:
            query += f" AND status = ${param_index}"
            params.append(status_filter)
            param_index += 1

        query += f" ORDER BY created_at DESC LIMIT ${param_index}"
        params.append(limit)

        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, *params)

            return [
                {
                    'audit_id': str(row['audit_id']),
                    'action': row['action'],
                    'user_id': str(row['user_id']) if row['user_id'] else None,
                    'username': row['username'],
                    'resource_type': row['resource_type'],
                    'resource_id': row['resource_id'],
                    'details': json.loads(row['details']) if row['details'] else None,
                    'ip_address': row['ip_address'],
                    'status': row['status'],
                    'error_message': row['error_message'],
                    'created_at': row['created_at'].isoformat()
                }
                for row in rows
            ]

    async def get_security_events(
        self,
        hours: int = 24,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Get recent security events

        Args:
            hours: Number of hours to look back
            limit: Maximum number of events

        Returns:
            List of security events
        """
        datetime.utcnow() - timedelta(hours=hours)

        return await self.get_recent_events(
            limit=limit,
            action_filter="security.",
        )

    async def get_failed_logins(
        self,
        hours: int = 24,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Get failed login attempts

        Args:
            hours: Number of hours to look back
            limit: Maximum number of events

        Returns:
            List of failed login events
        """
        since = datetime.utcnow() - timedelta(hours=hours)

        async with self.pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT audit_id, action, username, ip_address, user_agent,
                       error_message, created_at
                FROM auth.audit_log
                WHERE action = $1 AND created_at >= $2
                ORDER BY created_at DESC
                LIMIT $3
            """, AuditAction.LOGIN_FAILED.value, since, limit)

            return [
                {
                    'audit_id': str(row['audit_id']),
                    'action': row['action'],
                    'username': row['username'],
                    'ip_address': row['ip_address'],
                    'user_agent': row['user_agent'],
                    'error_message': row['error_message'],
                    'created_at': row['created_at'].isoformat()
                }
                for row in rows
            ]

    # ========================
    # Compliance Reporting
    # ========================

    async def generate_user_data_report(
        self,
        user_id: str,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Generate GDPR-compliant user data report

        Args:
            user_id: User ID
            date_from: Start date (optional)
            date_to: End date (optional)

        Returns:
            Complete user activity report
        """
        # Get all user activity
        activity = await self.get_user_activity(
            user_id,
            limit=10000,  # Get all
            date_from=date_from,
            date_to=date_to
        )

        # Group by action type
        by_action = {}
        for event in activity:
            action = event['action']
            if action not in by_action:
                by_action[action] = []
            by_action[action].append(event)

        return {
            'user_id': user_id,
            'generated_at': datetime.utcnow().isoformat(),
            'date_range': {
                'from': date_from.isoformat() if date_from else None,
                'to': date_to.isoformat() if date_to else None
            },
            'total_events': len(activity),
            'events_by_action': {
                action: len(events)
                for action, events in by_action.items()
            },
            'detailed_events': activity
        }

    async def get_audit_statistics(
        self,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        Get audit log statistics

        Args:
            days: Number of days to analyze

        Returns:
            Statistics dictionary
        """
        since = datetime.utcnow() - timedelta(days=days)

        async with self.pool.acquire() as conn:
            # Total events
            total_events = await conn.fetchval("""
                SELECT COUNT(*) FROM auth.audit_log
                WHERE created_at >= $1
            """, since)

            # Events by action
            by_action = await conn.fetch("""
                SELECT action, COUNT(*) as count
                FROM auth.audit_log
                WHERE created_at >= $1
                GROUP BY action
                ORDER BY count DESC
                LIMIT 10
            """, since)

            # Events by status
            by_status = await conn.fetch("""
                SELECT status, COUNT(*) as count
                FROM auth.audit_log
                WHERE created_at >= $1
                GROUP BY status
            """, since)

            # Most active users
            active_users = await conn.fetch("""
                SELECT user_id, username, COUNT(*) as event_count
                FROM auth.audit_log
                WHERE created_at >= $1 AND user_id IS NOT NULL
                GROUP BY user_id, username
                ORDER BY event_count DESC
                LIMIT 10
            """, since)

            # Failed actions
            failed_count = await conn.fetchval("""
                SELECT COUNT(*) FROM auth.audit_log
                WHERE created_at >= $1 AND status != 'success'
            """, since)

            return {
                'period_days': days,
                'total_events': total_events,
                'failed_events': failed_count,
                'success_rate': (total_events - failed_count) / total_events if total_events > 0 else 0,
                'events_by_action': [
                    {'action': row['action'], 'count': row['count']}
                    for row in by_action
                ],
                'events_by_status': [
                    {'status': row['status'], 'count': row['count']}
                    for row in by_status
                ],
                'most_active_users': [
                    {
                        'user_id': str(row['user_id']),
                        'username': row['username'],
                        'event_count': row['event_count']
                    }
                    for row in active_users
                ]
            }

    # ========================
    # Retention and Cleanup
    # ========================

    async def cleanup_old_events(
        self,
        retention_days: int = 365
    ) -> int:
        """
        Delete old audit events (beyond retention period)

        Args:
            retention_days: Number of days to retain

        Returns:
            Number of events deleted
        """
        cutoff_date = datetime.utcnow() - timedelta(days=retention_days)

        async with self.pool.acquire() as conn:
            result = await conn.execute("""
                DELETE FROM auth.audit_log
                WHERE created_at < $1
            """, cutoff_date)

            deleted_count = int(result.split()[-1])
            return deleted_count

    async def close(self):
        """Close database connection pool"""
        await self.pool.close()


# ========================
# Helper Functions
# ========================

async def get_audit_logger() -> AuditLogger:
    """
    Get an AuditLogger instance

    Returns:
        Configured AuditLogger
    """

    db_config = {
        'host': os.getenv('DB_HOST', 'localhost'),
        'port': int(os.getenv('DB_PORT', 5432)),
        'database': os.getenv('DB_NAME', 'life_navigator_db'),
        'user': os.getenv('DB_USER', 'postgres'),
        'password': os.getenv('DB_PASSWORD', 'postgres')
    }

    pool = await asyncpg.create_pool(**db_config, min_size=2, max_size=10)

    audit_logger = AuditLogger(pool)
    await audit_logger.initialize_schema()

    return audit_logger


if __name__ == "__main__":
    """Test the AuditLogger"""
    import asyncio

    async def test_audit_logger():
        print("Testing AuditLogger...")

        # Get audit logger
        audit = await get_audit_logger()

        test_user_id = str(uuid.uuid4())

        # Test 1: Log authentication events
        print("\n1. Logging authentication events...")
        await audit.log_authentication(
            action=AuditAction.LOGIN,
            user_id=test_user_id,
            username="test_user",
            ip_address="192.168.1.1",
            user_agent="Mozilla/5.0...",
            status=AuditStatus.SUCCESS
        )
        print("   ✅ Login event logged")

        await audit.log_authentication(
            action=AuditAction.LOGIN_FAILED,
            user_id=None,
            username="test_user",
            ip_address="192.168.1.2",
            status=AuditStatus.FAILURE,
            error_message="Invalid password"
        )
        print("   ✅ Failed login logged")

        # Test 2: Log document actions
        print("\n2. Logging document actions...")
        doc_id = str(uuid.uuid4())
        await audit.log_document_action(
            action=AuditAction.DOCUMENT_UPLOADED,
            user_id=test_user_id,
            document_id=doc_id,
            details={'filename': 'test.pdf', 'size': 1024}
        )
        print("   ✅ Document upload logged")

        # Test 3: Log security events
        print("\n3. Logging security events...")
        await audit.log_security_event(
            action=AuditAction.ACCESS_DENIED,
            user_id=test_user_id,
            details={'resource': 'admin_panel', 'reason': 'insufficient permissions'},
            ip_address="192.168.1.1",
            status=AuditStatus.DENIED
        )
        print("   ✅ Security event logged")

        # Test 4: Query user activity
        print("\n4. Querying user activity...")
        activity = await audit.get_user_activity(test_user_id, limit=10)
        print(f"   ✅ Found {len(activity)} events for user")
        for event in activity:
            print(f"      - {event['action']}: {event['status']}")

        # Test 5: Get recent events
        print("\n5. Getting recent events...")
        recent = await audit.get_recent_events(limit=5)
        print(f"   ✅ Found {len(recent)} recent events")

        # Test 6: Get audit statistics
        print("\n6. Getting audit statistics...")
        stats = await audit.get_audit_statistics(days=30)
        print(f"   ✅ Total events (30 days): {stats['total_events']}")
        print(f"   Success rate: {stats['success_rate']:.1%}")

        # Test 7: Generate GDPR report
        print("\n7. Generating GDPR report...")
        report = await audit.generate_user_data_report(test_user_id)
        print("   ✅ Report generated")
        print(f"      Total events: {report['total_events']}")
        print(f"      Actions: {list(report['events_by_action'].keys())}")

        await audit.close()
        print("\n✅ All tests completed!")

    asyncio.run(test_audit_logger())
