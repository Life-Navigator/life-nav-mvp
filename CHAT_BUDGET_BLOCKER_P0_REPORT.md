# CHAT_BUDGET_BLOCKER_P0_REPORT.md — LifeNavigator

**Date:** 2026-06-04
**Severity:** P0 — blocks the entire "Truth & Trust" sprint premise.
**Status:** Root cause confirmed end-to-end; **fix implemented + unit-verified**; **not yet deployed**.

---

## TL;DR

A single fabricated model id — `'gemini-default'` in `governed-route.ts` — caused **85% of all real
chat turns to be hard-stopped with HTTP 429 `budget_exceeded` after ~2 messages per user.** This was
invisible behind the prior `READY_FOR_20_USERS` verdict because no one had run a real multi-turn
conversation against production until the Beta-20 live battery. No amount of grounding, trust-page, or
retention work matters while a beta user gets ~2 messages/day, so this is the first thing fixed.

---

## Evidence (live, from the interrupted Beta-20 battery)

130 authenticated chat calls across 10 persona fixtures against production
(`life-nav-mvp-web.vercel.app`), classified from the saved transcript (`/tmp/b20transcripts.json`):

| Outcome                                                          | Count | %   |
| ---------------------------------------------------------------- | ----- | --- |
| **429 `budget_exceeded`**                                        | 110   | 85% |
| **200 "trouble reaching my reasoning engine"** (canned fallback) | 17    | 13% |
| **200 real model answer**                                        | 3     | 2%  |

Each user got **~2 successful turns** before the wall. The 3 that reached the model all said _"I don't
have your balance"_ — a **separate** grounding question tracked below.

---

## Root cause (code-grounded)

1. `governed-route.ts` estimates per-turn cost **before** the model call to gate the budget:

   ```ts
   estimateCost({
     provider,
     model: `${provider}-default`,
     units: { text_input: 1500, text_output: 800 },
   });
   ```

   `'gemini-default'` is **not** a key in `cost-estimator.ts`'s `RATE_TABLE` (which has only
   `gemini-2.5-flash` and `gemini-2.5-pro`). `estimateCost` therefore returns `modeled: false` and
   applies its **conservative unmodeled ceiling** (`text_input: 100_000/1k`, `text_output: 300_000/1k`):
   `1500/1000*100_000 + 800/1000*300_000 = 150_000 + 240_000 =` **~390,000 micros ($0.39) per turn.**

2. The per-user **daily budget is $1.00** (`types.ts` `BETA_USER_BUDGET_DEFAULTS.daily_micros = 1_000_000`).
   `$1.00 / $0.39 ≈ 2.5 turns` → blocked on the 3rd. **Exactly matches the observed "~2 then 429."**

3. It compounds: the chat producer never returns `actual_micros`, so the post-call record falls back to
   the same bogus estimate (`governed-route.ts:283 actual = produced.actual_micros ?? estimated_micros`).
   So the $0.39 ceiling poisons **both** the pre-call gate **and** the recorded spend.

The real model the edge function runs is **`gemini-2.5-flash`**
(`supabase/functions/graphrag-query/index.ts:50`), whose true cost for a 1500/800 turn is **~353 micros
($0.00035)** — a **~1000× overcharge**.

---

## Fix (implemented)

- `apps/web/src/lib/governance/governed-route.ts`
  - Added `DEFAULT_MODELED_MODEL: Record<ProviderId, string>` mapping each provider to its **cheapest
    real RATE_TABLE entry** (gemini→`gemini-2.5-flash`, openai→`gpt-4o-mini`, anthropic→`claude-3-5-haiku`).
    This makes the unmodeled-ceiling trap **structurally impossible** for any route that omits a model.
  - Added an optional `model?: string` to `GovernedRouteOptions`; estimate now uses
    `options.model ?? DEFAULT_MODELED_MODEL[provider]` instead of the fabricated `'${provider}-default'`.
- `apps/web/src/app/api/agent/chat/route.ts`
  - Declares `model: 'gemini-2.5-flash'` to match the model the edge function actually generates with,
    so the estimate is accurate (not merely cheap).

**Effect:** per-turn estimate **$0.39 → ~$0.00035**; the $1.00/day cap now supports **~2,800 turns/day**
(no need to raise the cap). The budget breaker remains fully intact — it now charges _real_ cost.

### Verification

- New regression tests in `cost-estimator.spec.ts` assert (a) the old `'gemini-default'` alias is
  `modeled:false` and fits ≤3 turns/day, and (b) the fixed `gemini-2.5-flash` path is `modeled:true` and
  fits >500 turns/day. **12/12 pass.**
- Full economic suite **121/121 pass**; `tsc --noEmit` clean on touched files.
- **Pending:** deploy to production + re-run the live battery to confirm the 429 wall is gone end-to-end.

---

## The separate grounding question (not yet answered)

The 3 calls that reached the model couldn't see the user's accounts. The most likely cause is **not** a
grounding bug but the **async graph-promotion window** documented in `CONTEXT_ENGINEERING_AUDIT.md`: the
battery fired _seconds_ after persona activation, before promotion pushed `financial_accounts` into
Neo4j/Qdrant — so retrieval was legitimately empty and the model **correctly refused to invent a balance**
(hallucination-defense working as intended). This must be confirmed by a clean re-test once the data has
settled (the 10 fixtures are still provisioned: `/tmp/b20fixtures.out`). If chat is still ungrounded after
promotion settles, that is a true P0 for the Truth half of the sprint and takes priority over Parts 4–9.

---

## Why this gates the sprint

The user's own guidance: _"Prefer correctness over capability… choose the useful answer."_ A grounded,
trustworthy chat that 429s 85% of the time is neither correct nor useful. Parts 3/5/7/9 (hallucination
defense, memory integrity, golden tests, readiness verdict) are **unverifiable** until a real
conversation can run. This fix unblocks them.
