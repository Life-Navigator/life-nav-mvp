# Model Routing — Executive Memo

**Date:** 2026-06-16 · **Basis:** the 50-scenario in-pipeline benchmark across Gemini Flash / Gemini 2.5 Pro /
Claude Opus 4.1 (+ raw-Claude reference), sliced by domain, plus the model-access reality. Evidence only.
Untested/inaccessible models are named as such, never scored.

## The picture in one table (measured, in-pipeline)

|                           |  Overall |   Trust | Latency p50 | Est $/turn | Clears 7.5 |
| ------------------------- | -------: | ------: | ----------: | ---------: | :--------: |
| Gemini Flash (prod today) |     6.66 |     8.5 |       12.7s |    ~$0.003 |     ❌     |
| **Gemini 2.5 Pro**        | **7.60** | **8.7** |       26.5s |    ~$0.011 |     ✅     |
| Claude Opus 4.1           |     7.30 |     8.2 |         61s |     ~$0.15 |     ❌     |

Per-domain winners (in-pipeline): **Pro wins Career, Education, Cross-domain & overall**; Opus marginally edges Finance (6.99 vs 6.73) and Family (8.22 vs 8.14) at ~14× cost.

## The 10 questions

1. **Which model per capability?** Classification → **Flash-Lite** (inferred). Advisor + all domain explainers + decision engine → **Gemini Pro** (measured). Critic / Report-writer / Executive-review → **Claude Opus, offline** (inferred). Compliance gate → **deterministic validator** (no LLM).
2. **Best per domain?** **Gemini Pro** for Career/Education/Cross-domain (clear) and the recommended default for Finance/Family too (Opus's tiny edge there isn't worth 14× cost / 2.3× latency). Health → Pro (inferred; keep no-diagnosis guardrail).
3. **Best per future agent?** Advisor/domain/decision agents → Pro; Critic/Report/Executive-review → Opus (offline); Classifier → Flash-Lite; Document-Intel/GraphRAG → Pro (inferred, pending harness).
4. **Which models are NOT worth using?** **Claude Opus as the interactive advisor** — dominated by Gemini Pro (lower in-pipeline score, ~14× cost, ~2.3× latency). Any **un-piped** model (raw Claude fabricated 3 numbers). GPT/Nemotron until accessible + benchmarked.
5. **Which should be premium-only?** **Claude Opus** — offline critic / report-writer / executive-review, and the Elite tier. Justified by raw actionability (8.5) and exec presence (8.4) where latency doesn't matter.
6. **What routing policy should LIOS use?** Route to a **capability class**; the **registry** resolves to the _cheapest model that meets the class quality threshold_ under the request's tier/latency/cost/risk constraints; **escalate to the highest-quality model for high-risk / elite / low-confidence / final-review**; always run the model-agnostic trust spine; fall back premium → balanced → fast → deterministic. (Full function in `LIOS_ORCHESTRATOR_MODEL_POLICY.md`.)
7. **Estimated cost impact?** Advisor Flash→Pro = **~+$0.008/turn** (~4× a tiny base; ~1/14 of Opus). Tiered routing keeps Flash/Flash-Lite on high-frequency low-stakes turns and confines Opus to offline/elite → blended cost stays low. A blanket-Opus advisor would have been ~50× — explicitly rejected.
8. **Estimated latency impact?** Advisor 12.7s → 26.5s (Pro); masked by the existing streaming ack. Opus (61s) is offline-only, so it never touches interactive latency. Classification on Flash-Lite is the fastest path.
9. **What to implement BEFORE LIOS Runtime Phase 1?** (a) switch advisor to Gemini Pro; (b) number-gate refinement (→ ~8.0); (c) the lightweight model **registry/router**; (d) wire **Opus offline** for reports/critic/exec-review; (e) benchmark the gaps (Flash-Lite classification, Sonnet once enabled, Health/Document/GraphRAG/Critic/Report harnesses).
10. **What should WAIT?** LIOS Runtime / orchestrator-as-LIOS / standalone Critic-Decision-Scenario engines / new domain agents (all UNPROVEN); GPT/Nemotron (inaccessible); any blanket-Opus advisor.

## Success-criteria answers

- **Best advisor model:** Gemini 2.5 Pro. **Best quality-per-dollar (gate-clearing):** Gemini 2.5 Pro. **Best executive-reasoning & report-writing:** Claude Opus (offline). **Cheapest classification:** Flash-Lite (confirm).
- **Multi-model routing justified?** Yes — a lightweight registry/router (Flash-Lite + Flash + Pro + Opus-offline). **LIOS Runtime?** No — not justified by any measured weakness.
- **Number Gate** is now the single remaining advisor-quality lever (model is solved by Pro).

## Honest scope note

Real per-model evidence covers **6 of 12 capability classes** (Advisor, Finance, Family, Career, Education,
Decision Intelligence). Classification, Health, Document Intelligence, GraphRAG, Critic, and Report-Writer are
**recommended on inference + a ready methodology, not yet benchmarked**. Claude Sonnet, newer Claude variants,
GPT, and Nemotron are **NOT TESTED** (not enabled / no credentials). Those recommendations should be confirmed
by the harness runs in `PRODUCTION_MODEL_ROADMAP.md` step 5–7 before they harden into policy.

### One-line verdict

**Gemini 2.5 Pro is the advisor and domain default (clears 7.5, cheaper & more trustworthy than Claude);
Flash/Flash-Lite serve cheap high-frequency roles; Claude Opus is an offline premium specialist; route by
capability class via a lightweight registry — and do not build LIOS until a component earns it.**
