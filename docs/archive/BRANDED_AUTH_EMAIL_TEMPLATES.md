# BRANDED_AUTH_EMAIL_TEMPLATES.md

**Date:** 2026-06-04
**Status:** ✅ All 4 templates **deployed live** to Supabase Auth (Mgmt API). Render via built-in mailer
now and via Resend SMTP once configured — no further change needed.

---

## What's deployed

Enterprise-grade, mobile-safe HTML (table layout, inline styles, single CTA). Each template:

- **Header band** — `#1e3a8a` with the **LifeNavigator** wordmark.
- **Heading + one-line intro** specific to the action.
- **Primary CTA button** (`#2563eb`) → `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=…&next=…`
  (the SSR server-verify route — establishes the session and lands in onboarding).
- **Expiry/ignore note** (1 hour).
- **Brand messaging strip** (the core copy, verbatim).
- **Footer** (private-beta context).

### Core messaging (in every template)

> LifeNavigator helps you make better decisions across **finance, career, education, health,** and major
> life moments.
> **Grounded in your data · Governed for trust · Built for real life.**

### The four templates

| Template              | Subject                                     | Heading / CTA                                                   | Link `type` → `next`                |
| --------------------- | ------------------------------------------- | --------------------------------------------------------------- | ----------------------------------- |
| **Invite user**       | _Your invitation to the LifeNavigator beta_ | "You are invited to LifeNavigator" / **Accept your invitation** | `invite` → `/onboarding`            |
| **Magic link**        | _Your LifeNavigator sign-in link_           | "Your secure sign-in link" / **Sign in to LifeNavigator**       | `magiclink` → `/onboarding`         |
| **Confirm signup**    | _Confirm your LifeNavigator account_        | "Confirm your email" / **Confirm and continue**                 | `signup` → `/onboarding`            |
| **Password recovery** | _Reset your LifeNavigator password_         | "Reset your password" / **Reset password**                      | `recovery` → `/auth/reset-password` |

All verified live in the Supabase config (`mailer_templates_*_content` contain the branded HTML +
`/auth/confirm?token_hash={{ .TokenHash }}`).

---

## Design rationale (enterprise / premium / trustworthy)

- **Table + inline styles** — renders consistently in Gmail/Outlook/Apple Mail (no external CSS, no media
  queries required; `max-width:520px` keeps it readable on mobile).
- **One CTA, no competing links** — reduces phishing-confusion and improves click-through.
- **Security framing** — explicit expiry + "ignore if you didn't request this" builds trust and reduces
  support load.
- **No tracking pixels / external images** — better deliverability (image-blocking inboxes still render the
  full message; the wordmark is text, not an image).

## Note — recovery

The recovery CTA points at `/auth/confirm?type=recovery&next=/auth/reset-password`. `verifyOtp` establishes
the session; ensure a `/auth/reset-password` page exists to capture the new password (the beta is
passwordless, so recovery is secondary — tracked as a follow-up).
