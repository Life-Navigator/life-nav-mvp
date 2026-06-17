# Frontier Model Qualification (Workstream B)

**Every model earns its role through benchmark performance.** Identical LN pipeline (advisor-hybrid-6.0.0),
identical 50-scenario benchmark, identical 5-judge rubric. Only models with real benchmark data can PASS.

## Benchmarked models (real data, this program)

| Model                                |  Overall |   Trust | Fab | Actionability | Insight | Framing | Latency p50 |  Est $/turn | Verdict                       |
| ------------------------------------ | -------: | ------: | --: | ------------: | ------: | ------: | ----------: | ----------: | :---------------------------- |
| **Gemini 2.5 Pro**                   | **7.60** | **8.7** |   0 |           5.9 |     7.4 |     8.0 |       26.5s |     ~$0.011 | **PASS** ✅                   |
| Claude Opus 4.1 (in-pipeline)        |     7.30 |     8.2 |   0 |           6.2 |     7.0 |     7.3 |         61s | ~$0.12–0.18 | **CONDITIONAL PASS**          |
| Gemini 2.5 Flash (prod)              |     6.66 |     8.5 |   0 |           4.7 |     6.1 |     6.7 |       12.7s |     ~$0.003 | **CONDITIONAL PASS**          |
| _(ref) raw Claude Opus, no pipeline_ |     8.00 |     8.2 |   3 |           8.5 |     7.9 |     8.4 |     offline |           — | n/a (not a deployable config) |

## Verdicts (with the no-evidence-no-PASS rule)

- **Gemini 2.5 Pro — PASS.** The only model that **clears the 7.5 advisor gate (7.60)** _and_ posts the
  **highest trust (8.7) with 0 fabrications** — at ~½ Opus's latency and a fraction of its cost. It also beat
  Claude Opus _inside the pipeline_ on framing, exec presence, question quality, and trust. **This is the
  advisor model.**
- **Claude Opus 4.1 — CONDITIONAL PASS.** Excellent raw reasoning (raw 8.00; best actionability 8.5), but
  _in the pipeline_ it scored 7.30 — **below Gemini Pro** — while costing ~10–15× more and running ~2.3× slower,
  and it produced 3 fabrications when unguarded (the validator caught them). **Role: reserved for offline /
  highest-stakes reasoning & report generation where its raw actionability is worth the premium — not the
  default advisor.**
- **Gemini 2.5 Flash — CONDITIONAL PASS.** Fast, cheap, trustworthy (8.5), 0 fab — but **quality-capped at
  6.66 (below the gate)**. **Role: high-frequency low-stakes turns** (classification, discovery first-touch,
  routine chat), not the headline advisor.

## Pending (cannot PASS without data)

- **Claude Sonnet 4.5 — PENDING.** Not yet enabled in Vertex Model Garden on the LifeNav project (404). Likely
  strong quality-per-dollar; **must be benchmarked before any role** (one-click enable → 20–50 scenario run).
- **Gemini Flash-Lite — UNTESTED.** Candidate for the cheapest classification tier; benchmark before use.

## INACCESSIBLE (cannot evaluate in this environment)

- **GPT-class (OpenAI)** — no API credentials available here. **FAIL-by-default for production** until
  accessible _and_ benchmarked. No score invented.
- **Nemotron-class (NVIDIA)** — not enabled / no access. **FAIL-by-default** until accessible and benchmarked.

## The headline qualification result

**Gemini 2.5 Pro is the qualified advisor model — it is the only configuration that clears 7.5, and it does so
with the best trust and far better economics than Claude.** Claude Opus qualifies only for premium offline
roles; Flash qualifies only for cheap high-frequency roles. Everything else is unproven or inaccessible and
earns nothing until benchmarked.
