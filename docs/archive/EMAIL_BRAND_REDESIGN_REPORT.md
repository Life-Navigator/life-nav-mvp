# LifeNavigator Email Brand Redesign — Report

Two outcomes: (1) **diagnosed + addressed the "verify email doesn't send" regression**, and (2) **rebuilt
the transactional emails as a premium, single-source-of-truth brand system** using the app's real logo,
fonts, and a navy + teal "executive" aesthetic — deployed live for the auth emails.

---

## Part 1 — "Verify email doesn't send" (diagnosis)

**Finding: the send path is healthy end-to-end. The defect is not in the codebase or templates.**

Measured live against the production Supabase project (`diwkyyahglnqmyledsey`):

| Check                                                    | Result                                                                                        |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `external_email_enabled`                                 | **true**                                                                                      |
| SMTP                                                     | **smtp.resend.com:587**, user `resend`, sender `welcome@lifenavigator.tech` ("LifeNavigator") |
| Live signup (`POST /auth/v1/signup`)                     | **HTTP 200** with `confirmation_sent_at` set → GoTrue accepted and handed the email to Resend |
| Confirmation template tokens                             | valid: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/onboarding` |
| Verify link domain `app.lifenavigator.tech/auth/confirm` | **live (200)**, route handles `token_hash` + PKCE `code` (commit 536f9dc)                     |
| Logo URL `lifenavigator.tech/LifeNavigator.png`          | **live (200)**                                                                                |

Because GoTrue returns 200 with `confirmation_sent_at` (it would return 500 if the SMTP handoff failed),
**the email is being sent to Resend.** If real inboxes aren't receiving it, the cause is downstream of the
app — in the **Resend account**, not the repo. The likely causes (check the Resend dashboard):

1. **Resend in test/sandbox mode** — a Resend account that hasn't been moved to production only delivers to
   the account owner's own verified address; everyone else silently gets nothing. **Most common cause.**
2. **Domain not fully verified** — `lifenavigator.tech` SPF/DKIM/MX records lapsed or pending → Resend
   accepts then drops/bounces.
3. **API key rotated** — if the Resend key used as the SMTP password was regenerated, update it in Supabase
   → Auth → SMTP. (Note: a _wrong_ key would 500 the signup; ours 200s, so the key currently authenticates.)
4. **Rate limit** — Supabase `smtp_max_frequency = 60s` (one email per address per minute) +
   `rate_limit_email_sent = 100/hr`. Rapid re-tests look like "nothing sent."
5. **Spam placement** — premium HTML + a verified domain reduces this; check spam during testing.

> Nothing I changed this session (advisor observability / migration 160 / streaming) touches email. The
> template + send path were already correct; this redesign re-deploys clean templates so the template side
> is provably perfect, and the remaining lever is the Resend account configuration above.

**Action for you:** open Resend → confirm the account is in **production mode** (not sandbox), the
`lifenavigator.tech` domain shows **Verified**, and check the **Logs** tab for the test sends
(`verify-after-*@example.com`) to see delivered/bounced status.

---

## Part 2 — Branding audit (single source of truth)

| Asset                                                 | Value                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Logo (canonical)**                                  | `apps/web/public/LifeNavigator.png` (1024×1024 compass-shield wordmark). Rendered by `apps/web/src/components/brand/Logo.tsx` (`Mark`/`Logo`), used in `Navbar.tsx` + dashboard `Sidebar.tsx`. Publicly served at **`https://lifenavigator.tech/LifeNavigator.png`** (and on `app.`) — used directly in the emails. No new/placeholder/generated logo. |
| **Display type**                                      | **Newsreader** (the app's `--font-display`) — used for headlines, serif fallback (Georgia) for clients that block web fonts.                                                                                                                                                                                                                           |
| **Body type**                                         | system stack (`-apple-system, Segoe UI, Roboto, …`) — matches the app's Geist/system feel, email-safe.                                                                                                                                                                                                                                                 |
| **App accent**                                        | teal `#0f766e` (light) / `#2dd4bf` (dark) — `--brand-accent`.                                                                                                                                                                                                                                                                                          |
| **Email palette (chosen: navy base + teal, no gold)** | page `#060c16`; card gradient `#122b49 → #0c1c33 → #081320`; header `#081627`; ink `#eaf1fb`; muted `#8fa3bd`; accent teal `#2dd4bf` / `#0d9488`. Defined once in `apps/web/emails/brand.ts`.                                                                                                                                                          |

> Note on the brief: the app has **no navy or gold** — its real accent is teal. Per your decision we used a
> **navy base with the app's real teal accent** (no invented gold), which keeps the emails on-brand with the
> teal logo while delivering the dark-luxury feel.

---

## Part 3 — What was built (React Email, single source of truth)

Stack: **React Email** (`@react-email/components` + `@react-email/render`) → renders to HTML;
**Resend** SDK for the lifecycle sends. (Resend was already the intended sender per `.env.example`.)

```
apps/web/emails/
  brand.ts            ← single source of truth: palette, fonts, logo URL, domain, copy
  EmailLayout.tsx     ← navy gradient shell + Newsreader font + preview text
  EmailHeader.tsx     ← real logo + eyebrow
  EmailFooter.tsx     ← beta note, support, privacy, copyright
  ui.tsx              ← reusable: Eyebrow, Headline, Lede, CtaButton, DomainGrid, Panel, StatusRow
  EmailVerification.tsx ← Email 1 (also powers magic-link/invite/recovery via props)
  WelcomeEmail.tsx      ← Email 2
  ActivationEmail.tsx   ← Email 3
  build.tsx           ← renders → supabase/email-templates/*.html + emails/out/*.html
  out/                ← generated previews (welcome.html, activation.html, verification.preview.html)
apps/web/src/lib/email/send.ts  ← Resend senders for Welcome/Activation (no-op without RESEND_API_KEY)
```

Build with `pnpm --filter web email:build`.

### Email 1 — Verify (LIVE, deployed to Supabase)

- Subject: **"Welcome to LifeNavigator — Verify Your Email"**
- Real logo · headline **"Your Personal Decision Intelligence Platform"** · the 6-domain grid (Financial
  Health, Family Protection, Career Growth, Education Planning, Health Readiness, Decision Intelligence) ·
  **"Verify My Email"** CTA · footer **"PRIVATE BETA MEMBER…"**.
- The button + paste-link use the exact Supabase token URL — verification works unchanged.

### Email 2 — Welcome (`emails/out/welcome.html`, send via Resend)

- Headline **"Let's build your Life Model."** · a **Life Model Status** panel (Finance/Family/Career/
  Education/Health) using **honest "Not started" placeholders — no fabricated percentages** · **Next Best
  Action** panel with **"Start Building"** CTA.

### Email 3 — Activation (`emails/out/activation.html`, send via Resend)

- Headline **"Your Life Model is ready to begin."** · primary CTA **"Continue Where You Left Off"** ·
  **Ways to begin** with real deep-links: `/dashboard/advisor`, `/dashboard/documents`, `/dashboard/family`.

### Deployed live (Supabase Auth, Management API → HTTP 200)

All four auth emails were rebuilt + deployed: `confirmation`, `magic_link`, `invite`, `recovery`. Verified
post-deploy: the live confirmation template carries the real logo, navy theme, valid token link, and a
fresh signup still returns 200 + `confirmation_sent_at`.

---

## Part 4 — Validations

- **Generated HTML:** `supabase/email-templates/{confirmation,magic_link,invite,recovery}.html` (deployed)
  and `apps/web/emails/out/{welcome,activation,verification.preview}.html` (open in a browser to view —
  these are the "screenshots"/previews; no headless browser was available to capture PNGs in this env).
- **Mobile:** 600px max-width fluid container; `max-width:100%` images; 2-column domain grid degrades to
  comfortable ~150px chips at 320px. Table-based layout = robust across clients.
- **Dark mode:** the design is intentionally dark navy with `color-scheme: dark` — renders identically in
  light- and dark-mode clients (no inversion surprises). Logo (teal compass + light wordmark) reads on navy.
- **Accessibility:** logo has `alt="LifeNavigator"`; preheader/preview text set per email; link text is
  descriptive. Contrast (WCAG AA+): ink `#eaf1fb` on card `#0c1c33` ≈ 14:1; teal `#2dd4bf` on navy ≈ 7:1;
  CTA label `#04201c` on teal ≈ 8:1.
- **Trust:** no fabricated data — Life Model shows "Not started"; all `%` in output are CSS only.

## Remaining / to enable lifecycle sends

- Set `RESEND_API_KEY` + `EMAIL_FROM` in the web app (Vercel) env; then wire `sendWelcomeEmail` /
  `sendActivationEmail` at a once-per-user point (e.g. `/api/onboarding/advisor-complete`). The senders
  no-op safely until the key is present, so they're safe to wire now.
- Resolve the Resend account/domain item from Part 1 so real inboxes receive mail.
