# Microsoft (Outlook) OAuth Setup

**Date:** 2026-06-17 · For connecting Outlook / Office 365 / personal Microsoft email + calendar. Mirrors the Google setup; code is wired and tested — this is the owner provisioning checklist.

## What the code expects (already shipped)

- Callback path: **`/api/auth/microsoft/callback`** (alias → tested integrations handler; token exchange → encrypted Supabase store via `upsert_integration_token` → audit).
- Authority: `https://login.microsoftonline.com/{tenant}/oauth2/v2.0` (tenant defaults to `common` = work/school **and** personal accounts).
- Scopes requested: `openid profile email offline_access` + `Mail.Read Mail.Send` (email) + `Calendars.Read Calendars.ReadWrite` (calendar).

## Step 1 — Register the app in Azure (Entra ID)

1. [Azure Portal](https://portal.azure.com) → **Microsoft Entra ID** → **App registrations** → **New registration**.
2. Name: `LifeNavigator`. Supported account types: **"Accounts in any organizational directory and personal Microsoft accounts"** (matches `tenant=common`, so both Outlook.com and Office 365 work).
3. **Redirect URI** → platform **Web** → add all of:
   - `https://lifenavigator.tech/api/auth/microsoft/callback`
   - `https://www.lifenavigator.tech/api/auth/microsoft/callback`
   - `https://life-nav-mvp-web-git-main-riffe007s-projects.vercel.app/api/auth/microsoft/callback`
   - `http://localhost:3000/api/auth/microsoft/callback`
4. Register → copy the **Application (client) ID**.
5. **Certificates & secrets** → **New client secret** → copy the **Value** (not the ID) immediately.
6. **API permissions** → **Microsoft Graph** → **Delegated**: add `Mail.Read`, `Mail.Send`, `Calendars.Read`, `Calendars.ReadWrite`, `offline_access`, `openid`, `profile`, `email`. (No admin consent needed for delegated personal-scope access; users consent at connect time.)

## Step 2 — Env vars (Vercel only — same as Google)

Set in **Vercel → Settings → Environment Variables** (Production + Preview) and `apps/web/.env.local` for local:

```
MICROSOFT_CLIENT_ID=<Application (client) ID>
MICROSOFT_CLIENT_SECRET=<client secret VALUE>        # Vercel UI, not chat/repo
MICROSOFT_TENANT_ID=common                            # leave 'common' for mixed personal+work
MICROSOFT_REDIRECT_URI=https://lifenavigator.tech/api/auth/microsoft/callback   # match per environment
# Shared with Google (set once):
NEXT_PUBLIC_APP_URL=https://lifenavigator.tech
INTEGRATION_ENCRYPTION_KEY=<32-byte hex>              # same key used to encrypt all provider tokens
```

Preview env → `MICROSOFT_REDIRECT_URI` = the `…git-main…vercel.app` callback; local → the `localhost:3000` callback. **Not** in Fly or Supabase (read only in `apps/web`).

## Step 3 — Redeploy + test

Redeploy, then click **Connect** → Microsoft on `/dashboard/email` or `/dashboard/calendar`. Flow: consent → `/api/auth/microsoft/callback` → token exchange → encrypted store → Outlook mail / calendar render.

## Verification posture (good news)

Microsoft delegated Graph scopes (`Mail.Read`, `Calendars.Read`, etc.) **do not require Microsoft app verification** for users to consent — no equivalent of Google's CASA. Publisher verification (blue "verified" badge) is optional and quick. So Microsoft is launch-ready without a lengthy review — unlike Google's restricted scopes (see `GOOGLE_VERIFICATION_PLAN.md`).
