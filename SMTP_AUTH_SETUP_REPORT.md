# SMTP_AUTH_SETUP_REPORT.md

**Date:** 2026-06-04
**Goal:** Replace Supabase's built-in mailer with branded Resend SMTP from `lifenavigator.com`.

---

## VERDICT: 🟡 READY_WITH_EMAIL_FIXES

Everything that can be done from code/config is **done and deployed** (branded templates, redirect
allow-list, the SSR confirm flow). The remaining steps are **account + DNS actions only you can do** — a
Resend account/API key and three DNS records at your registrar. Until then, the beta runs on
**admin-generated invite links** (no email dependency), so launch is **not blocked**.

---

## What I verified / prepared (autonomous)

| Item                                              | Status                                                                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Domain `lifenavigator.com` exists & is controlled | ✅ live (A `185.108.130.131`, MX `mx1/mx2`, NS `*.webserver.ie`)                                                         |
| Existing SPF                                      | ⚠️ present for the host's mail (`v=spf1 +a +mx +include:relay.mailchannels.net ~all`) — must **add** Resend, not replace |
| DMARC                                             | ❌ none (`_dmarc.lifenavigator.com` empty) — must add                                                                    |
| Resend DKIM                                       | ❌ none (`resend._domainkey` empty) — must add                                                                           |
| Branded templates                                 | ✅ deployed (see `BRANDED_AUTH_EMAIL_TEMPLATES.md`)                                                                      |
| Redirect allow-list + SSR confirm flow            | ✅ deployed & tested (20/20 journey)                                                                                     |
| Resend API key / SMTP secret                      | ❌ not present anywhere                                                                                                  |

---

## What YOU need to do (≈10 min)

1. **Create a Resend account** → add domain **`lifenavigator.com`** → create a verified sender
   (`beta@lifenavigator.com` or `welcome@lifenavigator.com`).
2. **Add the 3 DNS records Resend shows you**, at **webserver.ie** (your DNS host). They look like:
   - **SPF** — _append_ Resend to your existing record (don't add a 2nd SPF):
     `v=spf1 +a +mx +include:relay.mailchannels.net include:_spf.resend.com ~all` _(or the `send.` subdomain record Resend gives — follow Resend's exact value)_
   - **DKIM** — a `TXT` at `resend._domainkey` (Resend gives the exact `p=…` value).
   - **Return-Path / MX** — a `MX` or `CNAME` on a `send.` subdomain (Resend gives the exact value).
   - **DMARC (recommended)** — `TXT` at `_dmarc`: `v=DMARC1; p=none; rua=mailto:dmarc@lifenavigator.com`
3. **Wait for Resend to show the domain "Verified"** (DNS propagation, minutes–hours).
4. **Give me the Resend API key** (`re_…`). With it I will, in one pass:
   - (optional) add the domain via the Resend API and hand you the **exact** records to paste, and
   - **configure Supabase SMTP** (below), then run the delivery tests.

## The Supabase SMTP config I will apply (once the key + verified domain exist)

`PATCH /v1/projects/<ref>/config/auth`:

```
smtp_host        = smtp.resend.com
smtp_port        = 465
smtp_user        = resend
smtp_pass        = <RESEND_API_KEY>
smtp_admin_email = beta@lifenavigator.com
smtp_sender_name = LifeNavigator
rate_limit_email_sent = 30        # vs the built-in ~2/hour
```

> ⚠️ I deliberately have **not** set `smtp_host` yet: pointing Supabase at SMTP **without** a valid key
> would make it try (and fail) SMTP for every email — worse than the working built-in mailer. It stays on
> built-in until the key is real.

## Fallback (keeps the beta unblocked)

`node apps/web/beta-invite.mjs generate <emails…>` — admin-minted invite links, distributed manually. No
email server involved. Verified 5/5 + 20/20. This is the recommended path for the first 20 regardless of
SMTP.

## Why emails "don't arrive" today (root cause, restated)

No SMTP → built-in mailer capped at ~2/hour. The fix above removes the cap and adds SPF/DKIM/DMARC so mail
from `lifenavigator.com` passes auth and avoids spam.
