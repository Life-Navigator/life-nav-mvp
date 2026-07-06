# MODEL_RUNTIME_PROOF.md

Hard proof of the actual runtime model — not configured-value inference.

## Raw Vertex call (no advisor pipeline)

```
VertexGeminiClient(project=gen-lang-client-0849161409, region=us-central1, model=gemini-2.5-pro, ADC)
→ generate_with_usage("You are terse.", "Reply with exactly: PONG")
→ text='PONG'  usage={'prompt_tokens':10,'completion_tokens':2,'total_tokens':30}
```

Transport proven (unit + live): `Authorization: Bearer <ADC token>`, URL `https://us-central1-aiplatform.googleapis.com/v1/projects/gen-lang-client-0849161409/locations/us-central1/publishers/google/models/gemini-2.5-pro:generateContent` — **no `?key=`**, no `generativelanguage.googleapis.com` (AI Studio) host.

## Advisor-turn metadata (every turn, this sprint)

Each advisor response now carries `provider` + `model`; the `analytics.advisor_turns` row records `provider`, `model`, `fallback_used`, `fallback_reason`, `llm_status`. Live run, all three prompts:

| Prompt                  | provider        | model            | llm_status                                         | tokens (total) |
| ----------------------- | --------------- | ---------------- | -------------------------------------------------- | -------------- |
| Workout + nutrition     | `vertex_gemini` | `gemini-2.5-pro` | `enhanced`                                         | 6,534          |
| Finance (afford $500k?) | `vertex_gemini` | `gemini-2.5-pro` | `fallback:invented numbers…`                       | 6,912          |
| Health (sleep/energy)   | `vertex_gemini` | `gemini-2.5-pro` | `enhanced` (retry; 1st attempt `fallback:…advice`) | 6,405          |

## No silent fallback

- The two fallbacks emitted a `log.warning` `advisor_model_fallback` with `provider`, `model`, `reason`.
- The fallback text is the deterministic safe reply, never presented as model output; `llm_status` distinguishes `enhanced` vs `fallback:*`.
- ADC-absent failure (verified separately): `VertexGeminiClient` raises `VertexAuthError`; wrapper logs WARNING → visible fallback.

## Auth method, proven

ADC `authorized_user`, quota project `gen-lang-client-0849161409`, `cloud-platform` scope. `GEMINI_API_KEY` is not read on this path (`model_provider=vertex` selects `VertexGeminiClient`).

## Conclusion

The runtime model is **provably `gemini-2.5-pro` via Vertex AI on ADC** — confirmed by a live call, the request transport, and per-turn response metadata. The guesswork this used to require is gone: one advisor call now echoes its own `provider`/`model`.
