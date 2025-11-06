"""
Tests for goals domain endpoints.

Tests cover:
- Goal CRUD operations
- Milestone CRUD operations
- Parent-child goal relationships
- Multi-tenant isolation
- Permission enforcement
"""

import pytest
from datetime import date, datetime
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.goals import Goal, Milestone
from app.models.user import User, Tenant


@pytest.mark.asyncio
@pytest.mark.api
class TestGoals:
    """Tests for goal endpoints."""

    def test_list_goals_empty(self, authenticated_client: TestClient):
        """Test listing goals when none exist."""
        response = authenticated_client.get("/api/v1/goals/")

        assert response.status_code == 200
        assert response.json() == []

    async def test_create_goal(
        self,
        authenticated_client: TestClient,
        db_session: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test creating a new goal."""
        response = authenticated_client.post(
            "/api/v1/goals/",
            json={
                "title": "Buy a house",
                "description": "Save for down payment and purchase first home",
                "category": "finance",
                "target_date": "2026-12-31",
                "status": "in_progress",
                "priority": "high",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Buy a house"
        assert data["category"] == "finance"
        assert data["status"] == "in_progress"
        assert data["priority"] == "high"
        assert "id" in data

    async def test_get_goal(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test retrieving a specific goal."""
        # Create goal
        goal = Goal(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            title="Learn machine learning",
            description="Complete ML course and build projects",
            category="education",
            target_date=date(2025, 12, 31),
            status="in_progress",
        )
        db_session_with_rls.add(goal)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(goal)

        # Get goal
        response = authenticated_client.get(f"/api/v1/goals/{goal.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(goal.id)
        assert data["title"] == "Learn machine learning"
        assert data["category"] == "education"

    async def test_update_goal(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test updating a goal."""
        # Create goal
        goal = Goal(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            title="Run a marathon",
            description="Train for and complete first marathon",
            category="health",
            target_date=date(2025, 10, 15),
            status="not_started",
        )
        db_session_with_rls.add(goal)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(goal)

        # Update goal
        response = authenticated_client.patch(
            f"/api/v1/goals/{goal.id}",
            json={
                "status": "in_progress",
                "progress_percentage": 25.0,
                "notes": "Started training program, running 3x per week",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "in_progress"
        assert data["progress_percentage"] == 25.0

    async def test_delete_goal(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test deleting a goal."""
        # Create goal
        goal = Goal(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            title="Old goal",
            description="No longer relevant",
            category="other",
            target_date=date(2020, 12, 31),
            status="abandoned",
        )
        db_session_with_rls.add(goal)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(goal)

        # Delete goal
        response = authenticated_client.delete(f"/api/v1/goals/{goal.id}")

        assert response.status_code == 204

        # Verify deletion
        response = authenticated_client.get(f"/api/v1/goals/{goal.id}")
        assert response.status_code == 404

    async def test_create_sub_goal(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test creating a sub-goal with parent relationship."""
        # Create parent goal
        parent_goal = Goal(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            title="Build startup",
            description="Launch successful tech company",
            category="career",
            target_date=date(2027, 12, 31),
            status="in_progress",
        )
        db_session_with_rls.add(parent_goal)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(parent_goal)

        # Create sub-goal
        response = authenticated_client.post(
            "/api/v1/goals/",
            json={
                "title": "Raise seed funding",
                "description": "Secure $1M seed round",
                "category": "finance",
                "target_date": "2025-06-30",
                "status": "in_progress",
                "parent_goal_id": str(parent_goal.id),
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["parent_goal_id"] == str(parent_goal.id)
        assert data["title"] == "Raise seed funding"

    async def test_list_sub_goals(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test listing sub-goals filtered by parent."""
        # Create parent goal
        parent = Goal(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            title="Get healthy",
            category="health",
            status="in_progress",
        )
        db_session_with_rls.add(parent)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(parent)

        # Create sub-goals
        sub1 = Goal(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            title="Lose weight",
            category="health",
            status="in_progress",
            parent_goal_id=parent.id,
        )
        sub2 = Goal(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            title="Exercise regularly",
            category="health",
            status="in_progress",
            parent_goal_id=parent.id,
        )
        db_session_with_rls.add_all([sub1, sub2])
        await db_session_with_rls.commit()

        # List sub-goals
        response = authenticated_client.get(f"/api/v1/goals/?parent_goal_id={parent.id}")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert all(g["parent_goal_id"] == str(parent.id) for g in data)


@pytest.mark.asyncio
@pytest.mark.api
class TestMilestones:
    """Tests for milestone endpoints."""

    def test_list_milestones_empty(self, authenticated_client: TestClient):
        """Test listing milestones when none exist."""
        response = authenticated_client.get("/api/v1/goals/milestones/")

        assert response.status_code == 200
        assert response.json() == []

    async def test_create_milestone(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test creating a new milestone."""
        # Create goal first
        goal = Goal(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            title="Launch product",
            category="career",
            status="in_progress",
        )
        db_session_with_rls.add(goal)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(goal)

        # Create milestone
        response = authenticated_client.post(
            "/api/v1/goals/milestones/",
            json={
                "goal_id": str(goal.id),
                "title": "MVP completed",
                "description": "Minimum viable product ready",
                "target_date": "2025-03-31",
                "status": "pending",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["goal_id"] == str(goal.id)
        assert data["title"] == "MVP completed"
        assert data["status"] == "pending"
        assert "id" in data

    async def test_get_milestone(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test retrieving a specific milestone."""
        # Create goal and milestone
        goal = Goal(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            title="Test goal",
            category="other",
            status="in_progress",
        )
        db_session_with_rls.add(goal)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(goal)

        milestone = Milestone(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            goal_id=goal.id,
            title="First milestone",
            target_date=date(2025, 6, 30),
            status="completed",
        )
        db_session_with_rls.add(milestone)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(milestone)

        # Get milestone
        response = authenticated_client.get(f"/api/v1/goals/milestones/{milestone.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(milestone.id)
        assert data["title"] == "First milestone"
        assert data["status"] == "completed"

    async def test_update_milestone(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test updating a milestone."""
        # Create goal and milestone
        goal = Goal(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            title="Test goal",
            category="other",
            status="in_progress",
        )
        db_session_with_rls.add(goal)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(goal)

        milestone = Milestone(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            goal_id=goal.id,
            title="Milestone to update",
            target_date=date(2025, 5, 31),
            status="pending",
        )
        db_session_with_rls.add(milestone)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(milestone)

        # Update milestone
        response = authenticated_client.patch(
            f"/api/v1/goals/milestones/{milestone.id}",
            json={
                "status": "completed",
                "completion_date": "2025-02-15",
                "notes": "Completed ahead of schedule!",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"

    async def test_delete_milestone(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test deleting a milestone."""
        # Create goal and milestone
        goal = Goal(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            title="Test goal",
            category="other",
            status="in_progress",
        )
        db_session_with_rls.add(goal)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(goal)

        milestone = Milestone(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            goal_id=goal.id,
            title="Milestone to delete",
            target_date=date(2025, 8, 31),
            status="cancelled",
        )
        db_session_with_rls.add(milestone)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(milestone)

        # Delete milestone
        response = authenticated_client.delete(f"/api/v1/goals/milestones/{milestone.id}")

        assert response.status_code == 204

        # Verify deletion
        response = authenticated_client.get(f"/api/v1/goals/milestones/{milestone.id}")
        assert response.status_code == 404

    async def test_list_milestones_by_goal(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
    ):
        """Test listing milestones filtered by goal."""
        # Create two goals
        goal1 = Goal(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            title="Goal 1",
            category="other",
            status="in_progress",
        )
        goal2 = Goal(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            title="Goal 2",
            category="other",
            status="in_progress",
        )
        db_session_with_rls.add_all([goal1, goal2])
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(goal1)
        await db_session_with_rls.refresh(goal2)

        # Create milestones
        m1 = Milestone(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            goal_id=goal1.id,
            title="Milestone 1",
            target_date=date(2025, 3, 31),
            status="pending",
        )
        m2 = Milestone(
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            goal_id=goal2.id,
            title="Milestone 2",
            target_date=date(2025, 4, 30),
            status="pending",
        )
        db_session_with_rls.add_all([m1, m2])
        await db_session_with_rls.commit()

        # Filter by goal1
        response = authenticated_client.get(f"/api/v1/goals/milestones/?goal_id={goal1.id}")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["goal_id"] == str(goal1.id)


@pytest.mark.asyncio
@pytest.mark.api
class TestGoalsTenantIsolation:
    """Tests for multi-tenant isolation in goals endpoints."""

    async def test_goal_tenant_isolation(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
        second_tenant: Tenant,
    ):
        """Test that users can only see goals from their tenant."""
        # Create goal in second tenant
        other_goal = Goal(
            tenant_id=second_tenant.id,
            user_id=test_user.id,
            title="Secret goal",
            category="other",
            status="in_progress",
        )
        db_session_with_rls.add(other_goal)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(other_goal)

        # Try to access from first tenant
        response = authenticated_client.get("/api/v1/goals/")

        assert response.status_code == 200
        goals = response.json()
        # Should not see the goal from other tenant
        assert len(goals) == 0

    async def test_milestone_tenant_isolation(
        self,
        authenticated_client: TestClient,
        db_session_with_rls: AsyncSession,
        test_user: User,
        test_tenant: Tenant,
        second_tenant: Tenant,
    ):
        """Test that users can only see milestones from their tenant."""
        # Create goal and milestone in second tenant
        other_goal = Goal(
            tenant_id=second_tenant.id,
            user_id=test_user.id,
            title="Other goal",
            category="other",
            status="in_progress",
        )
        db_session_with_rls.add(other_goal)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(other_goal)

        other_milestone = Milestone(
            tenant_id=second_tenant.id,
            user_id=test_user.id,
            goal_id=other_goal.id,
            title="Secret milestone",
            target_date=date(2025, 12, 31),
            status="pending",
        )
        db_session_with_rls.add(other_milestone)
        await db_session_with_rls.commit()
        await db_session_with_rls.refresh(other_milestone)

        # Try to access from first tenant
        response = authenticated_client.get("/api/v1/goals/milestones/")

        assert response.status_code == 200
        milestones = response.json()
        # Should not see the milestone from other tenant
        assert len(milestones) == 0
