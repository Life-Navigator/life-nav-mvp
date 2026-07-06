# RETRIEVAL_BOTTLENECK_REPORT.md — Phase 4

For each prompt: was the limiter model reasoning, missing context/retrieval, prompt construction, or gate interaction? (Benchmark context was empty — see ADVISOR_CONTEXT_QUALITY_AUDIT.md — so "missing context" is a structural, not measured, factor here.)

| Prompt            | Gemini 2.5 Pro | Opus 4.8                         | Limiter when it failed                                                                                          |
| ----------------- | -------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| F1 afford $500k   | fallback       | **enhanced** (labeled scenarios) | **Model number-discipline** — Gemini glued figures to "your savings"; Opus labeled "(scenario)". NOT retrieval. |
| F2 debt vs dp     | enhanced       | enhanced                         | —                                                                                                               |
| F3 emergency fund | enhanced       | enhanced                         | (Opus-4.1 had failed here; 4.8 fine)                                                                            |
| F4 promotion      | enhanced       | enhanced                         | —                                                                                                               |
| H1 recomp         | enhanced       | enhanced\*                       | \*4.8 fallback was **max_tokens truncation** (now fixed), not retrieval/quality                                 |
| H2 injury         | enhanced       | enhanced\*                       | \*same truncation, fixed                                                                                        |
| H3 TRT            | enhanced       | enhanced                         | —                                                                                                               |
| X1 master's       | enhanced       | enhanced                         | —                                                                                                               |
| X2 baby           | enhanced       | enhanced                         | —                                                                                                               |
| X3 die/no will    | enhanced       | enhanced                         | —                                                                                                               |

## Findings

- **Zero failures were caused by missing context / weak retrieval / missing graph edges / missing document facts.** Context was empty for all runs and the generic prompts still answered well.
- The only real limiters observed were: **(1) model number-discipline** (Gemini's F1 phrasing → gate fallback; Opus 4.8 fixed it by labeling scenarios) and **(2) a client config bug** (`max_tokens=2048` truncating long plans → invalid JSON; now 4096).
- **Gate interaction** was a factor only insofar as the model's phrasing tripped it — and the gate is correct (FINANCE_GATE_TEST_REPORT.md).

## Conclusion

For these prompts, **retrieval is NOT the bottleneck.** The bottleneck was model instruction-following on dollar-dense phrasing — and **Opus 4.8 resolves it.** Retrieval/GraphRAG would only become a factor on **personalized** prompts that reference the user's actual data, which this benchmark did not include and which the live path serves via the SQL fact packet (not GraphRAG).
