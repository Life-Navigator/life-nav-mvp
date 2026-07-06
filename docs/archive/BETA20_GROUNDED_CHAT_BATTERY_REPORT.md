# BETA20_GROUNDED_CHAT_BATTERY_REPORT.md — Part 4

**Date:** 2026-06-04
**Method:** 10 grounded persona fixtures (real activated Plaid sandbox profiles, real persisted
balances/APRs, real cookie auth), 15 questions each = **150 live chat calls** against production
(`life-nav-mvp-web.vercel.app`) after deploying the economic fix (`f85271d`). All budgets reset to the
new $4/day cap before the run.

---

## Headline: the economic fix is verified; chat reliability is now the blocker

| Dimension                                                      | Result                                                                              |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **HTTP status**                                                | **150/150 = 200. Zero 429s.** (Pre-fix: 110/130 = 429.) ✅ The budget wall is gone. |
| **Premature 429 wall**                                         | ✅ Eliminated.                                                                      |
| **Bare 502s**                                                  | ✅ None — failures degrade to a friendly 200 fallback.                              |
| **Reached-model real answers**                                 | ❌ **Only 2/150 (1%).**                                                             |
| **Degraded fallback** ("trouble reaching my reasoning engine") | ⚠️ **148/150 (98%).**                                                               |

**The budget fix worked exactly as intended — and in doing so it exposed that chat almost never reaches
a real answer.** This is not load-induced: a **sequential, single-user, 6-second-spaced** retest also
returned **5/5 fallback**.

---

## Safety classification (the good news)

Even at a 98% failure rate, the system **fails closed**:

| Safety requirement                       | Result | Evidence                                                                                                                                              |
| ---------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| No invented balances                     | ✅     | 0/148 fallbacks contain any `$` figure.                                                                                                               |
| No invented APRs                         | ✅     | Same.                                                                                                                                                 |
| No invented accounts                     | ✅     | The fallback is deterministic canned text.                                                                                                            |
| No cross-persona leakage                 | ✅     | No persona's data appears in another's responses.                                                                                                     |
| No cross-user leakage                    | ✅     | tenant-isolated; no foreign data in any response.                                                                                                     |
| Appropriate "I don't have that" behavior | ✅     | Both reached-model answers _declined_ rather than fabricate (e.g., married_family mortgage: "I don't have the exact balance… here's how to find it"). |

So the **hallucination-defense posture is sound**: the failure mode is "I can't answer right now," never
a confident fabrication. That is the correct way to fail for a financial advisor.

---

## Root cause of the 98% fallback

The fallback string ("Your accounts are loaded and your dashboard brief is up to date") is the
`graphrag-query` edge function's **answer-generation failure path** (`index.ts:730-743`): it fires only
when `geminiGenerate()` throws after its built-in retries. Confirmed:

- The edge function **is reached** (not a 502/edge crash).
- The generation **model is correct** — `gemini-2.5-flash`, hardcoded (`index.ts:50`); not a config typo.
- Failure timing — first call fails fast (~2.2s), subsequent calls ~12.5s (retry+backoff then fail) — is
  the signature of **Gemini `429 RESOURCE_EXHAUSTED` / rate-or-quota limiting**.
- The `GEMINI_API_KEY` is on a **quota-fragile tier** (documented repeatedly: "gemini-2.0-flash quota 0
  on this key", "occasionally 503s"), and **today saw many hundreds of Gemini calls** (recommendation
  sprint + this morning's battery + the 125-call deploy poll + this 150-call battery + retests).

**Conclusion (high-confidence, not 100% — the exact error is unrecoverable: Management API returns hashed
secrets, and the edge `console.warn` isn't ingested into queryable logs): the Gemini answer-generation
key has hit its quota / rate ceiling.** This is an **infrastructure/provisioning** issue, not a code bug,
and is **independent of the economic layer**.

### Why it's a real 20-user blocker (not just a test artifact)

20 users × ~20 turns/day × ~3 Gemini calls/turn ≈ **1,200 Gemini calls/day**, which exceeds typical
free-tier daily limits. A billing-enabled / higher-quota Gemini key is required before the cohort can
hold a conversation. Secondary mitigation: the pipeline issues ~3 Gemini calls per turn (embed +
NL→Cypher + answer) — collapsing or caching the auxiliary calls would cut quota pressure ~3×.

---

## What could not be evaluated

Grounding accuracy (did the answer cite the correct balance/APR?) is **unmeasurable at a 98% fallback
rate** — there were only 2 reached-model answers, and one had incomplete retrieval (married_family's
$384k mortgage existed but wasn't surfaced, though it was safely declined rather than fabricated). The
grounded-accuracy battery must be **re-run after the Gemini key is fixed** to produce a real
GROUNDED/PARTIAL/INSUFFICIENT/HALLUCINATION distribution. The fixtures + harness
(`beta20-reverify.mjs`) are ready to re-run in minutes.
