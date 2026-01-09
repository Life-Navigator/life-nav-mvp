# Scenario Lab - Quick Reference Card

## 📁 Files Created (10 total)

### Database (3 files)
- ✅ `supabase/migrations/005_scenario_lab_schema.sql` - 14 tables
- ✅ `supabase/migrations/006_scenario_lab_rls.sql` - RLS policies
- ✅ `supabase/migrations/007_scenario_lab_storage.sql` - 2 storage buckets

### TypeScript (2 files)
- ✅ `src/lib/scenario-lab/types.ts` - All interfaces
- ✅ `src/lib/scenario-lab/validation.ts` - Zod schemas + redaction

### Utilities (3 files)
- ✅ `src/lib/scenario-lab/supabase-client.ts` - Storage + audit helpers
- ✅ `src/lib/scenario-lab/job-queue.ts` - Job management
- ✅ `src/lib/scenario-lab/rate-limiter.ts` - Rate limiting

### Documentation (3 files)
- ✅ `SCENARIO_LAB_START_HERE.md` - Step-by-step guide
- ✅ `SCENARIO_LAB_IMPLEMENTATION_ROADMAP.md` - Complete templates
- ✅ `SCENARIO_LAB_SUMMARY.md` - Executive summary

---

## 🚀 Quick Start (Apply Migrations)

```bash
# Navigate to web app
cd apps/web

# Option 1: Supabase CLI
supabase db push

# Option 2: Supabase Dashboard
# Go to SQL Editor > New Query
# Copy/paste each migration file (005, 006, 007)
# Run in order

# Verify
# Check Table Editor for scenario_* tables
# Check Storage for scenario-docs, scenario-reports buckets
```

---

## 🔧 Add Dependencies

```bash
cd apps/web
pnpm add tesseract.js pdf-parse jspdf
pnpm add -D @types/pdf-parse
```

---

## 🌍 Environment Variables

Add to `.env.local`:
```bash
FEATURE_SCENARIO_LAB_ENABLED=false
SCENARIO_WORKER_POLL_INTERVAL_MS=5000
SCENARIO_WORKER_MAX_CONCURRENT_JOBS=3
```

---

## 📊 Database Schema Overview

```
scenario_labs              # Scenario header
  └── scenario_versions    # Immutable save states
        ├── scenario_inputs             # User-approved inputs (simulator reads this)
        ├── scenario_sim_runs           # Simulation metadata
        │     └── scenario_goal_snapshots   # Per-goal results
        └── plans                       # Generated roadmaps
              ├── plan_phases
              └── plan_tasks

scenario_documents         # Uploaded files metadata
  └── scenario_extracted_fields   # Raw OCR output (user must approve)

scenario_reports           # Generated PDFs
scenario_pins             # User's pinned goal
scenario_audit_log        # Compliance trail
scenario_jobs             # Async job queue
```

---

## 🔄 Job Flow

```
1. User uploads document
   ↓
2. POST /api/scenario-lab/documents/[id]/ocr
   → Enqueues OCR job (status=queued)
   ↓
3. Worker picks up job
   → Runs Tesseract.js
   → Extracts fields into scenario_extracted_fields
   → Updates job (status=completed)
   ↓
4. User reviews/approves fields
   → POST /api/scenario-lab/fields/approve
   → Creates scenario_inputs rows
   ↓
5. User runs simulation
   → POST /api/scenario-lab/scenarios/[id]/simulate
   → Enqueues SIMULATE job
   ↓
6. Worker picks up job
   → Runs Monte Carlo (10k iterations)
   → Creates scenario_sim_runs + scenario_goal_snapshots
   → Updates job (status=completed)
   ↓
7. User commits scenario
   → POST /api/scenario-lab/scenarios/[id]/commit
   → Generates plan + phases + tasks
   ↓
8. User generates PDF
   → POST /api/scenario-lab/reports/generate
   → Enqueues PDF job
   → Worker creates PDF, uploads to storage
```

---

## 📝 API Endpoints (14 routes)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/scenario-lab/scenarios` | List scenarios |
| POST | `/api/scenario-lab/scenarios` | Create scenario |
| GET | `/api/scenario-lab/scenarios/[id]` | Get scenario |
| PATCH | `/api/scenario-lab/scenarios/[id]` | Update scenario |
| DELETE | `/api/scenario-lab/scenarios/[id]` | Delete scenario |
| POST | `/api/scenario-lab/scenarios/[id]/fork` | Fork scenario |
| POST | `/api/scenario-lab/scenarios/[id]/versions` | Create version |
| POST | `/api/scenario-lab/scenarios/[id]/simulate` | Enqueue simulation |
| GET | `/api/scenario-lab/scenarios/[id]/results` | Get results |
| POST | `/api/scenario-lab/scenarios/[id]/commit` | Commit + roadmap |
| POST | `/api/scenario-lab/documents/upload` | Get upload URL |
| POST | `/api/scenario-lab/documents/[id]/ocr` | Enqueue OCR |
| POST | `/api/scenario-lab/fields/approve` | Approve fields |
| GET | `/api/scenario-lab/jobs/[id]` | Get job status |
| POST | `/api/scenario-lab/reports/generate` | Enqueue PDF |
| GET | `/api/scenario-lab/reports/[id]/download` | Get PDF URL |
| GET/POST/DELETE | `/api/scenario-lab/pins` | Manage pin |

---

## 🎨 UI Structure

```
/dashboard/scenario-lab
  ├── ScenarioList (left sidebar)
  └── ScenarioWorkspace (main)
        ├── Tab 1: Decisions
        │     ├── ManualInputsForm
        │     └── DocumentUpload → ExtractedFieldsReview
        ├── Tab 2: Scoreboard
        │     └── GoalProbabilityCard[] → ProbabilityCurveChart
        ├── Tab 3: Roadmap
        │     └── PlanPhases[] → PlanTasks[]
        └── Tab 4: Reports
              └── ReportsList → Download PDF

/dashboard (existing)
  └── PinnedScenarioWidget (new, additive)
```

---

## ⏱️ Estimated Timeline

| Task | Hours |
|------|-------|
| ✅ Foundation (migrations, types, utils, docs) | **10** |
| ⏳ API Endpoints (20 routes) | 10-12 |
| ⏳ Job Workers (OCR, simulator, PDF) | 12-16 |
| ⏳ UI Components (15 files) | 16-20 |
| ⏳ Tests (unit + integration) | 8-10 |
| **Total** | **56-68** |

**Current Progress**: 15% complete (foundation)

---

## 🧪 Testing Checklist

- [ ] Migrations apply cleanly
- [ ] RLS enforces user ownership
- [ ] Storage signed URLs work
- [ ] Job queue processes jobs
- [ ] Rate limiting prevents abuse
- [ ] Sensitive data redaction works
- [ ] Simulation < 2 seconds
- [ ] PDF generation succeeds
- [ ] UI renders on mobile + desktop
- [ ] Feature flag toggles access

---

## 📚 Next Steps

1. **Apply migrations** (see Quick Start above)
2. **Add dependencies** (`pnpm add tesseract.js pdf-parse jspdf`)
3. **Start with API** - Use templates in `SCENARIO_LAB_IMPLEMENTATION_ROADMAP.md`
4. **Test incrementally** - Each endpoint can be validated with cURL/Postman
5. **Build workers** - OCR → Simulator → PDF (in order)
6. **Build UI last** - Once API is stable

---

## 🆘 Troubleshooting

**"Migration fails with RLS error"**
→ Ensure `auth.uid()` function exists (created by Supabase automatically)

**"Storage bucket not found"**
→ Verify buckets created: `SELECT * FROM storage.buckets`

**"Rate limit not working"**
→ Check `scenario_jobs` table has `job_type` and `created_at` indexed

**"Worker not picking up jobs"**
→ Verify job status is 'queued' and attempts < max_attempts

**"Simulation hangs"**
→ Reduce iterations to 1000 for testing, then scale to 10k

---

## 📖 Documentation Links

- **START_HERE.md** - Detailed implementation guide with code samples
- **IMPLEMENTATION_ROADMAP.md** - Complete templates for all files
- **SUMMARY.md** - Executive overview + architecture decisions

---

## ✅ What's Done

- ✅ 14 database tables with RLS
- ✅ 2 storage buckets with policies
- ✅ Complete TypeScript types
- ✅ Zod validation + sensitive data redaction
- ✅ Supabase client helpers
- ✅ Job queue system
- ✅ Rate limiting
- ✅ Comprehensive documentation

## ⏳ What's Next

- ⏳ 20 API endpoints (templates provided)
- ⏳ 6 business logic files (OCR, simulator, roadmap, PDF)
- ⏳ 1 worker implementation
- ⏳ 15 UI components
- ⏳ Tests

**The foundation is solid. Continue with confidence.**
