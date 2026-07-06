# RETENTION_ENGINE_REPORT.md — LifeNavigator MVP (20-User Internal Beta)

## TL;DR

LifeNavigator has the **UI surface** of a retention engine and almost **none of the engine behind it**. There is no scheduling layer anywhere in the repo, no working outbound channel, and the one genuinely strong return surface (the First Insight "Today's brief") shows the _same_ thing every visit because it is deterministic over static persona data.

For a 20-person internal beta, the correct strategy is **not** to build email/push infrastructure. It is to (1) make the in-app brief _change between visits_ and (2) drive returns with **manual founder touch** (you emailing 20 people by hand). Build infra only if the beta proves the mechanic.

---

## What actually exists (grounded)

### Return surfaces that WORK today

- **First Insight "Today's brief" card** — `apps/web/src/lib/finance/first-insight.ts` (deterministic rule ladder) rendered by `apps/web/src/components/dashboard/FirstInsightCard.tsx`. It is **recomputed server-side on every dashboard load** (`apps/web/src/app/dashboard/page.tsx:25`), and the card literally calls itself "Today's brief" (`FirstInsightCard.tsx:48`). This is the best-built retention asset in the repo.
- **Goals CRUD** — real and persisted: `apps/web/src/app/api/goals/route.ts` (GET/POST against `public.goals`), plus UI pages `apps/web/src/app/dashboard/goals/page.tsx` and `apps/web/src/app/goals/create/page.tsx`, components `CreateGoalModal.tsx` / `GoalDetailPanel.tsx`. Creation emits analytics events (`goal_created`, `goal_updated` in `apps/web/src/lib/analytics/events.ts:18-19`).
- **Chat / advisor** — `apps/web/src/app/api/agent/chat/route.ts` → `graphrag-query` edge function. A return reason, but **intermittently 502s (~1/3–1/2 success)** per known state, so it cannot be the _primary_ return hook.
- **Analytics event stream** — `recordUserEvent()` writes `analytics.user_events` (`events.ts:50`). `first_insight_viewed` fires every dashboard paint (`dashboard/page.tsx:27-37`).

### Scaffolding that exists but is NON-FUNCTIONAL

- **Email service** — `apps/web/src/lib/email/email-service.ts` is a full SendGrid/SMTP class with `sendGoalReminderEmail`, `sendNotificationEmail`, etc. **But:**
  - Every template is a stub: `apps/web/src/lib/email/templates/{welcome,goal-reminder,notification,password-reset,assessment-complete}.tsx` are all `// STUB` returning `null` (verified). `renderEmailTemplate` would render empty bodies.
  - `nodemailer` is **imported** (`email-service.ts:7`) but is **NOT in `apps/web/package.json` dependencies** (only `@types/nodemailer` in devDeps). `@sendgrid/mail` IS present (`package.json:49`). The SMTP path is effectively broken; the SendGrid path needs `SENDGRID_API_KEY` (unverified whether set on Vercel).
  - **Nothing in the retention path imports it.** The only caller of a `sendNotificationEmail`-named symbol is Google Drive's API param (`lib/integrations/google/drive.ts:354`), unrelated.
  - Module-scope instantiation (`export const emailService = EmailService.getInstance()`, `email-service.ts:253`) is the exact next-build/SDK-init footgun called out in your memory notes.
- **Notifications settings page** — `apps/web/src/app/dashboard/settings/notifications/page.tsx` is **purely cosmetic**: toggles for "Weekly Summary", "Financial Alerts", "Goal Completions", "Push Notifications" — all `defaultChecked`, no state, no persistence, and the "Save Preferences" button has **no onClick** (lines 116-120). It implies features that do not exist.
- **`goal_reminders` table** — `supabase/migrations/030_goals_risk.sql:57-72`: has `reminder_type`, `scheduled_at`, `sent_at`, `is_active`, an index on active reminders. **Nothing writes or reads it.** Dormant but a ready home for reminder state.

### Infrastructure that DOES NOT EXIST (verified absent)

- **No Vercel cron** — `apps/web/vercel.json` has no `crons` array; a repo-wide `grep "\"crons\""` returns nothing.
- **No Supabase pg_cron / pg_net** — no migration references either.
- **No Fly scheduled process** — `apps/api-gateway/fly.toml` / `apps/ingestion-worker/fly.toml` have no scheduler; no APScheduler/Celery/beat in `apps/api-gateway/app`.
- **No `/api/cron` route** in `apps/web/src/app/api`.
- **No push/web-push/FCM dependency** anywhere.
- **No retention/return analytics events** — the `UserEventType` enum (`events.ts:15-37`, mirrored in migration 098/109) has onboarding/goal/recommendation/simulation events but **no `session_resumed`, `day_N_return`, `daily_active`, or streak event.** You currently cannot even _measure_ return visits except by `first_insight_viewed` timestamps.

**Bottom line: there is no channel and no scheduler. Every out-of-app return mechanic is currently unbuildable without net-new infra.**

---

## Day 0 → Day 14 plan (20 non-technical users)

The honest constraint: with no channel, _out-of-app_ nudges = **you, manually**. Design around that.

| Day        | User goal                 | What brings them back                                | Codebase support                                                                      | Gap / manual fill                                                          |
| ---------- | ------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Day 0**  | First value in <10s       | Activate persona → see "Today's brief" First Insight | WORKS: activate-persona → `getFirstInsight` server-rendered (`dashboard/page.tsx:25`) | None — ship as-is. This is the hero moment.                                |
| **Day 1**  | "Is there more here?"     | Ask advisor about the insight; create first goal     | Chat (flaky 502); Goals CRUD works                                                    | **Manual:** founder sends a personal "what did you think?" email by hand.  |
| **Day 3**  | A _reason_ to reopen      | A brief that **says something new**                  | BLOCKER: brief is identical every visit (deterministic over static data)              | **P0 build:** rotate/vary the brief. See below.                            |
| **Day 7**  | Sense of progress         | "Here's what changed / your goal is X% there"        | Goals + `goal_updates` table exist; no weekly rollup                                  | **Manual:** founder sends a 1-paragraph weekly recap per user (20 emails). |
| **Day 14** | Decide it's worth keeping | Recommendation refresh / new insight angle           | No recommendation refresh/cron; rule ladder fixed                                     | **Manual + survey.** Beta exit interview > automated nudge.                |

---

## Build-vs-Have table per mechanic

| Mechanic                   | Scaffolding exists?                                | Functional?                                          | Min to ship for 20 users                                                                                   |
| -------------------------- | -------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Daily brief (in-app)**   | Yes — First Insight card                           | Yes, but **static across visits**                    | Add variation: rotate rule ladder or add a "since last visit" / streak line. **No infra.** ~1 day.         |
| **Daily brief (email)**    | Email service + stub templates                     | **No** (templates null, nodemailer missing, no cron) | Don't. For 20 users, paste the brief into a manual email. Building = channel + scheduler + real templates. |
| **Weekly insight**         | `goal_updates` table; analytics events             | **No** rollup, no scheduler                          | Founder writes 20 short recaps weekly from a Supabase query. ~30 min/wk.                                   |
| **Financial alerts**       | Settings toggle (cosmetic)                         | **No** — no balance-change detection, no channel     | Personas are static → no real "change" to alert on. **Skip for beta.**                                     |
| **Goal tracking**          | Full CRUD + UI + events + dormant `goal_reminders` | **Mostly yes** (CRUD works); reminders dormant       | Surface a "Your goals" progress strip on dashboard. ~1 day, no infra.                                      |
| **Recommendation refresh** | recommendations route + quality service            | **No** refresh/cron; fixed ladder                    | Tie to the varied brief (P0). No separate build.                                                           |

---

## Single highest-leverage feature to build first

**Make the "Today's brief" change between visits — entirely in-app, zero new infrastructure.**

Why: it is the only return surface already shipped, already server-rendered on first paint, and already framed as a daily brief. Its single fatal flaw for retention is that `first-insight.ts` is deterministic over _static_ persona data (`first-insight.ts:108-195`), so Day 3 looks exactly like Day 0. Fixing that needs **no email, no push, no cron** — it sidesteps every infra gap above.

Concrete minimal implementation:

1. Add a **secondary insight rotation**: the rule ladder currently `return`s the first match. Instead, collect _all_ matching rules and pick one by `dayOfYear % matches.length` (or rotate by visit count). The same persona surfaces a different true fact each day.
2. Add a **"since you were last here" line** using the existing `analytics.user_events` `first_insight_viewed` timestamps — even "Welcome back — day 3 of using your office" creates a return loop.
3. Add a **goal progress strip** beneath the brief reading `public.goals` (CRUD already works) so returning users see movement.

This is ~1–2 days of `apps/web` work, no new services, no secrets, and directly defeats the "identical brief" Day-3 churn.

---

## Ranked P0–P3

- **P0 — Vary the in-app brief between visits.** `first-insight.ts` returns the same headline every load for a static persona → Day-3 users see Day-0 content. Fix by rotating among all matching rules + a "welcome back" line. No infra. _Highest leverage, lowest cost._
- **P0 — Remove or honestly gate the cosmetic Notifications settings page.** `dashboard/settings/notifications/page.tsx` promises Weekly Summary, Financial Alerts, Push — none exist; Save button is a no-op. For non-technical beta users this is a trust-breaking lie. Either hide the page or label "Coming soon".
- **P1 — Surface a goals progress strip on the dashboard.** Goals CRUD + events already work (`api/goals/route.ts`); just read and render. Gives a true Day-7 "progress" return reason with no infra.
- **P1 — Add return-visit analytics so the beta is measurable.** Add a `session_resumed` / daily-active event to the enum (`events.ts` + migration mirror) so you can actually see who comes back on Day 1/3/7/14. Without it the beta yields no retention data.
- **P2 — Manual founder weekly recap.** Query Supabase, hand-send 20 emails. Replaces "weekly insight email" infra entirely for this scale.
- **P2 — If (and only if) the brief mechanic proves out: stand up ONE real channel.** Use the existing `@sendgrid/mail` path (already a dependency), implement the 2 templates you need (welcome, weekly), add a single Vercel cron (`crons` in `vercel.json`) hitting a new `/api/cron/*` route guarded by `CRON_SECRET`. Do NOT revive nodemailer (not installed).
- **P3 — Wire the dormant `goal_reminders` table + push notifications.** Real product features, wrong scope for 20 internal users. Defer.
- **P3 — Fix module-scope `emailService` instantiation** (`email-service.ts:253`) before any email work — matches your known next-build SDK-init crash pattern.

---

## Caveats / unverified

- Whether `SENDGRID_API_KEY` is set on Vercel prod is **unverified** (only env _references_ in code were checked).
- Whether the static-persona finance data ever changes post-activation (which would make the brief naturally vary) is **unverified** — but the known state ("sandbox transactions frequently do not persist") strongly implies it does not, reinforcing P0.
- Chat 502 flakiness is taken from known state, not re-measured here.
