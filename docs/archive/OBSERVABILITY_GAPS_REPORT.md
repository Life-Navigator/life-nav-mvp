# OBSERVABILITY_GAPS_REPORT.md — LifeNavigator 20-User Internal Beta

**Scope:** Can a no-operator 20-user beta answer the standard activation/retention questions from data we _actually capture today_? Every claim below is grounded in code on branch `mvp`.

## How telemetry works today

User-visible events are appended to `analytics.user_events` via the public view `analytics_user_events`, written by `recordUserEvent()` (`apps/web/src/lib/analytics/events.ts:50-69`). Writes are **best-effort** — a failure is swallowed (`catch {}`, `events.ts:66`), so the runtime path never depends on telemetry. The event-type whitelist is enforced by a Postgres CHECK calling `analytics.is_event_type()` (`098:56`), last extended in migration `109_funnel_event_types.sql` to include `sample_financial_profile_selected`, `sample_financial_profile_activated`, `first_insight_viewed`, `first_chat_message`. Grants + an INSERT RLS policy for `authenticated` were added in `107` (`107:11-54`).

The recommendation lifecycle has a richer model: `public.decision_outcomes` (one row/rec, with `generated_at/viewed_at/accepted_at/...`) plus a `decision_outcome_events` transition trail (`098:95-153`). Economic cost is metered to `economic.usage_events` via `recordUsage()` (`apps/web/src/lib/economic/usage-meter.ts:62`).

## Funnel table — can we answer it?

| Question                                           | Answerable today? | Source / Gap                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Who signed up?                                     | **PARTIAL / GAP** | No `user_signed_up` event. `auth/confirm/route.ts:40-52` emits nothing. Only inferrable from `profiles.created_at` / `auth.users.created_at`, which are **not** in the analytics stream — needs a cross-schema join.                                                                               |
| Who activated?                                     | **YES**           | `sample_financial_profile_activated` fired server-side in `activate-persona/route.ts:119-132` (service role, bypasses RLS — reliable). Also `profiles.setup_completed=true` (`route.ts:114`).                                                                                                      |
| Which persona?                                     | **YES**           | `event_metadata.persona_id` on activation (`route.ts:123`); also `public.user_persona_profile.persona_id` (migration 108).                                                                                                                                                                         |
| Time to activation                                 | **PARTIAL**       | activation event has timestamp, but the start anchor (signup) is not an event — needs `auth.users.created_at` join.                                                                                                                                                                                |
| Time to first value (First Insight viewed)         | **YES**           | `first_insight_viewed` fired **server-side** on dashboard first paint (`dashboard/page.tsx:27-37`), gated on `firstInsight.has_data`. Reliable (service role).                                                                                                                                     |
| Time to first recommendation                       | **YES (mostly)**  | `recommendation_generated` fired server-side in the governed pipeline (`route-guard.ts:218-228`) + `decision_outcomes.generated_at`. First rec is kicked off best-effort at activation (`activate-persona/route.ts:143-151`).                                                                      |
| Time to first chat                                 | **NO — GAP**      | `first_chat_message` is in the enum (`events.ts:25`) and CHECK (`109:19`) but has **ZERO call sites**. The chat route `apps/web/src/app/api/agent/chat/route.ts` emits no analytics at all.                                                                                                        |
| First-day retention                                | **NO — GAP**      | No login/session/`last_seen` event exists anywhere in `apps/web/src/app/api` or `lib/analytics`. Cannot compute D1 return.                                                                                                                                                                         |
| Drop-off: registration→persona-**select**→activate | **PARTIAL**       | `sample_financial_profile_selected` is declared (`events.ts:22`, `109:18`) but **never emitted** — `SampleFinancialProfile.tsx:52-69` only POSTs `activate-persona`. Cannot separate "saw the picker / chose" from "activated".                                                                    |
| Drop-off: activate→dashboard→insight→chat          | **PARTIAL**       | activate ✓, insight ✓, dashboard-view = inferred from `first_insight_viewed` (no standalone `dashboard_viewed`), chat = GAP.                                                                                                                                                                       |
| Error frequency — chat 502s                        | **NO — GAP**      | The known intermittent 502 returns at `governed-route.ts:223-228` (`model_call_failed`, status 502) **before** `recordUsage` runs (`:250-263`). So a failed model call writes **no** `economic.usage_events` row and **no** user_event. We are blind to the precise failure we already know about. |
| Error frequency — activation failures              | **NO — GAP**      | `activate-persona/route.ts:164-167` only `console.error`s and returns `internal_error`; no event. `grep` for `activation_failed` returns nothing.                                                                                                                                                  |
| Budget 429 frequency                               | **PARTIAL**       | 429 `budget_exceeded` returns at `governed-route.ts:206` before any usage row; not separately counted.                                                                                                                                                                                             |

## What IS solid

Onboarding (`onboarding_started` once on first in-progress section write, `sections/route.ts:89-95`; `onboarding_completed`, `complete/route.ts:51-55`), `plaid_connected` (`exchange/route.ts:41`), persona activation, first-insight view, and the full recommendation lifecycle (generated/viewed/accepted/ignored/dismissed/completed via `decision_outcomes` + events) are well wired and mostly **server-side** (reliable). Server-side emission via the **service role** (activation, first_insight) bypasses RLS and is the most reliable; events on the cookie-auth `supabase` client (onboarding, recommendation_viewed) depend on the user session + the `user_events_insert_own` policy (`107:52-54`) and the best-effort swallow means a silent drop is invisible.

## Exact missing events to add

1. **`user_signed_up`** (P0). Fire in `apps/web/src/app/auth/confirm/route.ts` after `getUser()` succeeds for `type==='signup'`. Payload: `{ event_type:'user_signed_up', user_id:user.id, event_metadata:{ method:'email' } }`. This anchors _every_ time-to-X metric in one stream. (Requires adding the literal to `events.ts` + `analytics.is_event_type()` in a new migration.)

2. **`first_chat_message`** (P0). Fire **server-side** in `apps/web/src/app/api/agent/chat/route.ts` (or in `createGovernedHandler` success path) on the user's first chat. Cheapest correct impl: in the chat route after a successful produce, `INSERT ... ON CONFLICT DO NOTHING` keyed on user, or check "no prior `first_chat_message` for this user". Payload: `{ event_type:'first_chat_message', subject_kind:'advisor_message', event_metadata:{ conversation_id } }`. The literal already exists in enum + CHECK, so no migration needed.

3. **`chat_error` / `model_call_failed`** (P0). The 502 path `governed-route.ts:223-228` must record before returning. Add a `recordUsage(... metadata:{ outcome:'model_call_failed', message })` _and/or_ a user_event (new type `model_call_failed`) so the known chat 502 is countable. Include `feature_key` and `provider` (already in scope as `options.feature_key`, `provider`).

4. **`sample_financial_profile_selected`** (P1). Emit when the user confirms a persona selection. Easiest reliable spot: server-side at the _top_ of `activate-persona/route.ts` before persistence (so a select that later fails activation is still counted), OR a tiny client call in `SampleFinancialProfile.tsx:52`. Payload: `{ persona_id }`. Literal already whitelisted.

5. **`persona_activation_failed`** (P1). In `activate-persona/route.ts:164` catch block, record `{ event_type:'persona_activation_failed', event_metadata:{ persona_id, message } }` (new enum type → migration).

6. **`session_started` / `dashboard_viewed`** (P1, retention). No event today supports D1 retention. Add a lightweight `session_started` on authenticated app load (e.g. in `middleware.ts` throttled, or a `dashboard_viewed` server event in `dashboard/page.tsx` alongside the existing first_insight write).

## Proposed funnel + TTFV view

A view doesn't exist (`grep funnel supabase/migrations` → only the enum migration). Once `user_signed_up` + `first_chat_message` are emitted, this computes the funnel and TTFV per user:

```sql
CREATE OR REPLACE VIEW public.beta_funnel AS
WITH e AS (
  SELECT user_id, event_type, MIN(occurred_at) AS t
  FROM analytics.user_events
  GROUP BY user_id, event_type
)
SELECT
  p.id AS user_id,
  au.created_at                                        AS signed_up_at,
  MAX(t) FILTER (WHERE event_type='onboarding_started')              AS onboarding_started_at,
  MAX(t) FILTER (WHERE event_type='sample_financial_profile_selected')  AS persona_selected_at,
  MAX(t) FILTER (WHERE event_type='sample_financial_profile_activated') AS activated_at,
  MAX(t) FILTER (WHERE event_type='first_insight_viewed')           AS first_insight_at,
  MAX(t) FILTER (WHERE event_type='recommendation_generated')       AS first_rec_at,
  MAX(t) FILTER (WHERE event_type='first_chat_message')             AS first_chat_at,
  -- TTFV: signup -> First Insight viewed
  EXTRACT(EPOCH FROM (
    MAX(t) FILTER (WHERE event_type='first_insight_viewed') - au.created_at
  )) AS ttfv_seconds
FROM public.profiles p
JOIN auth.users au ON au.id = p.id
LEFT JOIN e ON e.user_id = p.id
GROUP BY p.id, au.created_at;
```

Funnel counts (drop-off) then become `COUNT(signed_up_at)`, `COUNT(activated_at)`, etc. Chat-502 rate = `COUNT(metadata->>'outcome'='model_call_failed') / COUNT(*)` over `economic.usage_events` once finding #3 lands.

## Ranked gaps

- **P0** No signup event (anchor for all TTX); `first_chat_message` never emitted; chat 502s not captured.
- **P1** `sample_financial_profile_selected` never emitted; no retention/session event; activation failures uninstrumented.
- **P2** No funnel/TTFV SQL view; 429 budget rejections not separately counted.
- **P3** Best-effort swallow (`events.ts:66`) hides silent client-side event drops — acceptable but worth a debug counter.
