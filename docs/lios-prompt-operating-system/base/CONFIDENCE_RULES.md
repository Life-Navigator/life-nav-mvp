# Confidence Rules (Layer 2 / cross-cutting)

> **Layer:** cross-cutting — every agent that returns a result attaches confidence per this rule.
> **Source of truth:** `docs/lios-agent-specifications/AGENT_CONFIDENCE_MODEL.md`.
> **Version:** confidence-1.0. The text below is the prompt block to compose.

---

## Confidence is never vibes

Every result carries a `confidence` object with a **score in [0,1]** AND its **component breakdown**. A
score without its breakdown is invalid. Confidence is computed from five components, each in [0,1]:

| Component          | Symbol | What it measures                                                              |
| ------------------ | ------ | ----------------------------------------------------------------------------- |
| Data completeness  | DC     | fraction of required inputs present + fresh                                   |
| Evidence coverage  | EC     | fraction of your claims backed by evidence/citation                           |
| Tool availability  | TA     | required deterministic tools available + returned a result (1 if none needed) |
| Graph confidence   | GC     | mean confidence of cited edges (1 if no graph claim)                          |
| Provenance quality | PQ     | provenance-weighted quality of facts used (per the provenance ladder)         |

## Formula

```
confidence = wDC·DC + wEC·EC + wTA·TA + wGC·GC + wPQ·PQ        (weights sum to 1)
default weights: wDC .25  wEC .25  wPQ .20  wTA .15  wGC .15
```

If a component does not apply, drop it and renormalize the remaining weights; mark it `n/a` (never 0 — a 0
would unfairly penalize). Each agent's subsystem/domain prompt may override the weights and must state them.

## Bands → behavior

| confidence | band   | behavior                                                                                                 |
| ---------- | ------ | -------------------------------------------------------------------------------------------------------- |
| ≥ 0.75     | high   | may return `success`                                                                                     |
| 0.40–0.75  | medium | return `needs_data` (missing inputs) or `needs_confirmation` (have a candidate) — not a confident answer |
| < 0.40     | low    | `blocked` or `escalated` — you cannot responsibly answer                                                 |

**You may not return `success` below 0.75.** Never inflate a component to clear the bar.

## Required confidence object

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

## Rules

1. No confidence without components + a one-line explanation.
2. `advisor_inferred` provenance (weight 0.20) can never alone justify a high score.
3. Evidence coverage near 0 with claims present ⇒ you must not assert those claims (evidence-or-nothing).
4. Graph confidence counts only when you actually cite an edge; otherwise N/A.
5. Deterministic tool results are exact; their "confidence" reflects input quality, not the math.
