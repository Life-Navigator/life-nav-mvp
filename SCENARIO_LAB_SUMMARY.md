# Scenario Lab Module - Implementation Summary

## Executive Summary

The **Scenario Lab** module has been designed and partially implemented as a 100% additive feature to LifeNavigator. This module enables users to create "what-if" scenarios, upload documents for OCR extraction, run Monte Carlo simulations to calculate goal success probabilities, commit scenarios to generate roadmaps, and produce PDF reports.

**Status**: Foundation complete, ready for API and UI development.

---

## What Has Been Created

### ✅ Database Layer (3 files)

1. **`supabase/migrations/005_scenario_lab_schema.sql`** (597 lines)
   - 14 new tables with proper relationships, indexes, and triggers
   - Tables: scenario_labs, scenario_versions, scenario_documents, scenario_extracted_fields, scenario_inputs, scenario_sim_runs, scenario_goal_snapshots, plans, plan_phases, plan_tasks, scenario_reports, scenario_pins, scenario_audit_log, scenario_jobs
   - Auto-increment triggers for version numbers
   - Updated_at triggers for timestamp management

2. **`supabase/migrations/006_scenario_lab_rls.sql`** (295 lines)
   - RLS enabled on all 14 tables
   - User-scoped policies (`auth.uid() = user_id`) for SELECT, INSERT, UPDATE, DELETE
   - Immutable records (versions, snapshots, audit logs) have no UPDATE/DELETE policies
   - Append-only audit log

3. **`supabase/migrations/007_scenario_lab_storage.sql`** (76 lines)
   - 2 private storage buckets: `scenario-docs` (10MB limit), `scenario-reports` (50MB limit)
   - Path structure: `{user_id}/{scenario_id}/{filename}`
   - Storage RLS policies for upload, view, delete
   - Signed URLs with 60-minute expiry

**Key Features**:
- Complete reproducibility (inputs_hash, model_version, seed tracking)
- Job queue for async OCR, simulation, PDF generation
- Sensitive data redaction tracking (was_redacted, redaction_reason)
- Audit logging for compliance
- Denormalized progress counters for fast UI

---

### ✅ Type System (2 files)

4. **`src/lib/scenario-lab/types.ts`** (600+ lines)
   - 30+ TypeScript interfaces for all database models
   - 20+ API request/response types
   - Simulator types (inputs, outputs, config)
   - Enums for status values, job types, etc.
   - Fully typed end-to-end

5. **`src/lib/scenario-lab/validation.ts`** (200+ lines)
   - Zod schemas for all API inputs
   - File validation helpers
   - Sensitive data detection patterns (SSN, credit cards)
   - Auto-redaction function (`detectSensitiveData`)
   - Safe input validation for all endpoints

---

### ✅ Utilities (3 files)

6. **`src/lib/scenario-lab/supabase-client.ts`** (150 lines)
   - `supabaseAdmin` - service role client for server operations
   - `supabaseClient` - standard client with RLS
   - Helper functions: `createAuditLog`, `getUploadUrl`, `getDownloadUrl`, `uploadFile`, `deleteFile`
   - Signed URL generation (60min expiry)

7. **`src/lib/scenario-lab/job-queue.ts`** (200 lines)
   - `enqueueJob` - create new job with idempotency
   - `getJob` - fetch job by ID
   - `updateJobStatus` - update job progress
   - `getNextQueuedJob` - worker polling (with concurrency safety)
   - `retryJob` - exponential backoff retry logic
   - `getUserJobs` - list user's jobs with filters
   - `cleanupOldJobs` - maintenance task

8. **`src/lib/scenario-lab/rate-limiter.ts`** (100 lines)
   - Rate limits: uploads (5/hour), simulations (20/15min), PDFs (10/day)
   - `checkRateLimit` - check if user is within limit
   - `enforceRateLimit` - throw error if exceeded
   - Database-backed (no external Redis required)
   - User-friendly error messages with reset time

---

### ✅ Documentation (2 files)

9. **`SCENARIO_LAB_START_HERE.md`** (400 lines)
   - Step-by-step implementation guide
   - File structure overview
   - Environment configuration
   - Validation checklist
   - Progressive rollout strategy

10. **`SCENARIO_LAB_IMPLEMENTATION_ROADMAP.md`** (600 lines)
    - Complete code templates for all 20+ API endpoints
    - Job worker implementation guide
    - OCR extractor patterns
    - Simulator engine design
    - Roadmap generator logic
    - PDF generator approach
    - UI component structure
    - Testing strategy
    - Dependency list
    - Deployment checklist

---

## What Remains to Be Built

### 🔧 API Endpoints (~20 files, ~10-12 hours)

- `/api/scenario-lab/scenarios` - LIST, CREATE
- `/api/scenario-lab/scenarios/[id]` - GET, PATCH, DELETE
- `/api/scenario-lab/scenarios/[id]/versions` - LIST, CREATE
- `/api/scenario-lab/scenarios/[id]/fork` - POST
- `/api/scenario-lab/documents/upload` - POST
- `/api/scenario-lab/documents/[id]/ocr` - POST
- `/api/scenario-lab/fields/approve` - POST
- `/api/scenario-lab/scenarios/[id]/simulate` - POST
- `/api/scenario-lab/scenarios/[id]/results` - GET
- `/api/scenario-lab/scenarios/[id]/commit` - POST
- `/api/scenario-lab/reports/generate` - POST
- `/api/scenario-lab/reports/[id]/download` - GET
- `/api/scenario-lab/pins` - GET, POST, DELETE
- `/api/scenario-lab/jobs/[id]` - GET

**Templates provided in IMPLEMENTATION_ROADMAP.md**

---

### 🧠 Business Logic (~6 files, ~12-16 hours)

**OCR Extraction**:
- `src/lib/scenario-lab/ocr/extractor.ts` - Tesseract.js + pdf-parse integration
- `src/lib/scenario-lab/ocr/patterns.ts` - Pattern matching for pay stubs, bank statements, tuition bills
- `src/lib/scenario-lab/ocr/processor.ts` - Job processor that calls extractor

**Monte Carlo Simulator**:
- `src/lib/scenario-lab/simulator/engine.ts` - Main simulation loop (10k iterations)
- `src/lib/scenario-lab/simulator/monte-carlo.ts` - Seeded RNG, distributions
- `src/lib/scenario-lab/simulator/driver-analysis.ts` - Identify top drivers/risks
- `src/lib/scenario-lab/simulator/processor.ts` - Job processor

**Roadmap Generator**:
- `src/lib/scenario-lab/roadmap/generator.ts` - Generate plans, phases, tasks from scenario
- `src/lib/scenario-lab/roadmap/rules.ts` - Rules for task generation based on goal types

**PDF Generator**:
- `src/lib/scenario-lab/pdf/generator.ts` - jsPDF or Puppeteer implementation
- `src/lib/scenario-lab/pdf/processor.ts` - Job processor

**Worker**:
- `src/workers/scenario-lab-worker.ts` - Main worker loop (polls jobs, dispatches to processors)

---

### 🎨 UI Components (~15 files, ~16-20 hours)

**Pages**:
- `src/app/dashboard/scenario-lab/page.tsx` - Main scenario lab page

**Components**:
- `src/components/scenario-lab/ScenarioCard.tsx` - Scenario preview
- `src/components/scenario-lab/ScenarioWorkspace.tsx` - Tabbed workspace
- `src/components/scenario-lab/DecisionsTab.tsx` - Manual inputs + uploads
- `src/components/scenario-lab/ScoreboardTab.tsx` - Goal probability cards
- `src/components/scenario-lab/RoadmapTab.tsx` - Phases + tasks tree
- `src/components/scenario-lab/ReportsTab.tsx` - PDF list + download
- `src/components/scenario-lab/DocumentUpload.tsx` - Upload UI
- `src/components/scenario-lab/ExtractedFieldsReview.tsx` - Approve/edit UI
- `src/components/scenario-lab/GoalProbabilityCard.tsx` - Expandable goal card
- `src/components/scenario-lab/ProbabilityCurveChart.tsx` - Recharts chart
- `src/components/scenario-lab/forms/ManualInputsForm.tsx` - Input form

**Dashboard Integration**:
- `src/components/dashboard/PinnedScenarioWidget.tsx` - Dashboard pin widget
- Update navigation to add "Scenario Lab" link (feature-flagged)

---

### 🧪 Tests (~3 files, ~8-10 hours)

- `__tests__/scenario-lab/simulator.test.ts` - Simulator unit tests
- `__tests__/scenario-lab/api.test.ts` - API integration tests
- `__tests__/scenario-lab/ocr.test.ts` - OCR extraction tests

---

## Architecture Decisions

### Why Supabase for Scenario Lab?

- **Separate concerns**: Existing goals stay in Prisma, new scenario data in Supabase
- **Built-in storage**: No need for separate S3/GCS setup
- **RLS out of the box**: Security by default
- **Real-time potential**: Future enhancement for live job status updates

### Why Database-Backed Job Queue?

- **Simplicity**: No external message broker (Kafka, RabbitMQ, Redis)
- **Reliability**: PostgreSQL ACID guarantees
- **Observability**: Query jobs table for analytics
- **Concurrency safe**: `SELECT FOR UPDATE SKIP LOCKED` pattern

### Why Monte Carlo Simulation?

- **Accurate uncertainty quantification**: P10/P50/P90 bands
- **Explainable**: Identify which inputs drive success/failure
- **Reproducible**: Seeded RNG for deterministic results
- **Realistic**: Models real-world variability

### Why Job-Based (Not Synchronous)?

- **Prevents timeouts**: OCR/simulation/PDF can take >30 seconds
- **Better UX**: User gets immediate job_id, polls for completion
- **Scalable**: Workers can be horizontally scaled
- **Retryable**: Exponential backoff on failures

---

## Security Features

### Data Protection

✅ **RLS on all tables** - Users can only access their own data
✅ **Signed URLs only** - No direct storage access
✅ **Sensitive data redaction** - Auto-detect SSN, credit cards
✅ **User-approved inputs only** - Simulator reads from `scenario_inputs`, not raw `scenario_extracted_fields`
✅ **Soft deletes** - Users can delete documents + derived fields
✅ **Audit logging** - All actions recorded

### Rate Limiting

✅ **Uploads**: 5 per hour
✅ **Simulations**: 20 per 15 minutes
✅ **PDFs**: 10 per day
✅ **Graceful errors** - Shows current count + reset time

### Compliance

✅ **No PHI/PCI storage** - Only user-approved extracted fields
✅ **Document retention controls** - Users can delete anytime
✅ **Audit trail** - Full action history

---

## Key Features

### ✨ Explore Mode

- Create unlimited scenarios
- Upload documents (bank statements, pay stubs, tuition bills)
- OCR extraction with manual review/approval
- Run simulations to see goal probabilities
- Fork scenarios to try variations
- Compare scenarios side-by-side

### 🎯 Commit Mode

- Lock scenario as read-only
- Auto-generate roadmap (plans, phases, tasks)
- Generate PDF reports
- Track execution progress

### 📊 Scoreboard

- Per-goal probability lines over time
- Status labels: Ahead / On Track / Behind / At Risk
- Explainability: Top 3 drivers + top 3 risks
- Confidence bands (P10/P50/P90)

### 📍 Dashboard Pin

- Pin ONE goal to main dashboard
- Mini probability widget
- Click to open full scenario

---

## Progressive Rollout Plan

### Week 1: Infrastructure
- Apply migrations to staging
- Deploy API endpoints (feature flag OFF)
- Deploy worker (manual testing)

### Week 2-3: Pilot Testing
- Enable for `pilotRole = 'pilot'`
- 5-10 pilot users
- Collect feedback
- Fix critical bugs

### Week 4: General Availability
- Enable for all users (`FEATURE_SCENARIO_LAB_ENABLED=true`)
- Announce feature
- Monitor adoption

---

## Success Metrics

### Technical

- Simulation duration < 2 seconds (10k iterations)
- Job processing < 30 seconds (OCR, PDF)
- Storage costs < $0.50/user/month
- Zero data leaks (RLS working)

### Product

- 40% of users create ≥1 scenario (30 days)
- 70% of scenario creators run simulations
- 30% commit scenarios to roadmap
- High satisfaction scores on explainability

---

## Next Steps

1. **Apply Migrations**
   ```bash
   cd apps/web
   # Run migrations 005, 006, 007 in Supabase
   ```

2. **Add Dependencies**
   ```bash
   pnpm add tesseract.js pdf-parse jspdf
   pnpm add -D @types/pdf-parse
   ```

3. **Start with API Endpoints**
   - Use templates in `SCENARIO_LAB_IMPLEMENTATION_ROADMAP.md`
   - Start with scenarios CRUD (`/api/scenario-lab/scenarios/route.ts`)
   - Test with existing patterns from `/api/goals/`

4. **Deploy Worker**
   - Implement worker loop
   - Test locally: `node src/workers/scenario-lab-worker.ts`
   - Deploy as Cloud Run or cron

5. **Build UI**
   - Follow Tailwind + Framer Motion patterns from existing components
   - Use Recharts for probability curves

---

## Support

- **Documentation**: `SCENARIO_LAB_START_HERE.md` + `SCENARIO_LAB_IMPLEMENTATION_ROADMAP.md`
- **Code Templates**: All API endpoints + worker processors templated
- **Existing Patterns**: Reference `/api/goals/` for REST patterns
- **Estimated Time**: 46-58 hours total remaining work

**Status**: ✅ Foundation complete (~20% done), ready for API + worker development.
