"""
Integration endpoints for external services.
Handles Plaid Link, Stripe Checkout, and OAuth token management.
"""

from uuid import UUID
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from app.api.deps import CurrentUser, DBSession, TenantID
from app.core.config import settings
from app.core.logging import logger

router = APIRouter()


# ============================================================================
# Pydantic Models
# ============================================================================

class PlaidLinkTokenRequest(BaseModel):
    """Request to create a Plaid Link token."""
    products: list[str] = ["auth", "transactions"]
    country_codes: list[str] = ["US"]


class PlaidLinkTokenResponse(BaseModel):
    """Response with Plaid Link token."""
    link_token: str
    expiration: str


class PlaidExchangeRequest(BaseModel):
    """Request to exchange Plaid public token."""
    public_token: str
    institution_id: str
    institution_name: str
    accounts: list[dict[str, Any]]


class PlaidExchangeResponse(BaseModel):
    """Response after exchanging Plaid token."""
    success: bool
    accounts_linked: int


class StripeCheckoutRequest(BaseModel):
    """Request to create Stripe checkout session."""
    price_id: str
    success_url: str
    cancel_url: str


class StripeCheckoutResponse(BaseModel):
    """Response with Stripe checkout session."""
    checkout_url: str
    session_id: str


class StripePortalRequest(BaseModel):
    """Request to create Stripe customer portal session."""
    return_url: str


class StripePortalResponse(BaseModel):
    """Response with Stripe portal URL."""
    portal_url: str


class IntegrationStatusResponse(BaseModel):
    """Status of a user's integrations."""
    plaid_connected: bool
    plaid_accounts_count: int
    stripe_subscription_active: bool
    stripe_plan: str | None
    google_connected: bool
    google_services: list[str]


# ============================================================================
# Plaid Endpoints
# ============================================================================

@router.post("/plaid/link-token", response_model=PlaidLinkTokenResponse)
async def create_plaid_link_token(
    request: PlaidLinkTokenRequest,
    current_user: CurrentUser,
):
    """
    Create a Plaid Link token for the user.

    This token is used to initialize Plaid Link in the frontend.
    """
    if not settings.PLAID_CLIENT_ID or not settings.PLAID_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Plaid integration not configured",
        )

    try:
        from plaid.api import plaid_api
        from plaid.model.link_token_create_request import LinkTokenCreateRequest
        from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
        from plaid.model.products import Products
        from plaid.model.country_code import CountryCode
        from plaid import Configuration, ApiClient

        # Configure Plaid client
        configuration = Configuration(
            host=get_plaid_host(),
            api_key={
                "clientId": settings.PLAID_CLIENT_ID,
                "secret": settings.PLAID_SECRET,
            }
        )

        api_client = ApiClient(configuration)
        client = plaid_api.PlaidApi(api_client)

        # Create link token request
        link_request = LinkTokenCreateRequest(
            client_name="Life Navigator",
            user=LinkTokenCreateRequestUser(client_user_id=str(current_user.id)),
            products=[Products(p) for p in request.products],
            country_codes=[CountryCode(c) for c in request.country_codes],
            language="en",
            webhook=f"{settings.FRONTEND_URL}/api/webhooks/plaid",
        )

        response = client.link_token_create(link_request)

        logger.info(
            "Plaid link token created",
            user_id=str(current_user.id),
            products=request.products,
        )

        return PlaidLinkTokenResponse(
            link_token=response.link_token,
            expiration=response.expiration,
        )

    except Exception as e:
        logger.error("Failed to create Plaid link token", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create link token",
        )


@router.post("/plaid/exchange", response_model=PlaidExchangeResponse)
async def exchange_plaid_token(
    request: PlaidExchangeRequest,
    db: DBSession,
    current_user: CurrentUser,
    tenant_id: TenantID,
):
    """
    Exchange Plaid public token for access token and store linked accounts.
    """
    if not settings.PLAID_CLIENT_ID or not settings.PLAID_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Plaid integration not configured",
        )

    try:
        from plaid.api import plaid_api
        from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
        from plaid import Configuration, ApiClient

        # Configure Plaid client
        configuration = Configuration(
            host=get_plaid_host(),
            api_key={
                "clientId": settings.PLAID_CLIENT_ID,
                "secret": settings.PLAID_SECRET,
            }
        )

        api_client = ApiClient(configuration)
        client = plaid_api.PlaidApi(api_client)

        # Exchange public token for access token
        exchange_request = ItemPublicTokenExchangeRequest(
            public_token=request.public_token
        )
        exchange_response = client.item_public_token_exchange(exchange_request)

        access_token = exchange_response.access_token
        item_id = exchange_response.item_id

        # Store the connection in the database
        from app.models.finance import PlaidItem, FinancialAccount

        # Create Plaid item record
        plaid_item = PlaidItem(
            user_id=current_user.id,
            tenant_id=tenant_id,
            item_id=item_id,
            access_token=access_token,  # Should be encrypted in production
            institution_id=request.institution_id,
            institution_name=request.institution_name,
            status="active",
        )
        db.add(plaid_item)

        # Create financial account records for each linked account
        accounts_created = 0
        for account_data in request.accounts:
            account = FinancialAccount(
                user_id=current_user.id,
                tenant_id=tenant_id,
                plaid_account_id=account_data.get("id"),
                plaid_item_id=item_id,
                name=account_data.get("name", "Unknown Account"),
                official_name=account_data.get("official_name"),
                account_type=account_data.get("type", "other"),
                account_subtype=account_data.get("subtype"),
                mask=account_data.get("mask"),
                institution_name=request.institution_name,
                current_balance=account_data.get("balances", {}).get("current"),
                available_balance=account_data.get("balances", {}).get("available"),
                currency_code=account_data.get("balances", {}).get("iso_currency_code", "USD"),
                is_connected=True,
            )
            db.add(account)
            accounts_created += 1

        await db.commit()

        logger.info(
            "Plaid token exchanged",
            user_id=str(current_user.id),
            item_id=item_id,
            accounts_count=accounts_created,
        )

        return PlaidExchangeResponse(
            success=True,
            accounts_linked=accounts_created,
        )

    except Exception as e:
        logger.error("Failed to exchange Plaid token", error=str(e))
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to exchange token",
        )


@router.post("/plaid/sync/{item_id}")
async def sync_plaid_transactions(
    item_id: str,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Trigger a sync of transactions for a Plaid item.
    """
    from app.models.finance import PlaidItem

    # Verify user owns this item
    result = await db.execute(
        select(PlaidItem).where(
            PlaidItem.item_id == item_id,
            PlaidItem.user_id == current_user.id,
        )
    )
    plaid_item = result.scalar_one_or_none()

    if not plaid_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plaid item not found",
        )

    # TODO: Trigger async job to sync transactions

    logger.info("Transaction sync triggered", item_id=item_id)
    return {"status": "sync_initiated", "item_id": item_id}


@router.delete("/plaid/{item_id}")
async def disconnect_plaid_item(
    item_id: str,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Disconnect a Plaid item and remove associated accounts.
    """
    from app.models.finance import PlaidItem, FinancialAccount

    # Verify user owns this item
    result = await db.execute(
        select(PlaidItem).where(
            PlaidItem.item_id == item_id,
            PlaidItem.user_id == current_user.id,
        )
    )
    plaid_item = result.scalar_one_or_none()

    if not plaid_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plaid item not found",
        )

    # Remove from Plaid
    try:
        from plaid.api import plaid_api
        from plaid.model.item_remove_request import ItemRemoveRequest
        from plaid import Configuration, ApiClient

        configuration = Configuration(
            host=get_plaid_host(),
            api_key={
                "clientId": settings.PLAID_CLIENT_ID,
                "secret": settings.PLAID_SECRET,
            }
        )

        api_client = ApiClient(configuration)
        client = plaid_api.PlaidApi(api_client)

        remove_request = ItemRemoveRequest(access_token=plaid_item.access_token)
        client.item_remove(remove_request)
    except Exception as e:
        logger.warning("Failed to remove item from Plaid", error=str(e))

    # Mark accounts as disconnected
    await db.execute(
        FinancialAccount.__table__.update()
        .where(FinancialAccount.plaid_item_id == item_id)
        .values(is_connected=False)
    )

    # Delete Plaid item record
    await db.delete(plaid_item)
    await db.commit()

    logger.info("Plaid item disconnected", item_id=item_id)
    return {"status": "disconnected", "item_id": item_id}


# ============================================================================
# Stripe Endpoints
# ============================================================================

@router.post("/stripe/checkout", response_model=StripeCheckoutResponse)
async def create_stripe_checkout(
    request: StripeCheckoutRequest,
    current_user: CurrentUser,
):
    """
    Create a Stripe Checkout session for subscription.
    """
    if not settings.STRIPE_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe integration not configured",
        )

    try:
        import stripe
        stripe.api_key = settings.STRIPE_API_KEY

        # Create or get Stripe customer
        customer_id = current_user.stripe_customer_id

        if not customer_id:
            customer = stripe.Customer.create(
                email=current_user.email,
                name=current_user.full_name,
                metadata={"user_id": str(current_user.id)},
            )
            customer_id = customer.id
            # Note: In production, update user with customer_id

        # Create checkout session
        session = stripe.checkout.Session.create(
            customer=customer_id,
            mode="subscription",
            payment_method_types=["card"],
            line_items=[
                {
                    "price": request.price_id,
                    "quantity": 1,
                }
            ],
            success_url=request.success_url,
            cancel_url=request.cancel_url,
            metadata={"user_id": str(current_user.id)},
            subscription_data={
                "metadata": {"user_id": str(current_user.id)},
            },
        )

        logger.info(
            "Stripe checkout session created",
            user_id=str(current_user.id),
            session_id=session.id,
        )

        return StripeCheckoutResponse(
            checkout_url=session.url,
            session_id=session.id,
        )

    except Exception as e:
        logger.error("Failed to create Stripe checkout", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create checkout session",
        )


@router.post("/stripe/portal", response_model=StripePortalResponse)
async def create_stripe_portal(
    request: StripePortalRequest,
    current_user: CurrentUser,
):
    """
    Create a Stripe Customer Portal session for subscription management.
    """
    if not settings.STRIPE_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe integration not configured",
        )

    if not current_user.stripe_customer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No Stripe customer found",
        )

    try:
        import stripe
        stripe.api_key = settings.STRIPE_API_KEY

        portal_session = stripe.billing_portal.Session.create(
            customer=current_user.stripe_customer_id,
            return_url=request.return_url,
        )

        logger.info(
            "Stripe portal session created",
            user_id=str(current_user.id),
        )

        return StripePortalResponse(portal_url=portal_session.url)

    except Exception as e:
        logger.error("Failed to create Stripe portal", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create portal session",
        )


@router.get("/stripe/subscription")
async def get_stripe_subscription(current_user: CurrentUser):
    """
    Get current user's subscription details.
    """
    if not settings.STRIPE_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe integration not configured",
        )

    if not current_user.stripe_subscription_id:
        return {
            "has_subscription": False,
            "plan": "free",
            "status": None,
        }

    try:
        import stripe
        stripe.api_key = settings.STRIPE_API_KEY

        subscription = stripe.Subscription.retrieve(
            current_user.stripe_subscription_id
        )

        return {
            "has_subscription": True,
            "plan": current_user.subscription_plan or "basic",
            "status": subscription.status,
            "current_period_end": subscription.current_period_end,
            "cancel_at_period_end": subscription.cancel_at_period_end,
        }

    except Exception as e:
        logger.error("Failed to get subscription", error=str(e))
        return {
            "has_subscription": False,
            "plan": "free",
            "status": "error",
        }


# ============================================================================
# Integration Status
# ============================================================================

@router.get("/status", response_model=IntegrationStatusResponse)
async def get_integration_status(
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Get status of all user integrations.
    """
    from app.models.finance import PlaidItem

    # Check Plaid connections
    result = await db.execute(
        select(PlaidItem).where(
            PlaidItem.user_id == current_user.id,
            PlaidItem.status == "active",
        )
    )
    plaid_items = result.scalars().all()

    # Get total accounts count
    plaid_accounts_count = 0
    if plaid_items:
        from app.models.finance import FinancialAccount
        result = await db.execute(
            select(FinancialAccount).where(
                FinancialAccount.user_id == current_user.id,
                FinancialAccount.is_connected == True,
            )
        )
        plaid_accounts_count = len(result.scalars().all())

    # Check Stripe subscription
    stripe_active = current_user.subscription_status == "active"
    stripe_plan = current_user.subscription_plan if stripe_active else None

    # Check Google connections (from user's OAuth tokens)
    google_services = []
    # TODO: Query user's OAuth connections for Google services

    return IntegrationStatusResponse(
        plaid_connected=len(plaid_items) > 0,
        plaid_accounts_count=plaid_accounts_count,
        stripe_subscription_active=stripe_active,
        stripe_plan=stripe_plan,
        google_connected=len(google_services) > 0,
        google_services=google_services,
    )


# ============================================================================
# Google OAuth Endpoints
# ============================================================================

class GoogleTokensRequest(BaseModel):
    """Request to store Google OAuth tokens."""
    access_token: str
    refresh_token: str
    expires_at: str
    scope: str
    google_user_id: str
    google_email: str


class GoogleTokensResponse(BaseModel):
    """Response after storing Google tokens."""
    success: bool
    services_connected: list[str]


class GoogleServiceStatus(BaseModel):
    """Status of Google service connections."""
    connected: bool
    email: str | None
    services: list[str]
    expires_at: str | None


@router.post("/google/tokens", response_model=GoogleTokensResponse)
async def store_google_tokens(
    request: GoogleTokensRequest,
    db: DBSession,
    current_user: CurrentUser,
    tenant_id: TenantID,
):
    """
    Store Google OAuth tokens for the user.

    Called by the frontend after successful OAuth callback.
    """
    try:
        from app.models.integration import OAuthConnection

        # Parse scopes to determine connected services
        scope_to_service = {
            "calendar": ["calendar", "calendar.events", "calendar.readonly"],
            "gmail": ["gmail", "mail.google"],
            "drive": ["drive"],
            "docs": ["documents"],
            "tasks": ["tasks"],
            "meet": ["meetings"],
            "chat": ["chat"],
            "contacts": ["contacts", "directory"],
            "fitness": ["fitness"],
            "vault": ["ediscovery"],
            "classroom": ["classroom"],
        }

        connected_services = []
        scope_lower = request.scope.lower()
        for service, keywords in scope_to_service.items():
            if any(kw in scope_lower for kw in keywords):
                connected_services.append(service)

        # Check if connection already exists
        result = await db.execute(
            select(OAuthConnection).where(
                OAuthConnection.user_id == current_user.id,
                OAuthConnection.provider == "google",
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            # Update existing connection
            existing.access_token = request.access_token
            existing.refresh_token = request.refresh_token
            existing.expires_at = datetime.fromisoformat(request.expires_at.replace("Z", "+00:00"))
            existing.scope = request.scope
            existing.provider_user_id = request.google_user_id
            existing.provider_email = request.google_email
            existing.connected_services = connected_services
            existing.updated_at = datetime.utcnow()
        else:
            # Create new connection
            connection = OAuthConnection(
                user_id=current_user.id,
                tenant_id=tenant_id,
                provider="google",
                access_token=request.access_token,
                refresh_token=request.refresh_token,
                expires_at=datetime.fromisoformat(request.expires_at.replace("Z", "+00:00")),
                scope=request.scope,
                provider_user_id=request.google_user_id,
                provider_email=request.google_email,
                connected_services=connected_services,
                status="active",
            )
            db.add(connection)

        await db.commit()

        logger.info(
            "Google tokens stored",
            user_id=str(current_user.id),
            email=request.google_email,
            services=connected_services,
        )

        return GoogleTokensResponse(
            success=True,
            services_connected=connected_services,
        )

    except Exception as e:
        logger.error("Failed to store Google tokens", error=str(e))
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to store tokens",
        )


@router.get("/google/status", response_model=GoogleServiceStatus)
async def get_google_status(
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Get status of user's Google integration.
    """
    try:
        from app.models.integration import OAuthConnection

        result = await db.execute(
            select(OAuthConnection).where(
                OAuthConnection.user_id == current_user.id,
                OAuthConnection.provider == "google",
                OAuthConnection.status == "active",
            )
        )
        connection = result.scalar_one_or_none()

        if not connection:
            return GoogleServiceStatus(
                connected=False,
                email=None,
                services=[],
                expires_at=None,
            )

        return GoogleServiceStatus(
            connected=True,
            email=connection.provider_email,
            services=connection.connected_services or [],
            expires_at=connection.expires_at.isoformat() if connection.expires_at else None,
        )

    except Exception as e:
        logger.error("Failed to get Google status", error=str(e))
        return GoogleServiceStatus(
            connected=False,
            email=None,
            services=[],
            expires_at=None,
        )


@router.delete("/google")
async def disconnect_google(
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Disconnect Google integration.
    """
    try:
        from app.models.integration import OAuthConnection

        result = await db.execute(
            select(OAuthConnection).where(
                OAuthConnection.user_id == current_user.id,
                OAuthConnection.provider == "google",
            )
        )
        connection = result.scalar_one_or_none()

        if not connection:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Google connection not found",
            )

        # Revoke token with Google (best effort)
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"https://oauth2.googleapis.com/revoke?token={connection.access_token}"
                )
        except Exception as e:
            logger.warning("Failed to revoke Google token", error=str(e))

        # Delete connection
        await db.delete(connection)
        await db.commit()

        logger.info("Google disconnected", user_id=str(current_user.id))

        return {"status": "disconnected"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to disconnect Google", error=str(e))
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to disconnect",
        )


@router.post("/google/refresh")
async def refresh_google_token(
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Refresh Google access token.
    """
    try:
        from app.models.integration import OAuthConnection

        result = await db.execute(
            select(OAuthConnection).where(
                OAuthConnection.user_id == current_user.id,
                OAuthConnection.provider == "google",
                OAuthConnection.status == "active",
            )
        )
        connection = result.scalar_one_or_none()

        if not connection or not connection.refresh_token:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Google connection not found or no refresh token",
            )

        # Refresh token with Google
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "refresh_token": connection.refresh_token,
                    "grant_type": "refresh_token",
                },
            )

            if not response.is_success:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token refresh failed - reauthorization required",
                )

            data = response.json()

        # Update tokens
        connection.access_token = data["access_token"]
        connection.expires_at = datetime.utcnow() + timedelta(seconds=data["expires_in"])
        connection.updated_at = datetime.utcnow()

        await db.commit()

        logger.info("Google token refreshed", user_id=str(current_user.id))

        return {
            "access_token": connection.access_token,
            "expires_at": connection.expires_at.isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to refresh Google token", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to refresh token",
        )


# ============================================================================
# Helper Functions
# ============================================================================

def get_plaid_host() -> str:
    """Get Plaid API host based on environment."""
    env = settings.PLAID_ENV
    if env == "production":
        return "https://production.plaid.com"
    elif env == "development":
        return "https://development.plaid.com"
    return "https://sandbox.plaid.com"
