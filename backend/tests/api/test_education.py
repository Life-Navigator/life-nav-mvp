"""
Tests for education domain endpoints.

Tests cover:
- Education credential CRUD operations
- Course CRUD operations
- Multi-tenant isolation
- Permission enforcement
"""

import pytest
from datetime import date
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.education import EducationCredential, Course
from app.models.user import User, Tenant


@pytest.mark.asyncio
@pytest.mark.api
class TestEducationCredentials:
    """Tests for education credential endpoints."""

    def test_list_credentials_empty(self, authenticated_client: TestClient):
        """Test listing credentials when none exist."""
        response = authenticated_client.get("/api/v1/education/credentials")

        assert response.status_code == 200
        assert response.json() == []

    async def test_create_credential(
        self,
        authenticated_client: TestClient,
        db_session: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test creating a new education credential."""
        response = authenticated_client.post(
            "/api/v1/education/credentials",
            json={
                "institution_name": "MIT",
                "degree_type": "bachelors",
                "field_of_study": "Computer Science",
                "start_date": "2015-09-01",
                "end_date": "2019-05-31",
                "gpa": 3.8,
                "is_current": False,
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["institution_name"] == "MIT"
        assert data["degree_type"] == "bachelors"
        assert data["field_of_study"] == "Computer Science"
        assert data["gpa"] == 3.8
        assert "id" in data

    async def test_get_credential(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test retrieving a specific credential."""
        # Create credential
        credential = EducationCredential(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            institution_name="Stanford University",
            degree_type="masters",
            field_of_study="Artificial Intelligence",
            start_date=date(2019, 9, 1),
            end_date=date(2021, 6, 30),
            is_current=False,
            gpa=3.9,
        )
        db_session_with_rls.add(credential)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(credential)

        # Get credential
        response = authenticated_client.get(
            f"/api/v1/education/credentials/{credential.id}"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(credential.id)
        assert data["institution_name"] == "Stanford University"
        assert data["degree_type"] == "masters"

    async def test_update_credential(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test updating a credential."""
        # Create credential
        credential = EducationCredential(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            institution_name="UC Berkeley",
            degree_type="phd",
            field_of_study="Machine Learning",
            start_date=date(2021, 9, 1),
            is_current=True,
        )
        db_session_with_rls.add(credential)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(credential)

        # Update credential
        response = authenticated_client.patch(
            f"/api/v1/education/credentials/{credential.id}",
            json={
                "is_current": False,
                "end_date": "2025-05-31",
                "gpa": 4.0,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_current"] is False
        assert data["gpa"] == 4.0

    async def test_delete_credential(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test deleting a credential."""
        # Create credential
        credential = EducationCredential(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            institution_name="Community College",
            degree_type="associates",
            field_of_study="General Studies",
            start_date=date(2010, 9, 1),
            end_date=date(2012, 5, 31),
            is_current=False,
        )
        db_session_with_rls.add(credential)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(credential)

        # Delete credential
        response = authenticated_client.delete(
            f"/api/v1/education/credentials/{credential.id}"
        )

        assert response.status_code == 204

        # Verify deletion
        response = authenticated_client.get(
            f"/api/v1/education/credentials/{credential.id}"
        )
        assert response.status_code == 404

    def test_get_nonexistent_credential(self, authenticated_client: TestClient):
        """Test getting a credential that doesn't exist."""
        from uuid import uuid4

        fake_id = uuid4()
        response = authenticated_client.get(
            f"/api/v1/education/credentials/{fake_id}"
        )

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
@pytest.mark.api
class TestCourses:
    """Tests for course endpoints."""

    def test_list_courses_empty(self, authenticated_client: TestClient):
        """Test listing courses when none exist."""
        response = authenticated_client.get("/api/v1/education/courses")

        assert response.status_code == 200
        assert response.json() == []

    async def test_create_course(
        self,
        authenticated_client: TestClient,
        db_session: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test creating a new course."""
        response = authenticated_client.post(
            "/api/v1/education/courses",
            json={
                "course_name": "Machine Learning Fundamentals",
                "institution_name": "Coursera",
                "course_type": "online",
                "start_date": "2025-01-15",
                "status": "in_progress",
                "instructor_name": "Andrew Ng",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["course_name"] == "Machine Learning Fundamentals"
        assert data["institution_name"] == "Coursera"
        assert data["course_type"] == "online"
        assert data["status"] == "in_progress"
        assert "id" in data

    async def test_get_course(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test retrieving a specific course."""
        # Create course
        course = Course(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            course_name="Deep Learning Specialization",
            institution_name="deeplearning.ai",
            course_type="online",
            start_date=date(2024, 11, 1),
            status="completed",
        )
        db_session_with_rls.add(course)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(course)

        # Get course
        response = authenticated_client.get(f"/api/v1/education/courses/{course.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(course.id)
        assert data["course_name"] == "Deep Learning Specialization"
        assert data["status"] == "completed"

    async def test_update_course(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test updating a course."""
        # Create course
        course = Course(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            course_name="Python for Data Science",
            institution_name="DataCamp",
            course_type="online",
            start_date=date(2025, 1, 1),
            status="in_progress",
        )
        db_session_with_rls.add(course)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(course)

        # Update course
        response = authenticated_client.patch(
            f"/api/v1/education/courses/{course.id}",
            json={
                "status": "completed",
                "end_date": "2025-02-01",
                "grade": "A",
                "certificate_url": "https://datacamp.com/cert/abc123",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"
        assert data["grade"] == "A"

    async def test_delete_course(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test deleting a course."""
        # Create course
        course = Course(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            course_name="Old Course",
            institution_name="Udemy",
            course_type="online",
            start_date=date(2020, 1, 1),
            status="dropped",
        )
        db_session_with_rls.add(course)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(course)

        # Delete course
        response = authenticated_client.delete(f"/api/v1/education/courses/{course.id}")

        assert response.status_code == 204

        # Verify deletion
        response = authenticated_client.get(f"/api/v1/education/courses/{course.id}")
        assert response.status_code == 404

    async def test_list_courses_filtered_by_credential(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test filtering courses by credential."""
        # Create credential
        credential = EducationCredential(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            institution_name="Harvard University",
            degree_type="bachelors",
            field_of_study="Mathematics",
            start_date=date(2020, 9, 1),
            is_current=True,
        )
        db_session_with_rls.add(credential)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(credential)

        # Create courses
        course1 = Course(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            credential_id=credential.id,
            course_name="Calculus I",
            institution_name="Harvard University",
            course_type="in_person",
            start_date=date(2020, 9, 1),
            status="completed",
        )
        course2 = Course(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            course_name="Python Basics",
            institution_name="Codecademy",
            course_type="online",
            start_date=date(2021, 1, 1),
            status="completed",
        )
        db_session_with_rls.add_all([course1, course2])
        await db_session_with_rls.commit()

        # Filter by credential
        response = authenticated_client.get(
            f"/api/v1/education/courses?credential_id={credential.id}"
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["credential_id"] == str(credential.id)


@pytest.mark.asyncio
@pytest.mark.api
class TestEducationTenantIsolation:
    """Tests for multi-tenant isolation in education endpoints."""

    async def test_credential_tenant_isolation(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
        second_tenant: Tenant,
    ):
        """Test that users can only see credentials from their tenant."""
        # Create credential in second tenant
        other_credential = EducationCredential(
            tenant_id=second_tenant.id,
            user_id=test_user.id,
            institution_name="Secret University",
            degree_type="doctorate",
            field_of_study="Quantum Physics",
            start_date=date(2020, 1, 1),
            is_current=True,
        )
        db_session_with_rls.add(other_credential)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(other_credential)

        # Try to access from first tenant
        response = authenticated_client.get("/api/v1/education/credentials")

        assert response.status_code == 200
        credentials = response.json()
        # Should not see the credential from other tenant
        assert len(credentials) == 0

    async def test_course_tenant_isolation(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
        second_tenant: Tenant,
    ):
        """Test that users can only see courses from their tenant."""
        # Create course in second tenant
        other_course = Course(
            tenant_id=second_tenant.id,
            user_id=test_user.id,
            course_name="Secret Course",
            institution_name="Other Institution",
            course_type="online",
            start_date=date(2025, 1, 1),
            status="in_progress",
        )
        db_session_with_rls.add(other_course)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(other_course)

        # Try to access from first tenant
        response = authenticated_client.get("/api/v1/education/courses")

        assert response.status_code == 200
        courses = response.json()
        # Should not see the course from other tenant
        assert len(courses) == 0
