"""
Tests for career domain endpoints.

Tests cover:
- Career profile CRUD operations
- Job application CRUD operations
- Interview CRUD operations
- Multi-tenant isolation
- Permission enforcement
"""

import pytest
from datetime import date, datetime
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.career import CareerProfile, JobApplication, Interview
from app.models.user import User, Tenant


@pytest.mark.asyncio
@pytest.mark.api
class TestCareerProfiles:
    """Tests for career profile endpoints."""

    def test_list_profiles_empty(self, authenticated_client: TestClient):
        """Test listing profiles when none exist."""
        response = authenticated_client.get("/api/v1/career/profiles")

        assert response.status_code == 200
        assert response.json() == []

    async def test_create_profile(
        self,
        authenticated_client: TestClient,
        db_session: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test creating a new career profile."""
        response = authenticated_client.post(
            "/api/v1/career/profiles",
            json={
                "job_title": "Senior Software Engineer",
                "company_name": "Tech Corp",
                "employment_type": "full_time",
                "start_date": "2020-01-01",
                "is_current": True,
                "industry": "Technology",
                "location": "San Francisco, CA",
                "salary": 150000.00,
                "currency": "USD",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["job_title"] == "Senior Software Engineer"
        assert data["company_name"] == "Tech Corp"
        assert data["employment_type"] == "full_time"
        assert data["is_current"] is True
        assert "id" in data
        assert "created_at" in data

    async def test_get_profile(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test retrieving a specific profile."""
        # Create profile
        profile = CareerProfile(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            job_title="Data Scientist",
            company_name="AI Startup",
            employment_type="full_time",
            start_date=date(2019, 6, 1),
            is_current=False,
            end_date=date(2022, 12, 31),
        )
        db_session_with_rls.add(profile)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(profile)

        # Get profile
        response = authenticated_client.get(f"/api/v1/career/profiles/{profile.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(profile.id)
        assert data["job_title"] == "Data Scientist"
        assert data["is_current"] is False

    async def test_get_nonexistent_profile(self, authenticated_client: TestClient):
        """Test getting a profile that doesn't exist."""
        from uuid import uuid4

        fake_id = uuid4()
        response = authenticated_client.get(f"/api/v1/career/profiles/{fake_id}")

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    async def test_update_profile(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test updating a profile."""
        # Create profile
        profile = CareerProfile(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            job_title="Junior Developer",
            company_name="Startup Inc",
            employment_type="full_time",
            start_date=date(2021, 1, 1),
            is_current=True,
        )
        db_session_with_rls.add(profile)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(profile)

        # Update profile
        response = authenticated_client.patch(
            f"/api/v1/career/profiles/{profile.id}",
            json={
                "job_title": "Senior Developer",
                "salary": 120000.00,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["job_title"] == "Senior Developer"
        assert float(data["salary"]) == 120000.00

    async def test_delete_profile(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test deleting a profile."""
        # Create profile
        profile = CareerProfile(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            job_title="Consultant",
            company_name="Consulting Firm",
            employment_type="contract",
            start_date=date(2020, 1, 1),
            is_current=False,
            end_date=date(2020, 12, 31),
        )
        db_session_with_rls.add(profile)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(profile)

        # Delete profile
        response = authenticated_client.delete(f"/api/v1/career/profiles/{profile.id}")

        assert response.status_code == 204

        # Verify deletion
        response = authenticated_client.get(f"/api/v1/career/profiles/{profile.id}")
        assert response.status_code == 404

    def test_list_profiles_with_pagination(
        self,
        authenticated_client: TestClient,
    ):
        """Test listing profiles with pagination."""
        # Create multiple profiles first
        for i in range(5):
            authenticated_client.post(
                "/api/v1/career/profiles",
                json={
                    "job_title": f"Engineer {i}",
                    "company_name": f"Company {i}",
                    "employment_type": "full_time",
                    "start_date": "2020-01-01",
                    "is_current": i == 4,  # Only last one is current
                },
            )

        # Test pagination
        response = authenticated_client.get("/api/v1/career/profiles?skip=0&limit=3")
        assert response.status_code == 200
        assert len(response.json()) == 3

        response = authenticated_client.get("/api/v1/career/profiles?skip=3&limit=3")
        assert response.status_code == 200
        assert len(response.json()) == 2


@pytest.mark.asyncio
@pytest.mark.api
class TestJobApplications:
    """Tests for job application endpoints."""

    def test_list_applications_empty(self, authenticated_client: TestClient):
        """Test listing applications when none exist."""
        response = authenticated_client.get("/api/v1/career/applications")

        assert response.status_code == 200
        assert response.json() == []

    async def test_create_application(
        self,
        authenticated_client: TestClient,
        db_session: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test creating a new job application."""
        response = authenticated_client.post(
            "/api/v1/career/applications",
            json={
                "company_name": "Google",
                "job_title": "Software Engineer",
                "application_date": "2025-01-15",
                "status": "applied",
                "job_description": "Build scalable systems",
                "application_url": "https://careers.google.com/job123",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["company_name"] == "Google"
        assert data["job_title"] == "Software Engineer"
        assert data["status"] == "applied"
        assert "id" in data

    async def test_get_application(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test retrieving a specific application."""
        # Create application
        application = JobApplication(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            company_name="Meta",
            job_title="Product Manager",
            application_date=date(2025, 2, 1),
            status="interview",
        )
        db_session_with_rls.add(application)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(application)

        # Get application
        response = authenticated_client.get(
            f"/api/v1/career/applications/{application.id}"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(application.id)
        assert data["company_name"] == "Meta"
        assert data["status"] == "interview"

    async def test_update_application_status(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test updating application status."""
        # Create application
        application = JobApplication(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            company_name="Amazon",
            job_title="DevOps Engineer",
            application_date=date(2025, 1, 10),
            status="applied",
        )
        db_session_with_rls.add(application)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(application)

        # Update status
        response = authenticated_client.patch(
            f"/api/v1/career/applications/{application.id}",
            json={"status": "offer"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "offer"

    async def test_delete_application(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test deleting an application."""
        # Create application
        application = JobApplication(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            company_name="Netflix",
            job_title="Backend Engineer",
            application_date=date(2025, 1, 5),
            status="rejected",
        )
        db_session_with_rls.add(application)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(application)

        # Delete application
        response = authenticated_client.delete(
            f"/api/v1/career/applications/{application.id}"
        )

        assert response.status_code == 204

        # Verify deletion
        response = authenticated_client.get(
            f"/api/v1/career/applications/{application.id}"
        )
        assert response.status_code == 404


@pytest.mark.asyncio
@pytest.mark.api
class TestInterviews:
    """Tests for interview endpoints."""

    def test_list_interviews_empty(self, authenticated_client: TestClient):
        """Test listing interviews when none exist."""
        response = authenticated_client.get("/api/v1/career/interviews")

        assert response.status_code == 200
        assert response.json() == []

    async def test_create_interview(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test creating a new interview."""
        # First create a job application
        application = JobApplication(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            company_name="Apple",
            job_title="iOS Developer",
            application_date=date(2025, 1, 1),
            status="interview",
        )
        db_session_with_rls.add(application)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(application)

        # Create interview
        response = authenticated_client.post(
            "/api/v1/career/interviews",
            json={
                "application_id": str(application.id),
                "interview_date": "2025-02-15T14:00:00",
                "interview_type": "technical",
                "interviewer_name": "John Smith",
                "status": "scheduled",
                "notes": "Prepare system design topics",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["application_id"] == str(application.id)
        assert data["interview_type"] == "technical"
        assert data["status"] == "scheduled"
        assert "id" in data

    async def test_get_interview(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test retrieving a specific interview."""
        # Create application
        application = JobApplication(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            company_name="Microsoft",
            job_title="Cloud Architect",
            application_date=date(2025, 1, 1),
            status="interview",
        )
        db_session_with_rls.add(application)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(application)

        # Create interview
        interview = Interview(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            application_id=application.id,
            interview_date=datetime(2025, 3, 1, 10, 0, 0),
            interview_type="behavioral",
            status="completed",
        )
        db_session_with_rls.add(interview)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(interview)

        # Get interview
        response = authenticated_client.get(f"/api/v1/career/interviews/{interview.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(interview.id)
        assert data["interview_type"] == "behavioral"
        assert data["status"] == "completed"

    async def test_update_interview(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test updating an interview."""
        # Create application
        application = JobApplication(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            company_name="Tesla",
            job_title="Robotics Engineer",
            application_date=date(2025, 1, 1),
            status="interview",
        )
        db_session_with_rls.add(application)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(application)

        # Create interview
        interview = Interview(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            application_id=application.id,
            interview_date=datetime(2025, 2, 20, 15, 0, 0),
            interview_type="technical",
            status="scheduled",
        )
        db_session_with_rls.add(interview)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(interview)

        # Update interview
        response = authenticated_client.patch(
            f"/api/v1/career/interviews/{interview.id}",
            json={
                "status": "completed",
                "notes": "Great interview! Discussed autonomous systems.",
                "feedback": "Very positive feedback from interviewer",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"
        assert "autonomous systems" in data["notes"]

    async def test_delete_interview(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test deleting an interview."""
        # Create application
        application = JobApplication(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            company_name="SpaceX",
            job_title="Software Engineer",
            application_date=date(2025, 1, 1),
            status="interview",
        )
        db_session_with_rls.add(application)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(application)

        # Create interview
        interview = Interview(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            application_id=application.id,
            interview_date=datetime(2025, 2, 10, 9, 0, 0),
            interview_type="phone_screen",
            status="cancelled",
        )
        db_session_with_rls.add(interview)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(interview)

        # Delete interview
        response = authenticated_client.delete(
            f"/api/v1/career/interviews/{interview.id}"
        )

        assert response.status_code == 204

        # Verify deletion
        response = authenticated_client.get(f"/api/v1/career/interviews/{interview.id}")
        assert response.status_code == 404

    async def test_list_interviews_filtered_by_application(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test filtering interviews by application."""
        # Create two applications
        app1 = JobApplication(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            company_name="Company A",
            job_title="Engineer",
            application_date=date(2025, 1, 1),
            status="interview",
        )
        app2 = JobApplication(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            company_name="Company B",
            job_title="Engineer",
            application_date=date(2025, 1, 1),
            status="interview",
        )
        db_session_with_rls.add_all([app1, app2])
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(app1)
        await db_session_with_rls.refresh(app2)

        # Create interviews for both applications
        interview1 = Interview(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            application_id=app1.id,
            interview_date=datetime(2025, 2, 1, 10, 0, 0),
            interview_type="technical",
            status="scheduled",
        )
        interview2 = Interview(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            application_id=app2.id,
            interview_date=datetime(2025, 2, 2, 14, 0, 0),
            interview_type="behavioral",
            status="scheduled",
        )
        db_session_with_rls.add_all([interview1, interview2])
        await db_session_with_rls.commit()

        # Filter by first application
        response = authenticated_client.get(
            f"/api/v1/career/interviews?application_id={app1.id}"
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["application_id"] == str(app1.id)


@pytest.mark.asyncio
@pytest.mark.api
class TestCareerTenantIsolation:
    """Tests for multi-tenant isolation in career endpoints."""

    async def test_profile_tenant_isolation(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
        second_tenant: Tenant,
    ):
        """Test that users can only see profiles from their tenant."""
        # Create profile in second tenant
        other_profile = CareerProfile(
            tenant_id=second_tenant.id,
            user_id=test_user.id,
            job_title="Secret Job",
            company_name="Other Company",
            employment_type="full_time",
            start_date=date(2020, 1, 1),
            is_current=True,
        )
        db_session_with_rls.add(other_profile)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(other_profile)

        # Try to access from first tenant (should be filtered by RLS)
        response = authenticated_client.get("/api/v1/career/profiles")

        assert response.status_code == 200
        profiles = response.json()
        # Should not see the profile from other tenant
        assert len(profiles) == 0

    async def test_application_tenant_isolation(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
        second_tenant: Tenant,
    ):
        """Test that users can only see applications from their tenant."""
        # Create application in second tenant
        other_app = JobApplication(
            tenant_id=second_tenant.id,
            user_id=test_user.id,
            company_name="Other Corp",
            job_title="Secret Position",
            application_date=date(2025, 1, 1),
            status="applied",
        )
        db_session_with_rls.add(other_app)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(other_app)

        # Try to access from first tenant
        response = authenticated_client.get("/api/v1/career/applications")

        assert response.status_code == 200
        applications = response.json()
        # Should not see the application from other tenant
        assert len(applications) == 0
