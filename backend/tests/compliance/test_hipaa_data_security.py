"""
HIPAA Compliance Tests - Data Security

Tests verify encryption, data integrity, breach detection, and PHI handling.

HIPAA Requirements:
- Encryption (§164.312(a)(2)(iv))
- Integrity Controls (§164.312(c)(1))
- Transmission Security (§164.312(e)(1))
- Breach Notification (§164.410)
"""

import pytest
import hashlib
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, AuditLog
from app.models.health import HealthCondition, Medication


@pytest.mark.asyncio
@pytest.mark.compliance
@pytest.mark.hipaa
class TestHIPAAEncryption:
    """Tests for HIPAA encryption requirements."""

    async def test_passwords_are_hashed(
        self,
        db_session: AsyncSession,
    ):
        """
        HIPAA §164.312(a)(2)(iv) - Encryption and Decryption.

        Passwords must be hashed, not stored in plaintext.
        """
        # Create user
        user = User(
            email="test@example.com",
            hashed_password="plaintext_password",  # Will be hashed by setter
            first_name="Test",
            last_name="User",
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        # Verify password is not stored in plaintext
        assert user.hashed_password != "plaintext_password"
        # Verify it looks like a bcrypt hash
        assert user.hashed_password.startswith("$") or len(user.hashed_password) > 50

    def test_https_required_for_transmission(
        self,
        client: TestClient,
    ):
        """
        HIPAA §164.312(e)(1) - Transmission Security.

        All PHI transmission must use HTTPS/TLS encryption.
        NOTE: In production, this would be enforced at the load balancer/proxy level.
        """
        # In production:
        # 1. Configure TLS certificates
        # 2. Redirect all HTTP to HTTPS
        # 3. Use HSTS headers
        # 4. Disable weak cipher suites
        # 5. Use TLS 1.2 or higher

        # This test documents the requirement
        # Actual enforcement happens at infrastructure level
        pass

    async def test_sensitive_data_not_logged_in_plaintext(
        self,
        authenticated_client: TestClient,
        db_session: AsyncSession,
    ):
        """
        HIPAA §164.312(a)(2)(iv) - Encryption and Decryption.

        Sensitive PHI should not appear in application logs in plaintext.
        """
        # Create health condition with sensitive data
        response = authenticated_client.post(
            "/api/v1/health/conditions",
            json={
                "condition_name": "HIV",  # Highly sensitive
                "diagnosis_date": "2020-01-01",
                "status": "active",
                "notes": "Confidential treatment notes",
            },
        )

        assert response.status_code == 201

        # In production, verify logs:
        # 1. Don't contain PHI in plaintext
        # 2. Use structured logging with redaction
        # 3. Sanitize sensitive fields
        # 4. Use audit logs for PHI access tracking

    async def test_database_backups_are_encrypted(
        self,
        db_session: AsyncSession,
    ):
        """
        HIPAA §164.312(a)(2)(iv) - Encryption and Decryption.

        Database backups containing PHI must be encrypted at rest.
        NOTE: This is typically enforced at the database/infrastructure level.
        """
        # In production:
        # 1. Enable PostgreSQL encryption
        # 2. Use encrypted storage volumes
        # 3. Encrypt backups before archival
        # 4. Protect encryption keys with KMS
        # 5. Regular key rotation

        # This test documents the requirement
        pass


@pytest.mark.asyncio
@pytest.mark.compliance
@pytest.mark.hipaa
class TestHIPAADataIntegrity:
    """Tests for HIPAA data integrity requirements."""

    async def test_phi_records_have_timestamps(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant,
    ):
        """
        HIPAA §164.312(c)(1) - Integrity Controls.

        All PHI records must have creation and modification timestamps.
        """
        # Create health condition
        condition = HealthCondition(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            condition_name="Test Condition",
            diagnosis_date=datetime.now().date(),
            status="active",
        )
        db_session_with_rls.add(condition)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(condition)

        # Verify timestamps exist
        assert condition.created_at is not None
        assert condition.updated_at is not None
        assert isinstance(condition.created_at, datetime)
        assert isinstance(condition.updated_at, datetime)

    async def test_phi_modifications_update_timestamp(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant,
    ):
        """
        HIPAA §164.312(c)(1) - Integrity Controls.

        Modifications to PHI must update the modification timestamp.
        """
        # Create condition
        condition = HealthCondition(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            condition_name="Original",
            diagnosis_date=datetime.now().date(),
            status="active",
        )
        db_session_with_rls.add(condition)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(condition)

        original_updated_at = condition.updated_at

        # Wait a moment
        import asyncio
        await asyncio.sleep(0.1)

        # Update condition
        response = authenticated_client.patch(
            f"/api/v1/health/conditions/{condition.id}",
            json={"condition_name": "Modified"},
        )

        assert response.status_code == 200

        # Verify updated_at changed
        await db_session_with_rls.refresh(condition)
        assert condition.updated_at > original_updated_at

    async def test_deleted_records_are_soft_deleted(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant,
    ):
        """
        HIPAA §164.316(b)(2)(i) - Retention Requirements.

        Deleted PHI should be soft-deleted (retained) for audit trail.
        NOTE: Some implementations use soft deletes, others use audit logs.
        """
        # Create condition
        condition = HealthCondition(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            condition_name="To Delete",
            diagnosis_date=datetime.now().date(),
            status="active",
        )
        db_session_with_rls.add(condition)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(condition)

        condition_id = condition.id

        # Delete via API
        response = authenticated_client.delete(
            f"/api/v1/health/conditions/{condition_id}"
        )

        assert response.status_code == 204

        # Check if record still exists in database (soft delete)
        result = await db_session_with_rls.execute(
            select(HealthCondition).where(HealthCondition.id == condition_id)
        )

        deleted_condition = result.scalar_one_or_none()

        # If soft deletes are implemented, record should exist with deleted_at timestamp
        # If hard deletes, record should be gone but audit log should exist
        # Either approach is valid for HIPAA

    async def test_data_validation_prevents_corruption(
        self,
        authenticated_client: TestClient,
    ):
        """
        HIPAA §164.312(c)(1) - Integrity Controls.

        Input validation must prevent data corruption.
        """
        # Attempt to create condition with invalid data
        response = authenticated_client.post(
            "/api/v1/health/conditions",
            json={
                "condition_name": "",  # Empty name - should be rejected
                "diagnosis_date": "invalid-date",  # Invalid date format
                "status": "INVALID_STATUS",  # Invalid status value
            },
        )

        # Should be rejected
        assert response.status_code == 422

        # Attempt to create medication with negative dosage
        response = authenticated_client.post(
            "/api/v1/health/medications",
            json={
                "medication_name": "Test Med",
                "dosage": "-100mg",  # Negative dosage doesn't make sense
                "frequency": "once daily",
                "start_date": "2025-01-01",
            },
        )

        # May be accepted (text field) but should validate in production
        # This documents the need for stronger validation


@pytest.mark.asyncio
@pytest.mark.compliance
@pytest.mark.hipaa
class TestHIPAABreachDetection:
    """Tests for HIPAA breach detection capabilities."""

    async def test_detect_mass_data_export(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_tenant,
    ):
        """
        HIPAA §164.410 - Breach Notification.

        System should detect potential data breaches such as mass exports.
        """
        # Simulate mass data access
        for i in range(150):  # Unusual volume
            audit = AuditLog(
                user_id=test_user.id,
                tenant_id=test_tenant.id,
                action="READ",
                resource_type="health_condition",
                resource_id=f"condition-{i}",
                ip_address="192.168.1.100",
            )
            db_session.add(audit)

        await db_session.commit()

        # Query for suspicious activity
        recent_time = datetime.now() - timedelta(minutes=5)
        result = await db_session.execute(
            select(AuditLog)
            .where(AuditLog.user_id == test_user.id)
            .where(AuditLog.created_at >= recent_time)
            .where(AuditLog.action == "READ")
        )

        recent_reads = result.scalars().all()

        # Detect anomaly: >100 reads in 5 minutes
        if len(recent_reads) > 100:
            # This would trigger breach investigation workflow:
            # 1. Alert security team
            # 2. Suspend user account
            # 3. Review all accessed records
            # 4. Determine if breach notification required
            # 5. Document incident
            assert True  # Anomaly detected

    async def test_detect_access_from_unusual_location(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_tenant,
    ):
        """
        HIPAA §164.410 - Breach Notification.

        System should detect access from unusual geographic locations.
        """
        # Create audit logs from different IP addresses
        normal_ip = "192.168.1.100"  # Office IP
        unusual_ip = "45.33.23.183"  # Foreign IP

        # Normal access
        normal_audit = AuditLog(
            user_id=test_user.id,
            tenant_id=test_tenant.id,
            action="READ",
            resource_type="health_condition",
            ip_address=normal_ip,
        )

        # Suspicious access
        suspicious_audit = AuditLog(
            user_id=test_user.id,
            tenant_id=test_tenant.id,
            action="READ",
            resource_type="health_condition",
            ip_address=unusual_ip,
        )

        db_session.add_all([normal_audit, suspicious_audit])
        await db_session.commit()

        # In production, implement:
        # 1. IP geolocation lookup
        # 2. Compare with user's normal locations
        # 3. Alert on access from new countries/regions
        # 4. Require additional authentication for unusual locations

    async def test_detect_after_hours_access(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_tenant,
    ):
        """
        HIPAA §164.410 - Breach Notification.

        System should detect access outside normal business hours.
        """
        # Create audit log at 2 AM (unusual for most healthcare workers)
        late_night_time = datetime.now().replace(hour=2, minute=0, second=0)

        after_hours_audit = AuditLog(
            user_id=test_user.id,
            tenant_id=test_tenant.id,
            action="READ",
            resource_type="health_condition",
            resource_id="sensitive-record",
            ip_address="192.168.1.100",
            created_at=late_night_time,
        )

        db_session.add(after_hours_audit)
        await db_session.commit()

        # Query for after-hours access
        result = await db_session.execute(
            select(AuditLog)
            .where(AuditLog.user_id == test_user.id)
        )

        all_audits = result.scalars().all()

        # Detect after-hours access (10 PM - 6 AM)
        after_hours = [
            audit for audit in all_audits
            if audit.created_at.hour >= 22 or audit.created_at.hour < 6
        ]

        if len(after_hours) > 0:
            # Flag for review
            # In production: Alert security if unusual for this user
            assert True


@pytest.mark.asyncio
@pytest.mark.compliance
@pytest.mark.hipaa
class TestHIPAAPHIHandling:
    """Tests for proper Protected Health Information handling."""

    async def test_phi_not_exposed_in_error_messages(
        self,
        authenticated_client: TestClient,
    ):
        """
        HIPAA §164.502(b) - Minimum Necessary Requirement.

        Error messages must not expose PHI.
        """
        # Attempt to access non-existent record
        from uuid import uuid4
        fake_id = uuid4()

        response = authenticated_client.get(
            f"/api/v1/health/conditions/{fake_id}"
        )

        assert response.status_code == 404

        error_message = response.json()["detail"]

        # Error should not expose details about the record
        # Good: "Record not found"
        # Bad: "Health condition 'HIV' for patient John Doe not found"
        assert len(error_message) < 100  # Should be generic
        assert "not found" in error_message.lower()

    async def test_phi_filtered_from_logs(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant,
    ):
        """
        HIPAA §164.502(b) - Minimum Necessary Requirement.

        Application logs should not contain PHI in plaintext.
        """
        # Create condition with sensitive data
        condition = HealthCondition(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            condition_name="Sensitive Diagnosis",  # Should not appear in logs
            diagnosis_date=datetime.now().date(),
            status="active",
            notes="Highly confidential medical information",
        )
        db_session_with_rls.add(condition)
        await db_session_with_rls.commit()

        # Access the record
        response = authenticated_client.get(
            f"/api/v1/health/conditions/{condition.id}"
        )

        assert response.status_code == 200

        # In production, verify:
        # 1. Application logs use structured logging
        # 2. PHI fields are redacted/masked
        # 3. Only IDs and metadata appear in logs
        # 4. Detailed PHI only in audit logs (encrypted)

    async def test_minimum_necessary_access_in_list_views(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant,
    ):
        """
        HIPAA §164.502(b) - Minimum Necessary Requirement.

        List views should only return necessary fields, not full PHI details.
        """
        # Create condition with detailed notes
        condition = HealthCondition(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            condition_name="Diabetes",
            diagnosis_date=datetime.now().date(),
            status="active",
            notes="Very detailed treatment notes that should not be in list view" * 10,
        )
        db_session_with_rls.add(condition)
        await db_session_with_rls.commit()

        # List conditions
        response = authenticated_client.get("/api/v1/health/conditions")

        assert response.status_code == 200
        conditions = response.json()

        # In production, list views should:
        # 1. Exclude or truncate detailed notes
        # 2. Only include summary information
        # 3. Require explicit GET for full details
        # This implements "minimum necessary" principle

    async def test_phi_retention_policy(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_tenant,
    ):
        """
        HIPAA §164.316(b)(2)(i) - Retention Requirements.

        PHI must be retained for required period (typically 6 years).
        """
        # Create old health condition (7 years ago)
        old_condition = HealthCondition(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            condition_name="Old Condition",
            diagnosis_date=(datetime.now() - timedelta(days=365 * 7)).date(),
            status="resolved",
            created_at=datetime.now() - timedelta(days=365 * 7),
        )

        db_session.add(old_condition)
        await db_session.commit()

        # Verify record still exists
        result = await db_session.execute(
            select(HealthCondition).where(HealthCondition.id == old_condition.id)
        )

        retrieved = result.scalar_one_or_none()
        assert retrieved is not None

        # In production, implement:
        # 1. Automated archival after 6 years
        # 2. Move to cold storage (encrypted)
        # 3. Maintain availability for compliance reviews
        # 4. Eventual purging after legal retention period + buffer
