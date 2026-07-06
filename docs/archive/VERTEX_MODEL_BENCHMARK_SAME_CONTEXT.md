# VERTEX_MODEL_BENCHMARK_SAME_CONTEXT.md — Phase 2

Same prompts, same context, same advisor pipeline (context → generate → validate → compose → repair-retry). Two arms: **Vertex Gemini 2.5 Pro** (us-central1) and **Vertex Claude Opus 4.1** (global). Claude Opus 4.6/4.8 and Sonnet were unavailable (VERTEX_CLAUDE_ACCESS_REPORT.md).

## Enhanced-rate (no fallback)

| Arm             | Enhanced | Fallbacks                                    |
| --------------- | -------- | -------------------------------------------- |
| Gemini 2.5 Pro  | **9/10** | F1 (home affordability)                      |
| Claude Opus 4.1 | **8/10** | F1 (home affordability), F3 (emergency fund) |

Per-prompt:
| Prompt | Gemini | Claude |
|---|---|---|
| F1 afford $500k/$60k | fallback (`100000,20`) | fallback (`30,40`) |
| F2 debt vs down payment | enhanced | enhanced |
| F3 emergency fund | enhanced | fallback (`32000,5`) |
| F4 promotion change | enhanced | enhanced |
| H1 wedding recomp | enhanced | enhanced |
| H2 knee/shoulder safe plan | enhanced | enhanced |
| H3 TRT training/recovery | enhanced | enhanced |
| X1 master's before house | enhanced | enhanced (repaired) |
| X2 baby next | enhanced | enhanced |
| X3 die tomorrow / no will | enhanced | enhanced |

## Important caveats (honesty)

- **Latency is NOT reliable here.** All 20 calls ran concurrently, inflating every number (Gemini avg ~31s, Claude ~41s) — these are not production single-call latencies. Treat latency as **inconclusive**; a fair sequential test is needed.
- **Claude hit HTTP 429** twice under this light concurrency → some Claude fallbacks are throughput artifacts, not quality. The global endpoint is rate-limited for this project.
- F1 (the dollar-dense affordability prompt) fell back for **both** models — Claude does NOT automatically clear the gate's hardest case; both must phrase computed figures cleanly.

## Qualitative read (sampled outputs, both enhanced)

- **H1 recomp:** comparable; Claude slightly fuller on nutrition (0.8-1g protein/lb, 500-600 cal deficit, phased), Gemini fuller on the split detail.
- **X3 estate:** both excellent; Claude marginally more actionable ("this week: document assets, name beneficiaries, schedule attorney; add living will/healthcare proxy/POA"), Gemini leads with the guardian insight.
- **F4 promotion:** comparable; Claude uses a benchmark ("30-50% raise") + a sharp fractional-exec insight; Gemini's "buy back time" framing is strong.

**Net:** quality is comparable, Claude marginally more specific/actionable on a few high-stakes prompts. The dramatic old gap (LN 5.8 vs Claude 8.2) is gone — that was Gemini Flash + restrictive gates; Gemini 2.5 Pro + the relaxed gates closed most of it.
