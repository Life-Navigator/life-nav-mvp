# OAuth Scope Trim Report (Phase 0)

**Date:** 2026-06-17 · Trim pilot OAuth to read-only, calendar-only. No Gmail/mail-send/calendar-write/Fitness/Health/Drive.

## Changes

| Provider                     | Before                                          | After (pilot)                                                                                    |
| ---------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Google `calendar` bundle** | `calendar.events` (write) + `calendar.readonly` | **`calendar.readonly` only** (`oauth.ts:104`)                                                    |
| **Google `gmail` bundle**    | `gmail.readonly` + `gmail.send`                 | **`gmail.readonly` only** (`oauth.ts:106`) — and email is "Coming soon", so not requested at all |
| **Microsoft `calendar`**     | `Calendars.Read` + `Calendars.ReadWrite`        | **`Calendars.Read` only** (`microsoft/route.ts:9`)                                               |
| **Microsoft `basic`**        | openid/profile/email/offline_access             | + **`User.Read`** (`microsoft/route.ts:7`)                                                       |
| **Microsoft `mail`**         | `Mail.Read` + `Mail.Send`                       | **`Mail.Read` only** (deferred anyway)                                                           |

## Effective pilot consent screens

- **Google (calendar connect):** `openid`, `email`, `profile`, `calendar.readonly` — all _non-sensitive_ except calendar (_sensitive_, no CASA). No restricted scopes.
- **Microsoft (calendar connect):** `openid`, `profile`, `email`, `offline_access`, `User.Read`, `Calendars.Read`.
- **Not requested anywhere:** Gmail, mail-send, calendar-write, Fitness, Health, Drive.

## Verified

- Grep confirms the only Google bundle requested in any live connect flow is `calendar` (→ readonly) + `basic`. Email page is Coming-soon (no `gmail` request); Health/Fitness is Coming-soon (no fitness request).
- `pnpm type-check` clean.

This keeps the pilot consent screen to sensitive-at-most scopes (calendar) → no Google CASA needed for the pilot, fastest verification path for v1.
