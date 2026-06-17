# Google OAuth Verification & Publishing Plan

**Date:** 2026-06-17 · When/how to get Google to approve the app for public launch, so we can go live right after a positive pilot. (Confirm specifics on the live OAuth consent screen — Google policy shifts.)

## The core fact that drives the timeline: scope tiers

Google sorts OAuth scopes into three tiers, each with a different bar:

| Tier              | Our scopes                                                           | Requirement                                                                                                                     | Time                    |
| ----------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| **Non-sensitive** | `openid`, `profile`, `email`                                         | none                                                                                                                            | instant                 |
| **Sensitive**     | Calendar (`calendar.readonly/events`), Contacts/People, most Fitness | **OAuth verification** (brand review: verified domain, homepage, privacy policy, demo video, scope justification). **No CASA.** | ~days–few weeks         |
| **Restricted**    | **Gmail** (`gmail.readonly`, `gmail.send`, …) and health data        | verification **+ annual CASA** (Cloud Application Security Assessment by a Google-authorized third-party assessor)              | **weeks–months + cost** |

**The bottleneck is Gmail.** Any Gmail scope makes us a "restricted scope" app → triggers CASA, which is the long pole (commonly 6–12+ weeks and a recurring assessor fee). Calendar alone is only "sensitive" (no CASA).

## During the pilot: no verification needed

Keep the app in **Testing** mode and add the ≤100 pilot users as **Test users**. All scopes (including Gmail) work for them immediately (with the "unverified app" interstitial). **The pilot is not blocked by verification** — so verification work runs _in parallel_, not after.

## Strategy to launch fast after a positive pilot

The single biggest lever is **which scopes you launch with**:

- **Fast path (recommended for v1 public launch):** launch with **Calendar only** (sensitive) + keep Gmail **test-only / "coming soon."** Sensitive-only verification clears in ~days–weeks → you can go public almost immediately after the pilot. Add Gmail later once CASA completes.
- **Gmail-at-launch path:** if Gmail must ship publicly in v1, **start the CASA assessment NOW** (during the pilot) — it's the only way the ~2–4 month clock finishes near the pilot's end instead of starting after it.

### Scope minimization (do this regardless — easier approval, smaller attack surface)

Our current bundles request more than the features use. Trim before submitting:

- Email page only **reads** → drop `gmail.send` (`gmailSend`); request `gmail.readonly` only. (Still restricted, but one fewer restricted scope and a cleaner justification.)
- Calendar page only **reads** → request `calendar.readonly` only; drop `calendar.events` (write).
- **Drop Fitness / Health scopes entirely** for now — no feature consumes them yet, and they add sensitive-scope review burden. Re-add when a health feature actually ships.

## What you can prepare NOW (no pilot dependency)

1. **Verify domain ownership** of `lifenavigator.tech` in Google Search Console; add it as an Authorized Domain on the consent screen.
2. **Public homepage** + **privacy policy** URL that explicitly describes Google user-data use and, for restricted scopes, the **Limited Use** compliance statement.
3. **OAuth consent screen**: app name, logo, support email, scopes + a one-line justification per scope.
4. **Demo video** (unlisted YouTube): show the consent grant and exactly how each sensitive/restricted scope is used in-product.
5. If keeping Gmail: **select a Google-authorized CASA assessor** and kick off the engagement.

## Recommended timeline

| When                       | Action                                                                                                                                                                                                                 |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Now**                    | App in Testing + pilot users as test users (pilot runs). Decide final launch scope set. Stand up homepage + privacy policy + domain verification + consent-screen branding. If Gmail-at-launch → engage CASA assessor. |
| **During pilot (wks 1–4)** | Record demo video; finish consent screen; CASA in progress (if Gmail). Trim scopes to readonly + drop fitness/health.                                                                                                  |
| **Positive pilot result**  | Submit for OAuth verification. Sensitive-only (Calendar) → approval typically ~days–weeks → **launch**. Gmail-included → launch gated on CASA completion.                                                              |

## Bottom line

- **Microsoft**: no comparable review — launch-ready once the Azure app is provisioned (`MICROSOFT_OAUTH_SETUP.md`).
- **Google Calendar (sensitive)**: start the consent-screen + homepage/privacy assets now; verification after a positive pilot is ~days–weeks.
- **Google Gmail (restricted)**: CASA is the long pole — **start it now, in parallel with the pilot**, or launch v1 with Calendar-only and add Gmail post-CASA.
