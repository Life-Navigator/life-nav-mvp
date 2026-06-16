# Production Model Roadmap

Evidence-ordered, lowest-risk-highest-ROI first. Each step is independently shippable and benchmark-gated.

## Now → 2 weeks — Advisor Excellence (the proven win)

1. **Switch the advisor model Flash → Gemini 2.5 Pro.** One config change (`GEMINI_GENERATION_MODEL=gemini-2.5-pro`),
   no code. **Measured: clears the 7.5 gate (6.66 → 7.60), trust 8.5 → 8.7, 0 fabrications**, ~+$0.008/turn.
   - Mitigate latency (26.5s vs 12.7s) with the existing streaming ack; optionally keep Flash for discovery
     first-touch / classification to hold cost & latency on low-stakes turns.
   - Re-run the 50-scenario benchmark post-switch to confirm in production config.

## 2–6 weeks — Number-Gate Refinement (the only remaining advisor lever)

2. Implement `NUMBER_GATE_REFINEMENT_PLAN.md`: strip-not-reject; admit document-derived, tool-generated, and
   verified-derivation numbers into `allowed_numbers`; allow labeled general-guidance benchmarks.
   **Projected: Pro 7.60 → ~7.9–8.1, trust unchanged.** Pure engineering, zero trust relaxation. Re-benchmark.

## 4–8 weeks — Lightweight Model Registry + Router (the justified architecture)

3. Build the provider-agnostic registry/router from `MULTI_MODEL_ARCHITECTURE_BLUEPRINT.md` (the AdvisorLLM
   Protocol already generalizes; `USE_VERTEX_CLAUDE` + `GEMINI_GENERATION_MODEL` are the seams).
   - Capability-class → model mapping (`MODEL_ROUTING_DECISION_TABLE.md`), per-tier cost ceilings.
   - Keep Flash/Flash-Lite for classification/discovery; Pro for advisor/domains/decisions.
4. **Wire Claude Opus for OFFLINE roles only** (report writer, critic, executive review) — async, so 61s is
   fine; the validator already neutralizes its fabrications.

## 6–10 weeks — Fill the measurement gaps (benchmark before routing)

5. **Enable Claude Sonnet 4.5** in Vertex Model Garden → run the 20–50 scenario benchmark (quality-per-dollar
   candidate for the premium-offline tier; possibly the advisor if it beats Pro/$).
6. **Benchmark Flash-Lite** on a labeled classification set (confirm the cheapest-tier choice).
7. **Build harnesses + benchmark** the unmeasured classes: Health, Document Intelligence, GraphRAG synthesis,
   Critic, Report Writer (each ≥10 scenarios across Flash/Pro/Opus). Route them on evidence, not the current
   inference.

## 3–6 months — Provider-agnostic platform hardening

8. Provider adapters (Anthropic/Google live; OpenAI/NVIDIA stubs), version pinning, and **the 50-scenario +
   5-judge benchmark as the mandatory enable-gate** for every new model/version in the registry.
9. Onboard GPT-class / Nemotron **only** once accessible **and** benchmark-passed (today: inaccessible).

## Deferred / gated — LIOS Runtime

10. **Do NOT start LIOS Runtime Phase 1 yet.** The advisor-quality gate is cleared by the model switch; no new
    LIOS component is JUSTIFIED by a measured weakness (`LIOS_RUNTIME_REASSESSMENT.md`). Introduce a LIOS
    component only when a benchmark shows it solves a measured problem — one at a time, each behind the gate.

## What to implement BEFORE LIOS Runtime Phase 1

Steps 1–4 (Pro switch, number-gate fix, registry/router, Opus-offline) — these deliver advisor excellence and
the multi-model capability without the LIOS Runtime complexity.

## What should WAIT

LIOS Runtime/orchestrator-as-LIOS, Critic/Decision/Scenario engines as standalone agents, new domain agents,
GPT/Nemotron integration, and any blanket-Opus advisor (dominated by Pro).
