# CROSS-DOMAIN DECISION ENGINE ARCHITECTURE

How per-domain recommendations combine into one ranked, conflict-resolved set of life
decisions. Builds on the typed cross-domain edges in `CROSS_DOMAIN_DECISION_ONTOLOGY.md` and
the recommendation evidence graph. Design only.

## Inputs

Each domain emits persisted, graph-backed recommendations (RECOMMENDATION_FRAMEWORK): a
`:DomainRecommendation` with `confidence`, `priority`, `affected_domains`, evidence,
assumptions, tradeoffs, and a governance boundary. The decision engine reads **these graph
objects**, never raw model text.

## Cross-domain influence chains (the reasoning the engine traverses)

```
Health ──▶ Career productivity ──▶ Income ──▶ Financial goals ──▶ Stress reduction ──▶ Health
Health ──▶ Retirement probability         (e.g. healthspan affects the planning horizon)
Career ──▶ Income ──▶ CashFlow ──▶ Emergency-fund / debt-payoff feasibility
```

Encoded as typed edges (`IMPROVES_COMPENSATION`, `AFFECTS_CASHFLOW`, `IMPACTS`, `SUPPORTS_GOAL`,
`EVALUATES`, `PROJECTS`). The engine walks them to find recommendations whose effects propagate
across domains.

## Pipeline

```
1. Collect    all active :DomainRecommendation nodes for the user (tenant-scoped).
2. Aggregate  evidence: merge overlapping evidence/assumptions; weight by confidence + freshness.
3. Link       to cross-domain edges: compute each rec's reach (distinct affected_domains via traversal).
4. Score      leverage = f(reach, confidence, goal_priority, evidence_strength, governance_risk).
5. Arbitrate  priority + resolve conflicts (below).
6. Rank       → top life decisions, each with its evidence subgraph + tradeoffs + boundaries.
```

## Priority arbitration

A total order from, in precedence:

1. **Safety first** — any rec with `requires_human_review` / `MedicalBoundary` escalation is
   surfaced as a referral, never down-ranked away.
2. **Goal priority** — recs addressing `high` user goals outrank `medium`/`low`.
3. **Leverage (reach)** — recs whose `affected_domains` (via edges) span more domains rank
   higher (a single action improving health + career + finance beats a single-domain action).
4. **Confidence × evidence strength** — well-grounded recs outrank thin ones.
5. **Effort/impact** — from `action_steps`/`tradeoffs`, low-effort/high-impact first.

## Conflict resolution

Two recs **conflict** when their `tradeoffs`/`action_steps` push opposite directions on a shared
resource (time, cash, attention) or a shared node.

- **Detect:** opposing `Tradeoff.option_a/b` on the same `affected_domains`, or both editing the
  same goal/budget node.
- **Resolve:** prefer the higher-leverage, higher-confidence rec; **down-rank, never delete** the
  other; emit an explicit `:Tradeoff` linking them so the chat can explain the choice ("we
  prioritized X over Y because …"). Safety/medical recs are never overridden by optimization.

## Recommendation ranking (leverage score)

```
leverage = w1·reach_norm + w2·confidence + w3·goal_priority + w4·evidence_strength − w5·governance_risk
```

- `reach_norm` = distinct affected domains / total domains (graph traversal).
- `evidence_strength` = mean evidence confidence × freshness factor.
- `governance_risk` = penalty if the rec needs human review (keeps risky advice from topping the
  list without escalation).
  Weights are config (tunable), not code.

## Confidence scoring

Per rec: `min(evidence confidences) · assumption_discount · freshness`. Assumptions with
`user_confirmed=false` and short `expires_at` discount more. Cross-domain chains multiply the
confidences along the edge path (a long inference chain is less certain — surfaced honestly).

## Evidence aggregation

When multiple recs cite the same fact (e.g. cash flow appears in finance + the career→income
chain), the engine **dedups by (metric_name, source_table, source_entity_id)** and keeps the
highest-confidence instance, so the user sees one grounded number, not duplicates.

## Output (what the user/chat gets)

A ranked list of **life decisions**, each carrying its source `:DomainRecommendation` subgraph
(evidence + assumptions + tradeoffs + boundary) so every ranking is explainable and every number
traces to a fact — answering "what is the highest-leverage action across my life right now?" from
the graph, never invented.

## Boundaries

The engine never crosses a domain's governance: a finance rec stays financial-planning-bounded; a
health rec stays wellness-bounded with its `MedicalBoundary`. Cross-domain ranking can elevate a
health rec's importance but never strips its disclaimer/escalation.
