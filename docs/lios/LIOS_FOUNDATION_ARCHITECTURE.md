# LIOS Foundation Architecture

The Life Intelligence Operating System: the **durable** layer that understands a user's life and governs all
intelligence applied to it. **Models are replaceable workers; LIOS owns the durable assets.** This is the
synthesis; each layer has a detailed phase doc.

## Core principle

Models are interchangeable labor. The user's **life model** — ontology, graph, memory, decision frameworks,
provenance — is durable and is the moat. LIOS owns the balance sheet; models do the work.

## The honest state: LIOS already exists in fragments

This is not greenfield. ~70% of LIOS is live in pieces; the sprint formalizes + unifies + governs them.

| Layer (phase)                           | Owns                                                            | Lives today in                                                                                                           | Maturity                                                |
| --------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| **Ontology** (1)                        | canonical entities                                              | Rust worker `ontology.rs`/`entities.rs`; `documents` schema; 138 migrations                                              | EXISTS, needs API-side registry                         |
| **Relationships** (2)                   | typed edges + confidence/lineage/provenance                     | `relationship_manager.py`, advisor edge model, Neo4j                                                                     | EXISTS (core edges), expand                             |
| **Memory** (3)                          | facts/goals/decisions/… lifecycle                               | `life_profile`, goals/risks/opps tables, `advisor_context` cross-turn, `analytics.advisor_turns`                         | PARTIAL (lifecycle not first-class)                     |
| **Graph** (4)                           | nodes/edges/evidence/lineage/scenario/decision stores           | 3-store: Supabase canonical + Neo4j + Qdrant; `decision_graph.py`; `/v1/life-graph`                                      | EXISTS (traversal/conflict); propagation NEW            |
| **Decision** (5)                        | Understand→…→Next Action                                        | advisor 6-section (`advisor_llm`), `advisor_validator`, `advisor_math`, `recommendations_os`, `decision.py`              | EXISTS (framing); scenarios/confidence PARTIAL          |
| **Scenario** (6)                        | best/expected/worst, assumptions/impacts                        | —                                                                                                                        | NEW (must use deterministic math, not model projection) |
| **Provenance** (7)                      | why/data/assumptions/evidence/confidence/model/tools/nodes/docs | `advisor_validator` (number-gate), `advisor_math`, `recommendations_os` (evidence-or-nothing), `advisor_turns` telemetry | EXISTS (strong); unified record PARTIAL                 |
| **Domain ownership** (8)                | finance/health/career/education/family boundaries               | domain routers/services                                                                                                  | EXISTS; resolve insurance/benefits seams                |
| **Model governance / independence** (9) | registry, capability classes, routing, trust spine              | `model_registry`, `model_router`, `AdvisorLLM` Protocol, health-safety                                                   | EXISTS (most-complete layer)                            |
| **Desktop** (10)                        | local ontology/graph/memory/models, sync                        | Rust worker is local-ready; registry enables local models                                                                | NEW/roadmap                                             |

## Data flow (one turn / one document)

```
Document ─▶ Rust ingestion (ontology + entity extraction) ─▶ typed nodes/edges + evidence
                                                                   │
User turn ─▶ Domain classify ─▶ Capability router ─▶ Model(worker) ─▶ Decision pipeline
                                     │ (model-agnostic)                     │
            Life Graph (3-store) ◀───┴── grounds context ───────────┐      ▼
                                                              Trust spine (validator/number-gate/
                                                              evidence-or-nothing/health-safety)
                                                                     │
                                                              Provenance record (model+tools+nodes+docs+
                                                              assumptions+confidence) ─▶ user + audit trail
```

Every output is grounded in the graph, gated by the model-agnostic trust spine, and recorded with provenance.

## What LIOS is / is not

- **IS:** ontology, graph, memory, decision framework, scenario framework, provenance, domain ownership, model
  governance/registry, the trust spine — the durable, model-independent life model.
- **IS NOT:** the models themselves (workers), agent swarms, recursive orchestration, autonomous loops, model
  experimentation, the UI, the prompt-of-the-month. (Benchmark: architecture = 0% of advisor quality; do not
  build runtime/agent theater.)

## Layer docs

`LIOS_ONTOLOGY_ARCHITECTURE` · `LIOS_RELATIONSHIP_MODEL` · `LIOS_MEMORY_ARCHITECTURE` · `LIOS_GRAPH_ARCHITECTURE`
· `LIOS_DECISION_ENGINE` · `LIOS_SCENARIO_ENGINE` · `LIOS_PROVENANCE_ARCHITECTURE` · `LIOS_DOMAIN_OWNERSHIP` ·
`LIOS_MODEL_INDEPENDENCE` · `LIOS_DESKTOP_COMPATIBILITY` · `LIOS_COMPETITIVE_MOAT` ·
`LIOS_FOUNDATION_IMPLEMENTATION_PLAN` · `LIOS_EXECUTIVE_SUMMARY`.
