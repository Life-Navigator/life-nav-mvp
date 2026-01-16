# 🚀 PHASED LAUNCH STRATEGY - MONETIZATION ROADMAP

**Date**: January 12, 2026
**Status**: READY TO IMPLEMENT
**Launch Date**: January 20, 2026 (8 days)

---

## 🎯 LAUNCH STRATEGY OVERVIEW

### Phase 1: FREEMIUM LAUNCH (Week 1 - Immediate)
**Goal**: Build user base, gather usage data, validate product-market fit

**Available**:
- ✅ Freemium tier (free forever)
- ✅ Extra query purchases (one-time)
- ✅ Scenario Lab purchases (one-time)

**Coming Soon**:
- ⏳ Pro tier (waitlist open)
- ⏳ Enterprise tier (waitlist open)

### Phase 2: PRO TIER LAUNCH (Week 4-6)
**Goal**: Convert power users, establish pricing, validate willingness to pay

**Launch**:
- ✅ Pro tier ($29/mo)
- ✅ Premium specialist add-ons
- ✅ Monthly subscriptions

### Phase 3: ENTERPRISE LAUNCH (Week 8-12)
**Goal**: Enable B2B revenue, white-label partnerships

**Launch**:
- ✅ Enterprise tier ($99-299/mo based on users)
- ✅ White-label branding
- ✅ Multi-user organizations
- ✅ SSO/SAML integration

---

## 📊 PHASE 1: FREEMIUM LAUNCH (LAUNCH DAY)

### Freemium Tier Limits

| Feature | Limit | Notes |
|---------|-------|-------|
| **Daily Queries** | 5 per day | Resets at midnight UTC |
| **Onboarding Queries** | Unlimited | Don't count toward daily limit |
| **Scenario Lab** | 5 per day | Separate limit from chat queries |
| **Goals** | 3 active goals | Financial goals only |
| **Bank Connections** | 2 accounts | Via Plaid |
| **Chat History** | 7 days | Older messages deleted |
| **AI Model** | Gemini Flash | Fast, cost-effective |
| **Multi-Agent** | ❌ Single agent only | No orchestration |

### What's Available (Free)

#### Financial Features ✅
- ✅ Basic budgeting & expense tracking
- ✅ 3 financial goals
- ✅ 2 bank account connections
- ✅ Net worth tracking (manual entry)
- ✅ Debt calculator (basic)
- ✅ Savings calculator

#### Health Features ✅
- ✅ Insurance document upload & storage
- ✅ Basic insurance info display

#### Other Features ✅
- ✅ Basic onboarding (unlimited queries during setup)
- ✅ Risk assessment
- ✅ Financial dashboard
- ✅ 5 chat queries per day
- ✅ 5 scenario lab runs per day

### What's Locked (Coming Soon) 🔒

#### Financial Features
- 🔒 Investment tracking & analysis
- 🔒 Retirement planning
- 🔒 Tax optimization
- 🔒 Estate planning
- 🔒 Portfolio analysis
- 🔒 Advanced debt strategies
- 🔒 Unlimited goals (>3)
- 🔒 Scenario Lab unlimited

#### Health Features
- 🔒 Insurance OCR parsing
- 🔒 Plan comparison tool
- 🔒 Healthcare cost estimator
- 🔒 HSA/FSA optimizer
- 🔒 Health goals & tracking
- 🔒 Medicare planning

#### Career Features (Entire Module)
- 🔒 Career goals
- 🔒 Resume builder
- 🔒 Job opportunities
- 🔒 Salary negotiation
- 🔒 Interview prep
- 🔒 Career path planning

#### Education Features (Limited)
- ✅ 1 education goal (free)
- 🔒 Course recommendations
- 🔒 Learning path builder
- 🔒 Certification planning
- 🔒 Education funding tools

#### AI Features
- 🔒 Llama 4 Maverick model
- 🔒 Multi-agent orchestration
- 🔒 Unlimited queries
- 🔒 Extended chat history (90 days)
- 🔒 Priority processing

---

## 💳 ONE-TIME PURCHASES (AVAILABLE AT LAUNCH)

### Extra Queries

| Product | Price | Description | Expiration |
|---------|-------|-------------|------------|
| **Query Pack - Small** | $2 | 10 additional queries | Never expires |
| **Query Pack - Medium** | $5 | 30 additional queries | Never expires |
| **Query Pack - Large** | $9 | 60 additional queries | Never expires |

### Scenario Lab Credits

| Product | Price | Description | Expiration |
|---------|-------|-------------|------------|
| **Scenario Pack - Small** | $3 | 10 scenario runs | Never expires |
| **Scenario Pack - Medium** | $7 | 30 scenario runs | Never expires |
| **Scenario Pack - Large** | $12 | 60 scenario runs | Never expires |

### Why This Works:
- ✅ Users can "try before they subscribe"
- ✅ Monetize power users immediately
- ✅ Gather pricing sensitivity data
- ✅ No commitment required
- ✅ Credits never expire (reduces purchase friction)

---

## 🔢 QUERY TRACKING SYSTEM

### Query Types & Counting

```typescript
enum QueryType {
  ONBOARDING = 'onboarding',      // Not counted
  CHAT = 'chat',                  // Counts toward daily 5
  SCENARIO_LAB = 'scenario_lab',  // Separate 5/day limit
  SPECIALIST = 'specialist',      // Counts toward daily 5
}

interface UserQueryBalance {
  // Daily limits (reset at midnight UTC)
  dailyChatQueries: number;        // 5 free per day
  dailyScenarioRuns: number;       // 5 free per day

  // Purchased credits (never expire)
  purchasedChatQueries: number;    // From query packs
  purchasedScenarioRuns: number;   // From scenario packs

  // Usage tracking
  lastResetDate: Date;             // Last midnight UTC reset
  queriesUsedToday: number;        // Resets daily
  scenariosUsedToday: number;      // Resets daily
}
```

### Query Consumption Logic

```typescript
async function consumeQuery(userId: string, queryType: QueryType): Promise<boolean> {
  const balance = await getUserQueryBalance(userId);

  // ONBOARDING: Never consume queries
  if (queryType === QueryType.ONBOARDING) {
    return true; // Always allow
  }

  // SCENARIO LAB: Check scenario limit
  if (queryType === QueryType.SCENARIO_LAB) {
    // 1. Check daily free scenarios
    if (balance.scenariosUsedToday < 5) {
      await incrementScenarioUsage(userId);
      return true;
    }

    // 2. Check purchased scenario credits
    if (balance.purchasedScenarioRuns > 0) {
      await decrementPurchasedScenarios(userId);
      return true;
    }

    // 3. Out of scenarios
    return false; // Show upgrade prompt
  }

  // CHAT/SPECIALIST: Check chat limit
  if (queryType === QueryType.CHAT || queryType === QueryType.SPECIALIST) {
    // 1. Check daily free queries
    if (balance.queriesUsedToday < 5) {
      await incrementQueryUsage(userId);
      return true;
    }

    // 2. Check purchased query credits
    if (balance.purchasedChatQueries > 0) {
      await decrementPurchasedQueries(userId);
      return true;
    }

    // 3. Out of queries
    return false; // Show purchase prompt
  }

  return false;
}
```

---

## 📊 DATABASE SCHEMA

### Updated User Model

**File**: `apps/web/prisma/schema.prisma`

```prisma
model User {
  id                    String   @id @default(cuid())
  email                 String   @unique
  name                  String?

  // === SUBSCRIPTION TIER ===
  subscriptionTier      String   @default("freemium") @map("subscription_tier")
  // freemium, pro, enterprise

  subscriptionStatus    String?  @map("subscription_status")
  // active, past_due, canceled (for future Pro/Enterprise)

  // === DAILY QUERY LIMITS ===
  dailyChatQueries      Int      @default(5) @map("daily_chat_queries")
  dailyScenarioRuns     Int      @default(5) @map("daily_scenario_runs")

  // === PURCHASED CREDITS (never expire) ===
  purchasedChatQueries  Int      @default(0) @map("purchased_chat_queries")
  purchasedScenarioRuns Int      @default(0) @map("purchased_scenario_runs")

  // === USAGE TRACKING ===
  lastQueryReset        DateTime @default(now()) @map("last_query_reset")
  queriesUsedToday      Int      @default(0) @map("queries_used_today")
  scenariosUsedToday    Int      @default(0) @map("scenarios_used_today")

  // === ONBOARDING ===
  onboardingCompleted   Boolean  @default(false) @map("onboarding_completed")
  onboardingQueriesUsed Int      @default(0) @map("onboarding_queries_used")

  // === WAITLIST (for Pro/Enterprise) ===
  proWaitlist           Boolean  @default(false) @map("pro_waitlist")
  enterpriseWaitlist    Boolean  @default(false) @map("enterprise_waitlist")
  waitlistJoinedAt      DateTime? @map("waitlist_joined_at")

  // === STRIPE (for future use) ===
  stripeCustomerId      String?  @unique @map("stripe_customer_id")

  createdAt             DateTime @default(now()) @map("created_at")
  updatedAt             DateTime @updatedAt @map("updated_at")

  // Relations
  profile               UserProfile?
  goals                 Goal[]
  queryLogs             QueryLog[]
  purchases             Purchase[]

  @@map("users")
}

model QueryLog {
  id          String   @id @default(cuid())
  userId      String   @map("user_id")
  queryType   String   @map("query_type")  // onboarding, chat, scenario_lab
  query       String?  // Optional: store query text
  source      String   @map("source")  // daily_free, purchased_credit, onboarding
  timestamp   DateTime @default(now())

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, timestamp])
  @@map("query_logs")
}

model Purchase {
  id                String   @id @default(cuid())
  userId            String   @map("user_id")
  productType       String   @map("product_type")  // query_pack, scenario_pack
  productId         String   @map("product_id")     // small, medium, large
  quantity          Int      // Number of credits purchased
  amountPaid        Int      @map("amount_paid")    // In cents
  stripePriceId     String?  @map("stripe_price_id")
  stripePaymentId   String?  @unique @map("stripe_payment_id")
  status            String   @default("completed")  // completed, refunded
  purchasedAt       DateTime @default(now()) @map("purchased_at")

  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, purchasedAt])
  @@map("purchases")
}
```

---

## 🎨 FRONTEND IMPLEMENTATION

### 1. Query Balance Display

**File**: `apps/web/src/components/usage/QueryBalanceWidget.tsx` (NEW)

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Zap, Activity } from 'lucide-react';
import Link from 'next/link';

export function QueryBalanceWidget() {
  const [balance, setBalance] = useState<any>(null);

  useEffect(() => {
    fetchBalance();
  }, []);

  const fetchBalance = async () => {
    const response = await fetch('/api/backend/usage/balance');
    const data = await response.json();
    setBalance(data);
  };

  if (!balance) return null;

  const chatRemaining = Math.max(0, 5 - balance.queriesUsedToday) + balance.purchasedChatQueries;
  const scenariosRemaining = Math.max(0, 5 - balance.scenariosUsedToday) + balance.purchasedScenarioRuns;

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="font-semibold text-gray-900 mb-3">Daily Usage</h3>

      {/* Chat Queries */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium">Chat Queries</span>
          </div>
          <span className="text-lg font-bold text-blue-600">
            {chatRemaining}
          </span>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${(chatRemaining / (5 + balance.purchasedChatQueries)) * 100}%` }}
          />
        </div>

        <div className="text-xs text-gray-600 mt-1">
          {balance.queriesUsedToday}/5 daily free used
          {balance.purchasedChatQueries > 0 && (
            <span> • {balance.purchasedChatQueries} purchased remaining</span>
          )}
        </div>
      </div>

      {/* Scenario Lab */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-medium">Scenario Lab</span>
          </div>
          <span className="text-lg font-bold text-purple-600">
            {scenariosRemaining}
          </span>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-purple-600 h-2 rounded-full transition-all"
            style={{ width: `${(scenariosRemaining / (5 + balance.purchasedScenarioRuns)) * 100}%` }}
          />
        </div>

        <div className="text-xs text-gray-600 mt-1">
          {balance.scenariosUsedToday}/5 daily free used
          {balance.purchasedScenarioRuns > 0 && (
            <span> • {balance.purchasedScenarioRuns} purchased remaining</span>
          )}
        </div>
      </div>

      {/* Buy more button */}
      {(chatRemaining < 3 || scenariosRemaining < 3) && (
        <Link
          href="/buy-queries"
          className="block w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white text-center py-2 rounded-lg font-semibold hover:opacity-90"
        >
          Buy More Credits
        </Link>
      )}

      {/* Resets info */}
      <div className="text-xs text-gray-500 mt-2 text-center">
        Daily queries reset at midnight UTC
      </div>
    </div>
  );
}
```

### 2. Out of Queries Modal

**File**: `apps/web/src/components/usage/OutOfQueriesModal.tsx` (NEW)

```typescript
'use client';

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { X, Zap } from 'lucide-react';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface OutOfQueriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  queryType: 'chat' | 'scenario';
}

export function OutOfQueriesModal({ isOpen, onClose, queryType }: OutOfQueriesModalProps) {
  const [loading, setLoading] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePurchase = async (packSize: 'small' | 'medium' | 'large') => {
    setLoading(packSize);

    try {
      const priceIds = {
        chat: {
          small: process.env.NEXT_PUBLIC_STRIPE_PRICE_QUERY_SMALL,
          medium: process.env.NEXT_PUBLIC_STRIPE_PRICE_QUERY_MEDIUM,
          large: process.env.NEXT_PUBLIC_STRIPE_PRICE_QUERY_LARGE,
        },
        scenario: {
          small: process.env.NEXT_PUBLIC_STRIPE_PRICE_SCENARIO_SMALL,
          medium: process.env.NEXT_PUBLIC_STRIPE_PRICE_SCENARIO_MEDIUM,
          large: process.env.NEXT_PUBLIC_STRIPE_PRICE_SCENARIO_LARGE,
        }
      };

      const response = await fetch('/api/backend/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price_id: priceIds[queryType][packSize],
          mode: 'payment' // One-time payment
        })
      });

      const { url } = await response.json();
      window.location.href = url;

    } catch (error) {
      console.error('Purchase error:', error);
      alert('Failed to start purchase');
    } finally {
      setLoading(null);
    }
  };

  const packs = queryType === 'chat' ? [
    { size: 'small', queries: 10, price: 2, perQuery: 0.20 },
    { size: 'medium', queries: 30, price: 5, perQuery: 0.17 },
    { size: 'large', queries: 60, price: 9, perQuery: 0.15 },
  ] : [
    { size: 'small', queries: 10, price: 3, perQuery: 0.30 },
    { size: 'medium', queries: 30, price: 7, perQuery: 0.23 },
    { size: 'large', queries: 60, price: 12, perQuery: 0.20 },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full mx-4 p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full mb-4">
            <Zap className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            You've Used Your Daily {queryType === 'chat' ? 'Queries' : 'Scenarios'}
          </h2>
          <p className="text-gray-600">
            Purchase a credit pack to continue, or come back tomorrow for 5 more free {queryType === 'chat' ? 'queries' : 'scenarios'}!
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {packs.map((pack) => (
            <div
              key={pack.size}
              className={`border-2 rounded-xl p-6 text-center hover:border-blue-600 transition ${
                pack.size === 'medium' ? 'border-blue-600 bg-blue-50' : 'border-gray-200'
              }`}
            >
              {pack.size === 'medium' && (
                <div className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full inline-block mb-2">
                  BEST VALUE
                </div>
              )}
              <div className="text-4xl font-bold text-gray-900 mb-2">
                {pack.queries}
              </div>
              <div className="text-sm text-gray-600 mb-4">
                {queryType === 'chat' ? 'queries' : 'scenarios'}
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                ${pack.price}
              </div>
              <div className="text-xs text-gray-500 mb-4">
                ${pack.perQuery.toFixed(2)} per {queryType === 'chat' ? 'query' : 'scenario'}
              </div>
              <button
                onClick={() => handlePurchase(pack.size as any)}
                disabled={loading !== null}
                className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {loading === pack.size ? 'Loading...' : 'Buy Now'}
              </button>
            </div>
          ))}
        </div>

        <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
          <strong>Note:</strong> Credits never expire. Use them anytime!
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 mb-2">
            Want unlimited access?
          </p>
          <button
            onClick={() => window.location.href = '/pricing'}
            className="text-blue-600 font-semibold hover:underline"
          >
            Join the Pro waitlist →
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 3. Pricing Page with Coming Soon

**File**: `apps/web/src/app/pricing/page.tsx` (UPDATE)

```typescript
'use client';

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-gray-600">
            Start free. Upgrade when you're ready.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {/* Freemium - Available Now */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full inline-block mb-4">
              AVAILABLE NOW
            </div>
            <h3 className="text-2xl font-bold mb-2">Freemium</h3>
            <div className="text-5xl font-bold mb-4">$0</div>
            <p className="text-gray-600 mb-6">Perfect for getting started</p>

            <ul className="space-y-3 mb-8">
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>5 chat queries per day</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>5 scenario runs per day</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Unlimited onboarding queries</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Basic financial planning</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>3 active goals</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Purchase extra credits anytime</span>
              </li>
            </ul>

            <a
              href="/signup"
              className="block w-full bg-gray-900 text-white py-3 rounded-lg text-center font-semibold hover:bg-gray-800"
            >
              Get Started Free
            </a>
          </div>

          {/* Pro - Coming Soon */}
          <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-xl p-8 text-white transform scale-105">
            <div className="bg-yellow-400 text-gray-900 text-xs font-bold px-3 py-1 rounded-full inline-block mb-4">
              COMING SOON
            </div>
            <h3 className="text-2xl font-bold mb-2">Pro</h3>
            <div className="text-5xl font-bold mb-4">$29<span className="text-xl">/mo</span></div>
            <p className="text-blue-100 mb-6">For serious users & professionals</p>

            <ul className="space-y-3 mb-8 text-white">
              <li className="flex items-start">
                <svg className="w-5 h-5 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>200 queries per month</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Unlimited scenario runs</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Llama 4 Maverick AI</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Full career planning tools</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Advanced health planning</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Add premium specialists</span>
              </li>
            </ul>

            <button
              onClick={() => window.location.href = '/waitlist?tier=pro'}
              className="block w-full bg-white text-blue-600 py-3 rounded-lg text-center font-semibold hover:bg-gray-100"
            >
              Join Waitlist
            </button>
          </div>

          {/* Enterprise - Coming Soon */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="bg-yellow-400 text-gray-900 text-xs font-bold px-3 py-1 rounded-full inline-block mb-4">
              COMING SOON
            </div>
            <h3 className="text-2xl font-bold mb-2">Enterprise</h3>
            <div className="text-5xl font-bold mb-4">$99<span className="text-xl">/mo</span></div>
            <p className="text-gray-600 mb-6">For teams & white-label</p>

            <ul className="space-y-3 mb-8">
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Everything in Pro</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Unlimited queries</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>White-label branding</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Multi-user teams</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>All specialists included</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Priority support</span>
              </li>
            </ul>

            <button
              onClick={() => window.location.href = '/waitlist?tier=enterprise'}
              className="block w-full bg-gray-900 text-white py-3 rounded-lg text-center font-semibold hover:bg-gray-800"
            >
              Join Waitlist
            </button>
          </div>
        </div>

        {/* One-time purchases section */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-3xl font-bold text-center mb-4">Need More Credits?</h2>
          <p className="text-center text-gray-600 mb-8">
            Purchase credit packs anytime. Credits never expire!
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Query packs */}
            <div>
              <h3 className="text-xl font-bold mb-4">Chat Query Packs</h3>
              <div className="space-y-3">
                <div className="border-2 border-gray-200 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <div className="font-bold">10 Queries</div>
                    <div className="text-sm text-gray-600">$0.20 per query</div>
                  </div>
                  <div className="text-2xl font-bold">$2</div>
                </div>
                <div className="border-2 border-blue-600 bg-blue-50 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <div className="font-bold">30 Queries</div>
                    <div className="text-sm text-gray-600">$0.17 per query • Best value</div>
                  </div>
                  <div className="text-2xl font-bold">$5</div>
                </div>
                <div className="border-2 border-gray-200 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <div className="font-bold">60 Queries</div>
                    <div className="text-sm text-gray-600">$0.15 per query</div>
                  </div>
                  <div className="text-2xl font-bold">$9</div>
                </div>
              </div>
            </div>

            {/* Scenario packs */}
            <div>
              <h3 className="text-xl font-bold mb-4">Scenario Lab Packs</h3>
              <div className="space-y-3">
                <div className="border-2 border-gray-200 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <div className="font-bold">10 Scenarios</div>
                    <div className="text-sm text-gray-600">$0.30 per scenario</div>
                  </div>
                  <div className="text-2xl font-bold">$3</div>
                </div>
                <div className="border-2 border-purple-600 bg-purple-50 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <div className="font-bold">30 Scenarios</div>
                    <div className="text-sm text-gray-600">$0.23 per scenario • Best value</div>
                  </div>
                  <div className="text-2xl font-bold">$7</div>
                </div>
                <div className="border-2 border-gray-200 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <div className="font-bold">60 Scenarios</div>
                    <div className="text-sm text-gray-600">$0.20 per scenario</div>
                  </div>
                  <div className="text-2xl font-bold">$12</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## 🔧 BACKEND IMPLEMENTATION

### Query Balance API

**File**: `backend/app/api/v1/endpoints/usage.py` (NEW)

```python
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
from app.api.deps import get_current_user
from app.db import prisma

router = APIRouter(prefix="/usage", tags=["usage"])

@router.get("/balance")
async def get_query_balance(user = Depends(get_current_user)):
    """Get user's current query balance."""

    # Check if we need to reset daily limits
    now = datetime.now(timezone.utc)
    last_reset = user.lastQueryReset.replace(tzinfo=timezone.utc)

    # Reset if last reset was on a different day (UTC)
    if now.date() > last_reset.date():
        await prisma.user.update(
            where={"id": user.id},
            data={
                "lastQueryReset": now,
                "queriesUsedToday": 0,
                "scenariosUsedToday": 0
            }
        )
        user.queriesUsedToday = 0
        user.scenariosUsedToday = 0

    return {
        "tier": user.subscriptionTier,
        "dailyChatQueries": user.dailyChatQueries,
        "dailyScenarioRuns": user.dailyScenarioRuns,
        "queriesUsedToday": user.queriesUsedToday,
        "scenariosUsedToday": user.scenariosUsedToday,
        "purchasedChatQueries": user.purchasedChatQueries,
        "purchasedScenarioRuns": user.purchasedScenarioRuns,
        "lastResetDate": user.lastQueryReset,
        "nextResetDate": get_next_midnight_utc()
    }

@router.post("/consume")
async def consume_query(
    query_type: str,  # "chat", "scenario", "onboarding"
    user = Depends(get_current_user)
):
    """
    Consume a query. Returns whether consumption was successful.

    If user is out of queries, returns upgrade/purchase prompt info.
    """

    # Onboarding queries are always free
    if query_type == "onboarding":
        await log_query(user.id, "onboarding", "onboarding_free")
        return {"allowed": True, "source": "onboarding_free"}

    # Reset daily limits if needed
    await reset_daily_limits_if_needed(user.id)

    # Scenario lab
    if query_type == "scenario":
        if user.scenariosUsedToday < user.dailyScenarioRuns:
            # Use daily free scenario
            await prisma.user.update(
                where={"id": user.id},
                data={"scenariosUsedToday": user.scenariosUsedToday + 1}
            )
            await log_query(user.id, "scenario", "daily_free")
            return {"allowed": True, "source": "daily_free"}

        elif user.purchasedScenarioRuns > 0:
            # Use purchased credit
            await prisma.user.update(
                where={"id": user.id},
                data={"purchasedScenarioRuns": user.purchasedScenarioRuns - 1}
            )
            await log_query(user.id, "scenario", "purchased_credit")
            return {"allowed": True, "source": "purchased_credit"}

        else:
            # Out of scenarios
            return {
                "allowed": False,
                "reason": "out_of_scenarios",
                "message": "You've used your 5 daily scenarios",
                "action": "purchase",
                "products": get_scenario_packs()
            }

    # Chat queries
    if query_type == "chat":
        if user.queriesUsedToday < user.dailyChatQueries:
            # Use daily free query
            await prisma.user.update(
                where={"id": user.id},
                data={"queriesUsedToday": user.queriesUsedToday + 1}
            )
            await log_query(user.id, "chat", "daily_free")
            return {"allowed": True, "source": "daily_free"}

        elif user.purchasedChatQueries > 0:
            # Use purchased credit
            await prisma.user.update(
                where={"id": user.id},
                data={"purchasedChatQueries": user.purchasedChatQueries - 1}
            )
            await log_query(user.id, "chat", "purchased_credit")
            return {"allowed": True, "source": "purchased_credit"}

        else:
            # Out of queries
            return {
                "allowed": False,
                "reason": "out_of_queries",
                "message": "You've used your 5 daily chat queries",
                "action": "purchase",
                "products": get_query_packs()
            }

    raise HTTPException(status_code=400, detail="Invalid query type")

def get_query_packs():
    """Return available query pack products."""
    return [
        {"id": "query_small", "queries": 10, "price": 2.00, "priceId": "price_..."},
        {"id": "query_medium", "queries": 30, "price": 5.00, "priceId": "price_..."},
        {"id": "query_large", "queries": 60, "price": 9.00, "priceId": "price_..."},
    ]

def get_scenario_packs():
    """Return available scenario pack products."""
    return [
        {"id": "scenario_small", "scenarios": 10, "price": 3.00, "priceId": "price_..."},
        {"id": "scenario_medium", "scenarios": 30, "price": 7.00, "priceId": "price_..."},
        {"id": "scenario_large", "scenarios": 60, "price": 12.00, "priceId": "price_..."},
    ]
```

---

## 📅 LAUNCH TIMELINE

### Pre-Launch (Days 1-5)
- [x] Define freemium limits
- [x] Design query tracking system
- [ ] Update database schema
- [ ] Implement query balance API
- [ ] Create UI components (balance widget, out of queries modal)
- [ ] Set up Stripe products for one-time purchases
- [ ] Test query consumption logic end-to-end

### Launch Day (Day 8)
- [ ] Deploy freemium tier
- [ ] Enable one-time purchases
- [ ] Open Pro/Enterprise waitlists
- [ ] Monitor usage patterns
- [ ] Track purchase conversion

### Post-Launch (Days 9-30)
- [ ] Gather usage data
- [ ] Refine query limits based on data
- [ ] A/B test pricing for packs
- [ ] Prepare Pro tier launch
- [ ] Build waitlist email drip campaign

---

## ✅ SUCCESS METRICS

### Week 1 Goals:
- 100 sign-ups
- 10% purchase rate (10 users buy credits)
- Average queries per user: 3-4 per day
- 20+ Pro waitlist sign-ups

### Month 1 Goals:
- 500 users
- $500 in one-time purchase revenue
- 50+ Pro waitlist
- Ready to launch Pro tier

---

**Status**: ✅ **READY TO IMPLEMENT**
**Launch Target**: January 20, 2026 (8 days)

---

*Generated: January 12, 2026*
