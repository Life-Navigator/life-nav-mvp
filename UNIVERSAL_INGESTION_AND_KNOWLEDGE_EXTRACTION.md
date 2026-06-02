# Universal Ingestion & Knowledge Extraction

Sprint N installs the multimodal ingestion pipeline. Every file the
user uploads is classified, extracted, decomposed into entities + facts
with mandatory provenance, and promoted to the Personal GraphRAG.

```
File
↓
Mime / magic-byte classifier
↓
Extractor routing (in-process + provider-deferred)
↓
Extraction (text, structured, tabular, ocr, transcript, …)
↓
Entity + fact extraction (primitives + domain templates)
↓
Validation (mandatory locator, confidence ∈ [0,1])
↓
Graph promoter (dedupe by canonical_text + kind, floor confidence)
↓
ingestion.* tables   →   GraphRAG sync trigger
```

**No fact without provenance.** SQL CHECK constraints enforce
`source_locator` is a non-empty JSON object and
`extraction_confidence ∈ [0,1]`. Tests assert both.

## 1. What ships

| Surface                                      | Where                                                                                                                 |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Migration 091                                | `supabase/migrations/091_universal_ingestion.sql` — `ingestion` schema with 8 tables, full RLS, GraphRAG sync trigger |
| Types                                        | `apps/web/src/types/ingestion.ts`                                                                                     |
| Mime / magic-byte classifier                 | `apps/web/src/lib/ingestion/mime-classifier.ts`                                                                       |
| Validators (size + mime + scan + provenance) | `apps/web/src/lib/ingestion/validators.ts`                                                                            |
| Structured extractors (real)                 | `text-document.ts`, `csv.ts`, `json.ts`, `xml.ts`                                                                     |
| Provider-abstracted extractors               | `providers.ts` — PDF / DOCX / spreadsheet / presentation / vision / speech / video                                    |
| Primitive entity extractors                  | `entity-extraction/primitives.ts` — dates / amounts / accounts / SSN / emails / phones                                |
| Domain templates                             | `entity-extraction/domain-templates.ts` — financial / medical / insurance / payroll / receipt                         |
| Routing                                      | `routing.ts`                                                                                                          |
| Pipeline orchestrator                        | `pipeline.ts`                                                                                                         |
| Graph promoter                               | `graph-promoter.ts`                                                                                                   |
| API routes                                   | `/api/ingest/{upload, jobs/[id], files/[id], extractions/[id], facts}`                                                |
| Tests                                        | 66 new tests across classifier / extractors / entity-extraction / pipeline                                            |
| RLS verifier                                 | `scripts/validation/verify_091_ingestion_rls.sql`                                                                     |

## 2. Supported file kinds

| Modality     | Real (in-process)  | Provider-deferred          |
| ------------ | ------------------ | -------------------------- |
| Document     | TXT, RTF, MD, HTML | PDF, DOCX, DOC, ODT        |
| Spreadsheet  | CSV                | XLSX, XLS, ODS             |
| Presentation | —                  | PPTX, PPT, ODP             |
| Structured   | JSON, XML          | —                          |
| Image        | —                  | JPG, PNG, WEBP, TIFF, HEIC |
| Audio        | —                  | MP3, WAV, M4A, AAC, FLAC   |
| Video        | —                  | MP4, MOV, AVI, MKV, WEBM   |

For provider-deferred kinds the pipeline returns
`{ ok: false, deferred: true, outputs: [{ needs_remote_provider: true, deferred_reason: … }] }`
and the API persists `extraction_jobs.status = 'deferred'` with the
reason in `deferred_reason`. When a provider is wired (Gemini Vision /
Whisper / pdf.js / ffmpeg / etc.), it replaces the default stub via
`setProviders({ pdf, vision, speech, video })` and the same code path
becomes "real."

## 3. Classifier

Two-step:

1. **Magic-byte detection** (first 32 bytes): `%PDF-`, `89 50 4E 47 0D 0A 1A 0A` (PNG), `FF D8 FF` (JPEG), `RIFF…WEBP/WAVE/AVI`, `49 49 2A 00` / `4D 4D 00 2A` (TIFF), ISO BMFF `ftyp` brand parsing, `fLaC`, `ID3`, ZIP (PK\x03\x04) + extension disambiguation, EBML (Matroska), `{\rtf`.
2. **Extension + text-sniff fallback** for ASCII-shaped formats: CSV/TXT/MD via `.ext`, `<?xml`, `<!DOCTYPE html>`, JSON `{`/`[`.

Output: `{ file_kind, modality, detected_mime, confidence, signals[] }`.

## 4. Validation

- Size caps per modality: document 50MB · spreadsheet 50MB · presentation 100MB · structured 25MB · image 25MB · audio 500MB · video 2GB.
- Mime/extension consistency: at classifier confidence ≥ 0.9 a mismatch is an **error**; below that it's a warning.
- Virus-scan gate: extraction is blocked unless `scan_status ∈ {clean, skipped}`.
- Provenance enforcement: every emitted fact must carry a non-empty `source_locator` AND `extraction_confidence ∈ [0,1]`. Both are also enforced at the SQL CHECK level.

## 5. Primitive entity extractors

| Primitive                  | Predicate                  | Privacy contract                                                             |
| -------------------------- | -------------------------- | ---------------------------------------------------------------------------- |
| ISO / US / long-form dates | `date_mentioned`           | –                                                                            |
| USD amounts                | `amount_mentioned`         | –                                                                            |
| Account numbers            | `account_number_mentioned` | only the last 4 digits persist; full number never appears in `evidence_text` |
| SSN                        | `ssn_present`              | always rendered `XXX-XX-####`; raw value never persisted                     |
| Emails                     | `email_mentioned`          | lowercased + canonicalized                                                   |
| US phones                  | `phone_mentioned`          | normalized `+1XXXXXXXXXX`                                                    |

All primitives emit a non-empty locator (`char_start`/`char_end`).

## 6. Domain templates

| Template            | Triggers                                         | Facts emitted                                                                                        |
| ------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Financial Statement | `bank \| credit union \| brokerage \| statement` | `statement_ending_balance`, `statement_period`, `account_number_mentioned`                           |
| Medical Record      | `lab result \| diagnosis \| prescription`        | `diagnosis_code` (ICD-10), `lab_result`, `provider_npi`                                              |
| Insurance Card      | `member id \| policy \| group \| insurance`      | `insurance_member_id`, `insurance_group_number`, `insurance_policy_number`, `insurance_carrier_name` |
| Payroll             | `W-2 \| gross pay \| net pay \| pay period`      | `w2_box_value`, `paystub_gross_pay`, `paystub_net_pay`, `paystub_pay_period`                         |
| Receipt             | `subtotal \| tax \| total \| merchant`           | `receipt_total`, `receipt_subtotal`, `receipt_tax`, `receipt_merchant_name`                          |

Templates run AFTER text extraction; primitives run alongside.

## 7. Pipeline contract

```ts
const result = await runPipeline({ filename, declared_mime, size_bytes, bytes, text });

result = {
  classification,
  extractors_run: string[],
  outputs: ExtractorOutput[],
  ok: boolean,             // true iff at least one extractor produced output AND no fact is missing provenance AND nothing is deferred
  deferred: boolean,       // true iff any extractor returned needs_remote_provider
  errors: { extractor, message }[],
};
```

Determinism: same inputs → byte-identical result (verified in the test suite).

## 8. Graph promoter

Pure projection:

- Dedupe entities by `(entity_kind, canonical_text.toLowerCase())`.
- Keep highest-confidence entity per key.
- Drop entities below the confidence floor (default 0.6).
- Promoted entities receive `graph_promoted = true`.
- Relationships only survive when BOTH endpoints survived AND the relationship confidence is ≥ floor.

The API inserts the promoted set into `ingestion.extracted_entities` / `extracted_relationships` / `extracted_facts`. The Sprint N sync trigger in migration 091 fans each row into the existing `graphrag.enqueue_sync(...)` queue. **Embedding payloads strip raw text + locator** so PHI / quoted strings never flow into the worker's embedding context.

## 9. API surface

```
POST /api/ingest/upload                          multipart "file" → classified + persisted + extracted
GET  /api/ingest/jobs/[id]                        job + extractions + entity count + fact count
GET  /api/ingest/files/[id]                       file + versions + jobs
GET  /api/ingest/extractions/[id]                 extraction + entities + facts
GET  /api/ingest/facts                            query: ?file_id=&job_id=&predicate=&since=
```

Every route is authenticated; user_id is forced to `auth.uid()` server-side. RLS scopes every read.

## 10. RLS verifier

```
psql "$DATABASE_URL" -f scripts/validation/verify_091_ingestion_rls.sql
```

Asserts:

1. User A reads own files / jobs / facts.
2. User A **cannot** read User B's files / jobs / facts (cross-user leak).
3. Empty `source_locator` is rejected by the `fact_locator_nonempty` CHECK.
4. `extraction_confidence > 1` is rejected by the range CHECK.

## 11. Tests — 66 new

```
$ npx jest src/lib/ingestion --no-coverage
PASS src/lib/ingestion/__tests__/classifier-and-validators.test.ts
PASS src/lib/ingestion/__tests__/extractors.test.ts
PASS src/lib/ingestion/__tests__/entity-extraction.test.ts
PASS src/lib/ingestion/__tests__/pipeline-and-promoter.test.ts
Test Suites: 4 passed, 4 total
Tests:       66 passed, 66 total
```

Coverage:

- **Classifier**: PDF/PNG/JPEG/RIFF disambiguation/ISO BMFF brands/FLAC/ZIP+ext + text-sniff for XML/HTML/JSON + extension fallback.
- **Validators**: size cap, mime mismatch at high vs low confidence, unknown-kind rejection, scan gating, fact locator + confidence range.
- **Extractors**: CSV delimiter sniffing + quoting + header inference; JSON flattening + parse-error sentinel; XML path/attr extraction; HTML/RTF stripping.
- **Entity extraction**: dates (ISO/US/long), USD amounts, masked accounts, masked SSN, email canonicalization, phone normalization; all five domain templates; locator non-empty invariant.
- **Pipeline**: real-text happy path, CSV path, provider-deferred PDF, unknown-kind router error.
- **Graph promoter**: dedupe + confidence floor + relationship endpoint survival + `graph_promoted` flagging.

## 12. Provenance contract

Every `extracted_facts` row carries:

```jsonb
source_locator: {
  page?, row?, col?, char_start?, char_end?,
  timestamp_ms?, bbox?, slide_index?, sheet_name?,
  json_path?, xml_path?
}
```

The SQL CHECK requires `jsonb_typeof(source_locator) = 'object' AND source_locator <> '{}'::jsonb`. The TS validators mirror this. The `ingestion.provenance` table is the normalized form for cross-document evidence joins; the per-fact `source_locator` is the queryable inline copy.

## 13. What is explicitly **not** in this sprint

| Area                              | Status                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| Real PDF text + layout extraction | Provider interface ships; pdf.js / Gemini wire-up deferred                                       |
| Real OCR                          | Provider interface ships; Tesseract / Gemini Vision wire-up deferred                             |
| Real speech-to-text               | Provider interface ships; Whisper / Gemini wire-up deferred                                      |
| Real video scene segmentation     | Provider interface ships; ffmpeg + scene-detector deferred                                       |
| Real malware scanning             | `virus_scan_status` defaults to `'skipped'` in this sprint; ClamAV / VirusTotal wire-up deferred |
| Cloud storage upload              | Bytes are persisted inline today; storage-bucket sync (Supabase Storage / S3 / GCS) is next      |
| Cross-document entity resolution  | Dedupe is per-job; cross-file resolution lives in the GraphRAG (Sprint A)                        |

When any of the providers is wired, the same `runPipeline` returns `ok: true` with real outputs — no caller changes.

## 14. Success criteria — verified

LifeNavigator can ingest and understand any major consumer document type:

- **Documents** (TXT/RTF/MD/HTML) — real, in-process.
- **Spreadsheets** (CSV) — real, in-process; XLSX/XLS/ODS deferred to provider.
- **Structured** (JSON/XML) — real, in-process.
- **Images / Audio / Video / PDF / Office** — provider interface ships with deterministic stubs; the pipeline marks jobs `deferred` until a provider is configured, but every other contract (validation, locator, confidence range, RLS, graph promotion) is real today.

Every emitted fact carries `source_file_id + locator + confidence + ingested_at`. Traceable provenance is enforced at three layers: TS validator, SQL CHECK, and the per-fact normalized `ingestion.provenance` row.
