# TOP_10_FINAL_FIXES.md

**Date:** 2026-06-04 — ordered by launch risk. P0 = before any real user; P1 = before/at launch; P2 = soon after.

---

### 1. 🔴 P0 — Fund + monitor the Gemini balance

The key is **prepay**; it hit $0 once and chat went 98%-fallback. **Fix:** ensure a funded balance and a
low-balance alarm (or switch to pay-as-you-go billing). Without this, chat can die silently mid-beta.
_Owner: you (Gemini/AI Studio billing)._

### 2. 🔴 P0 — Rotate all shared secrets

Service-role key, Supabase `sbp_…` token, `GRAPHRAG_WORKER_SECRET`, Vercel token, and the Gemini key were
reused across many runs. **Rotate before real users** and re-set in Supabase/Vercel/Fly.

### 3. 🟠 P1 — Email delivery: configure Resend SMTP for `lifenavigator.tech` (or commit to admin links)

No SMTP → built-in mailer (~2/hr). **Fix:** Resend account + DKIM/SPF/DMARC at Hostinger + API key → I
apply the Supabase SMTP config. **Until then:** invite the 20 via admin-minted links (verified 25/25).
_See `SMTP_AUTH_SETUP_REPORT.md`._

### 4. 🟠 P1 — Domain cutover to `app.lifenavigator.tech`

`app.lifenavigator.tech` currently points to Google, not Vercel. **Fix:** add the domain in Vercel →
repoint the CNAME at Hostinger → update Supabase `site_url` + redirect allow-list → update `APP_URL` in the
invite tooling. _See the cutover plan (this phase)._

### 5. 🟠 P1 — Query-cache staleness for personal facts

`graphrag.query_cache` (keyed user_id+query, TTL) isn't invalidated on data change — a changed balance can
read stale. **Fix:** drop/short-TTL the cache for personal-fact queries, or invalidate on finance writes.

### 6. 🟠 P1 — Per-turn cost under-count

The governor meters 1 Gemini call/turn; a turn makes ~3 (embed + Cypher + answer). Platform-spend forecast
is ~3× optimistic. **Fix:** thread real token usage back into `actual_micros`, or meter the sub-calls.

### 7. 🟠 P1 — Trust copy honesty (sample-data banner + claims)

Add the **"sample/simulated data" banner** on persona-activated dashboards; remove/justify SOC2/SLA claims
and any placeholder vote counts; ship a recommendation-methodology page. _Beta users must know what's
simulated._

### 8. 🟡 P2 — Activation progress indicator

Persona activation is ~7–15s with no feedback. **Fix:** progress/spinner + "setting up your sample
profile…" so it doesn't read as a hang.

### 9. 🟡 P2 — Recovery / password-reset page

The recovery email links to `/auth/confirm?type=recovery&next=/auth/reset-password`; ensure that page
exists to set a new password. (Low priority — beta is passwordless.)

### 10. 🟡 P2 — Net-worth definition + ranged projections

Net worth counts mortgages without the home asset (shows large negatives); future-value figures are single
point estimates. **Fix:** exclude mortgage-without-asset; present ranges + inflation-adjusted.

---

**Launch-blocking set:** #1 and #2 (P0). **Close-at-launch:** #3–#7 (P1). Everything else is fast-follow.
