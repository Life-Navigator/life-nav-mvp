# Plaid Sandbox Onboarding Flow

**Date:** 2026-06-03

## Beta flow

```
Registration → Basic profile → Choose Sample Financial Profile → Activate Financial Profile → Dashboard
```

The new step is **Choose Sample Financial Profile** at `/onboarding/financial-profile`
(`apps/web/src/app/onboarding/financial-profile/page.tsx` → `SampleFinancialProfile` client component).

## Step-by-step

1. **Registration** — existing Supabase auth sign-up.
2. **Basic profile** — existing onboarding profile capture.
3. **Choose Sample Financial Profile** (new):
   - Page loads → `GET /api/integrations/plaid/personas` → renders a **dropdown** of `display_name`s.
   - Selecting a profile shows its **description**, **goals** ("What you can explore"), and a **complexity** chip.
   - Beta copy (always visible): _"Use a sample financial profile to explore LifeNavigator without connecting real accounts."_
   - Safety copy (above the button): _"No real bank credentials are used during this beta experience."_
   - The user never sees Plaid, sandbox, usernames, passwords, or test-credential language.
4. **Activate Financial Profile** — button → `POST /api/integrations/plaid/activate-persona { persona_id }`.
   - Server runs the sandbox token flow + persists data + graph promotion + audit + first recommendation (see implementation report).
   - Button shows "Activating financial profile…"; errors surface inline (no developer detail).
5. **Dashboard** — on success the component `router.push('/dashboard')`. The persona's accounts/transactions are now in `finance.*` and being promoted into the graph; recommendations follow.

## What the user sees vs. what stays server-side

| User sees                                          | Stays on the server                         |
| -------------------------------------------------- | ------------------------------------------- |
| Friendly profile names (e.g. "Young Professional") | Plaid sandbox username (`user_good`, …)     |
| Description, goals, complexity                     | Sandbox password (`pass_good`)              |
| "Activate Financial Profile" button                | `institution_id`, products, Plaid API calls |
| Beta + safety copy                                 | Access token, item id, token exchange       |

## Wiring the step into your registration sequence

The page is self-contained and redirects to `/dashboard` on success. To place it in the linear beta flow, route the user to `/onboarding/financial-profile` after the basic-profile step (e.g., from the post-registration redirect or the onboarding hub). It can also be linked from the existing onboarding hub as the financial step for the beta cohort.

## Copy reference (verbatim)

- **Heading:** "Choose a sample financial profile"
- **Beta copy:** "Use a sample financial profile to explore LifeNavigator without connecting real accounts."
- **Safety copy:** "No real bank credentials are used during this beta experience."
- **Primary button:** "Activate Financial Profile" (→ "Activating financial profile…")
- **Section label:** "What you can explore" (lists the persona goals)

## Prerequisites for the live flow

- `PLAID_CLIENT_ID`, `PLAID_CLIENT_SECRET`, `PLAID_ENV=sandbox` set on Vercel (`life-nav-mvp-web`).
- `life-nav-mvp-web` redeployed from `mvp`.
- `finance`/`graphrag` API grants applied (done — migration `105`).

Until Plaid creds are set, the dropdown + copy render normally and **Activate** returns a friendly "Sample financial profiles are not available yet" (HTTP 503) instead of erroring with developer detail.
