# EMAIL_AUTH_LAUNCH_GATE_REPORT.md — 2026-06-25 (commit b9db4a3)

## Status: GATED on secure secret provision (no secrets in chat/logs/commits — by rule)

The two required secrets are NOT present in the environment (checked: env vars unset, no secure file, not on
Fly). Per the sprint hard rule I will not request them in chat. Close the gate by injecting them **in your own
shell** (they never touch this transcript, logs, or git):

```
SUPABASE_MGMT_PAT=sbp_xxxxx RESEND_KEY=re_xxxxx \
TEST1=you+beta1@example.com TEST2=friend@example.com \
bash scripts/configure-auth-email.sh
```

The script reads the secrets from env only and **prints no secret values** — it outputs the Resend domain
status, the applied SMTP host/sender/site, and the magic-link send HTTP per test inbox.

## What it configures (Supabase Auth → SMTP, via Management API)

| Setting                 | Value                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------- |
| SMTP host / port / user | `smtp.resend.com` / `465` / `resend`                                                |
| SMTP pass               | `<RESEND_KEY>` (never logged)                                                       |
| Sender / admin          | `welcome@lifenavigator.tech` (LifeNavigator)                                        |
| Site URL                | `https://lifenavigator.tech`                                                        |
| Redirect allow-list     | `…/auth/confirm, …/auth/callback, …/auth/password-reset, …/dashboard, …/onboarding` |
| mailer_autoconfirm      | `false`                                                                             |

## Required from you (secure handling only)

1. Supabase Management API PAT (`sbp_…`) — Supabase → Account → Access Tokens.
2. Resend API key (`re_…`) + domain `lifenavigator.tech` shows **Verified** in Resend.

## Acceptance (the gate is CLOSED only when all pass)

- Resend domain = verified.
- Two NON-FOUNDER inboxes receive the magic link.
- Clicking it establishes an SSR session → lands on `/dashboard` from a CLEAN browser.
- Session persists on refresh; logout → login again works.
- No local/dev email dependency (Supabase sends server-side via Resend).

Until closed: founder/internal access via admin-minted links only (testing, not beta users).
