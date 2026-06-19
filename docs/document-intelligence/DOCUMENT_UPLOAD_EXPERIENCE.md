# Document Upload Experience — state machine + what-changed mapping

Date: 2026-06-18
Goal: the upload must show WHAT CHANGED, not "Upload successful". Render ONLY what the API returns;
never fabricate a change.

## Files

- `apps/web/src/components/documents/UploadResult.tsx` — the result view (state machine + what
  changed + needs_review + honest empty/failed/PII states).
- `apps/web/src/components/documents/DocumentIntelligence.tsx` — host; calls `/api/documents`
  (proxy → Core `/v1/documents[/upload]`), then renders `<UploadResult res={result} />`
  (`DocumentIntelligence.tsx`, result block ~:255-271 after edit). Busy spinner while reading
  (`upload-busy`).
- `apps/web/src/components/documents/__tests__/UploadResult.test.tsx` — trust tests.

## Response shape consumed (defensive — all optional)

`UploadResponse` (`UploadResult.tsx:23-58`). Source of truth = core-api `register()` return
(`apps/lifenavigator-core-api/app/services/documents.py:374-381`):
`document_id, doc_type, category, fields_extracted, confidence, affects_domains, status,
status_reason, message, next_steps, processing_status[], fields[], changed[], needs_review[],
bridged_facts[]` plus PII-block fields `stored, pii_warning, requires_confirmation, detected[]`
(:281-285).

The component reads each only `if present`, so a still-evolving backend never crashes the UI.

## State machine

Terminal classification — `terminalOf()` (`UploadResult.tsx:74`):

- `failed` — `status === 'failed'`.
- `blocked` — `status === 'blocked_pending_confirmation'` or `requires_confirmation` (PII).
- `needs_review` — `status === 'needs_review'` OR no fields extracted.
- `completed` — otherwise (fields extracted).

Stage progression — `STAGE_ORDER` (`UploadResult.tsx:60-68`) and `stageStates()` (:84):
`uploaded → classified → text_read → facts_extracted → applied (to life model) →
readiness_updated → completed`, plus per-stage `failed`.

Derivation (conservative — never claims a later stage than the response supports):

- `uploaded` = always done.
- `classified` = done if `doc_type || category` present (`:113`).
- `text_read` = done if `processing_status` has a done "text" step, else if any `fields` exist;
  else `failed` on needs_review/failed terminal (`:106-108`, `:114`).
- `facts_extracted` = done if `fields_extracted > 0` (`:109`, `:115`).
- `applied` = done if `changed.length > 0` OR any `bridged_facts.ok` (`:110`, `:116`).
- `readiness_updated` = implied once applied; the host re-fetches `GET /api/documents` readiness
  after every upload (`DocumentIntelligence.tsx` `loadReadiness()` call in `submit`/`uploadFile`).
- `completed` = done only on the `completed` terminal (`:118`).
- On `blocked`/`failed`, no stage past `classified` is allowed to claim success (`:122-126`).

If the backend sends its own `processing_status` list, the UI prefers it verbatim (with its
`detail` text) over the derived stages (`UploadResult.tsx` `usingBackendSteps`, render :~197-203).

## What-changed mapping (the `changed` strings → meaning)

These come straight from core-api `_bridge` / `_bridge_family`; the UI renders them verbatim with a
`✓`:

| `changed` string                                                | Produced at        | Meaning                                            |
| --------------------------------------------------------------- | ------------------ | -------------------------------------------------- |
| `"<Label> detected"` (e.g. "Will detected")                     | `documents.py:413` | doc type recognized + at least one field extracted |
| `"<Field> identified: <value>"` (e.g. "Executor identified: …") | `documents.py:430` | a named field captured into `life.facts`           |
| `"Estate plan updated (will on file)"`                          | `documents.py:479` | `estate_plans.has_will = true`                     |
| `"Estate plan updated (trust recorded)"`                        | `documents.py:489` | trust attributes saved to estate metadata          |
| `"Guardian recorded: <name>"`                                   | `documents.py:507` | `guardianship_plans.designated_guardian` set       |
| `"Protection updated: life coverage $… on file"`                | `documents.py:541` | `insurance_profiles.life_coverage` set             |
| `"Family readiness will recalculate"`                           | `documents.py:541` | family readiness will recompute                    |
| `"Life insurance reviewed (existing coverage kept)"`            | `documents.py:527` | user's higher coverage preserved                   |

The UI does NOT hardcode this mapping — it renders whatever strings the API returns. The table is
for reconciliation with the backend agent only.

## Honest empty / needs-review / failed states (no fabrication)

- **Empty `changed`, non-failed** (`UploadResult.tsx` empty branch ~:233-237): renders the API
  `message` if present, else: _"Stored, but we couldn't extract structured details yet — it's queued
  for review, or you can add the details manually."_ Never invents a change. Headline =
  "Stored — needs a little help".
- **Failed terminal** (`:230-232`): API `message`, else _"We could not process this document…"_.
  Headline = "We couldn't process this document".
- **needs_review** (`UploadResult.tsx` needs-review block ~:247-263): lists each
  `{field_key, reason, confidence}`; shows "X% confidence" and a "(low confidence — confirm this
  value)" hint when `reason === 'low_confidence_or_scanned'`.
- **PII block** (`:160-181`): renders headline "Hold on — sensitive data detected", the API
  `message`, and each `detected` category + count. No success is shown.
- **next_steps** (`:266-276`): rendered only when the API provides them (typically on needs_review;
  e.g. scanned-document upgrade path from `documents.py:350`).

## Trust invariant tests (`UploadResult.test.tsx`)

1. completion renders the API `changed` items (and `changed-empty` is absent).
2. empty `changed` → `changed-empty` honest fallback; "Applied to your life model" NOT shown.
3. API `message` preferred in the empty fallback.
4. `needs_review` surfaces with confidence.
5. PII block shows detected categories, not success.
6. backend `processing_status` list is rendered when present.

## Response-shape assumptions (reconcile with backend agent)

- `changed: string[]` — human-readable, rendered verbatim. (Confirmed in `_bridge` :407, :434.)
- `needs_review: {field_key, reason, confidence}[]`. (Confirmed `_bridge` :428.)
- `processing_status: {step, done, detail?}[]`. (Confirmed `_processing_status` :300-309.)
- `status` values handled: `extracted`, `needs_review`, `blocked_pending_confirmation`, `failed`,
  plus any other → treated as needs_review unless fields exist. **`failed` is handled defensively
  but I did not find a code path that emits `status:'failed'`** — if the backend never emits it, the
  failed branch is simply unreachable (harmless). Confirm whether a hard-failure status is planned.
- `applied`-stage "done" is inferred from `changed`/`bridged_facts` (no explicit `applied` flag in
  the response). If the backend later adds an explicit applied/persisted flag, prefer it.
- `readiness_updated` is inferred (host re-fetches readiness); the response has no readiness-delta
  field. If the backend starts returning a readiness delta, surface it here.
