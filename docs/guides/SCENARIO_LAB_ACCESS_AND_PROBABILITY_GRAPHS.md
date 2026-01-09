# Scenario Lab Access & Probability Graph Integration Guide

**Last Updated:** 2026-01-09
**Owner:** Product + Engineering

---

## Overview

This guide explains:
1. How to ensure users have access to the Scenario Lab feature
2. Where to add win/loss probability graphs in the UI

---

## Part 1: Ensuring Users Have Access to Scenario Lab

### Current Access Control

The Scenario Lab is **feature-flagged** and requires both server and client-side flags to be enabled.

### Step 1: Enable Feature Flags

#### Server-Side Flag (Required for API Access)

**File:** `backend/.env` or environment variables

```bash
# Enable Scenario Lab API endpoints
FEATURE_SCENARIO_LAB_ENABLED=true
```

**What it controls:**
- All `/api/scenario-lab/*` endpoints
- API routes check this flag before processing requests
- If disabled, API returns 403 Forbidden

#### Client-Side Flag (Required for UI Access)

**File:** `apps/web/.env.local`

```bash
# Enable Scenario Lab UI pages
NEXT_PUBLIC_FEATURE_SCENARIO_LAB_ENABLED=true
```

**What it controls:**
- Scenario Lab pages visibility
- Navigation links to scenario lab
- Client-side rendering of scenario components

### Step 2: Add to Navigation Sidebar

Currently, Scenario Lab is **NOT** in the main navigation. Users can only access it via direct URL.

**File:** `apps/web/src/components/layout/Sidebar.tsx`

Add this to the navigation items array:

```typescript
{
  name: 'Scenario Lab',
  href: '/dashboard/scenario-lab',
  icon: BeakerIcon, // or any suitable icon from @heroicons/react
  current: pathname.startsWith('/dashboard/scenario-lab'),
  badge: undefined,
  children: [
    {
      name: 'My Scenarios',
      href: '/dashboard/scenario-lab',
    },
    {
      name: 'Create New',
      href: '/dashboard/scenario-lab?action=create',
    },
  ],
},
```

**Add conditional rendering based on feature flag:**

```typescript
// At the top of Sidebar component
const isScenarioLabEnabled = process.env.NEXT_PUBLIC_FEATURE_SCENARIO_LAB_ENABLED === 'true';

// In the navigation items
const navigationItems = [
  // ... existing items
  ...(isScenarioLabEnabled ? [{
    name: 'Scenario Lab',
    href: '/dashboard/scenario-lab',
    icon: BeakerIcon,
    current: pathname.startsWith('/dashboard/scenario-lab'),
  }] : []),
];
```

### Step 3: Database Setup

Ensure the scenario lab schema is migrated:

```bash
# Run Supabase migrations
cd apps/web
npx supabase migration up

# Or manually run these migrations:
# 005_scenario_lab_schema.sql
# 006_scenario_lab_rls.sql
# 007_scenario_lab_storage.sql
```

**Verify tables exist:**

```sql
-- Connect to Supabase and check
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'scenario%';

-- Expected tables:
-- scenario_labs
-- scenario_versions
-- scenario_documents
-- scenario_extracted_fields
-- scenario_inputs
-- scenario_sim_runs
-- scenario_goal_snapshots
-- scenario_pins
-- scenario_audit_log
-- scenario_jobs
-- plans
-- plan_phases
-- plan_tasks
-- scenario_reports
```

### Step 4: Row-Level Security (RLS)

RLS policies ensure users can **only** access their own scenarios.

**Policies in place:**
- `scenario_labs` - `auth.uid() = user_id`
- `scenario_versions` - Via `scenario_labs.user_id`
- `scenario_goal_snapshots` - Via `scenario_sim_runs → scenario_versions → scenario_labs.user_id`
- All other tables follow same pattern

**Test RLS:**

```sql
-- As authenticated user, should only see own scenarios
SELECT * FROM scenario_labs;

-- As anonymous, should see nothing
SET ROLE anon;
SELECT * FROM scenario_labs;
RESET ROLE;
```

### Step 5: Storage Buckets

Scenario Lab uses storage for:
- Uploaded documents (PDFs, images)
- Generated reports
- Extracted data

**Verify storage buckets exist:**

```sql
-- Check storage buckets
SELECT * FROM storage.buckets WHERE name = 'scenario-documents';

-- Verify RLS policies on storage
SELECT * FROM storage.objects WHERE bucket_id = 'scenario-documents';
```

**Create bucket if missing:**

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('scenario-documents', 'scenario-documents', false);

-- Add RLS policy
CREATE POLICY "Users can manage their own scenario documents"
ON storage.objects FOR ALL
USING (bucket_id = 'scenario-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
```

### Step 6: API Rate Limiting

Simulations are rate-limited to prevent abuse:

**File:** `apps/web/src/lib/scenario-lab/rate-limiter.ts`

**Default limits:**
- 5 simulations per hour per user
- 20 simulations per day per user

**Override in environment:**

```bash
# apps/web/.env.local
SCENARIO_LAB_RATE_LIMIT_HOURLY=10
SCENARIO_LAB_RATE_LIMIT_DAILY=50
```

### Step 7: Background Worker

The scenario lab worker processes background jobs (OCR, simulations, reports).

**File:** `apps/web/src/workers/scenario-lab-worker.ts`

**Start the worker:**

```bash
# In development
cd apps/web
npm run dev:worker

# In production (use process manager like PM2)
pm2 start npm --name "scenario-worker" -- run worker
```

**Worker processes:**
- OCR extraction from documents
- PDF parsing
- Monte Carlo simulations
- Roadmap generation
- Report generation

**Monitor worker:**

```bash
# Check worker logs
pm2 logs scenario-worker

# Check job queue
SELECT * FROM scenario_jobs WHERE status = 'pending' OR status = 'running';
```

### Step 8: User Permissions

**JWT Token Requirements:**
- All API calls require valid JWT token
- Token must contain `user_id` claim
- Extracted via `getUserIdFromJWT()` in API routes

**Example API call:**

```typescript
// apps/web/src/lib/api-client.ts
const response = await fetch('/api/scenario-lab/scenarios', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${session.accessToken}`,
    'Content-Type': 'application/json',
  },
});
```

### Step 9: Testing Access

**Test checklist:**

1. ✅ Feature flags enabled
2. ✅ Database migrations applied
3. ✅ RLS policies active
4. ✅ Storage buckets configured
5. ✅ Navigation link visible
6. ✅ Background worker running
7. ✅ User can create scenario
8. ✅ User can upload documents
9. ✅ User can run simulation
10. ✅ User can pin goal to dashboard

**Test script:**

```typescript
// Test scenario lab access
async function testScenarioLabAccess() {
  // 1. Create scenario
  const createResponse = await fetch('/api/scenario-lab/scenarios', {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({
      name: 'Test Scenario',
      description: 'Testing access',
    }),
  });

  const scenario = await createResponse.json();
  console.log('Created scenario:', scenario.id);

  // 2. Upload document
  const formData = new FormData();
  formData.append('file', testFile);

  const uploadResponse = await fetch(`/api/scenario-lab/scenarios/${scenario.id}/documents`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  console.log('Document uploaded:', await uploadResponse.json());

  // 3. Run simulation
  const simResponse = await fetch(`/api/scenario-lab/versions/${scenario.latestVersionId}/simulate`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({
      inputs: { /* ... */ },
    }),
  });

  console.log('Simulation queued:', await simResponse.json());
}
```

---

## Part 2: Where to Add Win/Loss Probability Graphs

### Current Implementation

Probability data is **already available** but only displayed in limited locations.

### Existing Components

#### 1. ProbabilitySparkline Component

**File:** `apps/web/src/components/scenario-lab/ProbabilitySparkline.tsx`

**Current usage:**
- Scenario Lab Scoreboard Tab
- Pinned Scenario Widget on Dashboard

**Props:**
```typescript
interface ProbabilitySparklineProps {
  data: number[];           // Array of P50 values from simulation runs
  width?: number;           // Default: 120px
  height?: number;          // Default: 40px
  color?: string;           // Default: '#3B82F6' (blue)
  className?: string;
}
```

**Renders:**
- SVG sparkline showing trend
- Area fill under curve
- Normalized to fit viewBox

#### 2. ScoreboardTab Component

**File:** `apps/web/src/components/scenario-lab/ScoreboardTab.tsx`

**Current display:**
- Goal P50 (expected outcome) - large number
- P10-P90 range - small text
- Top 3 drivers - list
- Top 3 risks - list
- Status badge - ahead/on_track/behind/at_risk
- Pin button

**Data structure:**
```typescript
interface ScenarioGoalSnapshot {
  id: string;
  goal_id: string;
  probability: number;      // Overall success probability (0-1)
  p10: number;              // 10th percentile
  p50: number;              // 50th percentile (median)
  p90: number;              // 90th percentile
  status: 'ahead' | 'on_track' | 'behind' | 'at_risk';
  top_drivers: Array<{
    field: string;
    impact: number;         // Positive impact
  }>;
  top_risks: Array<{
    field: string;
    impact: number;         // Negative impact
  }>;
  created_at: string;
}
```

### Locations to Add Probability Graphs

#### Option 1: Goal Detail Panel (Recommended ⭐)

**File:** `apps/web/src/components/goals/GoalDetailPanel.tsx`

**Current display:**
- Goal name, description
- Target amount vs current amount
- Progress percentage
- Monthly contribution recommendation
- Edit/delete buttons

**Enhancement:**

Add a **Probability Section** that shows:
1. Win/loss probability percentage
2. P10-P50-P90 distribution graph
3. Confidence interval visualization
4. Link to run new scenario

**Implementation:**

```typescript
// Add to GoalDetailPanel.tsx

import { useMemo } from 'react';
import { ProbabilityDistributionGraph } from '@/components/scenario-lab/ProbabilityDistributionGraph';

export function GoalDetailPanel({ goal }: { goal: Goal }) {
  // Fetch latest scenario results for this goal
  const { data: scenarioResults } = useScenarioResultsForGoal(goal.id);

  return (
    <div className="space-y-6">
      {/* Existing goal info */}
      <div>{/* ... */}</div>

      {/* NEW: Probability Section */}
      {scenarioResults && (
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold mb-4">Success Probability</h3>

          {/* Win/Loss Percentage */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Win Probability</div>
              <div className="text-3xl font-bold text-green-600">
                {(scenarioResults.probability * 100).toFixed(1)}%
              </div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Loss Probability</div>
              <div className="text-3xl font-bold text-red-600">
                {((1 - scenarioResults.probability) * 100).toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Distribution Graph */}
          <ProbabilityDistributionGraph
            p10={scenarioResults.p10}
            p50={scenarioResults.p50}
            p90={scenarioResults.p90}
            targetAmount={goal.targetAmount}
          />

          {/* Confidence Interval */}
          <div className="mt-4 text-sm text-gray-600">
            95% confidence interval: ${formatCurrency(scenarioResults.p10)} - ${formatCurrency(scenarioResults.p90)}
          </div>

          {/* Link to Scenario Lab */}
          <Link
            href={`/dashboard/scenario-lab/${scenarioResults.scenario_id}`}
            className="mt-4 inline-flex items-center text-blue-600 hover:underline"
          >
            View full scenario analysis →
          </Link>
        </div>
      )}

      {/* If no scenario results, show CTA */}
      {!scenarioResults && (
        <div className="border-t pt-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Run a Scenario Analysis</h4>
            <p className="text-sm text-gray-600 mb-4">
              See your probability of achieving this goal based on your current trajectory.
            </p>
            <Link
              href="/dashboard/scenario-lab?action=create"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create Scenario
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
```

**New hook to create:**

```typescript
// apps/web/src/hooks/useScenarioResultsForGoal.ts

export function useScenarioResultsForGoal(goalId: string) {
  return useQuery({
    queryKey: ['scenario-results', goalId],
    queryFn: async () => {
      // Fetch pinned scenario for this goal
      const pinsResponse = await fetch('/api/scenario-lab/pins', {
        headers: await getAuthHeaders(),
      });
      const pins = await pinsResponse.json();

      const goalPin = pins.find((pin: any) => pin.goal_id === goalId);

      if (!goalPin) return null;

      // Fetch latest simulation results
      const simResponse = await fetch(
        `/api/scenario-lab/simulations/${goalPin.sim_run_id}/goals`,
        { headers: await getAuthHeaders() }
      );

      const snapshots = await simResponse.json();
      return snapshots.find((s: any) => s.goal_id === goalId);
    },
  });
}
```

**New component to create:**

```typescript
// apps/web/src/components/scenario-lab/ProbabilityDistributionGraph.tsx

interface ProbabilityDistributionGraphProps {
  p10: number;
  p50: number;
  p90: number;
  targetAmount: number;
}

export function ProbabilityDistributionGraph({
  p10,
  p50,
  p90,
  targetAmount,
}: ProbabilityDistributionGraphProps) {
  return (
    <div className="relative h-32">
      {/* Background grid */}
      <div className="absolute inset-0 grid grid-cols-10 gap-px bg-gray-200">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="bg-white" />
        ))}
      </div>

      {/* Target line */}
      <div
        className="absolute h-full border-r-2 border-dashed border-gray-400"
        style={{ left: `${(targetAmount / p90) * 100}%` }}
      >
        <span className="absolute -top-6 -left-8 text-xs text-gray-600">
          Target
        </span>
      </div>

      {/* P10-P50-P90 bars */}
      <div className="absolute bottom-0 left-0 right-0 flex items-end h-full px-4">
        {/* P10 bar (10th percentile) */}
        <div className="flex-1 flex flex-col items-center">
          <div
            className="w-full bg-red-400 rounded-t"
            style={{ height: `${(p10 / p90) * 100}%` }}
          />
          <span className="text-xs mt-1">P10</span>
          <span className="text-xs text-gray-600">${formatCurrency(p10)}</span>
        </div>

        {/* P50 bar (median) */}
        <div className="flex-1 flex flex-col items-center">
          <div
            className="w-full bg-blue-500 rounded-t"
            style={{ height: `${(p50 / p90) * 100}%` }}
          />
          <span className="text-xs mt-1">P50</span>
          <span className="text-xs text-gray-600">${formatCurrency(p50)}</span>
        </div>

        {/* P90 bar (90th percentile) */}
        <div className="flex-1 flex flex-col items-center">
          <div className="w-full bg-green-500 rounded-t" style={{ height: '100%' }} />
          <span className="text-xs mt-1">P90</span>
          <span className="text-xs text-gray-600">${formatCurrency(p90)}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute -bottom-12 left-0 right-0 flex justify-center gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-400 rounded" />
          <span>Worst case</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-500 rounded" />
          <span>Expected</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-500 rounded" />
          <span>Best case</span>
        </div>
      </div>
    </div>
  );
}
```

#### Option 2: Roadmap Finance Page (Recommended ⭐)

**File:** `apps/web/src/app/dashboard/roadmap/finance/page.tsx`

**Current tabs:**
- Timeline (milestones)
- Budget (budget overview)
- Goals (goal progress)
- Investments (investment tracker)

**Enhancement:**

Add a **5th tab: "Probability"** that shows:
1. All goals with win/loss probabilities
2. Overall portfolio success rate
3. Risk factors and drivers
4. Scenario comparison table

**Implementation:**

```typescript
// Add to roadmap/finance/page.tsx

const tabs = [
  { id: 'timeline', name: 'Timeline', icon: CalendarIcon },
  { id: 'budget', name: 'Budget', icon: CurrencyDollarIcon },
  { id: 'goals', name: 'Goals', icon: FlagIcon },
  { id: 'investments', name: 'Investments', icon: ChartBarIcon },
  { id: 'probability', name: 'Probability', icon: ChartPieIcon }, // NEW
];

// Add tab content
{activeTab === 'probability' && <ProbabilityTab />}
```

**New component:**

```typescript
// apps/web/src/components/roadmap/finance/components/ProbabilityTab.tsx

export function ProbabilityTab() {
  const { data: scenarios } = useScenarios();
  const { data: goals } = useGoals();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Goal Success Probability</h2>

      {/* Overall Portfolio Success */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 rounded-lg text-white">
        <div className="text-sm opacity-90">Overall Portfolio Success Rate</div>
        <div className="text-5xl font-bold mt-2">73.5%</div>
        <div className="text-sm mt-2 opacity-75">
          Based on 5,000 Monte Carlo simulations
        </div>
      </div>

      {/* Per-Goal Probabilities */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {goals.map((goal) => (
          <GoalProbabilityCard key={goal.id} goal={goal} />
        ))}
      </div>

      {/* Risk Factors */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Top Risk Factors</h3>
        <RiskFactorsList />
      </div>

      {/* Scenario Comparison */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Scenario Comparison</h3>
        <ScenarioComparisonTable scenarios={scenarios} />
      </div>
    </div>
  );
}
```

#### Option 3: Main Dashboard Widget (Quick Win 🚀)

**File:** `apps/web/src/app/dashboard/page.tsx`

**Current widgets:**
- Welcome card
- Quick stats
- Recent activities
- Upcoming milestones

**Enhancement:**

Add **"Goal Probability Overview"** widget:
- Shows all goals with their success probabilities
- Color-coded badges (green > 75%, yellow 50-75%, red < 50%)
- Click to navigate to goal detail or scenario lab

**Implementation:**

```typescript
// apps/web/src/app/dashboard/page.tsx

<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  {/* Existing widgets */}

  {/* NEW: Goal Probability Widget */}
  <GoalProbabilityWidget />
</div>
```

```typescript
// apps/web/src/components/dashboard/GoalProbabilityWidget.tsx

export function GoalProbabilityWidget() {
  const { data: goals } = useGoals();
  const { data: scenarioResults } = useAllScenarioResults();

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Goal Success Probability</h3>

      <div className="space-y-3">
        {goals.map((goal) => {
          const result = scenarioResults?.find((r) => r.goal_id === goal.id);
          const probability = result?.probability || 0;

          return (
            <div key={goal.id} className="flex items-center justify-between">
              <div className="flex-1">
                <div className="font-medium">{goal.name}</div>
                <div className="text-sm text-gray-500">
                  Target: ${formatCurrency(goal.targetAmount)}
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Probability Badge */}
                <span
                  className={cn(
                    'px-3 py-1 rounded-full text-sm font-semibold',
                    probability >= 0.75 && 'bg-green-100 text-green-800',
                    probability >= 0.5 && probability < 0.75 && 'bg-yellow-100 text-yellow-800',
                    probability < 0.5 && 'bg-red-100 text-red-800'
                  )}
                >
                  {(probability * 100).toFixed(0)}%
                </span>

                {/* Mini Sparkline */}
                {result?.trend && (
                  <ProbabilitySparkline
                    data={result.trend}
                    width={60}
                    height={20}
                  />
                )}

                {/* Action Button */}
                <Link
                  href={`/dashboard/goals/${goal.id}`}
                  className="text-blue-600 hover:underline text-sm"
                >
                  Details →
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA if no scenarios */}
      {(!scenarioResults || scenarioResults.length === 0) && (
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600 mb-2">
            No probability data available
          </p>
          <Link
            href="/dashboard/scenario-lab?action=create"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Run First Scenario
          </Link>
        </div>
      )}
    </div>
  );
}
```

#### Option 4: Risk Engine Integration (Advanced 🔬)

**Files:**
- `apps/web/src/components/risk/RiskDashboard.tsx` (NEW)
- Integration with risk-engine service we just built

**Shows:**
- Real-time risk computation via SSE
- Win/loss probability timeline
- P05/P50/P95 bands over time
- Driver bar charts
- Recommendation cards

**Implementation:**

```typescript
// apps/web/src/components/risk/RiskDashboard.tsx

import { useRiskStream, useRiskClient } from '@life-navigator/risk-client';

export function RiskDashboard({ goals }: { goals: Goal[] }) {
  const client = useRiskClient({
    baseUrl: process.env.NEXT_PUBLIC_API_URL,
    getAuthToken: async () => session.accessToken,
  });

  const { snapshot, deltas, isConnected } = useRiskStream(client, {
    goal_context: { goals },
    mode: 'balanced',
  }, {
    onSnapshot: (data) => console.log('Risk snapshot:', data),
    onDelta: (delta) => console.log('Risk updated:', delta),
  });

  if (!snapshot) return <div>Loading risk analysis...</div>;

  return (
    <div className="space-y-6">
      {/* Overall Risk Score */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-2xl font-bold mb-4">Portfolio Risk Score</h2>
        <div className="text-6xl font-bold text-blue-600">
          {(snapshot.overall.win_probability * 100).toFixed(1)}%
        </div>
        <div className="text-sm text-gray-600 mt-2">
          Probability of achieving all goals
        </div>
      </div>

      {/* Win/Loss Timeline */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">
          Win/Loss Probability Timeline
        </h3>
        <TimelineGraph series={snapshot.series_payload.portfolio_value_series} />
      </div>

      {/* Percentile Bands */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">
          Portfolio Value Projections
        </h3>
        <PercentileBandChart
          bands={snapshot.series_payload.portfolio_value_series.percentile_bands}
        />
      </div>

      {/* Driver Bar Chart */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Top Drivers</h3>
        <DriverBarChart drivers={snapshot.drivers} />
      </div>

      {/* Recommendation Cards */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Recommendations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {snapshot.recommended_actions.map((action, idx) => (
            <RecommendationCard key={idx} action={action} />
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

## Summary: Action Items

### To Enable Scenario Lab Access:

1. ✅ Set `FEATURE_SCENARIO_LAB_ENABLED=true` in backend `.env`
2. ✅ Set `NEXT_PUBLIC_FEATURE_SCENARIO_LAB_ENABLED=true` in frontend `.env.local`
3. ✅ Run Supabase migrations (005, 006, 007)
4. ✅ Add "Scenario Lab" to sidebar navigation in `Sidebar.tsx`
5. ✅ Start background worker with `npm run dev:worker`
6. ✅ Verify RLS policies are active
7. ✅ Create storage bucket `scenario-documents`
8. ✅ Test with user account: create scenario, upload document, run simulation

### To Add Win/Loss Probability Graphs:

**Quick Wins (1-2 hours each):**
1. ✅ Add to `GoalDetailPanel.tsx` - show probability section with win/loss %
2. ✅ Add to main dashboard - create `GoalProbabilityWidget.tsx`

**Medium Effort (4-6 hours each):**
3. ✅ Add "Probability" tab to roadmap/finance page
4. ✅ Create `ProbabilityDistributionGraph.tsx` component

**Advanced (8+ hours):**
5. ✅ Integrate with risk-engine service via `@life-navigator/risk-client`
6. ✅ Create real-time risk dashboard with SSE streaming

---

## Related Documentation

- [Scenario Lab Schema](../supabase/migrations/005_scenario_lab_schema.sql)
- [Risk Engine Data Boundary](./RISK_ENGINE_DATA_BOUNDARY.md)
- [Risk Client Package](../../packages/risk-client/README.md)

---

**Questions?** Contact engineering@lifenavigator.com
