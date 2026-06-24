# EXECUTIVE_DEPLOYMENT_DECISION.md — Phase 6

## The new fact that changes the decision

**Claude Opus 4.8 is callable now** (Vertex `global`, ADC, no key) — the prior "only Opus 4.1 / marginal gains" conclusion was a probe error. Re-benchmarked clean (sequential):

|                       | Gemini 2.5 Pro                         | Claude Opus 4.8                                     |
| --------------------- | -------------------------------------- | --------------------------------------------------- |
| Enhanced (10 prompts) | 9/10 (failed F1)                       | **10/10** (after the max_tokens fix; **solved F1**) |
| Finance               | 3/4                                    | **4/4**                                             |
| Number-discipline     | inconsistent (glues to "your savings") | **reliable** (labels "(scenario)")                  |
| Latency (sequential)  | ~not re-measured                       | ~26s/turn (slow; needs streaming)                   |
| Reliability           | solid                                  | **429-rate-limited on global** (needs quota)        |

Opus 4.8's edge is real and concentrated exactly where it matters: **high-stakes finance number-discipline** (the long-standing bottleneck).

## Recommendation: **D — Hybrid, staged**

1. **Deploy Gemini 2.5 Pro now** as the production baseline. It's ready, fast enough, cheap, no quota risk, 9/10. This is also **DEPLOY_READY**.
2. **Fast-follow: Opus 4.8 for finance/health high-stakes turns** via the existing selective router, **once** two prerequisites are met:
   - **Vertex Anthropic quota increase** (the 429s block scale), and
   - **advisor streaming** live (the ~26s raw latency is unacceptable un-masked).
     With a **Gemini same-tier fallback** on any Claude 429/error (never silent).
3. **Do NOT pursue GraphRAG** for advisor quality — not the bottleneck.

Why not "Opus 4.8 primary now": latency (~26s) + 429 quota + cost make it wrong as the everything-model today; its win is specifically high-stakes finance/health, which is what the hybrid targets.

## Highest-ROI after deployment (ranked)

1. **Opus 4.8 on finance/health high-stakes** (proven quality win) — gated by quota + streaming.
2. **Advisor streaming everywhere** (latency is the worst UX issue for both models).
3. **Richer personalized grounding via the fact packet** (the real "retrieval" lever; measure with seeded users first).
4. Quota/entitlement: accept Model-Garden terms for Sonnet/Haiku/Opus-4.6 + enable data-sharing for fable-5 if wanted.

## Final answers

1. **Available Anthropic models:** Opus 4.8, 4.7, 4.1 (global, callable); Sonnet/Haiku/Opus-4.6/4.5 listed but not enabled; fable-5 needs data-sharing.
2. **Why others unavailable:** not enabled for project (Model-Garden terms) / region-restricted to global / quota-limited / (fable) data-sharing policy — NOT "not released".
3. **Gemini still best production choice?** As the **baseline yes** (today); **Opus 4.8 is better for high-stakes finance/health**.
4. **Is retrieval the bottleneck?** No — for generic advice it's model; for personalization it's the fact packet (untested), not GraphRAG.
5. **GraphRAG limiting quality?** No.
6. **Would Claude materially improve responses?** **Yes, Opus 4.8 does on finance** (solved F1); marginal elsewhere.
7. **Deploy now?** Yes — Gemini 2.5 Pro baseline.
8. **Highest-ROI after deploy:** Opus 4.8 for high-stakes + streaming + fact-packet enrichment.

## Final Status: **MODEL_ACCESS_VERIFIED** (Opus 4.8 available & better on high-stakes) + **DEPLOY_READY** (Gemini 2.5 Pro baseline). Retrieval is NOT the bottleneck.
