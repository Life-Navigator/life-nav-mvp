# VERTEX_CLAUDE_ACCESS_REPORT.md — Phase 1

Live probe, 2026-06-23, project **gen-lang-client-0849161409**, ADC (no API key).

## Available

| Model                        | Region            | Result                          |
| ---------------------------- | ----------------- | ------------------------------- |
| `claude-opus-4-1@20250805`   | **global**        | ✅ 200 — returned `PONG`        |
| `claude-opus-4-1@20250805`   | us-east5          | ❌ 404 (not enabled regionally) |
| `claude-opus-4-1@20250805`   | us-central1       | ❌ 400 (not served)             |
| `claude-opus-4@20250514`     | global / us-east5 | ❌ 404                          |
| `claude-sonnet-4-5@20250929` | global / us-east5 | ❌ 404                          |
| `claude-sonnet-4@20250514`   | global            | ❌ 404                          |
| `claude-3-7-sonnet@20250219` | global / us-east5 | ❌ 404                          |
| `claude-opus-4-5@20251101`   | global            | ❌ 404                          |

## Findings

- **Exactly one Claude model is callable: `claude-opus-4-1@20250805` on the `global` endpoint.** Auth is ADC (`authorized_user`), no API key, response carries provider/model.
- **"Claude Opus 4.8 / 4.6" do not exist as Vertex model IDs** — those are Anthropic-API names. The Vertex Model Garden Opus for this project is **Opus 4.1**. No Sonnet is enabled either.
- **Throughput is constrained:** under light concurrency the global endpoint returned **HTTP 429 (Too Many Requests)** — a real production-reliability signal (see benchmark). Failures are loud (logged `advisor_model_fallback`), never silent.

## Confirmations vs Phase-1 checklist

- model available ✅ (Opus 4.1, global only) · region supported ✅ (global only) · ADC works ✅ · no API key ✅ · no silent fallback ✅ (loud 429 → visible fallback) · provider/model in metadata ✅.

## Implication

The benchmark contender is **Claude Opus 4.1** (not 4.8/4.6). It is usable but rate-limited on this project's global endpoint — relevant to any "make Claude primary" decision.
