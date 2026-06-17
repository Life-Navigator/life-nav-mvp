# Production Model Routing Strategy (Workstream E)

Every assignment is backed by the benchmark (LN pipeline, 50 scenarios, 5 judges). Models map into capability
classes (see `MODEL_CAPABILITY_CLASS_ARCHITECTURE.md`); this doc fixes the _current_ best model per role.

## Benchmark anchors

- Gemini Flash 6.66 / trust 8.5 / 12.7s / ~$0.003 — fast, cheap, quality-capped.
- **Gemini Pro 7.60 / trust 8.7 / 26.5s / ~$0.011 — clears the gate, best trust, best quality-per-dollar.**
- Claude Opus (in-pipeline) 7.30 / 8.2 / 61s / ~$0.15; raw 8.00 / actionability 8.5 — premium offline reasoning.
- Sonnet — pending benchmark.

## Routing table

| Role                                           | Recommended model                                                                | Justification (benchmark)                                                                                                              | Cost      | Latency     |
| ---------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----------- |
| Discovery (first touch)                        | **Gemini Flash**                                                                 | low-stakes; Flash trust 8.5, fast/cheap; quality cap irrelevant for intake                                                             | $         | fast        |
| Classification / intent / extraction / routing | **Gemini Flash (→ Flash-Lite once tested)**                                      | deterministic-ish; no advisor-grade reasoning needed                                                                                   | $         | fast        |
| **Advisor (the core turn)**                    | **Gemini Pro**                                                                   | **only model that clears 7.5 in-pipeline (7.60), highest trust (8.7), 0 fab, beats Opus in-pipeline at ~1/14 the cost**                | $$        | 26.5s       |
| Decision analysis                              | **Gemini Pro** (escalate to Claude Opus for the hardest, latency-tolerant cases) | Pro framing 8.0; Opus raw actionability 8.5 wins only when quantitative depth is decisive                                              | $$ / $$$$ | 26.5s / 61s |
| Tradeoffs                                      | **Gemini Pro**                                                                   | Pro tradeoff 7.0 = Opus in-pipeline; cheaper/faster                                                                                    | $$        | 26.5s       |
| Critic / review / risk detection               | **Claude Opus** (offline)                                                        | adversarial review benefits from raw reasoning (8.00); latency tolerable offline; the LN validator already neutralizes its fabrication | $$$$      | offline     |
| Report writer (executive/estate/retirement)    | **Claude Opus** (offline)                                                        | raw actionability 8.5 + executive presence 8.4; reports are async, so 61s is fine                                                      | $$$$      | offline     |
| Executive review                               | **Claude Opus** (offline)                                                        | highest-quality reasoning for the final sign-off pass                                                                                  | $$$$      | offline     |
| Compliance gate                                | **Deterministic validator (no LLM)** + Flash for any classification              | trust spine is code, model-agnostic; cheapest + safest                                                                                 | $         | instant     |

## Key strategic shifts from prior assumptions

1. **The advisor should run Gemini Pro, not Claude.** Pro beats Opus _inside the pipeline_ (7.60 vs 7.30) at a
   fraction of cost/latency. The earlier "route the advisor to Claude" hypothesis is **overturned by the data**.
2. **Claude is a premium _offline_ specialist, not the interactive advisor** — reserved for report writing,
   executive review, and the hardest decision analysis where latency doesn't matter and raw actionability pays.
3. **Flash stays for high-frequency, low-stakes turns** — the cost/latency floor.
4. **All routing keeps the model-agnostic trust spine** (validator, number gate, compliance) — proven safe
   across Flash, Pro, and Claude (it caught Claude's 3 fabrications).

## Rollout

- **Phase 1 (now, highest ROI):** switch the advisor role Flash → **Gemini Pro**. Clears 7.5 immediately at
  ~+$0.008/turn. (Optional: keep Flash for discovery/classification to control cost/latency.)
- **Phase 2:** number-gate refinement (recovers the residual fallbacks → Pro projected ~8.0).
- **Phase 3:** wire Claude Opus for offline report-writer / executive-review / critic roles.
- **Phase 4:** benchmark Sonnet; if it beats Pro on quality-per-dollar for any role, slot it in via the registry.
