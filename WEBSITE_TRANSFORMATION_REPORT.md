# WEBSITE_TRANSFORMATION_REPORT.md — Decision Intelligence rebrand

**Date:** 2026-06-04
**Positioning shipped:** "Decision Intelligence for Life" (away from budgeting / AI-advisor / chatbot).
**Honest scope note:** this is the **foundation + homepage**, built to your written spec as real,
deployable Next.js. A full 13-page + onboarding + email + mobile/a11y polish to an "OpenAI/Linear" bar is
iterative and needs your eyes + the visual decisions from your prototype. What's below is live-code, not a
mockup.

---

## 1. Design system (built)

- **Tokens** in `globals.css`: `--brand-ink` (near-black), `--brand-paper` (warm off-white),
  `--brand-accent` (deep teal — harmonized with your compass logo, used _sparingly_), `--brand-muted`,
  `--brand-line`, `--brand-elev`, plus `.font-display` (tight display tracking), `.measure`, and a subtle
  `.rise` entrance (respects `prefers-reduced-motion`).
- **Why teal, not indigo:** your official logo is a teal compass-shield, so the accent ties to it. The
  "premium, not consumer-finance" feel comes from **restraint** (ink + paper dominate, one accent),
  generous whitespace, and display typography — the Linear/Stripe discipline — not from the hue.
- **Logo** — `components/brand/Logo.tsx` wraps the official `/LifeNavigator.png` as the single source of
  truth (nav, footer, and ready for auth/dashboard/emails). One swap point if the artwork changes.

## 2. Homepage (rebuilt — `app/page.tsx`)

Hero ("Decision Intelligence for Life" / "Stop managing information…") → positioning statement → **six
intelligences** (Financial, Career, Education, Health, Family, Decision) → **trust & two-layer
architecture** (Central governs HOW / Your data determines WHAT) with the 6 trust pillars → **beta-vs-full
clarity** → FAQ → final CTA. Primary CTA **Request Beta Access**, secondary **See How It Works**.

## 3. Pages

| Page                                                           | State                                         |
| -------------------------------------------------------------- | --------------------------------------------- |
| Homepage, **Beta Program**, **How It Works**, **Trust Center** | ✅ built (premium, responsive)                |
| Security, Pricing                                              | exist (pre-rebrand styling — restyle pending) |
| Product, About, Contact, Cookie Policy                         | ⏳ in IA (nav/footer link out); to build      |
| Privacy, Terms                                                 | exist under `/legal/*`                        |

Nav + Footer rebuilt to the new IA + brand.

## 4. Onboarding redesign — ⏳ spec'd, not yet rebuilt

Target: account → value < 3 min. Flow: Welcome → choose sample profile → activate → first insight →
guided tour → first chat. The functional flow already works (20/20 journey); this is a _visual/delight_
redesign of `app/onboarding/*` — sequenced next.

## 5. Emails

- ✅ **Deployed** (Supabase, branded): Invite, **Magic Link**, Confirm, Recovery — with core messaging +
  SSR links. (`BRANDED_AUTH_EMAIL_TEMPLATES.md`.)
- ⏳ **To add** (app-triggered transactional): Welcome, Beta Accepted, Persona Activated, Weekly Insights —
  these send from the app and **depend on Resend SMTP** (pending; `SMTP_AUTH_SETUP_REPORT.md`). Templates
  will reuse the same brand shell.

## 6. Mobile — ✅ responsive

Every new page uses mobile-first Tailwind (single-column → `sm`/`lg` grids; the nav has a working mobile
menu). Verify on device after deploy.

## 7. Accessibility (initial pass)

- Semantic landmarks (`<nav>`, `<section>`, `<dl>` for FAQ, `<ol>` for steps), one `<h1>`/page, ordered
  headings, `aria-label` on logo + menu toggle, `aria-expanded` on the mobile button, `aria-hidden` on
  decorative gradients, `prefers-reduced-motion` honored.
- **To audit:** color-contrast of `--brand-muted` on `--brand-paper` (looks AA but verify), focus-visible
  rings on all interactive elements, keyboard order, and screen-reader pass. Full a11y audit is a
  follow-up.

## 8. What I need from you to finish to the premium bar

1. **Confirm the visual direction** — share the key decisions from your prototype (type family, exact
   palette, hero composition) so the remaining pages match it rather than my interpretation.
2. **Logo lockups** — the PNG includes the wordmark; a transparent **shield-only** mark would make tighter
   nav/footer/email lockups (optional).
3. **Deploy decision** — this replaces the live homepage; say the word and I'll ship it so you can see it
   on `*.vercel.app` (and it carries over to `app.lifenavigator.tech` post-cutover).

**Net:** the brand foundation, homepage, key pages, nav/footer, and logo wiring are real and build-clean.
The remaining pages, onboarding delight pass, transactional emails, and a full a11y audit are the next
iteration — best done against your prototype's specifics.
