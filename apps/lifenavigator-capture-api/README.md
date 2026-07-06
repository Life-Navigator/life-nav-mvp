# lifenavigator-capture-api (post-beta feature branch)

**Status: parked. Start after the 5-user beta.** This branch (`feat/capture-api-postbeta`) preserves the design
so the service can be rebuilt. It is intentionally **not on `main`** — it serves the mobile capture features, and
mobile is not shipping in the first-5 beta.

> **Honest note on the code:** this Rust/axum service was fully built once (2026-07-04 — it compiled, `docker
build` succeeded end-to-end, `/healthz` returned 200, voice + document resolvers were real V1) but the source
> was **never committed** and has since been lost; only local `target/` build artifacts remained. What follows
> is the recovered **design spec** — the starting point for the rebuild, not the original code.

---

## What it is

A dedicated **Rust/axum backend on Fly.io** for the mobile app's **capture** features, isolated from both the web
app and the advisor core-api. It writes to a shared Supabase `capture` schema; **the web app only renders.**

Four capture types:

- **Voice** — voice notes (transcript passthrough → confirm). _Real in V1._
- **Document scan** — OCR → structured fields → `documents.documents` + `document_fields`. _Real in V1._
- **Food / supplement photo** — meal logging. _Stub (`not_configured`), spine-ready — next milestone._
- **Body / BMI / progress** — geometry-based **estimates with confidence ranges, NOT medical-grade
  measurements** (2D-ellipse caveat is the liability shield; BMI from weight/height is the only exact number).
  _Stub, spine-ready — next milestone._

## Architecture — edge-first hybrid

The **phone** does the real-time camera intelligence: pose landmarks (MediaPipe / Apple Vision / MoveNet),
segmentation, calibration-marker detect (AprilTag / ArUco), food segmentation (YOLO-seg), on-device OCR (Apple
Vision / ML Kit), on-device STT, plus a capture-quality gate. The **Rust service is verifier / resolver /
persister / auditor only**. **CPU-only V1, no cloud GPU.** Cloud VLM (Gemini) is opt-in escalation for hard cases,
never the default — this sidesteps the org no-API-keys rule and the Gemini prepay blocker for the core path.

Future ONNX inference (body-fat / refined circumference regressor) stays behind a `onnx` cargo feature for
V1.5 — needs labeled ground truth (DEXA/tape) we don't have yet. Use `ort` (ONNX Runtime), Debian Docker base
(not musl) because `ort` links a native lib.

## Hard constraints (honor these on rebuild)

- **Encryption:** client-side encrypted raw assets by default; server-side decrypt only for explicitly opted-in
  enhanced processing. NOT zero-knowledge. Fly operates on derived landmarks/masks by default. Users can delete
  raw photos and keep derived metrics.
- **Fail-closed safety guard:** `raw_photo` (body/meal) uploads are REFUSED unless `client_encrypted`
  (`ALLOW_UNENCRYPTED_SENSITIVE` defaults false → 403). `raw_document` / `raw_audio` exempt in V1. This invariant
  must exist before body/meal resolvers are built.
- **Document scan** is a SEPARATE OCR/classification pipeline; it shares only auth / storage / audit / consent /
  confidence / session infra, not the internal pipeline.
- **V1 is synchronous** (no queue), but the session state machine lives in the schema so a queue drops in later
  without surgery.
- Config **reuses core-api env** (`SUPABASE_*` + `GEMINI_API_KEY`) — no new DB URL; talks PostgREST + Storage over
  `reqwest` like `apps/ingestion-worker`. Auth mirrors core-api `app/auth.py`: HS256, require `exp`+`sub`,
  `aud=authenticated`, `sub`→`user_id`.

## Shared `capture` schema spine

Migration to recreate: `supabase/migrations/<ts>_capture_spine.sql`, schema `capture`:

- `sessions` — state machine + `quality` jsonb + consent
- `assets` — `client_encrypted` flag + soft-delete `deleted_at`
- `derived_artifacts` — `produced_on` (device | server)
- `confidence` — score + band
- `audit_events`
- `consent`

RLS `user_id = auth.uid()` + service*role bypass + FORCE; expose `capture` to PostgREST (`config.toml`).
Domain-resolved rows live in `documents.*` / `nutrition.*` / `health.body_scan*\*`referencing a session id.
Buckets:`raw_document`/`raw_photo`→`documents`(private, 25MB);`raw_audio`→`ingestion`.

## Endpoints

`POST /v1/capture/sessions` · `POST /{id}/assets` (multipart) · `POST /{id}/derived` · `POST /{id}/resolve` ·
`DELETE /{id}/raw` · `GET /healthz`

## Module layout (from the original build)

`config` · `auth.rs` · `error` · `state` · `provenance` (tenant_for = user_id for B2C) ·
`supabase/{postgrest,storage}` · `ai/gemini` (optional VLM, flag-gated) · `capture/{model,store}` ·
`domains/{voice,document,meal,body}` · `routes/{health,sessions}` · `safety.rs` (fail-closed guard).
Deploy: Dockerfile (debian multistage, ~111MB image), fly.toml (port 8080, `/healthz`, min_machines 0,
shared-cpu-1x/512mb), `.dockerignore`, `.env.example`.

## Blockers to go live (were true at build time)

1. **Supabase key rotation** — migration is gated; service_role writes.
2. **Fly app + secrets** — `fly apps create lifenavigator-capture-api` then
   `fly secrets set SUPABASE_URL=… SUPABASE_JWT_SECRET=… SUPABASE_SERVICE_ROLE_KEY=…`.
3. **Schema confirmation** — `nutrition_logs` / `body_metrics` vs `health_meta` ambiguity needs web-team sign-off
   before meal/body resolvers write.

## Sequencing when resumed

Finish mobile shell + voice → document scan → then build body/meal on this same spine.
Rebuild order: (1) re-author the `capture_spine` migration, (2) scaffold the axum service + auth + safety guard,
(3) voice + document resolvers, (4) meal + body once the schema question is settled.
