# Frontier Model Inventory — LifeNavigator

**Date:** 2026-06-15
**Purpose:** Honest, verified inventory of every model **actually available** to LifeNavigator for the
advisor/model-qualification program. **No assumptions, no invented models.** Access reality was verified this
session (Vertex Model Garden state, Fly config, AI Studio key). Benchmark facts are pulled from
[`CLAUDE_CONTROL_EXPERIMENT.md`](./CLAUDE_CONTROL_EXPERIMENT.md) and
[`MODEL_ROLE_QUALIFICATION.md`](./MODEL_ROLE_QUALIFICATION.md) — measured on the real 50-scenario / 5-judge
harness.

> **Ground rules.** "Benchmarked" means a measured score on the LifeNavigator harness — capability priors and
> pricing pages are **not** benchmarks. "Accessible" means callable from this environment **today** with
> existing credentials. Costs are public list prices ($/M tokens, in/out). Latency is the measured harness p50
> where we have it, else **untested**. Where a public spec is not independently confirmed in this session it is
> marked **(public spec)**.

---

## Verified access state (this session)

- **Production advisor model** = `gemini-2.5-flash` (Fly: `apps/api-gateway/fly.toml` →
  `GEMINI_GENERATION_MODEL = "gemini-2.5-flash"`; default in `apps/api-gateway/app/config.py`). Called **only
  from the Fly backend** via the AI Studio key — never from Vercel.
- **Vertex project** = `gen-lang-client-0849161409` (LifeNav). **Claude Opus 4.1** is enabled in Model Garden
  (`global`) and was run in-pipeline behind `USE_VERTEX_CLAUDE`.
- **Vertex catalog also lists** `claude-opus-4-5/4-6/4-7/4-8` and `claude-sonnet-4-5` in `us-central1`/`global`,
  but they are **NOT enabled** → return 404 until one-click Model-Garden-enabled.
- **No OpenAI key** and **no NVIDIA/Nemotron access** in this environment → those classes are **inaccessible**.

---

## Full model inventory

| Model                                 | Provider                      | Version                           | Context window              | Cost ($/M in → out)                                                       | Latency                             | Availability                                                           | Production status                                                       | Benchmarked?                                                         | Class                                            |
| ------------------------------------- | ----------------------------- | --------------------------------- | --------------------------- | ------------------------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------ |
| **Gemini 2.5 Flash**                  | Google                        | `gemini-2.5-flash`                | ~1M tokens (public spec)    | ~$0.30 → $2.50 (public spec)                                              | **p50 12.7s (measured)**            | AI Studio (live key on Fly) + Vertex                                   | **IN PRODUCTION** — sole advisor (`advisor-hybrid-6.0.0`)               | **Yes — 6.66** (trust 8.5, 0 fab, 5 fallbacks)                       | **Balanced** (default/volume tier)               |
| **Gemini 2.5 Pro**                    | Google                        | `gemini-2.5-pro`                  | ~1M–2M tokens (public spec) | ~$1.25 → $10.00 (public spec; matches repo cost table `observability.ts`) | untested                            | AI Studio + Vertex (`google` publisher, enabled)                       | Not in advisor role; used for reasoning/vision/video utility paths      | **Benchmark IN PROGRESS this session**                               | **Premium** (reasoning Gemini tier)              |
| **Gemini 2.5 Flash-Lite**             | Google                        | `gemini-2.5-flash-lite`           | ~1M tokens (public spec)    | ~$0.10 → $0.40 (public spec)                                              | untested                            | AI Studio + Vertex                                                     | Configured as `AI_CHEAP_MODEL` for cheap utility calls; **not** advisor | **No**                                                               | **Fast** (cheapest tier)                         |
| **Claude Opus 4.1**                   | Anthropic (via Google Vertex) | `claude-opus-4-1@<version>`       | 200K tokens (public spec)   | ~$15.00 → $75.00 (public spec)                                            | **p50 61s (measured, in-pipeline)** | **Vertex Model Garden — ENABLED** (LifeNav proj, `global`)             | Not in prod; runs behind `USE_VERTEX_CLAUDE` flag                       | **Yes — 7.30 in-pipeline** (raw 8.00; trust 8.2, 0 fab, 6 fallbacks) | **Frontier** (high-stakes tier)                  |
| **Claude Sonnet 4.5**                 | Anthropic (via Google Vertex) | `claude-sonnet-4-5@<version>`     | 200K tokens (public spec)   | ~$3.00 → $15.00 (public spec)                                             | untested                            | Vertex catalog-listed — **NOT enabled (404)**; needs one-click enable  | None                                                                    | **No** — cannot run until enabled                                    | **Premium** (cost/quality sweet spot, projected) |
| **Claude Opus 4.5 / 4.6 / 4.7 / 4.8** | Anthropic (via Google Vertex) | `claude-opus-4-5/6/7/8@<version>` | 200K tokens (public spec)   | premium (public list, per version)                                        | untested                            | Vertex catalog-listed (`us-central1`/`global`) — **NOT enabled (404)** | None                                                                    | **No**                                                               | **Frontier**                                     |
| **GPT-class (OpenAI)**                | OpenAI                        | —                                 | —                           | —                                                                         | —                                   | **None — no API key in this environment**                              | None                                                                    | **No**                                                               | **INACCESSIBLE**                                 |
| **Nemotron-class**                    | NVIDIA                        | —                                 | —                           | —                                                                         | —                                   | **None — not enabled / no access**                                     | None                                                                    | **No**                                                               | **INACCESSIBLE**                                 |

> Cost/context cells marked **(public spec)** are list-price/spec figures, not independently re-verified against
> a provider invoice this session. The repo's own cost table (`apps/web/src/lib/ops/observability.ts`) confirms
> Gemini 2.5 Pro at $1.25 in / $5.00 out per 1M for its accounting path; the public list out-rate is higher for
> long outputs — treat the table as the system-of-record for billing math, the public spec for ceilings.

---

## Honest scope of the qualification program

### ✅ ACCESSIBLE & BENCHMARKABLE NOW (callable today with existing credentials)

| Model                     | Why it's runnable now                                                             | Benchmark state                                        |
| ------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **Gemini 2.5 Flash**      | Live AI Studio key on Fly; it _is_ production                                     | **Done — 6.66**                                        |
| **Gemini 2.5 Pro**        | AI Studio + Vertex `google` publisher, enabled                                    | **In progress this session**                           |
| **Gemini 2.5 Flash-Lite** | Same AI Studio API surface                                                        | Not yet run (eligible for utility-role benchmark only) |
| **Claude Opus 4.1**       | **Enabled in Vertex Model Garden** (LifeNav, `global`) behind `USE_VERTEX_CLAUDE` | **Done — 7.30 in-pipeline**                            |

These four are the **entire benchmarkable surface** without any new provisioning or credentials.

### ⏳ PENDING ENABLE (catalog-listed on Vertex, one-click enable required → currently 404)

| Model                                 | Blocker                                                    | Action to make benchmarkable                                                                                                                                                  |
| ------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Claude Sonnet 4.5**                 | Listed but **not enabled** in LifeNav Model Garden → 404   | One-click enable in Model Garden, pin `@version`, set region; then run the 50-scenario harness. This is the top-priority enable (projected Opus-quality at viable economics). |
| **Claude Opus 4.5 / 4.6 / 4.7 / 4.8** | Listed in `us-central1`/`global` but **not enabled** → 404 | Enable in Model Garden before any call; pin `@version` + region.                                                                                                              |

### ❌ INACCESSIBLE (no credentials in this environment — out of scope until provisioned)

| Class                       | Reason                                                                                                                                                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GPT-class (OpenAI)**      | No OpenAI API key present anywhere in this environment. Cannot be called or benchmarked. (Raw ChatGPT reference outputs in the benchmark were captured **offline/manually**, not via an API this environment holds.) |
| **Nemotron-class (NVIDIA)** | Not enabled, no access path. Cannot be called or benchmarked.                                                                                                                                                        |

---

## Notes that keep this honest

- **Only two models carry benchmark authority** today: Gemini 2.5 Flash (6.66) and Claude Opus 4.1 (7.30
  in-pipeline / 8.00 raw). Every other quality claim in this repo for other models is **inferred**, not
  measured — see `MODEL_ROLE_QUALIFICATION.md`, which flags each inferred rating `[I]`.
- **Gemini 2.5 Pro's row will gain a measured score** when this session's in-progress run completes; until then
  its latency stays **untested** and its qualification is **inferred**.
- **No model on this list other than Gemini 2.5 Flash is in the production advisor path.** Opus 4.1 is
  flag-gated; Pro/Flash-Lite serve non-advisor utility roles; the rest are not provisioned.
- **The LN validator sits in front of every model** and is the trust spine — it caught 3 fabrications raw Claude
  made, yielding 0 in-pipeline. Trust is platform-carried, not model-carried.
  </content>
  </invoke>
