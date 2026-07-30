# Semantic Platform Roadmap

**Status:** Designed · **Date:** 2026-07-30 · Parent: `SEMANTIC_PLATFORM_ARCHITECTURE.md`

Sequencing, gates, and the honest current position. Item detail: `SEMANTIC_PLATFORM_BACKLOG.md`.

---

## 1. Current position

| Capability                         | Highest achieved status                        |
| ---------------------------------- | ---------------------------------------------- |
| Relationship catalog + drift gates | **Live-store tested**                          |
| Ontology manifest generation       | **Live-store tested**                          |
| Domain vocabulary contract         | **Live-store tested** (uncommitted)            |
| Vector retrieval                   | **Live-store tested**                          |
| Graph traversal                    | **Implemented** — never run against production |
| Retrieval evaluation               | **Designed** — `golden.json` does not exist    |
| Provenance layer                   | **Designed** — 0% coverage                     |
| Confidence model                   | **Designed**                                   |
| Temporal model                     | **Designed**                                   |
| Policy plane                       | **Designed**                                   |
| Agent principals                   | **Designed**                                   |
| `GRAPH_GROUNDING_ENABLED`          | **unset**, deliberately                        |

**Nothing above "Designed" exists for any Tier 1+ capability.** The foundation (catalog, manifest,
vector retrieval) is genuinely solid and measured. Everything else is architecture.

---

## 2. Dependency graph

```
SP-001 manifest fidelity ──┬──► SP-021 policy ──► SP-040 agents ──► Phase 14 autonomy
                           │         ▲
SP-020 classification ─────┘         │
                                     │
SP-010 assertions ──┬──► SP-012 confidence ──┘
   + SP-011 writer  │
                    └──► SP-013 temporal ──► counterfactual / simulation
                    └──► SP-022 deletion cascade

SP-002 golden set ──┬──► SP-033 reasoning ──► SP-041 quality dashboard
                    └──► every improvement claim in the program

SP-031 catalog metadata ──► SP-033 reasoning (9 of 13 strategies)
SP-003 load test ──────────► all scalability claims
```

**Three roots: SP-001, SP-002, SP-010.** Everything else descends from one of them. They are also
Low, Medium, and Medium-High complexity respectively — the cheapest work unblocks the most.

---

## 3. Sequence

### Wave 0 — Unblock (nothing else starts cleanly without these)

`SP-001` manifest fidelity · `SP-002` golden set · `SP-003` load test + pooling
`SP-045` domain terms → manifest · `SP-042` explain ANOM-1 · `SP-043` resolve `:Entity`

**Exit gate:** manifest carries the full policy surface (CI-gated) · golden set committed with a
baseline for the current retriever · documented capacity · ANOM-1 explained or reclassified.

**Why first:** SP-001 is Low complexity and blocks the entire governance and multi-agent branch.
SP-002 is the difference between measured engineering and assertion. Neither depends on anything.

### Wave 1 — Trust foundation

`SP-010` assertions · `SP-011` provenance-or-nothing writer · `SP-012` confidence · `SP-013` temporal

**Exit gate:** provenance completeness ratcheting from 0% · 0 orphan/dangling assertions · cascade
correctness proven · **0 future-fact and 0 expired-fact leakage** · replay fidelity 100% · calibration
tracked per source class.

**Why here:** every governance, explainability, and reasoning capability is downstream of assertions
existing. This is the largest single investment in the program and the one with the least visible
short-term payoff — which is exactly why it is scheduled rather than deferred.

### Wave 2 — Governance

`SP-020` classification · `SP-021` policy decision point · `SP-022` deletion cascade

**Exit gate:** 100% class coverage (build gate) · policy shadow-mode disagreements all triaged ·
0 cross-tenant and 0 provider→personal (property tests) · deletion verified across all four stores.

**Mandatory:** the policy engine runs in shadow mode and is reconciled against live behaviour before
enforcement. Skipping this converts every classification error into an outage or a leak.

### Wave 3 — Capability

`SP-030` `HAS_PERSONA` remediation · `SP-031` catalog metadata · `SP-032` class hierarchy ·
`SP-033` reasoning strategies · `SP-046` harvest api-gateway

**Exit gate:** `RELATED_TO` = 0, `HAS_PERSONA` = 148, total edges unchanged · 100% catalog metadata
coverage · each reasoning strategy independently measured, unimproved strategies not shipped.

**Note:** SP-031 is where reasoning capability actually comes from. Nine of thirteen strategies are
blocked on catalog metadata, not on algorithms.

### Wave 4 — Platform

`SP-040` agent principals · `SP-041` quality dashboard · `SP-044` TTL disposition

**Exit gate:** 0 wildcard grants · 0 self-approved mutations · dashboard live with baselines and
deltas · exactly one semantic vocabulary remaining.

### Wave 5 — Scale (trigger-driven, not date-driven)

Partitioning, sharding, incremental metrics, assertion externalization, memory consolidation. Each
begins when its measured trigger fires (`ENTERPRISE_SCALABILITY_PLAN.md` §2), not on a schedule.

---

## 4. The grounding flag

`GRAPH_GROUNDING_ENABLED` stays **unset** through Waves 0–3.

Enablement requires, in order:

1. golden set exists with a baseline (SP-002)
2. traversal measured against production — moving it from _Implemented_ to _Live-store tested_
3. a measured retrieval win, or an honest report that there is none
4. policy plane enforcing (SP-021), so traversal is authorized rather than merely bounded
5. tenant-safety property tests passing — no cross-tenant path, ever

**Step 3 must be allowed to fail.** If graph traversal does not measurably improve retrieval, the
correct outcome is to report that and reconsider, not to enable it anyway. The evaluation framework is
worthless if its verdict is predetermined.

---

## 5. What would falsify this roadmap

Stated deliberately, because a plan that cannot be wrong is not a plan:

- **If the golden set shows the graph channel contributes ~nothing**, Wave 3's reasoning investment is
  premature and enrichment must come first. The measured graph is a shallow star with 61% of edges in
  one type — this outcome is genuinely plausible and should not be treated as a surprise if it happens.
- **If provenance backfill recovers far less than expected**, the `unknown_legacy` cohort dominates and
  citation policy must be redesigned around a mostly-unattributed graph.
- **If ANOM-1 reveals systematic ingest divergence**, that becomes a Wave 0 blocker with priority over
  everything else, because it means the stores disagree about what exists.
- **If load testing shows current capacity is adequate for the pilot horizon**, SP-003's scalability
  work defers and Wave 1 accelerates.

---

## 6. Standing constraints

| Constraint                              | Effect                                                                |
| --------------------------------------- | --------------------------------------------------------------------- |
| Credential rotation prerequisite unmet  | **Blocks all write-enabled production remediation**, including SP-030 |
| Master plan Phase 5A decision gate      | Human sign-off by two reviewers; blocks 5B–5D and 6                   |
| Track separation                        | Security and retrieval changes remain separate PRs and rollback units |
| No mutation without dry-run + preflight | Every production change follows the staged model                      |
| Unexplained store divergence            | Investigated, **never** treated as deletable orphans                  |

---

## 7. Success criteria

The platform stops being describable as "a GraphRAG application" when the fourteen Guiding Principle
questions are answerable **from the data, without reading the code**. Today two of fourteen are.

Measured proxies:

| Criterion                                                              | Today                              | Target                                             |
| ---------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------- |
| Guiding-principle questions answerable                                 | 2 / 14                             | 14 / 14                                            |
| Provenance completeness                                                | 0%                                 | ratcheting, `unknown_legacy` explicitly classified |
| Confidence completeness                                                | 0%                                 | ratcheting                                         |
| Temporal class coverage                                                | 0%                                 | 100%                                               |
| Manifest policy fidelity                                               | **lossy**                          | exact, CI-gated                                    |
| Semantic vocabularies                                                  | 4 (catalog, manifest, domain, TTL) | **1 authoritative**, rest generated                |
| Retrieval claims that are measured                                     | 0%                                 | 100%                                               |
| Reasoning strategies measured independently                            | 0 / 13                             | 13 / 13                                            |
| Agents with explicit grants                                            | n/a (1 implicit)                   | 100% explicit                                      |
| Hard gates at zero (fabrication, leakage, cross-tenant, self-approval) | partially defined                  | all defined and enforced                           |

The last row is the one that matters most. A semantic operating system is not defined by what it can
do — it is defined by what it can **prove it will never do**.
