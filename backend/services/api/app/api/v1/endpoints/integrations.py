"""
Integration endpoints
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.api import deps
from app.models.user import User
from app.models.integration_platform import IntegrationPlatform
from app.models.user_integration import UserIntegration
from app.schemas.integration import (
    IntegrationPlatformResponse,
    IntegrationPlatformList,
    UserIntegrationCreate,
    UserIntegrationUpdate,
    UserIntegrationResponse,
    ConnectedServiceResponse,
    SyncStatusResponse,
)

router = APIRouter()


@router.get("/platforms", response_model=IntegrationPlatformList)
def get_integration_platforms(
    *,
    db: Session = Depends(deps.get_db),
    category: Optional[str] = Query(None, description="Filter by category"),
    coming_soon: Optional[bool] = Query(None, description="Filter by coming_soon status"),
    skip: int = 0,
    limit: int = 100,
) -> IntegrationPlatformList:
    """
    Get all available integration platforms
    """
    query = db.query(IntegrationPlatform).filter(IntegrationPlatform.is_active == True)

    if category:
        query = query.filter(IntegrationPlatform.category == category)

    if coming_soon is not None:
        query = query.filter(IntegrationPlatform.coming_soon == coming_soon)

    query = query.order_by(IntegrationPlatform.display_order, IntegrationPlatform.name)

    total = query.count()
    platforms = query.offset(skip).limit(limit).all()

    return IntegrationPlatformList(
        platforms=[IntegrationPlatformResponse.model_validate(p) for p in platforms],
        total=total
    )


@router.get("/platforms/{platform_id}", response_model=IntegrationPlatformResponse)
def get_integration_platform(
    *,
    db: Session = Depends(deps.get_db),
    platform_id: str,
) -> IntegrationPlatformResponse:
    """
    Get a specific integration platform by ID
    """
    platform = db.query(IntegrationPlatform).filter(
        and_(
            IntegrationPlatform.id == platform_id,
            IntegrationPlatform.is_active == True
        )
    ).first()

    if not platform:
        raise HTTPException(status_code=404, detail="Integration platform not found")

    return IntegrationPlatformResponse.model_validate(platform)


@router.get("/user", response_model=List[UserIntegrationResponse])
def get_user_integrations(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    status: Optional[str] = Query(None, description="Filter by status"),
) -> List[UserIntegrationResponse]:
    """
    Get all integrations for the current user
    """
    query = db.query(UserIntegration).filter(UserIntegration.user_id == current_user.id)

    if status:
        query = query.filter(UserIntegration.status == status)

    user_integrations = query.all()

    # Load platform data for each integration
    result = []
    for ui in user_integrations:
        platform = db.query(IntegrationPlatform).filter(
            IntegrationPlatform.id == ui.platform_id
        ).first()

        ui_dict = UserIntegrationResponse.model_validate(ui).model_dump()
        if platform:
            ui_dict["platform"] = IntegrationPlatformResponse.model_validate(platform)

        result.append(UserIntegrationResponse(**ui_dict))

    return result


@router.post("/user", response_model=UserIntegrationResponse, status_code=201)
def create_user_integration(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    integration_in: UserIntegrationCreate,
) -> UserIntegrationResponse:
    """
    Connect a new integration for the current user
    """
    # Check if platform exists
    platform = db.query(IntegrationPlatform).filter(
        and_(
            IntegrationPlatform.id == integration_in.platform_id,
            IntegrationPlatform.is_active == True
        )
    ).first()

    if not platform:
        raise HTTPException(status_code=404, detail="Integration platform not found")

    # Check if already connected
    existing = db.query(UserIntegration).filter(
        and_(
            UserIntegration.user_id == current_user.id,
            UserIntegration.platform_id == integration_in.platform_id
        )
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Integration already connected. Use PATCH to update."
        )

    # Create new integration
    user_integration = UserIntegration(
        user_id=current_user.id,
        platform_id=integration_in.platform_id,
        access_token=integration_in.access_token,
        refresh_token=integration_in.refresh_token,
        token_expires_at=integration_in.token_expires_at,
        scopes=integration_in.scopes,
        metadata=integration_in.metadata,
    )

    db.add(user_integration)
    db.commit()
    db.refresh(user_integration)

    # Load platform data
    result = UserIntegrationResponse.model_validate(user_integration)
    result.platform = IntegrationPlatformResponse.model_validate(platform)

    return result


@router.patch("/user/{integration_id}", response_model=UserIntegrationResponse)
def update_user_integration(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    integration_id: str,
    integration_update: UserIntegrationUpdate,
) -> UserIntegrationResponse:
    """
    Update a user's integration
    """
    user_integration = db.query(UserIntegration).filter(
        and_(
            UserIntegration.id == integration_id,
            UserIntegration.user_id == current_user.id
        )
    ).first()

    if not user_integration:
        raise HTTPException(status_code=404, detail="Integration not found")

    # Update fields
    update_data = integration_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user_integration, field, value)

    db.commit()
    db.refresh(user_integration)

    # Load platform data
    platform = db.query(IntegrationPlatform).filter(
        IntegrationPlatform.id == user_integration.platform_id
    ).first()

    result = UserIntegrationResponse.model_validate(user_integration)
    if platform:
        result.platform = IntegrationPlatformResponse.model_validate(platform)

    return result


@router.delete("/user/{integration_id}", status_code=204)
def delete_user_integration(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    integration_id: str,
):
    """
    Disconnect/delete a user's integration
    """
    user_integration = db.query(UserIntegration).filter(
        and_(
            UserIntegration.id == integration_id,
            UserIntegration.user_id == current_user.id
        )
    ).first()

    if not user_integration:
        raise HTTPException(status_code=404, detail="Integration not found")

    db.delete(user_integration)
    db.commit()

    return None


@router.get("/connected-services", response_model=List[ConnectedServiceResponse])
def get_connected_services(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> List[ConnectedServiceResponse]:
    """
    Get connected services for dashboard display
    """
    user_integrations = db.query(UserIntegration).filter(
        and_(
            UserIntegration.user_id == current_user.id,
            UserIntegration.status.in_(["active", "needs_attention", "expired"])
        )
    ).all()

    result = []
    for ui in user_integrations:
        platform = db.query(IntegrationPlatform).filter(
            IntegrationPlatform.id == ui.platform_id
        ).first()

        if platform:
            result.append(
                ConnectedServiceResponse(
                    id=str(ui.id),
                    provider_id=ui.platform_id,
                    name=platform.name,
                    logo_url=platform.logo,
                    status=ui.status,
                    connected_date=ui.connected_at,
                    last_sync_date=ui.last_sync_at,
                    domain=platform.category,
                )
            )

    return result


@router.get("/sync-status", response_model=SyncStatusResponse)
def get_sync_status(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> SyncStatusResponse:
    """
    Get overall sync status across all integrations
    """
    user_integrations = db.query(UserIntegration).filter(
        UserIntegration.user_id == current_user.id
    ).all()

    if not user_integrations:
        return SyncStatusResponse(
            status="success",
            last_sync=None,
            domains={
                "finance": "success",
                "education": "success",
                "career": "success",
                "healthcare": "success",
                "automotive": "success",
                "smarthome": "success",
            }
        )

    # Calculate domain statuses
    domain_statuses = {}
    categories = ["finance", "education", "career", "healthcare", "automotive", "smarthome"]

    for category in categories:
        category_integrations = [
            ui for ui in user_integrations
            if db.query(IntegrationPlatform).filter(
                and_(
                    IntegrationPlatform.id == ui.platform_id,
                    IntegrationPlatform.category == category
                )
            ).first()
        ]

        if not category_integrations:
            domain_statuses[category] = "success"
        elif any(ui.status == "needs_attention" for ui in category_integrations):
            domain_statuses[category] = "failed"
        else:
            domain_statuses[category] = "success"

    # Overall status
    overall_status = "failed" if "failed" in domain_statuses.values() else "success"

    # Most recent sync
    last_sync = max(
        (ui.last_sync_at for ui in user_integrations if ui.last_sync_at),
        default=None
    )

    return SyncStatusResponse(
        status=overall_status,
        last_sync=last_sync,
        domains=domain_statuses
    )
