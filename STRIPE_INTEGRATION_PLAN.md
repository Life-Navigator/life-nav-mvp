# 💳 STRIPE INTEGRATION & MONETIZATION PLAN

**Date**: January 12, 2026
**Status**: READY TO IMPLEMENT
**Timeline**: 3-4 days

---

## 🎯 MONETIZATION ARCHITECTURE

### Existing System (ln-core) ✅
**Already implemented** in ln-core repository:
- ✅ Subscription tiers (Freemium, Pro, Family Office)
- ✅ Premium specialist marketplace (6 specialists)
- ✅ Model routing (Gemma vs Llama 4 Maverick)
- ✅ Access control & upgrade enforcement
- ✅ Usage tracking & telemetry

### What We Need to Add ❌
**Stripe integration** in monorepo:
- ❌ Stripe subscription management
- ❌ Payment processing
- ❌ One-time purchases (extra queries, specialist add-ons)
- ❌ Webhook handling (subscription updates)
- ❌ Customer portal (manage subscription)

---

## 💰 PRICING STRUCTURE

### Base Subscription Tiers

| Tier | Monthly Price | Annual Price | Model | Queries/Day | Specialists | Multi-Agent |
|------|--------------|--------------|-------|-------------|-------------|-------------|
| **Freemium** | $0 | $0 | Gemini Flash | 20 | None | No |
| **Pro** | $29 | $290 (save $58) | Llama 4 Maverick | 200 | Add-ons | Yes |
| **Family Office** | $99 | $990 (save $198) | Llama 4 Maverick | Unlimited | All included | Yes |

### Premium Specialist Add-Ons (Pro Tier Only)

| Specialist | Price/Month | Domain | Description |
|-----------|-------------|--------|-------------|
| **Tax Optimizer** | $2 | Tax | Tax deduction discovery, withholding optimization |
| **Portfolio Analyst** | $3 | Investments | Portfolio rebalancing, allocation analysis |
| **Debt Strategist** | $2 | Finance | Multi-loan payoff optimization |
| **Real Estate Analyzer** | $12 | Real Estate | Buy vs rent, property valuation |
| **Healthcare Navigator** | $15 | Health | Insurance plan optimization |
| **Career Negotiation** | $3 | Career | Salary negotiation, offer analysis |

### Specialist Bundles

| Bundle | Price/Month | Included Specialists | Savings |
|--------|-------------|---------------------|---------|
| **Wealth Builder** | $29 | Pro + Tax + Portfolio + Debt | Includes Pro! |
| **Homebuyer** | $12 | Real Estate + Tax | Save $2 |

### One-Time Purchases

| Product | Price | Description |
|---------|-------|-------------|
| **Extra Queries (50)** | $5 | 50 additional queries (no expiration) |
| **Extra Queries (100)** | $9 | 100 additional queries (no expiration) |
| **Single Agent Session** | $3 | One-time access to any specialist for 24h |

---

## 🏗️ STRIPE INTEGRATION ARCHITECTURE

```
┌────────────────────────────────────────────────────────────────┐
│  FRONTEND (Next.js)                                            │
│  ├── Pricing page                   Display tiers              │
│  ├── Checkout flow                  Stripe Checkout            │
│  ├── Customer portal button          Manage subscription       │
│  └── Usage dashboard                 Show remaining queries    │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     │ API calls
                     ▼
┌────────────────────────────────────────────────────────────────┐
│  BACKEND (FastAPI Gateway)                                     │
│  ├── /api/billing/checkout          Create Checkout Session   │
│  ├── /api/billing/portal            Customer Portal Link      │
│  ├── /api/billing/subscription      Get current subscription  │
│  ├── /api/billing/webhooks          Stripe webhook handler    │
│  └── /api/billing/purchase          One-time purchases        │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     │ Stripe API
                     ▼
┌────────────────────────────────────────────────────────────────┐
│  STRIPE                                                         │
│  ├── Products                       Tiers, specialists, packs  │
│  ├── Subscriptions                  Recurring billing          │
│  ├── Checkout                       Payment pages              │
│  ├── Customer Portal                Self-service management    │
│  └── Webhooks                       subscription.updated, etc  │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     │ Updates via webhook
                     ▼
┌────────────────────────────────────────────────────────────────┐
│  DATABASE (PostgreSQL)                                         │
│  └── User model                                                │
│      ├── stripe_customer_id         Links user to Stripe      │
│      ├── stripe_subscription_id     Current subscription       │
│      ├── subscription_tier          freemium, pro, etc         │
│      ├── premium_specialists[]      Owned specialists          │
│      ├── query_balance              Remaining queries          │
│      └── subscription_status        active, canceled, etc      │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     │ User tier checked
                     ▼
┌────────────────────────────────────────────────────────────────┐
│  LN-CORE (AI Backend)                                          │
│  └── Access Controller                                         │
│      ├── Check subscription_tier    Route to correct model    │
│      ├── Check premium_specialists  Allow specialist access   │
│      └── Check query_balance        Enforce limits            │
└────────────────────────────────────────────────────────────────┘
```

---

## 📊 DATABASE SCHEMA ADDITIONS

### Update User Model (Prisma)

**File**: `apps/web/prisma/schema.prisma`

```prisma
model User {
  id                    String   @id @default(cuid())
  email                 String   @unique
  name                  String?

  // === STRIPE BILLING ===
  stripeCustomerId      String?  @unique @map("stripe_customer_id")
  stripeSubscriptionId  String?  @unique @map("stripe_subscription_id")
  subscriptionTier      String   @default("freemium") @map("subscription_tier")
  // freemium, pro, family_office

  subscriptionStatus    String?  @map("subscription_status")
  // active, past_due, canceled, incomplete, incomplete_expired, trialing, unpaid

  currentPeriodStart    DateTime? @map("current_period_start")
  currentPeriodEnd      DateTime? @map("current_period_end")
  cancelAtPeriodEnd     Boolean  @default(false) @map("cancel_at_period_end")

  // === PREMIUM SPECIALISTS ===
  premiumSpecialists    String[] @default([]) @map("premium_specialists")
  // ["tax_optimizer", "portfolio_analyst", "debt_strategist", ...]

  // === USAGE TRACKING ===
  queryBalance          Int      @default(20) @map("query_balance")
  // Free queries remaining (refills daily for freemium, resets monthly for pro)

  lastQueryReset        DateTime @default(now()) @map("last_query_reset")
  queriesUsedToday      Int      @default(0) @map("queries_used_today")
  queriesUsedMonth      Int      @default(0) @map("queries_used_month")

  // === TRIAL ===
  trialEndsAt           DateTime? @map("trial_ends_at")
  hasUsedTrial          Boolean  @default(false) @map("has_used_trial")

  createdAt             DateTime @default(now()) @map("created_at")
  updatedAt             DateTime @updatedAt @map("updated_at")

  // Relations
  profile               UserProfile?
  goals                 Goal[]
  benefitRankings       BenefitRanking[]
  // ... other existing relations

  @@map("users")
}

model StripeEvent {
  id                String   @id @default(cuid())
  stripeEventId     String   @unique @map("stripe_event_id")
  type              String   // customer.subscription.updated, etc
  data              Json     // Full event data
  processed         Boolean  @default(false)
  processedAt       DateTime? @map("processed_at")
  error             String?  // Error message if processing failed
  createdAt         DateTime @default(now()) @map("created_at")

  @@map("stripe_events")
}
```

### Migration Command
```bash
cd apps/web
npx prisma migrate dev --name add_stripe_billing
```

---

## 🔧 BACKEND IMPLEMENTATION

### 1. Install Dependencies

**File**: `backend/pyproject.toml`

```toml
[tool.poetry.dependencies]
stripe = "^7.0.0"  # Stripe Python library
```

```bash
cd backend
poetry add stripe
```

### 2. Configuration

**File**: `backend/app/core/config.py`

```python
class Settings(BaseSettings):
    # ... existing settings ...

    # Stripe Configuration
    STRIPE_SECRET_KEY: str = Field(..., env="STRIPE_SECRET_KEY")
    STRIPE_PUBLISHABLE_KEY: str = Field(..., env="STRIPE_PUBLISHABLE_KEY")
    STRIPE_WEBHOOK_SECRET: str = Field(..., env="STRIPE_WEBHOOK_SECRET")
    STRIPE_PRICE_PRO_MONTHLY: str = Field(..., env="STRIPE_PRICE_PRO_MONTHLY")
    STRIPE_PRICE_PRO_ANNUAL: str = Field(..., env="STRIPE_PRICE_PRO_ANNUAL")
    STRIPE_PRICE_FAMILY_MONTHLY: str = Field(..., env="STRIPE_PRICE_FAMILY_MONTHLY")
    STRIPE_PRICE_FAMILY_ANNUAL: str = Field(..., env="STRIPE_PRICE_FAMILY_ANNUAL")

    # Frontend URL for redirects
    FRONTEND_URL: str = Field(default="http://localhost:3000", env="FRONTEND_URL")

settings = Settings()
```

**File**: `backend/.env`

```bash
# Stripe Keys (get from https://dashboard.stripe.com/apikeys)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Price IDs (create in Stripe Dashboard)
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_ANNUAL=price_...
STRIPE_PRICE_FAMILY_MONTHLY=price_...
STRIPE_PRICE_FAMILY_ANNUAL=price_...

FRONTEND_URL=http://localhost:3000
```

### 3. Stripe Client Service

**File**: `backend/app/services/stripe_service.py` (NEW)

```python
import stripe
from typing import Optional, Dict, Any
from app.core.config import settings
from app.core.logging import logger

stripe.api_key = settings.STRIPE_SECRET_KEY

class StripeService:
    """Service for Stripe billing operations."""

    @staticmethod
    async def create_customer(
        email: str,
        user_id: str,
        name: Optional[str] = None
    ) -> str:
        """
        Create a Stripe customer.
        Returns customer ID.
        """
        try:
            customer = stripe.Customer.create(
                email=email,
                name=name,
                metadata={"user_id": user_id}
            )
            logger.info("Stripe customer created", customer_id=customer.id, user_id=user_id)
            return customer.id
        except stripe.StripeError as e:
            logger.error("Failed to create Stripe customer", error=str(e))
            raise

    @staticmethod
    async def create_checkout_session(
        customer_id: str,
        price_id: str,
        user_id: str,
        mode: str = "subscription",  # or "payment" for one-time
        success_url: Optional[str] = None,
        cancel_url: Optional[str] = None,
        metadata: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Create a Stripe Checkout session.
        Returns session object with URL.
        """
        try:
            session = stripe.checkout.Session.create(
                customer=customer_id,
                mode=mode,
                line_items=[{"price": price_id, "quantity": 1}],
                success_url=success_url or f"{settings.FRONTEND_URL}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=cancel_url or f"{settings.FRONTEND_URL}/pricing",
                metadata=metadata or {"user_id": user_id},
                allow_promotion_codes=True,
                billing_address_collection="auto",
                subscription_data={
                    "metadata": {"user_id": user_id}
                } if mode == "subscription" else None
            )
            logger.info("Checkout session created", session_id=session.id, user_id=user_id)
            return {
                "session_id": session.id,
                "url": session.url
            }
        except stripe.StripeError as e:
            logger.error("Failed to create checkout session", error=str(e))
            raise

    @staticmethod
    async def create_portal_session(
        customer_id: str,
        return_url: Optional[str] = None
    ) -> str:
        """
        Create a Stripe Customer Portal session.
        Returns portal URL.
        """
        try:
            session = stripe.billing_portal.Session.create(
                customer=customer_id,
                return_url=return_url or f"{settings.FRONTEND_URL}/dashboard/billing"
            )
            return session.url
        except stripe.StripeError as e:
            logger.error("Failed to create portal session", error=str(e))
            raise

    @staticmethod
    async def get_subscription(subscription_id: str) -> Dict[str, Any]:
        """Get subscription details from Stripe."""
        try:
            subscription = stripe.Subscription.retrieve(subscription_id)
            return {
                "id": subscription.id,
                "status": subscription.status,
                "current_period_start": subscription.current_period_start,
                "current_period_end": subscription.current_period_end,
                "cancel_at_period_end": subscription.cancel_at_period_end,
                "items": [
                    {
                        "price_id": item.price.id,
                        "product_id": item.price.product
                    }
                    for item in subscription["items"].data
                ]
            }
        except stripe.StripeError as e:
            logger.error("Failed to get subscription", error=str(e))
            raise

    @staticmethod
    async def cancel_subscription(subscription_id: str, at_period_end: bool = True):
        """Cancel subscription."""
        try:
            if at_period_end:
                subscription = stripe.Subscription.modify(
                    subscription_id,
                    cancel_at_period_end=True
                )
            else:
                subscription = stripe.Subscription.cancel(subscription_id)

            logger.info("Subscription canceled", subscription_id=subscription_id, at_period_end=at_period_end)
            return subscription
        except stripe.StripeError as e:
            logger.error("Failed to cancel subscription", error=str(e))
            raise

    @staticmethod
    def construct_webhook_event(payload: bytes, sig_header: str):
        """Verify and construct webhook event."""
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
            )
            return event
        except ValueError as e:
            logger.error("Invalid webhook payload", error=str(e))
            raise
        except stripe.SignatureVerificationError as e:
            logger.error("Invalid webhook signature", error=str(e))
            raise
```

### 4. Billing API Endpoints

**File**: `backend/app/api/v1/endpoints/billing.py` (NEW)

```python
from fastapi import APIRouter, Depends, HTTPException, Header, Request
from pydantic import BaseModel
from typing import Optional
from app.api.deps import get_current_user_id
from app.services.stripe_service import StripeService
from app.core.logging import logger
from app.db import prisma

router = APIRouter(prefix="/billing", tags=["billing"])

class CheckoutRequest(BaseModel):
    price_id: str
    mode: str = "subscription"  # or "payment"
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None

class PurchaseRequest(BaseModel):
    product: str  # "extra_queries_50", "specialist_tax_optimizer", etc
    quantity: int = 1

@router.post("/checkout")
async def create_checkout(
    request: CheckoutRequest,
    user_id: str = Depends(get_current_user_id)
):
    """Create Stripe Checkout session for subscription or one-time purchase."""

    # Get or create Stripe customer
    user = await prisma.user.find_unique(where={"id": user_id})

    if not user.stripeCustomerId:
        customer_id = await StripeService.create_customer(
            email=user.email,
            user_id=user_id,
            name=user.name
        )
        await prisma.user.update(
            where={"id": user_id},
            data={"stripeCustomerId": customer_id}
        )
    else:
        customer_id = user.stripeCustomerId

    # Create checkout session
    session = await StripeService.create_checkout_session(
        customer_id=customer_id,
        price_id=request.price_id,
        user_id=user_id,
        mode=request.mode,
        success_url=request.success_url,
        cancel_url=request.cancel_url
    )

    return session

@router.post("/portal")
async def create_portal(user_id: str = Depends(get_current_user_id)):
    """Create Stripe Customer Portal session."""

    user = await prisma.user.find_unique(where={"id": user_id})

    if not user.stripeCustomerId:
        raise HTTPException(status_code=400, detail="No Stripe customer found")

    portal_url = await StripeService.create_portal_session(
        customer_id=user.stripeCustomerId
    )

    return {"url": portal_url}

@router.get("/subscription")
async def get_subscription(user_id: str = Depends(get_current_user_id)):
    """Get current subscription details."""

    user = await prisma.user.find_unique(where={"id": user_id})

    return {
        "tier": user.subscriptionTier,
        "status": user.subscriptionStatus,
        "currentPeriodEnd": user.currentPeriodEnd,
        "cancelAtPeriodEnd": user.cancelAtPeriodEnd,
        "premiumSpecialists": user.premiumSpecialists,
        "queryBalance": user.queryBalance,
        "queriesUsedToday": user.queriesUsedToday,
        "queriesUsedMonth": user.queriesUsedMonth
    }

@router.post("/webhooks", include_in_schema=False)
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="stripe-signature")
):
    """
    Handle Stripe webhooks.

    Events handled:
    - customer.subscription.created
    - customer.subscription.updated
    - customer.subscription.deleted
    - invoice.payment_succeeded
    - invoice.payment_failed
    """

    payload = await request.body()

    try:
        event = StripeService.construct_webhook_event(payload, stripe_signature)
    except Exception as e:
        logger.error("Webhook signature verification failed", error=str(e))
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Log event
    await prisma.stripeEvent.create(
        data={
            "stripeEventId": event.id,
            "type": event.type,
            "data": event.data.object
        }
    )

    # Handle event
    try:
        if event.type == "customer.subscription.created":
            await handle_subscription_created(event.data.object)
        elif event.type == "customer.subscription.updated":
            await handle_subscription_updated(event.data.object)
        elif event.type == "customer.subscription.deleted":
            await handle_subscription_deleted(event.data.object)
        elif event.type == "invoice.payment_succeeded":
            await handle_payment_succeeded(event.data.object)
        elif event.type == "invoice.payment_failed":
            await handle_payment_failed(event.data.object)

        # Mark as processed
        await prisma.stripeEvent.update(
            where={"stripeEventId": event.id},
            data={"processed": True, "processedAt": datetime.utcnow()}
        )

    except Exception as e:
        logger.error("Webhook processing error", event_type=event.type, error=str(e))
        await prisma.stripeEvent.update(
            where={"stripeEventId": event.id},
            data={"error": str(e)}
        )
        raise

    return {"status": "success"}

# === WEBHOOK HANDLERS ===

async def handle_subscription_created(subscription):
    """Handle new subscription."""
    user_id = subscription.metadata.get("user_id")

    if not user_id:
        logger.warning("Subscription missing user_id", subscription_id=subscription.id)
        return

    # Determine tier from price ID
    price_id = subscription.items.data[0].price.id
    tier = get_tier_from_price_id(price_id)

    await prisma.user.update(
        where={"id": user_id},
        data={
            "stripeSubscriptionId": subscription.id,
            "subscriptionTier": tier,
            "subscriptionStatus": subscription.status,
            "currentPeriodStart": datetime.fromtimestamp(subscription.current_period_start),
            "currentPeriodEnd": datetime.fromtimestamp(subscription.current_period_end),
            "queryBalance": get_query_limit(tier)  # Set initial balance
        }
    )

    logger.info("Subscription created", user_id=user_id, tier=tier)

async def handle_subscription_updated(subscription):
    """Handle subscription update."""
    user_id = subscription.metadata.get("user_id")

    if not user_id:
        logger.warning("Subscription missing user_id", subscription_id=subscription.id)
        return

    # Determine tier from price ID
    price_id = subscription.items.data[0].price.id
    tier = get_tier_from_price_id(price_id)

    await prisma.user.update(
        where={"id": user_id},
        data={
            "subscriptionTier": tier,
            "subscriptionStatus": subscription.status,
            "currentPeriodStart": datetime.fromtimestamp(subscription.current_period_start),
            "currentPeriodEnd": datetime.fromtimestamp(subscription.current_period_end),
            "cancelAtPeriodEnd": subscription.cancel_at_period_end
        }
    )

    logger.info("Subscription updated", user_id=user_id, tier=tier, status=subscription.status)

async def handle_subscription_deleted(subscription):
    """Handle subscription cancellation."""
    user_id = subscription.metadata.get("user_id")

    if not user_id:
        return

    await prisma.user.update(
        where={"id": user_id},
        data={
            "subscriptionTier": "freemium",
            "subscriptionStatus": "canceled",
            "queryBalance": 20  # Revert to freemium limits
        }
    )

    logger.info("Subscription deleted", user_id=user_id)

async def handle_payment_succeeded(invoice):
    """Handle successful payment (subscription renewal)."""
    subscription_id = invoice.subscription

    if subscription_id:
        # Refill query balance for the new billing period
        user = await prisma.user.find_first(
            where={"stripeSubscriptionId": subscription_id}
        )

        if user:
            await prisma.user.update(
                where={"id": user.id},
                data={
                    "queryBalance": get_query_limit(user.subscriptionTier),
                    "queriesUsedMonth": 0,  # Reset monthly counter
                    "lastQueryReset": datetime.utcnow()
                }
            )

    logger.info("Payment succeeded", invoice_id=invoice.id)

async def handle_payment_failed(invoice):
    """Handle failed payment."""
    subscription_id = invoice.subscription

    if subscription_id:
        user = await prisma.user.find_first(
            where={"stripeSubscriptionId": subscription_id}
        )

        if user:
            await prisma.user.update(
                where={"id": user.id},
                data={"subscriptionStatus": "past_due"}
            )

    logger.warning("Payment failed", invoice_id=invoice.id)

# === HELPER FUNCTIONS ===

def get_tier_from_price_id(price_id: str) -> str:
    """Map Stripe price ID to subscription tier."""
    price_map = {
        settings.STRIPE_PRICE_PRO_MONTHLY: "pro",
        settings.STRIPE_PRICE_PRO_ANNUAL: "pro",
        settings.STRIPE_PRICE_FAMILY_MONTHLY: "family_office",
        settings.STRIPE_PRICE_FAMILY_ANNUAL: "family_office",
    }
    return price_map.get(price_id, "freemium")

def get_query_limit(tier: str) -> int:
    """Get query limit for tier."""
    limits = {
        "freemium": 20,
        "pro": 200,
        "family_office": 999999  # "Unlimited"
    }
    return limits.get(tier, 20)
```

### 5. Update Router

**File**: `backend/app/api/v1/router.py`

```python
from app.api.v1.endpoints import billing  # Add this import

# Add to router includes
api_router.include_router(billing.router, prefix="/billing", tags=["billing"])
```

---

## 🎨 FRONTEND IMPLEMENTATION

### 1. Install Stripe Dependencies

**File**: `apps/web/package.json`

```bash
cd apps/web
npm install @stripe/stripe-js stripe
npm install -D @types/stripe
```

### 2. Environment Variables

**File**: `apps/web/.env.local`

```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...  # For API routes only
```

### 3. Pricing Page

**File**: `apps/web/src/app/pricing/page.tsx` (NEW)

```typescript
'use client';

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function PricingPage() {
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');
  const [loading, setLoading] = useState<string | null>(null);

  const handleCheckout = async (priceId: string, tier: string) => {
    setLoading(tier);

    try {
      const response = await fetch('/api/backend/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price_id: priceId,
          mode: 'subscription'
        })
      });

      const { url } = await response.json();

      // Redirect to Stripe Checkout
      window.location.href = url;

    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to start checkout');
    } finally {
      setLoading(null);
    }
  };

  const tiers = [
    {
      name: 'Freemium',
      price: { monthly: 0, annual: 0 },
      priceId: { monthly: null, annual: null },
      features: [
        '20 queries per day',
        'Gemini Flash AI',
        'Basic financial tools',
        'Goal tracking',
        'No multi-agent access'
      ],
      cta: 'Get Started Free',
      highlighted: false
    },
    {
      name: 'Pro',
      price: { monthly: 29, annual: 290 },
      priceId: {
        monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY,
        annual: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_ANNUAL
      },
      features: [
        '200 queries per day',
        'Llama 4 Maverick AI',
        'Multi-agent orchestration',
        'Add premium specialists',
        'Advanced analytics',
        'Priority support'
      ],
      cta: 'Start Pro Trial',
      highlighted: true,
      savings: billingInterval === 'annual' ? '$58' : null
    },
    {
      name: 'Family Office',
      price: { monthly: 99, annual: 990 },
      priceId: {
        monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_FAMILY_MONTHLY,
        annual: process.env.NEXT_PUBLIC_STRIPE_PRICE_FAMILY_ANNUAL
      },
      features: [
        'Unlimited queries',
        'Llama 4 Maverick AI',
        'All specialists included',
        'Multi-agent orchestration',
        'Custom workflows',
        'White-glove support'
      ],
      cta: 'Contact Sales',
      highlighted: false,
      savings: billingInterval === 'annual' ? '$198' : null
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Start free, upgrade when you need more power
          </p>

          {/* Billing interval toggle */}
          <div className="inline-flex items-center space-x-4 bg-white rounded-lg p-1 shadow">
            <button
              onClick={() => setBillingInterval('monthly')}
              className={`px-4 py-2 rounded-md ${
                billingInterval === 'monthly'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingInterval('annual')}
              className={`px-4 py-2 rounded-md ${
                billingInterval === 'annual'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700'
              }`}
            >
              Annual (Save 17%)
            </button>
          </div>
        </div>

        {/* Pricing cards */}
        <div className="grid md:grid-cols-3 gap-8">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative bg-white rounded-2xl shadow-lg p-8 ${
                tier.highlighted ? 'ring-2 ring-blue-600 scale-105' : ''
              }`}
            >
              {tier.highlighted && (
                <div className="absolute top-0 right-0 bg-blue-600 text-white px-3 py-1 text-sm rounded-bl-lg rounded-tr-2xl">
                  Most Popular
                </div>
              )}

              <h3 className="text-2xl font-bold text-gray-900 mb-2">{tier.name}</h3>

              <div className="mb-6">
                <span className="text-5xl font-bold text-gray-900">
                  ${tier.price[billingInterval]}
                </span>
                <span className="text-gray-600">
                  /{billingInterval === 'monthly' ? 'mo' : 'yr'}
                </span>
                {tier.savings && (
                  <div className="text-green-600 text-sm mt-1">
                    Save {tier.savings}/year
                  </div>
                )}
              </div>

              <ul className="space-y-3 mb-8">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start">
                    <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => {
                  if (tier.priceId[billingInterval]) {
                    handleCheckout(tier.priceId[billingInterval]!, tier.name);
                  }
                }}
                disabled={loading === tier.name || !tier.priceId[billingInterval]}
                className={`w-full py-3 rounded-lg font-semibold ${
                  tier.highlighted
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading === tier.name ? 'Loading...' : tier.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Specialist add-ons section */}
        <div className="mt-16">
          <h2 className="text-3xl font-bold text-center mb-8">Premium Specialists</h2>
          <p className="text-center text-gray-600 mb-8">
            Available for Pro tier members
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: 'Tax Optimizer', price: 2, description: 'Tax deduction discovery, withholding optimization' },
              { name: 'Portfolio Analyst', price: 3, description: 'Portfolio rebalancing, allocation analysis' },
              { name: 'Debt Strategist', price: 2, description: 'Multi-loan payoff optimization' },
              { name: 'Real Estate Analyzer', price: 12, description: 'Buy vs rent, property valuation' },
              { name: 'Healthcare Navigator', price: 15, description: 'Insurance plan optimization' },
              { name: 'Career Negotiation', price: 3, description: 'Salary negotiation, offer analysis' }
            ].map((specialist) => (
              <div key={specialist.name} className="bg-white rounded-lg shadow p-6">
                <h3 className="font-bold text-lg mb-2">{specialist.name}</h3>
                <p className="text-gray-600 text-sm mb-4">{specialist.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">${specialist.price}/mo</span>
                  <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
                    Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 4. Customer Portal Button

**File**: `apps/web/src/components/billing/ManageSubscriptionButton.tsx` (NEW)

```typescript
'use client';

import { useState } from 'react';

export function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false);

  const handleManageSubscription = async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/backend/billing/portal', {
        method: 'POST'
      });

      const { url } = await response.json();

      // Redirect to Stripe Customer Portal
      window.location.href = url;

    } catch (error) {
      console.error('Portal error:', error);
      alert('Failed to open customer portal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleManageSubscription}
      disabled={loading}
      className="bg-gray-100 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-200 disabled:opacity-50"
    >
      {loading ? 'Loading...' : 'Manage Subscription'}
    </button>
  );
}
```

### 5. Usage Dashboard

**File**: `apps/web/src/components/billing/UsageDashboard.tsx` (NEW)

```typescript
'use client';

import { useEffect, useState } from 'react';

export function UsageDashboard() {
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const response = await fetch('/api/backend/billing/subscription');
      const data = await response.json();
      setSubscription(data);
    } catch (error) {
      console.error('Failed to fetch subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-4">Your Subscription</h2>

      <div className="space-y-4">
        {/* Current plan */}
        <div>
          <div className="text-sm text-gray-600">Current Plan</div>
          <div className="text-lg font-semibold capitalize">{subscription.tier}</div>
        </div>

        {/* Query usage */}
        <div>
          <div className="text-sm text-gray-600">Query Usage</div>
          <div className="flex items-center space-x-2">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full"
                style={{
                  width: `${(subscription.queriesUsedToday / (subscription.queryBalance + subscription.queriesUsedToday)) * 100}%`
                }}
              />
            </div>
            <span className="text-sm">
              {subscription.queryBalance} remaining today
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {subscription.queriesUsedMonth} used this month
          </div>
        </div>

        {/* Premium specialists */}
        {subscription.premiumSpecialists.length > 0 && (
          <div>
            <div className="text-sm text-gray-600 mb-2">Active Specialists</div>
            <div className="flex flex-wrap gap-2">
              {subscription.premiumSpecialists.map((specialist: string) => (
                <span
                  key={specialist}
                  className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                >
                  {specialist.replace('_', ' ')}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Renewal date */}
        {subscription.currentPeriodEnd && (
          <div>
            <div className="text-sm text-gray-600">
              {subscription.cancelAtPeriodEnd ? 'Access until' : 'Renews on'}
            </div>
            <div className="text-lg">
              {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## 📋 STRIPE DASHBOARD SETUP

### 1. Create Products

In Stripe Dashboard → Products:

**Base Tiers**:
1. **Pro Monthly** - $29/month recurring
2. **Pro Annual** - $290/year recurring
3. **Family Office Monthly** - $99/month recurring
4. **Family Office Annual** - $990/year recurring

**Specialists** (all monthly recurring):
5. **Tax Optimizer** - $2/month
6. **Portfolio Analyst** - $3/month
7. **Debt Strategist** - $2/month
8. **Real Estate Analyzer** - $12/month
9. **Healthcare Navigator** - $15/month
10. **Career Negotiation** - $3/month

**One-Time Products**:
11. **Extra Queries (50)** - $5 one-time
12. **Extra Queries (100)** - $9 one-time
13. **Single Agent Session** - $3 one-time

### 2. Configure Customer Portal

Dashboard → Settings → Customer Portal:
- ✅ Enable subscriptions
- ✅ Allow customers to cancel
- ✅ Allow customers to switch plans
- ✅ Allow customers to update payment methods
- ✅ Show invoice history

### 3. Set Up Webhooks

Dashboard → Developers → Webhooks:

**Endpoint URL**: `https://yourdomain.com/api/backend/billing/webhooks`

**Events to send**:
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `checkout.session.completed`

Copy the **Signing secret** and add to `.env` as `STRIPE_WEBHOOK_SECRET`

---

## 🧪 TESTING STRATEGY

### 1. Test Cards

Use Stripe test cards in test mode:
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0025 0000 3155`

### 2. Test Webhooks Locally

```bash
# Install Stripe CLI
brew install stripe/stripe-brew/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:8000/api/backend/billing/webhooks

# Trigger test events
stripe trigger customer.subscription.created
stripe trigger invoice.payment_succeeded
```

### 3. Test Subscription Flow

1. **Sign up** → Freemium tier (free)
2. **Upgrade to Pro** → Click pricing → Checkout → Use test card
3. **Verify upgrade** → Check user tier in database
4. **Use queries** → Should route to Llama 4 Maverick
5. **Manage subscription** → Click "Manage" → Opens Stripe portal
6. **Cancel subscription** → Cancel at period end
7. **Verify cancellation** → Tier reverts to freemium at period end

---

## 📅 IMPLEMENTATION TIMELINE

### **Day 1: Backend Setup** (8h)
- [ ] Add Stripe dependency to backend
- [ ] Create `stripe_service.py`
- [ ] Create `billing.py` endpoints
- [ ] Update database schema (Prisma migration)
- [ ] Test webhook handlers locally

### **Day 2: Frontend Integration** (8h)
- [ ] Install Stripe dependencies in frontend
- [ ] Create pricing page
- [ ] Create customer portal button
- [ ] Create usage dashboard
- [ ] Test checkout flow end-to-end

### **Day 3: Stripe Dashboard Setup** (4h)
- [ ] Create all products in Stripe
- [ ] Configure prices
- [ ] Set up Customer Portal
- [ ] Configure webhooks
- [ ] Test with test cards

### **Day 4: Integration Testing** (8h)
- [ ] Test subscription creation
- [ ] Test subscription updates
- [ ] Test cancellation
- [ ] Test specialist add-ons
- [ ] Test one-time purchases
- [ ] Test query limits enforcement

---

## ✅ SUCCESS CRITERIA

- [ ] Users can sign up free (Freemium)
- [ ] Users can upgrade to Pro/Family Office
- [ ] Stripe webhooks update database correctly
- [ ] Query limits are enforced by ln-core
- [ ] Users can manage subscriptions in Stripe portal
- [ ] Specialist add-ons can be purchased
- [ ] One-time purchases (extra queries) work
- [ ] Billing is reflected in user's dashboard
- [ ] Subscription cancellations work correctly

---

## 🚀 LAUNCH CHECKLIST

- [ ] All test mode flows working
- [ ] Switch to live Stripe keys
- [ ] Update webhook endpoint to production URL
- [ ] Test live checkout flow
- [ ] Monitor first 10 subscriptions
- [ ] Set up billing alerts in Stripe
- [ ] Create internal admin dashboard for subscription monitoring

---

**Status**: ✅ **READY TO IMPLEMENT**
**Timeline**: 3-4 days with 1 developer
**Launch Target**: January 19-20, 2026

---

*Generated: January 12, 2026*
