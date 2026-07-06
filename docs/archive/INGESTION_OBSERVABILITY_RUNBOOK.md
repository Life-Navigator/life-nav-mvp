# Ingestion Observability Runbook

Sprint N.1 deliverable. Operating runbook for the multimodal ingestion pipeline.

## 1. Counters

Stored in:

- `ingestion.extraction_telemetry` — per-(file, extractor) row, status FSM
- `ingestion.multimodal_cost_meter` — per-call cost in micro-USD with units
- `ingestion.malware_scans` — append-only scan record

## 2. SQL dashboards

### 2.1 Files processed (24h)

```sql
SELECT COUNT(*) AS files,
       COUNT(*) FILTER (WHERE status = 'succeeded') AS ok,
       COUNT(*) FILTER (WHERE status IN ('failed','timed_out')) AS failed,
       COUNT(*) FILTER (WHERE status = 'deferred') AS deferred
FROM ingestion.extraction_telemetry
WHERE created_at > NOW() - INTERVAL '24 hours';
```

### 2.2 Failure rate by extractor (1h)

```sql
SELECT extractor_name,
       COUNT(*) FILTER (WHERE status IN ('failed','timed_out')) AS failures,
       COUNT(*) AS total,
       ROUND(100.0 * COUNT(*) FILTER (WHERE status IN ('failed','timed_out')) / GREATEST(COUNT(*), 1), 2) AS pct_failed
FROM ingestion.extraction_telemetry
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY extractor_name
ORDER BY pct_failed DESC;
```

### 2.3 OCR cost / day

```sql
SELECT DATE_TRUNC('day', created_at) AS day,
       SUM(units) AS pages,
       ROUND(SUM(cost_usd_micros) / 1e6, 4) AS cost_usd
FROM ingestion.multimodal_cost_meter
WHERE cost_kind = 'ocr_page'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY 1 ORDER BY 1 DESC;
```

### 2.4 Audio cost / day

```sql
SELECT DATE_TRUNC('day', created_at) AS day,
       SUM(units) AS minutes,
       ROUND(SUM(cost_usd_micros) / 1e6, 4) AS cost_usd
FROM ingestion.multimodal_cost_meter
WHERE cost_kind = 'audio_minute'
GROUP BY 1 ORDER BY 1 DESC;
```

### 2.5 Video cost / day

```sql
SELECT DATE_TRUNC('day', created_at) AS day,
       SUM(units) AS minutes,
       ROUND(SUM(cost_usd_micros) / 1e6, 4) AS cost_usd
FROM ingestion.multimodal_cost_meter
WHERE cost_kind = 'video_minute'
GROUP BY 1 ORDER BY 1 DESC;
```

### 2.6 Malware-scan summary (24h)

```sql
SELECT scanner, status, COUNT(*) AS n
FROM ingestion.malware_scans
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY 1, 2;
```

### 2.7 Infected file inventory

```sql
SELECT m.id, m.user_id, m.file_id, m.scanner, m.signature, m.created_at,
       f.display_name, f.file_kind, f.size_bytes
FROM ingestion.malware_scans m
JOIN ingestion.files f ON f.id = m.file_id
WHERE m.status = 'infected'
ORDER BY m.created_at DESC
LIMIT 100;
```

### 2.8 Throughput by extractor + p95 latency

```sql
SELECT extractor_name,
       COUNT(*) AS calls,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_ms) AS p50_ms,
       percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_ms,
       AVG(pages_processed) AS avg_pages,
       SUM(facts_emitted) AS facts
FROM ingestion.extraction_telemetry
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY 1 ORDER BY calls DESC;
```

## 3. Alert thresholds

| Metric                                                                                            | Warning                    | Critical           |
| ------------------------------------------------------------------------------------------------- | -------------------------- | ------------------ |
| `% extractor failures` over last hour, per extractor                                              | > 2%                       | > 10%              |
| `% files with virus_scan_status='infected'` in 24h                                                | > 0 (always page)          | n/a                |
| OCR pages / hour                                                                                  | per-tenant quota dependent | exceeds budget cap |
| Audio minutes / hour                                                                              | per-tenant quota dependent | exceeds budget cap |
| Video minutes / hour                                                                              | per-tenant quota dependent | exceeds budget cap |
| Malware scanner latency p95                                                                       | > 5s                       | > 30s              |
| `% retrieval_ok=false` (constitutional layer; not ingestion-specific but listed for joint review) | > 1%                       | > 5%               |

## 4. Incident response

1. Spike in extractor failures → check the extractor's `last_error` column in the telemetry row + cross-check the BYOM provider (`ops.llm_usage_meter` shows the auth/rate errors).
2. Infected file detected → automatic block; alert routes to the security team. The fact that the file was rejected is auditable.
3. Cost spike → toggle the cost circuit-breaker feature flags. The relevant flags are `integrations.gemini`, plus the multimodal-specific flags below.
4. Storage error during upload → fall back to keeping bytes inline in `extractions.text` if the storage adapter throws.

## 5. Cost circuit breakers (feature flags)

Add to `ops.feature_flags` so tenants/cohorts can disable specific extractors without deployment:

- `ingestion.ocr.enabled` → disable vision extractor (default ON)
- `ingestion.speech.enabled` → disable speech extractor
- `ingestion.video.enabled` → disable video extractor
- `ingestion.advanced_extraction` → disable Anthropic/Azure providers

Disabling a flag causes the corresponding extractor to be skipped by `routeExtractors`. The job is marked `deferred` with `deferred_reason='extractor_disabled_by_flag'`.

## 6. Out of scope (next runbook revision)

- Real-time OTel spans for each extractor call (today: per-call duration in telemetry).
- Per-tenant ingestion dashboards (today: per-user via RLS).
- Auto-budget enforcement (today: human-on-loop toggle of feature flags).
