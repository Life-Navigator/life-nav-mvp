# VERTEX_ANTHROPIC_MODEL_CATALOG.md — Phase 1

API-discovered (not guessed). `GET /v1beta1/publishers/anthropic/models` + `:rawPredict` probes, ADC, project `gen-lang-client-0849161409`, 2026-06-23.

## Catalog (what Vertex lists per region)

| Region                      | Anthropic models listed (GA)                                                                                                                                                                                                                              |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **global**, **us-central1** | `claude-opus-4-1@20250805`, `claude-sonnet-4-5@20250929`, `claude-haiku-4-5@20251001`, `claude-opus-4-5@20251101`, `claude-opus-4-6@default`, `claude-sonnet-4-6@default`, `claude-opus-4-7@default`, `claude-opus-4-8@default`, `claude-fable-5@default` |
| us-east5, europe-west1      | `claude-3-opus@20240229`, `claude-sonnet-4-5@20250929`                                                                                                                                                                                                    |

## Actually CALLABLE (`rawPredict` 200) — the entitlement truth

| Model ID (call by **bare name**)                                          | Endpoint                              | Result                                                     |
| ------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------- |
| **`claude-opus-4-8`**                                                     | global                                | ✅ 200                                                     |
| **`claude-opus-4-7`**                                                     | global                                | ✅ 200                                                     |
| **`claude-opus-4-1@20250805`**                                            | global                                | ✅ 200                                                     |
| `claude-opus-4-6`                                                         | global                                | ❌ 404 (listed but not callable)                           |
| `claude-sonnet-4-6`                                                       | global                                | ❌ 404                                                     |
| `claude-opus-4-5@20251101` / `claude-sonnet-4-5@…` / `claude-haiku-4-5@…` | global                                | ❌ 404                                                     |
| `claude-fable-5`                                                          | global                                | ❌ 403 "requires data sharing to be enabled for publisher" |
| any Claude                                                                | us-central1 / us-east5 / europe-west1 | ❌ 400/404 (Claude callable only via **global** here)      |

## Headline (overturns the prior sprint)

**Claude Opus 4.8 IS available** — and Opus 4.7 and 4.1 — on the `global` endpoint via ADC, no API key. The prior sprint wrongly concluded "only Opus 4.1" because it probed with explicit version suffixes (`@20251101`); the newest models use versionId `default` and are called by **bare name** (`claude-opus-4-8`). "Opus 4.8/4.6" are real here, not just Anthropic-API names.

## Exact IDs to use

- Best available: **`claude-opus-4-8`** (region `global`). Fallbacks: `claude-opus-4-7`, `claude-opus-4-1@20250805`.
- The `VertexClaudeAdvisorLLM` must call region=`global` for any of these (regional endpoints fail).
