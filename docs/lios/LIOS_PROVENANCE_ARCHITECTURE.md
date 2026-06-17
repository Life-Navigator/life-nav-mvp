# LIOS Provenance Architecture (Phase 7)

**Thesis: provenance is the moat.** LifeNavigator's biggest existing strength is not the
model — it is the deterministic trust spine that sits _around_ the model and guarantees that
every number, relationship, and recommendation traces to the user's own data or a verified
derivation. The spine is **model-agnostic** (it catches fabrication regardless of which LLM
produced it) and produces an **auditable, regulator/fiduciary-grade** record of how each
output came to exist.

This document answers, for every output the platform emits, the eight provenance questions —
and for each one states **how it is answered TODAY** (with the exact code that answers it) and
what is **PARTIAL** or **NEW**.

Legend: **EXISTS** = implemented and load-bearing today · **PARTIAL** = the pieces exist but
are not yet bound into one record · **NEW** = not yet built.

---

## 0. The benchmark proof (why this is the moat)

The trust spine is model-agnostic and was validated against Claude as the generating model:
raw Claude fabricated **3 numbers**; routed _through the in-pipeline_ validator + grounded-math
verifier, fabrication dropped to **0**. The guarantee does not depend on the model behaving —
it depends on a deterministic gate the model cannot talk its way past. Measured
benchmark/trust scores per model live in `docs/model-routing/` and `docs/advisor-benchmark/`
(referenced from `app/services/model_registry.py`).

`"No mock data — ever"` is a hard platform rule: every UI binds to real Core-API / extracted
data with honest empty states, never fabricated values.

---

## 1. The eight provenance questions

For each output (an advisor turn, a recommendation, a life-graph edge) we must be able to answer:

| #   | Question                                       | Answered today by                                                                                                                        |
| --- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | **Why was this generated?**                    | recommendation `description` + `quantified_impact.priority_reason`; advisor `why_this_question` / `decision_frame`                       |
| Q2  | **What data was used?**                        | recommendation `evidence[].source_table`; advisor `context.allowed_numbers` (the user's own figures)                                     |
| Q3  | **What assumptions were made?**                | recommendation `assumptions[]`; advisor `safe["assumptions"]`                                                                            |
| Q4  | **What evidence supports it?**                 | recommendation `evidence[]` (evidence-or-nothing); advisor cited `relationships_referenced`                                              |
| Q5  | **What confidence?**                           | recommendation `confidence` + `formula`; advisor turn `confidence`                                                                       |
| Q6  | **What model participated?**                   | `model_router.RoutingDecision.to_log()` (`selected_model`, `provider`) — logged, **not yet a column**                                    |
| Q7  | **What deterministic tools participated?**     | `advisor_validator.validate`, `advisor_math.verify_derivations`, `RecommendationOS` formula — logged as `validator_result`/`derivations` |
| Q8  | **What graph nodes / documents participated?** | advisor `graph_edges_available` + `relationships_referenced`; recommendation `evidence[].source_table` (`documents:<doc_type>`)          |

The rest of this document grounds each answer in code.

---

## 2. Q1 — Why was this generated?

**EXISTS.**

- **Recommendations.** Every recommendation written through
  `RecommendationOS.write()` (`app/services/recommendations_os.py:56`) carries a human-readable
  `description` and a structured `quantified_impact` with a `priority_reason`
  (e.g. _"retirement is your largest long-term lever and is currently estimated, not measured"_,
  line 271). Dependency recs additionally carry `unlocked_capabilities` and
  `downstream_recommendations_unlocked` — i.e. _why this matters and what it unblocks_.
- **Advisor turns.** The hybrid advisor exposes its reasoning as user-visible sections —
  `decision_frame`, `why_this_question`, `what_we_know`, `what_we_still_need`
  (`advisor_validator.py:160-169`). These are the "why" of a conversational turn and are
  themselves subjected to the trust gates (see §3, §4).

**PARTIAL.** The "why" is currently expressed in _prose fields per output type_. There is no
single normalized `reason` field shared across recommendation + advisor + graph outputs.

---

## 3. Q2 — What data was used? (the number gate)

**EXISTS — this is the core fabrication guarantee.**

`advisor_validator.validate()` (`advisor_validator.py:147`) enforces that **any financial-looking
number** in any user-visible field must already be in `context.allowed_numbers` (the user's own
figures), OR be a value that the grounded-math verifier deterministically certified:

```python
# advisor_validator.py:179-184
verified_vals, kept_derivs = verify_derivations(result.get("derivations"), context.allowed_numbers)
allowed = context.allowed_numbers | verified_vals
used = _financial_numbers(visible)
invented = {n for n in used if n not in allowed}
if invented:
    reasons.append(f"invented numbers not in context: {sorted(invented)}")
```

A financial number is detected by `_FIN_NUM` (`$`, `%`, or any integer ≥ 100;
`advisor_validator.py:84`). If a number is neither the user's own nor verified, the **entire
turn is rejected** and the deterministic fallback is served. This is what produced the benchmark
result (3 → 0).

For recommendations, the "data used" is the `evidence[].source_table` field — see Q4 — which
names the exact table/document the figure came from (e.g. `documents:401k_statement`,
`life:life_objectives`).

**PARTIAL.** `allowed_numbers` is a flat set of value strings; it does not yet carry, per number,
_which document/field_ it came from. Binding each allowed number back to a
`documents.extracted_json` field path is **NEW**.

---

## 4. Q3 — What assumptions? & Q4 — What evidence?

### Q4 — Evidence (EXISTS — "evidence-or-nothing")

`RecommendationOS.write()` refuses to emit a recommendation without evidence:

```python
# recommendations_os.py:66-70 (Deliverable 3 — Integrity)
# Integrity: no recommendation without evidence.
ev = evidence or []
if not ev:
    return None
```

Each evidence item is `{"statement": ..., "source_table": ...}`
(e.g. `recommendations_os.py:252`, `:292`, `:404`). Evidence _strength_ feeds the ranking
formula (`ev_strength`, line 78), and document-sourced evidence is weighted higher
(`"documents:" in source_table`).

For advisor turns, **relationship claims require a real graph edge + citation**.
`_check_relationships()` (`advisor_validator.py:119`) rejects any cited relationship that is not
a real connected pair in the user's graph (`context.connected_pairs`), and rejects any asserted
relationship that lacks a supporting edge. If the user's graph has _no_ edges, _no_ relationship
may be claimed at all (line 141).

### Q3 — Assumptions (EXISTS, structured)

Recommendations carry `assumptions[]` (e.g. the 401(k) rec's tax-treatment caveat,
`recommendations_os.py:250`). Decision-engine outputs tag assumptions with
`source: "model"` + a confidence (e.g. `decision_engine.py:150`), distinguishing
model-stated assumptions from user-confirmed facts. The advisor's `safe["assumptions"]` is set
(defaulted) on every accepted turn (`advisor_validator.py:226`).

**PARTIAL.** Assumptions exist per output but are not yet stamped with _who_ asserted them
(model vs. deterministic engine vs. user) in a uniform field across all three output types — the
decision engine does this (`source: "model"`), recommendations and the advisor do not yet.

---

## 5. Q5 — What confidence?

**EXISTS.**

- **Recommendations.** `confidence` (0..1) is stored, and the full **visible ranking formula** is
  persisted on every row:

  ```python
  # recommendations_os.py:82-84
  formula = {"impact": ..., "confidence": ..., "urgency": ...,
             "evidence_strength": ..., "effort": ..., "priority_score": ...,
             "formula": "Impact × Confidence × Urgency × Evidence ÷ Effort"}
  ```

  A confidence below `_CONF_FLOOR = 0.25` cannot rank — it renders as
  _"needs more information"_ (`recommendations_os.py:26`, `_rankable` at `:478`). `_why_first()`
  (`:504`) explains _why #1 beat #2/#3_, naming the deciding factor — this is provenance for the
  _ranking itself_.

- **Advisor turns.** `confidence` is a column on `analytics.advisor_turns`
  (`160_advisor_turns.sql:37`) and is averaged in the metrics rollup view.

---

## 6. Q6 — What model participated?

**PARTIAL — logged, not yet a first-class provenance column.**

The model router produces a `RoutingDecision` whose `to_log()` returns
`selected_role`, `selected_model`, `provider`, `reason`
(`model_router.py:154-156`, model ids like `gemini-2.5-flash` from
`model_registry.py:39-45`). The orchestrator captures it into the turn trace and writes a
structured log line:

```python
# advisor_orchestrator.py:185-186
tr["routing"] = decision.to_log()
log.info(json.dumps({"event": "model_route", "turn_id": tr["turn_id"], **decision.to_log()}))
```

It also records provider-failure fallback (`tr["model_fallback"]`, `:247`) and retries
(`tr["llm_retry"]`, `tr["repair_retry"]`).

**Gap (NEW):** `analytics.advisor_turns` has **no `model`/`provider`/`selected_role` column**
(`160_advisor_turns.sql:12-42`). `tr["routing"]` is in the trace dict but, because PostgREST
ignores unknown keys on insert, it is **dropped on the durable write**
(`advisor_orchestrator.py:414-416`). The model identity survives only in application logs, not in
the auditable per-output record. **Adding `model_id` / `provider` / `selected_role` columns to
`advisor_turns` is the single highest-value provenance upgrade.** Recommendations have no model
field at all (most are emitted by deterministic engines, not an LLM — which is itself useful
provenance once recorded).

---

## 7. Q7 — What deterministic tools participated?

**EXISTS (per output), PARTIAL (as a uniform list).**

The deterministic tools that gate/produce an output are:

1. **`advisor_validator.validate`** — the trust gate (number gate, advice gate, relationship gate,
   persistence lock). Outcome recorded as `validator_result` ∈ {accepted, repaired,
   repaired_retry, rejected, n/a} and `validator_reason` / `validator_repairs`
   (`advisor_orchestrator.py:278`, `:299`, `:301`; columns in `160_advisor_turns.sql:21-24`).
2. **`advisor_math.verify_derivations`** — the grounded-math verifier. Each `derivations` entry
   is kept only if every operand traces to a user number / unit constant **and** the arithmetic
   re-evaluates correctly via a restricted AST walk (no `eval`; `advisor_math.py:61-83`). Kept
   derivations are persisted on the accepted turn (`advisor_validator.py:225`,
   `kept_derivs`).
3. **`RecommendationOS` ranking formula** — the deterministic prioritizer; the `formula` object
   _is_ the tool-participation record for a recommendation.

**Gap (PARTIAL/NEW):** these are recorded _per output type_ (validator result on a turn;
formula on a rec) but there is no single `tools_used: [...]` array naming, for one output, which
deterministic checks ran and what each returned.

---

## 8. Q8 — What graph nodes & documents participated?

**EXISTS.**

- **Graph.** Each turn records `graph_edges_available` (count of edges the advisor _could_ see,
  `advisor_orchestrator.py:253`) and `relationships_referenced` (the real edges it _actually
  cited_, validated against `connected_pairs`; column at `160_advisor_turns.sql:36`). The
  `/v1/life-graph/workspace` endpoint (`routers/life_graph.py:38`) serves a **real-edges-only**
  graph: every edge is "backed by a persisted edge or a real shared-node connection, with
  provenance + citation" (module docstring) — `build_workspace()` also threads recommendation +
  evidence lineage into the graph.
- **Documents.** Recommendation evidence names the source document by type in
  `source_table` (`documents:401k_statement`, `documents:life_insurance_policy`,
  `documents:lab_report`, `documents:dd214`, …). The recs engine reads extracted document facts
  via `_facts()` (`recommendations_os.py:119`) keyed by `doc_type`, and `_signature()` (`:129`)
  fingerprints doc set + readiness + objectives so reads auto-recompute when inputs change
  (provenance-of-freshness).

**PARTIAL.** Graph node _ids_ and document _ids_ are not yet stored on the output record —
`relationships_referenced` stores `from`/`to` labels (not node uuids), and evidence stores
`source_table` (the doc _type_, not the specific `documents.id`). Binding to concrete ids is
**NEW**.

---

## 9. The canonical provenance record (PARTIAL → target)

Today the provenance pieces live in **three places**: `analytics.advisor_turns` (model/validator/
tokens/edges per turn), the `recommendations` row (`evidence`/`assumptions`/`confidence`/
`formula`/`narrative`), and the life-graph workspace (edge provenance + citations). **A single
record binding model + tools + nodes + documents per output is PARTIAL — the data exists in
pieces but is not unified.**

Proposed canonical schema (a new `provenance` record keyed by `output_id`, derivable today from
the three existing sources):

```jsonc
{
  "provenance_id": "uuid",
  "output_id": "uuid", // advisor turn_id | recommendation id | graph edge id
  "output_kind": "advisor_turn|recommendation|graph_edge",
  "user_id": "uuid",
  "tenant_id": "uuid",
  "created_at": "timestamptz",

  // Q1 — why
  "reason": "string", // EXISTS as description / why_this_question / priority_reason
  "priority_reason": "string|null", // EXISTS (recs quantified_impact.priority_reason)

  // Q2/Q8 — what data / which documents + nodes
  "data_used": [
    {
      "kind": "user_figure",
      "value": "45000",
      "source": "documents:401k_statement",
      "document_id": "uuid|null", // NEW — bind to documents.id
      "field_path": "extracted_json.balance|null",
    }, // NEW — bind to the extracted field
  ],
  "documents": [{ "doc_type": "401k_statement", "document_id": "uuid|null" }], // type EXISTS, id NEW
  "graph_nodes": [{ "id": "uuid|null", "label": "Retirement" }], // labels EXIST, ids NEW
  "graph_edges_cited": [{ "from": "Retirement", "to": "Education", "edge_id": "uuid|null" }], // EXISTS (labels), id NEW
  "graph_edges_available": 12, // EXISTS (advisor_turns.graph_edges_available)

  // Q3 — assumptions  (EXISTS; asserter tag PARTIAL)
  "assumptions": [
    {
      "label": "Tax treatment",
      "value": "pre-tax traditional 401(k)…",
      "asserted_by": "model|engine|user",
      "confidence": 0.7,
    }, // asserted_by uniform = NEW
  ],

  // Q4 — evidence  (EXISTS — evidence-or-nothing)
  "evidence": [{ "statement": "…", "source_table": "documents:401k_statement" }],

  // Q5 — confidence  (EXISTS)
  "confidence": 0.9,
  "ranking_formula": {
    // EXISTS on recommendations
    "impact": 0.8,
    "confidence": 0.9,
    "urgency": 0.5,
    "evidence_strength": 0.7,
    "effort": 0.2,
    "priority_score": 1.26,
    "formula": "Impact × Confidence × Urgency × Evidence ÷ Effort",
  },

  // Q6 — model  (PARTIAL — logged today, NOT a column → add to advisor_turns)
  "model": {
    "selected_role": "finance_high_stakes",
    "model_id": "gemini-2.5-flash",
    "provider": "google_aistudio",
    "fell_back": false,
    "retries": 0,
  },

  // Q7 — deterministic tools  (EXISTS per-tool; uniform array = PARTIAL)
  "tools_used": [
    { "tool": "advisor_validator.validate", "result": "accepted", "reason": null, "repairs": [] },
    {
      "tool": "advisor_math.verify_derivations",
      "kept_derivations": [
        { "label": "annual match", "expression": "120000*0.03", "value": "3600" },
      ],
    },
    { "tool": "recommendations_os.rank", "priority_score": 1.26 },
  ],

  // cost / latency  (EXISTS on advisor_turns)
  "tokens": { "prompt": 0, "completion": 0, "total": 0 },
  "latency_ms": 0,
  "stages_ms": { "context_build": 0, "llm_generate": 0, "validate": 0, "compose": 0 },
}
```

**Field-by-field status:** `reason`, `priority_reason`, `evidence`, `assumptions` (labels),
`confidence`, `ranking_formula`, `tokens`, `latency_ms`, `stages_ms`, `graph_edges_available`,
`validator_result`/`repairs`, `kept_derivations` = **EXISTS**. `model` block, per-data
`document_id`/`field_path`, graph node/edge ids, uniform `asserted_by`, and the single bound
record = **PARTIAL/NEW** (the data is logged or derivable; it is not yet one durable, queryable
record per output).

---

## 10. The build path (smallest steps, highest leverage)

1. **NEW — add `model_id`, `provider`, `selected_role`, `model_fell_back` columns to
   `analytics.advisor_turns`** and write them from `tr["routing"]` (today dropped by PostgREST,
   `advisor_orchestrator.py:414`). This makes Q6 auditable with one migration + one row change.
   _Highest leverage: turns "which model said this" from a log grep into a queryable fact._
2. **PARTIAL→EXISTS — emit a `tools_used[]` array** by gathering the already-computed
   `validator_result`, `kept_derivs`, and `formula` into one list at compose time.
3. **NEW — bind ids:** carry `documents.id` into `evidence[]` and graph node/edge uuids into
   `relationships_referenced`. The labels already flow; add the ids alongside.
4. **NEW — the unified `provenance` record:** a view (or table) over `advisor_turns` +
   `recommendations` + life-graph workspace keyed by `output_id`. No new generation logic — pure
   binding of pieces that already exist.

Each step is additive and preserves the existing gates verbatim. None of them weakens the
fabrication guarantee — they make the _record_ of that guarantee complete and auditable.

---

## 11. Why this is fiduciary-grade

- **Deterministic, not probabilistic.** The number gate, math verifier, and evidence rule are
  pure functions over the user's data — reproducible and explainable, not an LLM judging itself.
- **Model-agnostic.** Swapping or routing models (`model_router`) cannot introduce fabrication;
  the gate is downstream of the model. Proven against Claude (3 → 0).
- **Refusal over invention.** Missing data yields a `DEPENDENCY` recommendation
  ("upload your 401(k)") or a rejected turn → deterministic fallback — never a guessed number.
- **Persistence is never the LLM's.** `validate()` forces `should_persist = False`
  (`advisor_validator.py:201`); only deterministic code writes to the DB.

Provenance is the product. The model is interchangeable; the auditable trace is the moat.
