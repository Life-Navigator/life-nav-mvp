# DOMAIN_CUTOVER_PLAN.md — app.lifenavigator.tech + Resend SMTP

**Date:** 2026-06-04
**Goal:** Serve the app at **`app.lifenavigator.tech`** and send branded auth email from
**`lifenavigator.tech`** via Resend. DNS is at **Hostinger** (NS `*.dns-parking.com`).

---

## Current state (audited)

| Item                     | State                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------- |
| `lifenavigator.tech`     | Live on Hostinger; **Google Workspace email** (MX → `SMTP.GOOGLE.COM`)              |
| `app.lifenavigator.tech` | ⚠️ currently → `ghs.googlehosted.com` (**Google**, not Vercel)                      |
| Apex SPF                 | `v=spf1 include:_spf.reach.hostinger.com ~all` (Hostinger; Brevo code also present) |
| DMARC                    | `v=DMARC1; p=none` (exists ✅)                                                      |
| Resend DKIM              | none yet                                                                            |
| Vercel                   | ✅ **`app.lifenavigator.tech` added to the project** (this phase); awaits DNS       |
| Supabase `site_url`      | `https://life-nav-mvp-web.vercel.app` (unchanged until cutover)                     |

---

## PART 1 — App domain cutover (→ app.lifenavigator.tech)

> Sequenced so the app is never broken: DNS + cert first, _then_ flip Supabase. The current
> `*.vercel.app` URL keeps working throughout.

1. ✅ **Vercel:** `app.lifenavigator.tech` added to project `prj_Ecx1NQfhwva1Y2DxYzD4GXhCIrLu` (done).
2. ⏳ **Hostinger DNS (YOU):** change the `app` record:
   - **Remove** `app CNAME ghs.googlehosted.com` (the Google Sites pointer).
   - **Add** `app CNAME cname.vercel-dns.com` (TTL low, e.g. 300s).
3. ⏳ **Wait** for propagation + Vercel auto-issues the TLS cert (minutes). Verify:
   `curl -sI https://app.lifenavigator.tech` → 200/redirect from Vercel.
4. ⏳ **Supabase Auth (I'll apply):** `site_url = https://app.lifenavigator.tech`; add
   `https://app.lifenavigator.tech/**` to `uri_allow_list` (keep the `*.vercel.app` entries during overlap).
5. ⏳ **Tooling:** set `APP_URL=https://app.lifenavigator.tech` in `beta-invite.mjs` / journey scripts.
6. ⏳ **Smoke (I'll run):** mint an invite link on the new domain → confirm session → `/onboarding`.
7. ⏳ **(Later) Google config:** the apex `google-site-verification` + Workspace MX stay; only the `app`
   subdomain moves off Google.

**Rollback:** point `app` CNAME back to `ghs.googlehosted.com`; revert Supabase `site_url`. The
`*.vercel.app` domain is untouched, so nothing is lost.

---

## PART 2 — Resend SMTP for lifenavigator.tech (auth email)

Coexists with Google Workspace (Google = inbound MX; Resend = outbound DKIM signing). Use a **send
subdomain** to avoid touching the apex MX.

1. ⏳ **Resend (YOU):** create account → add domain **`lifenavigator.tech`** (Resend will provision a
   `send.lifenavigator.tech` subdomain) → sender `beta@lifenavigator.tech`.
2. ⏳ **Hostinger DNS (YOU)** — add exactly what Resend shows (typical set):
   - **DKIM:** `TXT` `resend._domainkey` = `p=…` (Resend's value).
   - **SPF (send subdomain):** `TXT` `send` = `v=spf1 include:amazonses.com ~all` (Resend's value).
   - **Return-Path MX:** `MX` `send` = `feedback-smtp.<region>.amazonses.com` (Resend's value).
   - DMARC already exists (`p=none`) — optionally add `rua=mailto:dmarc@lifenavigator.tech`.
     _(Do NOT modify the apex MX — Google Workspace stays.)_
3. ⏳ **Verify** in Resend (DNS propagation) → status "Verified".
4. ⏳ **Give me the Resend API key (`re_…`).** I will then `PATCH` Supabase:
   ```
   smtp_host=smtp.resend.com  smtp_port=465  smtp_user=resend  smtp_pass=<re_…>
   smtp_admin_email=beta@lifenavigator.tech  smtp_sender_name=LifeNavigator
   rate_limit_email_sent=30
   ```
   (I will NOT set `smtp_host` before the key is valid — that would break all email.)
5. ⏳ **Delivery test (I'll run):** trigger a real invite/magic email → confirm Resend "Delivered" +
   SPF=pass + DKIM=pass + inbox (not spam).

> **Alternative already on the domain:** a **Brevo** code is present and Google Workspace is active — either
> could provide SMTP instead of Resend if you prefer (same Supabase SMTP fields, different host/creds).

---

## What's done vs pending

- ✅ Vercel domain added; branded templates use `{{ .SiteURL }}` so they follow the cutover automatically.
- ⏳ **Your actions:** Hostinger CNAME (app), Resend account + DKIM/SPF/return-path records, Resend API key.
- ⏳ **My actions (after yours):** Supabase `site_url`/allow-list flip, SMTP config, re-smoke, delivery test.

**Net:** the app-domain cutover and Resend SMTP both reduce to **Hostinger DNS edits + a Resend key** on
your side; everything on the Vercel/Supabase/code side is staged. Per your instruction, the 20-user
simulation runs only after these are complete.
