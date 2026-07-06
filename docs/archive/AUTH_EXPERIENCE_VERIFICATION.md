# Auth Experience Verification

**Date:** 2026-06-05
**Build:** `next build` ✅ · `tsc --noEmit` ✅ · `eslint` (changed files) ✅
**Runtime:** production server (`next start`) smoke-tested on `:3939`.

## Requirements → status

| #   | Requirement                                                                                                           | Status | Evidence                                                                                                                                                                                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | All entry points route to one page                                                                                    | ✅     | Nav "Sign in" → `/auth?mode=signin`; Get Started/Freemium → `/auth?mode=create`; all "Request Beta Invite"/Join Beta → `/auth?mode=magic`; homepage HTML contains both `/auth?mode=magic` and `/auth?mode=signin`. Grep confirms zero remaining marketing CTAs to `/beta`, `/auth/magic`, `/auth/register`. |
| 2   | One branded auth page (logo, design system, dashboard mockup, floating cards, mobile responsive, homepage-consistent) | ✅     | `/auth` HTML contains the mode tabs, `DeviceMockup` (`Net worth`, `148,920`), floating card (`Pay down the 21.99% card`), headline (`your whole life`), `Mark` logo. Brand panel `hidden lg:flex` → single-column on mobile. Same tokens/`ParallaxBackdrop` as homepage.                                    |
| 3   | Unified modes (Sign in / Create / Magic)                                                                              | ✅     | 3-tab switcher toggles in place; `/auth?mode=create` renders "Create your account", `mode=signin` "Welcome back", `mode=magic` "Get your sign-in link".                                                                                                                                                     |
| 4   | No separate Supabase-style pages                                                                                      | ✅     | `/auth/login`, `/auth/register`, `/auth/magic` now `307 → /auth?mode=…` (verified). The bare light `MagicLinkPanel`/`AuthShell` pages are retired from the flow.                                                                                                                                            |
| 5   | Verification returns to branded experience; onboarding continues immediately                                          | ✅     | `/auth/confirm` errors → `/auth?mode=signin&error=…`; success → `/onboarding/financial-profile`, which now renders on the dark brand shell (`bg-[#06060a]`, `Mark` logo) with "Your account is ready" continuity copy.                                                                                      |
| 6   | Remove dead-end transitions                                                                                           | ✅     | "Sign in" no longer hits the bare page; no register→login bounce; sign-in errors offer "Email me a new link →".                                                                                                                                                                                             |
| 7   | Loading states                                                                                                        | ✅     | All four present: **Creating account…**, **Sending verification…**, **Preparing your profile…** (overlay + onboarding activate), **Loading your dashboard…** (overlay after sign-in).                                                                                                                       |
| 8   | Generate the 3 docs                                                                                                   | ✅     | `AUTH_EXPERIENCE_AUDIT.md`, `AUTH_EXPERIENCE_REDESIGN.md`, this file.                                                                                                                                                                                                                                       |

## Live smoke-test results

```
/auth/login    -> 307  loc=/auth?mode=signin
/auth/register -> 307  loc=/auth?mode=create
/auth/magic    -> 307  loc=/auth?mode=magic

/auth content:        Create account FOUND · Magic link FOUND · Sign in FOUND
                      Net worth FOUND · 148,920 FOUND · Pay down the 21.99% card FOUND
                      "your whole life" FOUND
/auth?mode=create  -> "Create your account"
/auth?error=link_expired -> "expired or was already used" banner shown
homepage           -> CTAs contain /auth?mode=magic and /auth?mode=signin
/onboarding/financial-profile -> dark shell + "Your account is ready" (rebranded)
```

## Success criteria

> _A user cannot tell where authentication ends and onboarding begins; one continuous premium journey._

**Met for the default beta path.** Sign-in/create/magic all live on one dark, mockup-backed page; the
post-auth transition overlay keeps the brand on screen between steps; and the first onboarding screen
(`financial-profile`) shares the same background, logo, cards, inputs, and buttons — so email
verification flows into onboarding with no visual break.

## Not verified here (operational / external)

- **Real email delivery** of the branded verification/magic emails depends on Supabase SMTP (live per
  `AUTH_DOMAIN_E2E_REPORT.md`); not re-sent in this pass.
- **Live deploy:** verified against a local production build only; not yet pushed/redeployed to Vercel.
- **Deeper onboarding flows** (`questionnaire`/`interactive`/`hub`/`sections`) render inside the dark
  shell but retain legacy inner styling — full restyle is a tracked follow-up (see redesign doc).
