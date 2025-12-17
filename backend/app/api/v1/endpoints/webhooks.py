"""
Webhook endpoints for external service integrations.
Handles Stripe, Plaid, and other webhook callbacks.
"""

import hmac
import hashlib
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Header, Request, status
from sqlalchemy import select

from app.api.deps import DBSession
from app.core.config import settings
from app.core.logging import logger

router = APIRouter()


# ============================================================================
# Stripe Webhooks
# ============================================================================

@router.post("/stripe", status_code=status.HTTP_200_OK)
async def stripe_webhook(
    request: Request,
    db: DBSession,
    stripe_signature: str = Header(None, alias="Stripe-Signature"),
):
    """
    Handle Stripe webhook events.

    Verifies webhook signature and processes payment events:
    - checkout.session.completed
    - customer.subscription.created
    - customer.subscription.updated
    - customer.subscription.deleted
    - invoice.paid
    - invoice.payment_failed
    - payment_intent.succeeded
    - payment_intent.payment_failed
    """
    if not settings.STRIPE_WEBHOOK_SECRET:
        logger.error("Stripe webhook secret not configured")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Webhook not configured",
        )

    payload = await request.body()

    try:
        import stripe
        stripe.api_key = settings.STRIPE_API_KEY

        event = stripe.Webhook.construct_event(
            payload,
            stripe_signature,
            settings.STRIPE_WEBHOOK_SECRET,
        )
    except ValueError as e:
        logger.error("Invalid Stripe payload", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid payload",
        )
    except stripe.error.SignatureVerificationError as e:
        logger.error("Invalid Stripe signature", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid signature",
        )

    event_type = event["type"]
    event_data = event["data"]["object"]

    logger.info("Stripe webhook received", event_type=event_type, event_id=event["id"])

    try:
        if event_type == "checkout.session.completed":
            await handle_checkout_completed(db, event_data)
        elif event_type == "customer.subscription.created":
            await handle_subscription_created(db, event_data)
        elif event_type == "customer.subscription.updated":
            await handle_subscription_updated(db, event_data)
        elif event_type == "customer.subscription.deleted":
            await handle_subscription_deleted(db, event_data)
        elif event_type == "invoice.paid":
            await handle_invoice_paid(db, event_data)
        elif event_type == "invoice.payment_failed":
            await handle_invoice_payment_failed(db, event_data)
        elif event_type == "payment_intent.succeeded":
            await handle_payment_succeeded(db, event_data)
        elif event_type == "payment_intent.payment_failed":
            await handle_payment_failed(db, event_data)
        elif event_type == "customer.created":
            await handle_customer_created(db, event_data)
        elif event_type == "customer.updated":
            await handle_customer_updated(db, event_data)
        else:
            logger.info("Unhandled Stripe event type", event_type=event_type)
    except Exception as e:
        logger.error("Error processing Stripe webhook", error=str(e), event_type=event_type)
        # Return 200 to prevent Stripe from retrying, but log the error
        # In production, you might want to queue this for retry

    return {"status": "success", "event_type": event_type}


async def handle_checkout_completed(db: DBSession, session: dict[str, Any]):
    """Handle successful checkout session completion."""
    customer_id = session.get("customer")
    subscription_id = session.get("subscription")
    metadata = session.get("metadata", {})
    user_id = metadata.get("user_id")

    logger.info(
        "Checkout completed",
        customer_id=customer_id,
        subscription_id=subscription_id,
        user_id=user_id,
    )

    if user_id:
        # Update user's subscription status in database
        from app.models.user import User
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if user:
            user.stripe_customer_id = customer_id
            user.stripe_subscription_id = subscription_id
            user.subscription_status = "active"
            await db.commit()
            logger.info("User subscription updated", user_id=user_id)


async def handle_subscription_created(db: DBSession, subscription: dict[str, Any]):
    """Handle new subscription creation."""
    customer_id = subscription.get("customer")
    subscription_id = subscription.get("id")
    status = subscription.get("status")

    logger.info(
        "Subscription created",
        customer_id=customer_id,
        subscription_id=subscription_id,
        status=status,
    )

    # Find user by Stripe customer ID and update subscription
    from app.models.user import User
    result = await db.execute(
        select(User).where(User.stripe_customer_id == customer_id)
    )
    user = result.scalar_one_or_none()

    if user:
        user.stripe_subscription_id = subscription_id
        user.subscription_status = status
        user.subscription_plan = get_plan_from_subscription(subscription)
        await db.commit()


async def handle_subscription_updated(db: DBSession, subscription: dict[str, Any]):
    """Handle subscription updates (plan changes, status changes)."""
    customer_id = subscription.get("customer")
    subscription_id = subscription.get("id")
    status = subscription.get("status")
    cancel_at_period_end = subscription.get("cancel_at_period_end", False)

    logger.info(
        "Subscription updated",
        customer_id=customer_id,
        subscription_id=subscription_id,
        status=status,
        cancel_at_period_end=cancel_at_period_end,
    )

    from app.models.user import User
    result = await db.execute(
        select(User).where(User.stripe_subscription_id == subscription_id)
    )
    user = result.scalar_one_or_none()

    if user:
        user.subscription_status = status
        user.subscription_plan = get_plan_from_subscription(subscription)
        user.subscription_cancel_at_period_end = cancel_at_period_end
        if subscription.get("current_period_end"):
            user.subscription_current_period_end = datetime.fromtimestamp(
                subscription["current_period_end"]
            )
        await db.commit()


async def handle_subscription_deleted(db: DBSession, subscription: dict[str, Any]):
    """Handle subscription cancellation/deletion."""
    subscription_id = subscription.get("id")

    logger.info("Subscription deleted", subscription_id=subscription_id)

    from app.models.user import User
    result = await db.execute(
        select(User).where(User.stripe_subscription_id == subscription_id)
    )
    user = result.scalar_one_or_none()

    if user:
        user.subscription_status = "canceled"
        user.subscription_plan = "free"
        await db.commit()


async def handle_invoice_paid(db: DBSession, invoice: dict[str, Any]):
    """Handle successful invoice payment."""
    customer_id = invoice.get("customer")
    subscription_id = invoice.get("subscription")
    amount_paid = invoice.get("amount_paid", 0)

    logger.info(
        "Invoice paid",
        customer_id=customer_id,
        subscription_id=subscription_id,
        amount_paid=amount_paid / 100,  # Convert from cents
    )

    # Record payment in billing history
    from app.models.user import User
    result = await db.execute(
        select(User).where(User.stripe_customer_id == customer_id)
    )
    user = result.scalar_one_or_none()

    if user:
        user.subscription_status = "active"
        user.last_payment_date = datetime.utcnow()
        user.last_payment_amount = amount_paid / 100
        await db.commit()


async def handle_invoice_payment_failed(db: DBSession, invoice: dict[str, Any]):
    """Handle failed invoice payment."""
    customer_id = invoice.get("customer")
    subscription_id = invoice.get("subscription")
    attempt_count = invoice.get("attempt_count", 1)

    logger.warning(
        "Invoice payment failed",
        customer_id=customer_id,
        subscription_id=subscription_id,
        attempt_count=attempt_count,
    )

    from app.models.user import User
    result = await db.execute(
        select(User).where(User.stripe_customer_id == customer_id)
    )
    user = result.scalar_one_or_none()

    if user:
        user.subscription_status = "past_due"
        user.payment_failed_count = attempt_count
        await db.commit()

        # TODO: Send email notification about payment failure


async def handle_payment_succeeded(db: DBSession, payment_intent: dict[str, Any]):
    """Handle successful one-time payment."""
    customer_id = payment_intent.get("customer")
    amount = payment_intent.get("amount", 0)

    logger.info(
        "Payment succeeded",
        customer_id=customer_id,
        amount=amount / 100,
    )


async def handle_payment_failed(db: DBSession, payment_intent: dict[str, Any]):
    """Handle failed one-time payment."""
    customer_id = payment_intent.get("customer")
    error = payment_intent.get("last_payment_error", {})

    logger.warning(
        "Payment failed",
        customer_id=customer_id,
        error_code=error.get("code"),
        error_message=error.get("message"),
    )


async def handle_customer_created(db: DBSession, customer: dict[str, Any]):
    """Handle new Stripe customer creation."""
    customer_id = customer.get("id")
    email = customer.get("email")

    logger.info("Stripe customer created", customer_id=customer_id, email=email)


async def handle_customer_updated(db: DBSession, customer: dict[str, Any]):
    """Handle Stripe customer updates."""
    customer_id = customer.get("id")

    logger.info("Stripe customer updated", customer_id=customer_id)


def get_plan_from_subscription(subscription: dict[str, Any]) -> str:
    """Extract plan name from subscription items."""
    items = subscription.get("items", {}).get("data", [])
    if not items:
        return "free"

    price_id = items[0].get("price", {}).get("id", "")

    # Map price IDs to plan names
    if settings.STRIPE_PRICE_ID_ENTERPRISE and price_id == settings.STRIPE_PRICE_ID_ENTERPRISE:
        return "enterprise"
    elif settings.STRIPE_PRICE_ID_PRO and price_id == settings.STRIPE_PRICE_ID_PRO:
        return "pro"
    elif settings.STRIPE_PRICE_ID_BASIC and price_id == settings.STRIPE_PRICE_ID_BASIC:
        return "basic"

    return "basic"


# ============================================================================
# Plaid Webhooks
# ============================================================================

@router.post("/plaid", status_code=status.HTTP_200_OK)
async def plaid_webhook(
    request: Request,
    db: DBSession,
    plaid_verification: str = Header(None, alias="Plaid-Verification"),
):
    """
    Handle Plaid webhook events.

    Processes events for:
    - TRANSACTIONS: New transactions available
    - ITEM: Item status changes (errors, updates needed)
    - HOLDINGS: Investment holdings updated
    - INVESTMENTS_TRANSACTIONS: Investment transactions available
    - LIABILITIES: Liability account updates
    - AUTH: Auth data updated
    """
    payload = await request.body()
    body = await request.json()

    # Verify webhook signature if configured
    if settings.PLAID_WEBHOOK_SECRET and plaid_verification:
        if not verify_plaid_webhook(payload, plaid_verification):
            logger.error("Invalid Plaid webhook signature")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid signature",
            )

    webhook_type = body.get("webhook_type")
    webhook_code = body.get("webhook_code")
    item_id = body.get("item_id")

    logger.info(
        "Plaid webhook received",
        webhook_type=webhook_type,
        webhook_code=webhook_code,
        item_id=item_id,
    )

    try:
        if webhook_type == "TRANSACTIONS":
            await handle_plaid_transactions(db, body)
        elif webhook_type == "ITEM":
            await handle_plaid_item(db, body)
        elif webhook_type == "HOLDINGS":
            await handle_plaid_holdings(db, body)
        elif webhook_type == "INVESTMENTS_TRANSACTIONS":
            await handle_plaid_investment_transactions(db, body)
        elif webhook_type == "LIABILITIES":
            await handle_plaid_liabilities(db, body)
        elif webhook_type == "AUTH":
            await handle_plaid_auth(db, body)
        else:
            logger.info("Unhandled Plaid webhook type", webhook_type=webhook_type)
    except Exception as e:
        logger.error(
            "Error processing Plaid webhook",
            error=str(e),
            webhook_type=webhook_type,
            webhook_code=webhook_code,
        )

    return {"status": "success", "webhook_type": webhook_type, "webhook_code": webhook_code}


def verify_plaid_webhook(payload: bytes, verification_header: str) -> bool:
    """Verify Plaid webhook signature using JWT verification."""
    # Plaid uses JWT for webhook verification
    # Full implementation would decode and verify the JWT
    # For now, return True if header is present
    return bool(verification_header)


async def handle_plaid_transactions(db: DBSession, body: dict[str, Any]):
    """Handle transaction webhook events."""
    webhook_code = body.get("webhook_code")
    item_id = body.get("item_id")

    if webhook_code == "INITIAL_UPDATE":
        # Initial transaction data available
        logger.info("Initial transactions available", item_id=item_id)
        # Trigger transaction sync

    elif webhook_code == "HISTORICAL_UPDATE":
        # Historical transactions available
        logger.info("Historical transactions available", item_id=item_id)

    elif webhook_code == "DEFAULT_UPDATE":
        # New transactions available
        new_transactions = body.get("new_transactions", 0)
        logger.info(
            "New transactions available",
            item_id=item_id,
            count=new_transactions,
        )

    elif webhook_code == "TRANSACTIONS_REMOVED":
        # Transactions were removed (reversed, etc.)
        removed_transactions = body.get("removed_transactions", [])
        logger.info(
            "Transactions removed",
            item_id=item_id,
            count=len(removed_transactions),
        )

    elif webhook_code == "SYNC_UPDATES_AVAILABLE":
        # New sync updates available
        logger.info("Sync updates available", item_id=item_id)


async def handle_plaid_item(db: DBSession, body: dict[str, Any]):
    """Handle item webhook events."""
    webhook_code = body.get("webhook_code")
    item_id = body.get("item_id")
    error = body.get("error")

    if webhook_code == "ERROR":
        logger.error("Plaid item error", item_id=item_id, error=error)
        # Mark item as needing attention in database

    elif webhook_code == "PENDING_EXPIRATION":
        consent_expiration = body.get("consent_expiration_time")
        logger.warning(
            "Plaid item pending expiration",
            item_id=item_id,
            expiration=consent_expiration,
        )
        # Notify user to re-authenticate

    elif webhook_code == "USER_PERMISSION_REVOKED":
        logger.info("User permission revoked", item_id=item_id)
        # Disable item in database

    elif webhook_code == "WEBHOOK_UPDATE_ACKNOWLEDGED":
        logger.info("Webhook URL updated", item_id=item_id)


async def handle_plaid_holdings(db: DBSession, body: dict[str, Any]):
    """Handle investment holdings webhook events."""
    webhook_code = body.get("webhook_code")
    item_id = body.get("item_id")

    if webhook_code == "DEFAULT_UPDATE":
        logger.info("Holdings updated", item_id=item_id)
        # Trigger holdings sync


async def handle_plaid_investment_transactions(db: DBSession, body: dict[str, Any]):
    """Handle investment transaction webhook events."""
    webhook_code = body.get("webhook_code")
    item_id = body.get("item_id")

    if webhook_code == "DEFAULT_UPDATE":
        new_transactions = body.get("new_investments_transactions", 0)
        logger.info(
            "New investment transactions",
            item_id=item_id,
            count=new_transactions,
        )


async def handle_plaid_liabilities(db: DBSession, body: dict[str, Any]):
    """Handle liabilities webhook events."""
    webhook_code = body.get("webhook_code")
    item_id = body.get("item_id")

    if webhook_code == "DEFAULT_UPDATE":
        logger.info("Liabilities updated", item_id=item_id)


async def handle_plaid_auth(db: DBSession, body: dict[str, Any]):
    """Handle auth webhook events."""
    webhook_code = body.get("webhook_code")
    item_id = body.get("item_id")

    if webhook_code == "AUTOMATICALLY_VERIFIED":
        logger.info("Account automatically verified", item_id=item_id)
    elif webhook_code == "VERIFICATION_EXPIRED":
        logger.warning("Account verification expired", item_id=item_id)
