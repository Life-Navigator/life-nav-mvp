# Pilot Analytics Readiness

**Sprint:** Finish Line · **Date:** 2026-06-16 · **Type:** AUDIT (no code changed)

**Question this answers:** Can the platform _measure_ the pilot? For each metric the team
needs, this states what is instrumented today (file:line), and — where it isn't — the
smallest honest way to capture it by reusing what already exists. No new infra is proposed.

---

## TL;DR verdict: **PARTIAL** (lean toward "no" for the human-judgment metrics)

The platform has a **genuinely good server-side event spine** — `analytics.user_events`,
a recommendation lifecycle state machine, advisor-turn telemetry, and an operator
dashboard. That covers the _behavioral_ funnel well.

It is **blind on the metrics that decide a pilot's fate**: there is **no feedback/NPS UI**
(the backend table and endpoint exist but nothing in the app calls them), **no
narrative-accuracy capture**, **no report-usage events**, and **no graph-usage events**.
The client-side `trackEvent` stub is **never called** and has **no provider wired**.

So we can answer "what did users _do_?" but not "did they _like / trust / value_ it?" —
which is the whole point of a pilot. Three small, honest wirings close most of the gap.

---

## What exists today (the real spine)

### 1. Server-side event stream — `analytics.user_events`

- Writer: `apps/web/src/lib/analytics/events.ts:50` (`recordUserEvent`) — best-effort,
  never throws, writes via the `analytics_user_events` view.
- Event enum: `events.ts:16-42` (28 types incl. `onboarding_*`, `recommendation_*`,
  `first_insight_viewed`, `first_chat_message`, `session_started`, `user_signed_up`).
- Schema/RLS: `supabase/migrations/098_internal_beta_instrumentation.sql`,
  `109_funnel_event_types.sql`, `110_*` (observability anchors).
- Coverage is **structurally enforced** by a grep-test:
  `apps/web/src/__tests__/lifecycle-and-telemetry-wiring.spec.ts:41-64` asserts each
  canonical event type has a producing route.

### 2. Recommendation lifecycle — `public.decision_outcomes`

- State machine `generated → viewed → accepted/dismissed/completed` via
  `transitionOutcome` (`lib/outcomes/decision-outcomes.ts`).
- View ping: `app/api/recommendations/[id]/view/route.ts:36` (idempotent, on viewport).
- Quality + outcome: `app/api/feedback/recommendation/quality/route.ts:50-117` writes
  `feedback_recommendation_quality` (helpfulness / clarity / trust / outcome) AND emits
  the matching user event.

### 3. Advisor-turn telemetry — `analytics.advisor_turns`

- One row per hybrid-advisor turn: `apps/lifenavigator-core-api/app/services/advisor_orchestrator.py:434-464`.
- Schema `supabase/migrations/160_advisor_turns.sql` — captures `llm_status`,
  `validator_result`, `fallback_reason`, `latency_ms`, `stages_ms`, tokens,
  `graph_edges_available`, `confidence`, and (service-role only) the message/response.
- **Service-role only** — no owner read. Good for ops, but it is _system_ telemetry,
  not _user judgment_.

### 4. Pilot feedback + NPS — backend ONLY (added today, no UI)

- Table + RLS + NPS rollup view: `supabase/migrations/20260616120000_pilot_routing.sql:54-101`
  (`analytics.pilot_feedback`, `pilot_feedback_summary`).
- Capture service: `apps/lifenavigator-core-api/app/services/pilot_service.py:30-56`
  (thumbs / trust_rating / usefulness_rating / recommendation_quality /
  advisor_comparison / **nps** / comment).
- Endpoint: `POST /v1/feedback` — `apps/lifenavigator-core-api/app/routers/analytics.py:34-42`.
- NPS math: `pilot_service.py:131-135` (promoters−detractors over responses).
- **GAP:** grep of `apps/web/src` for `trust_rating|usefulness_rating|advisor_comparison|nps|thumbs`
  - any call to `/v1/feedback` returns **zero** UI. The pipe exists; nothing pours into it.

### 5. Operator dashboards (read side)

- `GET /api/ops/dashboard` (`app/api/ops/dashboard/route.ts`) → `lib/ops/dashboard-queries.ts`
  (DAU/WAU, rec funnel counts, cost, **data_freshness per source** so "no users" is
  distinguishable from "wiring broken" — `dashboard-queries.ts:51-66`).
- `GET /v1/admin/pilot-analytics` → `PilotAnalyticsService.summary()` (advisor outcomes +
  safety + feedback/NPS rollup), admin-gated `analytics.py:45-58`.
- `GET /v1/admin/advisor-metrics` (fallback rate, latency p95, validator failure).

### 6. Two stubs that look like analytics but are NOT wired

- `apps/web/src/components/analytics/Analytics.tsx` — gtag page-view shell, gated on
  `NEXT_PUBLIC_ANALYTICS_ID` (not set) and `NODE_ENV==='production'`. `trackEvent`
  (`Analytics.tsx:77`) is **never imported/called** anywhere in `src`.
- `apps/web/src/lib/analytics/auth-events.ts` — header comment says "no-op in production
  until an analytics provider is wired up." Confirmed: no provider.
- A second, **parallel** event system exists in core-api: `POST /v1/events`
  (`analytics.py:20-31`, EVENT_TYPES incl. `report_generated`, `domain_viewed`,
  `share_created`) — but the **frontend never calls it** either. Two half-built event
  buses; neither is driven from the client.

---

## Per-metric readiness

Legend: ✅ instrumented · �440 partial · ❌ not captured.

### Feedback — ❌

- Today: backend `pilot_feedback` + `/v1/feedback` exist; **no UI** submits it.
  Closest live signal is structured recommendation feedback
  (`feedback/recommendation/quality/route.ts`) — but that is per-rec, not per-turn/session.
- Smallest honest capture: add a 1-line thumbs+comment widget on advisor turns and on
  the Life Brief that POSTs the existing `/v1/feedback` (or the existing
  `/api/feedback/recommendation`). **No new table, no new endpoint** — only a client call.

### NPS — ❌

- Today: `pilot_feedback.nps` column + `nps_score` rollup (`pilot_service.py:131-135`)
  fully implemented server-side; **no UI** ever sends `nps`.
- Smallest honest capture: a single end-of-session 0–10 prompt that POSTs `{nps}` to the
  **existing** `/v1/feedback`. Score auto-computes in the admin rollup. Zero backend work.

### Session Quality — �440

- Today: `session_started` and `first_chat_message` events exist
  (`governed-route.ts:339`), advisor-turn rows carry per-turn latency/validator/fallback
  (`advisor_orchestrator.py`). So "quality" as a _system_ measure (fallback rate, latency,
  turns-per-session) is derivable.
- Missing the _human_ half (was the session useful?) — covered by the Feedback fix above.
- Smallest honest capture: a saved view joining `advisor_turns` by `conversation_id`
  (turns/session, fallback%, p95 latency) — reuse `PilotAnalyticsService`, no new infra.

### Narrative Accuracy — ❌ (highest-value gap)

- Today: the narrative is surfaced with a confidence_pct + "Why Arcana believes this"
  (`DiscoveryReveal.tsx:223`, `LifeBrief.tsx:38-46`), but **the user is never asked
  whether it is right.** No "this is accurate / not me" capture anywhere.
- Smallest honest capture: a binary "Does this sound like you? 👍/👎 (+optional fix)" on
  the DiscoveryReveal hero and the LifeBrief, POSTing to `/v1/feedback` with
  `subject=narrative`. Reuses the feedback pipe; gives a per-user accuracy rate. **This is
  the single most important pilot metric and is currently uninstrumented.**

### Recommendation Quality — ✅

- Best-covered metric. `feedback_recommendation_quality` (helpfulness/clarity/trust/outcome)
  - lifecycle transitions + user events
    (`feedback/recommendation/quality/route.ts:50-117`). Acceptance/dismissal rates roll up
    in `dashboard-queries.ts` (`MetricCounts`).
- Caveat: requires the quality widget to actually be rendered on `/dashboard/recommendations`
  — verify it is mounted (route exists; confirm the component is shown to pilot users).

### Report Usage — ❌

- Today: report generation, preview, PDF and the new in-app viewer all exist
  (`app/dashboard/reports/[type]/page.tsx`, `app/api/reports/[type]/{preview,pdf}/route.ts`),
  but **none emit an event.** `recordUserEvent` is not called in any report route; the
  core-api `report_generated` type is never emitted from the client.
  No `report_viewed`/`report_downloaded` event type exists in the web enum
  (`events.ts:16-42`).
- Smallest honest capture: (a) call `recordUserEvent({event_type:'document_uploaded'...})`-style
  — but there is no report type in the enum, so the honest minimal move is one
  `recordUserEvent` with a generic event + `subject_kind:'report'` in the preview route and
  the PDF route. Requires adding the literal to the enum + the SQL CHECK (migration), which
  is small but is _not_ zero-migration. Cheapest no-migration alternative: log a
  `recommendation_viewed`-shaped row is wrong/dishonest — don't. Instead reuse the
  **core-api `/v1/events` `report_generated`** type (already in the CHECK) by having the
  viewer POST it. That path needs **no migration** (type already allowed) — only a client call.

### Graph Usage — ❌

- Today: `/life-graph/explainable/page.tsx` has **zero instrumentation** (no `trackEvent`,
  no `recordUserEvent`, no emit). We cannot tell if anyone opened the graph.
- Smallest honest capture: reuse core-api `/v1/events` `domain_viewed` (already in the
  CHECK, `analytics.py:18`) with `domain:'life_graph'` on page mount. No migration; one
  client call.

### Return Rate — �440

- Today: `session_started` + `user_signed_up` events exist; DAU/WAU computed in
  `dashboard-queries.ts:81-83` from `analytics_user_events`. Return rate (D1/D7) is
  **derivable** from these rows by user_id+occurred_at — IF `session_started` actually
  fires on each visit.
- Verify: confirm `session_started` is emitted on app load (grep found the type and a
  `first_*` emission, but a per-visit `session_started` producer should be double-checked).
  If it fires, return rate needs **only a query**, no new capture.

---

## Prioritized readiness checklist (smallest honest moves first)

| #   | Metric                     | Move                                                                                       | Cost                     | Migration?        |
| --- | -------------------------- | ------------------------------------------------------------------------------------------ | ------------------------ | ----------------- |
| P0  | **Narrative Accuracy**     | 👍/👎(+fix) on DiscoveryReveal + LifeBrief → existing `/v1/feedback` (`subject=narrative`) | 1 widget, 2 mount points | No                |
| P0  | **NPS**                    | end-of-session 0–10 prompt → existing `/v1/feedback` `{nps}`                               | 1 widget                 | No                |
| P0  | **Feedback (per-turn)**    | thumbs+comment on advisor turns → existing `/v1/feedback`                                  | reuse widget above       | No                |
| P1  | **Report Usage**           | viewer/PDF POST core-api `/v1/events` `report_generated`                                   | 1–2 client calls         | No (type allowed) |
| P1  | **Graph Usage**            | explainable page POST `/v1/events` `domain_viewed` (`life_graph`)                          | 1 client call            | No (type allowed) |
| P1  | **Recommendation Quality** | confirm the quality widget is actually mounted for pilot users                             | verify                   | No                |
| P2  | **Return Rate**            | confirm `session_started` fires per-visit; add D1/D7 query to ops dashboard                | 1 query                  | No                |
| P2  | **Session Quality**        | saved `advisor_turns`-by-conversation view in `PilotAnalyticsService`                      | 1 method                 | No                |

**Notable:** every P0/P1 here is achievable **without new infrastructure** because the
backend pipes (`pilot_feedback`, `/v1/feedback`, `/v1/events`, `analytics.user_events`)
already exist. The pilot's measurability is bottlenecked almost entirely on **client-side
calls that were never wired**, not on missing storage.

---

## Honest gaps (where nothing exists)

- **No analytics provider** (PostHog/Segment/GA) is configured. `NEXT_PUBLIC_ANALYTICS_ID`
  is unset; the gtag shell and `trackEvent` are inert. This is _fine_ for a small pilot —
  the server-side `analytics.user_events` spine is the source of truth — but it means there
  is **no session-replay, no funnel-viz tooling, no client error capture** out of the box.
- **Two parallel event buses** (`analytics.user_events` via `recordUserEvent` AND core-api
  `/v1/events`) with overlapping intent and **neither driven from the client UI**. Pick one
  per surface; don't wire both.
- **`advisor_turns` is service-role only** — great diagnostics, but it cannot be the source
  for user-perceived quality. Human judgment must come from `pilot_feedback`.
- **No narrative-accuracy or report/graph usage signal exists at all today** — these are
  true zeros, not partials.

---

## Final verdict

**PARTIAL.** Behavioral/funnel + recommendation-quality measurement is **ready**
(real, tested, dashboarded). Trust/judgment measurement — **NPS, narrative accuracy,
per-session feedback, report & graph usage** — is **not capturable today** despite the
backend being built, because **no UI sends the data**. The fix is small (client wiring to
existing endpoints, mostly migration-free), but until at least the three P0 widgets ship,
we can run the pilot but **cannot honestly report whether users trusted or valued it.**
Ship the P0 widgets before onboarding pilot users.
