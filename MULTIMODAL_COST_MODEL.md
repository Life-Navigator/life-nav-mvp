# Multimodal Cost Model

Sprint N.1 deliverable.

## 1. Cost ledger

`ingestion.multimodal_cost_meter` records every chargeable extraction unit. Schema:

| Column            | Meaning                                                                                                                           |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `cost_kind`       | `pdf_doc`, `ocr_page`, `audio_minute`, `video_minute`, `vision_call`, `speech_call`, `video_call`, `llm_call`, `storage_gb_month` |
| `provider`        | `gemini`, `openai`, `anthropic`, `azure_openai`, `clamav`, `virustotal`, `local`                                                  |
| `model`           | canonical model id when applicable                                                                                                |
| `units`           | quantity (pages, minutes, documents, calls)                                                                                       |
| `unit_label`      | `pages \| minutes \| documents \| calls`                                                                                          |
| `cost_usd_micros` | integer micro-USD (1 USD = 1,000,000 micros) — exact math                                                                         |

Costs are populated by the extractors' `Result.usage.cost_usd_micros` after a successful provider call, then mirrored into the meter by the API route.

## 2. Per-unit rates (current)

### Vision (BYOM-resolved)

| Model               | $/1k input tokens | $/1k output tokens | Approx $/page (1k in / 256 out) |
| ------------------- | ----------------- | ------------------ | ------------------------------- |
| `gemini-2.5-pro`    | $0.00125          | $0.005             | $0.0025                         |
| `gemini-2.5-flash`  | $0.000075         | $0.0003            | $0.00015                        |
| `gpt-4o`            | $0.0025           | $0.01              | $0.0051                         |
| `gpt-4o-mini`       | $0.00015          | $0.0006            | $0.00030                        |
| `claude-3-5-sonnet` | $0.003            | $0.015             | $0.0068                         |

### Speech (Whisper)

OpenAI Whisper charges $0.006/minute. The cost meter logs `audio_minute` units.

### Video

Gemini multimodal video pricing depends on duration + resolution. Conservative estimate: $0.10 / minute for Gemini 2.5 Pro. The cost meter logs `video_minute` units.

### PDF / DOCX / spreadsheets

In-process — **zero LLM cost**. Telemetry still records latency for ops dashboards.

### Malware scanning

- ClamAV (TCP): zero per-scan cost; runs against a self-hosted daemon.
- VirusTotal: free tier 4 requests / minute. Production-tier pricing depends on contract; record contract terms in the secrets registry metadata.

## 3. Projected cost / DAU / day

Assumptions for a beta user, mix:

- 0.3 PDFs / day uploaded (avg 5 pages)
- 0.1 images / day (1 page each)
- 0.05 audio recordings / day (avg 5 minutes)
- 0.02 videos / day (avg 3 minutes)

```
PDF       : 0.3 × $0 = $0          (in-process)
Image OCR : 0.1 × $0.0025 × 1     = $0.00025   (gemini-2.5-pro)
Audio     : 0.05 × $0.006 × 5     = $0.00150
Video     : 0.02 × $0.10  × 3     = $0.00600
                                    ----------
                                    $0.00775 / DAU / day
                                  ≈ $0.23 / DAU / month
```

Combined with the Sprint M LLM cost projection (~$0.35/DAU/month), total per-DAU LLM + multimodal cost lands around **$0.58/month**.

## 4. Circuit breakers

The runbook documents four feature flags that disable specific extractors:

- `ingestion.ocr.enabled`
- `ingestion.speech.enabled`
- `ingestion.video.enabled`
- `ingestion.advanced_extraction`

Disabling a flag returns `deferred_reason='extractor_disabled_by_flag'` from the pipeline; no provider call is made, no row is added to the cost meter.

## 5. Per-tenant budgets

`platform.tenant_quotas` ships with the Sprint P migration. Reasonable defaults:

| quota_kind              | Default | Hard limit?                 |
| ----------------------- | ------- | --------------------------- |
| `ocr_pages_per_day`     | 1000    | No (soft cap; alert at 80%) |
| `audio_minutes_per_day` | 60      | No                          |
| `video_minutes_per_day` | 30      | Yes                         |
| `requests_per_minute`   | 600     | Yes                         |

The API gateway enforces `requests_per_minute` via the in-memory token bucket. Per-day budgets are computed by aggregating the cost meter.

## 6. Reporting

A dashboard table joining cost + telemetry gives the **cost per file** rollup the spec asks for:

```sql
SELECT f.file_kind,
       COUNT(DISTINCT f.id) AS files,
       COALESCE(SUM(m.cost_usd_micros), 0) / 1e6 AS cost_usd
FROM ingestion.files f
LEFT JOIN ingestion.multimodal_cost_meter m ON m.file_id = f.id
WHERE f.created_at > NOW() - INTERVAL '30 days'
GROUP BY 1
ORDER BY cost_usd DESC;
```

Per-page OCR cost:

```sql
SELECT SUM(cost_usd_micros) / NULLIF(SUM(units), 0) / 1e6 AS usd_per_page
FROM ingestion.multimodal_cost_meter
WHERE cost_kind = 'ocr_page'
  AND created_at > NOW() - INTERVAL '7 days';
```

Per-minute audio / video cost are computed identically with `cost_kind` swapped.

## 7. Out of scope

- Real spend reconciliation against vendor billing.
- Per-DAU cost rollups for the Constitutional GraphRAG side (lives in `ops.llm_usage_meter`; that runbook covers the LLM cost surface).
- Auto-enforcement of `quotas.hard_limit` (today the gateway honors only `requests_per_minute`).
