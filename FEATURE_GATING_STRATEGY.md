# 🔐 FEATURE GATING & TIER DIFFERENTIATION STRATEGY

**Date**: January 12, 2026
**Status**: READY TO IMPLEMENT
**Timeline**: 2-3 days

---

## 🎯 REVISED TIER STRUCTURE

### Tier Names & Positioning

| Tier | Old Name | New Name | Target Customer | Monthly Price |
|------|----------|----------|-----------------|---------------|
| **Tier 1** | Freemium | **Freemium** | Trial users, basic financial planning | $0 |
| **Tier 2** | Pro | **Pro** | Serious users, career & health planning | $29 |
| **Tier 3** | Family Office | **Enterprise** | Power users, white-label, unlimited | $99 |

### Why "Enterprise" Instead of "Family Office"?

✅ **Better positioning**:
- "Family Office" sounds niche (only for wealthy families)
- "Enterprise" communicates premium features + business-ready
- Enables B2B sales (financial advisors, HR departments)
- Sets up white-label narrative

✅ **White-label ready**:
- Financial advisors can rebrand as their own tool
- HR departments can offer as employee benefit
- Wealth management firms can integrate into their platform

---

## 📊 COMPLETE FEATURE MATRIX

### Financial Features

| Feature | Freemium | Pro | Enterprise | Notes |
|---------|----------|-----|------------|-------|
| **Basic Budgeting** | ✅ Full | ✅ Full | ✅ Full | Core feature for all |
| **Goal Tracking** | ✅ 3 goals | ✅ 10 goals | ✅ Unlimited | Limited goals for freemium |
| **Bank Connection (Plaid)** | ✅ 2 accounts | ✅ 10 accounts | ✅ Unlimited | Connection limits |
| **Expense Tracking** | ✅ Manual only | ✅ Automatic categorization | ✅ AI categorization + rules | Automation tier-gated |
| **Investment Tracking** | ❌ View only | ✅ Full tracking | ✅ Full + portfolio analysis | View-only for freemium |
| **Tax Optimizer** | ❌ Locked | ✅ Add-on ($2/mo) | ✅ Included | Specialist |
| **Debt Payoff Planner** | ✅ Basic calculator | ✅ Multi-loan optimizer | ✅ Full + Debt Strategist | Basic vs advanced |
| **Retirement Planning** | ❌ Locked | ✅ Basic projections | ✅ Full Monte Carlo simulation | Complex planning locked |
| **Estate Planning** | ❌ Locked | ❌ Locked | ✅ Full + document templates | Enterprise only |
| **Scenario Lab** | ❌ Locked | ✅ 3 scenarios | ✅ Unlimited scenarios | Trial feature gated |

### Health Features

| Feature | Freemium | Pro | Enterprise | Notes |
|---------|----------|-----|------------|-------|
| **Insurance Upload** | ✅ Upload & store | ✅ Upload & store | ✅ Upload & store | Core document storage |
| **Insurance Parser (OCR)** | ❌ Locked | ✅ Automatic extraction | ✅ Automatic extraction | AI parsing gated |
| **Plan Comparison** | ❌ Locked | ✅ Compare up to 3 plans | ✅ Unlimited comparisons | Analysis gated |
| **Healthcare Cost Estimator** | ❌ Locked | ✅ Basic estimates | ✅ Full + cost optimization | Calculator gated |
| **HSA/FSA Optimizer** | ❌ Locked | ✅ Full optimization | ✅ Full + tax integration | Tax strategy gated |
| **Medicare Planning** | ❌ Locked | ❌ Locked | ✅ Full planning | Complex planning enterprise-only |
| **Health Goals** | ❌ Locked | ✅ Up to 3 goals | ✅ Unlimited | Health module gated |
| **Wellness Tracking** | ❌ Locked | ✅ Basic tracking | ✅ Full + AI insights | Wellness module gated |
| **Healthcare Navigator** | ❌ Locked | ✅ Add-on ($15/mo) | ✅ Included | Premium specialist |

### Career Features

| Feature | Freemium | Pro | Enterprise | Notes |
|---------|----------|-----|------------|-------|
| **Career Goals** | ❌ Locked | ✅ Full goal setting | ✅ Full goal setting | Module locked |
| **Resume Builder** | ❌ Locked | ✅ AI-powered builder | ✅ AI-powered builder | Tool completely gated |
| **Resume Analysis** | ❌ Locked | ✅ ATS optimization | ✅ ATS optimization + custom | AI analysis gated |
| **Job Opportunities** | ❌ Locked | ✅ Personalized matches | ✅ Personalized matches | Integration gated |
| **Salary Negotiation** | ❌ Locked | ✅ Basic guidance | ✅ Full negotiation agent | Guidance vs full agent |
| **Career Path Planning** | ❌ Locked | ✅ 5-year roadmap | ✅ Full career trajectory | Planning gated |
| **Skills Gap Analysis** | ❌ Locked | ✅ Basic analysis | ✅ Full + learning recs | Analysis gated |
| **Interview Prep** | ❌ Locked | ✅ Common questions | ✅ Full + mock interviews | Prep tools gated |
| **Career Negotiation Agent** | ❌ Locked | ✅ Add-on ($3/mo) | ✅ Included | Premium specialist |
| **LinkedIn Optimization** | ❌ Locked | ✅ Profile review | ✅ Full + outreach templates | Tool gated |

### Education Features

| Feature | Freemium | Pro | Enterprise | Notes |
|---------|----------|-----|------------|-------|
| **Education Goals** | ✅ 1 goal | ✅ 5 goals | ✅ Unlimited | Limited for freemium |
| **College Savings (529)** | ✅ Basic calculator | ✅ Full planning | ✅ Full + tax optimization | Basic vs advanced |
| **Student Loan Payoff** | ✅ Basic calculator | ✅ Optimization strategies | ✅ Full + forgiveness analysis | Limited analysis |
| **Course Recommendations** | ❌ Locked | ✅ Personalized courses | ✅ Personalized courses | AI recs gated |
| **Learning Path Builder** | ❌ Locked | ✅ Basic paths | ✅ Full + skill mapping | Planning gated |
| **Certification Planning** | ❌ Locked | ✅ ROI analysis | ✅ Full + funding strategies | Analysis gated |
| **Education Funding** | ❌ Locked | ✅ Scholarship finder | ✅ Full + grant applications | Research gated |
| **Degree ROI Calculator** | ❌ Locked | ✅ Basic ROI | ✅ Full + career impact | Calculator gated |

### AI & Agent Features

| Feature | Freemium | Pro | Enterprise | Notes |
|---------|----------|-----|------------|-------|
| **AI Model** | Gemini Flash | Llama 4 Maverick | Llama 4 Maverick | Quality tier |
| **Daily Query Limit** | 20 queries | 200 queries | Unlimited | Hard limits enforced |
| **Multi-Agent Orchestration** | ❌ Single agent only | ✅ Full orchestration | ✅ Full orchestration | Architecture gated |
| **Chat History** | 7 days | 90 days | Unlimited | Storage limits |
| **Context Window** | 4k tokens | 32k tokens | 128k tokens | Technical limits |
| **Response Quality** | Standard | High | Highest (custom tuned) | Model quality |
| **Priority Processing** | ❌ Standard queue | ✅ Priority queue | ✅ Dedicated resources | Infrastructure priority |
| **Custom Workflows** | ❌ Locked | ❌ Locked | ✅ Build custom agents | Enterprise feature |
| **API Access** | ❌ Locked | ❌ Locked | ✅ Full REST API | Integration gated |

### Onboarding & Discovery

| Feature | Freemium | Pro | Enterprise | Notes |
|---------|----------|-----|------------|-------|
| **Basic Onboarding** | ✅ Full | ✅ Full | ✅ Full | Everyone gets onboarding |
| **Risk Assessment** | ✅ Basic (10 questions) | ✅ Full (40 questions) | ✅ Comprehensive (100+ questions) | Depth gated |
| **Benefit Discovery** | ✅ Financial only | ✅ All domains | ✅ All domains | Domain access |
| **Personalized Roadmap** | ✅ 30-day plan | ✅ 90-day plan | ✅ 1-year+ strategic plan | Planning horizon |
| **AI Coaching** | ❌ Locked | ✅ Weekly check-ins | ✅ Daily proactive insights | Coaching frequency |

### Data & Insights

| Feature | Freemium | Pro | Enterprise | Notes |
|---------|----------|-----|------------|-------|
| **Dashboard** | ✅ Basic widgets | ✅ Customizable | ✅ Fully custom + widgets | Customization |
| **Reports** | ✅ Monthly summary | ✅ Weekly reports | ✅ Daily + custom reports | Report frequency |
| **Data Export** | ❌ Locked | ✅ CSV export | ✅ Full API access | Export capabilities |
| **Advanced Analytics** | ❌ Locked | ✅ Trends & projections | ✅ Full forecasting | Analysis depth |
| **Net Worth Tracking** | ✅ Manual entry | ✅ Automatic updates | ✅ Automatic + trends | Automation |
| **Financial Health Score** | ✅ Basic score | ✅ Detailed breakdown | ✅ Full + benchmarking | Insight depth |

### Enterprise-Only Features

| Feature | Description | White-Label Ready? |
|---------|-------------|-------------------|
| **Custom Branding** | Logo, colors, domain | ✅ Yes |
| **White-Label Portal** | Remove "Life Navigator" branding | ✅ Yes |
| **SSO/SAML** | Enterprise authentication | ✅ Yes |
| **Multi-User Access** | Team accounts (advisor + clients) | ✅ Yes |
| **Admin Dashboard** | Manage team members, usage | ✅ Yes |
| **Custom Workflows** | Build proprietary agent flows | ✅ Yes |
| **Dedicated Support** | Slack channel, priority support | ✅ Yes |
| **SLA Guarantee** | 99.9% uptime, <500ms response | ✅ Yes |
| **Custom Integrations** | Connect to proprietary systems | ✅ Yes |
| **Data Residency** | Choose data storage location | ✅ Yes |

---

## 🚀 UPDATED PRICING STRUCTURE

### Base Tiers

| Tier | Monthly | Annual | What You Get |
|------|---------|--------|--------------|
| **Freemium** | $0 | $0 | Basic financial planning, 20 queries/day, limited features |
| **Pro** | $29 | $290 (save $58) | Full financial + health + career + education, 200 queries/month, Llama 4 AI |
| **Enterprise** | $99 | $990 (save $198) | Everything + white-label + unlimited usage + custom workflows |

### Pro Add-Ons (Optional)

| Add-On | Price | What It Does |
|--------|-------|--------------|
| Tax Optimizer | $2/mo | Tax deduction discovery, withholding optimization |
| Portfolio Analyst | $3/mo | Portfolio rebalancing, allocation analysis |
| Debt Strategist | $2/mo | Multi-loan payoff optimization |
| Real Estate Analyzer | $12/mo | Buy vs rent, property valuation |
| Healthcare Navigator | $15/mo | Insurance plan optimization |
| Career Negotiation Agent | $3/mo | Salary negotiation, offer analysis |

### Bundles

| Bundle | Price | Includes |
|--------|-------|----------|
| **Career Accelerator** | $35/mo | Pro + Career Negotiation + Resume Builder (unlocked) |
| **Health & Wealth** | $49/mo | Pro + Healthcare Navigator + Tax Optimizer |
| **Complete Suite** | $69/mo | Pro + All specialists (save $15/mo) |

---

## 🔒 IMPLEMENTATION: FEATURE GATING

### 1. Feature Flag System

**File**: `apps/web/src/lib/features/feature-flags.ts` (NEW)

```typescript
export enum Feature {
  // Health
  HEALTH_INSURANCE_UPLOAD = 'health_insurance_upload',
  HEALTH_INSURANCE_OCR = 'health_insurance_ocr',
  HEALTH_PLAN_COMPARISON = 'health_plan_comparison',
  HEALTH_COST_ESTIMATOR = 'health_cost_estimator',
  HEALTH_GOALS = 'health_goals',
  HEALTH_WELLNESS = 'health_wellness',
  HEALTH_MEDICARE = 'health_medicare',

  // Career
  CAREER_GOALS = 'career_goals',
  CAREER_RESUME_BUILDER = 'career_resume_builder',
  CAREER_RESUME_ANALYSIS = 'career_resume_analysis',
  CAREER_JOB_OPPORTUNITIES = 'career_job_opportunities',
  CAREER_NEGOTIATION = 'career_negotiation',
  CAREER_PATH_PLANNING = 'career_path_planning',
  CAREER_INTERVIEW_PREP = 'career_interview_prep',

  // Education
  EDUCATION_GOALS_UNLIMITED = 'education_goals_unlimited',
  EDUCATION_COURSE_RECS = 'education_course_recs',
  EDUCATION_LEARNING_PATH = 'education_learning_path',
  EDUCATION_CERTIFICATION = 'education_certification',
  EDUCATION_FUNDING = 'education_funding',

  // Financial
  FINANCIAL_RETIREMENT_PLANNING = 'financial_retirement_planning',
  FINANCIAL_ESTATE_PLANNING = 'financial_estate_planning',
  FINANCIAL_SCENARIO_LAB = 'financial_scenario_lab',
  FINANCIAL_INVESTMENT_TRACKING = 'financial_investment_tracking',

  // AI
  AI_MULTI_AGENT = 'ai_multi_agent',
  AI_CUSTOM_WORKFLOWS = 'ai_custom_workflows',
  AI_API_ACCESS = 'ai_api_access',

  // Enterprise
  ENTERPRISE_WHITE_LABEL = 'enterprise_white_label',
  ENTERPRISE_SSO = 'enterprise_sso',
  ENTERPRISE_MULTI_USER = 'enterprise_multi_user',
  ENTERPRISE_ADMIN_DASHBOARD = 'enterprise_admin_dashboard',
}

export type SubscriptionTier = 'freemium' | 'pro' | 'enterprise';

// Feature access matrix
const FEATURE_ACCESS: Record<Feature, SubscriptionTier[]> = {
  // Health - Insurance upload available to all
  [Feature.HEALTH_INSURANCE_UPLOAD]: ['freemium', 'pro', 'enterprise'],
  [Feature.HEALTH_INSURANCE_OCR]: ['pro', 'enterprise'],
  [Feature.HEALTH_PLAN_COMPARISON]: ['pro', 'enterprise'],
  [Feature.HEALTH_COST_ESTIMATOR]: ['pro', 'enterprise'],
  [Feature.HEALTH_GOALS]: ['pro', 'enterprise'],
  [Feature.HEALTH_WELLNESS]: ['pro', 'enterprise'],
  [Feature.HEALTH_MEDICARE]: ['enterprise'],

  // Career - All locked in freemium
  [Feature.CAREER_GOALS]: ['pro', 'enterprise'],
  [Feature.CAREER_RESUME_BUILDER]: ['pro', 'enterprise'],
  [Feature.CAREER_RESUME_ANALYSIS]: ['pro', 'enterprise'],
  [Feature.CAREER_JOB_OPPORTUNITIES]: ['pro', 'enterprise'],
  [Feature.CAREER_NEGOTIATION]: ['pro', 'enterprise'],
  [Feature.CAREER_PATH_PLANNING]: ['pro', 'enterprise'],
  [Feature.CAREER_INTERVIEW_PREP]: ['pro', 'enterprise'],

  // Education - Limited in freemium
  [Feature.EDUCATION_GOALS_UNLIMITED]: ['pro', 'enterprise'],
  [Feature.EDUCATION_COURSE_RECS]: ['pro', 'enterprise'],
  [Feature.EDUCATION_LEARNING_PATH]: ['pro', 'enterprise'],
  [Feature.EDUCATION_CERTIFICATION]: ['pro', 'enterprise'],
  [Feature.EDUCATION_FUNDING]: ['pro', 'enterprise'],

  // Financial - Advanced features gated
  [Feature.FINANCIAL_RETIREMENT_PLANNING]: ['pro', 'enterprise'],
  [Feature.FINANCIAL_ESTATE_PLANNING]: ['enterprise'],
  [Feature.FINANCIAL_SCENARIO_LAB]: ['pro', 'enterprise'],
  [Feature.FINANCIAL_INVESTMENT_TRACKING]: ['pro', 'enterprise'],

  // AI
  [Feature.AI_MULTI_AGENT]: ['pro', 'enterprise'],
  [Feature.AI_CUSTOM_WORKFLOWS]: ['enterprise'],
  [Feature.AI_API_ACCESS]: ['enterprise'],

  // Enterprise
  [Feature.ENTERPRISE_WHITE_LABEL]: ['enterprise'],
  [Feature.ENTERPRISE_SSO]: ['enterprise'],
  [Feature.ENTERPRISE_MULTI_USER]: ['enterprise'],
  [Feature.ENTERPRISE_ADMIN_DASHBOARD]: ['enterprise'],
};

export function hasFeatureAccess(
  userTier: SubscriptionTier,
  feature: Feature
): boolean {
  return FEATURE_ACCESS[feature].includes(userTier);
}

export function getRequiredTier(feature: Feature): SubscriptionTier {
  const tiers = FEATURE_ACCESS[feature];
  // Return the minimum tier required
  if (tiers.includes('freemium')) return 'freemium';
  if (tiers.includes('pro')) return 'pro';
  return 'enterprise';
}
```

### 2. Feature Gate Hook

**File**: `apps/web/src/hooks/useFeatureGate.ts` (NEW)

```typescript
import { useUser } from '@/hooks/useUser';
import { Feature, hasFeatureAccess, getRequiredTier } from '@/lib/features/feature-flags';
import { useRouter } from 'next/navigation';

export function useFeatureGate(feature: Feature) {
  const { user } = useUser();
  const router = useRouter();

  const tier = user?.subscriptionTier || 'freemium';
  const hasAccess = hasFeatureAccess(tier, feature);
  const requiredTier = getRequiredTier(feature);

  const requireAccess = (redirectTo?: string) => {
    if (!hasAccess) {
      // Redirect to upgrade page with feature context
      router.push(`/upgrade?feature=${feature}&required=${requiredTier}`);
      return false;
    }
    return true;
  };

  return {
    hasAccess,
    requiredTier,
    requireAccess,
    currentTier: tier
  };
}
```

### 3. Feature Gate Component

**File**: `apps/web/src/components/features/FeatureGate.tsx` (NEW)

```typescript
'use client';

import { Feature } from '@/lib/features/feature-flags';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import { Lock } from 'lucide-react';
import Link from 'next/link';

interface FeatureGateProps {
  feature: Feature;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgradePrompt?: boolean;
}

export function FeatureGate({
  feature,
  children,
  fallback,
  showUpgradePrompt = true
}: FeatureGateProps) {
  const { hasAccess, requiredTier } = useFeatureGate(feature);

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (showUpgradePrompt) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
          <Lock className="w-8 h-8 text-blue-600" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          Upgrade to {requiredTier === 'pro' ? 'Pro' : 'Enterprise'}
        </h3>
        <p className="text-gray-600 mb-6">
          This feature is available on the {requiredTier === 'pro' ? 'Pro' : 'Enterprise'} plan.
        </p>
        <Link
          href={`/upgrade?feature=${feature}&required=${requiredTier}`}
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700"
        >
          Upgrade Now
        </Link>
      </div>
    );
  }

  return null;
}
```

### 4. Usage in Components

**Example: Career Section**

**File**: `apps/web/src/app/career/page.tsx`

```typescript
import { FeatureGate } from '@/components/features/FeatureGate';
import { Feature } from '@/lib/features/feature-flags';

export default function CareerPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Career Planning</h1>

      {/* Entire career section gated */}
      <FeatureGate feature={Feature.CAREER_GOALS}>
        <div className="grid grid-cols-2 gap-6">
          {/* Career Goals */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Career Goals</h2>
            {/* Content */}
          </div>

          {/* Resume Builder - nested gate */}
          <FeatureGate feature={Feature.CAREER_RESUME_BUILDER}>
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Resume Builder</h2>
              <button className="bg-blue-600 text-white px-4 py-2 rounded">
                Build Resume
              </button>
            </div>
          </FeatureGate>

          {/* Job Opportunities */}
          <FeatureGate feature={Feature.CAREER_JOB_OPPORTUNITIES}>
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Job Opportunities</h2>
              {/* Content */}
            </div>
          </FeatureGate>
        </div>
      </FeatureGate>
    </div>
  );
}
```

**Example: Health Section**

**File**: `apps/web/src/app/health/page.tsx`

```typescript
import { FeatureGate } from '@/components/features/FeatureGate';
import { Feature } from '@/lib/features/feature-flags';

export default function HealthPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Health Planning</h1>

      {/* Insurance upload - available to all */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Insurance Documents</h2>
        <button className="bg-blue-600 text-white px-4 py-2 rounded">
          Upload Insurance Card
        </button>
      </div>

      {/* OCR parsing - Pro+ only */}
      <FeatureGate feature={Feature.HEALTH_INSURANCE_OCR}>
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Automatic Extraction</h2>
          <p className="text-gray-600">
            We'll automatically extract your coverage details, copays, and deductibles.
          </p>
        </div>
      </FeatureGate>

      {/* Plan comparison - Pro+ only */}
      <FeatureGate feature={Feature.HEALTH_PLAN_COMPARISON}>
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Compare Plans</h2>
          {/* Comparison tool */}
        </div>
      </FeatureGate>

      {/* Health goals - Pro+ only */}
      <FeatureGate feature={Feature.HEALTH_GOALS}>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Health Goals</h2>
          {/* Goals list */}
        </div>
      </FeatureGate>
    </div>
  );
}
```

**Example: Education Section**

**File**: `apps/web/src/app/education/page.tsx`

```typescript
export default function EducationPage() {
  const { user } = useUser();
  const isFreeUser = user?.subscriptionTier === 'freemium';

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Education Planning</h1>

      {/* Education goals - limited for freemium */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Education Goals</h2>
          {isFreeUser && (
            <span className="text-sm text-gray-500">1 of 1 goals used</span>
          )}
        </div>

        {isFreeUser && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-4">
            <p className="text-sm text-yellow-800">
              Freemium users can track 1 education goal.
              <Link href="/upgrade" className="font-semibold underline ml-1">
                Upgrade to Pro for 5 goals
              </Link>
            </p>
          </div>
        )}

        {/* Goals list */}
      </div>

      {/* Course recommendations - Pro+ only */}
      <FeatureGate feature={Feature.EDUCATION_COURSE_RECS}>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Recommended Courses</h2>
          {/* Course recs */}
        </div>
      </FeatureGate>
    </div>
  );
}
```

### 5. Backend Enforcement

**File**: `backend/app/api/v1/endpoints/career.py` (NEW)

```python
from fastapi import APIRouter, Depends, HTTPException
from app.api.deps import get_current_user, check_feature_access
from app.models.features import Feature

router = APIRouter(prefix="/career", tags=["career"])

@router.get("/goals")
async def get_career_goals(
    user = Depends(get_current_user),
    _access = Depends(check_feature_access(Feature.CAREER_GOALS))
):
    """
    Get user's career goals.
    Requires Pro or Enterprise tier.
    """
    # Implementation
    pass

@router.post("/resume/generate")
async def generate_resume(
    user = Depends(get_current_user),
    _access = Depends(check_feature_access(Feature.CAREER_RESUME_BUILDER))
):
    """
    Generate AI-powered resume.
    Requires Pro or Enterprise tier.
    """
    # Implementation
    pass
```

**File**: `backend/app/api/deps.py` (Add feature check)

```python
from fastapi import HTTPException, Depends
from app.models.features import Feature, FEATURE_ACCESS

def check_feature_access(feature: Feature):
    """Dependency to check feature access."""
    async def _check(user = Depends(get_current_user)):
        tier = user.subscriptionTier or 'freemium'

        if tier not in FEATURE_ACCESS[feature]:
            required_tier = FEATURE_ACCESS[feature][0]
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "feature_locked",
                    "feature": feature,
                    "current_tier": tier,
                    "required_tier": required_tier,
                    "message": f"This feature requires {required_tier} tier"
                }
            )

        return True

    return _check
```

---

## 🎨 UPGRADE PROMPTS & UX

### In-App Upgrade Prompt

**File**: `apps/web/src/components/billing/UpgradePrompt.tsx` (NEW)

```typescript
'use client';

import { useSearchParams } from 'next/navigation';
import { Feature } from '@/lib/features/feature-flags';

const FEATURE_DESCRIPTIONS: Record<Feature, { title: string; benefits: string[] }> = {
  [Feature.CAREER_RESUME_BUILDER]: {
    title: 'AI-Powered Resume Builder',
    benefits: [
      'Generate ATS-optimized resumes in seconds',
      'Tailored to each job application',
      'Expert formatting and keyword optimization',
      'Export to PDF, Word, or plain text'
    ]
  },
  [Feature.HEALTH_PLAN_COMPARISON]: {
    title: 'Health Plan Comparison Tool',
    benefits: [
      'Compare up to 3 health insurance plans side-by-side',
      'Calculate total cost based on your usage',
      'Find hidden savings opportunities',
      'Get personalized recommendations'
    ]
  },
  // ... more feature descriptions
};

export function UpgradePrompt() {
  const searchParams = useSearchParams();
  const feature = searchParams.get('feature') as Feature;
  const requiredTier = searchParams.get('required') as 'pro' | 'enterprise';

  const description = FEATURE_DESCRIPTIONS[feature];

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">
          Unlock {description?.title || 'Premium Features'}
        </h1>
        <p className="text-xl text-gray-600">
          Upgrade to {requiredTier === 'pro' ? 'Pro' : 'Enterprise'} to access this feature
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
        <h2 className="text-2xl font-bold mb-4">With this feature, you can:</h2>
        <ul className="space-y-3">
          {description?.benefits.map((benefit, i) => (
            <li key={i} className="flex items-start">
              <svg className="w-6 h-6 text-green-500 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-lg">{benefit}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Pro tier card */}
        {requiredTier === 'pro' && (
          <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl p-8 text-white">
            <h3 className="text-3xl font-bold mb-2">Pro</h3>
            <div className="text-5xl font-bold mb-4">$29<span className="text-xl">/mo</span></div>
            <ul className="space-y-2 mb-6">
              <li>✓ Full health, career & education access</li>
              <li>✓ 200 queries per month</li>
              <li>✓ Llama 4 Maverick AI</li>
              <li>✓ Multi-agent orchestration</li>
              <li>✓ Add premium specialists</li>
            </ul>
            <button className="w-full bg-white text-blue-600 py-3 rounded-lg font-bold hover:bg-gray-100">
              Upgrade to Pro
            </button>
          </div>
        )}

        {/* Enterprise tier card */}
        <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl p-8 text-white">
          <h3 className="text-3xl font-bold mb-2">Enterprise</h3>
          <div className="text-5xl font-bold mb-4">$99<span className="text-xl">/mo</span></div>
          <ul className="space-y-2 mb-6">
            <li>✓ Everything in Pro</li>
            <li>✓ Unlimited queries</li>
            <li>✓ All specialists included</li>
            <li>✓ White-label branding</li>
            <li>✓ Custom workflows</li>
            <li>✓ Priority support</li>
          </ul>
          <button className="w-full bg-white text-purple-600 py-3 rounded-lg font-bold hover:bg-gray-100">
            Upgrade to Enterprise
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## 🏢 WHITE-LABEL FEATURES (Enterprise)

### White-Label Configuration

**File**: `apps/web/prisma/schema.prisma` (Add to User or create Organization model)

```prisma
model Organization {
  id                String   @id @default(cuid())
  name              String
  slug              String   @unique  // e.g., "acme-advisors"

  // White-label branding
  logoUrl           String?
  primaryColor      String   @default("#3B82F6")
  secondaryColor    String   @default("#8B5CF6")
  customDomain      String?  @unique  // e.g., "app.acmeadvisors.com"

  // Features
  whiteLabelEnabled Boolean  @default(false)
  customWorkflows   Boolean  @default(false)
  ssoEnabled        Boolean  @default(false)
  ssoProvider       String?  // "okta", "auth0", "azure_ad"
  ssoConfig         Json?

  // Limits
  maxUsers          Int      @default(10)
  maxQueries        Int      @default(10000)  // per month

  // Billing
  stripeCustomerId  String?  @unique
  subscriptionTier  String   @default("enterprise")

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  // Relations
  users             User[]

  @@map("organizations")
}

model User {
  // ... existing fields ...

  organizationId    String?
  organization      Organization? @relation(fields: [organizationId], references: [id])

  isOrgAdmin        Boolean  @default(false)
}
```

### White-Label Middleware

**File**: `apps/web/src/middleware.ts` (Add white-label detection)

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host');

  // Check if it's a custom domain
  if (hostname && !hostname.includes('lifenavigator.com')) {
    // Look up organization by custom domain
    const org = await prisma.organization.findUnique({
      where: { customDomain: hostname }
    });

    if (org && org.whiteLabelEnabled) {
      // Set organization context for white-label rendering
      const response = NextResponse.next();
      response.cookies.set('org_slug', org.slug);
      return response;
    }
  }

  return NextResponse.next();
}
```

### White-Label UI Components

**File**: `apps/web/src/components/branding/WhiteLabelLogo.tsx` (NEW)

```typescript
'use client';

import { useOrganization } from '@/hooks/useOrganization';
import Image from 'next/image';

export function WhiteLabelLogo() {
  const { organization } = useOrganization();

  if (organization?.whiteLabelEnabled && organization.logoUrl) {
    return (
      <Image
        src={organization.logoUrl}
        alt={organization.name}
        width={180}
        height={40}
        className="h-10 w-auto"
      />
    );
  }

  // Default Life Navigator logo
  return (
    <div className="text-2xl font-bold text-blue-600">
      Life Navigator
    </div>
  );
}
```

---

## 📊 CONVERSION FUNNEL TRACKING

**File**: `backend/app/services/analytics_service.py` (NEW)

```python
class AnalyticsService:
    """Track upgrade prompts and conversions."""

    @staticmethod
    async def log_upgrade_prompt(
        user_id: str,
        feature: str,
        required_tier: str,
        context: dict
    ):
        """Log when user sees upgrade prompt."""
        await prisma.upgradePrompt.create(
            data={
                "userId": user_id,
                "feature": feature,
                "requiredTier": required_tier,
                "context": context,
                "timestamp": datetime.utcnow()
            }
        )

    @staticmethod
    async def log_conversion(
        user_id: str,
        from_tier: str,
        to_tier: str,
        trigger_feature: str
    ):
        """Log successful tier upgrade."""
        await prisma.conversion.create(
            data={
                "userId": user_id,
                "fromTier": from_tier,
                "toTier": to_tier,
                "triggerFeature": trigger_feature,
                "timestamp": datetime.utcnow()
            }
        )
```

---

## ✅ IMPLEMENTATION CHECKLIST

### Phase 1: Feature Flags (Day 1)
- [ ] Create `feature-flags.ts` with complete matrix
- [ ] Create `useFeatureGate` hook
- [ ] Create `FeatureGate` component
- [ ] Add backend feature check dependency

### Phase 2: UI Gating (Day 2)
- [ ] Gate Health section (keep insurance upload free)
- [ ] Gate Career section (entire module)
- [ ] Gate Education section (limit goals)
- [ ] Gate Scenario Lab
- [ ] Add upgrade prompts to all gates

### Phase 3: Backend Enforcement (Day 3)
- [ ] Add feature checks to all APIs
- [ ] Return 403 with upgrade info for gated features
- [ ] Add analytics tracking
- [ ] Test enforcement end-to-end

### Phase 4: Enterprise/White-Label (Optional, Day 4-5)
- [ ] Add Organization model to database
- [ ] Create white-label middleware
- [ ] Create branded components
- [ ] Add SSO support
- [ ] Create admin dashboard

---

## 🎯 SUCCESS METRICS

Track these to optimize conversion:

1. **Feature Engagement**:
   - Which gated features get the most attempted access?
   - Which upgrade prompts have highest click-through?

2. **Conversion Rate**:
   - % of users who see upgrade prompt → actually upgrade
   - Time from first prompt to conversion
   - Which features drive most upgrades?

3. **Retention**:
   - Do Pro users who unlock career features retain better?
   - Churn rate by primary feature usage

4. **White-Label**:
   - Enterprise adoption rate
   - Custom domain setup rate
   - Multi-user org growth

---

**Status**: ✅ **READY TO IMPLEMENT**
**Timeline**: 3-4 days for gating, 2 additional days for white-label
**Impact**: Clear value prop for each tier, improved conversion rates

---

*Generated: January 12, 2026*
