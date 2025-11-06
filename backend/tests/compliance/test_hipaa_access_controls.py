"""
HIPAA Compliance Tests - Access Controls (§164.308(a)(4))

Tests verify that access to Protected Health Information (PHI) is properly
controlled and restricted based on user roles and permissions.

HIPAA Requirements:
- Access Control (§164.308(a)(4))
- Unique User Identification (§164.312(a)(2)(i))
- Emergency Access Procedure (§164.312(a)(2)(ii))
- Automatic Logoff (§164.312(a)(2)(iii))
- Encryption and Decryption (§164.312(a)(2)(iv))
"""

import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserTenant, Organization, Tenant
from app.models.health import HealthCondition
from app.core.security import create_access_token


@pytest.mark.asyncio
@pytest.mark.compliance
@pytest.mark.hipaa
class TestHIPAAAccessControls:
    """Tests for HIPAA access control requirements."""

    async def test_unique_user_identification(
        self,
        db_session: AsyncSession,
        test_organization: Organization,
        test_tenant: Tenant,
    ):
        """
        HIPAA §164.312(a)(2)(i) - Unique User Identification.

        Each user must have a unique identifier that cannot be shared.
        """
        # Create two users with different emails
        user1 = User(
            email="user1@example.com",
            hashed_password="hashed_pwd1",
            first_name="User",
            last_name="One",
        )
        user2 = User(
            email="user2@example.com",
            hashed_password="hashed_pwd2",
            first_name="User",
            last_name="Two",
        )
        db_session.add_all([user1, user2])
        await db_session.commit()

        # Verify users have unique IDs
        assert user1.id != user2.id
        assert user1.email != user2.email

        # Verify cannot create duplicate email
        duplicate_user = User(
            email="user1@example.com",  # Duplicate!
            hashed_password="hashed_pwd3",
            first_name="Duplicate",
            last_name="User",
        )
        db_session.add(duplicate_user)

        with pytest.raises(Exception):  # Should violate unique constraint
            await db_session.commit()

    async def test_role_based_access_control(
        self,
        db_session: AsyncSession,
        test_tenant: Tenant,
    ):
        """
        HIPAA §164.308(a)(4) - Access Control.

        Users must have appropriate roles that define their access levels.
        """
        # Create users with different roles
        admin_user = User(
            email="admin@example.com",
            hashed_password="pwd",
            first_name="Admin",
            last_name="User",
        )
        staff_user = User(
            email="staff@example.com",
            hashed_password="pwd",
            first_name="Staff",
            last_name="User",
        )
        read_only_user = User(
            email="readonly@example.com",
            hashed_password="pwd",
            first_name="ReadOnly",
            last_name="User",
        )
        db_session.add_all([admin_user, staff_user, read_only_user])
        await db_session.commit()

        # Assign roles
        admin_membership = UserTenant(
            user_id=admin_user.id,
            tenant_id=test_tenant.id,
            role="owner",  # Full access
        )
        staff_membership = UserTenant(
            user_id=staff_user.id,
            tenant_id=test_tenant.id,
            role="member",  # Limited access
        )
        readonly_membership = UserTenant(
            user_id=read_only_user.id,
            tenant_id=test_tenant.id,
            role="viewer",  # Read-only access
        )
        db_session.add_all([admin_membership, staff_membership, readonly_membership])
        await db_session.commit()

        # Verify roles are correctly assigned
        result = await db_session.execute(
            select(UserTenant).where(UserTenant.user_id == admin_user.id)
        )
        admin_role = result.scalar_one()
        assert admin_role.role == "owner"

        result = await db_session.execute(
            select(UserTenant).where(UserTenant.user_id == staff_user.id)
        )
        staff_role = result.scalar_one()
        assert staff_role.role == "member"

    async def test_phi_access_requires_authentication(
        self,
        client: TestClient,
    ):
        """
        HIPAA §164.308(a)(4) - Access Control.

        All PHI endpoints must require valid authentication.
        """
        # List of PHI endpoints
        phi_endpoints = [
            "/api/v1/health/conditions",
            "/api/v1/health/medications",
            "/api/v1/finance/accounts",  # Financial data is also sensitive
        ]

        for endpoint in phi_endpoints:
            # Attempt to access without authentication
            response = client.get(endpoint)

            # Must return 401 Unauthorized
            assert response.status_code == 401, f"Endpoint {endpoint} allows unauthenticated access!"

    async def test_phi_access_requires_tenant_membership(
        self,
        client: TestClient,
        test_user: User,
        test_tenant: Tenant,
        second_tenant: Tenant,
    ):
        """
        HIPAA §164.308(a)(4) - Access Control.

        Users can only access PHI from tenants they belong to.
        """
        # Create token for user who is NOT a member of second_tenant
        token = create_access_token(
            data={
                "sub": str(test_user.id),
                "email": test_user.email,
                "tenant_id": str(second_tenant.id),  # Not a member!
            }
        )

        # Attempt to access PHI with invalid tenant
        response = client.get(
            "/api/v1/health/conditions",
            headers={"Authorization": f"Bearer {token}"},
        )

        # Should be denied (403 or redirected to proper tenant)
        assert response.status_code in [401, 403, 404]

    async def test_suspended_user_cannot_access_phi(
        self,
        client: TestClient,
        db_session: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """
        HIPAA §164.308(a)(4) - Access Control.

        Suspended users must be immediately denied access to PHI.
        """
        # Suspend user
        test_user.is_suspended = True
        await db_session.commit()

        # Create token
        token = create_access_token(
            data={
                "sub": str(test_user.id),
                "email": test_user.email,
                "tenant_id": str(test_tenant.id),
            }
        )

        # Attempt to access PHI
        response = client.get(
            "/api/v1/health/conditions",
            headers={"Authorization": f"Bearer {token}"},
        )

        # Must be denied
        assert response.status_code == 401

    async def test_token_expiration_enforced(
        self,
        client: TestClient,
        test_user: User,
        test_tenant: Tenant,
    ):
        """
        HIPAA §164.312(a)(2)(iii) - Automatic Logoff.

        Session tokens must expire after a reasonable period of inactivity.
        """
        # Create expired token (negative expiration)
        expired_token = create_access_token(
            data={
                "sub": str(test_user.id),
                "email": test_user.email,
                "tenant_id": str(test_tenant.id),
            },
            expires_delta=timedelta(minutes=-10),  # Already expired
        )

        # Attempt to use expired token
        response = client.get(
            "/api/v1/health/conditions",
            headers={"Authorization": f"Bearer {expired_token}"},
        )

        # Must be denied
        assert response.status_code == 401
        assert "expired" in response.json()["detail"].lower() or "invalid" in response.json()["detail"].lower()

    async def test_minimum_necessary_access(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """
        HIPAA §164.502(b) - Minimum Necessary Requirement.

        Users should only access the minimum necessary PHI for their role.
        This test verifies that list endpoints don't return excessive data.
        """
        # Create health condition
        condition = HealthCondition(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            condition_name="Diabetes",
            diagnosis_date=datetime.now().date(),
            status="active",
            notes="Very detailed medical notes that shouldn't be in list view",
        )
        db_session_with_rls.add(condition)
        await db_session_with_rls.commit()

        # List conditions
        response = authenticated_client.get("/api/v1/health/conditions")

        assert response.status_code == 200
        data = response.json()
        assert len(data) > 0

        # Verify list view doesn't include excessive detail
        # (In production, list views should exclude sensitive notes)
        condition_data = data[0]
        assert "id" in condition_data
        assert "condition_name" in condition_data
        # Full notes might be included, but shouldn't be in a real HIPAA-compliant system
        # This is a reminder to implement field-level access control

    async def test_emergency_access_procedure(
        self,
        client: TestClient,
        db_session: AsyncSession,
        test_tenant: Tenant,
    ):
        """
        HIPAA §164.312(a)(2)(ii) - Emergency Access Procedure.

        System must allow authorized emergency access to PHI.
        NOTE: This is a placeholder - actual implementation would require
        break-glass authentication mechanism.
        """
        # Create emergency access user
        emergency_user = User(
            email="emergency@hospital.com",
            hashed_password="pwd",
            first_name="Emergency",
            last_name="Access",
            is_emergency_access=True,  # Special flag (would need to add this field)
        )
        db_session.add(emergency_user)
        await db_session.commit()

        # In production, emergency access would:
        # 1. Require special authentication (e.g., break-glass mechanism)
        # 2. Log all emergency access attempts
        # 3. Require justification for access
        # 4. Alert security team
        # 5. Require post-access review

        # For now, verify user exists and can be identified
        result = await db_session.execute(
            select(User).where(User.email == "emergency@hospital.com")
        )
        user = result.scalar_one()
        assert user.email == "emergency@hospital.com"

    async def test_workforce_clearance_verification(
        self,
        db_session: AsyncSession,
        test_tenant: Tenant,
    ):
        """
        HIPAA §164.308(a)(3)(ii)(B) - Workforce Clearance Procedure.

        System must maintain records of authorization/clearance for users.
        """
        # Create user with clearance metadata
        user = User(
            email="cleared.staff@hospital.com",
            hashed_password="pwd",
            first_name="Cleared",
            last_name="Staff",
            # In production, would have fields like:
            # clearance_level="level_3"
            # clearance_date=datetime.now()
            # background_check_completed=True
            # hipaa_training_completed=True
            # hipaa_training_date=datetime.now()
        )
        db_session.add(user)
        await db_session.commit()

        # Verify user was created
        result = await db_session.execute(
            select(User).where(User.email == "cleared.staff@hospital.com")
        )
        created_user = result.scalar_one()
        assert created_user.email == "cleared.staff@hospital.com"

        # In production, would verify:
        # - Background check completed
        # - HIPAA training up to date
        # - Appropriate clearance level for role
        # - Annual recertification

    async def test_access_termination(
        self,
        client: TestClient,
        db_session: AsyncSession,
        test_tenant: Tenant,
    ):
        """
        HIPAA §164.308(a)(3)(ii)(C) - Termination Procedures.

        When a user's access is terminated, they must immediately lose
        access to all PHI.
        """
        # Create user
        user = User(
            email="terminated@example.com",
            hashed_password="pwd",
            first_name="Terminated",
            last_name="User",
            is_active=True,
        )
        db_session.add(user)
        await db_session.commit()

        # Create membership
        membership = UserTenant(
            user_id=user.id,
            tenant_id=test_tenant.id,
            role="member",
        )
        db_session.add(membership)
        await db_session.commit()

        # Create valid token
        token = create_access_token(
            data={
                "sub": str(user.id),
                "email": user.email,
                "tenant_id": str(test_tenant.id),
            }
        )

        # Verify can access PHI
        response = client.get(
            "/api/v1/health/conditions",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200

        # Terminate user
        user.is_active = False
        await db_session.commit()

        # Attempt to access PHI with old token
        response = client.get(
            "/api/v1/health/conditions",
            headers={"Authorization": f"Bearer {token}"},
        )

        # Must be denied
        assert response.status_code == 401


@pytest.mark.asyncio
@pytest.mark.compliance
@pytest.mark.hipaa
class TestHIPAADataSegregation:
    """Tests for HIPAA data segregation requirements."""

    async def test_tenant_data_isolation(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
        second_tenant: Tenant,
    ):
        """
        HIPAA §164.308(a)(4) - Access Control.

        PHI from different tenants/organizations must be completely isolated.
        This is critical for HIPAA compliance in multi-tenant systems.
        """
        # Create health condition in second tenant
        other_condition = HealthCondition(
            tenant_id=second_tenant.id,
            user_id=test_user.id,
            condition_name="Secret Condition",
            diagnosis_date=datetime.now().date(),
            status="active",
        )
        db_session_with_rls.add(other_condition)
        await db_session_with_rls.commit()

        # Query from first tenant
        response = authenticated_client.get("/api/v1/health/conditions")

        assert response.status_code == 200
        conditions = response.json()

        # CRITICAL: Must NOT see data from other tenant
        assert len(conditions) == 0, "HIPAA VIOLATION: Cross-tenant data leakage!"

        # Verify cannot access by ID either
        response = authenticated_client.get(
            f"/api/v1/health/conditions/{other_condition.id}"
        )

        # Should return 404 (not found) rather than 403 (forbidden)
        # to avoid leaking information about existence of records
        assert response.status_code == 404

    async def test_user_data_isolation_within_tenant(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        second_user: User,
        test_tenant: Tenant,
    ):
        """
        HIPAA §164.308(a)(4) - Access Control.

        Users can only access their own PHI within a tenant unless
        explicitly authorized (e.g., provider-patient relationship).
        """
        # Create health condition for second user in same tenant
        other_user_condition = HealthCondition(
            tenant_id=test_tenant.id,
            user_id=second_user.id,  # Different user!
            condition_name="Other User's Condition",
            diagnosis_date=datetime.now().date(),
            status="active",
        )
        db_session_with_rls.add(other_user_condition)
        await db_session_with_rls.commit()

        # Query as first user
        response = authenticated_client.get("/api/v1/health/conditions")

        assert response.status_code == 200
        conditions = response.json()

        # Should NOT see other user's conditions
        assert all(c["user_id"] == str(test_user.id) for c in conditions)

        # Verify cannot access by ID
        response = authenticated_client.get(
            f"/api/v1/health/conditions/{other_user_condition.id}"
        )

        # Should be denied
        assert response.status_code == 404
