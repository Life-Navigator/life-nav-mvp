# Resend / SMTP Setup Report — lifenavigator.tech

**Date:** 2026-06-05
**Goal:** Send transactional + Supabase auth email from `welcome@lifenavigator.tech` (optional `beta@lifenavigator.tech`) via Resend, removing the Supabase built-in ~2 emails/hour cap.

---

## ⚠️ Important about the provided API key

The key you shared (`re_a28C…`) is a **send-only / restricted key**:

```
$ curl -H "Authorization: Bearer re_a28C…" https://api.resend.com/domains
{"statusCode":401,"message":"This API key is restricted to only send emails","name":"restricted_api_key"}
```

- ✅ It **is** the right kind of key for SMTP/sending — use it as the Supabase SMTP password and the app `RESEND_API_KEY`.
- ❌ It **cannot** create/verify domains via API, so I couldn't provision the domain or fetch the DKIM values for you — that's a dashboard step (below).
- 🔐 It was shared in plaintext in chat. **Rotate it** in Resend → API Keys after setup, and store the new value only in Vercel + Supabase (never in the repo).

---

## Step 1 — Add & verify the domain in Resend (dashboard)

Resend → **Domains → Add Domain** → `lifenavigator.tech` (root domain, so you can send from `welcome@lifenavigator.tech`). Pick a region (default **us-east-1**). Resend then shows the **exact** DNS records — copy those values; the DKIM key is unique to your domain.

They will look like this (region us-east-1 shown; **use the exact values Resend gives you**):

| Type    | Name / Host                           | Value                                              | Priority |
| ------- | ------------------------------------- | -------------------------------------------------- | -------- |
| **MX**  | `send`                                | `feedback-smtp.us-east-1.amazonses.com`            | 10       |
| **TXT** | `send`                                | `v=spf1 include:amazonses.com ~all`                | —        |
| **TXT** | `resend._domainkey`                   | `p=MIGfMA0GCSq…` _(long, unique — from dashboard)_ | —        |
| **TXT** | `_dmarc` _(optional but recommended)_ | `v=DMARC1; p=none;`                                | —        |

Add these in **Hostinger** (same DNS zone as the cutover). They live on the `send` / `resend._domainkey` / `_dmarc` **subdomains** and do **not** conflict with the apex A record or the `www`/`app` CNAMEs.

Then click **Verify** in Resend (propagation 5–60 min). Wait for **Verified** before sending.

---

## Step 2 — Point Supabase Auth at Resend SMTP

Supabase → project `diwkyyahglnqmyledsey` → **Authentication → Settings → SMTP Settings → Enable Custom SMTP**:

| Field        | Value                             |
| ------------ | --------------------------------- |
| Host         | `smtp.resend.com`                 |
| Port         | `465` (SSL) — or `587` (STARTTLS) |
| Username     | `resend`                          |
| Password     | the Resend API key (`re_…`)       |
| Sender email | `welcome@lifenavigator.tech`      |
| Sender name  | `LifeNavigator`                   |

Then **Authentication → Rate Limits**: raise "Emails sent per hour" from the built-in `2` to your beta volume (e.g. 50–100). The 2/hr cap was the documented root cause of beta invite emails not arriving.

> Do **not** enable custom SMTP until the Resend domain shows **Verified**, or auth emails will bounce/spam.

---

## Step 3 — App-level email (optional, secondary)

The app's own mailer (`src/lib/email/email-service.ts`) now defaults `EMAIL_FROM=welcome@lifenavigator.tech`. If you use it (vs. Supabase-sent auth mail), set in Vercel:

```
RESEND_API_KEY = re_…
EMAIL_FROM     = welcome@lifenavigator.tech
EMAIL_FROM_NAME= LifeNavigator
```

(Most auth email — signup confirm, magic link, invite, recovery — is sent by **Supabase**, so Step 2 is the one that matters for the beta flow.)

---

## Step 4 — Verify sending

After domain Verified + SMTP saved:

```bash
# Direct Resend send test (uses the send-only key — fine):
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" -H "Content-Type: application/json" \
  -d '{"from":"LifeNavigator <welcome@lifenavigator.tech>","to":["you@yourmail.com"],"subject":"Resend test","html":"<p>It works.</p>"}'
# → {"id":"…"} and the mail arrives (check spam on first send).
```

Then trigger a real **signup** and a **magic link** from `https://app.lifenavigator.tech` and confirm delivery (covered in `AUTH_DOMAIN_E2E_REPORT.md`).

**Pass criteria**

- [ ] Resend domain `lifenavigator.tech` = **Verified** (DKIM + SPF green)
- [ ] Supabase custom SMTP enabled, sender `welcome@lifenavigator.tech`
- [ ] Rate limit raised above 2/hr
- [ ] Test email delivered; signup + magic-link emails arrive from the new sender
- [ ] API key rotated; stored only in Vercel + Supabase

## Status

**PENDING** — domain verification + Supabase SMTP are dashboard actions. Senders `welcome@` (and optional `beta@`) `lifenavigator.tech` are ready to use once the domain is Verified.
