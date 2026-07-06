# P0 ONBOARDING INCIDENT — Investigation + Live Verification — 2026-06-10

## Root Cause (honest)

**Onboarding is NOT broken on production — the full flow runs end-to-end.** I verified the entire flow
against live `app.lifenavigator.tech` with a brand-new user (below). The most likely reason the flow
appeared "not running" for the reporter: **their account already has `onboarding_completed=true`** (they
completed or skipped the advisor in a prior session), so the gate correctly sends them straight to the
dashboard — or they were viewing a cached/older build.

A first investigation pass hypothesized the middleware was dead because the gate lives in `src/proxy.ts`
(not `middleware.ts`) and a stale local `.next/middleware-manifest.json` was empty. That hypothesis was
**wrong**: Next.js **16.2.6 supports the `proxy.ts` convention** (`PROXY_FILENAME='proxy'`), and a live
runtime test proves the gate IS active (it redirects). Lesson reinforced: verify runtime behavior, not a
stale build artifact.

## Route Audit (live, fresh user)

| Route                                    | Expected state                      | Actual                                               | Pass |
| ---------------------------------------- | ----------------------------------- | ---------------------------------------------------- | ---- |
| `/dashboard` (auth, no persona)          | redirect to persona selection       | → `/onboarding/financial-profile`                    | ✅   |
| `/dashboard` (auth, persona, no advisor) | redirect to advisor                 | → `/dashboard/advisor?onboarding=1`                  | ✅   |
| `/dashboard/advisor?onboarding=1`        | full-screen advisor, first question | renders immersive, discovery-chat 200, input present | ✅   |
| `/dashboard` (advisor complete/skip)     | dashboard accessible                | lands `/dashboard`, no crash                         | ✅   |
| `/auth/confirm` (verified, no setup)     | → persona selection                 | redirects `/onboarding/financial-profile`            | ✅   |

## State Field Audit

| Field                           | Written by                                                     | When                 | Read by                           |
| ------------------------------- | -------------------------------------------------------------- | -------------------- | --------------------------------- |
| `profiles.setup_completed`      | `activate-persona` route (only)                                | persona activation   | middleware gate, `/auth/confirm`  |
| `profiles.onboarding_completed` | `onboarding/advisor-complete` (+ legacy `onboarding/complete`) | advisor confirm/skip | middleware gate                   |
| `life.life_objectives` rows     | Core API `/v1/life/discovery/chat`                             | each advisor answer  | dashboard / My Discovery          |
| advisor progress / coverage     | Core API discovery                                             | each answer          | advisor panel, discovery-coverage |

- **No overloaded flag:** persona activation sets ONLY `setup_completed`; it does **not** set
  `onboarding_completed` (verified: after persona, flags = `setup_completed:true, onboarding_completed:false`).

## Middleware Fix

None required — gate is active and correct (`src/proxy.ts`, Next 16 proxy convention). Enforces:
not-auth → `/auth`; auth+no-persona → `/onboarding/financial-profile`; auth+persona+no-advisor →
`/dashboard/advisor?onboarding=1`; advisor done/skip → dashboard. Two distinct flags (not one overloaded one).

## Advisor Frontend Fix

None required — `src/app/dashboard/advisor/page.tsx` renders a working full-screen onboarding:
`?onboarding=1` mode, immersive layout (sidebar collapsed + header hidden via `dashboard/layout.tsx`
`isImmersive`), asks questions, accepts answers, writes canonical data, shows a live "WHAT I KNOW SO FAR"
panel + reveal cards, and a confirm ("See your dashboard →") / explicit skip — both POST
`/api/onboarding/advisor-complete` (sets `onboarding_completed`).

## Persona Routing Fix

None required — `SampleFinancialProfile.tsx` does `router.push('/dashboard/advisor?onboarding=1')` after
activation (not dashboard).

## Browser Validation (live prod, fresh user — full E2E)

1. fresh `/dashboard` → `/onboarding/financial-profile` ✅
2. persona activated → `/dashboard` → `/dashboard/advisor?onboarding=1` ✅
3. answered 5 questions → coverage **28% → 82%** ✅
4. canonical writes: `life.life_objectives` = **3 rows** (Reach financial independence; Build family stability) ✅
5. finish → `onboarding_completed=true`, `/dashboard` accessible, no crash ✅
6. advisor is full-screen (`mainSidebarVisible=false`), discovery-chat 200, input present ✅

## Screenshots Saved

`reports/browser-validation/latest/onboarding/`:

- `1-persona-selection.png` · `2-advisor-first.png` · `advisor-first.png` · `3-advisor-after-answers.png` · `4-dashboard-after-unlock.png`

## Remaining Onboarding Gaps (real, but not "onboarding doesn't run")

- **Step 5 prompted uploads/forms** (401k statement, resume, transcript, lab report, estate docs): the
  advisor collects answers conversationally but does NOT yet trigger context-aware UPLOAD/FORM actions
  mid-flow. Today this is a chat-only discovery. (Honest gap vs the designed Step 5 — not a dead-end; the
  advisor keeps asking.) Wiring document/form prompts into the advisor is the main remaining build.
- **Step 6 confirmation screen** is a one-line "Your life model is built. See your dashboard →" rather than
  a full "Here is what I understand about you" summary (vision/objective/coverage/missing/confidence). The
  data for it exists (the context panel already shows it); a dedicated confirmation screen is a polish item.
- **Why the reporter saw no onboarding:** almost certainly an account already past onboarding
  (`onboarding_completed=true`) or a cached build — not a gate failure.

## How to re-experience onboarding (verification for the reporter)

Use a brand-new email, OR reset your account's flags: set `profiles.setup_completed=false` +
`onboarding_completed=false` for your user, then open `/dashboard` — you'll be routed through persona →
advisor again. (I can do this reset for techavenger83@gmail.com on request.)

## Definition of Done — status

✅ Persona selection routes into advisor onboarding. ✅ Dashboard cannot be accessed before
onboarding completion/skip (gate verified live). ✅ Advisor runs full-screen. ✅ Advisor collects answers

- writes canonical data (life_objectives, coverage 28%→82%). ✅ Dashboard unlocks only after confirm/skip.
  ✅ Dashboard reflects onboarding (coverage/objectives feed My Discovery + cards).
  ⚠️ Step-5 upload/form prompts + a richer Step-6 confirmation screen remain to be built (designed but not wired).
