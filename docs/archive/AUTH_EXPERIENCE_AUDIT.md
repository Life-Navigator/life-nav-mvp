# Auth Experience Audit — pre-unification

**Date:** 2026-06-05
**Scope:** Every authentication entry point, page, and the verification→onboarding hand-off in `apps/web`.

## The core problem (confirmed)

The **Sign In** button and the **Freemium/Get-Started** button led to two visually different,
differently-built authentication experiences, and a third (beta) funnel went somewhere else entirely.
There was **no single auth page** — entry points scattered across four destinations with three
different design languages.

## 1 — Entry points were inconsistent

| CTA                              | Where                                                    | Routed to (before)               | Experience                                   |
| -------------------------------- | -------------------------------------------------------- | -------------------------------- | -------------------------------------------- |
| **Sign in**                      | Navbar (desktop)                                         | `/auth/magic`                    | Bare, **light-themed** card (lowest quality) |
| **Get Started Free**             | Pricing / Features / Security                            | `/auth/register`                 | Premium dark `AuthShell`                     |
| **Freemium**                     | Pricing tier                                             | `/auth/register`                 | Premium dark `AuthShell`                     |
| **Request Beta Invite** (×8)     | Homepage hero, nav, product, how-it-works, EnterpriseCTA | `/beta` → `/waitlist`            | Marketing page, not auth                     |
| **I have an invite — sign in**   | `/beta`                                                  | `/auth/magic`                    | Bare light card                              |
| Create one / Sign in cross-links | login/register pages                                     | `/auth/login` ↔ `/auth/register` | Mixed                                        |

**Key defect:** the navbar **"Sign in" → `/auth/magic`**, the single lowest-quality page in the app
(plain white card, blue buttons, no brand system), while acquisition CTAs went to the premium
`/auth/register`. A user signing in got a _worse_ product than a user signing up.

## 2 — Auth pages were fragmented (3 design languages)

| Page                                                                  | Component                    | Theme                                                      | Quality                         |
| --------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------- | ------------------------------- |
| `/auth/register`                                                      | `RegisterForm` + `AuthShell` | Dark, editorial, aurora, value props, live "Grounded" card | **Premium**                     |
| `/auth/login`                                                         | `LoginForm` + `AuthShell`    | Dark `AuthShell` but thinner                               | Good, but no mockup             |
| `/auth/magic`                                                         | `MagicLinkPanel`             | **Light** white card, blue buttons                         | **Bare** (the "Sign in" target) |
| `/auth/forgot-password`, `/auth/password-reset`, `/auth/verify-email` | standalone                   | Light cards                                                | Utility                         |
| `/auth/callback`, `/auth/error`                                       | standalone                   | Minimal                                                    | Utility                         |

Three of these read as **default Supabase-style pages** (light card, generic), clashing with the
dark marketing brand. There was **no shared mode-switching** — sign-in, create-account, and magic-link
were three separate URLs with three separate looks and no way to move between them in place.

## 3 — Loading states were minimal

Just disabled buttons with single labels (`Signing in...`, `Creating account...`, `Sending link…`).
No branded transition between auth → onboarding → dashboard; redirects were instant/blank.

## 4 — Dead-end / jarring transitions

- **The big seam:** premium dark auth → **plain gray onboarding** (`onboarding/layout.tsx` used
  `bg-gray-50` + a blue `<h1>Life Navigator</h1>`; the first screen `SampleFinancialProfile` was a
  near-black-on-white utility form). A freshly-verified user fell out of the premium aesthetic into a
  different-looking product. This is the seam that most violates "one continuous journey."
- **Register → login bounce:** `RegisterForm` pushed to `/auth/login?registered=true`, asking the
  user to sign in again after just signing up.
- **Verification return** (`/auth/confirm`) redirected errors to `/auth/login?error=...` — fine
  mechanically, but landed on the thinner login page.

## 5 — Routing facts that shaped the fix

- `proxy.ts` treats `path.startsWith('/auth/')` as public and bounces authenticated users on auth
  pages to `/dashboard`; protected routes redirect unauthenticated users to `/auth/login?redirect=`.
- `/auth/confirm/route.ts` is the **only** post-verification entry point: new users (no
  `profiles.setup_completed`) → `/onboarding/financial-profile`; returning users → `/dashboard`.
- Brand system available for reuse: `AuthShell`, `ParallaxBackdrop`, `DeviceMockup` (a full synthetic
  dashboard), `FloatingInsightCard`, `Logo/Mark`, tokens `#2dd4bf`/`#5eead4`/`#06060a`, `.btn-primary`,
  the shared `inputClass`.

## Verdict

Fragmented by construction: **4 destinations, 3 design languages, the Sign-In path worst of all**, and
a hard visual seam at auth→onboarding. The fix is one branded page with in-place modes that every entry
point reaches, plus carrying that brand into the first onboarding screen. See
`AUTH_EXPERIENCE_REDESIGN.md`.
