# Model Routing Decision Table

Final per-role routing. **Measured** = backed by the 50-scenario in-pipeline benchmark (Flash/Pro/Opus).
**Inferred** = recommended from measured data + model traits, pending a dedicated harness. Trust spine
(validator/number-gate/compliance) runs on every role regardless of model.

Anchors: Flash 6.66/12.7s/~$0.003 · **Gemini Pro 7.60/26.5s/~$0.011 (clears 7.5, trust 8.7)** · Opus 7.30/61s/~$0.15 · Flash-Lite (reachable, untested, cheapest).

```yaml
classification: # intent / domain / risk / urgency / escalation
  primary: gemini-flash-lite # INFERRED (untested) — easy task, cheapest+fastest
  fallback: gemini-flash
  reason: classification is low-reasoning; cheapest accurate model wins. Confirm with a 10-scenario labeled run.

advisor: # the core conversational turn
  primary: gemini-2.5-pro # MEASURED — only model clearing 7.5 in-pipeline (7.60), trust 8.7, 0 fab
  fallback: gemini-flash # MEASURED 6.66 — safe, fast, cheap if Pro unavailable
  reason: Pro beats Opus in-pipeline (7.60>7.30) at ~1/14 cost and ~1/2 latency.

finance_explainer:
  primary: gemini-2.5-pro # MEASURED 6.73 (Opus 6.99 edges it but ~14x cost — not worth)
  fallback: gemini-flash
  reason: Pro acceptable; Opus's +0.26 here does not justify 14x cost / 2.3x latency.

family_explainer:
  primary: gemini-2.5-pro # MEASURED 8.14 (≈ Opus 8.22) at a fraction of cost
  fallback: gemini-flash
  reason: Pro ties Opus on the strongest domain; cheaper/faster.

career_explainer / education_explainer / cross_domain:
  primary: gemini-2.5-pro # MEASURED — Pro clearly wins all three (car 7.52, edu 7.24, crs 8.27)
  fallback: gemini-flash
  reason: Pro is the decisive domain winner; Opus weak on education (6.06).

health_explainer:
  primary: gemini-2.5-pro # INFERRED — treat as an advisor domain
  fallback: gemini-flash
  reason: no health scenarios benchmarked; Pro is the advisor winner. MUST keep the no-diagnosis/treatment compliance guardrail. Confirm with a health-scenario run.

decision_engine: # home/retirement/career/MBA/relocation/business/estate decisions
  primary: gemini-2.5-pro # MEASURED — the 50 scenarios ARE decisions; Pro 7.60 overall
  escalate: claude-opus-4-1 # offline, for the hardest/highest-stakes, latency-tolerant cases
  fallback: gemini-flash
  reason: Pro for interactive; Opus's raw actionability (8.5) only pays offline.

critic: # challenge advisor output, find weak/unsupported reasoning
  primary: claude-opus-4-1 # INFERRED (offline) — adversarial review benefits from raw reasoning (8.00)
  fallback: gemini-2.5-pro
  reason: latency-tolerant; Opus's depth is an asset for review. Confirm with a critic harness.

report_writer: # exec Life Briefing, CPA/attorney, estate, retirement, family-office
  primary: claude-opus-4-1 # INFERRED (offline) — raw actionability 8.5 + exec presence 8.4
  fallback: gemini-2.5-pro
  reason: reports are async (61s fine); Opus's prose/structure is strongest. Confirm with a report harness.

executive_review: # final premium sign-off pass
  primary: claude-opus-4-1 # INFERRED (offline) — highest-quality reasoning
  fallback: gemini-2.5-pro
  reason: premium/elite only; latency irrelevant.

document_intelligence / graphrag_synthesis:
  primary: gemini-2.5-pro # INFERRED — synthesis/explanation strength; needs a doc/graph harness
  fallback: gemini-flash
  reason: NOT BENCHMARKED via the advisor endpoint; route through Pro pending a dedicated harness.

compliance_gate:
  primary: deterministic-validator # no LLM — the trust spine is code, model-agnostic
  fallback: gemini-flash # only for any classification sub-step
  reason: cheapest, safest, instant; proven to catch fabrication across all models.
```

## NOT ROUTED (no evidence / no access)

- **Claude Sonnet 4.5** — not enabled in Vertex Model Garden (404). Likely a strong mid-tier; benchmark before routing.
- **Newer Claude (opus-4.5/4.6/4.7/4.8)** — not enabled.
- **GPT-class / Nemotron / Llama** — inaccessible in this environment. Do not route until accessible AND benchmarked.

## One-line policy

**Gemini Pro is the default for the advisor and every measured domain; Flash/Flash-Lite handle cheap
high-frequency roles; Claude Opus is reserved for offline premium roles (critic, reports, executive review).
No role goes to an untested or inaccessible model.**
