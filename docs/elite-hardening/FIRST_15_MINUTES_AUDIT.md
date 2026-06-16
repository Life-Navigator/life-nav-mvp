# The First 15 Minutes — Elite Pilot Audit

**Verdict:** A genuinely premium, honest, data-grounded onboarding undermined by a silent dead-end on the primary landing CTA and a 2-call detour before the "wow." **Score: 6.5 / 10** (elite bar).

> Scope: landing → register → email verify → onboarding → first insight → first dashboard. All findings cite real code under `apps/web/src`. We cannot render pixels; this is a code-level read.

---

## TL;DR for a skeptical VC

The brand, copy, and trust posture are top-decile (`app/page.tsx`, `components/auth/UnifiedAuthExperience.tsx`). The data is honestly real (Plaid sandbox seeded server-side, `activate-persona/route.ts`), and the project's "no mock data" rule is genuinely honored in the first-run path. But the **primary marketing CTA leads to a silent failure for new users**, and the actual "it knows me" moment is gated behind a verify-email round-trip + a persona pick + a live network call to the Fly backend. A VC who clicks "Request Beta Invite" on the homepage today gets a "Check your email" screen and **no email** — that is a pilot-killer.

---

## Step-by-step: what a real user actually hits

1. **Landing (`app/page.tsx`).** Strong hero, stats band claiming `"<3 min from invite to first insight"` (`page.tsx:49`), six-domain bento, grounded-chat tile with a real-looking `$3,200.00` example (`page.tsx:300-304`), trust architecture, FAQ. Two CTAs both point at auth. The beta CTA is **"Request Beta Invite" → `/auth?mode=magic`** (`page.tsx:529-533`). Navbar "Get Started" similarly routes to `/auth`.

2. **Auth (`/auth` → `components/auth/UnifiedAuthExperience.tsx`).** One premium page, three tabs: Sign in / Create account / Magic link (`UnifiedAuthExperience.tsx:344-359`). Left panel = device mockup + two floating insight cards (`:295-308`). This is excellent. The landing CTA lands the user in **Magic mode** by default.

3. **The new-user trap.** Magic mode calls `signInWithOtp({ email, options: { shouldCreateUser: false, ... } })` (`UnifiedAuthExperience.tsx:225-231`). For a brand-new pilot user, Supabase returns a "user not found" error, but the code **suppresses every non-rate-limit error** (`:232-240`) and unconditionally shows the "Check your email" success state (`:243-244`, `CheckEmail` at `:441`). **Result: no email is ever sent, and the UI says one was.** The copy hint "New here? Use 'Create account'" exists (`:758`) but is below the fold of the form and easy to miss after clicking a button literally labeled "Request Beta Invite."

4. **Create account path (the one that works).** `handleCreate` (`UnifiedAuthExperience.tsx:163-215`): name, email, 12-char complex password, confirm, terms checkbox. On success with email-confirmation required → branded "Check your email … expires in 1 hour" (`:468-473`). Good. Password rule is stated inline (`:678-680`).

5. **Email verify (`app/auth/confirm/route.ts`).** Handles BOTH `token_hash` (custom template) and PKCE `code` (default template) — a real, well-commented robustness fix (`route.ts:18-22, 38-41`). Records a `user_signed_up` funnel event (`:69-77`), reads `profiles.setup_completed` (`:84-91`), and redirects un-onboarded users to **`/onboarding/financial-profile`** (`:92-93`).

6. **Onboarding step 1 — pick a sample profile (`components/onboarding/SampleFinancialProfile.tsx`).** Step 1 of 2: choose a persona card (`:144`), no pre-selection by design (`:49`). Step 2 of 2: confirm, with an explicit amber disclaimer that this is **Plaid sandbox data, not your real account** (`:105-108`). Honest. Clicking "Start Advisor Onboarding" POSTs `activate-persona`.

7. **Activation (`app/api/integrations/plaid/activate-persona/route.ts`).** Server-side: clears prior finance data (`:84`), runs the Plaid sandbox token flow with credentials that never reach the client (`:90-97`), persists accounts/investments/transactions (triggering graph promotion), persists persona metadata, sets `setup_completed=true` with a 0-row-update guard (`:191-213`), writes audit events, and best-effort kicks a first recommendation on the Fly gateway (`:234-249`). **This is real data, well-engineered.** Then redirects to **`/dashboard/advisor?onboarding=1`** (`SampleFinancialProfile.tsx:75`).

8. **Onboarding step 2 — the Advisor (`app/dashboard/advisor/page.tsx`).** On mount it calls `send('', null)` to open the conversation (`:300-302`), which hits `/api/life/discovery-chat-stream` (`:234`) — a pass-through to the **Fly Core API**. The opening advisor message is generated server-side over the network; if SSE fails it falls back to a blocking POST (`:243-244, 293`). Discovery is conversational with live ✓ chips and a context panel. Minimum 3 answers before skip is allowed (`:185-188`); a final open-ended question (`:190-191`) precedes a Life Model review, then a deliberate ~3.2s transition to `/dashboard` (`:174-176`).

9. **First dashboard (`app/dashboard/page.tsx`).** Server-computes the persona-aware recommendation set deterministically (no model call, no 502 surface — `:11-18`). Top recommendation becomes "Today's brief" / First Insight (`:33-43`), records a `first_insight_viewed` event (`:44-55`), renders `ExecutiveSummary` + `LifeIntelligence` + `MissionControl` + `DashboardClient`. `ExecutiveSummary` has honest empty states throughout ("never a fabricated number" — `ExecutiveSummary.tsx:19`). First-insight empty state is honest too ("Activate a sample financial profile to see your first insight" — `first-insight.ts:32-39`).

**Click/field count to first value (happy path, Create-account):** landing click → /auth → fill 5 fields + checkbox → submit → leave app to email → click verify link → pick persona (1 click) → confirm (1 click) → wait for advisor → answer ≥3 questions → final question → review → ~3.2s transition → dashboard. **That is ~10+ interactions and one mandatory context-switch (email) before the first grounded insight.** The homepage's "<3 min" claim (`page.tsx:49`) is aspirational, not what this flow delivers.

---

## Top 5 friction points (ranked)

### 1. Primary landing CTA is a silent dead-end for new users — PILOT-BLOCKER

`page.tsx:529` ("Request Beta Invite") → `/auth?mode=magic` → `signInWithOtp({ shouldCreateUser: false })` (`UnifiedAuthExperience.tsx:228`). New users get a fake "Check your email" (`:243-244`) and **no email**, because non-rate-limit errors are swallowed (`:232-240`).
**Fix:** Either point the beta CTA at `/auth?mode=create`, or in `handleMagic` detect the "user not found"/"signups not allowed" error and switch the UI to Create mode with a clear message ("You don't have an account yet — let's create one"). Do not show "Check your email" unless `signInWithOtp` returned no error.

### 2. Two divergent signup implementations; the standalone one is worse and likely dead

`components/auth/RegisterForm.tsx` still exists with its own `signUp` that on success shows a toast and pushes to `/auth/login?registered=true` (`RegisterForm.tsx:103-109`) — i.e. it does NOT show the branded "check your email" state and dumps the user back at sign-in. Meanwhile `/auth/register` is a pure redirect to the unified flow (`app/auth/register/page.tsx`). So `RegisterForm` appears to be **dead code that contradicts the live UX**, a maintenance and consistency hazard.
**Fix:** Delete `RegisterForm.tsx` (and its test) or make the route render it — pick one. Keep exactly one create-account path (the unified `CreateForm`).

### 3. The "wow" depends on a live Fly backend call with no graceful first-paint

The first advisor message is `send('', null)` → `/api/life/discovery-chat-stream` over the network (`advisor/page.tsx:234, 300-302`). If the Fly Core API is slow/cold (the memory notes intermittent 502s and ~9s advisor latency), the new elite user stares at an empty chat as their literal first in-product moment. There is no skeleton/typing indicator wired for the opening turn before the stream's first `ack`.
**Fix:** Render an instant, client-side advisor greeting + typing indicator immediately on mount (deterministic, no network), then stream the real first question over it. Never let the first screen be blank waiting on Fly.

### 4. Time-to-value is gated behind a mandatory email round-trip

`auth/confirm/route.ts` only runs onboarding after email verification. For a private pilot of 20 known, vetted users, forcing a leave-the-app verify step before they ever see value is the single biggest TTFV tax — and the homepage promises "<3 min" (`page.tsx:49`).
**Fix:** For the pilot, pre-create the 20 accounts and send Supabase **invite/magic links that land authenticated directly in onboarding** (the magic flow already targets `/auth/confirm?next=/onboarding`, `UnifiedAuthExperience.tsx:229`). Skip the self-serve password+verify entirely for these users.

### 5. The dashboard is not the first post-onboarding screen — the brief is buried

After onboarding the user lands on `/dashboard/advisor`, does discovery, then transitions to `/dashboard` where the actual grounded "Today's brief" lives (`dashboard/page.tsx:33-43`). The single most impressive artifact (a real, cited recommendation from their seeded accounts) is the **last** thing they see, after a multi-question chat, not the first.
**Fix:** Surface the grounded first insight earlier — e.g. immediately after persona activation show a one-card "Here's what we already see in your accounts: pay down the 21.99% card → $1,420/yr" before discovery, so "it knows me" fires in the first 60 seconds.

---

## Top 3 highest-leverage "holy shit" moves (first 15 min)

1. **Instant grounded brief right after persona activation.** `activate-persona` already persists real balances/APRs and kicks a recommendation (`route.ts:234-249`); `getRecommendations` is deterministic and server-safe (`dashboard/page.tsx:31`). Insert a single interstitial card between activation and the advisor that reads the just-seeded data and states one specific, cited move ("$3,200 checking, 21.99% card → pay it before investing, $1,420/yr"). That is the "it knows me" moment, delivered before any typing, with zero model dependency.

2. **Make the advisor's opening turn feel alive and personal in <500ms.** Pre-render a client-side greeting that names the chosen persona and one real seeded fact ("I can already see your $24,500 high-yield savings and a 401(k) — let's connect the rest of the picture"), then stream the real first question on top (`advisor/page.tsx:300-302`). Removes the blank-screen-on-cold-Fly risk (friction #3) and converts dead latency into a flex.

3. **Provenance chips on the very first number.** The landing already sells "Cited from your accounts — not guessed" (`page.tsx:301-304`); the dashboard honors it. Bring that proof forward: the first insight card should show the source pill ("from Everyday Checking · read-only · Plaid sandbox") inline on the first number an elite user sees. Trust + wow in one component, and it's all real data you already persist.

---

## What's already excellent (no padding)

- **Honesty of empty states is real, not aspirational.** `ExecutiveSummary.tsx:19` ("Every section has an HONEST empty state — never a fabricated number"); `first-insight.ts:32-39` returns an honest "activate a profile" state instead of fake numbers. The "no mock data" rule is genuinely upheld in the first-run path.
- **Trust signals are early and concrete.** Read-only Plaid messaging (`page.tsx:324, 556`), per-user isolation/RLS copy (`page.tsx:552-553`), the amber "this is sandbox, not your real account" disclaimer at the exact moment of activation (`SampleFinancialProfile.tsx:105-108`), and a fail-closed grounding promise in the FAQ (`page.tsx:163-165`).
- **Auth robustness.** `auth/confirm/route.ts` handles both Supabase template styles (`:18-22`) and classifies expired/used links into friendly resend flows (`:43-53`) — this is the kind of detail that separates a pilot from a demo.
- **Deterministic first insight.** The dashboard's brief is computed server-side with no model call (`dashboard/page.tsx:11-18`), so the headline moment can't 502. Smart.
- **Brand seam is genuinely seamless.** Onboarding reuses the auth dark/editorial system (`onboarding/layout.tsx:12-16`) and the post-auth overlay carries into onboarding (`UnifiedAuthExperience.tsx:59-67, 436`).
- **Funnel instrumentation everywhere** (`user_signed_up`, `sample_financial_profile_selected/activated`, `first_insight_viewed`) — you'll be able to measure exactly where the 20 users drop.
