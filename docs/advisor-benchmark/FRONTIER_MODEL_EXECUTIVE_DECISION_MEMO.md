# Frontier Model — Executive Decision Memo (Workstream J)

**Date:** 2026-06-16 · **Audience:** leadership · **Basis:** the V-series, the Claude Control Experiment, the
A–L forensics program, and this Frontier Model program (Gemini Pro now benchmarked). All scores: identical
50-scenario / 5-judge benchmark in the identical LN pipeline. Evidence only.

## The one finding that changes the strategy

**Gemini 2.5 Pro inside LifeNavigator scores 7.60 — it clears the 7.5 gate, beats Claude Opus in-pipeline
(7.30), posts the highest trust (8.7) with zero fabrications, at ~½ Opus's latency and ~1/14 its cost.** The
cheapest available change — switch the advisor model Flash → Pro — achieves advisor excellence. Claude is _not_
the advisor answer; it's a premium offline specialist.

| Config (LN pipeline)        |     Overall |   Trust | Latency | Est $/turn |
| --------------------------- | ----------: | ------: | ------: | ---------: |
| Gemini Flash (today's prod) |        6.66 |     8.5 |   12.7s |    ~$0.003 |
| **Gemini Pro**              | **7.60 ✅** | **8.7** |   26.5s |    ~$0.011 |
| Claude Opus (in-pipeline)   |        7.30 |     8.2 |     61s |     ~$0.15 |
| raw Claude (offline ref)    |        8.00 |     8.2 |       — |          — |

## The 12 questions, answered

1. **Which models earned production roles?** Gemini Pro (PASS — advisor), Gemini Flash (CONDITIONAL — cheap
   high-frequency roles), Claude Opus (CONDITIONAL — premium offline). Sonnet pending; GPT/Nemotron inaccessible → FAIL-by-default.
2. **Which model should power the advisor?** **Gemini 2.5 Pro** — the only config that clears 7.5, highest trust.
3. **Which model for decision analysis?** Gemini Pro by default; **Claude Opus** for the hardest, latency-tolerant cases.
4. **Which model for executive reports / executive review?** **Claude Opus** (offline) — raw actionability 8.5, exec presence 8.4; async so 61s is fine.
5. **Is Claude justified?** **Yes — but only for premium offline roles** (reports, executive review, critic, hardest decision analysis). **Not** as the interactive advisor (Pro beats it in-pipeline, cheaper & faster).
6. **Is Sonnet superior to Opus on quality-per-dollar?** Almost certainly yes (untested) — but **neither beats Gemini Pro for the advisor**. Test Sonnet for the premium-offline tier, not to displace Pro.
7. **Is Gemini still justified?** **Emphatically yes** — Gemini Pro is the advisor winner and Flash is the cost floor. The optimal default stack is **all-Google (Flash + Pro)** with Claude as selective premium escalation.
8. **Is a multi-model architecture justified?** **Yes, modestly** — a registry-driven router (Flash / Pro / Claude-offline) per `MULTI_MODEL_ARCHITECTURE_BLUEPRINT.md`. Lightweight, provider-agnostic; **not** LIOS.
9. **Can advisor quality exceed 7.5?** **Yes — it already does (Gemini Pro 7.60)**, and ~8.0 is reachable with the number-gate refinement (Scenario D).
10. **Should LIOS Runtime Phase 1 begin?** The advisor-quality blocker is now **cleared** by the Pro switch — but **no LIOS component is justified by any measured weakness** (`LIOS_RUNTIME_REASSESSMENT.md`). **Do not start LIOS Runtime.** Build the multi-model **registry/router** (justified) instead; revisit LIOS only when a specific component earns a JUSTIFIED rating.
11. **Highest-ROI next sprint?** **Switch the advisor to Gemini Pro** (clears 7.5 for ~+$0.008/turn) **+ number-gate refinement** (→ ~8.0, trust-neutral). Then wire Claude Opus for offline reports.
12. **What should NOT be built yet?** LIOS Runtime / orchestrator / critic / decision-engine / scenario-engine / new domain-agents (all UNPROVEN); a blanket Claude advisor (dominated by Pro); production use of Sonnet/GPT/Nemotron on estimate (benchmark first).

## Success-criteria answers

- **Best advisor model:** Gemini 2.5 Pro (7.60).
- **Best quality-per-dollar (gate-clearing):** Gemini 2.5 Pro; Flash best raw but capped.
- **Best executive-reasoning model:** Claude Opus (raw 8.00, offline).
- **Best report-writing model:** Claude Opus (actionability 8.5 + exec presence 8.4, offline).
- **Is multi-model routing justified?** Yes — lightweight registry/router (Flash + Pro + Claude-offline).
- **Should LIOS Runtime begin?** No — gate cleared by model switch; LIOS components unproven.
- **Is the Number Gate still the dominant bottleneck?** It is now the **only** remaining advisor-quality lever
  (model is solved by Pro). Highest-ROI engineering target.

## 24-month roadmap (Advisor Excellence → Selective Routing → LIOS)

**Now → 1 mo (Advisor Excellence):** switch advisor to **Gemini Pro** (clears 7.5); ship beta on it. Keep Flash
for discovery/classification.
**1–2 mo (Number-Gate Refinement):** strip-not-reject + admit doc/tool/verified numbers → advisor ~8.0; re-benchmark.
**2–4 mo (Selective Routing):** stand up the registry/router; wire **Claude Opus offline** for reports /
executive review / critic; benchmark & slot **Sonnet** where it wins quality-per-dollar.
**4–8 mo (Provider-agnostic platform):** complete the multi-model architecture (provider adapters, version
management, the 50-scenario benchmark as the enable-gate for every new model/version). Onboard GPT/Nemotron
**only** once accessible _and_ benchmark-passed.
**8–24 mo (LIOS, evidence-gated):** introduce a LIOS component **only** when a measured weakness makes it
JUSTIFIED — one at a time, each behind the benchmark. Do not build the LIOS Runtime wholesale.

### One-line verdict

**Make Gemini Pro the advisor (it clears 7.5 today, cheaper and more trustworthy than Claude), fix the number
gate to reach ~8.0, use Claude Opus only for premium offline work, build a lightweight model registry/router —
and do not build LIOS until a component earns it.**
