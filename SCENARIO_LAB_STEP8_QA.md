# Scenario Lab - Step 8 QA Test Script

## Document Upload + OCR + Field Approval

### Prerequisites
1. ✅ Migrations 005, 006, 007 applied to Supabase
2. ✅ Dependencies installed:
   ```bash
   cd apps/web
   pnpm add tesseract.js pdf-parse
   pnpm add -D @types/pdf-parse @types/node
   ```
3. ✅ Environment variables set in `.env.local`:
   ```
   FEATURE_SCENARIO_LAB_ENABLED=true
   NEXT_PUBLIC_FEATURE_SCENARIO_LAB_ENABLED=true
   SCENARIO_WORKER_POLL_INTERVAL_MS=5000
   SCENARIO_WORKER_MAX_CONCURRENT_JOBS=3
   ```
4. ✅ Worker running (in separate terminal):
   ```bash
   cd apps/web
   npx tsx src/workers/scenario-lab-worker.ts
   ```

---

## Test Flow 1: PDF Upload → OCR → Review → Approve

### Step 1: Create Scenario
1. Navigate to `/dashboard/scenario-lab`
2. Click "+ New Scenario"
3. Enter:
   - Name: "Test OCR Flow"
   - Description: "Testing document upload and field extraction"
   - Pick an icon and color
4. Click "Create Scenario"
5. ✅ **Verify**: Scenario appears in list

### Step 2: Navigate to Decisions Tab
1. Click on the scenario card
2. ✅ **Verify**: Lands on scenario detail page
3. ✅ **Verify**: Decisions tab is active (first tab)
4. ✅ **Verify**: "Upload Document" section visible
5. ✅ **Verify**: "Document Library" section visible (empty)

### Step 3: Upload PDF Document
1. Prepare a test PDF with financial data (or create one with:)
   ```
   Tuition: $25,000
   Scholarship: $5,000
   Annual Salary: $75,000
   Loan Balance: $10,000
   APR: 4.5%
   ```
2. Click "Choose File" button
3. Select PDF file
4. ✅ **Verify**: Upload progress bar appears
5. ✅ **Verify**: Upload completes (100%)
6. ✅ **Verify**: Document appears in library with "Uploaded" status

### Step 4: Trigger OCR
1. Find the uploaded document in the library
2. Click "Extract Fields" button
3. ✅ **Verify**: Alert shows "OCR job enqueued"
4. ✅ **Verify**: Document status changes to "Queued"
5. Wait 5-10 seconds
6. Click "🔄 Refresh" button
7. ✅ **Verify**: Document status changes to "Processing" or "Ready"

### Step 5: Monitor Worker Logs
1. In worker terminal, check for:
   ```
   [Worker] Picked up job <job_id> (OCR)
   [Worker] Processing OCR job <job_id>
   [Worker] OCR extraction for document <doc_id>
   [Worker] Downloaded file, size: <bytes> bytes
   [Worker] Extracted <N> fields in <ms>ms
   [Worker] OCR completed, <N> fields stored
   [Worker] Job <job_id> completed successfully
   ```
2. ✅ **Verify**: No errors in worker logs
3. ✅ **Verify**: Job completes successfully

### Step 6: Review Extracted Fields
1. In UI, refresh if needed
2. Document should show "Ready" status
3. Click "Review Fields" button
4. ✅ **Verify**: Modal opens with "Review Extracted Fields" title
5. ✅ **Verify**: Fields are grouped by category (Education, Career, Debt, etc.)
6. ✅ **Verify**: Each field shows:
   - Field name (tuition, apr, etc.)
   - Confidence badge (High/Medium/Low)
   - Editable value input
   - Source context (snippet from PDF)
7. ✅ **Verify**: Redacted fields show "Redacted" badge (if any SSN/CC present)

### Step 7: Approve Fields
1. Check checkboxes for fields to approve (e.g., tuition, scholarship, salary)
2. Edit a field value (e.g., change tuition from $25,000 to $26,000)
3. ✅ **Verify**: Selected count updates at bottom
4. Click "Approve X Fields" button
5. ✅ **Verify**: "Approving..." button text appears
6. ✅ **Verify**: Success alert shows "X fields approved and added to scenario!"
7. ✅ **Verify**: Modal closes
8. ✅ **Verify**: Alert suggests running simulation

### Step 8: Verify Inputs Were Stored
Use Supabase Dashboard or API to verify:

```bash
# Query scenario_inputs
curl http://localhost:3000/api/scenario-lab/versions/{versionId}/inputs \
  -H "Authorization: Bearer {token}"
```

✅ **Verify**: Approved fields appear in scenario_inputs table with:
- `source: 'extracted'`
- `confidence: 0.6-1.0`
- Edited values if modified

---

## Test Flow 2: Image Upload → OCR

### Step 1: Upload JPG/PNG Image
1. Create or use an image with text (screenshot of a pay stub, bank statement)
2. Upload via "Choose File"
3. ✅ **Verify**: Upload succeeds
4. ✅ **Verify**: File type shown as "jpg" or "png"

### Step 2: Extract Fields from Image
1. Click "Extract Fields"
2. Wait for OCR (may take 10-20 seconds for Tesseract)
3. Check worker logs for:
   ```
   [Worker] OCR extraction for document <doc_id>
   [Worker] Extracted <N> fields in <ms>ms
   ```
4. ✅ **Verify**: Fields extracted
5. ✅ **Verify**: extraction_method = "ocr_image" (check database)

---

## Test Flow 3: Rate Limiting

### Step 1: Upload Multiple Files Quickly
1. Try to upload 6 files within 1 hour
2. ✅ **Verify**: 6th upload fails with:
   ```
   Status: 429
   Error: "Rate limit exceeded..."
   ```
3. ✅ **Verify**: Error message shows "current count" and "reset time"

---

## Test Flow 4: Sensitive Data Redaction

### Step 1: Upload Document with SSN
1. Create PDF with text:
   ```
   SSN: 123-45-6789
   Credit Card: 4111-1111-1111-1111
   Salary: $50,000
   ```
2. Upload and extract fields
3. Review extracted fields
4. ✅ **Verify**: SSN field shows "XXX-XX-XXXX"
5. ✅ **Verify**: Credit card shows "XXXX-XXXX-XXXX-XXXX"
6. ✅ **Verify**: "Redacted" badge appears
7. ✅ **Verify**: Redaction reason shown (e.g., "SSN, CREDIT_CARD")
8. ✅ **Verify**: `was_redacted = true` in database
9. ✅ **Verify**: `confidence_score = 0` for fully redacted fields (not usable)

---

## Test Flow 5: Run Simulation with Approved Fields

### Step 1: Approve Fields
1. Approve tuition, salary, and loan fields
2. ✅ **Verify**: Fields added to scenario_inputs

### Step 2: Run Simulation
1. Navigate to Scoreboard tab (or use API)
2. Trigger simulation:
   ```bash
   POST /api/scenario-lab/versions/{versionId}/simulate
   {
     "iterations": 10000,
     "seed": 12345
   }
   ```
3. ✅ **Verify**: Simulation job enqueued
4. Wait for completion
5. ✅ **Verify**: Results reflect approved field values

### Step 3: Verify Simulator Uses Only Approved Inputs
1. Check `scenario_sim_runs.inputs_hash`
2. ✅ **Verify**: Hash matches approved inputs (not extracted_fields)

---

## Test Flow 6: Idempotency

### Step 1: Re-run OCR on Same Document
1. Click "Extract Fields" again on a document
2. ✅ **Verify**: New job enqueued
3. ✅ **Verify**: Old extracted_fields deleted
4. ✅ **Verify**: New fields inserted
5. ✅ **Verify**: No duplicate fields

---

## Test Flow 7: Error Handling

### Step 1: Upload Invalid File Type
1. Try to upload .exe or .zip file
2. ✅ **Verify**: Error: "Invalid file type. Allowed: PDF, PNG, JPG, WEBP"

### Step 2: Upload File Too Large
1. Try to upload >10MB file
2. ✅ **Verify**: Error: "File too large. Maximum size: 10MB"

### Step 3: OCR Failure (Corrupted PDF)
1. Upload corrupted/encrypted PDF
2. Trigger OCR
3. ✅ **Verify**: Worker logs error
4. ✅ **Verify**: Document status = "failed"
5. ✅ **Verify**: Job status = "failed"
6. ✅ **Verify**: "Retry" button appears in UI

---

## Performance Benchmarks

| Operation | Target | Acceptable |
|-----------|--------|------------|
| File upload (client→server) | <2s | <5s |
| PDF text extraction (10 pages) | <1s | <3s |
| Image OCR (1 page, Tesseract) | <5s | <15s |
| Field extraction (pattern matching) | <500ms | <1s |
| Field approval API | <500ms | <1s |
| Total flow (upload→OCR→approve) | <10s PDF | <20s image |

---

## Security Checklist

- ✅ All endpoints require authentication
- ✅ Feature flag enforced
- ✅ RLS policies prevent cross-user access
- ✅ Rate limiting prevents abuse
- ✅ Sensitive data redacted before storage
- ✅ Only approved fields affect simulation
- ✅ Storage uses signed URLs (60min expiry)
- ✅ File type validation (MIME + extension)
- ✅ File size validation (<10MB)
- ✅ No executable files allowed
- ✅ Audit logs created for all actions

---

## Database Verification

### Check Document Record
```sql
SELECT id, filename, ocr_status, created_at
FROM scenario_documents
WHERE user_id = '{user_id}'
ORDER BY created_at DESC
LIMIT 5;
```

### Check Extracted Fields
```sql
SELECT field_key, field_value, confidence_score, was_redacted, approval_status
FROM scenario_extracted_fields
WHERE document_id = '{document_id}'
ORDER BY field_key;
```

### Check Approved Inputs
```sql
SELECT goal_id, field_name, field_value, source, confidence
FROM scenario_inputs
WHERE version_id = '{version_id}'
AND source = 'extracted';
```

### Check Jobs
```sql
SELECT id, job_type, status, progress, created_at, completed_at
FROM scenario_jobs
WHERE user_id = '{user_id}'
AND job_type = 'OCR'
ORDER BY created_at DESC
LIMIT 10;
```

---

## Success Criteria

✅ **PASS** if:
1. User can upload PDF/image
2. OCR job runs in worker
3. Fields extracted with confidence scores
4. Sensitive data redacted
5. User can review and edit fields
6. Approved fields written to scenario_inputs
7. Simulation uses only approved inputs
8. Rate limiting works
9. All security checks pass
10. No errors in worker logs

❌ **FAIL** if:
- Uploads fail silently
- OCR never completes
- Worker crashes
- Sensitive data stored unredacted
- Simulation uses unapproved fields
- RLS violations
- User can access other users' documents

---

## Troubleshooting

**Issue**: Upload fails with "Failed to get upload URL"
**Fix**: Check Supabase storage buckets exist. Run migration 007.

**Issue**: OCR job stays "queued" forever
**Fix**: Check worker is running. Check job_queue code for errors.

**Issue**: No fields extracted
**Fix**: Check PDF has text layer. Check pattern matching in ocr/patterns.ts.

**Issue**: Fields not appearing in simulation
**Fix**: Verify fields were approved, not just extracted. Check scenario_inputs table.

**Issue**: TypeScript errors in worker
**Fix**: Install `@types/node`: `pnpm add -D @types/node`

---

## Next Steps After Step 8

Once all tests pass:
- ✅ Step 8 complete (Document Upload + OCR + Field Approval)
- ⏳ Step 9: Commit + Roadmap Generation
- ⏳ Step 10: PDF Reports
- ⏳ Step 11: Dashboard Pin Widget
- ⏳ Step 12: Tests

**Estimated Progress**: 75% complete (Steps 0-8 done, Steps 9-12 remaining)
