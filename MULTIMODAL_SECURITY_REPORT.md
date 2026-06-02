# Multimodal Security Report

Sprint N.1 deliverable.

## 1. Threat model

Multimodal ingestion introduces threats absent from the structured-only path:

| Threat                                                      | Mitigation                                                                                                                                                                                                                  |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Malicious file uploads (eg. weaponized PDFs, archive bombs) | Mandatory `MalwareScanner` gate before extraction. `virus_scan_status` must be `clean` or `skipped` (with `MALWARE_SCAN_DISABLED=1` audit trail) or the pipeline blocks.                                                    |
| Resource exhaustion via huge files                          | Per-modality size caps in `validators.ts::SIZE_CAPS_BYTES`. Document 50MB · spreadsheet 50MB · presentation 100MB · structured 25MB · image 25MB · audio 500MB · video 2GB.                                                 |
| Resource exhaustion via deeply nested archives              | Same. Plus pdf-parse / mammoth / xlsx have built-in archive limits.                                                                                                                                                         |
| Server-side request forgery via parser auto-fetch           | All extractors run on raw bytes; no URL-fetching parsers. CSP at the app layer blocks outbound requests from the Next route.                                                                                                |
| OCR / speech / video provider exfiltration                  | All calls go to documented vendor endpoints. Each provider uses HTTPS. Credentials read from the secrets adapter; never logged.                                                                                             |
| PHI leakage to vendors (HIPAA)                              | Operator must wire BAAs with Gemini (Vertex AI) / OpenAI / Azure. Provider model registry allows per-tenant overrides (`models.tenant_model_overrides`) so a healthcare tenant pins to an Azure deployment under their BAA. |
| PHI in the GraphRAG embedding payload                       | The ingestion sync trigger strips `evidence_text`, `object_text`, `object_jsonb`, `source_locator`, `locator` before enqueuing. The Rust worker normalizer drops sensitive fields a second time.                            |
| Bypass of malware scan                                      | The pipeline reads `files.virus_scan_status` before invoking extractors. Production deployments must NOT set `MALWARE_SCAN_DISABLED=1`.                                                                                     |

## 2. Real scanner backends (no mocks)

`lib/malware/scanner.ts` ships three classes:

1. **VirusTotalScanner** — real `https://www.virustotal.com/api/v3/files` POST + polling. Requires `VIRUSTOTAL_API_KEY`. Returns `infected` with the engine signature when ANY engine flags malicious.
2. **ClamavScanner** — real TCP INSTREAM to `clamd`. Defaults to `127.0.0.1:3310`. Handles "OK" / "FOUND <sig>" / "ERROR" exactly per protocol.
3. **NoneScanner** — explicit bypass that REJECTS unless `MALWARE_SCAN_DISABLED=1` is set in env. The audit row records the bypass so security can see development environments clearly.

Factory: `defaultScanner()` reads `MALWARE_SCANNER` env or falls back to ClamAV when `CLAMAV_HOST` is set, then VirusTotal when its key is set, else `NoneScanner`.

## 3. Provenance + audit

Every uploaded file produces:

- `ingestion.files` row (size + sha256 + scan status)
- `ingestion.malware_scans` row (scanner + status + signature + duration)
- `ingestion.extraction_telemetry` row per extractor invocation

The audit chain is the source of truth for compliance reviews.

## 4. Storage security

`lib/storage/object-store.ts` writes objects to:

- Path: `<user_id>/<file_id>/<version_number>/<sha256>`
- Bucket: configurable, default `ingestion`

Signed-URL retrieval enforces a TTL — the route MUST require auth before issuing one. The adapter does NOT issue a signed URL without authentication; it returns an opaque string the caller proxies behind their auth check.

## 5. Provider security

Each BYOM provider:

- Reads its credential exclusively via `lib/secrets/manager` (env → optional GSM).
- Returns `error_kind='not_configured'` if the credential is missing — no silent fallback.
- Uses fetch with an AbortController timeout (90s text, 300s audio, etc.) to prevent unbounded waits.
- Maps upstream status codes to discrete `error_kind`: `auth_failed`, `rate_limited`, `bad_request`, `upstream_error`, `timeout`.

Provider failures are recorded in `ops.llm_usage_meter` so a rogue auth-failure storm is observable.

## 6. Pre-launch checklist

- [ ] `MALWARE_SCAN_DISABLED` not set in production env.
- [ ] One of `CLAMAV_HOST` (recommended) or `VIRUSTOTAL_API_KEY` (slower; rate-limited) configured.
- [ ] `SUPABASE_STORAGE_BUCKET` exists and has correct RLS (owner read, service write).
- [ ] BAAs in place with active LLM providers if PHI may be uploaded.
- [ ] `models.tenant_model_overrides` configured for any tenant whose data residency requires Azure / Vertex (BAA channels).
- [ ] Pipeline alert wired: any `virus_scan_status='infected'` rows page on-call.

## 7. Known residual risks

- Reliance on third-party scanners for malware verdicts. Mitigation: defense in depth (size cap + mime classifier + extraction sandbox).
- Provider HTTP calls cross network boundaries. Mitigation: documented vendors only; TLS enforced by URL scheme.
- Synthetic OOXML buffers (test fixtures) may exhibit different DOM behavior than real Office output. The DOCX test is content-agnostic and accepts either successful extraction OR a clean structured parse error.
