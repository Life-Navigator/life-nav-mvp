# Auth Experience Redesign — one premium journey

**Date:** 2026-06-05
**Goal:** A single branded authentication experience for the whole platform; a user cannot tell where
authentication ends and onboarding begins.

## The decision

One canonical page — **`/auth`** — renders all three modes in place (**Sign in / Create account /
Magic link**) inside the marketing site's dark, editorial system, with a live dashboard mockup and
floating recommendation cards. Every entry point reaches it; the first onboarding screen wears the same
skin so the hand-off is seamless.

Routing decisions (confirmed with stakeholder):

- **All auth + beta CTAs → `/auth`.** Beta CTAs open magic-link mode; `/beta` stays reachable
  (sample-profile content) but is no longer a primary CTA.
- **Canonical `/auth`; legacy routes redirect in** (`/auth/login|register|magic` → `307 /auth?mode=…`,
  query preserved) so old email links and `/auth/confirm` error redirects still land correctly.

## 1 — The unified page

**`components/auth/UnifiedAuthExperience.tsx`** (new) + **`app/auth/page.tsx`** (new server wrapper).

- **Logo + premium system:** `Mark` wordmark, `ParallaxBackdrop` aurora, `.font-display`/`.text-gradient`
  headline, shared `inputClass`, `.btn-primary` — identical tokens to the homepage.
- **Dashboard mockup:** the real `DeviceMockup` (laptop) — a full synthetic LifeNavigator dashboard
  (net worth, allocation, recommendation, grounded chat).
- **Floating recommendation cards:** two `FloatingInsightCard`s (`.float` / `.float-2`) over the
  mockup — "Your checking balance is $3,200.00 · Grounded" and "Pay down the 21.99% card first ·
  Recommendation".
- **Mobile responsive:** brand panel is `hidden lg:flex`; the form panel is full-width with a mobile
  logo, so phones get a clean single column.
- **Unified modes:** a 3-tab segmented switcher toggles Sign in / Create account / Magic link **in
  place** — no navigation, no separate Supabase-style pages.
  - _Sign in_ — `signInWithPassword` + Google/LinkedIn OAuth + Forgot-password link.
  - _Create account_ — name/email/password/confirm/terms, 12-char policy; `signUp`. If a session is
    returned (confirmation off) → straight to onboarding; otherwise → branded "Check your email".
  - _Magic link_ — `signInWithOtp` (`shouldCreateUser:false`, invite-only beta) → branded
    "Check your email" with resend.
- **`?mode=` / `?next=` / `?error=` / `?registered=` / `?email=`** all handled server-side; errors and
  notices render as on-brand banners.

## 2 — Loading states (all four, branded)

| Copy                        | When                                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------------- |
| **Creating account…**       | Create-account button while `signUp` runs                                                           |
| **Sending verification…**   | Magic-link button + resend while the link is dispatched                                             |
| **Preparing your profile…** | Full-screen overlay on new-account→onboarding, and on the first onboarding screen during activation |
| **Loading your dashboard…** | Full-screen overlay after a successful sign-in, before the dashboard renders                        |

The overlay (`TransitionOverlay`) is the dark brand surface with the logo + spinner, so the moment
between steps stays inside the experience instead of flashing a blank page.

## 3 — Verification returns to the branded experience → onboarding continues

- `/auth/confirm` error redirects now point to **`/auth?mode=signin&error=…`** (the unified page),
  not the old login page.
- Success path unchanged mechanically (new users → `/onboarding/financial-profile`), but **onboarding
  now wears the auth skin**:
  - `app/onboarding/layout.tsx` rebuilt on the dark brand shell (`ParallaxBackdrop` + `Mark` logo),
    replacing the gray `bg-gray-50` + blue `<h1>`.
  - `components/onboarding/SampleFinancialProfile.tsx` rebuilt in the dark system (same `inputClass`,
    `.btn-primary`, teal eyebrow) with continuity copy — "Your account is ready" / "Step 1 of 1 ·
    Almost there" — and the **Preparing your profile…** state on activate.

The user crosses email-verification into onboarding without a visual seam: same background, same logo,
same cards, same buttons.

## 4 — Dead-ends removed

- "Sign in" no longer lands on the bare light page — it's the same premium page as everything else.
- No register→login bounce: create-account flows directly to "check your email" or onboarding.
- Sign-in errors offer a one-tap "Email me a new link →" into magic mode.

## 5 — Entry-point routing (after)

| CTA                                                                                              | Now routes to                |
| ------------------------------------------------------------------------------------------------ | ---------------------------- |
| Sign in (navbar)                                                                                 | `/auth?mode=signin`          |
| Get Started Free / Freemium (pricing, features, security, credit packs)                          | `/auth?mode=create`          |
| Request Beta Invite / Join Beta (homepage hero, nav ×2, product ×2, how-it-works, EnterpriseCTA) | `/auth?mode=magic`           |
| I have an invite — sign in (`/beta`)                                                             | `/auth?mode=magic`           |
| `/auth/login`, `/auth/register`, `/auth/magic` (legacy/email links)                              | `307 → /auth?mode=…`         |
| `proxy.ts` app-root + protected-route gates                                                      | `/auth?mode=signin[&next=…]` |

## Files changed

**New:** `components/auth/UnifiedAuthExperience.tsx`, `app/auth/page.tsx`.
**Rebuilt:** `app/auth/login|register|magic/page.tsx` (→ redirects), `app/onboarding/layout.tsx`,
`components/onboarding/SampleFinancialProfile.tsx`.
**Edited:** `proxy.ts`, `app/auth/confirm/route.ts`, and CTA hrefs in `marketing/Navbar.tsx`,
`site/HeroScene.tsx`, `site/EnterpriseCTA.tsx`, `app/page.tsx`, `app/product/page.tsx`,
`app/how-it-works/page.tsx`, `app/beta/page.tsx`, `app/features/page.tsx`, `app/security/page.tsx`,
`app/pricing/page.tsx`.
**Now unused (kept, not deleted):** `auth/AuthShell`, `auth/LoginForm`, `auth/RegisterForm`,
`auth/MagicLinkPanel`.

## Known follow-ups (not blocking)

- Deeper onboarding flows (`questionnaire`, `interactive`, `hub`, `sections/*`) now sit inside the dark
  shell but keep their own legacy inner styling — a follow-up pass would restyle them to match. The
  **default beta path** (`financial-profile`) is fully unified.
- Magic mode keeps `shouldCreateUser:false` (invite-only beta); self-serve new users use Create
  account. Flip to `true` if/when open passwordless signup is desired.
- `DeviceMockup` browser chrome still reads `app.lifenavigator.ai` — cosmetic; update to `.tech`.
