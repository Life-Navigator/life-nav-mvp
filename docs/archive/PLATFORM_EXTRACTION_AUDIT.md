# PLATFORM EXTRACTION AUDIT

What in the Finance reference implementation is **platform-generic** (inherited by every
future domain) vs **domain-specific** (re-authored per domain). Grounded in the shipped
Finance code. Design/audit only — no code changes.

## Method

Walk each layer of Finance (schema → worker → ontology → Core API → chat → governance)
and tag each unit `GENERIC` (move to framework / reuse as-is) or `DOMAIN` (template to copy

- fill in).

## Layer-by-layer

### Schema (`supabase/migrations/117`, `118`)

| Unit                                                                     | Class       | Notes                                                             |
| ------------------------------------------------------------------------ | ----------- | ----------------------------------------------------------------- |
| Table set: `financial_accounts/transactions/debts/...`                   | **DOMAIN**  | the domain's nouns                                                |
| `financial_recommendations` columns                                      | **GENERIC** | identical shape every domain needs (see RECOMMENDATION_FRAMEWORK) |
| RLS pattern (owner-ALL + service-ALL, FORCE RLS)                         | **GENERIC** | one DO-loop applies it to any table list                          |
| `security_invoker` read view                                             | **GENERIC** | per user-facing table                                             |
| enqueue trigger (`enqueue_*_sync`, `to_jsonb(NEW)`, enum-before-trigger) | **GENERIC** | only the entity_type string + table name differ                   |

### Worker (`apps/ingestion-worker/src/`)

| Unit                                                                                           | Class                                                                                | Notes                                              |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------- |
| `EntityType` variants (`FinancialAccount`, …)                                                  | **DOMAIN**                                                                           | domain nouns                                       |
| `EntityType` enum machinery (`as_str`, `domain()`, `sensitivity()`, `#[serde(other)] Unknown`) | **GENERIC**                                                                          | the pattern; add variants per domain               |
| `build_title` / `build_summary` arms                                                           | **DOMAIN** (per-type) on a **GENERIC** harness (`parts_for`, length cap, empty-skip) |
| `relationships_for` → `crate::relationships::registry_relationships`                           | **GENERIC**                                                                          | registry-driven; domain adds rows to `ontology.rs` |
| `expand_children` fan-out (recommendation → Evidence/Assumption/Tradeoff/AdviceBoundary)       | **GENERIC**                                                                          | works for ANY `*_recommendation` row               |
| `processor.process_upsert` (embed→Qdrant→Neo4j→fan-out)                                        | **GENERIC**                                                                          | unchanged per domain                               |
| `sanitize` / `SENSITIVE_FIELD_PATTERN`                                                         | **GENERIC**                                                                          | shared safety                                      |

### Ontology (`ontology.rs`, `relationships.rs`)

| Unit                                                                              | Class                                        | Notes                      |
| --------------------------------------------------------------------------------- | -------------------------------------------- | -------------------------- |
| `IncomingEdge` / `EdgeFrom::{UserAnchor,PayloadFk}` / `RelRule`                   | **GENERIC**                                  | the registry primitives    |
| `incoming_edges()` finance arms                                                   | **DOMAIN**                                   | the domain's edge table    |
| `registry_relationships()` emitter                                                | **GENERIC**                                  | one engine for all domains |
| `Domain` enum + `domain_of()`                                                     | **GENERIC** (enum) / **DOMAIN** (membership) |
| Node-label taxonomy + relationship vocabulary (`LIFENAVIGATOR_ONTOLOGY_STANDARD`) | **GENERIC** standard; **DOMAIN** entries     |

### Core API (`apps/lifenavigator-core-api/app/`)

| Unit                                                                                                                             | Class                                        | Notes                        |
| -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ---------------------------- | ----------- | ---------------- |
| `DomainService(ABC)` (`summary`/`chat_context`/`recommendations`)                                                                | **GENERIC**                                  | the interface                |
| `FinanceService` body                                                                                                            | **DOMAIN**                                   | the implementation           |
| `models/common`: `Money/SourceRef/Freshness/Confidence/Recommendation/Evidence/DomainViewModel/DomainChatContext/EvidencePacket` | **GENERIC**                                  | shared contracts             |
| `SupabaseClient` (`select`/`insert`/`upsert`, Accept/Content-Profile, degrade-to-[])                                             | **GENERIC**                                  | shared client                |
| `_rec_row` / `persist_recommendations` (uuid5 id, idempotent upsert, no-rec-without-evidence)                                    | **GENERIC** lifecycle; **DOMAIN** generators |
| `DomainRegistry` / `KNOWN_DOMAINS` / `unavailable()`                                                                             | **GENERIC**                                  | gates which domains are live |
| Router shape (`/v1/<domain>/summary                                                                                              | recommendations                              | recommendations/generate`)   | **GENERIC** | per-domain mount |

### Chat / grounding (`grounding/`, `agents/`)

| Unit                                                                                               | Class       | Notes                                                                           |
| -------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------- |
| `Retriever` (Qdrant + Neo4j, user-scoped)                                                          | **GENERIC** |                                                                                 |
| `Retriever.recommendation_evidence` (rec subgraph → facts)                                         | **GENERIC** | domain-agnostic Cypher (label `FinancialRecommendation` is the only domain bit) |
| `ContextBuilder.build_evidence_packet`                                                             | **GENERIC** |                                                                                 |
| `LifeOrchestrator` (classify → packet → anti-hallucination gate → Gemini → Trust/Safety → persist) | **GENERIC** |                                                                                 |

### Governance

| Unit                                                                        | Class       | Notes                                                 |
| --------------------------------------------------------------------------- | ----------- | ----------------------------------------------------- |
| `governance_verdict` jsonb + `AdviceBoundary` node + `REQUIRES_REVIEW` edge | **GENERIC** | boundary_type/disclaimer/escalation differ per domain |
| `GRAPH_QUALITY_GATES.md` (15 gates)                                         | **GENERIC** | the unlock checklist                                  |
| TrustSafetyGate                                                             | **GENERIC** |                                                       |

## Summary

**Platform-generic (extract / reuse — ~80% of the machinery):**
recommendation+evidence+assumption+tradeoff+advice-boundary model and lifecycle ·
ontology registry primitives + emitter · worker fan-out + processor + enum machinery ·
RLS/trigger/enum-before-trigger pattern · `DomainService`/`DomainViewModel`/`DomainRegistry` ·
SupabaseClient · Retriever/ContextBuilder/Orchestrator + anti-hallucination gate ·
chat evidence retrieval · 15 quality gates · all the `models/common` contracts.

**Domain-specific (re-author per domain — the ~20% that is actual product):**
the noun set (tables + EntityType variants + node labels) · `build_title/build_summary`
field lists · the ontology edge table (`incoming_edges` arms + `domain_of` membership) ·
the `DomainService` subclass (reads + recommendation generators) · the domain's
boundary types/disclaimers/escalation rules.

**Conclusion:** the architecture is cleanly separable. A new domain inherits the generic
machinery and supplies a bounded, well-specified set of domain artifacts. The frameworks
below (Phases 2–3) formalize the generic side; the per-domain contracts make the ~20%
a fill-in-the-blanks exercise, not architectural reinvention.
