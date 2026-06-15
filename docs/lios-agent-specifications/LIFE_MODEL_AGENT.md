# Life Model Agent — Specification

> Agent specification (15-section template). Specification only — no code, no prompts, no runtime. Inherits
> the shared contracts: `AGENT_FAILURE_BEHAVIOR.md`, `AGENT_CONFIDENCE_MODEL.md`, `AGENT_ESCALATION_MODEL.md`,
> `AGENT_INTERACTION_CONTRACTS.md`, `AGENT_OUTPUT_SCHEMAS.md`. **Deterministic, LIVE** — maps to
> `app/services/my_life.py` (MyLifeService) + the `life_discovery.snapshot`.

---

## 1. Identity

- **Agent Name:** Life Model Agent
- **Mission:** Hold the single, honest answer to "who is this user and where do they stand?" — aggregated
  across the six domains, every element carrying its provenance.
- **Purpose:** Be the canonical aggregator of the life picture (vision, what-matters-most, life readiness,
  constraints, next best action, recent intelligence). It composes facts/recs/risks that other agents own; it
  never mints them.
- **Primary Responsibilities:**
  1. Aggregate the user's vision and what-matters-most from confirmed discovery facts.
  2. Compute life readiness across the six domains from domain summaries (deterministically).
  3. Surface active constraints and the single next best action — each with provenance.
  4. Collect recent intelligence (risks/opps already minted by the Recommendation engine).
  5. Report `has_discovery` and confidence reflecting per-element provenance/coverage.

---

## 2. Ownership

**Owns:**

- the canonical aggregation of the life picture across the six domains
- vision (value + provenance), what-matters-most, life readiness, constraints, next best action
- recent intelligence as an aggregated read of already-minted risks/opps
- the `has_discovery` state and the per-element provenance bundle

**Does NOT own:**

- creating facts, recommendations, or risks (it aggregates them — facts come from Memory, risks/opps from the
  Recommendation engine)
- persistence (→ approved writers via Tool Execution)
- user-facing text (→ Response Composer)
- compliance decisions (→ Compliance)
- cross-domain decisions/tradeoffs (→ Decision Scientist)
- the north-star/vision _wording_ as advice — it surfaces the user's own confirmed vision only

---

## 3. Boundaries (prohibited)

- Cannot invent a north-star, vision, risk, opportunity, or percentage — every element is an aggregate of an
  owned source or an honest empty state.
- Cannot persist data.
- Cannot answer the user directly.
- Cannot ground risks/opps from anything except the Recommendation engine (evidence-or-nothing).
- Cannot emit archetype/template/generic-label content — must pass the `GENERIC_RISK_OPP_LABELS` gate and drop
  any element that matches a generic label.
- Cannot guess a readiness percentage when domain data is absent — surfaces "insufficient" / "not started".
- Cannot create graph edges or infer relationships; cannot bypass Compliance.

---

## 4. Inputs (allowed sources)

- Discovery snapshot (`life_discovery.snapshot`) — confirmed vision / what-matters-most, with provenance.
- The six domain summaries (Finance/Family/Career/Education/Health) — each domain agent's `state` + freshness.
- The Recommendation engine output — already-minted, evidence-backed risks/opps (recent intelligence).
- Memory — confirmed user facts + their provenance (read).
- The `has_discovery` flag / discovery coverage signal.

---

## 5. Outputs (schema)

Wrapped in the common envelope (`AGENT_OUTPUT_SCHEMAS.md`); the Life Model `payload`:

```json
{
  "vision": {
    "value": null,
    "provenance": { "provenance_type": "", "source": "", "confidence": 0.0 }
  },
  "what_matters_most": [
    {
      "label": "",
      "rank": 1,
      "provenance": { "provenance_type": "", "source": "", "confidence": 0.0 }
    }
  ],
  "life_readiness": {
    "overall": null,
    "by_domain": {
      "finance": {
        "state": "ready|in_progress|not_started|insufficient",
        "value": null,
        "provenance": {}
      },
      "family": {},
      "career": {},
      "education": {},
      "health": {}
    }
  },
  "constraints": [{ "label": "", "provenance": { "provenance_type": "", "source": "" } }],
  "next_best_action": { "label": null, "source_rec_ref": "", "provenance": {} },
  "recent_intelligence": [
    {
      "kind": "risk|opportunity",
      "title": "",
      "evidence": [],
      "source": "recommendation_engine",
      "provenance": {}
    }
  ],
  "has_discovery": false,
  "confidence": 0.0
}
```

Every element is either an aggregate carrying its source's provenance or `null`/"insufficient". No invented
vision, label, or percentage; no risk/opp not already minted by the Recommendation engine.

---

## 6. Cognitive Framework (how it reasons)

```
Step 1  Read discovery snapshot     — pull confirmed vision + what-matters-most; set has_discovery.
Step 2  Gate generic content        — drop any element matching GENERIC_RISK_OPP_LABELS / archetype text.
Step 3  Aggregate domain summaries  — collect each domain's state + freshness (read, not recompute).
Step 4  Compute life readiness      — deterministic roll-up; absent domain → "not_started"/"insufficient".
Step 5  Surface constraints         — from confirmed facts only, each with provenance.
Step 6  Select next best action     — the highest-ranked already-minted rec; never author one.
Step 7  Collect recent intelligence — already-minted risks/opps from the Recommendation engine only.
Step 8  Calculate confidence        — per AGENT_CONFIDENCE_MODEL.md; reflect per-element provenance/coverage.
Step 9  Return aggregate            — envelope; honest empty states; never advise/persist.
```

The agent **aggregates** deterministically; it never **authors** vision/risk/rec and never **decides**.

---

## 7. Tool Rules

- **Allowed:** the deterministic readiness roll-up (MyLifeService aggregation); reads of domain summaries and
  the discovery snapshot.
- **Required:** the `GENERIC_RISK_OPP_LABELS` gate on every surfaced label; provenance attached to every
  non-null element.
- **Forbidden:** direct database writes; minting facts/recs/risks; any generative authoring of vision/labels;
  recomputing domain numbers (it reads domain summaries, it does not re-derive them).

---

## 8. GraphRAG Rules

- **May:** read graph-sourced provenance for an aggregated element (to attach a citation that already exists).
- **May not:** create relationships; infer edges; persist edges; assert a cross-domain link without a cited
  real edge (citation contract) — relationship _claims_ belong to Goal Conflict / GraphRAG, not here.

---

## 9. Memory Rules

- **Can access:** confirmed user facts + their provenance, the discovery snapshot, and domain summaries — all
  read-only.
- **Cannot access:** another tenant's data; raw conversation memory beyond the bounded context Memory exposes;
  any private domain memory it does not aggregate.

---

## 10. Confidence Model

Uses the global formula (`AGENT_CONFIDENCE_MODEL.md`) with Life Model weights:

| Weight                   | Value            | Rationale                                                     |
| ------------------------ | ---------------- | ------------------------------------------------------------- |
| wDC (data completeness)  | 0.35             | the picture is only as whole as the domains/discovery present |
| wPQ (provenance quality) | 0.30             | every aggregated element must carry real provenance           |
| wEC (evidence coverage)  | 0.20             | recent-intelligence elements must be evidence-backed          |
| wTA (tool availability)  | 0.10             | the deterministic roll-up must have run                       |
| wGC (graph)              | 0.05 (often N/A) | the aggregate rarely makes a standalone graph claim           |

`confidence = 0.35·DC + 0.30·PQ + 0.20·EC + 0.10·TA + 0.05·GC` (renormalize if GC is N/A). No `success` below
0.75; a thin/no-discovery user → `needs_data` with `has_discovery:false`, never a guessed picture.

---

## 11. Escalation Rules (via Orchestrator)

| Trigger                                     | → To                              |
| ------------------------------------------- | --------------------------------- |
| No discovery yet (cold user)                | Onboarding (start discovery)      |
| Vision/goals expressed but uncaptured       | Goal Discovery                    |
| Surfaced goals appear to tension each other | Goal Conflict                     |
| A domain summary is missing/empty           | the owning Domain Agent (refresh) |
| Highest-value gap unclear                   | Missing Data                      |
| A cross-domain decision is implied          | Decision Scientist                |
| Needs facts/provenance/edges                | Memory / GraphRAG                 |

Escalation is ownership-driven; thin data alone → `needs_data`, not escalation.

---

## 12. Failure Behavior

Standard states (`AGENT_FAILURE_BEHAVIOR.md`):

- `success` — a confident, provenance-complete life picture (≥0.75).
- `needs_data` — discovery/domain inputs missing (ranked); `has_discovery:false` for a cold user.
- `needs_confirmation` — an aggregated element rests on a candidate fact awaiting user confirmation.
- `blocked` — the aggregation roll-up or a required summary read failed.
- `escalated` — work belongs to Onboarding/Goal/Decision/Domain agents.
- `compliance_rejected` — output carried generic/invented content and failed the gate.
  No guessing — absent domain data yields "insufficient"/"not_started", never a fabricated readiness %.

---

## 13. Compliance Requirements

- No invented vision, north-star, risk, opportunity, or percentage (allowed-numbers + evidence-or-nothing).
- No generic/archetype/template labels (GENERIC_RISK_OPP_LABELS gate).
- Risks/opps must originate from the Recommendation engine (it aggregates, never mints).
- Provenance required on every surfaced element.
- No persistence; no user-facing text; cross-domain claims require a cited real edge.

---

## 14. Example Scenarios

**Positive (5):**

1. Discovery + three domain summaries present → returns vision, ranked what-matters-most, readiness by domain,
   one next best action (cited rec) → `success`, conf ~0.88.
2. Two domains thin → readiness shows those as "insufficient", others scored → honest partial `success`.
3. A high-severity finance risk already minted → appears verbatim in `recent_intelligence` with its evidence.
4. User has confirmed vision but no recs yet → vision returned, `next_best_action:null` honestly.
5. Cold user, no discovery → `has_discovery:false`, ranked discovery gaps → `needs_data`.

**Negative (5) — must NOT happen:**

1. Inventing a north-star like "Achieve financial freedom" when discovery is empty (→ must `needs_data`).
2. Emitting a generic "Build an emergency fund" risk not minted by the Recommendation engine (→ reject).
3. Showing "Life readiness 72%" with no domain data behind it (→ "insufficient", reject the %).
4. Surfacing an archetype/template label (GENERIC_RISK_OPP_LABELS → dropped/reject).
5. Authoring "you should focus on career next" as a next best action (advice → Compliance reject).

**Edge cases (5):**

1. Domain summary stale → readiness element marked stale, still aggregated with caveat.
2. Vision rests on an unconfirmed candidate fact → `needs_confirmation`, don't show it as confirmed.
3. Recommendation engine returns nothing → empty `recent_intelligence` + null next action, honest.
4. Discovery snapshot present but partial → mixed picture; gaps ranked, not filled.
5. Two domains disagree on a constraint → surface both with provenance; do not reconcile (not its job).

---

## 15. Unit Test Matrix

| Class         | Test                                | Expected                                                             |
| ------------- | ----------------------------------- | -------------------------------------------------------------------- |
| Happy path    | discovery + domains present         | `success`, conf ≥0.75, every element carries provenance              |
| Missing data  | cold user, no discovery             | `needs_data`, `has_discovery:false`, ranked gaps; no invented vision |
| Missing data  | one domain empty                    | that domain "not_started"/"insufficient"; no guessed %               |
| Conflict      | candidate-fact-backed vision        | `needs_confirmation`; not shown as confirmed                         |
| Conflict      | cross-domain decision implied       | `escalated` to Decision Scientist; no resolution asserted            |
| Compliance    | generic/archetype label present     | `compliance_rejected` (GENERIC_RISK_OPP_LABELS)                      |
| Compliance    | risk not from Recommendation engine | dropped; `compliance_rejected` if asserted                           |
| Hallucination | no domain data                      | never emits a readiness %; "insufficient"                            |
| Hallucination | invented north-star                 | claim dropped; `compliance_rejected` if asserted                     |
| Confidence    | components present                  | confidence object has DC/PQ/EC/TA/GC (+ n/a) + explanation           |
