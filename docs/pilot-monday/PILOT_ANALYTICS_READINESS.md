# PILOT ANALYTICS READINESS

**Scope:** End-to-end verification of every pilot metric: **Capture → Storage → Aggregation → Dashboard**.
**Metrics:** Narrative Accuracy, Trust, Recommendation Quality, Insight, Holy-Shit, Return Intent, NPS.
**Method:** Code-level trace grounded in `file:line`. AUDIT ONLY — no changes, no commit.
**Date:** 2026-06-18 · **Audience:** Monday 20-person pilot Go/No-Go. Cross-ref `docs/pilot-intelligence/`.

---

## 0. The pipeline (one canonical path)

```
Instrument components            apps/web/src/components/feedback/*Prompt.tsx
  → usePilotFeedback().submit     apps/web/src/lib/feedback/usePilotFeedback.ts
  → POST /api/feedback/pilot      apps/web/src/app/api/feedback/pilot/route.ts   (Next proxy, stamps nothing)
  → core-api POST /v1/feedback    app/routers/analytics.py:34  (user_id from JWT, NEVER body)
  → FeedbackService.submit()      app/services/pilot_service.py:59  (validate + insert)
  → analytics.pilot_feedback      migration 20260617130000 (metrics JSONB + insight_detected/surprised)
Aggregation:
  PilotAnalyticsService.summary() app/services/pilot_service.py:111
    + analytics.pilot_feedback_summary  view (migration 20260616120000:87)
Dashboard:
  GET /v1/admin/pilot-analytics   app/routers/analytics.py:45  (admin-gated)
  → /api/admin/pilot-analytics    apps/web/src/app/api/admin/pilot-analytics/route.ts (proxy, passes 403)
  → /dashboard/pilot-analytics    apps/web/src/app/dashboard/pilot-analytics/page.tsx (gates + honest empty)
```

**Migrations confirmed present in repo:**

- `supabase/migrations/20260617130000_pilot_feedback_metrics.sql` — adds `kind`, `metrics JSONB`, `context JSONB`, `insight_detected BOOLEAN`, `surprised BOOLEAN` + index; idempotent (`ADD COLUMN IF NOT EXISTS`). **Stated APPLIED in prod.**
- `supabase/migrations/20260616120000_pilot_routing.sql:87` — defines the `analytics.pilot_feedback_summary` view (totals, thumbs, avg trust/usefulness/recommendation_quality/nps, **nps_promoters / nps_detractors / nps_responses**) + RLS/grants (owner SELECT/INSERT; service_role ALL).

---

## 1. Per-metric end-to-end trace

For each metric: where it is captured, the exact field it maps onto, how it is stored/validated, how it aggregates, and how the dashboard renders + gates it.

| Metric                     | Capture (component)                                                                           | Payload field                    | Validation (`pilot_service.py`)                                                    | Storage                    | Aggregation                                                                                     | Dashboard gate                                                         |
| -------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Narrative Accuracy**     | `NarrativeAccuracyPrompt.tsx:36-37` `kind='narrative_accuracy'`, `metrics.narrative_accuracy` | `metrics.narrative_accuracy`     | `_metrics()` `:43` keeps key (in `_METRIC_KEYS` `:15`), 0–10 int (`_rating` `:23`) | `metrics` JSONB            | `_aggregate_instruments` `:145` averages                                                        | `PRIMARY_GATES` key `narrative_accuracy`, `> 8.5` (`page.tsx:65-71`)   |
| **Trust**                  | `TrustPrompt.tsx:39,43` `kind='trust'`, `metrics.trust`                                       | `metrics.trust`                  | same path; key in `_METRIC_KEYS`                                                   | `metrics` JSONB            | averaged                                                                                        | gate `> 8.0` (`page.tsx:72`)                                           |
| **Recommendation Quality** | `RecommendationQualityPrompt.tsx:45,50` `metrics.recommendation_quality`                      | `metrics.recommendation_quality` | in `_METRIC_KEYS`; 0–10                                                            | `metrics` JSONB            | averaged                                                                                        | gate `> 8.0` (`page.tsx:73-79`)                                        |
| **Return Intent**          | `ReturnIntentPrompt.tsx:30-32` `metrics.return_intent`                                        | `metrics.return_intent`          | in `_METRIC_KEYS`; 0–10                                                            | `metrics` JSONB            | averaged                                                                                        | gate `> 8.0` (`page.tsx:80-86`)                                        |
| **Insight**                | `InsightPrompt.tsx:30-31` `kind='insight'`, `insight_detected` (bool)                         | `insight_detected`               | `_bool()` `:33`; row col                                                           | `insight_detected` BOOLEAN | `insight_rate` = yes/total (`:157-167`)                                                         | rate gate `> 70%` (`page.tsx:96-100`)                                  |
| **Holy-Shit**              | `HolyShitPrompt.tsx:30-31` `kind='holy_shit'`, `surprised` (bool)                             | `surprised`                      | `_bool()`; row col                                                                 | `surprised` BOOLEAN        | `holy_shit_rate` = yes/total (`:160-168`)                                                       | rate gate `> 50%` (`page.tsx:101-107`)                                 |
| **NPS**                    | `NpsPrompt.tsx:17-23,29-30` `kind='nps'`, `nps` (scale 0–10)                                  | `nps`                            | `_rating(...,0,10)` `:77` (dedicated col, NOT metrics)                             | `nps` column               | view `nps_promoters/detractors/responses` `:96-98`; `summary()` computes `nps_score` `:131-133` | gate `> 50` (`page.tsx:87-93`, special-cased `resolveGate` `:283-289`) |

**Findings on this table:**

- **No missing metrics.** Every one of the 7 named metrics has a component, a payload field, validation, storage, aggregation, and a dashboard gate. The metric keys are consistent across all three layers: component (`metrics.<key>`) = `_METRIC_KEYS` (`pilot_service.py:15-20`) = dashboard `Averages`/`PRIMARY_GATES` (`page.tsx:19-31,64-108`).
- **No fabricated values.** `_metrics()` drops unknown keys and out-of-range scores (`test_feedback_metric_validation_drops_bad_keys_and_ranges`); empty submissions are rejected (`:87-89`, `test_feedback_empty_rejected`); the dashboard never invents numbers (see §2).
- **NPS correctly isolated** from the 0–10 `metrics` scale — it has its own column + its own gate math, so a 0–10 NPS is not double-counted as a 0–10 instrument average.

**Aggregation tested:** `test_aggregate_instruments_computes_rates` (averages + insight_rate `2/3` + holy_shit rates), `test_pilot_analytics_summary_shape` (NPS `100*(promoters-detractors)/n`), `test_feedback_accepts_instruments`, `test_feedback_instrument_only_signal_saves`.

---

## 2. Honest empty states (no fabrication on the dashboard)

`apps/web/src/app/dashboard/pilot-analytics/page.tsx`:

- **Global empty:** `totalRows === 0` → `pilot-empty` block "No responses yet" (`:311-321`). No gates scored.
- **Per-gate empty:** `resolveGate` returns `pass: null` when `responses === 0` or value is null/undefined (`:279-295`); `GateCard` renders "No responses yet / Awaiting pilot feedback" and is **not** scored pass/fail (`hasData = responses > 0 && pass !== null`, `:146,174-179`).
- **Response counts shown on every gate** so thin data is visible (`:169-171`).
- **403 → honest "admin only"** state (`:220-222,246-254`); proxy passes the upstream 403 straight through (`api/admin/pilot-analytics/route.ts`). The endpoint is admin-gated server-side (`analytics.py:54`, `is_admin`).
- Backed by `__tests__/page.test.tsx`.

**Verdict on dashboard integrity:** clean. Counts/rates only, no PII, no fabricated numbers, no fake gate passes.

---

## 3. FLAGGED ISSUE — silent feedback loss

**Claim in the brief:** `/api/feedback/pilot` returns `{ok:true, stored:false}` even on a core-api write failure.

**Confirmed, and the mechanism is broader than the brief states.** Two layers each independently mask a persistence failure:

1. **core-api swallows DB failures as success.** `FeedbackService.submit()` (`pilot_service.py:103-104`):

   ```python
   except Exception:  # noqa: BLE001 — never fail the user's feedback action
       return {"ok": True, "stored": False}
   ```

   Any insert exception (RLS denial, missing column, connection error) returns **HTTP 200** with `ok:true, stored:false`. The legacy-column retry (`:99-102`) also returns `stored:false` if even the legacy insert yields nothing — again HTTP 200.

2. **Next proxy passes the 200 through; the catch only covers network errors.** `api/feedback/pilot/route.ts:18-25` forwards the upstream status/body verbatim; the `{ok:true, stored:false}` fallback at `:26-28` fires **only** when the `fetch` itself throws (core-api unreachable). So in the DB-failure case the client receives the upstream 200.

3. **The client treats HTTP 200 as success regardless of `stored`.** `usePilotFeedback.ts:33-36` sets status from `r.ok` (HTTP-level) and **never inspects `stored`**. So the UI shows "submitted/done" even though the row was never written.

**Net effect:** if `analytics.pilot_feedback` writes fail at pilot time (e.g. the metrics migration somehow not applied on the live DB, an RLS/grant gap, or a transient DB error), the user sees success, the feedback is silently dropped, and the dashboard shows fewer rows / "No responses yet" — with **no signal** that data was lost. There is also no server-side error log on this path (the `except` is silent).

**Severity for pilot analytics integrity: MEDIUM–HIGH (conditional).**

- It does **not** corrupt analytics — a lost row never produces a wrong number; the dashboard's honest empty states stay honest. So it cannot fabricate a false gate pass.
- It **can** undermine the pilot's _measurement_ purpose: with only ~20 participants, a partial silent write failure could quietly halve the sample and make gates read "No responses yet" or skew averages, and nobody would know capture was broken vs. participants simply not responding.
- The risk is gated almost entirely on whether `analytics.pilot_feedback` writes actually succeed in prod. The brief states migration `20260617130000` is APPLIED, and grants exist (`20260616120000:83-84`), so the **expected** path stores fine (`test_feedback_valid_payload_stored`, `test_feedback_accepts_instruments` both assert `stored is True`). The danger is purely the _undetectability_ if something is off live.

**Recommended (NOT applied — feeds Go/No-Go):**

- Pre-pilot: run **one live write smoke** (submit one of each instrument as a real user, then confirm rows land in `analytics.pilot_feedback` and surface on `/dashboard/pilot-analytics`). This closes the only realistic way the silent-loss path bites.
- Post-pilot hardening (not a blocker): log on the `except` in `pilot_service.py:103`; have the client surface `stored===false` as a soft retry/warning; or distinguish "accepted-not-stored" with a non-200 in a way that still doesn't fail the user's action.

---

## 4. Other integrity checks

- **user_id provenance:** stamped from the verified JWT (`analytics.py:42` `str(user.user_id)`), never from the body — confirms the owner-scoping claim; no client can spoof attribution.
- **Graceful pre-migration degradation:** `summary()` wraps each read in try/except and returns `{}` for instruments if the table/columns are absent (`pilot_service.py:138-142`); legacy-column retry on insert (`:99-102`). So a not-yet-applied migration degrades to empty, not to error.
- **Admin gating:** both `/v1/admin/pilot-analytics` and `/v1/admin/metrics` require `is_admin(user.email)` and log granted/denied (`analytics.py:53-58,69-73`).
- **Metric-key drift risk:** component keys, `_METRIC_KEYS`, and dashboard gate keys are three separate hand-maintained lists. They currently agree, but there is no shared constant binding them — a future rename in one place would silently drop a metric. Low risk for Monday (verified aligned now); worth a shared enum later.

---

## 5. Verdict

**ANALYTICS: READY for the pilot — with one required pre-pilot smoke.**

- All 7 metrics are fully wired end-to-end (capture → store → aggregate → gated dashboard), keys aligned across all layers, validated, and tested (523 core-api + pilot-service suite + dashboard render tests all green).
- The dashboard is fabrication-free with correct honest empty states and admin gating.
- The migrations are present in-repo and the metrics migration is reported applied in prod.
- The **one** integrity caveat is the **silent feedback-loss path** (core-api returns 200 on a swallowed DB failure; client never checks `stored`). It cannot produce wrong numbers, but it can silently _shrink the sample undetected_. This is fully mitigated by a single **live write smoke** before Monday. With that smoke passing, analytics is **GO**; without it, treat as **BLOCKED on verification** (not on code).
