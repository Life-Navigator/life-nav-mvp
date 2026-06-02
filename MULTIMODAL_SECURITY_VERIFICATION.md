# Multimodal Security Verification

Sprint N.2 Phase 2 + 3 + 4 deliverable.

## What changed

Before Sprint N.2, the `/api/ingest/upload` route accepted bytes, ran
classification + validation, persisted file/version/job rows, ran the
in-process pipeline, and inserted extractions / entities / facts. It
did **not** call `defaultScanner()`, did **not** use
`SupabaseStorageAdapter`, and did **not** write to
`ingestion.multimodal_cost_meter` or `ops.llm_usage_meter`.

After Sprint N.2, the route is a thin handler that delegates to
`processUpload(...)` in `apps/web/src/lib/ingestion/upload-pipeline.ts`.
The orchestrator sequences:

```
classify + validate
  ↓
SCAN          ← defaultScanner() — mandatory
  ↓
PERSIST FILE  ← virus_scan_status = scan.status
PERSIST SCAN  ← ingestion_malware_scans row
  ↓
REJECT IF infected OR error
  ↓
PERSIST VERSION
STORE         ← SupabaseStorageAdapter.uploadObject(bytes)
PERSIST PATH  ← UPDATE ingestion_files SET storage_bucket=, storage_path=
  ↓
RUN PIPELINE
  ↓
TELEMETRY     ← ingestion_extraction_telemetry row PER extractor
COST          ← ingestion_multimodal_cost_meter + ops_llm_usage_meter
  ↓
PERSIST EXTRACTIONS / ENTITIES / FACTS
```

## The four security gates

### Gate 1 — Mandatory malware scan

`defaultScanner()` resolves to one of:

| Mode         | Trigger                                                  | Behavior                                                                                         |
| ------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `clamav`     | `MALWARE_SCANNER=clamav` OR `CLAMAV_HOST` set            | TCP INSTREAM to `clamd`. Real OK/FOUND/ERROR protocol.                                           |
| `virustotal` | `MALWARE_SCANNER=virustotal` OR `VIRUSTOTAL_API_KEY` set | Real POST to `/api/v3/files` + polling.                                                          |
| `none`       | `MALWARE_SCANNER=none` OR `MALWARE_SCAN_DISABLED=1`      | Returns `status='skipped'` if flag set, else returns `status='error'` (which BLOCKS extraction). |

The orchestrator rejects extraction on `status='infected'` AND on
`status='error'`. The only accepted statuses are `clean` and `skipped`
(and `skipped` requires the explicit dev flag).

### Gate 2 — Persisted scan audit

Every upload writes one row to `ingestion.malware_scans`. The audit
chain is the source of truth for compliance review.

### Gate 3 — Mandatory object storage

The orchestrator passes the bytes to `SupabaseStorageAdapter.uploadObject`,
which writes to:

```
bucket: $SUPABASE_STORAGE_BUCKET (default: ingestion)
path:   <user_id>/<file_id>/<version_number>/<sha256>
```

After upload, `ingestion_files.storage_bucket` and
`ingestion_files.storage_path` are populated. The database no longer
carries the binary payload; the extractor output (text/structured)
remains in `ingestion_extractions.text` and `.structured`.

In dev environments without a real bucket, set
`INGESTION_STORAGE_FALLBACK=1` to swallow storage errors and continue
to keep extractions inline. The flag is rejected at the operator
preflight step (item 4 of the BETA blocker report).

### Gate 4 — Safe client messaging

Internal errors (scanner reasons, storage adapter messages, bucket
names) are never returned to the client. The `safeMessage()` helper
in `upload-pipeline.ts` maps internal reason codes to a small set of
stable client-safe strings. The audit row carries the internal detail.

## How this was verified

### 1. Wiring tests

`apps/web/src/lib/ingestion/__tests__/upload-pipeline-wiring.spec.ts`
contains 4 tests that drive `processUpload` with injected scanners +
storage adapters + a capturing supabase mock. The tests assert:

1. **Clean scan** persists scan row, storage row, file row with
   `virus_scan_status='clean'`, file UPDATE with storage_bucket +
   storage_path, AND per-extractor telemetry rows.
2. **Infected scan** persists the scan row + file row with
   `virus_scan_status='infected'`, NEVER creates an extraction job,
   NEVER persists extractions / entities / facts. The client message
   does NOT leak the malware signature.
3. **Scanner error** rejects with `scan_error`, returns the safe
   public message, does NOT leak internal scanner details.
4. **Storage error without fallback flag** rejects with
   `storage_error`, does NOT leak the bucket / driver error.

### 2. Journey E2E coverage

`apps/web/src/__tests__/journeys-e2e.spec.ts` Journey 6 re-exercises
the orchestrator with the same scenarios and asserts the route handler
wiring is intact (imports `processUpload`, `defaultScanner`,
`SupabaseStorageAdapter`).

### 3. Database verifier

`scripts/validation/verify_092_multimodal_production.sql` runs
seven assertions against a live Supabase database, including:

- `ingestion.malware_scans`, `ingestion.extraction_telemetry`,
  `ingestion.multimodal_cost_meter` exist.
- RLS enabled on each.
- The CHECK constraints reject bogus scanner / status / cost_kind values.
- Cross-user RLS leak test confirms User A cannot read User B's
  malware scan rows.

## Cost meter coverage

The orchestrator extracts `usage` + `provider` + `model_id` from any
extractor structured payload and writes:

- `ingestion.multimodal_cost_meter` — units (pages / minutes / calls),
  cost_kind (`pdf_doc`, `ocr_page`, `audio_minute`, `video_minute`,
  `vision_call`, `speech_call`, `video_call`, `llm_call`).
- `ops.llm_usage_meter` (via `recordLlmUsage`) — for the three BYOM
  providers (`gemini`, `openai`, `anthropic`). Anthropic is included
  because the `tagged-provider` shape is identical.

The in-process extractors (pdf-parse, mammoth, xlsx) report zero cost
correctly — they emit no `usage` field and so produce no meter row.

## Telemetry coverage

Every extractor invocation persists one row to
`ingestion.extraction_telemetry` with:

```
status:           succeeded / partial / deferred
extractor_name + extractor_version
duration_ms
pages_processed (when available)
entities_emitted (count)
facts_emitted (count)
error_message (deferred_reason when deferred)
```

## Pre-launch checklist (Sprint N.2)

- [ ] `MALWARE_SCAN_DISABLED` and `INGESTION_STORAGE_FALLBACK` are NOT
      set in production.
- [ ] One of `CLAMAV_HOST` or `VIRUSTOTAL_API_KEY` is configured.
- [ ] `SUPABASE_STORAGE_BUCKET=ingestion` (or your canonical name)
      and the bucket exists per migration 002.
- [ ] Storage policy `Users can manage own ingestion objects` is active
      (migration 002 idempotently creates it).
- [ ] Dashboards include `ingestion.malware_scans` and `ingestion.extraction_telemetry`
      (queries are in `INGESTION_OBSERVABILITY_RUNBOOK.md` §2).
- [ ] Pipeline alert: any `virus_scan_status='infected'` rows page on-call.
