# EMAIL_DELIVERY_TEST_REPORT.md

**Date:** 2026-06-04
**Scope:** The auth-link **flow** (generation → click → session → redirect) is fully tested against
production. Real **inbox delivery** (SPF/DKIM pass, not-spam) is **pending the Resend SMTP setup** (see
`SMTP_AUTH_SETUP_REPORT.md`) — it cannot be tested until you complete the Resend account + DNS.

---

## Results

| Test                                                             | Result                                | Evidence                                                                                                                                                |
| ---------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **5 fresh invite emails** (link → session → onboarding)          | ✅ **5/5** (+20/20 in the launch sim) | each `type:invite` link → `307` + `sb-…` cookies → `/onboarding/financial-profile`, authed                                                              |
| **5 magic-link emails** (existing user → session)                | ✅ **5/5**                            | each `type:magiclink` link → `307` + session → onboarding                                                                                               |
| **Expired / used-link flow**                                     | ✅ **PASS**                           | first use succeeds; **reusing the same token** → `/auth/login?error=link_expired` (friendly notice + "request a new link")                              |
| **Resend flow**                                                  | ✅ mechanism in place                 | `/auth/magic` `signInWithOtp` (re)sends; rate-limit shows a friendly message. _Actual email send is the built-in-mailer path until SMTP is configured._ |
| **Redirect to `/onboarding/financial-profile`**                  | ✅ **all cases**                      | every successful link lands there for new users; onboarded users → `/dashboard`                                                                         |
| **Real inbox delivery** (arrives, SPF/DKIM pass, inbox-not-spam) | ⏸️ **PENDING SMTP**                   | requires Resend domain verified + SMTP configured                                                                                                       |

---

## What "pending SMTP" specifically means

The token/redirect/session machinery is proven end-to-end; what's untested is the **transport** — whether
a real email reaches a real inbox and passes authentication. That depends entirely on the Resend domain +
DNS, which only you can provision. The moment SMTP is live I will run:

```
# delivery probe (after SMTP configured): trigger a real send to a seeded inbox and confirm arrival + headers
node apps/web/beta-invite.mjs … (or signInWithOtp to a real mailbox) → check Resend dashboard "Delivered" + SPF=pass DKIM=pass
```

## Fallback path (tested, recommended for the 20-user beta)

Admin-minted links via `beta-invite.mjs generate` bypass email transport entirely — **no deliverability
risk**. 25/25 link-flow successes across this report + the journey/sim runs.

## Net

- **Link flow & friendly error handling: production-verified (✅).**
- **Email transport: blocked on Resend setup (⏸️).** Beta can launch now on admin links; switch to emailed
  links once Resend is verified.
