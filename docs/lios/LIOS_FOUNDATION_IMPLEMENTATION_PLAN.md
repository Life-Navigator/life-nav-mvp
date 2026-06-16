# LIOS Foundation Implementation Plan (Phase 12)

Prioritized by durable value, not architectural ambition. The honest headline: **most of LIOS already exists in
fragments** (ontology in the Rust worker, 3-store graph, relationship_manager, recommendations_os, the trust
spine, documents pipeline, model governance). The work is **formalize + unify + accumulate**, not greenfield.
And the **pilot needs ~none of the NEW LIOS work** — it ships on what's live.

Legend: effort (S/M/L) · risk (lo/med/hi) · impact (the moat axis it strengthens).

## P0 — before pilot

**Build essentially nothing new in LIOS. Ship the pilot; instrument accumulation.**
| Item | Effort | Risk | Impact | Why |
|---|---|---|---|---|
| Pilot go-live checklist (apply migration, Gemini Pro advisor, feedback widget, usage tracking) | S | lo | enables the pilot | already specced in PILOT_READINESS_REPORT |
| **Maximize life-graph accumulation in onboarding** (capture + document upload prompts) | S–M | lo | **grows the moat asset from day 1** | the graph is the moat; fill it during the pilot |
| Make **provenance visible** in the UI ("why this / sources / confidence") | M | lo | sells the trust differentiator | the spine already produces it; surface it |

> Rationale: the benchmark says architecture is 0% of advisor quality. Do NOT delay the pilot for LIOS layers.

## P1 — immediately after pilot (the durable core)

| Item                                                                                                     | Effort | Risk | Impact                              | Dependencies                              |
| -------------------------------------------------------------------------------------------------------- | ------ | ---- | ----------------------------------- | ----------------------------------------- |
| **Unified provenance record** (bind model+tools+graph-nodes+documents+assumptions+confidence per output) | M      | lo   | fiduciary-grade auditability (moat) | telemetry pieces exist (advisor_turns)    |
| **Memory lifecycle** first-class (verification/revision/expiration/supersession + confidence)            | M      | med  | durable, trustworthy life model     | life_profile/goals tables + advisor_turns |
| **Ontology registry on the API side** (mirror the Rust worker registry; one canonical schema)            | M      | med  | coherence across domains            | worker ontology.rs exists                 |
| **Resolve domain-ownership seams** (insurance, benefits) — one system-of-record per entity               | S      | lo   | no duplication/ambiguity            | domain routers exist                      |
| DB-backed usage ledger read path (route() takes a usage snapshot)                                        | S      | lo   | plan enforcement at scale           | ledger schema shipped                     |

## P2 — before enterprise rollout

| Item                                                                                             | Effort | Risk | Impact                                      |
| ------------------------------------------------------------------------------------------------ | ------ | ---- | ------------------------------------------- |
| **Scenario engine** (best/expected/worst, deterministic math, graph-tracked assumptions/impacts) | L      | med  | decision depth; enterprise/advisor value    |
| **Risk/opportunity propagation** along graph edges (cross-domain impact analysis)                | M      | med  | "understands my whole life" differentiation |
| Provider adapters beyond Google/Anthropic (OpenAI/local) behind the AdvisorLLM Protocol          | M      | lo   | model independence breadth                  |
| Admin **pilot analytics dashboard UI** (data/endpoints already exist)                            | M      | lo   | ops/insight                                 |
| Enterprise: tenant isolation hardening, audit exports, SSO                                       | L      | med  | B2B2C distribution                          |

## P3 — long-term roadmap

| Item                                                                                          | Effort | Risk | Impact                     |
| --------------------------------------------------------------------------------------------- | ------ | ---- | -------------------------- |
| **Tauri desktop + local models** (privacy/enterprise-local; reuse the Rust worker + registry) | L      | hi   | privacy/enterprise wedge   |
| Offline + cloud sync + conflict resolution (CRDT/provenance-timestamp)                        | L      | hi   | desktop completeness       |
| Cross-store consistency automation (Supabase↔Neo4j↔Qdrant reconciliation as a service)        | M      | med  | graph reliability at scale |
| Local vector/document intelligence on-device                                                  | M      | med  | privacy mode               |

## The discipline

- **Do not** build agent swarms, recursive orchestration, autonomous loops, or a "LIOS Runtime" — 0% benchmark
  justification. Every LIOS item above strengthens a _durable_ asset (ontology/graph/memory/provenance/
  governance), not model theater.
- **Sequence:** pilot → accumulate the life graph + surface provenance → unify provenance/memory/ontology →
  scenario/propagation → desktop. Data and trust first; cleverness later.
