# process-ingestion (MVP hardening)

Supabase Edge Function worker for queue-based ingestion.

It claims jobs via `core.claim_ingestion_jobs`, processes documents idempotently, and finalizes via:
- `core.complete_ingestion_job`
- `core.fail_ingestion_job`

It writes normalized outputs to:
- `finance.transactions_inbox`
- `health_meta.insurance_documents`
- `core.document_facts`
- `core.ingestion_results` (idempotency ledger)

## Security Model

- `SUPABASE_SERVICE_ROLE_KEY` is used **only** inside this Edge Function and trusted server routes.
- Never expose service role via `NEXT_PUBLIC_*`.
- Invoke this function with `x-worker-secret` and keep `verify_jwt = false` only for cron/worker invocation.

## Required Secrets (Supabase Edge Functions)

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `INGESTION_WORKER_SECRET`

## Resource Guardrails

- Max file size per file type (MVP): 10MB
- CSV: max 100,000 rows
- XLSX: max 5 sheets and 25,000 total rows
- DOCX: max 2MB extracted text
- Per-job processing budget: 20 seconds (fast-fail)

## Retry and Leasing

- Lease claim timeout: 5 minutes
- Job states: `queued | processing | completed | failed | dead`
- Exponential retry backoff: `2^attempts` minutes (capped at 60)
- Stuck `processing` jobs are reclaimable after lease expiry

## Deploy

```bash
supabase functions deploy process-ingestion
```

## Invoke (manual test)

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/process-ingestion" \
  -H "Content-Type: application/json" \
  -H "x-worker-secret: $INGESTION_WORKER_SECRET" \
  -d '{"limit":25,"worker_id":"cron-1"}'
```

## Cron

Run every 1-2 minutes with:
- endpoint: `https://<project-ref>.supabase.co/functions/v1/process-ingestion`
- method: `POST`
- header: `x-worker-secret: <INGESTION_WORKER_SECRET>`
- body: `{"limit":25,"worker_id":"cron"}`
