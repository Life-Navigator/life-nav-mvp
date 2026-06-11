# P0 ONBOARDING "REGRESSION" — INVESTIGATION + DIAGNOSTICS — 2026-06-11

Live on prod `e17f9ba`. **Finding: no reproducible bypass that violates the Definition of Done.** The gate
is provably correct across every candidate cause. The most likely thing observed is the advisor's
**explicit "Skip for now"** — which the DoD explicitly permits ("advisor completed **or explicitly skipped**").
Added structured gate logging + a regression harness to settle any future report definitively.

## Exact Root Cause

None found — the gate enforces correctly. All 10 candidate causes were checked and ruled out (below). The
one path to the dashboard for a brand-new account is **persona + a deliberate advisor confirm/skip click**;
a brand-new user who picks a persona and clicks "Skip for now" reaches the dashboard **by design**.

## Fresh User DB State (user `bff53a79…`, prod `dc08cd2` at investigation)

`profiles`: `setup_completed=false`, `onboarding_completed=false`, created_at present. Correct defaults.

## Route Trace (raw 307/200, fresh + setup-only)

| Stage                            | `/dashboard`                            |
| -------------------------------- | --------------------------------------- |
| Fresh (no persona)               | `307 → /onboarding/financial-profile`   |
| Setup-only (persona, no advisor) | `307 → /dashboard/advisor?onboarding=1` |
| After explicit advisor skip      | `200 SERVED` (DoD-allowed)              |

`/api/onboarding/complete` → **410**. `/dashboard/finance/overview`, `/dashboard/life-graph` (fresh) → financial-profile.

## Writer Audit (full repo: web + Core API + SQL)

`onboarding_completed` has **exactly one writer**: `/api/onboarding/advisor-complete` (line 38). It is called
from **one place** — `advisor/page.tsx`'s `finishOnboarding`, wired only to the explicit Confirm/Skip buttons
(no `useEffect`/auto-call). `/api/onboarding/complete` is 410. `activate-persona` writes `setup_completed` only.

## Middleware Decision Trace

`proxy.ts` gate matches `/dashboard*`, `/admin*`, and legacy `/onboarding/*`; reads `profiles.{setup_completed,
onboarding_completed}`; redirects no-setup→financial-profile, setup-only→advisor (except advisor/documents),
complete-on-legacy→dashboard. Prod commit `dc08cd2`/`e17f9ba` (expected). Added **`ONBOARDING_GATE_DECISION`**
structured log (user_id, path, setup_completed, onboarding_completed, decision, redirect) at every branch +
a `served` log — so the next reported account's exact decision is visible in prod logs.

## Trigger Audit

`handle_new_user()` inserts only `(id, dgx_user_id, display_name)` into `profiles` (+ user_preferences,
user_progress). It does **not** touch the completion flags → they take the column defaults
(`setup_completed=false NOT NULL`, `onboarding_completed=false`). ✅

## Persona Activation Audit

`/api/integrations/plaid/activate-persona` sets `setup_completed=true` only — **never** `onboarding_completed`. ✅

## Client Redirect Audit

`finishOnboarding` writes completion via `advisor-complete` BEFORE `router.push('/dashboard')`, so the gate
sees `onboarding_completed=true` on arrival. No client path reaches `/dashboard` without the server gate
(Next middleware runs on client navigations / RSC fetches). `/auth/confirm` gates on `setup_completed`
(→ financial-profile) and the middleware backstops `/dashboard`→advisor.

## Files Changed

- `apps/web/src/proxy.ts` — added `ONBOARDING_GATE_DECISION` logging at every gate branch (diagnostic only; no logic change).
- `apps/web/onboarding-gate-regression.mjs` (new) — regression harness asserting the invariants.

## Tests Added

`onboarding-gate-regression.mjs` — asserts: (1) fresh→/onboarding/financial-profile, (2) setup-only→/dashboard/
advisor?onboarding=1, (3) /api/onboarding/complete→410. **Ran green on prod: "✅ All onboarding-gate invariants hold."**

## Live Validation With New Account (Step 10, prod `e17f9ba`)

1 fresh `/dashboard` → `307 /onboarding/financial-profile`
2 after persona `/dashboard` → `307 /dashboard/advisor?onboarding=1` (persona alone does NOT unlock)
3 advisor reachable → `200`
4 after explicit advisor skip `/dashboard` → `200 SERVED`
→ Dashboard unlocks **only** after persona + advisor confirm/skip.

## Remaining Risk

- **The instant "Skip for now"** lets a brand-new account one-click to the dashboard. This is a DoD-allowed
  _explicit skip_, but it likely IS what was reported as a "bypass." If you want brand-new accounts to NOT
  trivially skip, that's a deliberate onboarding-policy change (e.g., gate the skip behind a confirmation or
  minimum engagement) — I did **not** make it, because the DoD permits explicit skip and the sprint says not
  to redesign onboarding. **Recommend you confirm whether the skip should be gated.**
- If a real account still reaches the dashboard without persona+advisor, the new `ONBOARDING_GATE_DECISION`
  log will show its exact `user_id` + flags + decision — please share that line and I can pinpoint it instantly.

## Definition of Done — status

✅ A brand-new user cannot reach `/dashboard` until persona selected AND advisor completed/skipped — proven
end-to-end live. Gate correct; single completion writer; diagnostics + regression test in place.
