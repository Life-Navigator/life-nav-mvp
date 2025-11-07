"""
Goals domain endpoints.
Handles goals and milestones tracking.
"""

from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DBSession, TenantID
from app.core.logging import logger
from app.models.goals import Goal, Milestone
from app.schemas.goals import (
    GoalCreate,
    GoalResponse,
    GoalUpdate,
    MilestoneCreate,
    MilestoneResponse,
    MilestoneUpdate,
)

router = APIRouter()


# ============================================================================
# Goal Endpoints
# ============================================================================


@router.get("/", response_model=list[GoalResponse])
async def list_goals(
    db: DBSession,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    parent_goal_id: UUID | None = None,
):
    """
    List all goals for the current user.

    Optionally filter by parent_goal_id to get sub-goals.
    Supports pagination via skip and limit parameters.
    """
    query = select(Goal).where(Goal.user_id == current_user.id)

    if parent_goal_id is not None:
        query = query.where(Goal.parent_goal_id == parent_goal_id)

    query = query.offset(skip).limit(limit).order_by(Goal.created_at.desc())

    result = await db.execute(query)
    goals = result.scalars().all()

    logger.info(
        "List goals",
        user_id=str(current_user.id),
        count=len(goals),
        parent_goal_id=str(parent_goal_id) if parent_goal_id else None,
    )

    return [GoalResponse.model_validate(goal) for goal in goals]


@router.get("/{goal_id}", response_model=GoalResponse)
async def get_goal(
    goal_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Get a specific goal by ID.

    Returns 404 if goal not found or user doesn't have access.
    """
    result = await db.execute(select(Goal).where(Goal.id == goal_id))
    goal = result.scalar_one_or_none()

    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found",
        )

    logger.info("Get goal", goal_id=str(goal_id))
    return GoalResponse.model_validate(goal)


@router.post("/", response_model=GoalResponse, status_code=status.HTTP_201_CREATED)
async def create_goal(
    data: GoalCreate,
    db: DBSession,
    current_user: CurrentUser,
    tenant_id: TenantID,
):
    """
    Create a new goal.

    Associates the goal with the current user and tenant.
    Can optionally specify a parent_goal_id to create sub-goals.
    """
    goal = Goal(
        **data.model_dump(),
        user_id=current_user.id,
        tenant_id=tenant_id,
    )
    db.add(goal)
    await db.commit()
    await db.refresh(goal)

    logger.info("Goal created", goal_id=str(goal.id))
    return GoalResponse.model_validate(goal)


@router.patch("/{goal_id}", response_model=GoalResponse)
async def update_goal(
    goal_id: UUID,
    data: GoalUpdate,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Update a goal.

    Only updates fields provided in the request body.
    """
    result = await db.execute(select(Goal).where(Goal.id == goal_id))
    goal = result.scalar_one_or_none()

    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found",
        )

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(goal, key, value)

    await db.commit()
    await db.refresh(goal)

    logger.info("Goal updated", goal_id=str(goal_id))
    return GoalResponse.model_validate(goal)


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(
    goal_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Delete a goal.

    Soft deletes the goal by setting deleted_at timestamp.
    """
    result = await db.execute(select(Goal).where(Goal.id == goal_id))
    goal = result.scalar_one_or_none()

    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found",
        )

    await db.delete(goal)
    await db.commit()

    logger.info("Goal deleted", goal_id=str(goal_id))
    return None


# ============================================================================
# Milestone Endpoints
# ============================================================================


@router.get("/milestones", response_model=list[MilestoneResponse])
async def list_milestones(
    db: DBSession,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    goal_id: UUID | None = None,
):
    """
    List all milestones for the current user.

    Optionally filter by goal_id.
    Supports pagination via skip and limit parameters.
    """
    query = select(Milestone).where(Milestone.user_id == current_user.id)

    if goal_id:
        query = query.where(Milestone.goal_id == goal_id)

    query = query.offset(skip).limit(limit).order_by(Milestone.order_index)

    result = await db.execute(query)
    milestones = result.scalars().all()

    logger.info(
        "List milestones",
        user_id=str(current_user.id),
        count=len(milestones),
        goal_id=str(goal_id) if goal_id else None,
    )

    return [MilestoneResponse.model_validate(milestone) for milestone in milestones]


@router.get("/milestones/{milestone_id}", response_model=MilestoneResponse)
async def get_milestone(
    milestone_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Get a specific milestone by ID.

    Returns 404 if milestone not found or user doesn't have access.
    """
    result = await db.execute(select(Milestone).where(Milestone.id == milestone_id))
    milestone = result.scalar_one_or_none()

    if not milestone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Milestone not found",
        )

    logger.info("Get milestone", milestone_id=str(milestone_id))
    return MilestoneResponse.model_validate(milestone)


@router.post("/milestones", response_model=MilestoneResponse, status_code=status.HTTP_201_CREATED)
async def create_milestone(
    data: MilestoneCreate,
    db: DBSession,
    current_user: CurrentUser,
    tenant_id: TenantID,
):
    """
    Create a new milestone.

    Associates the milestone with the current user and tenant.
    Must specify a goal_id to associate the milestone with a goal.
    """
    milestone = Milestone(
        **data.model_dump(),
        user_id=current_user.id,
        tenant_id=tenant_id,
    )
    db.add(milestone)
    await db.commit()
    await db.refresh(milestone)

    logger.info("Milestone created", milestone_id=str(milestone.id))
    return MilestoneResponse.model_validate(milestone)


@router.patch("/milestones/{milestone_id}", response_model=MilestoneResponse)
async def update_milestone(
    milestone_id: UUID,
    data: MilestoneUpdate,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Update a milestone.

    Only updates fields provided in the request body.
    """
    result = await db.execute(select(Milestone).where(Milestone.id == milestone_id))
    milestone = result.scalar_one_or_none()

    if not milestone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Milestone not found",
        )

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(milestone, key, value)

    await db.commit()
    await db.refresh(milestone)

    logger.info("Milestone updated", milestone_id=str(milestone_id))
    return MilestoneResponse.model_validate(milestone)


@router.delete("/milestones/{milestone_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_milestone(
    milestone_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Delete a milestone.

    Soft deletes the milestone by setting deleted_at timestamp.
    """
    result = await db.execute(select(Milestone).where(Milestone.id == milestone_id))
    milestone = result.scalar_one_or_none()

    if not milestone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Milestone not found",
        )

    await db.delete(milestone)
    await db.commit()

    logger.info("Milestone deleted", milestone_id=str(milestone_id))
    return None
