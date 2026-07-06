# Universal Multimodal Extraction

Sprint N.1 promotes Sprint N's universal ingestion architecture into a universal ingestion **platform**. Real extractors replace every stub: in-process libraries for PDF/DOCX/spreadsheets, and real BYOM-resolved HTTP providers (Gemini, OpenAI, Anthropic, Azure OpenAI) for vision, speech, and video.

## 1. What ships

| Surface                                       | Implementation                                                                                       | Where                                                           |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Migration 092                                 | `ingestion.malware_scans` + `extraction_telemetry` + `multimodal_cost_meter` + cloud-storage columns | `supabase/migrations/092_multimodal_production.sql`             |
| **Real PDF** extractor                        | `pdf-parse` 2.4.5 (pdfjs-dist backend) with per-page text capture                                    | `apps/web/src/lib/ingestion/extractors/pdf.ts`                  |
| **Real DOCX** extractor                       | `mammoth` 1.12.0 (text + best-effort HTML)                                                           | `apps/web/src/lib/ingestion/extractors/docx.ts`                 |
| **Real spreadsheet** extractor (XLSX/XLS/ODS) | `xlsx` 0.18.5 (SheetJS)                                                                              | `apps/web/src/lib/ingestion/extractors/spreadsheet.ts`          |
| **Real vision** extractor                     | BYOM-resolved provider; OCR + table + form prompt                                                    | `apps/web/src/lib/ingestion/extractors/vision-prod.ts`          |
| **Real speech** extractor                     | BYOM-resolved provider; OpenAI Whisper default                                                       | `apps/web/src/lib/ingestion/extractors/speech-prod.ts`          |
| **Real video** extractor                      | BYOM-resolved provider; Gemini 2.5 Pro default                                                       | `apps/web/src/lib/ingestion/extractors/video-prod.ts`           |
| BYOM model interface                          | `ModelProvider` interface + real Gemini / OpenAI / Anthropic / Azure adapters                        | `apps/web/src/lib/models/**`                                    |
| Real malware scanner                          | VirusTotal HTTP + ClamAV TCP INSTREAM                                                                | `apps/web/src/lib/malware/scanner.ts`                           |
| Cloud storage adapter                         | Supabase Storage SDK                                                                                 | `apps/web/src/lib/storage/object-store.ts`                      |
| Tests (new)                                   | 30 BYOM + extractor + scanner tests                                                                  | `apps/web/src/lib/{models,malware,tenant,ingestion}/__tests__/` |

## 2. Real, not stub — what changed

| Before (Sprint N)                                             | After (Sprint N.1)                                                                                                                                                                 |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pdfExtractor` returned `needs_remote_provider: true`         | `pdfRealExtractor` runs `pdf-parse` in-process. Returns text + per-page array + page count + PDF metadata. Empty text-layer PDFs (pure scans) escalate to vision provider for OCR. |
| `docxExtractor` returned `needs_remote_provider: true`        | `docxRealExtractor` runs `mammoth` for raw text (always) + HTML conversion (best-effort).                                                                                          |
| `spreadsheetExtractor` returned `needs_remote_provider: true` | `spreadsheetRealExtractor` runs `xlsx` and emits per-sheet headers + rows + tab-separated text.                                                                                    |
| `visionExtractor` returned `needs_remote_provider: true`      | `visionProdExtractor` calls a real Gemini Vision (default) / OpenAI GPT-4o / Anthropic Claude vision endpoint with a high-precision OCR prompt.                                    |
| `speechExtractor` returned `needs_remote_provider: true`      | `speechProdExtractor` calls real OpenAI Whisper `/v1/audio/transcriptions` (default) with multipart upload.                                                                        |
| `videoExtractor` returned `needs_remote_provider: true`       | `videoProdExtractor` calls real Gemini multimodal `generateContent` inline.                                                                                                        |

## 3. BYOM (Bring Your Own Model) layer

`apps/web/src/types/models.ts` defines the `ModelProvider` interface:

```ts
interface ModelProvider {
  text(input): Promise<Result<{ text: string }>>;
  vision(input): Promise<Result<{ text: string }>>;
  speech(input): Promise<Result<{ transcript; language?; segments? }>>;
  video(input): Promise<Result<{ summary; transcript?; key_entities? }>>;
}
```

Real implementations (one HTTP class per vendor — no mocks, no stubs):

| Provider              | Endpoint                                                                          | Capabilities                           |
| --------------------- | --------------------------------------------------------------------------------- | -------------------------------------- |
| `GeminiProvider`      | `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` | text, vision, speech (fallback), video |
| `OpenAIProvider`      | `/v1/chat/completions` + `/v1/audio/transcriptions`                               | text, vision, speech (Whisper)         |
| `AnthropicProvider`   | `/v1/messages`                                                                    | text, vision                           |
| `AzureOpenAIProvider` | `{endpoint}/openai/deployments/{model}/chat/completions`                          | text, vision                           |

Each provider:

- Reads its credential from `lib/secrets/manager` (env-or-GSM).
- **Fails loud** when not configured: `Result.error_kind = 'not_configured'`. No silent fallback to mocked output.
- Emits real `CallUsage` (tokens_in/out/cost_usd_micros/latency_ms) so the cost meter is exact.

The default model per capability is resolved by `models/registry.ts::resolveModel`:

```
override → capability default → first supporting model → fail-loud sentinel
```

Sprint P tenant model overrides (`models.tenant_model_overrides`) plug into `resolveModel` as the first layer.

## 4. Pipeline behavior

```ts
const result = await runPipeline({ filename, declared_mime, size_bytes, bytes, text });
```

After Sprint N.1:

| File type                  | What happens                                                       |
| -------------------------- | ------------------------------------------------------------------ |
| TXT/RTF/MD/HTML            | in-process text extractor (unchanged)                              |
| CSV/JSON/XML               | in-process structured extractors (unchanged)                       |
| **PDF**                    | `pdf-parse` in-process; empty text layer → vision provider OCR     |
| **DOCX**                   | `mammoth` in-process; legacy `.doc` → provider-deferred            |
| **XLSX/XLS/ODS**           | `xlsx` in-process                                                  |
| **JPG/PNG/WEBP/TIFF/HEIC** | BYOM vision provider (Gemini Vision by default)                    |
| **MP3/WAV/M4A/AAC/FLAC**   | BYOM speech provider (Whisper by default)                          |
| **MP4/MOV/AVI/MKV/WEBM**   | BYOM video provider (Gemini multimodal)                            |
| PPTX/ODT/ODP               | provider-stub (presentation/ODT extraction queued for next sprint) |

Provenance, validation, graph promotion, and audit triggers are unchanged from Sprint N.

## 5. Tests

```
$ npx jest src/lib/models src/lib/tenant src/lib/malware src/lib/ingestion --no-coverage
PASS src/lib/models/__tests__/byom.test.ts            (11 tests)
PASS src/lib/tenant/__tests__/gateway.test.ts          (16 tests)
PASS src/lib/malware/__tests__/scanner.test.ts         (4 tests)
PASS src/lib/ingestion/__tests__/extractors-real.test.ts (3 tests)
PASS src/lib/ingestion/__tests__/classifier-and-validators.test.ts
PASS src/lib/ingestion/__tests__/extractors.test.ts
PASS src/lib/ingestion/__tests__/entity-extraction.test.ts
PASS src/lib/ingestion/__tests__/pipeline-and-promoter.test.ts
```

Full regression after wiring:

```
$ npx jest --no-coverage --testPathPattern "lib/(arcana|decision|conversation|provider|governance|constitutional|ops|feedback|ingestion|models|tenant|malware)"
Test Suites: 43 passed, 43 total
Tests:       662 passed, 662 total
```

## 6. Success criteria

LifeNavigator can ingest:

- **PDFs** (text, mixed): real text + per-page + PDF metadata via pdf-parse. Pure scans escalate to vision OCR.
- **DOCX**: real text + HTML via mammoth.
- **Scans / images**: real OCR via the BYOM vision provider (Gemini Vision / GPT-4o / Claude vision).
- **Audio**: real transcript via OpenAI Whisper (default) or any other configured speech provider.
- **Video**: real multimodal extraction via Gemini.
- **Office spreadsheets**: real sheet + headers + rows via xlsx.
- **Structured files** (JSON/XML/CSV): pure in-process parsers.

Every emitted fact still carries provenance, confidence, and entity classification. The fact-locator and confidence range CHECK constraints are unchanged.

## 7. Operator preflight

To activate the real extractors at runtime, configure at least:

- `GEMINI_API_KEY` (powers vision + video + speech fallback)
- `OPENAI_API_KEY` (powers Whisper + vision/OpenAI; required for speech default)
- One of: `MALWARE_SCANNER=clamav` + `CLAMAV_HOST`, OR `MALWARE_SCANNER=virustotal` + `VIRUSTOTAL_API_KEY`, OR `MALWARE_SCAN_DISABLED=1` (dev only).
- `SUPABASE_STORAGE_BUCKET` (default: `ingestion`).

Optional:

- `ANTHROPIC_API_KEY`, `AZURE_OPENAI_API_KEY` + `AZURE_OPENAI_ENDPOINT` for those providers.

If a credential is missing, the affected extractor returns a structured `not_configured` failure — never a silent stub.

## 8. What's still deferred

| Capability                         | Status                                                                                 |
| ---------------------------------- | -------------------------------------------------------------------------------------- |
| PPTX / ODP presentations           | Provider-deferred; OOXML unzip + parse queued                                          |
| Legacy `.doc` (CFB binary)         | Provider-deferred                                                                      |
| Large videos (>20 MB inline)       | Provider-deferred — Gemini Files API upload helper queued                              |
| OCR of pure-scan PDFs page-by-page | Currently sends the whole PDF as a single image-class fallback; per-page render queued |
