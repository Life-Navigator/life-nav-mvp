

# Scenario Lab - Complete Implementation Roadmap

## Current Status

### ✅ **Phase 1: Foundation (COMPLETED)**

**Created Files** (9 total):
1. `supabase/migrations/005_scenario_lab_schema.sql` - 14 tables, triggers, indexes
2. `supabase/migrations/006_scenario_lab_rls.sql` - RLS policies for all tables
3. `supabase/migrations/007_scenario_lab_storage.sql` - 2 storage buckets + policies
4. `src/lib/scenario-lab/types.ts` - All TypeScript interfaces (~500 lines)
5. `src/lib/scenario-lab/validation.ts` - Zod schemas + sensitive data detection
6. `src/lib/scenario-lab/supabase-client.ts` - Supabase helpers + audit logging
7. `src/lib/scenario-lab/job-queue.ts` - Job queue management
8. `src/lib/scenario-lab/rate-limiter.ts` - Rate limiting
9. `SCENARIO_LAB_START_HERE.md` - Implementation guide

**Ready for**: Database migration + API endpoint development

---

## 📋 **Phase 2: Core API Endpoints (NEXT)**

### Priority: P0 (Must Have for MVP)

Create the following API routes following the existing pattern in `/src/app/api/goals/`:

#### 2.1 Scenarios CRUD

**File**: `src/app/api/scenario-lab/scenarios/route.ts`
```typescript
/**
 * GET  /api/scenario-lab/scenarios - List user scenarios
 * POST /api/scenario-lab/scenarios - Create new scenario
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/jwt';
import { supabaseAdmin, createAuditLog } from '@/lib/scenario-lab/supabase-client';
import { createScenarioSchema } from '@/lib/scenario-lab/validation';

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromJWT(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  let query = supabaseAdmin
    .from('scenario_labs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ scenarios: data || [], total: data?.length || 0 });
}

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromJWT(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const validation = createScenarioSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: validation.error.errors },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from('scenario_labs')
    .insert({
      user_id: userId,
      name: validation.data.name,
      description: validation.data.description,
      icon: validation.data.icon || 'flask',
      color: validation.data.color || '#3B82F6',
      status: 'draft',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await createAuditLog({
    user_id: userId,
    action: 'create_scenario',
    resource_type: 'scenario',
    resource_id: data.id,
    metadata: { ip: request.headers.get('x-forwarded-for') || 'unknown' },
  });

  return NextResponse.json(data, { status: 201 });
}
```

#### 2.2 Scenario Details

**File**: `src/app/api/scenario-lab/scenarios/[id]/route.ts`
```typescript
/**
 * GET    /api/scenario-lab/scenarios/[id] - Get scenario
 * PATCH  /api/scenario-lab/scenarios/[id] - Update scenario
 * DELETE /api/scenario-lab/scenarios/[id] - Delete scenario
 */
// Implementation similar to /api/goals/[id]/route.ts
```

#### 2.3 Versions

**File**: `src/app/api/scenario-lab/scenarios/[id]/versions/route.ts`
```typescript
/**
 * GET  /api/scenario-lab/scenarios/[id]/versions - List versions
 * POST /api/scenario-lab/scenarios/[id]/versions - Create new version
 */
// Creates new scenario_version + scenario_inputs rows
// Computes inputs_hash for reproducibility
```

#### 2.4 Fork

**File**: `src/app/api/scenario-lab/scenarios/[id]/fork/route.ts`
```typescript
/**
 * POST /api/scenario-lab/scenarios/[id]/fork - Fork scenario
 */
// Creates new scenario_labs + copies latest/specified version
```

#### 2.5 Document Upload

**File**: `src/app/api/scenario-lab/documents/upload/route.ts`
```typescript
/**
 * POST /api/scenario-lab/documents/upload - Get signed upload URL
 */
// 1. Check rate limit
// 2. Create signed upload URL
// 3. Return URL + document metadata row (status=pending)
```

**File**: `src/app/api/scenario-lab/documents/[id]/complete/route.ts`
```typescript
/**
 * POST /api/scenario-lab/documents/[id]/complete - Mark upload complete
 */
// Called after client uploads file to signed URL
// Updates document status to 'pending' OCR
```

#### 2.6 OCR Job

**File**: `src/app/api/scenario-lab/documents/[id]/ocr/route.ts`
```typescript
/**
 * POST /api/scenario-lab/documents/[id]/ocr - Enqueue OCR job
 */
import { enqueueJob } from '@/lib/scenario-lab/job-queue';
import { enforceRateLimit } from '@/lib/scenario-lab/rate-limiter';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserIdFromJWT(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Check rate limit
  await enforceRateLimit(userId, 'upload');

  // Get document
  const { data: document } = await supabaseAdmin
    .from('scenario_documents')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', userId)
    .single();

  if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  // Enqueue OCR job
  const job = await enqueueJob({
    userId,
    scenarioId: document.scenario_id,
    jobType: 'OCR',
    inputJson: {
      document_id: document.id,
      storage_path: document.storage_path,
      mime_type: document.mime_type,
    },
  });

  // Update document with job_id
  await supabaseAdmin
    .from('scenario_documents')
    .update({ ocr_job_id: job.id, ocr_status: 'queued' })
    .eq('id', document.id);

  return NextResponse.json({ job_id: job.id, status: job.status });
}
```

#### 2.7 Approve Fields

**File**: `src/app/api/scenario-lab/fields/approve/route.ts`
```typescript
/**
 * POST /api/scenario-lab/fields/approve - Approve extracted fields
 */
// Body: { approvals: [{ field_id, approved, edited_value?, rejected_reason? }] }
// 1. Update scenario_extracted_fields approval_status
// 2. For approved fields, create scenario_inputs rows linked to scenario_version_id
```

#### 2.8 Simulation Job

**File**: `src/app/api/scenario-lab/scenarios/[id]/simulate/route.ts`
```typescript
/**
 * POST /api/scenario-lab/scenarios/[id]/simulate - Enqueue simulation
 */
// Body: { version_id, goal_ids? }
// 1. Check rate limit
// 2. Create scenario_sim_runs row (status=pending)
// 3. Enqueue SIMULATE job
// 4. Return job_id + sim_run_id
```

#### 2.9 Simulation Results

**File**: `src/app/api/scenario-lab/scenarios/[id]/results/route.ts`
```typescript
/**
 * GET /api/scenario-lab/scenarios/[id]/results?sim_run_id=xxx
 */
// Returns scenario_sim_runs + scenario_goal_snapshots
```

#### 2.10 Commit Scenario

**File**: `src/app/api/scenario-lab/scenarios/[id]/commit/route.ts`
```typescript
/**
 * POST /api/scenario-lab/scenarios/[id]/commit - Commit scenario and generate roadmap
 */
// Body: { version_id, plan_name?, plan_description? }
// 1. Mark scenario status='committed'
// 2. Mark version is_committed=true
// 3. Generate plan + phases + tasks
// 4. Return plan with phases/tasks
```

#### 2.11 PDF Job

**File**: `src/app/api/scenario-lab/reports/generate/route.ts`
```typescript
/**
 * POST /api/scenario-lab/reports/generate - Enqueue PDF generation
 */
// Body: { version_id, report_type, title? }
// 1. Check rate limit
// 2. Create scenario_reports row (status=pending)
// 3. Enqueue PDF job
// 4. Return job_id + report_id
```

#### 2.12 Report Download

**File**: `src/app/api/scenario-lab/reports/[id]/download/route.ts`
```typescript
/**
 * GET /api/scenario-lab/reports/[id]/download - Get signed download URL
 */
// Returns signed URL with 60min expiry
```

#### 2.13 Pins

**File**: `src/app/api/scenario-lab/pins/route.ts`
```typescript
/**
 * GET    /api/scenario-lab/pins - Get user's pin
 * POST   /api/scenario-lab/pins - Create/update pin
 * DELETE /api/scenario-lab/pins - Remove pin
 */
```

#### 2.14 Job Status

**File**: `src/app/api/scenario-lab/jobs/[id]/route.ts`
```typescript
/**
 * GET /api/scenario-lab/jobs/[id] - Get job status
 */
// Returns ScenarioJob with current status
// Used for polling from UI
```

---

## 🔧 **Phase 3: Job Workers**

### 3.1 OCR Processor

**File**: `src/lib/scenario-lab/ocr/extractor.ts`

```typescript
/**
 * OCR Extraction Engine
 * Uses Tesseract.js for image OCR + pdf-parse for PDF text extraction
 */

import Tesseract from 'tesseract.js';
import pdfParse from 'pdf-parse';
import { detectSensitiveData } from '../validation';

export async function extractFromPDF(buffer: Buffer): Promise<{
  text: string;
  pageCount: number;
}> {
  const data = await pdfParse(buffer);
  return {
    text: data.text,
    pageCount: data.numpages,
  };
}

export async function extractFromImage(buffer: Buffer): Promise<{
  text: string;
  confidence: number;
}> {
  const result = await Tesseract.recognize(buffer, 'eng');
  return {
    text: result.data.text,
    confidence: result.data.confidence / 100,
  };
}

export async function extractFields(text: string, documentType: string) {
  // Pattern-based extraction
  // Returns array of {field_key, field_value, confidence, source_text}
}
```

**File**: `src/lib/scenario-lab/ocr/patterns.ts`

```typescript
/**
 * Extraction patterns for different document types
 */

export const PATTERNS = {
  pay_stub: {
    gross_pay: /gross\s*pay[:\s]+\$?([\d,]+\.?\d{0,2})/i,
    net_pay: /net\s*pay[:\s]+\$?([\d,]+\.?\d{0,2})/i,
    employer: /^([A-Z][A-Za-z\s&,.]+(?:Inc|LLC|Corp|Ltd)?)/m,
  },
  bank_statement: {
    balance: /(?:balance|ending balance)[:\s]+\$?([\d,]+\.?\d{0,2})/i,
    deposits: /(?:total deposits|deposits)[:\s]+\$?([\d,]+\.?\d{0,2})/i,
  },
  tuition_bill: {
    tuition: /tuition[:\s]+\$?([\d,]+\.?\d{0,2})/i,
    fees: /fees[:\s]+\$?([\d,]+\.?\d{0,2})/i,
    due_date: /due\s*date[:\s]+([\d\/\-]+)/i,
  },
  // Add more patterns...
};
```

### 3.2 Simulation Engine

**File**: `src/lib/scenario-lab/simulator/engine.ts`

```typescript
/**
 * Monte Carlo Simulation Engine
 * Computes goal success probabilities using 10k iterations
 */

export class ScenarioSimulator {
  private seed: number;
  private iterations: number = 10000;

  constructor(seed?: number) {
    this.seed = seed || Date.now();
  }

  async simulate(inputs: SimulatorInputs, goals: GoalInput[]): Promise<SimulatorResult> {
    const results: SimulationOutput[] = [];

    for (const goal of goals) {
      const output = this.simulateGoal(goal, inputs);
      results.push(output);
    }

    const robustnessScore = this.calculateRobustness(results);

    return {
      goals: results,
      overall_robustness_score: robustnessScore,
      metadata: {
        model_version: 'v1.0.0',
        iterations: this.iterations,
        seed: this.seed,
        duration_ms: 0, // Set by caller
      },
    };
  }

  private simulateGoal(goal: GoalInput, inputs: SimulatorInputs): SimulationOutput {
    // Monte Carlo iterations
    // Generate probability series over time
    // Identify drivers and risks
    // Return complete output
  }
}
```

**File**: `src/lib/scenario-lab/simulator/monte-carlo.ts`

```typescript
/**
 * Monte Carlo utilities - seeded random number generation
 */

export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    // Linear congruential generator
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  nextNormal(mean: number, stddev: number): number {
    // Box-Muller transform
  }

  nextBeta(alpha: number, beta: number): number {
    // Beta distribution sampling
  }
}
```

**File**: `src/lib/scenario-lab/simulator/driver-analysis.ts`

```typescript
/**
 * Identify top drivers and risks for explainability
 */

export function identifyDrivers(goal, inputs, probability): Driver[] {
  // Analyze which inputs have highest impact on success probability
  // Return top 3 positive drivers
}

export function identifyRisks(goal, inputs, probability): Risk[] {
  // Analyze constraints, timeline, budget
  // Return top 3 risks
}

export function determineStatus(probability: number): GoalSnapshotStatus {
  if (probability >= 0.8) return 'ahead';
  if (probability >= 0.6) return 'on_track';
  if (probability >= 0.4) return 'behind';
  return 'at_risk';
}
```

### 3.3 Roadmap Generator

**File**: `src/lib/scenario-lab/roadmap/generator.ts`

```typescript
/**
 * Generate plan phases and tasks from committed scenario
 */

export async function generateRoadmap(params: {
  scenarioVersionId: string;
  userId: string;
  planName: string;
  inputs: SimulatorInputs;
  goalSnapshots: ScenarioGoalSnapshot[];
}): Promise<{ plan: Plan; phases: PlanPhase[]; tasks: PlanTask[] }> {
  // 1. Determine timeline from inputs
  // 2. Create 3-5 phases based on goal categories
  // 3. Generate tasks per phase based on goals
  // 4. Return structured roadmap
}
```

### 3.4 PDF Generator

**File**: `src/lib/scenario-lab/pdf/generator.ts`

```typescript
/**
 * PDF Report Generator
 * Uses jsPDF or Puppeteer for server-side PDF generation
 */

import { jsPDF } from 'jspdf';

export async function generatePDF(params: {
  scenario: ScenarioLab;
  version: ScenarioVersion;
  simRun: ScenarioSimRun;
  goalSnapshots: ScenarioGoalSnapshot[];
  plan?: Plan;
}): Promise<Buffer> {
  const pdf = new jsPDF();

  // Page 1: Summary
  // Page 2: Scoreboard
  // Page 3: Roadmap (if committed)
  // Page 4: Drivers & Risks

  return Buffer.from(pdf.output('arraybuffer'));
}
```

### 3.5 Worker Implementation

**File**: `src/workers/scenario-lab-worker.ts`

```typescript
/**
 * Job Worker - Processes queued jobs
 * Can be run as:
 * - Node script: node workers/scenario-lab-worker.ts
 * - Deployed as Cloud Run service
 * - Cron job
 */

import { getNextQueuedJob, updateJobStatus } from '../lib/scenario-lab/job-queue';
import { processOcrJob } from '../lib/scenario-lab/ocr/processor';
import { processSimulationJob } from '../lib/scenario-lab/simulator/processor';
import { processPdfJob } from '../lib/scenario-lab/pdf/processor';

async function processJob(job: ScenarioJob) {
  try {
    let output;

    switch (job.job_type) {
      case 'OCR':
        output = await processOcrJob(job);
        break;
      case 'SIMULATE':
        output = await processSimulationJob(job);
        break;
      case 'PDF':
        output = await processPdfJob(job);
        break;
    }

    await updateJobStatus(job.id, 'completed', { output_json: output });
  } catch (error) {
    await updateJobStatus(job.id, 'failed', {
      error_text: error.message,
    });
  }
}

async function workerLoop() {
  while (true) {
    const job = await getNextQueuedJob();
    if (job) {
      await processJob(job);
    } else {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5s
    }
  }
}

workerLoop();
```

---

## 🎨 **Phase 4: UI Components**

**File Structure**:
```
src/components/scenario-lab/
├── ScenarioCard.tsx              # Scenario preview card
├── ScenarioWorkspace.tsx         # Main workspace with tabs
├── DecisionsTab.tsx              # Manual inputs + document uploads
├── ScoreboardTab.tsx             # Goal probability cards
├── RoadmapTab.tsx                # Phases + tasks tree
├── ReportsTab.tsx                # PDF list + download
├── DocumentUpload.tsx            # Upload UI
├── ExtractedFieldsReview.tsx    # Approve/edit/reject UI
├── GoalProbabilityCard.tsx      # Expandable goal card with chart
├── ProbabilityCurveChart.tsx    # Recharts line chart
└── forms/
    ├── ManualInputsForm.tsx     # Timeline, budget, constraints
    └── ...
```

**File**: `src/app/dashboard/scenario-lab/page.tsx`
```typescript
'use client';

export default function ScenarioLabPage() {
  // List scenarios
  // Show workspace for selected scenario
}
```

**File**: `src/components/dashboard/PinnedScenarioWidget.tsx`
```typescript
'use client';

export function PinnedScenarioWidget() {
  // Fetch pin via /api/scenario-lab/pins
  // Display goal probability + status
  // Click → navigate to scenario-lab
}
```

---

## 🧪 **Phase 5: Testing**

**File**: `__tests__/scenario-lab/simulator.test.ts`
```typescript
import { ScenarioSimulator } from '@/lib/scenario-lab/simulator/engine';

describe('ScenarioSimulator', () => {
  it('should produce reproducible results with same seed', () => {
    // Test determinism
  });

  it('should generate probability series over time', () => {
    // Test output structure
  });

  it('should identify top drivers and risks', () => {
    // Test explainability
  });
});
```

**File**: `__tests__/scenario-lab/api.test.ts`
```typescript
describe('Scenario Lab API', () => {
  it('should create scenario', () => {
    // POST /api/scenario-lab/scenarios
  });

  it('should enqueue and process OCR job', () => {
    // Upload → OCR → extract → approve flow
  });
});
```

---

## 📦 Dependencies to Add

Add to `apps/web/package.json`:
```json
{
  "dependencies": {
    "tesseract.js": "^5.0.0",
    "pdf-parse": "^1.1.1",
    "jspdf": "^2.5.0"
  },
  "devDependencies": {
    "@types/pdf-parse": "^1.1.0"
  }
}
```

---

## 🚀 Deployment Checklist

- [ ] Apply migrations to staging Supabase
- [ ] Test RLS policies with test users
- [ ] Deploy API endpoints (feature flag OFF)
- [ ] Deploy worker (as Cloud Run or manual script)
- [ ] Enable for pilot users
- [ ] Monitor job queue performance
- [ ] Enable for all users

---

## Estimated Timeline

- **API Endpoints**: 10-12 hours
- **Job Workers**: 12-16 hours
- **UI Components**: 16-20 hours
- **Testing**: 8-10 hours
- **Total**: 46-58 hours

The foundation is complete. Continue with API endpoints next.
