# VERTEX_ADC_LIVE_VALIDATION.md

Live run 2026-06-23 against **LifeNav** (`gen-lang-client-0849161409`), `us-central1`, `gemini-2.5-pro`, ADC. Real model calls — not mocked.

## The 10 checks

| #   | Check                                                                    | Result                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Vertex AI API enabled                                                    | ✅ — a real `generateContent` call succeeded (returned `PONG`)                                                                                                              |
| 2   | Gemini 2.5 Pro callable via Vertex ADC                                   | ✅ — `us-central1` OK; tokens `{prompt:10, completion:2}`                                                                                                                   |
| 3   | Advisor metadata proves `provider=vertex_gemini`, `model=gemini-2.5-pro` | ✅ — on every advisor turn (enhanced AND fallback)                                                                                                                          |
| 4   | No `GEMINI_API_KEY` / AI Studio path used                                | ✅ — request carries `Authorization: Bearer <ADC>`, no `?key=`; host `aiplatform.googleapis.com`                                                                            |
| 5   | No **silent** fallback                                                   | ✅ — fallbacks are LOUD: `llm_status` + `provider`/`model` on the response, `advisor_model_fallback` WARNING in logs                                                        |
| 6   | Failed workout prompt → concrete plan                                    | ✅ — full plan returned (see WORKOUT_PROMPT_REPLAY.md)                                                                                                                      |
| 7   | Finance & Health use the same Vertex path                                | ✅ path — both ran on `vertex_gemini/gemini-2.5-pro`; ⚠️ **quality**: finance fell back on the number gate, health passed on retry (see FINANCE_HEALTH_MODEL_VALIDATION.md) |
| 8   | Logs show model/provider/fallback_reason                                 | ✅ — `advisor_model_fallback` log + `tr.provider/model/fallback_reason` telemetry                                                                                           |
| 9   | If Vertex auth/model fails → stop & report BLOCKED                       | N/A — auth/model did **not** fail; auth is verified                                                                                                                         |
| 10  | Do not deploy until validation passes                                    | ✅ — **no deploy performed**                                                                                                                                                |

## ADC setup proven

- `gcloud auth application-default login` (with `cloud-platform` scope) → credentials written.
- quota project set to `gen-lang-client-0849161409`; `print-access-token` mints a token.
- ADC type `authorized_user`. No API key anywhere on the advisor path.

## Verdict

**The key-free Vertex ADC model path WORKS and is verified.** `provider`/`model` are proven on every turn; failures are loud, never silent. The remaining gap is **advisor answer quality on finance** (the number gate blocks the model's computed personal $ figures) and **intermittent health blocking** (medical-advice regex) — these are trust-gate/model-behavior issues, NOT auth/routing failures. See FINANCE_HEALTH_MODEL_VALIDATION.md and the Claude decision in EXECUTIVE_SUMMARY.md.

## Final status: **VERTEX_MODEL_LIVE_VERIFIED** (auth + routing). Advisor quality: workout ✅, health ✅-intermittent, finance ⚠️ gated.
