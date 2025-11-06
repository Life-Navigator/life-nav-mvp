"""
Tests for health domain endpoints.

Tests cover:
- Health condition CRUD operations
- Medication CRUD operations
- Multi-tenant isolation
- Permission enforcement
"""

import pytest
from datetime import date
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.health import HealthCondition, Medication
from app.models.user import User, Tenant


@pytest.mark.asyncio
@pytest.mark.api
class TestHealthConditions:
    """Tests for health condition endpoints."""

    def test_list_conditions_empty(self, authenticated_client: TestClient):
        """Test listing conditions when none exist."""
        response = authenticated_client.get("/api/v1/health/conditions")

        assert response.status_code == 200
        assert response.json() == []

    async def test_create_condition(
        self,
        authenticated_client: TestClient,
        db_session: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test creating a new health condition."""
        response = authenticated_client.post(
            "/api/v1/health/conditions",
            json={
                "condition_name": "Type 2 Diabetes",
                "diagnosis_date": "2020-06-15",
                "severity": "moderate",
                "status": "active",
                "notes": "Managing with diet and medication",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["condition_name"] == "Type 2 Diabetes"
        assert data["severity"] == "moderate"
        assert data["status"] == "active"
        assert "id" in data

    async def test_get_condition(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test retrieving a specific condition."""
        # Create condition
        condition = HealthCondition(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            condition_name="Hypertension",
            diagnosis_date=date(2018, 3, 10),
            severity="mild",
            status="active",
        )
        db_session_with_rls.add(condition)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(condition)

        # Get condition
        response = authenticated_client.get(f"/api/v1/health/conditions/{condition.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(condition.id)
        assert data["condition_name"] == "Hypertension"
        assert data["severity"] == "mild"

    async def test_update_condition(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test updating a condition."""
        # Create condition
        condition = HealthCondition(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            condition_name="Asthma",
            diagnosis_date=date(2015, 1, 1),
            severity="moderate",
            status="active",
        )
        db_session_with_rls.add(condition)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(condition)

        # Update condition
        response = authenticated_client.patch(
            f"/api/v1/health/conditions/{condition.id}",
            json={
                "severity": "mild",
                "notes": "Improved with new treatment plan",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["severity"] == "mild"

    async def test_delete_condition(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test deleting a condition."""
        # Create condition
        condition = HealthCondition(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            condition_name="Old Condition",
            diagnosis_date=date(2010, 1, 1),
            status="resolved",
        )
        db_session_with_rls.add(condition)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(condition)

        # Delete condition
        response = authenticated_client.delete(f"/api/v1/health/conditions/{condition.id}")

        assert response.status_code == 204

        # Verify deletion
        response = authenticated_client.get(f"/api/v1/health/conditions/{condition.id}")
        assert response.status_code == 404

    def test_get_nonexistent_condition(self, authenticated_client: TestClient):
        """Test getting a condition that doesn't exist."""
        from uuid import uuid4

        fake_id = uuid4()
        response = authenticated_client.get(f"/api/v1/health/conditions/{fake_id}")

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
@pytest.mark.api
class TestMedications:
    """Tests for medication endpoints."""

    def test_list_medications_empty(self, authenticated_client: TestClient):
        """Test listing medications when none exist."""
        response = authenticated_client.get("/api/v1/health/medications")

        assert response.status_code == 200
        assert response.json() == []

    async def test_create_medication(
        self,
        authenticated_client: TestClient,
        db_session: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test creating a new medication."""
        response = authenticated_client.post(
            "/api/v1/health/medications",
            json={
                "medication_name": "Metformin",
                "dosage": "500mg",
                "frequency": "twice daily",
                "start_date": "2020-07-01",
                "is_current": True,
                "purpose": "Blood sugar management",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["medication_name"] == "Metformin"
        assert data["dosage"] == "500mg"
        assert data["is_current"] is True
        assert "id" in data

    async def test_get_medication(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test retrieving a specific medication."""
        # Create medication
        medication = Medication(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            medication_name="Lisinopril",
            dosage="10mg",
            frequency="once daily",
            start_date=date(2018, 4, 1),
            is_current=True,
        )
        db_session_with_rls.add(medication)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(medication)

        # Get medication
        response = authenticated_client.get(f"/api/v1/health/medications/{medication.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(medication.id)
        assert data["medication_name"] == "Lisinopril"
        assert data["dosage"] == "10mg"

    async def test_update_medication(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test updating a medication."""
        # Create medication
        medication = Medication(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            medication_name="Albuterol",
            dosage="2 puffs",
            frequency="as needed",
            start_date=date(2015, 1, 1),
            is_current=True,
        )
        db_session_with_rls.add(medication)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(medication)

        # Update medication
        response = authenticated_client.patch(
            f"/api/v1/health/medications/{medication.id}",
            json={
                "is_current": False,
                "end_date": "2025-01-31",
                "notes": "Switched to different inhaler",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_current"] is False

    async def test_delete_medication(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test deleting a medication."""
        # Create medication
        medication = Medication(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            medication_name="Old Medication",
            dosage="50mg",
            frequency="once daily",
            start_date=date(2010, 1, 1),
            end_date=date(2012, 1, 1),
            is_current=False,
        )
        db_session_with_rls.add(medication)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(medication)

        # Delete medication
        response = authenticated_client.delete(f"/api/v1/health/medications/{medication.id}")

        assert response.status_code == 204

        # Verify deletion
        response = authenticated_client.get(f"/api/v1/health/medications/{medication.id}")
        assert response.status_code == 404

    async def test_list_medications_filtered_by_condition(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test filtering medications by condition."""
        # Create condition
        condition = HealthCondition(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            condition_name="Diabetes",
            diagnosis_date=date(2020, 1, 1),
            status="active",
        )
        db_session_with_rls.add(condition)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(condition)

        # Create medications
        med1 = Medication(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            condition_id=condition.id,
            medication_name="Metformin",
            dosage="500mg",
            frequency="twice daily",
            start_date=date(2020, 1, 15),
            is_current=True,
        )
        med2 = Medication(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            medication_name="Aspirin",
            dosage="81mg",
            frequency="once daily",
            start_date=date(2018, 1, 1),
            is_current=True,
        )
        db_session_with_rls.add_all([med1, med2])
        await db_session_with_rls.commit()

        # Filter by condition
        response = authenticated_client.get(
            f"/api/v1/health/medications?condition_id={condition.id}"
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["condition_id"] == str(condition.id)


@pytest.mark.asyncio
@pytest.mark.api
class TestHealthTenantIsolation:
    """Tests for multi-tenant isolation in health endpoints."""

    async def test_condition_tenant_isolation(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
        second_tenant: Tenant,
    ):
        """Test that users can only see conditions from their tenant."""
        # Create condition in second tenant
        other_condition = HealthCondition(
            tenant_id=second_tenant.id,
            user_id=test_user.id,
            condition_name="Secret Condition",
            diagnosis_date=date(2020, 1, 1),
            status="active",
        )
        db_session_with_rls.add(other_condition)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(other_condition)

        # Try to access from first tenant
        response = authenticated_client.get("/api/v1/health/conditions")

        assert response.status_code == 200
        conditions = response.json()
        # Should not see the condition from other tenant
        assert len(conditions) == 0

    async def test_medication_tenant_isolation(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
        second_tenant: Tenant,
    ):
        """Test that users can only see medications from their tenant."""
        # Create medication in second tenant
        other_medication = Medication(
            tenant_id=second_tenant.id,
            user_id=test_user.id,
            medication_name="Secret Medication",
            dosage="100mg",
            frequency="once daily",
            start_date=date(2020, 1, 1),
            is_current=True,
        )
        db_session_with_rls.add(other_medication)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(other_medication)

        # Try to access from first tenant
        response = authenticated_client.get("/api/v1/health/medications")

        assert response.status_code == 200
        medications = response.json()
        # Should not see the medication from other tenant
        assert len(medications) == 0
