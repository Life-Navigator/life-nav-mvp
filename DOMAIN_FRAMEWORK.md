# DOMAIN FRAMEWORK

The contract every LifeNavigator domain implements. A domain is **six thin layers** over the
shared platform; follow this and a domain is configuration + domain logic, not architecture.
Derived from the Finance reference. Design spec.

## The six layers (what each domain authors)

### 1. Schema Layer

- Tables in a domain schema (`finance`, `health`, …): the domain nouns + the **standard
  `<domain>_recommendations` table** (RECOMMENDATION_FRAMEWORK shape).
- Apply the **RLS pattern** (owner-ALL `USING/WITH CHECK user_id=auth.uid()` + service-ALL),
  grants, `security_invoker` read views.
- **No triggers in the table migration** (enum-before-trigger).

### 2. Worker Layer

- Add `EntityType` variants (+ `as_str`, `domain()`, `sensitivity()`).
- Add `build_title`/`build_summary` field lists per type.
- (Fan-out, processor, embed, sanitize are inherited unchanged.)

### 3. Ontology Layer

- Add the domain's edge table to `ontology::incoming_edges` (`UserAnchor` + `PayloadFk`
  rules) and membership to `domain_of`.
- Register node labels + relationship vocabulary in `LIFENAVIGATOR_ONTOLOGY_STANDARD`.
- Mapped types **never** fall back to `RELATED_TO`.

### 4. Core API Layer

- `<Domain>Service(DomainService)` implementing the interface (below).
- Mount a router (`/v1/<domain>/summary`, `/recommendations`, `/recommendations/generate`).
- Register in `DomainRegistry` (live vs `unavailable()`).

### 5. Chat Layer

- Nothing new for evidence retrieval — `Retriever.recommendation_evidence` is generic over the
  recommendation label. The domain only adds its `chat_context` authoritative facts.

### 6. Recommendation Layer

- Implement `persist_recommendations` generators (evidence/assumptions/tradeoffs/governance)
  per RECOMMENDATION_FRAMEWORK. Inherit persistence/lifecycle/graph/chat.

## Required interfaces (exact contracts)

### `DomainService` (ABC — already in `app/domains/base.py`)

```python
class DomainService(ABC):
    async def summary(self, ctx: UserContext) -> DomainViewModel: ...
    async def chat_context(self, ctx: UserContext) -> DomainChatContext: ...
    async def recommendations(self, ctx: UserContext) -> list[Recommendation]: ...
    # framework-provided lifecycle the domain reuses:
    async def persist_recommendations(self, ctx: UserContext) -> list[dict]: ...
```

### `DomainSummary` → returns `DomainViewModel`

`{ domain, user_id, generated_at, freshness, confidence, data:{...domain tiles...},
recommendations[], missing[] }`. Money is `{amount,currency}`; **absent = null** (never a fake
0); `missing` drives the UI's connect/add prompts.

### `DomainRecommendationEngine`

`generate(ctx) -> list[RecommendationRow]`. Contract: deterministic; **no inputs → []**; **no
evidence → not persisted**; identity from JWT; structured evidence/assumptions/tradeoffs/
governance per RECOMMENDATION_FRAMEWORK; deterministic uuid5 id.

### `DomainOntologyProvider`

Declares, as data: node labels (domain), the `incoming_edges` rules (user-anchor + FK edges),
and `domain_of` membership. Output consumed by `relationships_for` → typed edges; no
RELATED_TO for mapped types.

### `DomainEvidenceProvider`

For each recommendation: the evidence facts (metric_name/value/source_table/observed_at/
confidence/explanation), assumptions, tradeoffs, and the governance boundary. This is the
_only_ place a domain decides what counts as evidence.

## Quality gates (inherited; a domain unlocks only when all pass)

`GRAPH_QUALITY_GATES.md` (15): enum exists · label correct · `:Unknown`=0 · no mapped→RELATED_TO ·
required user edge · inter-entity edges where FK exists · Qdrant payload fields · node-count
reconciles (or documented) · cross-tenant=0 · recommendations have evidence · chat cites
evidence · deletion defined · idempotent reprocess · audit query exists · gate-before-unlock.

## Domain bring-up checklist (the whole job)

1. Schema migration (tables + RLS + views, **no triggers**).
2. Worker enum variants + title/summary + tests → **deploy worker**.
3. Ontology edges in `ontology.rs` + tests.
4. Trigger migration (after worker deploy) — enum-before-trigger.
5. `<Domain>Service` + router + registry → **deploy Core API**.
6. `persist_recommendations` generators + governance boundaries.
7. Live smoke: generate → graph subgraph → chat "why?" → run the 15 gates.

Everything not in this checklist (fan-out, persistence, retrieval, orchestrator,
anti-hallucination gate, RLS/trigger mechanics, the base models) is **inherited**.
