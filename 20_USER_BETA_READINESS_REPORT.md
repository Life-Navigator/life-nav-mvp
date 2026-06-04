# 20_USER_BETA_READINESS_REPORT.md

**Date:** 2026-06-04
**Prod:** `life-nav-mvp-web.vercel.app` (commit `5b9cf05`) → cutting over to `app.lifenavigator.tech`.
**Basis:** live evidence from this session's runs (no new sim run; per instruction).

---

## FINAL VERDICT: 🟡 READY_WITH_P1_FIXES

The full functional path is **proven end-to-end for 20 concurrent users** (20/20 journey, 0 chat fallback,
0 budget blocks). What remains are **P1 operational items** — none block a _controlled, admin-invited_
20-user beta, but they should be closed for a safe launch: a funded+monitored Gemini balance, secret
rotation, SMTP (or commit to admin-link invites), financial-cache freshness, and trust-copy honesty.

---

## Scorecard

| Dimension             | Score | Verdict | Basis / gap                                                                                                                                                                                                                                                                |
| --------------------- | :---: | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Infrastructure**    | 9/10  | ✅      | Supabase, Neo4j (Aura), Qdrant, Fly, Vercel all operational + deployed. Gap: prod deploy is a manual Vercel API call (push≠prod).                                                                                                                                          |
| **Auth**              | 8/10  | ✅      | Magic/invite links (Supabase built-in), 25/25 link flows, 20/20 journey, expired→friendly, resend. Gap: SMTP for _emailed_ invites pending (admin links work now); recovery page not wired.                                                                                |
| **Onboarding**        | 9/10  | ✅      | 20/20 invite→activate→dashboard; no dead ends/orphans; `setup_completed` gate. Gap: activation ~7–15s with no progress indicator.                                                                                                                                          |
| **Grounding**         | 9/10  | ✅      | Authoritative read across ALL personal domains; **0 hallucination**, fails closed; 20/20 grounded chat. Gap: query-cache can serve a stale value after data change (P1).                                                                                                   |
| **Recommendations**   | 8/10  | ✅      | ≥3 categorized/persona, persona-aware, APR-correct; 20/20 returned in journey. Gap: ranged/inflation-adjusted projections + spending-insight detector (V3).                                                                                                                |
| **Chat**              | 7/10  | ⚠️      | Grounded, **0 fallback / 0 budget-429 under 20-user load** — _with a funded Gemini key_. **Risk:** key is **prepay**; credits hit $0 once → 98% fallback. Needs balance + alarm (P1). Latency ~6s.                                                                         |
| **Economic Controls** | 9/10  | ✅      | $4/day cap + breaker verified at boundary; alias bug fixed; platform $500 intact. Gap: per-turn cost under-counts (~3 Gemini calls metered as 1) → platform forecast ~3× optimistic.                                                                                       |
| **Trust**             | 6/10  | ⚠️      | Governance/character layer active (422s), grounded refusals, advice disclaimers, legal links. Gap (prior audits, still open): /security copy honesty, **sample-data banner**, SOC2/SLA claims, fake module vote counts, methodology page.                                  |
| **Website**           | 7/10  | ⚠️      | Marketing + legal pages live; branded auth. Gap: **domain cutover to `app.lifenavigator.tech`** pending (currently points to Google); trust-copy items above.                                                                                                              |
| **Operations**        | 6/10  | ⚠️      | Analytics events + audit/usage rows write; economic breakers live. Gap: **secret rotation pending** (Supabase/Vercel/worker/Gemini tokens reused all session); **Gemini credit monitoring**; email-delivery monitoring (pending SMTP); no alerting/on-call; manual deploy. |

**Composite: ~7.8/10 → READY_WITH_P1_FIXES.**

---

## Why not READY_FOR_20_USERS (yet)

Two items carry real launch risk if left unaddressed:

1. **Gemini prepay balance (P1, ops):** we _observed_ chat go 98%-fallback when credits hit $0. A 20-user
   beta will burn credits; without a funded balance + a low-balance alarm, chat can silently die again.
2. **Secret rotation (P1, security):** the service-role, Vercel, worker, and Gemini credentials were reused
   across many runs and must be rotated before real users.

Both are quick to close. Once done (plus a decision on SMTP-vs-admin-links), this moves to
**READY_FOR_20_USERS**.

## Why not NOT_READY

Every _functional_ dimension is verified live at 20-user concurrency: auth, onboarding, activation,
dashboard, recommendations, grounded/no-hallucination chat, and economic enforcement all passed 20/20. The
product works; the gaps are operational hygiene and polish, not broken features.

See `TOP_10_FINAL_FIXES.md` (ordered) and `20_USER_BETA_LAUNCH_CHECKLIST.md` (go/no-go).
