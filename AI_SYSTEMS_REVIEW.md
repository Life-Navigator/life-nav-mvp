# AI Systems Review — LifeNavigator

**Perspective:** AI Infrastructure Architect / Applied ML Lead evaluating whether this system's AI
architecture delivers a genuine advantage over conventional approaches.
**Date:** 2026-07-28
**Central question:** strip away the vocabulary — is there anything here that a competent team using
LlamaIndex + pgvector + a good system prompt could not reproduce in three months?

**Short answer:** Yes, but only one thing — the deterministic trust layer. Everything described as
"GraphRAG," "semantic graph," and "life OS" is either conventional, shallow, or switched off.

---

## Verdict Summary

| Component                | Claimed                   | Actual                                                                                  | Score   |
| ------------------------ | ------------------------- | --------------------------------------------------------------------------------------- | ------- |
| GraphRAG retrieval       | Core differentiator       | Vector search + flat node scan, **disabled by default**                                 | **3.0** |
| Ontology                 | Semantic life model       | Genuinely good: 78 declared edge rules, 62 typed relations, tenant-safe by construction | **7.5** |
| Embeddings               | —                         | Entity-summary level, no chunking, one model                                            | **5.0** |
| Retrieval quality        | —                         | No reranking, no fusion scoring, no relevance evaluation                                | **3.0** |
| Grounding                | Anti-hallucination        | **Genuinely strong** — provenance-enforcing, arithmetic-verifying                       | **8.5** |
| Citations                | Explainable               | Server-owned catalog + source-table citation with value matching                        | **8.0** |
| Hallucination mitigation | —                         | Best-in-class for a project this size                                                   | **8.5** |
| Fallbacks                | —                         | Layered and well-tested                                                                 | **8.0** |
| Routing                  | Multi-model orchestration | Deterministic regex routing; model routing coded but **flag-off**                       | **5.0** |
| Agents                   | Multi-agent               | Domain playbooks + one orchestrator. Not an agent system                                | **4.0** |
| Memory                   | Cross-turn context        | Real, from `advisor_turns`; no summarization or long-horizon memory                     | **6.0** |
| Evaluation               | Benchmarked               | Real methodology, real control experiment — but **not automated, not gating**           | **6.0** |
| Reasoning                | Decision framing          | Prompt-structured six-section output. Conventional                                      | **5.0** |

**Weighted AI architecture score: 6.0/10** — one exceptional subsystem carrying several conventional and
one misrepresented one.

---

## 1. Is this GraphRAG? — **No, not on the path that matters**

### 1.1 The retrieval the advisor actually calls

`app/grounding/retriever.py::retrieve_personal` is the method wired into `AdvisorContextBuilder`. Its graph
half, in full:

```python
rows = await self._neo4j.query_personal(
    "MATCH (n {tenant_id: $user_id}) "
    "WHERE $domain IS NULL OR n.domain = $domain "
    "RETURN labels(n) AS labels, n.entity_id AS entity_id, n.title AS title, "
    "n.summary AS summary, n.domain AS domain "
    "LIMIT $k",
    user_id=ctx.user_id, parameters={"k": limit, "domain": domain})
```

Examine what is absent:

- **No relationship pattern.** No `-[:REL]->` anywhere in the query.
- **No traversal.** Zero hops. It matches nodes, not paths.
- **No ranking.** No `ORDER BY`, no scoring, no centrality, no recency weighting.
- **No edge weights.** The ontology declares 62 typed relationships; this query reads none of them.

This is `SELECT * FROM nodes WHERE tenant = ? AND domain = ? LIMIT 10`, executed against Neo4j. Running a
filtered scan on a graph database does not make a system GraphRAG any more than storing JSON in Postgres
makes it a document database.

**The graph's entire value — the relationships — is unused by the primary retrieval path.**

### 1.2 Fusion is concatenation, not fusion

Vector hits and graph rows are appended to one `evidence` list. Qdrant entries carry `"score": h.get("score")`;
Neo4j entries carry `"score": None`. There is:

- no reciprocal rank fusion,
- no score normalization,
- no cross-encoder reranking,
- no deduplication between the two sources,
- no relevance threshold.

The list is passed to the LLM in retrieval order. "Hybrid retrieval" here means "two lists, concatenated."

### 1.3 It is switched off

`app/dependencies.py:337`:

```python
if os.environ.get("GRAPH_GROUNDING_ENABLED", "false").lower() in ("1", "true", "yes"):
```

Default `"false"`. And in `advisor_context.py:476`:

```python
# Off (retriever is None) until GRAPH_GROUNDING_ENABLED, so today this is a no-op.
```

**On every production advisor turn, `graph_evidence` is `[]`.** The advisor grounds exclusively on Supabase
reads. The GraphRAG subsystem is dark code in the product's core loop.

To be fair to the author: the comments say this plainly and repeatedly. The code is not lying. **The
documentation is** — `docs/` describes GraphRAG grounding as an operating capability, and a technical
evaluator reading docs-then-code will find the gap immediately.

### 1.4 Where real traversal does exist

`recommendation_evidence()` is legitimate graph work:

```cypher
MATCH (u:UserProfile {tenant_id: $user_id})-[:HAS_RECOMMENDATION]->(r)
OPTIONAL MATCH (r)-[:HAS_EVIDENCE]->(e:Evidence)
OPTIONAL MATCH (r)-[:HAS_ASSUMPTION]->(a:Assumption)
OPTIONAL MATCH (r)-[:HAS_TRADEOFF]->(t:Tradeoff)
OPTIONAL MATCH (r)-[:REQUIRES_REVIEW]->(b:AdviceBoundary)
```

Two hops, four optional expansions, returning evidence with `metric_name`, `metric_value`, `source_table`,
`confidence`, `explanation`. This genuinely answers "why did you recommend this?" from the graph, and the
`AdviceBoundary` node modeling governance constraints _in the graph_ is a nice idea.

But it is a **fixed-shape query serving one feature**, not a retrieval architecture. No variable-length
paths (`*1..3`), no path ranking, no subgraph extraction, no community detection.

### 1.5 Versus Microsoft GraphRAG

| Capability                       | MS GraphRAG | LifeNavigator                               |
| -------------------------------- | ----------- | ------------------------------------------- |
| Entity extraction from corpus    | LLM-based   | N/A — schema-driven from structured records |
| Community detection (Leiden)     | Yes         | **No**                                      |
| Hierarchical community summaries | Yes         | **No**                                      |
| Global vs local search           | Yes         | **No**                                      |
| Multi-hop traversal              | Yes         | **No** (except one fixed 2-hop query)       |
| Typed ontology                   | Emergent    | **Yes — better, declared and enforced**     |
| Tenant isolation                 | N/A         | **Yes — by construction**                   |

These solve different problems, and LN's schema-driven graph is arguably more appropriate for structured
personal data than LLM extraction would be. But **borrowing the name imports expectations LN does not
meet.**

**GraphRAG score: 3.0/10.** The ingestion and ontology are 7.5/10 work. The _retrieval_ — the RAG — is not
there.

---

## 2. Ontology — the genuine asset — **7.5/10**

`apps/ingestion-worker/src/ontology.rs`, 78 `IncomingEdge` rules, ~62 typed relationship types across a
`Domain` enum (Finance, Health, Career, Family, Education, Decision, Root, General). Sample vocabulary:
`HAS_EVIDENCE`, `HAS_ASSUMPTION`, `HAS_TRADEOFF`, `REQUIRES_REVIEW`, `COVERS_DEPENDENT`, `TARGETS_ROLE`,
`HAS_SKILL_GAP`, `HAS_GUARDIANSHIP_PLAN`, `HAS_COMPENSATION_PROJECTION`.

Three things make this better than typical:

1. **Declarative.** Relationships are data, not control flow. Adding a domain adds rows.
2. **Tenant-safe by construction** — "the registry can never produce a cross-tenant edge." Compare with the
   Python API tier, where isolation is a docstring convention. The author demonstrably knows how to build
   this correctly; they did it in Rust.
3. **Edge direction is explicit and documented** (`EdgeFrom::UserAnchor` vs `PayloadFk`), which is exactly
   the detail most hand-rolled graphs get wrong and then can't debug.

**Limitations:** no formal ontology language (no OWL/SHACL/RDF despite an `ontology/` directory with TTL
files validated in CI — the _executable_ ontology is Rust, so there are two ontologies that can diverge);
no inference/reasoning layer; no cardinality or domain/range constraints enforced at write time; and CI's
`validate-ontology` job only **verifies the TTL files exist**, not that the graph conforms.

---

## 3. Embeddings & Chunking — **5.0/10**

`processor.rs:92`:

```rust
let vector = self.gemini.embed(&canon.summary).await?;
```

**One embedding per entity summary. No chunking whatsoever** — no splitter, no overlap, no token budgeting,
no parent-document strategy.

For structured records ("Checking account, $8,200") this is defensible and arguably correct: the natural
unit _is_ the record. But it means:

- long documents (wills, policies, statements) are reduced to a single summary vector — no passage-level
  retrieval, no "which clause said that";
- retrieval granularity is fixed to whatever the normalizer wrote into `summary`;
- **embedding quality is entirely determined by summary-generation quality**, which I did not see evaluated
  anywhere.

### A latent configuration landmine

`apps/ingestion-worker/src/config.rs:40-41`:

```rust
gemini_embedding_model: env::var("GEMINI_EMBEDDING_MODEL")
    .unwrap_or_else(|_| "text-embedding-004".to_string()),
```

The in-code default is `text-embedding-004` (768-dim) — which the project's own fly.toml comment states was
**retired by Google**. Both deployed `fly.toml` files override it to `gemini-embedding-001` (3072-dim), so
production is consistent today. But any environment that omits the variable — local dev, a test harness, a
new region, a fresh deploy target — silently produces **768-dim vectors against a 3072-dim collection**.
The failure is a dimension mismatch at write time or, worse, a silently degraded index.

The correct fix is one line: make the code default match reality, or make the variable required. The
existing mitigation is a comment in a different file in a different language.

---

## 4. Grounding & Hallucination Mitigation — **8.5/10 — the real differentiator**

This is the part of the system that is genuinely ahead of common practice. It is a **layered, deterministic
gate**, not prompt-based pleading.

### Layer 1 — Provenance-constrained context

`allowed_numbers` (user-stated + Plaid + scenario engine) and `domain_facts` (each carrying `sourceTable`,
`recordId`, `confidence`) define what the model is permitted to assert.

### Layer 2 — Arithmetic verification

`advisor_math.verify_derivations` recomputes the model's claimed expression and accepts only values
traceable to user numbers plus unit constants (12/52/365/100). **The server does the math; the model only
proposes it.** Most RAG systems have no equivalent.

### Layer 3 — The output gate

`validate()` blocks fabricated personal figures, advice/medical/legal/tax overreach, unsupported
relationship claims, and any persistence attempt. Fact citations are verified against the packet by
_value_, not just by table name:

```python
if src in packet_tables:
    val = str(f.get("value") or "").strip().lower()
    return bool(val) and any(str(p.get("sourceTable")) == src and (val in str(p.get("value")).lower() ...))
```

So the model cannot fabricate a fact by stamping a real-looking source on it. That is a subtle attack this
codebase anticipated.

### Layer 4 — Supervised repair, not rejection

`classify_issues()` returns per-issue instructions, and the loop re-validates every repaired draft. The
instruction differentiates by failure type — including telling the model _not_ to delete:

```python
"repair_instruction": f"KEEP this price — don't delete it. Rewrite {tok} as a hedged RANGE ..."
```

### Layer 5 — Salvage

Redact-don't-nuke drops the offending sentence rather than discarding a good six-section answer.

### Layer 6 — Deterministic fallback

Rule-based counsel if all else fails. The chat path never raises.

### Layer 7 — Structurally impossible hallucinated citations

`advisor_sources.py` — the model emits a **key** from a closed catalog; the server owns the URL. Not
"discouraged." Impossible.

**Why this matters:** the industry norm is "we told the model not to hallucinate and we show sources."
This system _mechanically prevents_ several hallucination classes and _verifies_ a third. In a regulated
domain that is the difference between a demo and a product.

### The honest caveat

The number gate's _implementation_ is a regex-window heuristic, and it is fragile in ways the author has
documented better than I could:

> "a character window cannot tell whose money a number is, and every fix is another guess at the same
> missing information."

Three distinct bugs traced to this root during a single review session — a missing noun class, ownership
inferred by proximity, and a window that read across concatenated sections. All were found only after
someone went looking. The correct design (model declares typed figures with a `subject`; server owns every
rendered digit) is fully specified in `NUMERIC_PROVENANCE_SPEC.md` and **unbuilt**.

So: the _architecture_ of the trust layer is excellent; one _component_ of it is built on sand and known to
be.

---

## 5. Retrieval Quality — **3.0/10 — unmeasured**

There is **no retrieval evaluation of any kind**: no recall@k, no precision, no MRR/nDCG, no golden query
set, no relevance judgments, no ablation of vector-vs-graph contribution.

This is the most consequential gap in the AI system. Without it:

- nobody can tell whether the retriever helps or hurts,
- nobody can justify enabling `GRAPH_GROUNDING_ENABLED`,
- nobody can tune `limit=10`, choose an embedding model, or evaluate chunking.

The project measured **end-to-end advisor quality** carefully (see §8) but never measured the retrieval
that is supposed to be its differentiator. That is measuring the outcome while leaving the claimed cause
untested.

---

## 6. Routing, Agents, Memory

**Routing — 5.0.** Deterministic regex classification into fast/standard/supervised tiers, with a
conservative bias (finance/health/numeric always supervised). Sensible and cheap. The _model_ router
(registry, budget, fallback) exists in code but is **flag-gated off**, so the "multi-model orchestration"
claim describes unexercised code.

**Agents — 4.0.** Domain playbooks appended to one system prompt, plus a `RelationshipManager` that routes.
There is no agent loop, no tool-use cycle, no planner, no inter-agent communication, no state machine. It
is a well-organized single-prompt system. Calling it multi-agent would be inaccurate; to the author's
credit, the code doesn't.

**Memory — 6.0.** Real cross-turn context from `analytics.advisor_turns` (`conversation_so_far`), which
measurably fixed a "starts over every turn" problem (context 0→81% per project records). But: no
summarization, no long-horizon compression, no salience/decay model, no episodic/semantic split. Beyond a
handful of turns this will hit context limits with no strategy.

---

## 7. Explainability — **7.5/10**

Genuinely strong for a system this size:

- Every rendered field passes the same trust gate (`_visible_segments`).
- `derivations` expose the arithmetic behind computed figures.
- `confirmed_facts` cite `sourceTable`.
- `relationships_referenced` must match real graph edges or the turn is rejected.
- `recommendation_evidence()` answers "why?" from graph evidence with confidence values.
- `_reasoning_payload` ships tradeoffs/what-we-know as structured data for a UI drawer.

Weakness: no per-token or per-claim attribution, and explanations are only as good as `summary` fields
written elsewhere.

---

## 8. Evaluation Methodology — **6.0/10 — good science, poor automation**

### What is genuinely good

The **Claude control experiment** is the standout. Holding prompt, pipeline, and scenarios fixed and
swapping only the model produced: 6.66 → 7.30, attributing the gap to **~47% model, ~49% number gate,
0% architecture**.

That is a properly designed ablation, and it **disconfirmed the author's own thesis** — the architecture
they had invested most in contributed nothing to the measured gap. They documented it and cancelled the
planned "LIOS" build on the strength of it. Intellectual honesty of this kind is rare and is the strongest
signal in the entire repository about how this engineer thinks.

A 50-scenario 3-way benchmark (LN vs ChatGPT vs Claude Opus) with a documented NO-GO verdict, plus
`scenarios.json` / `scenarios_finhealth.json` and an `advisor-eval.yml` workflow, back this up.

### What is missing

- **Evaluation does not gate anything.** No regression threshold on fabrication rate, grounding rate, or
  answer quality in CI. The `advisor-eval.yml` workflow exists but quality is not a merge gate.
- **No retrieval evaluation** (§5).
- **Subjective scoring** — the 6.66/7.30 figures come from LLM-judge or human read, with no inter-rater
  reliability reported.
- **`scripts/eval_prompt_live.py` has never been run.** Written this session, blocked on expired ADC. So
  the newest prompt rules (market-price hedging, source-key selection) are **entirely unvalidated against a
  real model** — they are tested only against scripted doubles, which by construction cannot measure prompt
  adherence.
- **No adversarial/red-team evaluation** — no injection scenarios, no jailbreak suite.

---

## 9. Does the AI architecture deliver a real advantage?

### Where it genuinely does

**Regulated-domain output safety.** If you asked me to build a financial advisor that must never state an
unsourced number about a user's money, I would want this trust spine. The combination of
provenance-constrained context + server-side arithmetic verification + a deterministic output gate +
repair-not-reject + structurally-impossible citation hallucination is **not** something you get from
LlamaIndex, LangChain, or a good prompt. It is domain engineering, and it is the defensible part.

**Approval-gated agency.** "The LLM never writes to the database; persistence is deterministic" is the
correct architecture for agentic systems and most teams get it wrong.

### Where it does not

**Retrieval.** A team using LlamaIndex + pgvector with a reranker would likely achieve _better_ retrieval
quality than this system's current path in a fraction of the effort — and would be able to measure it.

**Orchestration.** Hand-rolled and simpler than LangGraph. No advantage.

**The graph.** The _ontology_ is an advantage. The _retrieval over it_ is not, because it doesn't traverse
and isn't on.

### The honest competitive read

Against **NotebookLM**: different problem (structured personal model vs uploaded documents); LN's grounding
discipline is stronger, its retrieval far weaker.

Against **a generic RAG app**: LN wins decisively on output safety, loses on retrieval sophistication and
evaluation automation.

Against **ChatGPT with memory**: the project's own benchmark answered this — **LN lost 0/50, Claude won 48**,
and the diagnosis was model quality plus the over-restrictive number gate, _not_ architecture. That
benchmark is the most important document in the repository and it says the AI system does not currently
beat a frontier chatbot at the advice task.

---

## 10. Priorities for AI Improvement (by leverage)

| #   | Action                                                                                   | Why                                                                                                |
| --- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | **Build a retrieval eval set** (50–100 queries with relevance judgments)                 | Everything else in retrieval is unmeasurable without it. Cheapest highest-value item.              |
| 2   | **Make retrieval actually traverse** — 1–3 hop paths, typed-edge weighting, path ranking | Turns the ontology from a write-side asset into a read-side one, and makes the GraphRAG claim true |
| 3   | **Run the live prompt eval; then gate CI on fabrication + grounding rates**              | Currently the newest safety rules are unvalidated against any real model                           |
| 4   | **Implement the declared-figures contract**                                              | Eliminates a whole bug class the author has already diagnosed and specified                        |
| 5   | **Add reranking + score fusion (RRF)**                                                   | Concatenated lists are leaving quality unclaimed                                                   |
| 6   | **Fix the embedding-model default; add a dimension assertion at startup**                | One-line fix for a silent-corruption landmine                                                      |
| 7   | **Adversarial/injection eval scenarios**                                                 | The only untested threat class in an otherwise well-defended system                                |
| 8   | **Chunking for long documents**                                                          | Required before document Q&A is credible                                                           |
| 9   | **Enable and measure `GRAPH_GROUNDING_ENABLED`**                                         | Either it helps and should ship, or it doesn't and the claim should be dropped                     |
| 10  | **Memory summarization strategy**                                                        | Current approach will hit context limits                                                           |

---

## Final AI Architecture Scores

| Dimension                            | Score   |
| ------------------------------------ | ------- |
| GraphRAG (as implemented)            | **3.0** |
| Ontology & knowledge modeling        | **7.5** |
| Embeddings & chunking                | **5.0** |
| Retrieval quality & evaluation       | **3.0** |
| Grounding & hallucination mitigation | **8.5** |
| Citations & explainability           | **7.5** |
| Fallbacks & degradation              | **8.0** |
| Routing                              | **5.0** |
| Agents                               | **4.0** |
| Memory                               | **6.0** |
| Prompt engineering                   | **6.5** |
| Evaluation methodology               | **6.0** |
| Multi-model orchestration            | **5.0** |
| **Overall AI Architecture**          | **6.0** |

---

## Bottom Line

**Genuinely advanced:** the deterministic trust spine. It is the only component here I would call
state-of-practice-exceeding, and it is a real, transferable, defensible piece of engineering.

**Genuinely good:** the ontology registry and the evaluation _culture_ (specifically the willingness to run
an experiment that disconfirmed the author's own architecture thesis, and to act on it).

**Mostly conventional:** prompts, routing, memory, orchestration, fallbacks.

**Misrepresented:** GraphRAG. The retrieval performs no traversal, applies no ranking, and is disabled by
default. The ingestion pipeline that fills the graph is good work — but a graph you write to and never
traverse is a database, not a retrieval architecture.

**The most important sentence in this review:** the project's own benchmark found LifeNavigator lost 0 of
50 head-to-head scenarios against Claude, and attributed **0%** of the gap to architecture. Any claim that
this AI system's _architecture_ is its advantage is contradicted by the project's own best evidence. The
advantage it actually has — and it is a real one — is that its answers can be _trusted_ in a way a frontier
chatbot's cannot. That is worth building on, and it is a different claim than the one the documentation
currently makes.
