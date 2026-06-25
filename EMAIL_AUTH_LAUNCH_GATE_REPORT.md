# EMAIL_AUTH_LAUNCH_GATE_REPORT.md — 2026-06-25

## Status: BLOCKED on two owner-provided secrets (everything else is ready)

Auth emails (magic links) are sent by **Supabase Auth's SMTP**, configured at the Supabase project level —
NOT in this repo and NOT on Fly/Vercel. I cannot read or set that config without credentials that are not in
the environment (only an `re_…` placeholder in `apps/web/.env.example`; no Management PAT; Supabase/Vercel CLIs
unauthenticated). The app side is correct and verified: `signInWithOtp → ${origin}/auth/confirm`, and
`apps/web/src/app/auth/confirm/route.ts` exchanges the code for an SSR session.

## To close the gate (one command, ~2 min — secrets stay in your shell)

```
SUPABASE_MGMT_PAT=sbp_xxxxx \
RESEND_KEY=re_xxxxx \
TEST1=you+beta1@gmail.com TEST2=friend@example.com \
bash scripts/configure-auth-email.sh
```

The script: verifies the Resend domain `lifenavigator.tech` is `verified`; PATCHes Supabase Auth config →
SMTP via Resend; sets site URL + redirect allow-list; sends a real magic link to two inboxes.

## Exact provider settings it applies (Supabase Auth → SMTP)

| Setting              | Value                                                                               |
| -------------------- | ----------------------------------------------------------------------------------- |
| SMTP host            | `smtp.resend.com`                                                                   |
| SMTP port            | `465`                                                                               |
| SMTP user            | `resend`                                                                            |
| SMTP pass            | `<RESEND_KEY>` (`re_…`)                                                             |
| Sender / admin email | `welcome@lifenavigator.tech`                                                        |
| Sender name          | `LifeNavigator`                                                                     |
| Site URL             | `https://lifenavigator.tech`                                                        |
| Redirect allow-list  | `…/auth/confirm, …/auth/callback, …/auth/password-reset, …/dashboard, …/onboarding` |
| `mailer_autoconfirm` | `false` (confirmation required)                                                     |

## Required inputs from you

1. **Supabase Management API PAT** (`sbp_…`) — Supabase → Account → Access Tokens.
2. **Resend API key** (`re_…`) — Resend → API Keys — AND confirm domain `lifenavigator.tech` is **Verified**.

## Acceptance (must pass before inviting users)

- Resend domain shows `verified`.
- Magic link received by **two non-founder inboxes**.
- Clicking the link establishes an SSR session and lands on `/dashboard` from a **clean browser**.
- Login does not depend on any local/dev environment.

Until then, founder/internal access continues via admin-minted magic links (fine for testing, NOT for beta
users — a broken first login is the worst first impression).
