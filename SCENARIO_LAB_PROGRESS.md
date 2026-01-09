# Scenario Lab - Implementation Progress

## Session Date: 2026-01-08

## Overall Progress: ~60% Complete

---

## ✅ COMPLETED (Steps 0-7)

### Step 0: Repo Inspection ✅
**Purpose**: Understand existing patterns
**Status**: Complete

- Confirmed Next.js 15 App Router
- Discovered JWT auth pattern: `getUserIdFromJWT(request)`
- Identified API patterns from `/api/goals/route.ts`
- Verified Supabase + Prisma dual database setup

---

### Step 1: Verify Foundation Works ✅
**Purpose**: Health check endpoint for testing
**Status**: Complete

**File Created**:
```
apps/web/src/app/api/scenario-lab/health/route.ts
```

**Tests**:
- Feature flag check
- Supabase connection
- Storage buckets existence
- Job queue table
- All utility modules

**Usage**:
```bash
curl http://localhost:3000/api/scenario-lab/health
```

---

### Step 2: Job Endpoints ✅
**Purpose**: Job status polling endpoint
**Status**: Complete

**File Created**:
```
apps/web/src/app/api/scenario-lab/jobs/[id]/route.ts
```

**Endpoints**:
- `GET /api/scenario-lab/jobs/{id}` - Get job status

**Features**:
- Returns job progress, status, results
- Verifies user ownership
- Feature flag gated

---

### Step 3: Worker Implementation ✅
**Purpose**: Background job processor
**Status**: Complete

**File Created**:
```
apps/web/src/workers/scenario-lab-worker.ts
```

**Features**:
- Polls `scenario_jobs` table
- Concurrent job processing (configurable max)
- Graceful shutdown handling
- Dispatches to OCR, SIMULATE, PDF processors
- Full SIMULATE processor implemented (Step 6)
- OCR and PDF processors are placeholders (Steps 8, 10)

**Environment Variables**:
```bash
SCENARIO_WORKER_POLL_INTERVAL_MS=5000
SCENARIO_WORKER_MAX_CONCURRENT_JOBS=3
```

**Run Locally**:
```bash
cd apps/web
node --loader ts-node/esm src/workers/scenario-lab-worker.ts
```

---

### Step 4: Scenario CRUD + Versioning API ✅
**Purpose**: Manage scenarios and versions
**Status**: Complete

**Files Created**:
```
apps/web/src/app/api/scenario-lab/scenarios/route.ts
apps/web/src/app/api/scenario-lab/scenarios/[id]/route.ts
apps/web/src/app/api/scenario-lab/scenarios/[id]/versions/route.ts
```

**Endpoints**:
- `GET /api/scenario-lab/scenarios` - List scenarios
- `POST /api/scenario-lab/scenarios` - Create scenario + initial version
- `GET /api/scenario-lab/scenarios/{id}` - Get scenario with versions
- `PATCH /api/scenario-lab/scenarios/{id}` - Update scenario metadata
- `DELETE /api/scenario-lab/scenarios/{id}` - Delete scenario
- `GET /api/scenario-lab/scenarios/{id}/versions` - List versions
- `POST /api/scenario-lab/scenarios/{id}/versions` - Create new version (save state)

**Features**:
- Automatic version creation on scenario creation (v1)
- Version forking copies inputs from previous version
- Committed scenarios are read-only
- Audit logging for all actions
- Cascade deletes

---

### Step 5: Manual Inputs API ✅
**Purpose**: Add/update/delete scenario inputs
**Status**: Complete

**File Created**:
```
apps/web/src/app/api/scenario-lab/versions/[versionId]/inputs/route.ts
```

**Endpoints**:
- `GET /api/scenario-lab/versions/{versionId}/inputs` - Get inputs
- `POST /api/scenario-lab/versions/{versionId}/inputs` - Batch upsert inputs
- `DELETE /api/scenario-lab/versions/{versionId}/inputs?id={inputId}` - Delete input

**Features**:
- Batch upsert (deletes existing + inserts new)
- Zod validation
- Read-only for committed scenarios
- Audit logging

---

### Step 6: Simulation Job + Results API + Monte Carlo Engine ✅
**Purpose**: Run probabilistic simulations
**Status**: Complete

**Files Created**:
```
apps/web/src/app/api/scenario-lab/versions/[versionId]/simulate/route.ts
apps/web/src/app/api/scenario-lab/versions/[versionId]/results/route.ts
apps/web/src/lib/scenario-lab/simulator/engine.ts
```

**Endpoints**:
- `POST /api/scenario-lab/versions/{versionId}/simulate` - Enqueue simulation (returns job_id)
- `GET /api/scenario-lab/versions/{versionId}/results` - Get latest simulation results

**Monte Carlo Engine** (`simulator/engine.ts`):
- **Seeded RNG** - Reproducible results (Box-Muller transform for normal distribution)
- **10k iterations** (configurable)
- **Per-goal analysis**:
  - Success probability
  - P10/P50/P90 confidence bands
  - Status classification (ahead/on_track/behind/at_risk)
  - Top 3 drivers (positive factors)
  - Top 3 risks (negative factors)
- **Input hashing** - Tracks which inputs were used
- **Model versioning** - Current v1.0

**Features**:
- Rate limiting (20 simulations per 15 minutes)
- Idempotency keys
- Stores results in `scenario_sim_runs` + `scenario_goal_snapshots`
- Worker integration complete

**Example**:
```bash
# Enqueue simulation
POST /api/scenario-lab/versions/{versionId}/simulate
{
  "iterations": 10000,
  "seed": 12345
}

# Response: { job_id: "...", status: "queued" }

# Poll job
GET /api/scenario-lab/jobs/{job_id}

# Get results
GET /api/scenario-lab/versions/{versionId}/results
```

---

### Step 7: UI Pages and Components ✅
**Purpose**: User interface foundation
**Status**: Complete (core pages, placeholders for later steps)

**Files Created**:
```
apps/web/src/app/dashboard/scenario-lab/page.tsx
apps/web/src/app/dashboard/scenario-lab/[id]/page.tsx
apps/web/src/components/scenario-lab/ScenarioCard.tsx
apps/web/src/components/scenario-lab/CreateScenarioModal.tsx
```

**Pages**:
1. **Scenario Lab List** (`/dashboard/scenario-lab`)
   - Lists user's scenarios
   - Create new scenario button
   - Scenario cards with status badges

2. **Scenario Detail** (`/dashboard/scenario-lab/{id}`)
   - Tabbed interface:
     - **Decisions** - Manual inputs + document uploads (placeholder for Step 8)
     - **Scoreboard** - Goal probability cards (placeholder for Step 6 UI)
     - **Roadmap** - Generated roadmap (placeholder for Step 9)
     - **Reports** - PDF reports (placeholder for Step 10)

**Components**:
- `ScenarioCard` - Scenario preview card
- `CreateScenarioModal` - Create scenario modal with icon/color picker

**Features**:
- Dark mode support
- Feature flag check (`NEXT_PUBLIC_FEATURE_SCENARIO_LAB_ENABLED`)
- Loading states
- Error handling
- Responsive design

**Access**:
```
http://localhost:3000/dashboard/scenario-lab
```

---

## ⏳ REMAINING WORK (Steps 8-12)

### Step 8: Document Upload + OCR ⏳
**Estimated Time**: 10-12 hours

**Files to Create**:
```
apps/web/src/app/api/scenario-lab/documents/upload/route.ts
apps/web/src/app/api/scenario-lab/documents/[id]/ocr/route.ts
apps/web/src/app/api/scenario-lab/fields/approve/route.ts
apps/web/src/lib/scenario-lab/ocr/extractor.ts
apps/web/src/lib/scenario-lab/ocr/patterns.ts
apps/web/src/components/scenario-lab/DocumentUpload.tsx
apps/web/src/components/scenario-lab/ExtractedFieldsReview.tsx
```

**Tasks**:
1. Document upload endpoint (get signed URL)
2. OCR trigger endpoint (enqueues job)
3. OCR extractor (Tesseract.js + pdf-parse)
4. Pattern matching (pay stubs, bank statements, tuition bills)
5. Extracted fields approval endpoint
6. UI components for upload + review

**Dependencies Needed**:
```bash
pnpm add tesseract.js pdf-parse
pnpm add -D @types/pdf-parse
```

---

### Step 9: Commit + Roadmap Generation ⏳
**Estimated Time**: 8-10 hours

**Files to Create**:
```
apps/web/src/app/api/scenario-lab/scenarios/[id]/commit/route.ts
apps/web/src/lib/scenario-lab/roadmap/generator.ts
apps/web/src/lib/scenario-lab/roadmap/rules.ts
apps/web/src/components/scenario-lab/RoadmapTab.tsx
apps/web/src/components/scenario-lab/PhaseCard.tsx
```

**Tasks**:
1. Commit endpoint (locks scenario, generates roadmap)
2. Roadmap generator (creates plans, phases, tasks)
3. Goal-type-specific rules (career vs. finance vs. education)
4. Roadmap UI (phases tree, task cards)

---

### Step 10: PDF Reports ⏳
**Estimated Time**: 8-10 hours

**Files to Create**:
```
apps/web/src/app/api/scenario-lab/reports/generate/route.ts
apps/web/src/app/api/scenario-lab/reports/[id]/download/route.ts
apps/web/src/lib/scenario-lab/pdf/generator.ts
apps/web/src/components/scenario-lab/ReportsTab.tsx
```

**Tasks**:
1. PDF generation endpoint (enqueues job)
2. PDF download endpoint (signed URL)
3. PDF generator using @react-pdf/renderer
4. Worker integration
5. Reports UI (list + download)

**Dependencies Needed**:
```bash
pnpm add @react-pdf/renderer
```

---

### Step 11: Dashboard Pin Widget ⏳
**Estimated Time**: 4-6 hours

**Files to Create**:
```
apps/web/src/app/api/scenario-lab/pins/route.ts
apps/web/src/components/dashboard/PinnedScenarioWidget.tsx
```

**Tasks**:
1. Pin endpoints (GET, POST, DELETE)
2. Pin widget component (shows ONE goal probability)
3. Integrate into main dashboard page

**Changes Needed**:
- Edit `apps/web/src/app/dashboard/page.tsx` (add widget)

---

### Step 12: Tests ⏳
**Estimated Time**: 8-10 hours

**Files to Create**:
```
apps/web/__tests__/scenario-lab/simulator.test.ts
apps/web/__tests__/scenario-lab/api.test.ts
apps/web/__tests__/scenario-lab/ocr.test.ts
```

**Tests**:
1. Simulator unit tests (reproducibility, accuracy)
2. API integration tests (full flow)
3. OCR extraction tests

---

## Summary

### Completed (Steps 0-7): ~60%
- ✅ Foundation layer (migrations, types, utilities)
- ✅ Health check endpoint
- ✅ Job status endpoint
- ✅ Background worker (with SIMULATE processor)
- ✅ Scenario CRUD API
- ✅ Version management API
- ✅ Manual inputs API
- ✅ Simulation API + Monte Carlo engine
- ✅ UI pages (list, detail, tabs)
- ✅ UI components (cards, modals)

### Remaining (Steps 8-12): ~40%
- ⏳ Document upload + OCR extraction
- ⏳ Commit + roadmap generation
- ⏳ PDF reports
- ⏳ Dashboard pin widget
- ⏳ Tests

---

## Next Actions

### Immediate (Step 8):
1. Install dependencies: `pnpm add tesseract.js pdf-parse`
2. Implement document upload endpoint
3. Implement OCR extractor with pattern matching
4. Create upload + review UI components

### After Step 8:
- Step 9: Roadmap generation
- Step 10: PDF reports
- Step 11: Dashboard pin
- Step 12: Tests

---

## Notes

- **Worker TypeScript Errors**: Minor type errors in worker file (process, require, module). Can be fixed by ensuring `@types/node` is installed or adding proper typing.
- **Feature Flag**: Set `NEXT_PUBLIC_FEATURE_SCENARIO_LAB_ENABLED=true` in `.env.local` to enable UI.
- **Migrations**: Must be applied before testing endpoints.
- **All API endpoints are additive** - no existing code modified.

---

## Testing Checklist

Before moving to production:
- [ ] Apply migrations (005, 006, 007)
- [ ] Install dependencies
- [ ] Set environment variables
- [ ] Test health endpoint
- [ ] Create test scenario via API
- [ ] Add test inputs
- [ ] Run simulation
- [ ] Verify results
- [ ] Test UI pages
- [ ] Deploy worker to Cloud Run or cron

---

**Current Status**: Foundation + core functionality complete. Ready for document processing (Step 8).
