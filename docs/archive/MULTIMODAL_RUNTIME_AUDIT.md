# Multimodal Runtime Audit

Verification Audit — Phase 2.

## Method

Trace the actual upload flow from the HTTP handler to graph promotion.
Inspect each gate. Confirm no shortcut exists.

## Evidence

### 1. Route handler delegates to the orchestrator

`apps/web/src/app/api/ingest/upload/route.ts`:

```text
line 21:   import { defaultScanner } from '@/lib/malware/scanner';
line 22:   import { SupabaseStorageAdapter } from '@/lib/storage/object-store';
line 23:   import { processUpload } from '@/lib/ingestion/upload-pipeline';

line 49:   const scanner = await defaultScanner();
line 50:   const storage = new SupabaseStorageAdapter({ client: supabase });
line 52:   const result = await processUpload({ ..., scanner, storage });
```

The handler is 87 lines. No extraction logic, no DB writes, no
scanner short-circuit. Everything goes through `processUpload`.

✅ **Verified.**

### 2. Mandatory malware scan + scan audit

`apps/web/src/lib/ingestion/upload-pipeline.ts`:

```text
line 154:  const scan = await inputs.scanner.scan(inputs.bytes);
line 158:  ... ingestion_files insert with virus_scan_status: scan.status
line 184:  ... ingestion_malware_scans insert (audit row, append-only)
line 203:  if (scan.status === 'infected') return { ok: false, status: 'infected', ... };
line 211:  if (scan.status === 'error')    return { ok: false, status: 'scan_error', ... };
```

✅ **Verified.** Infected scans REJECT extraction; scanner errors
REJECT extraction. Only `clean` or `skipped` (with explicit
`MALWARE_SCAN_DISABLED=1` flag) proceed.

### 3. Mandatory object storage

`upload-pipeline.ts`:

```text
line 244:  if (inputs.storage) {
line 246:    const ref = await inputs.storage.uploadObject({...});
line 254:    await sb.from('ingestion_files').update({
line 255:      storage_bucket: ref.bucket,
line 256:      storage_path: ref.path,
line 257:    }).eq('id', file_id);
line 263:  } catch (err) {
line 264:    if (process.env.INGESTION_STORAGE_FALLBACK !== '1') {
line 265:      return { ok: false, status: 'storage_error', ... };
line 273:    }
```

Storage failure REJECTs the upload unless the dev escape hatch
`INGESTION_STORAGE_FALLBACK=1` is set. The pre-launch checklist in
`MULTIMODAL_SECURITY_VERIFICATION.md` rejects this flag in production.

✅ **Verified.**

### 4. Ingestion-time prompt-injection scan (NEW)

`upload-pipeline.ts` (lines 333-379):

```text
const fileOrigin = originFromKind(classification.file_kind);
for (const out of result.outputs) {
  const verdict = detectInjection({ text: out.text, origin: fileOrigin, authority: 'none' });
  await persistContentVerdict(sb, verdict, fileOrigin, {...}, {...});
  if (verdict.findings.length > 0) await persistInjectionFindings(...);
  if (verdict.action === 'REJECT') any_critical_injection = true;
  if (verdict.modified) out.text = verdict.sanitized_text;
}
if (any_critical_injection) {
  await sb.from('ingestion_extraction_jobs').update({ status: 'failed', deferred_reason: 'injection_critical' });
  return { ok: false, ..., reason_code: 'injection_critical' };
}
```

✅ **Verified.** Critical injection findings BLOCK extraction → no
entity / fact promotion. The job row is marked `failed` with the
reason code.

### 5. Trust-boundary metadata on promotion

`upload-pipeline.ts` (lines 422-446):

```text
await sb.from('ingestion_extracted_entities').insert({
  ...,
  trusted_source: false,
  instruction_authority: 'none',
  content_origin: fileOrigin,
});

await sb.from('ingestion_extracted_facts').insert({
  ...,
  trusted_source: false,
  instruction_authority: 'none',
  content_origin: fileOrigin,
});
```

Migration 096 enforces this at the SQL layer:

```sql
CONSTRAINT ext_entities_trust_invariant CHECK (
  instruction_authority = 'none'
  OR (trusted_source = TRUE AND content_origin IN ('system','developer'))
)
```

✅ **Verified.** The database refuses any insert that claims
non-`none` authority from an external origin.

### 6. Telemetry + cost meter

`upload-pipeline.ts` writes one row per extractor to
`ingestion_extraction_telemetry` (lines 381-396) and one row per BYOM
call to `ingestion_multimodal_cost_meter` + `ops_llm_usage_meter`
(via `recordCostFromExtractor` lines 397-401, definition at
lines 480-553).

Counts of references in upload-pipeline.ts (Bash sanity check):

```
recordLlmUsage / extraction_telemetry / multimodal_cost_meter / ingestion_malware_scans → 10 references
```

✅ **Verified.**

## Findings

| Gate                               | Verified | Path                        |
| ---------------------------------- | -------- | --------------------------- |
| Upload accepted                    | ✓        | route.ts:42-48              |
| Malware Scan executed              | ✓        | upload-pipeline.ts:154      |
| Malware Scan audit row             | ✓        | upload-pipeline.ts:184      |
| Reject on infected                 | ✓        | upload-pipeline.ts:203      |
| Reject on scanner error            | ✓        | upload-pipeline.ts:211      |
| Object storage attempted           | ✓        | upload-pipeline.ts:246      |
| Storage path persisted on file row | ✓        | upload-pipeline.ts:254      |
| Reject on storage error (prod)     | ✓        | upload-pipeline.ts:264-273  |
| Injection scan per extractor       | ✓ (NEW)  | upload-pipeline.ts:333      |
| Injection audit rows               | ✓ (NEW)  | upload-pipeline.ts:347, 351 |
| Reject on CRITICAL injection       | ✓ (NEW)  | upload-pipeline.ts:370      |
| Trust columns on promoted entities | ✓ (NEW)  | upload-pipeline.ts:432-436  |
| Trust columns on promoted facts    | ✓ (NEW)  | upload-pipeline.ts:444-446  |
| Per-extractor telemetry            | ✓        | upload-pipeline.ts:381      |
| BYOM cost meter writes             | ✓        | upload-pipeline.ts:401      |

## Verdict for Phase 2

**PASS.**

No shortcut exists in the upload flow. Scan precedes storage; storage
precedes extraction; extraction is preceded by the injection scan AND
blocked on critical findings; promoted records carry the trust-boundary
metadata and the database enforces the invariant.
