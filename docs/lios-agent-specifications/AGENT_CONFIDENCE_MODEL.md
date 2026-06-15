# LIOS — Agent Confidence Model (global)

> The single, explicit formula every LIOS agent uses to compute confidence. **Confidence is never vibes.**
> Specification only — no code, no prompts, no runtime. Referenced by every agent spec.

Every agent that returns a result must attach a `confidence` object with a **score in [0,1]** AND the
**component breakdown** that produced it. A score without its breakdown is invalid and must be rejected by
Compliance.

---

## 1. The five components (each in [0,1])

| Component              | Symbol | Definition                                                                                  |
| ---------------------- | ------ | ------------------------------------------------------------------------------------------- |
| **Data completeness**  | DC     | fraction of the inputs this agent _requires_ that are present and fresh                     |
| **Evidence coverage**  | EC     | fraction of the agent's claims that are backed by evidence/citation                         |
| **Tool availability**  | TA     | required deterministic tools were available **and** returned a result (1 if no tool needed) |
| **Graph confidence**   | GC     | mean confidence of the cited graph edges (1 if no graph claim is made)                      |
| **Provenance quality** | PQ     | provenance-weighted quality of the facts used (see ladder below)                            |

### Provenance quality ladder (PQ weight per fact, then averaged over facts used)

| Provenance               | Weight |
| ------------------------ | ------ |
| `user_confirmed`         | 1.00   |
| `user_stated`            | 0.90   |
| `on_record` / `document` | 0.85   |
| `calculated`             | 0.85   |
| `suggested`              | 0.55   |
| `inferred`               | 0.45   |
| `assumed`                | 0.40   |
| `advisor_inferred`       | 0.20   |

`PQ = mean(weight(provenance(fact)) for fact in facts_used)`; `PQ = 1` if the result uses no user facts
(pure deterministic computation with a trace).

---

## 2. The formula

```
confidence = wDC·DC + wEC·EC + wTA·TA + wGC·GC + wPQ·PQ
```

**Default weights** (each agent spec may override and MUST state its weights):

| Weight | Default |
| ------ | ------- |
| wDC    | 0.25    |
| wEC    | 0.25    |
| wPQ    | 0.20    |
| wTA    | 0.15    |
| wGC    | 0.15    |

Weights sum to 1.0.

### N/A components → renormalize

If a component does not apply to an agent (e.g. a conversational agent uses no tools → TA N/A; an agent
makes no graph claim → GC N/A), **drop that component and renormalize the remaining weights to sum to 1.0**.
The breakdown must mark dropped components as `"n/a"` (not 0 — a 0 would unfairly penalize).

Example (Advisor, no tools, no graph claim this turn): components = DC, EC, PQ with renormalized weights
0.357 / 0.357 / 0.286.

---

## 3. Confidence → outcome bands

| Band   | confidence  | Outcome (see `AGENT_FAILURE_BEHAVIOR.md`) |
| ------ | ----------- | ----------------------------------------- |
| High   | ≥ 0.75      | `success`                                 |
| Medium | 0.40 – 0.75 | `needs_data` or `needs_confirmation`      |
| Low    | < 0.40      | `blocked` or `escalated`                  |

An agent may **not** return `success` below 0.75.

---

## 4. The confidence object (required shape)

```json
{
  "score": 0.0,
  "band": "high|medium|low",
  "components": {
    "data_completeness": 0.0,
    "evidence_coverage": 0.0,
    "tool_availability": 0.0,
    "graph_confidence": 0.0,
    "provenance_quality": 0.0
  },
  "weights": { "wDC": 0.25, "wEC": 0.25, "wPQ": 0.2, "wTA": 0.15, "wGC": 0.15 },
  "na_components": [],
  "explanation": "one line: which components dragged the score and why"
}
```

> Rule: **no confidence score without its components + explanation.** This is what makes confidence
> auditable and lets the Critic/Orchestrator down-weight specific weak inputs.

---

## 5. Worked examples

**Finance Agent, data-rich user (Plaid + a 401k doc):**
DC 0.9, EC 0.9 (recs cited), TA 1.0 (calculators ran), GC `n/a` (no graph claim), PQ 0.86 (mostly on_record).
Renormalize over DC,EC,TA,PQ → confidence ≈ 0.91 → `success`.

**Finance Agent, fresh user (no data):**
DC 0.1, EC 0.0, TA `n/a`, GC `n/a`, PQ `n/a` → confidence ≈ 0.05 over DC,EC → `needs_data` (returns the
ranked missing financial inputs).

**Advisor turn citing a relationship:**
DC 0.7, EC 0.8, PQ 0.9, GC 0.8 (one cited edge, conf 0.8), TA n/a → confidence ≈ 0.79 → `success`.
If the edge didn't exist, the claim is dropped by Compliance → GC removed, but more importantly the relation
claim is rejected (see citation contract).

---

## 6. Invariants

1. Confidence ∈ [0,1], always with components + weights + explanation.
2. No `success` below 0.75.
3. PQ uses the provenance ladder; `advisor_inferred` is the weakest and can never alone justify a high score.
4. EC near 0 with claims present ⇒ the agent must not assert those claims (evidence-or-nothing).
5. GC only counts when a graph claim is actually made; otherwise N/A (not 0).
6. Deterministic computations (Tool Execution) report exact results; their "confidence" reflects input
   quality, not the math.
