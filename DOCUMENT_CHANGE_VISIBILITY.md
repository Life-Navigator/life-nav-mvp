# Document Change Visibility — The "What Changed" Moment (Design Spec)

**Grounded finding.** The upload moment is already excellent: `documents.py:register` returns `changed[]`, `needs_review[]`, `bridged_facts[]`, `processing_status[]`, and `next_steps[]`, and `UploadResult.tsx` renders them as an honest state machine ("Uploaded → Classified → Text read → Facts extracted → Applied to life model → Readiness updated → Completed") plus a "What changed" checklist and a "Needs your review" panel. **The visibility problem is not the upload moment — it is everything after it.** Once the user navigates away, the only durable trace of an upload is "N documents on file" (`my_life.py` / `advisor_facts.py`) and whichever Family columns happened to have a home. The detailed `changed[]` ("Beneficiaries identified: Jane Doe", "Guardian recorded: …") evaporates. This spec makes the change _persist and re-appear_ on the surfaces the user actually returns to — reusing data that is already written (`life.facts`, `documents.documents`, `life.readiness_snapshots` (163), `field_conflicts`), with **no new infrastructure**.

---

## Principle: every upload produces a durable, cited "What Changed" record — never silent processing

The system already computes the change list per upload. Today it is thrown away after render. The fix is to (a) **persist** the change list, and (b) **re-surface** it on return surfaces (Family timeline, dashboard activity, the document's own evidence drawer). Everything below reuses existing rows.

---

## Surface 1 — The upload result (EXISTS, keep + small additions)

`UploadResult.tsx` already does this well. Additions, all from data the API already returns:

- **Before → After deltas.** The bridge knows the prior Family value (read-before-write in `_upsert_insurance` already compares `existing.life_coverage`). Return `before`/`after` in `changed[]` payloads (e.g. `{label, before: "$250,000", after: "$500,000"}`) so the card shows "Life coverage $250,000 → $500,000" instead of a flat statement. Source: `documents.py:_upsert_insurance`.
- **Per-change "View" deep-link.** Each `changed[]` family item links to `/dashboard/family` (estate/protection tab); each `life.facts` item links to the Evidence drawer (already wired via `docId`). No new endpoint.
- **Inline conflict pickup.** `ConflictReview.tsx` already remounts on the new `document_id`. Promote any _new_ conflict into the `UploadResult` "What changed" block (the API already re-scans in `register`) so a contradiction is shown in the same moment, not only below the fold.

## Surface 2 — Family Timeline / Activity (the durable return surface)

There is **no Family Timeline component today** (grep found none under `apps/web/src/app/dashboard/family` or `components/family`). But `documents.py:timeline()` (`GET /v1/documents/timeline`) already returns a sorted, dated, confidence-scored document list. **Reuse it** as a "Family activity / what changed" strip:

- **Data source (existing):** `GET /v1/documents/timeline` (filter to family categories: `insurance`, `family_office`) + `changed[]` persisted per document.
- **Persist the change list (no new table):** stash the upload's `changed[]` into `documents.documents.extracted_json` under a `change_summary` key at register time — a column that already exists. The timeline endpoint then returns each document with its change summary.
- **Render:** a vertical timeline on the Family Overview: "Jun 21 — Will uploaded · will on file, guardian recorded: Jane Doe · readiness +12 → Family 64%". Each entry links to the document's Evidence drawer.
- **Empty state:** "No family documents yet — upload a will, trust, or life insurance policy to start your estate timeline." (links to `/dashboard/family/documents`).

## Surface 3 — Dashboard activity (turn the count into the change)

`my_life.py` already emits a documents tile ("N documents on file", CTA `/dashboard/documents`). Upgrade it to a **"Recently applied to your life model"** feed using rows that already exist:

- **Source:** `documents.documents` ordered by `updated_at` (last 5) + their persisted `change_summary` + `affects_domains`.
- **Render:** "Life insurance policy · applied to Family + Finance · coverage $500,000 · 2h ago — View evidence". This makes the moat (real extracted detail) visible on the home surface instead of a bare count.
- **Honest empty:** "Upload a document and you'll see exactly what changed here." No fabrication.

## Surface 4 — Readiness delta badge (reuse readiness_snapshots 163)

`life.readiness_snapshots` (migration 163) is the shared TS↔Python readiness record, UPSERTed per compute. To show "readiness changed" durably:

- On upload, after `_bridge`, the web tier already recomputes readiness (the component re-fetches `GET /v1/documents`). Capture the **prior** snapshot from `readiness_snapshots` and diff: "Family readiness 52% → 64% (+12) after your will upload."
- **No new infra** — the snapshot table already stores `score`, `status`, `generated_at`; the delta is `current - previous` for the domain.
- Render the delta in `UploadResult` (immediate) AND on the Family timeline entry (durable).

## Surface 5 — The document's own page (Evidence drawer, EXISTS)

`DocumentEvidence.tsx` already shows every field with provenance + review status. Add a header line: **"This document changed: Family readiness, life coverage, guardianship"** derived from the persisted `affects_domains` + `change_summary`. Zero new data.

---

## What to persist (and where) — no new tables

| Datum                                   | Where it goes (existing)                                         | Read by                                   |
| --------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------- |
| `change_summary` (the `changed[]` list) | `documents.documents.extracted_json.change_summary`              | timeline, dashboard feed, evidence header |
| readiness delta                         | computed from `life.readiness_snapshots` prev vs current         | UploadResult + timeline badge             |
| before/after value                      | already computed in `_bridge`/`_upsert_*`; return in `changed[]` | UploadResult                              |
| new conflicts                           | `documents.field_conflicts` (exists)                             | ConflictReview (exists)                   |

---

## Empty / In-Progress / Complete (per surface)

- **Upload result:** Empty → "Stored, but we couldn't extract structured details yet" (already implemented, honest); In-Progress → `needs_review` panel; Complete → "Applied to your life model" + checklist + deltas.
- **Family timeline:** Empty → estate-timeline CTA; In-Progress → entries flagged `needs_review`; Complete → dated change entries with readiness deltas.
- **Dashboard feed:** Empty → "Upload a document and you'll see what changed here"; Complete → recent applied-changes list.
- **Readiness badge:** Empty → no badge (no prior snapshot); Complete → "+12 → 64%".

## Hard rules honored

- Render ONLY what the API returns (UploadResult already enforces this — keep it for every new surface).
- Never claim a stage the response didn't support (`stageStates` logic).
- Honest empty states everywhere; zero fabricated changes.
- No new database, model, or service — every datum above is already written or trivially derivable from existing rows.

## Biggest single win

Persisting `changed[]` into the existing `extracted_json.change_summary` column unlocks Surfaces 2, 3, and 5 at once and is the lowest-effort path to "no silent processing." Pair it with the `life.facts` reader (see MCP_RENDER_AUDIT) and the upload's detail stops evaporating.
