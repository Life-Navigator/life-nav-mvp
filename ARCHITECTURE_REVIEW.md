# Architecture & Scalability Review — LifeNavigator

**Perspective:** Staff/Principal Software Architect, evaluating structure and scale characteristics only.
**Date:** 2026-07-28 · **Scope:** system topology, module boundaries, data flow, coupling, scalability
limits. Security is covered separately in `SECURITY_AUDIT.md`; AI-specific concerns in
`AI_SYSTEMS_REVIEW.md`.

---

## System Topology (as built)

```
                    ┌──────────────────────────────────────┐
   Browser ────────►│  apps/web  (Next.js, Vercel)         │
                    │  189 pages · 319 API routes          │
                    │  governance layer (auth/budget/      │
                    │  rate-limit/circuit-breaker/output)  │
                    └───────────────┬──────────────────────┘
                                    │ HTTPS (service-role JWT passthrough)
                                    ▼
                    ┌──────────────────────────────────────┐
   Mobile ─────────►│  lifenavigator-core-api (FastAPI)    │◄──── direct, internet-reachable
   (Expo, 124 f.)   │  Fly.io · 1 shared CPU · 512 MB      │      (no rate limiting)
                    │  22 routers · 67 services            │
                    └──┬────────┬─────────┬─────────┬──────┘
                       │        │         │         │
              ┌────────▼──┐ ┌───▼────┐ ┌──▼─────┐ ┌─▼──────────┐
              │ Supabase  │ │ Neo4j  │ │ Qdrant │ │ Gemini /   │
              │ Postgres  │ │ Aura   │ │        │ │ Vertex     │
              │ 457 tables│ │        │ │        │ │            │
              └────▲──────┘ └───▲────┘ └──▲─────┘ └────────────┘
                   │            │         │
                   │  ┌─────────┴─────────┴────┐
                   └──┤ ingestion-worker (Rust)│  queue-driven, 5,726 LOC
                      │ ontology registry      │  78 edge rules
                      └────────────────────────┘

              apps/api-gateway — deployable (Dockerfile + fly.toml), essentially no source
```

**Immediate observation:** there are **two independent API tiers** (319 Next.js routes and 22 FastAPI
routers) with no documented contract between them, and **one vestigial deployable unit**. Both are
architectural smells that a reviewer notices in the first ten minutes.

---

## 1. Modularity — **7/10**

### Strong

The advisor subsystem is a genuinely good decomposition, and its boundaries are _load-bearing_ rather than
decorative:

| Module                    | LOC  | Single responsibility           |
| ------------------------- | ---- | ------------------------------- |
| `advisor_context.py`      | 516  | Assemble grounding context      |
| `advisor_llm.py`          | 512  | Prompt construction + transport |
| `advisor_validator.py`    | 704  | Deterministic gate              |
| `advisor_orchestrator.py` | 1007 | Control flow                    |
| `advisor_math.py`         | 182  | Derivation verification         |
| `advisor_sources.py`      | 116  | Citation catalog                |
| `advisor_actions.py`      | 402  | Approval-gated writes           |

The proof these boundaries are real: I substituted a scripted double for the LLM and drove the full
pipeline in tests without touching any other module. Boundaries that survive substitution are genuine.

The Rust worker's ontology split (`ontology.rs` declares, `relationships.rs` translates,
`normalizer.rs` applies) is a textbook data-over-control-flow refactor with an explicit rationale:

> "Relationship emission used to be a growing `match` in the normalizer... The registry makes a
> relationship a _declared rule_ (data), not scattered control flow."

### Weak

**Three god objects**, all in the orchestration layer:

- `relationship_manager.py` — 1,223 LOC
- `life_discovery.py` — 1,139 LOC
- `advisor_orchestrator.py` — 1,007 LOC

`AdvisorOrchestrator._enhance()` alone spans ~140 lines and performs: context build → constraint build →
generate → retry → provider fallback → validate → repair loop → redaction salvage → compose → telemetry →
persistence. That is 4–6 responsibilities. It is _readable_ (the comments are excellent) but it is not
decomposed, and it is the highest-churn function in the system.

---

## 2. Coupling — **6/10**

### Loose where it counts

`AdvisorLLM` is a `Protocol` (structural typing) with four implementations. Swapping Gemini for Claude
required no change to the orchestrator — the Claude control experiment documented in
`docs/advisor-benchmark/` was possible _because_ this abstraction is correct. That is empirical evidence of
good coupling, not an assertion.

### Tight where it hurts

**The dual-API topology creates duplicated logic across a network boundary.** `send-server.ts` re-filters
and re-shapes data the core API already validated:

```typescript
const sources = Array.isArray(turn.sources)
  ? (turn.sources as Array<Record<string, unknown>>)
      .filter((s) => typeof s?.url === 'string' && /^https?:\/\//.test(s.url) && ...)
```

Defensible as defense-in-depth (and I wrote this particular instance), but it is symptomatic: the same
contract is enforced in two languages in two repositories-in-one, with no shared schema. There is no
OpenAPI-generated client, no shared types package for the core-api contract (`packages/` exists but I found
no generated API types). **Contract drift between the tiers is unprevented.**

### Hidden temporal coupling

`_ADVISOR_TURNS_COLUMNS` must stay synchronized with an applied database migration, enforced only by a
comment:

> "a column the table lacks 400s the insert and silently drops EVERY turn"

That is coupling between a Python tuple and external database state, with no mechanism — the incident it
describes already happened once.

---

## 3. Cohesion — **7/10**

High within the advisor cluster and the Rust worker. Lower in `relationship_manager.py` and
`life_discovery.py`, which mix conversation management, scoring, graph reasoning, and persistence.

`services/` at 67 modules is at the upper edge of a flat namespace. There is no sub-packaging
(`services/advisor/`, `services/finance/`), so relatedness is expressed only by filename prefix.

---

## 4. Dependency Management — **6.5/10**

- **Python:** 13 direct dependencies. Impressively lean for a 26k-LOC service.
- **Web:** 34 runtime + 43 dev. Reasonable for Next.js.
- **Rust:** 28 dependencies.
- **Monorepo:** pnpm workspaces + turbo, `--frozen-lockfile` in CI, pinned Node 20 / pnpm 9.
- **Direction:** dependencies flow inward correctly (routers → services → clients). I found no import
  cycles in the advisor cluster.

**Gap:** no dependency-injection container or lifecycle management. `dependencies.py` is a 545+ line
module of factory functions — workable, but it is where the wiring complexity has accumulated, and it
already contains environment-flag branching (`GRAPH_GROUNDING_ENABLED`) that determines whether major
subsystems exist at all.

---

## 5. Layering — **5.5/10**

Intended: `routers → services → clients → external`. Mostly respected.

**Two violations:**

1. **The data-authorization layer is collapsed.** The API tier holds the service-role key and bypasses
   RLS entirely (117 selects, 0 with a user JWT). Application authorization and database authorization
   should be independent layers; here the former subsumes the latter. Architecturally this converts a
   defense-in-depth design into a single point of failure. (Detail in `SECURITY_AUDIT.md` HIGH-1.)

2. **Governance sits at the wrong layer.** `createGovernedHandler` — auth, budget, rate limit, circuit
   breaker — lives in the _web_ tier, while the core API that actually calls the model is separately
   reachable and has none of it. The control is one layer too high.

---

## 6. Abstractions — **7/10**

**Well-chosen:**

- `AdvisorLLM` Protocol — proven by four implementations and a model-swap experiment.
- `MARKET_SOURCES` catalog — "model proposes a key, server resolves the value." A small abstraction that
  eliminates an entire failure class (hallucinated URLs) rather than mitigating it.
- Ontology `IncomingEdge` rules — declarative relationship emission.
- `IngestionService` as the single sanctioned write path for life facts.

**Leaky / missing:**

- **The number gate is an abstraction failure and is documented as one by the author.** It infers a
  number's _meaning_ from characters near it in a string. Three separate bugs during this review traced to
  the same root: `_MONEY_CUE` didn't cover pays-money nouns; ownership was decided by proximity; the window
  read across concatenated sections. `NUMERIC_PROVENANCE_SPEC.md` correctly names the class: _"a character
  window cannot tell whose money a number is."_ The right abstraction (model declares typed figures with a
  `subject`; server owns rendered digits) is specified but unbuilt.
- **No repository/unit-of-work abstraction** — services call the Supabase HTTP client directly, so
  persistence concerns are spread across 67 services.

---

## 7. Inversion of Control — **8/10**

The strongest architectural dimension. Constructor injection throughout:

```python
def __init__(self, relationship_manager, context_builder, llm, *, enabled=True,
             supabase=None, router=None, hybrid_claude=None,
             claude_domains=None, claude_high_stakes_only=True, fast_llm=None)
```

Optional collaborators default to `None` and the system degrades rather than crashing. FastAPI's `Depends`
is used idiomatically. This is what makes the codebase testable — 900 tests run in ~4 seconds because
nothing needs a live dependency.

---

## 8. Boundaries — **6/10**

**Clear:** worker↔API (queue + shared stores), web↔core-api (HTTP), LLM↔system (Protocol).

**Unclear:**

- **web API routes vs core-api routers.** 319 vs 22, no documented split. Which owns business logic?
  Evidence suggests both.
- **`apps/api-gateway`** — a deployable unit with a Dockerfile, a fly.toml, and no meaningful source. Either
  a boundary that was never built or one that was abandoned; either way it is on the deploy path.
- **`packages/`, `ontology/`, `documents/`, `security-policies/`, `reports/`** at the root with unclear
  ownership relative to `apps/`.

---

## 9. Interfaces — **6.5/10**

- FastAPI + Pydantic gives typed, self-documenting HTTP interfaces with auto-generated OpenAPI.
- **No generated client** for the core API — the web tier hand-writes request/response shapes
  (`send-server.ts` casts `Record<string, unknown>` and manually validates). The contract exists in two
  hand-maintained places.
- Internal interfaces (`Protocol`s, dataclasses) are strong. `AdvisorContext` is a well-designed 40+ field
  dataclass with per-field rationale comments.

---

## 10. Extensibility — **7.5/10**

Demonstrated, not claimed:

- Adding a domain to the graph = adding ontology rows.
- Adding a model = implementing `AdvisorLLM`.
- Adding a source = a dict entry.
- Adding a domain playbook = a dict entry in `_DOMAIN_PLAYBOOKS`.

Counter-evidence: adding a _domain_ end-to-end still touches migrations, a router, services, web routes,
components, and the ontology — there is no vertical-slice scaffold, and the 457-table schema suggests each
domain was built largely by hand.

---

# Scalability Analysis

This is where the architecture is weakest, and the findings are concrete rather than theoretical.

## S-1. No HTTP connection pooling — **High impact**

**19 sites** construct a new client per call:

```python
async with httpx.AsyncClient(timeout=self._timeout) as client:
    resp = await client.post(...)
```

No `httpx.AsyncClient` is stored on any client instance (`grep "self._client = httpx"` → no matches).

**Consequence:** every Supabase, Neo4j, Qdrant, and Gemini call pays a fresh TCP + TLS handshake — roughly
50–200ms of avoidable latency per call, on a request path that makes _several_ such calls. Under
concurrency it also burns ephemeral ports and file descriptors.

For a single advisor turn (context build + retrieval + LLM + persistence), this is plausibly 300ms–1s of
pure handshake overhead. **This is the single highest-leverage performance fix in the codebase** and it is
a contained change: hoist the client to instance scope with an explicit lifecycle.

## S-2. Single 512 MB / 1 shared-CPU machine — **High impact**

`fly.toml`:

```toml
min_machines_running = 1
auto_stop_machines = "suspend"
[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 512
```

One suspendable shared-CPU machine with 512 MB, in a single region (`iad`). With ~30s LLM calls and a
repair loop that can double that, concurrency is bounded by event-loop capacity on one small VM. There is
no horizontal scaling config, no queue in front of the model calls, and `auto_stop_machines = "suspend"`
introduces cold-start latency on a path already measured at p50 ~12.7s.

This is fine for 5–20 beta users. It does not survive a launch.

## S-3. No caching layer — **High impact**

No Redis, no response cache, no memoization of embeddings or retrieval results verified anywhere. Every
turn re-embeds the query, re-queries Qdrant and Neo4j, and rebuilds the full context from Supabase.

The most obviously cacheable items — query embeddings, domain summaries, readiness snapshots, the user's
`allowed_numbers` packet — are recomputed per turn.

## S-4. Limited parallelism — **Medium impact**

Only **4** `asyncio.gather` call sites in the entire backend. Project records show it was applied
deliberately where measured (`my-life` 4.3→1.8s, roadmap 3.8→1.7s), which proves the team knows the
technique — it just hasn't been applied systematically. Context assembly, which fans out to multiple
stores, is the obvious next candidate.

## S-5. Unbounded result sets — **Medium impact**

Graph queries use `LIMIT $k` (default 10) — safe. I did not verify pagination across the 319 web API
routes or the Supabase `select` calls, several of which take an optional `limit` that callers may omit.
Flagged as **unverified risk**, not a confirmed finding.

## S-6. Four-store consistency without a transaction boundary — **Medium-High, architectural**

User state spans Supabase (system of record), Neo4j (graph), Qdrant (vectors), and Supabase Storage
(documents). The worker keeps them aligned on a best-effort, queue-driven basis. There is:

- no distributed transaction or outbox pattern verified,
- no reconciliation job found,
- no cross-store deletion path (see `SECURITY_AUDIT.md` MEDIUM-5).

Project records mention a 3-store alignment _check_ (190/786 at one point), which implies drift is a known,
observed phenomenon. At scale, drift becomes permanent without automated reconciliation.

## S-7. Model cost as a scaling constraint — **Acknowledged and partially handled**

A $4/day cap and per-user budgets exist in the web governance layer, plus fast/supervised routing tiers to
control spend. This is genuinely thoughtful. It is undermined by S-2 (the core API is separately reachable
with no budget enforcement).

## S-8. Database scalability — **Good foundation, unproven at load**

625 indexes across 457 tables is a healthy ratio and indicates query patterns were designed rather than
retrofitted. But: no partitioning strategy for high-volume tables (`advisor_turns`, transaction summaries),
no archival policy, no connection-pool configuration reviewed (PostgREST mediates, which helps), and **no
load test anywhere in the repo** to validate any of it.

---

## Scalability Verdict

| Concurrent users | Assessment                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1–20**         | Works today. This is the current, verified operating point.                                                                                       |
| **100**          | Would require connection pooling (S-1) and horizontal scaling (S-2). Both are contained changes.                                                  |
| **1,000**        | Requires caching (S-3), systematic parallelism (S-4), model-call queueing, multi-region, and reconciliation (S-6). Weeks-to-months of work.       |
| **10,000+**      | Requires re-architecting the per-turn data path. The current design rebuilds full context from four stores on every turn; that does not amortize. |

**No load testing exists**, so every number above is inference from the code, not measurement. That absence
is itself the most important scalability finding: **the system's capacity is unknown to its own authors.**

---

## Architectural Debt — Ranked by Leverage

| #   | Item                                                | Effort             | Impact                                         |
| --- | --------------------------------------------------- | ------------------ | ---------------------------------------------- |
| 1   | HTTP connection pooling                             | **Low** (1–2 days) | **High** — immediate latency win on every call |
| 2   | Tenant-scoping wrapper / JWT-scoped reads           | Medium (2–3 wks)   | **Critical** — removes a breach class          |
| 3   | Move governance into the core API                   | Low-Med (1 wk)     | **High** — closes the bypass                   |
| 4   | Caching tier (embeddings, summaries, context)       | Medium             | **High** — latency + cost                      |
| 5   | Decompose the three god objects                     | Medium             | Medium — maintainability                       |
| 6   | Generated API client / shared contract              | Medium             | Medium — kills contract drift                  |
| 7   | Declared-figures contract (replaces the regex gate) | High               | **High** — eliminates a whole bug class        |
| 8   | Cross-store reconciliation + deletion               | High               | High — correctness + compliance                |
| 9   | Horizontal scaling + load testing                   | Medium             | High — capacity becomes known                  |
| 10  | Delete or build `apps/api-gateway`                  | Low                | Low — clarity                                  |

---

## Comparative Assessment

Against systems of similar ambition:

- **Better than typical startup MVPs** at: dependency injection, typed domain modeling, declarative
  ontology, graceful degradation, CI enforcement of invariants.
- **Comparable** at: service decomposition, API design, migration discipline.
- **Worse than production-grade systems** at: connection management, caching, observability, horizontal
  scaling, contract management between tiers, and load validation.

The pattern is consistent and diagnostic: **this architecture was designed for correctness and safety, not
for throughput.** Given the domain (financial/health advice, where a wrong answer is worse than a slow one),
that is a defensible prioritization — but it is a prioritization, not an accident, and the throughput work
is entirely still ahead.

---

## Final Architecture Scores

| Dimension                | Score   |
| ------------------------ | ------- |
| Modularity               | 7.0     |
| Coupling                 | 6.0     |
| Cohesion                 | 7.0     |
| Dependency Management    | 6.5     |
| Layering                 | 5.5     |
| Abstractions             | 7.0     |
| Inversion of Control     | 8.0     |
| Boundaries               | 6.0     |
| Interfaces               | 6.5     |
| Extensibility            | 7.5     |
| **Scalability**          | **4.0** |
| **Overall Architecture** | **6.5** |

**Summary:** a correctness-first architecture with genuinely good inversion of control and one exemplary
declarative subsystem, carrying three structural problems — a collapsed authorization layer, governance at
the wrong tier, and an undocumented dual-API topology — and effectively no scalability engineering. Nothing
here is unfixable; the connection-pooling and governance-placement fixes are days-to-weeks and would move
several scores materially.
