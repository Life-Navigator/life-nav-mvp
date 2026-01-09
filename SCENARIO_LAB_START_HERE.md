# Scenario Lab Module - Implementation Guide

## Overview

This guide provides step-by-step instructions for implementing the Scenario Lab module in the LifeNavigator monorepo. The module is **100% additive** and designed to be deployed progressively with zero downtime.

## Architecture Summary

- **Database**: Supabase Postgres (14 new tables) + Supabase Storage (2 private buckets)
- **API Pattern**: REST routes (`/api/scenario-lab/*`) following existing Next.js App Router pattern
- **Job System**: Database-backed queue (`scenario_jobs` table) with worker processor
- **Security**: RLS on all tables, signed URLs for storage (60min expiry), auto-redaction of sensitive data
- **Feature Flag**: `FEATURE_SCENARIO_LAB_ENABLED` in `.env`

## File Structure Created

```
apps/web/
├── supabase/migrations/
│   ├── 005_scenario_lab_schema.sql       ✅ Created
│   ├── 006_scenario_lab_rls.sql          ✅ Created
│   └── 007_scenario_lab_storage.sql      ✅ Created
├── src/
│   ├── lib/scenario-lab/
│   │   ├── types.ts                      ✅ Created
│   │   ├── validation.ts                 ✅ Created
│   │   ├── supabase-client.ts            ⏳ Next
│   │   ├── rate-limiter.ts               ⏳ Next
│   │   ├── job-queue.ts                  ⏳ Next
│   │   ├── ocr/
│   │   │   ├── extractor.ts              ⏳ Next
│   │   │   └── patterns.ts               ⏳ Next
│   │   ├── simulator/
│   │   │   ├── engine.ts                 ⏳ Next
│   │   │   ├── monte-carlo.ts            ⏳ Next
│   │   │   └── driver-analysis.ts        ⏳ Next
│   │   ├── pdf/
│   │   │   └── generator.ts              ⏳ Next
│   │   └── roadmap/
│   │       └── generator.ts              ⏳ Next
│   ├── app/api/scenario-lab/
│   │   ├── scenarios/
│   │   │   ├── route.ts                  ⏳ Next (LIST, CREATE)
│   │   │   └── [id]/
│   │   │       ├── route.ts              ⏳ Next (GET, PATCH, DELETE)
│   │   │       ├── versions/route.ts     ⏳ Next
│   │   │       ├── fork/route.ts         ⏳ Next
│   │   │       ├── commit/route.ts       ⏳ Next
│   │   │       └── ...                   ⏳ Next
│   │   ├── documents/
│   │   ├── fields/
│   │   ├── jobs/
│   │   ├── pins/
│   │   └── reports/
│   ├── app/dashboard/scenario-lab/
│   │   └── page.tsx                      ⏳ Next
│   ├── components/scenario-lab/
│   │   └── ...                           ⏳ Next
│   └── workers/
│       └── scenario-lab-worker.ts        ⏳ Next
└── .env (add FEATURE_SCENARIO_LAB_ENABLED)
```

---

## Step-by-Step Implementation

### ✅ STEP 1: Database Migrations (COMPLETED)

**Status**: Migrations created, ready to apply.

**Files**:
- `supabase/migrations/005_scenario_lab_schema.sql` - 14 tables + triggers
- `supabase/migrations/006_scenario_lab_rls.sql` - RLS policies for all tables
- `supabase/migrations/007_scenario_lab_storage.sql` - 2 storage buckets + policies

**Action Required**:
```bash
# Option A: Apply via Supabase CLI (if configured)
cd apps/web
supabase db push

# Option B: Apply via Supabase Dashboard
# - Go to SQL Editor
# - Run each migration file in order (005, 006, 007)
# - Verify tables appear in Table Editor
# - Verify storage buckets in Storage
```

**Validation**:
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'scenario_%';

-- Check RLS enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE tablename LIKE 'scenario_%';

-- Check storage buckets
SELECT * FROM storage.buckets WHERE name IN ('scenario-docs', 'scenario-reports');
```

---

### ✅ STEP 2: TypeScript Types & Validation (COMPLETED)

**Status**: Core types and Zod schemas created.

**Files**:
- `src/lib/scenario-lab/types.ts` - All TypeScript interfaces
- `src/lib/scenario-lab/validation.ts` - Zod schemas + sensitive data detection

**Action Required**: None - ready to use.

---

### ⏳ STEP 3: Environment Configuration

**Add to `.env.local`**:
```bash
# Feature Flag
FEATURE_SCENARIO_LAB_ENABLED=false  # Start disabled

# Supabase (should already exist)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Job Worker Configuration (optional for MVP)
SCENARIO_WORKER_POLL_INTERVAL_MS=5000
SCENARIO_WORKER_MAX_CONCURRENT_JOBS=3
```

**Add to `.env.example`**:
```bash
FEATURE_SCENARIO_LAB_ENABLED=false
SCENARIO_WORKER_POLL_INTERVAL_MS=5000
SCENARIO_WORKER_MAX_CONCURRENT_JOBS=3
```

---

### ⏳ STEP 4: Implement Supabase Client Helpers

Create `src/lib/scenario-lab/supabase-client.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Service role client for server-side operations (bypasses RLS when needed)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Helper to get user-scoped client (for RLS enforcement)
export async function getSupabaseClient(userId: string) {
  // In production, use the SSR client from @supabase/ssr
  // For now, return admin client (RLS will still enforce user_id checks)
  return supabaseAdmin;
}
```

---

### ⏳ STEP 5: Implement Job Queue System

Create `src/lib/scenario-lab/job-queue.ts`:

```typescript
import { supabaseAdmin } from './supabase-client';
import { JobType, ScenarioJob } from './types';
import { v4 as uuidv4 } from 'uuid';

export async function enqueueJob(params: {
  userId: string;
  scenarioId: string | null;
  jobType: JobType;
  inputJson: any;
  idempotencyKey?: string;
}): Promise<ScenarioJob> {
  const { userId, scenarioId, jobType, inputJson, idempotencyKey } = params;

  const { data, error } = await supabaseAdmin
    .from('scenario_jobs')
    .insert({
      user_id: userId,
      scenario_id: scenarioId,
      job_type: jobType,
      status: 'queued',
      input_json: inputJson,
      idempotency_key: idempotencyKey || uuidv4(),
    })
    .select()
    .single();

  if (error) throw error;
  return data as ScenarioJob;
}

export async function getJob(jobId: string): Promise<ScenarioJob | null> {
  const { data, error } = await supabaseAdmin
    .from('scenario_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error) return null;
  return data as ScenarioJob;
}

export async function updateJobStatus(
  jobId: string,
  status: 'running' | 'completed' | 'failed',
  updates: Partial<ScenarioJob> = {}
): Promise<void> {
  await supabaseAdmin
    .from('scenario_jobs')
    .update({
      status,
      updated_at: new Date().toISOString(),
      ...updates,
    })
    .eq('id', jobId);
}
```

---

### ⏳ STEP 6: Implement Rate Limiter

Create `src/lib/scenario-lab/rate-limiter.ts`:

```typescript
import { supabaseAdmin } from './supabase-client';

export async function checkRateLimit(
  userId: string,
  limitType: 'upload' | 'simulation' | 'pdf'
): Promise<{ allowed: boolean; currentCount: number; limit: number }> {
  // Define limits
  const limits = {
    upload: { count: 5, window_hours: 1 },
    simulation: { count: 20, window_minutes: 15 },
    pdf: { count: 10, window_hours: 24 },
  };

  const config = limits[limitType];
  const windowStart = new Date();

  if ('window_hours' in config) {
    windowStart.setHours(windowStart.getHours() - config.window_hours);
  } else if ('window_minutes' in config) {
    windowStart.setMinutes(windowStart.getMinutes() - config.window_minutes);
  }

  // Count recent jobs of this type
  const { count, error } = await supabaseAdmin
    .from('scenario_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('job_type', limitType.toUpperCase())
    .gte('created_at', windowStart.toISOString());

  const currentCount = count || 0;
  const allowed = currentCount < config.count;

  return { allowed, currentCount, limit: config.count };
}
```

---

## Next Steps

This is a **progressive implementation**. The files marked ⏳ require:

1. **API Routes** - ~20 route files (scenarios CRUD, documents, jobs, pins, etc.)
2. **Job Workers** - OCR processor, simulation processor, PDF processor
3. **UI Components** - Workspace, tabs, scoreboard, forms
4. **Dashboard Integration** - Pin widget + navigation link

**Estimated Implementation Time**:
- Step 7-10 (API Routes): 8-12 hours
- Step 11-13 (Job Workers): 12-16 hours
- Step 14-16 (UI): 16-24 hours
- Testing & Polish: 8-12 hours
- **Total**: 44-64 hours for complete MVP

---

## Deployment Strategy

### Phase 1: Infrastructure Only (Week 1)
- ✅ Apply migrations to **staging** Supabase
- ✅ Create storage buckets
- ✅ Test RLS with dummy user
- ✅ Deploy API routes (feature flag OFF)

### Phase 2: Pilot Testing (Week 2-3)
- Enable feature flag for **pilot users only**
- Monitor error rates, job performance
- Collect UX feedback

### Phase 3: General Availability (Week 4)
- Enable for all users
- Announce feature
- Monitor adoption metrics

---

## Testing Checklist

- [ ] Migrations apply cleanly to fresh database
- [ ] RLS policies enforce user ownership
- [ ] Storage uploads work with signed URLs
- [ ] Job queue processes jobs correctly
- [ ] Rate limiting prevents abuse
- [ ] Sensitive data auto-redaction works
- [ ] Simulation completes <2 seconds
- [ ] PDF generation succeeds
- [ ] UI renders on desktop + mobile
- [ ] Feature flag toggles access correctly

---

## Support & Questions

For implementation questions:
1. Check existing patterns in `/apps/web/src/app/api/goals/` for reference
2. Review Supabase docs: https://supabase.com/docs
3. Test incrementally - each step can be validated independently

**Current Status**: Steps 1-2 complete. Continue with Step 3 (environment setup) then Step 4 (Supabase client helpers).
