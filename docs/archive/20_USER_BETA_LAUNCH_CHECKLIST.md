# 20_USER_BETA_LAUNCH_CHECKLIST.md

**Date:** 2026-06-04 · Verdict gate: **READY_WITH_P1_FIXES** → complete the P0s + decide email path to reach GO.

---

## A. Pre-launch — BLOCKING (must be ✅ before inviting real users)

- [ ] **Gemini balance funded + low-balance alarm** set (prepay hit $0 once → chat died). _(P0)_
- [ ] **All secrets rotated** — Supabase service-role + `sbp_` token, `GRAPHRAG_WORKER_SECRET`, Vercel token,
      Gemini key — and re-set in Supabase/Vercel/Fly. _(P0)_
- [ ] **Email path decided:**
  - [ ] _Either_ Resend SMTP live for `lifenavigator.tech` (DKIM/SPF/DMARC verified, Supabase SMTP set), **or**
  - [ ] _Commit to admin-minted invite links_ for all 20 (`beta-invite.mjs generate …`). _(P1 — admin links unblock launch today.)_

## B. Pre-launch — STRONGLY RECOMMENDED

- [ ] **Domain cutover** to `app.lifenavigator.tech` (Vercel domain added, Hostinger CNAME repointed,
      Supabase `site_url` + redirect allow-list + invite `APP_URL` updated, magic-link smoke re-run). _(P1)_
- [ ] **Sample-data banner** on activated dashboards; trust-copy claims (SOC2/SLA/votes) removed or justified. _(P1)_
- [ ] **Query-cache freshness** for personal facts (short TTL or invalidate on finance writes). _(P1)_
- [ ] **Per-turn cost metering** corrected (or platform cap headroom widened to absorb the ~3× under-count). _(P1)_

## C. Launch day

- [ ] Generate 20 invite links: `node apps/web/beta-invite.mjs generate <20 emails…>` (or send via Resend if live).
- [ ] Distribute links; confirm first 2–3 users complete invite → activate → dashboard → chat.
- [ ] Watch the Gemini balance + `economic.usage_events` (cost plausible, no 429 spikes).
- [ ] Confirm grounded chat (spot-check 2 users get their real balances, no hallucination).

## D. Post-launch monitoring (first 72h)

- [ ] Funnel: `user_signed_up` → `persona_activation` → `first_chat_message` → recommendation reads.
- [ ] Chat health: fallback rate (target <5%), budget-429 rate (target 0 for normal use), p50 latency.
- [ ] Gemini credit burn vs balance; platform monthly spend vs $500 cap.
- [ ] Any governance 422 spikes (safety layer); any `model_call_failed` events.

## Verified READY (no action needed)

- ✅ Auth: invite/magic links → session → onboarding (25/25 + 20/20).
- ✅ Onboarding/activation: 20/20, sets `setup_completed`, no orphans.
- ✅ Grounding: authoritative across all domains, **0 hallucination**, fails closed.
- ✅ Recommendations: ≥3 categorized/persona, 20/20 returned.
- ✅ Chat: 20/20 grounded, 0 fallback / 0 budget-429 under load (funded key).
- ✅ Economic controls: $4/day cap + breaker verified; platform $500 intact.
- ✅ Branded auth emails deployed.

## GO / NO-GO

**GO when Section A is fully checked.** Section A is small (fund Gemini, rotate secrets, pick the email
path). Everything functional is already green.
