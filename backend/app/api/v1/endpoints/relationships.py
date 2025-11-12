"""
Relationships domain endpoints.
Handles contacts and contact interactions tracking.
"""

from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DBSession, TenantID
from app.core.logging import logger
from app.models.relationships import Contact, ContactInteraction
from app.schemas.relationships import (
    ContactCreate,
    ContactInteractionCreate,
    ContactInteractionResponse,
    ContactInteractionUpdate,
    ContactResponse,
    ContactUpdate,
)

router = APIRouter()


# ============================================================================
# Contact Endpoints
# ============================================================================


@router.get("/contacts", response_model=list[ContactResponse])
async def list_contacts(
    db: DBSession,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
):
    """
    List all contacts for the current user.

    Supports pagination via skip and limit parameters.
    """
    result = await db.execute(
        select(Contact)
        .where(Contact.user_id == current_user.id)
        .offset(skip)
        .limit(limit)
        .order_by(Contact.created_at.desc())
    )
    contacts = result.scalars().all()

    logger.info(
        "List contacts",
        user_id=str(current_user.id),
        count=len(contacts),
    )

    return [ContactResponse.model_validate(contact) for contact in contacts]


@router.get("/contacts/{contact_id}", response_model=ContactResponse)
async def get_contact(
    contact_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Get a specific contact by ID.

    Returns 404 if contact not found or user doesn't have access.
    """
    result = await db.execute(select(Contact).where(Contact.id == contact_id))
    contact = result.scalar_one_or_none()

    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found",
        )

    # Authorization check: ensure user owns this contact
    if contact.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this contact",
        )

    logger.info("Get contact", contact_id=str(contact_id))
    return ContactResponse.model_validate(contact)


@router.post("/contacts", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
async def create_contact(
    data: ContactCreate,
    db: DBSession,
    current_user: CurrentUser,
    tenant_id: TenantID,
):
    """
    Create a new contact.

    Associates the contact with the current user and tenant.
    """
    contact = Contact(
        **data.model_dump(),
        user_id=current_user.id,
        tenant_id=tenant_id,
    )
    db.add(contact)
    await db.commit()
    await db.refresh(contact)

    logger.info("Contact created", contact_id=str(contact.id))
    return ContactResponse.model_validate(contact)


@router.patch("/contacts/{contact_id}", response_model=ContactResponse)
async def update_contact(
    contact_id: UUID,
    data: ContactUpdate,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Update a contact.

    Only updates fields provided in the request body.
    """
    result = await db.execute(select(Contact).where(Contact.id == contact_id))
    contact = result.scalar_one_or_none()

    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found",
        )

    # Authorization check: ensure user owns this contact
    if contact.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this contact",
        )

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(contact, key, value)

    await db.commit()
    await db.refresh(contact)

    logger.info("Contact updated", contact_id=str(contact_id))
    return ContactResponse.model_validate(contact)


@router.delete("/contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(
    contact_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Delete a contact.

    Soft deletes the contact by setting deleted_at timestamp.
    """
    result = await db.execute(select(Contact).where(Contact.id == contact_id))
    contact = result.scalar_one_or_none()

    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found",
        )

    # Authorization check: ensure user owns this contact
    if contact.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this contact",
        )

    await db.delete(contact)
    await db.commit()

    logger.info("Contact deleted", contact_id=str(contact_id))
    return None


# ============================================================================
# ContactInteraction Endpoints
# ============================================================================


@router.get("/interactions", response_model=list[ContactInteractionResponse])
async def list_contact_interactions(
    db: DBSession,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    contact_id: UUID | None = None,
):
    """
    List all contact interactions for the current user.

    Optionally filter by contact_id.
    Supports pagination via skip and limit parameters.
    """
    query = select(ContactInteraction).where(ContactInteraction.user_id == current_user.id)

    if contact_id:
        query = query.where(ContactInteraction.contact_id == contact_id)

    query = query.offset(skip).limit(limit).order_by(ContactInteraction.interaction_date.desc())

    result = await db.execute(query)
    interactions = result.scalars().all()

    logger.info(
        "List contact interactions",
        user_id=str(current_user.id),
        count=len(interactions),
        contact_id=str(contact_id) if contact_id else None,
    )

    return [ContactInteractionResponse.model_validate(interaction) for interaction in interactions]


@router.get("/interactions/{interaction_id}", response_model=ContactInteractionResponse)
async def get_contact_interaction(
    interaction_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Get a specific contact interaction by ID.

    Returns 404 if interaction not found or user doesn't have access.
    """
    result = await db.execute(
        select(ContactInteraction).where(ContactInteraction.id == interaction_id)
    )
    interaction = result.scalar_one_or_none()

    if not interaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact interaction not found",
        )

    # Authorization check: ensure user owns this contact interaction
    if interaction.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this contact interaction",
        )

    logger.info("Get contact interaction", interaction_id=str(interaction_id))
    return ContactInteractionResponse.model_validate(interaction)


@router.post(
    "/interactions", response_model=ContactInteractionResponse, status_code=status.HTTP_201_CREATED
)
async def create_contact_interaction(
    data: ContactInteractionCreate,
    db: DBSession,
    current_user: CurrentUser,
    tenant_id: TenantID,
):
    """
    Create a new contact interaction.

    Associates the interaction with the current user and tenant.
    """
    interaction = ContactInteraction(
        **data.model_dump(),
        user_id=current_user.id,
        tenant_id=tenant_id,
    )
    db.add(interaction)
    await db.commit()
    await db.refresh(interaction)

    logger.info("Contact interaction created", interaction_id=str(interaction.id))
    return ContactInteractionResponse.model_validate(interaction)


@router.patch("/interactions/{interaction_id}", response_model=ContactInteractionResponse)
async def update_contact_interaction(
    interaction_id: UUID,
    data: ContactInteractionUpdate,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Update a contact interaction.

    Only updates fields provided in the request body.
    """
    result = await db.execute(
        select(ContactInteraction).where(ContactInteraction.id == interaction_id)
    )
    interaction = result.scalar_one_or_none()

    if not interaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact interaction not found",
        )

    # Authorization check: ensure user owns this contact interaction
    if interaction.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this contact interaction",
        )

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(interaction, key, value)

    await db.commit()
    await db.refresh(interaction)

    logger.info("Contact interaction updated", interaction_id=str(interaction_id))
    return ContactInteractionResponse.model_validate(interaction)


@router.delete("/interactions/{interaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact_interaction(
    interaction_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Delete a contact interaction.

    Soft deletes the interaction by setting deleted_at timestamp.
    """
    result = await db.execute(
        select(ContactInteraction).where(ContactInteraction.id == interaction_id)
    )
    interaction = result.scalar_one_or_none()

    if not interaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact interaction not found",
        )

    # Authorization check: ensure user owns this contact interaction
    if interaction.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this contact interaction",
        )

    await db.delete(interaction)
    await db.commit()

    logger.info("Contact interaction deleted", interaction_id=str(interaction_id))
    return None
