# Final Technical Design Review — Enterprise Semantic Knowledge Platform

**Reviewer role:** independent Principal Architect · **Date:** 2026-07-30 · **Commit:** `da8c7428`
**Evidence base:** live production baseline (2026-07-30) + repository inspection.
**Posture:** adversarial. Prior design recommendations in `docs/semantic-platform/` are treated as
suspect, not as settled.

---

## 0. Executive judgment

**Can this architecture survive ten years without fundamental redesign? Conditionally yes — after
three corrections, two of which invalidate my own prior recommendations.**

The foundation is better than the design documents credited. Three properties, verified in code, are
genuinely strong and rare:

1. **Exactly one writer.** `apps/lifenavigator-core-api/app/clients/neo4j.py` exposes
   `query_personal`, `query_personal_dicts`, `_post_personal`, `ready` — **no write method exists.**
   All graph mutation flows through the Rust worker. Single-writer semantic authority is the hardest
   property to retrofit and it is already true.
2. **Traversal is tenant-anchored on both endpoints.** `traversal.py:110` emits
   `MATCH (a)-[r:{rels}]-(b {tenant_id: $user_id})` — the _far_ end is constrained, not just the seed —
   and the client refuses any statement lacking `$user_id` and refuses caller override of the bound
   tenant. This is stronger than most production knowledge graphs.
3. **Policy is data, generated, drift-gated.** The catalog → manifest pipeline with semantic-compare
   gates is the correct architecture and is working.

Three findings are disqualifying if left unaddressed. **Two are defects in my own prior design**, which
is the point of an independent review:

| #       | Finding                                                                                                                                                       | Severity     |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **R-1** | The graph is being used as a **time-series store**. 61% of edges are `HAS_TRANSACTION`, at ~2 edges per transaction node. This is the ten-year scaling cliff. | **Critical** |
| **R-2** | **My own** assertion-per-edge provenance design is a migration dead end at scale and is wasteful today.                                                       | **Critical** |
| **R-3** | C-2 manifest policy fidelity — 150 declared policy sites, 0 exported.                                                                                         | **Critical** |

---

## 1. Corrections to my own prior recommendations

Stated first, because a review that only finds fault with others is not a review.

### 1.1 WITHDRAWN — "RRF exists only in the orphaned gateway and must be harvested"

`KNOWLEDGE_GRAPH_REFERENCE_ARCHITECTURE.md` §7 and the master plan both assert this. **It is false.**
`fusion.py` implements RRF with correct rationale (`Score(d) = Σ 1/(k+rank(d))`, rank-based
specifically _"so it needs no score normalisation across channels whose scores are not comparable"_),
carries `vector_score`, `rrf_score`, `final_score`, and handles `None` keys explicitly.

**Consequence:** SP-046 ("harvest api-gateway before retirement") shrinks materially. The harvest list
reduces to `retrieve_central()` + `ln_central` wiring — and `ln_central` is **empty**, so the central
capability has no content to preserve. **The gateway can likely be retired outright**, subject to the
0-traffic + `410 Gone` protocol. This deletes work from the roadmap, which is the preferred direction.

### 1.2 WITHDRAWN — "Python writes to the graph, so type-system provenance enforcement is insufficient"

I asserted in review preparation that multiple writers exist across two languages. **Evidence
disproves it.** The Python Neo4j client is read-only; a `MERGE|CREATE|DETACH DELETE` grep across the
core-api returns only comments and one false positive (`_EMERGENCY_MONTHS` matching the substring
`MERGE`).

**Consequence:** the `PROVENANCE_MODEL.md` §4 enforcement — an `AssertionId` obtainable only by
constructing an `Assertion`, making provenance-free edges unrepresentable — **is sufficient**, because
there is exactly one writer and it is in the language where the type system can enforce it. This is a
strengthening, not a weakening, and it means no database-level constraint is required.

### 1.3 REPLACED — the 7-component confidence vector

`CONFIDENCE_MODEL.md` §2 specifies seven components with Bayesian noisy-OR combination. **Reject as
unnecessary sophistication.** The ground rules forbid features that are merely interesting.

Measured reality: the system has **exactly one** confidence signal in production — extractor confidence
on `DocumentField`. Designing a seven-component probabilistic model atop one measured signal is
speculative. Worse, the struct conflated stored and computed values: `path`, `answer`, and
`recommendation` are _derived per request_ and have no business being fields on a stored assertion.

**Replacement — three stored components, each independently sourced today or imminently:**

```rust
pub struct Confidence {
    source:     f32,          // catalog prior per source_system — available now
    extractor:  Option<f32>,  // real signal, exists on DocumentField today
    resolution: Option<f32>,  // entity-linking confidence — arrives with entity resolution
}
```

`path`, `answer`, and `recommendation` confidence remain **computed and traced**, never stored. The
monotonicity rule (recommendation ≤ answer ≤ evidence) and the self-reinforcement prohibition both
survive unchanged — they were the valuable parts. Bayesian combination is deferred until two genuinely
independent corroborating sources exist, which requires the provenance graph anyway.

_Benefit:_ removes four speculative fields and a probabilistic framework with no calibration data.
_Long-term:_ components are additive; a fourth arrives as a schema addition, not a redesign.

### 1.4 REPLACED — node class hierarchy as Neo4j labels

`SEMANTIC_DATA_MODEL.md` §4 / SP-032 proposes an 8-branch label hierarchy. The motivating query —
cross-domain goal reasoning over `Goal`, `CareerGoal`, `HealthGoal`, `EducationGoal` — covers **127
nodes**. A graph-wide label migration for 127 nodes fails the complexity test.

**Replacement:** declare `superclass` as a **catalog field on the node class spec**. The planner
expands `Objective` to its member classes at query construction time. Identical reasoning capability,
zero graph migration, zero backfill, no dual-label consistency problem, and the hierarchy becomes
diffable and drift-gated like every other contract.

This is strictly better on every ground-rule axis. SP-032 is rewritten, not deleted.

---

## 2. Part 1 — Architectural red team

Attacks that **succeed** against the current architecture, ordered by expected damage.

### R-1 · Relationship explosion: the graph is a time-series store — **Critical**

**Evidence.** `HAS_TRANSACTION` = 1,951 of 3,208 edges (**61%**). `TransactionSummary` = 984 nodes.
The ontology attaches transactions twice — `user("HAS_TRANSACTION")` and
`fk("HAS_TRANSACTION","financial_account","account_id")` (`ontology.rs:94-95`) — yielding **~2 edges
per transaction node**.

**Why it breaks.** Transaction volume grows as `users × accounts × time`. Every other node class grows
as `users × life-events`, which is orders of magnitude slower and bounded. At 10M users the graph
becomes almost entirely transaction edges, and every graph operation — traversal, quality aggregates,
partitioning, backup, provenance — pays for data that is fundamentally tabular time-series and derives
almost no value from being in a graph. Transactions are rarely traversal targets; they are aggregated.

This is a **scaling cliff, a cost cliff, and a migration dead end simultaneously**. It is also the one
finding that no amount of downstream optimization repairs, because it is a substrate mismatch.

**Recommendation.** Transactions live in Postgres (already the system of record via Plaid). The graph
holds `FinancialAccount` and **periodic aggregates** — which `TransactionSummary` already nearly is.
Target: 1 summary node per account per period, one edge, no per-transaction user edge.

- _Evidence:_ 61% edge share, 2× edge multiplier, fastest-growing class.
- _Rationale:_ match substrate to access pattern; preserve the graph for relational reasoning.
- _Implementation:_ stop emitting `user→HAS_TRANSACTION`; keep `account→HAS_TRANSACTION` to summaries only.
- _Migration:_ deprecate the user-anchored edge (stops new writes, existing reads unaffected), verify no
  traversal depends on it, retire, then remove. The lifecycle machinery for this already exists.
- _Evaluation:_ golden-set retrieval must show **no regression**; edge count should fall ~30–40%.
- _Rollback:_ re-enable emission; the type is retired, not removed.
- _Operational impact:_ smaller graph, faster aggregates, cheaper backups.
- _Long-term:_ removes the only unbounded-growth edge class from the graph.

### R-2 · Provenance granularity: my assertion-per-edge design — **Critical**

**Evidence.** `PROVENANCE_MODEL.md` §2 specifies one `Assertion` node per domain edge. At 1B edges that
is 1B assertion nodes plus 1B `MATERIALIZES` edges — **the provenance graph exceeds the domain graph**.
I waved at this with "externalize above 50M assertions," which is a migration dead end: it defers a
rebuild rather than avoiding one.

It is also wasteful _today_. One Plaid sync produces ~1,951 edges with **identical** provenance —
same source, same extractor, same version, same timestamp. Storing 1,951 copies is pure duplication.

**Recommendation — provenance granularity varies by ingestion class.**

| Class                               | Granularity                                                 | Rationale                                          |
| ----------------------------------- | ----------------------------------------------------------- | -------------------------------------------------- |
| Bulk API sync (Plaid, institutions) | **per batch** — edges carry `batch_id`                      | provenance is genuinely identical across the batch |
| Document extraction                 | **per assertion** — page/section/char-span differ per field | granularity is the value                           |
| User-stated                         | **per assertion**                                           | each statement is a distinct act                   |
| Inferred/derived                    | **per assertion**                                           | must record strategy and inputs                    |

And: **assertions live outside the graph from day one** — Postgres, keyed by `assertion_id`, with only
the id on the edge. This is what I should have specified initially. The graph keeps traversal
performance; provenance gets relational indexing, cheap retention operations, and no scaling cliff.

- _Evidence:_ 61% of edges share one provenance; 1:1 doubles the graph.
- _Rationale:_ store provenance at its true granularity, in the substrate suited to it.
- _Implementation:_ `assertion` / `assertion_batch` tables; worker writes both; edge carries the id.
- _Migration:_ forward-only; replay-recoverable subset; `unknown_legacy` remainder. Unchanged.
- _Evaluation:_ provenance completeness; **0 dangling ids**; cascade correctness; storage per 1M edges.
- _Rollback:_ stop writing; the graph never depended on it structurally.
- _Long-term:_ removes the 50M-assertion rebuild entirely.

### R-3 · Authorization drift (C-2) — **Critical**

150 declared policy sites, 0 exported, serving tier reads one boolean. Unchanged from
`SEMANTIC_GOVERNANCE.md` §1. Latent with one principal; a breach on the day a second agent ships.

### R-4 · Evaluation bias: the golden set cannot measure missing knowledge — **High**

**Evidence.** `build_golden.py` generates queries by filling templates with **real entity titles from
the tenant's own graph**. Every query is answerable by construction.

**Why it matters.** This measures ranking, not coverage. It structurally cannot detect "the user asked
about their mortgage and we have no mortgage node" — which is the dominant real-world failure and the
one users actually experience. A retrieval system optimized against this set will look excellent while
being blind to absence.

**Recommendation.** Add a **known-absent negative set**: queries about entity classes the tenant
provably lacks. Correct behaviour is an honest "no evidence," never a plausible substitute. Gate
fabrication at 0 on this set specifically. Cheap, and it measures the failure mode that matters.

### R-5 · Vendor lock-in: Cypher — **Medium**

`traversal.py` emits Cypher string-built per query. Neo4j Aura's Query API v2 is already a proven
coupling hazard (the positional-rows defect). Cypher is not portable; a substrate change is a rewrite
of the traversal layer.

**Assessment: accept, with containment.** Cypher is the right tool and swapping graph vendors is not a
credible ten-year event. Containment: keep all Cypher generation inside `traversal.py` (currently
true — preserve it as an invariant), and keep the _plan_ (frontier, depth, permitted rel types) as a
substrate-neutral structure so only the emitter would change. Do **not** build a query abstraction
layer — that is unnecessary sophistication for a swap that will probably never happen.

### R-6 · Vector poisoning via document ingestion — **High**

User-uploaded document → extraction → embedding → future retrieval. Crafted content persists in the
vector store and is retrieved later, when the upload context is long gone. Prompt-layer injection
defenses (unbuilt) do not address this: the contamination is at the _ingestion_ layer.

**Mitigation, already largely designed:** unreviewed document extraction carries source confidence
0.60, below the citation threshold; the privileged-sink rule refuses document-only justification for
mutations. What is missing is that the **vector** is retrievable regardless of the assertion's
confidence. Recommendation: the confidence/review state must be a **Qdrant payload field**, so
retrieval filters poisoned-or-unreviewed content at the vector layer rather than downstream.
Payload indexes already exist for `domain`/`tenant_id`/`entity_type`; this is one more.

### R-7 · Governed feedback loop: advisor → `life.facts` → coverage → advisor — **Medium**

The advisor writes facts; `life.facts` is an additive coverage signal; coverage shapes what the advisor
asks next. This is a real loop. It is **currently safe** because writes are approval-gated by a human,
but it is undocumented as a loop, and the safety property lives in the product rather than in the
architecture.

**Recommendation:** document it as a _governed_ loop with the human gate as the named invariant, and
add a metric — proportion of graph growth originating from `AdvisorInferred` vs external evidence. A
rising ratio is the early signal of a graph talking to itself.

### R-8 · Identity collisions / duplicate explosion — **High**

No `business_identity` is declared for any node class, so duplicate detection is undecidable and
consolidation cannot be automated. Already captured (`SEMANTIC_DATA_MODEL.md` §2.1). Confirmed as
correctly specified; it is a gap in implementation, not in design.

### Attacks that **fail** (architecture holds)

| Attack                              | Why it fails                                                                                         |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Tenant leakage via traversal        | Both endpoints bound to `$user_id`; client refuses statements lacking it and refuses caller override |
| Cross-tenant edges                  | 0 measured; 1 edge/tenant on the only fallback class                                                 |
| Semantic drift catalog↔manifest     | Semantic-compare drift gates in CI                                                                   |
| Ontology poisoning via ingest       | Unknown relationship = build failure, not a guess (`spec_for → None` = refuse)                       |
| Multi-writer provenance bypass      | **Single writer** — Python client is read-only                                                       |
| Cache inconsistency                 | No cache layer exists (verified). Future risk, not current                                           |
| Embedding dimension drift           | Uniform 3072; mismatch is an automatic stop condition                                                |
| Score-normalization error in fusion | RRF is rank-based by explicit design                                                                 |
| Graph fragmentation                 | Tenant-partitioned by construction; disjoint subgraphs                                               |

---

## 3. Part 2 — Knowledge integrity ledger

Eighteen questions per the brief. Current answerability, measured:

| Question                           | Answerable            | Missing metadata                     |
| ---------------------------------- | --------------------- | ------------------------------------ |
| Who created me?                    | ✗                     | `asserted_by`                        |
| Why?                               | ✗                     | `assertion_reason`                   |
| From what evidence?                | ✗                     | `derived_from[]`                     |
| When?                              | ~                     | node-level only; 0/3,208 edges       |
| Under which ontology version?      | ✗                     | `ontology_version`                   |
| Under which ingestion version?     | ✗                     | `pipeline_version`                   |
| Under which extraction version?    | ~                     | document tier only                   |
| With what confidence?              | ~                     | `DocumentField` only                 |
| Can I be challenged?               | ✗                     | `assertion_status`                   |
| Can I expire?                      | ✗                     | `effective_to`                       |
| Can I be superseded?               | ✗                     | `superseded_by`                      |
| Can I be reconstructed?            | ✗                     | provenance chain                     |
| Can I be deleted?                  | ~                     | no cascade across 4 stores           |
| Can I be cited?                    | ~                     | catalog-level only, not per instance |
| Can I influence recommendations?   | ✗                     | `reasoning_policy`                   |
| Can I influence planning?          | ✗                     | `reasoning_policy`                   |
| Can I influence autonomous agents? | ✗                     | principal model                      |
| Under which tenant?                | ✓ (nodes) / ✗ (edges) | node-level enforced                  |

**Score: 1 fully answerable, 5 partial, 12 unanswerable.** Every gap is metadata, none is algorithmic —
which is the single most important structural fact in this review. The platform is a schema extension
away from integrity, not a redesign away.

---

## 4. Part 12 — Subsystem scores (not averaged)

| Subsystem                | Score   | Justification                                                                                                |
| ------------------------ | ------- | ------------------------------------------------------------------------------------------------------------ |
| **Ontology / catalog**   | **9.0** | Enumerable, fail-closed, drift-gated, single authority. Loses 1.0 to the lossy export (C-2)                  |
| **Graph substrate**      | **6.0** | Tenant-partitioned and clean, but storing time-series (R-1)                                                  |
| **Planner**              | **7.5** | Manifest-derived, canonicalizing, fail-closed. `_DOMAIN_TERMS` still hand-maintained                         |
| **Retrieval**            | **7.0** | Vector proven live; RRF correct; **traversal never run in production**                                       |
| **Evaluation**           | **2.0** | `golden.json` does not exist; and the design has coverage blindness (R-4)                                    |
| **Security / isolation** | **8.5** | Both-endpoint tenant anchoring, guard clause, 0 cross-tenant measured. Loses points to unrotated credentials |
| **Governance**           | **2.5** | Policy declared in Rust, absent in serving tier; no classification; no cascade                               |
| **Provenance**           | **1.0** | 0/3,208 edges. Design existed but was wrong-granularity (R-2)                                                |
| **Confidence**           | **2.0** | One real signal; prior design over-specified                                                                 |
| **Temporal reasoning**   | **1.5** | No valid/transaction time; future-fact leakage is possible today                                             |
| **Semantic quality**     | **3.0** | Framework designed, baseline measured, nothing automated                                                     |
| **Multi-agent**          | **1.0** | No principal concept in the serving tier                                                                     |
| **Operations**           | **4.0** | Deploys, secrets, CI real; no APM/tracing; shallow health checks; capacity unknown                           |
| **Developer experience** | **7.5** | Generated contracts, strong doc-comments explaining _why_, honest failure notes                              |
| **Scalability**          | **4.5** | Tenant-partitioning is excellent; R-1 and R-2 are cliffs                                                     |
| **Explainability**       | **3.5** | Trace designed and correctly bounded; not implemented                                                        |

**Weakest: provenance (1.0), multi-agent (1.0), temporal (1.5), evaluation (2.0), confidence (2.0),
governance (2.5).** These are not averaged away. The platform today is a **strong retrieval system with
an excellent semantic authority layer and essentially no knowledge-integrity layer.**

---

## 5. Part 9 — Technical debt inventory

| ID   | Item                                                                     | Sev          | Business risk                       | Effort  | Ops risk | ROI        |
| ---- | ------------------------------------------------------------------------ | ------------ | ----------------------------------- | ------- | -------- | ---------- |
| D-1  | Exposed credentials unrotated (Supabase, PAT, Fly org token, Qdrant key) | **Critical** | Breach                              | Low     | Low      | Highest    |
| D-2  | R-1 transaction edges in graph                                           | **Critical** | 10-yr cliff                         | Med     | Med      | Very high  |
| D-3  | R-2 provenance granularity                                               | **Critical** | Rebuild at scale                    | Med     | Low      | Very high  |
| D-4  | C-2 manifest fidelity                                                    | **Critical** | Breach on agent #2                  | **Low** | Low      | Highest    |
| D-5  | `golden.json` absent                                                     | **High**     | Unfalsifiable claims                | Med     | None     | Very high  |
| D-6  | Traversal never run in production                                        | **High**     | Unknown correctness                 | Low     | Med      | High       |
| D-7  | ANOM-1 17-tenant divergence unexplained                                  | **High**     | Unknown integrity                   | Low     | None     | High       |
| D-8  | R-4 evaluation coverage blindness                                        | **High**     | Optimizing the wrong thing          | Low     | None     | High       |
| D-9  | R-6 vector-layer poisoning filter                                        | **High**     | Contamination                       | Low     | Low      | High       |
| D-10 | `:Entity` population 0                                                   | **Medium**   | Silent-empty class                  | Low     | None     | Medium     |
| D-11 | No APM/tracing; shallow health                                           | **Medium**   | Blind ops                           | Med     | Low      | Medium     |
| D-12 | Capacity unknown                                                         | **Medium**   | Unplanned outage                    | Low     | None     | High       |
| D-13 | `_DOMAIN_TERMS` hand-maintained                                          | **Medium**   | Evolution-rule violation            | Low     | None     | Medium     |
| D-14 | TTL/OWL 4th vocabulary                                                   | **Medium**   | Drift                               | Low     | None     | Medium     |
| D-15 | 107/147 relationship types unused                                        | **Low**      | Unmeasured                          | —       | None     | Track only |
| D-16 | api-gateway orphaned-but-live                                            | **Low**      | Attack surface, service-role holder | Low     | Low      | Medium     |
| D-17 | Edge-level `tenant_id` absent                                            | **Low**      | Defense-in-depth only               | Med     | Low      | Low        |

**D-1 is first.** Every write-enabled item is gated behind it, and it is the cheapest.

---

## 6. Part 10 — Roadmap validation: work deleted

The shortest correct roadmap is preferred. Deletions and demotions:

| Item                                   | Action                  | Reason                                                                            |
| -------------------------------------- | ----------------------- | --------------------------------------------------------------------------------- |
| SP-046 harvest api-gateway             | **Shrink to retire**    | RRF already in `fusion.py`; `ln_central` empty. Nothing to harvest                |
| SP-032 class hierarchy                 | **Rewrite**             | Catalog field, not graph labels. Zero migration                                   |
| SP-012 7-component confidence          | **Rewrite**             | 3 stored components; computed values not stored                                   |
| Bayesian confidence combination        | **Delete**              | No calibration data; no independent sources until provenance exists               |
| `PROVENANCE_MODEL` in-graph assertions | **Rewrite**             | R-2. Outside the graph, batch-granular for bulk                                   |
| Wave 5 partitioning / sharding         | **Keep deferred**       | Triggers unchanged; tenant partitioning already natural                           |
| Collective/central knowledge           | **Delete from roadmap** | `ln_central` empty, no reader, highest risk. Re-propose only with a business case |
| Multi-model embedding routing          | **Keep deferred**       | Unchanged                                                                         |
| Custom rules engine                    | **Delete**              | Reasoning falls out of catalog metadata. No re-entry trigger identified           |

**Moved earlier:** D-7 (ANOM-1) and D-9 (vector-layer confidence filter) move into Wave 0 — both are
Low effort and both gate trust in everything measured afterward.

---

## 7. Part 13 — The last 10%

Assuming everything above lands, four items separate 9.5 from 10. Each eliminates systemic risk; none
is cosmetic.

**L-1 · Provenance-complete deletion, proven.** A deletion that verifiably removes every trace across
Neo4j, Qdrant, Postgres, and object storage, with a machine-readable completion artifact and
independent reconciliation. Until deletion is _proven_ rather than _attempted_, the platform cannot
hold regulated data at enterprise scale. This is the single highest-value remaining item.

**L-2 · Adversarial evaluation as a standing gate.** Not just the golden set: a red-team corpus of
poisoned documents, contradictory assertions, temporal traps (future facts phrased as present), and
cross-tenant probes, run every release, all gated at zero. Systems degrade along axes nobody measures.

**L-3 · Reproducibility proof, not reproducibility claim.** A scheduled job that replays historical
traces and asserts identical evidence sets. A reproducibility guarantee that is never exercised is a
belief.

**L-4 · Grant/usage divergence reporting.** Automatically detect permissions no agent has exercised and
propose their removal. Least privilege decays silently after the first review; this is the only
mechanism that keeps it true at year five.

**Explicitly rejected as cosmetic or speculative:** GraphQL/API abstraction layers, a custom query
DSL, a graph-vendor abstraction (R-5), agent marketplaces, autonomous self-modifying ontologies,
speculative LLM-planner integrations, and "AI-native" reformulations of solved problems.

---

## 8. Success criteria — what fails in ten years if nothing changes

**Answered directly.**

1. **Year 2–4: the graph collapses under transaction volume (R-1).** The fastest-growing edge class is
   the least valuable to traverse. Every graph operation slows; costs rise superlinearly; eventually the
   graph must be rebuilt with transactions removed — under production load, which is the worst time.
2. **Year 3–5: provenance requires a rebuild (R-2)** if built 1:1 in-graph. The externalization
   migration at 50M+ assertions is exactly the "migration dead end" this review exists to prevent.
3. **The day agent #2 ships: authorization breach (R-3, C-2).** Not gradual. A step function.
4. **Year 1 onward, continuously: unfalsifiable quality claims.** Without `golden.json` and a
   known-absent set, retrieval quality drifts with no signal. This is already happening.
5. **Year 5+: the system cannot prove deletion**, foreclosing enterprise and regulated markets — a
   business-model failure rather than a technical one.

**What would _not_ fail:** the catalog/manifest authority model, tenant isolation, the single-writer
property, tenant-natural partitioning, and the fail-closed discipline. These are correct and durable.
They are also the parts that are hardest to retrofit, which is why the architecture is worth
correcting rather than replacing.

---

## 9. Residual uncertainty — documented, not hidden

| Uncertainty                                         | Why it matters                                                   | How to resolve                                           |
| --------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------- |
| ANOM-1: 17-tenant Neo4j/Qdrant divergence           | Stores disagree about what exists                                | Investigate; never delete                                |
| Traversal correctness in production                 | Never executed against live data                                 | Run read-only with flag forced on for one tenant         |
| Real capacity                                       | No load test                                                     | Load test                                                |
| Whether the graph channel improves retrieval at all | The shallow star (avg degree 2.56) may not support it            | Golden-set ablation — **must be allowed to return "no"** |
| 107 unused relationship types                       | Forward-looking catalog vs dead weight                           | Track ratio as the graph grows                           |
| `ln_central` contents/writers                       | Empty now; provenance unknown                                    | Inventory before any use                                 |
| Whether `PersonaProfile` should be a node at all    | 1 per tenant, no properties of consequence, only a fallback edge | Revisit during SP-030                                    |

---

## 10. Recommended next step

**Do not implement from this review.** Produce an ADR per Critical and High recommendation — decision,
alternatives considered, trade-offs, migration plan, measurable success criteria — and review those
before any code.

ADRs required: **R-1** (transactions out of graph), **R-2** (provenance granularity + externalization),
**R-3/C-2** (manifest fidelity), **R-4** (known-absent evaluation set), **R-6** (vector-layer
confidence filter), **R-8** (business identity), **D-1** (credential rotation), **D-6** (traversal
production verification), plus the three self-corrections in §1 that overturn prior designs
(§1.1 gateway retirement, §1.3 confidence model, §1.4 class hierarchy).
