# FINAL_PILOT_GAP_AUDIT.md — Phase 5

Scores are 0–10, pilot/investor-demo readiness. Grounded in this sprint's code findings + prior audit memory. Anything <8 is flagged.

| Surface                | Score | State                                                                                                                                       | Demo-risky?                                                    | Pilot-blocking? |
| ---------------------- | ----: | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------- |
| Discovery / Onboarding |     7 | Works; known bias toward persona-seeded "financial independence" over the user's own narrative (bridge default + max-confidence primary).   | Medium — if a demo user's stated priority is dropped           | No              |
| Dashboard              |     8 | Trust-grounded; never invents risks/opps or a north star; cards read canonical domain summaries.                                            | Low                                                            | No              |
| Documents              |     8 | Provenance slice live (page/section/char-span, confirm/edit/reject); life-model/Family bridge fixed.                                        | Low                                                            | No              |
| Family                 |     8 | Real family-office overview + CRUD; doc→Family bridge moves readiness/recs.                                                                 | Low                                                            | No              |
| Health                 |     7 | Wellness-only governance solid; **readiness driven by logs (sleep/activity/vitals), not goals** — manual goal entry doesn't move the score. | Medium — sparse logs ⇒ low score that's hard to move in a demo | No              |
| Career                 |     7 | Read/summary + fact-packet grounding good; **no domain write route** (read-only router).                                                    | Low                                                            | No              |
| Education              |     7 | Summary + report; generic write exists, no enrollment route.                                                                                | Low                                                            | No              |
| Recommendations        |     8 | Canonical engine; recomputes on read (fingerprinted stale-while-revalidate). Reads domain tables/documents, **not `life.facts`**.           | Low                                                            | No              |
| Reports                |     8 | Narrative-led; Career&Education PDF section w/ score rings; readiness_snapshots bridges TS→Python.                                          | Low                                                            | No              |
| Advisor Chat           |     8 | Hybrid (rules guardrail + LLM lead + validator gate); conversational; ~1.8s my-life. Quality plateau ~6.66 on Gemini (model gap, not arch). | Medium — answer quality vs. ChatGPT/Claude in a side-by-side   | No              |
| Advisor Actions        |     8 | Detect→ActionCard→approve→apply; writes `life.facts` via IngestionService; 14 facts verified live; **honest** Impact Card.                  | Low                                                            | No              |
| Instant Impact         |     8 | Impact Summary Card real + honest (facts + areas, no fake deltas). Dashboard updates on next read, not push.                                | Low                                                            | No              |

## Below 8 (watch list)

- **Discovery (7):** narrative-vs-persona bias. Investor risk only if the demo user's spoken priority is visibly discarded.
- **Health (7):** readiness is behavioral-log-driven; a demo user with no logs scores low and a manual goal won't lift it. Seed logs for demo users or set expectation.
- **Career (7), Education (7):** read-only on writes; fine for pilot (advisor + reports carry them), but no "I just got promoted → career record updated" loop yet.

## Demo-risky (manage, not block)

1. Advisor answer quality in a live A/B against ChatGPT/Claude (known plateau on Gemini; selective Claude routing is built-but-off).
2. Health score immovability for log-sparse users.
3. Discovery dropping the user's stated #1 priority.

## Pilot-blocking

**None.** Nothing in this audit blocks a controlled pilot. The Instant Impact loop is honest and shippable as-is.
