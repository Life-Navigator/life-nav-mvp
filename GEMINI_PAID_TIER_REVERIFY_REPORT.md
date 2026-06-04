# GEMINI_PAID_TIER_REVERIFY_REPORT.md

**Date:** 2026-06-04
**Trigger:** Gemini reportedly upgraded to a paid tier. Re-ran the **exact same** grounded battery
(`apps/web/beta20-reverify.mjs`, no code changes) against production with the existing 10 fixtures.
**Result file:** `/tmp/b20reverify_paid.json` (150 calls, 35.5s).

---

## VERDICT: 🔴 GEMINI_STILL_BLOCKED

The paid-tier upgrade did **not** resolve the failure. Chat answer-generation still degrades to the
fallback **98% of the time (148/150)**. Everything _else_ — budget, safety, audit, usage — passes.

---

## The 10 verification points

| #   | Check                           | Result      | Evidence                                                                                                   |
| --- | ------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | Gemini no longer falls back 98% | ❌ **FAIL** | **148/150 (98%) still fallback** — unchanged from the free-tier run.                                       |
| 2   | 0 premature 429 budget blocks   | ✅ PASS     | 150/150 = HTTP 200; **0** `budget_exceeded`. The economic fix holds.                                       |
| 3   | No bare 502s                    | ✅ PASS     | 0 — all failures degrade to a graceful 200 fallback.                                                       |
| 4   | No hallucinated balances        | ✅ PASS     | 0/148 fallbacks contain any `$` figure; the 2 real answers cite none falsely.                              |
| 5   | No invented APRs                | ✅ PASS     | 0.                                                                                                         |
| 6   | No cross-user leakage           | ✅ PASS     | 0. (1 heuristic flag = the generic phrase "credit card" in a truncated reply — a false positive, no data.) |
| 7   | No cross-persona leakage        | ✅ PASS     | 0 (same false positive).                                                                                   |
| 8   | Cost usage plausible            | ✅ PASS     | `economic.usage_events`: `cost_usd_micros=353` (= modeled flash, **not** the old $0.39) across 160 rows.   |
| 9   | Audit rows still write          | ✅ PASS     | `governance.decision_governance_audit` **235 → 389** (+154; +155 in last 10 min).                          |
| 10  | Economic usage rows still write | ✅ PASS     | `economic.usage_events` **247 → 401** (+154; 160 in last 15 min).                                          |

**9 of 10 pass. The one that matters for this gate — #1 — fails.**

---

## Why it still fails — the failure mode _changed_, which is the key diagnostic

|                            | Free tier (earlier)   | Paid tier (now)            |
| -------------------------- | --------------------- | -------------------------- |
| Concurrent battery latency | p50 **12.5s**         | p50 **1.8s**               |
| Sequential single-user     | 5/5 fallback @ ~12.5s | 5/5 fallback @ **~17–18s** |
| Fallback rate              | 98%                   | 98%                        |
| Real answers               | 2/150                 | 2/150                      |

What this rules in / out:

- **Not the economic layer** — 0 budget 429s; cost recorded at the correct 353 micros.
- **Not concurrency** — a _sequential, single-user, 6s-spaced_ run still fails 5/5.
- **Not a wholly invalid/stale key** — **2 calls genuinely succeeded** (married_family returned a complete,
  correct decline; high_income_executive returned a partial reply). A dead key yields 0 successes.
- **Not model access** — `gemini-2.5-flash` answered those 2 calls, so the model is reachable.
- **It is a _retryable_ Gemini error** — the sequential path takes ~17s (the `retry.ts` backoff:
  ~500ms + ~1500ms × the 3 sub-calls, then give up). `retry.ts` only retries **429 / 500 / 503**. So
  Gemini is returning a **transient/quota/overload** status, not a 400/401/403.

**Conclusion:** Gemini is still answering with a **429 RESOURCE_EXHAUSTED (or 503)** for ~98% of calls,
while a thin trickle (2/150) gets through. That is the signature of a key whose **project quota is still
effectively unraised** — i.e., the paid upgrade did not land on the project/key the edge function uses.

### Narrowed to two causes (from the candidate list)

1. **Billing on the wrong project / key** — `GEMINI_API_KEY` on the `graphrag-query` edge function belongs
   to a Google Cloud project that does **not** have the new billing/quota. (`API key restriction` /
   `wrong project`.) **Most likely.**
2. **Quota propagation delay** — billing was just enabled and the Generative Language API quota hasn't
   propagated; brand-new billing accounts also start at low rate limits that ramp over hours.
   (`Gemini quota delay`.)

Ruled out: model access (2 successes), application bug (code unchanged; economic + safety + audit all
correct), edge-secret-completely-stale (2 successes prove the current key works intermittently).

---

## What I could NOT capture, and why

The user asked for **exact Gemini response codes + body snippets.** I could not obtain them by inspection:
the edge function **swallows** the generation error (`console.warn('Answer generation failed after
retries', …)` → returns the fallback 200, `index.ts:736`), the Supabase Management API returns secret
values as **SHA-256 digests** (so I can't read `GEMINI_API_KEY` to call Gemini directly), and the
`console.warn` is **not ingested** into the queryable `function_logs` (only boot/shutdown appear).
Capturing the literal status code requires **one** of:

- **Paste the `GEMINI_API_KEY` value** → I'll `curl` `gemini-2.5-flash:generateContent` directly and return
  the exact HTTP status + body in one shot (definitive: 429 vs 403 vs 404). _(Fastest.)_
- **Check the Google AI Studio / Cloud console:** which project owns this API key, is **billing enabled on
  that same project**, and is the `gemini-2.5-flash` per-minute/day quota **> 0** there.
- **Re-test in ~30–60 min** if it's pure propagation delay.

(A code-level capture — surfacing the status in the edge response — is possible but was **not** done per
the "do not change code yet" instruction.)

---

## Status of the rest

The economic guardrail sprint remains ✅ complete and verified; **only Gemini answer-generation blocks
chat.** Re-running `beta20-reverify.mjs` after the key/quota is corrected will take ~1 minute and should
flip #1 to PASS, at which point a true grounded-accuracy distribution becomes measurable.
