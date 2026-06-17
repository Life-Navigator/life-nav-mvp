# LIOS Conflict Resolution Model (Stage [6])

> **Design/spec only.** No code, no Gemini wiring, no runtime, no Vertex, no beta change. This is the
> Stage [6] (Conflict Resolution) contract a future orchestration layer will implement.
> Derived from `docs/lios-agent-specifications/GOAL_CONFLICT_AGENT.md`,
> `docs/lios-agent-specifications/DECISION_SCIENTIST_AGENT.md`,
> `docs/lios-agent-specifications/GRAPHRAG_AGENT.md`,
> `docs/lios-agent-specifications/AGENT_CONFIDENCE_MODEL.md`, `RELATIONSHIP_LIFECYCLE.md`,
> `ORCHESTRATION_ENGINE.md`, `EXECUTION_ARCHITECTURE.md`, `CONFIDENCE_PROPAGATION_MODEL.md`.

When Finance says yes, Family says no, and Career says maybe, LIOS does **not** pick a winner. It
**models** the tension as a **framed tradeoff** and surfaces both sides' evidence. The system models;
**it never decides** (Decision Scientist's cardinal rule; Goal Conflict "detects and cites, never
resolves"). Cross-domain links require a **cited edge** (citation contract).

---

## 1. Principle: surface tradeoffs, never verdicts

Stage [6] runs after all domain agents (it needs every domain output — `ORCHESTRATION_ENGINE.md` §5). It
reconciles disagreeing agents into a **reconciled view of framed tradeoffs**, not an answer. Conflict
_resolution_ in LIOS means making the tension legible (what each side costs/protects, with evidence),
not choosing for the user. Resolution-as-advice is **always escalated** to the Decision pipeline; this
stage never says "you should."

```
 Finance(yes)   Family(no)   Career(maybe)   Decision Scientist(tradeoffs)
      └──────────────┴──────────────┴──────────────────┘
                              ▼
                  [6] Conflict Resolution
        ┌───────────────┬───────────────┬───────────────┐
     DETECT          SURFACE          RANK          DOWN-WEIGHT
  contradicting   as framed       impact ×        conflict lowers
  findings;       tradeoffs       confidence ×    confidence;
  cross-domain    (both sides'    safety-level    unresolved ⇒
  via CITED edge  evidence) —     touched         open tradeoff
  only            NOT a verdict                   w/ both evidences
        └───────────────┴───────────────┴───────────────┘
                              ▼
            reconciled view → Recommendation? → Critic? → Compliance
              (the system models the tradeoff; the user decides)
```

---

## 2. DETECTION — how conflicts are found

A conflict is **two findings that contradict**. Detection is deterministic over the agent envelopes:

- **Same-target contradiction.** Two agents make opposite-signed claims about the same entity/option
  (Finance: "affordable"; Family: "displaces the dependent-care goal").
- **Goal-to-goal tension.** The **Goal Conflict Agent** detects tensions between the user's _confirmed_
  goals (e.g. liquidity vs. down-payment). Each such conflict **must cite a real graph edge** (its
  `_check_relationships` gate). No edge ⇒ the pair is dropped, no conflict claimed (GOAL_CONFLICT §3, §8).
- **Cross-domain tradeoff.** The **Decision Scientist** maps which domains a decision touches; a
  cross-domain conflict link ("housing choice hurts retirement") is only valid with a **cited edge**
  (DECISION_SCIENTIST §8, citation contract). No edge ⇒ the cross-domain conflict is not asserted.

> Citation gate (load-bearing): a _within-domain_ contradiction (two findings about the same option) can be
> detected from the envelopes directly. A _cross-domain_ conflict between the user's own goals/entities is a
> relationship claim and requires a **cited real edge** — `RELATIONSHIP_LIFECYCLE.md` §1. No edge ⇒ no
> cross-domain conflict claim (drop it; reason single-domain).

---

## 3. SURFACING — as framed tradeoffs, not a verdict

Each detected conflict becomes a **tradeoff object** (shape from GOAL_CONFLICT §5), never a recommendation:

```
{ "between": ["option/goal A", "option/goal B"],
  "costs":    "what choosing A costs (cited)",
  "protects": "what choosing A protects (cited)",
  "evidence_A": [{ "statement": "", "source_table": "" }],   # both sides carry their evidence
  "evidence_B": [{ "statement": "", "source_table": "" }],
  "cited_edge": { "from": "", "to": "", "rel": "", "edge_confidence": 0.0 },  # required if cross-domain
  "clarifying_question": "the tradeoff posed to the user — never a resolution" }
```

The output is a **clarifying question + both sides' evidence**, not a chosen side. If "how do I resolve
this?" is asked, it **escalates** to Decision Scientist → Scenario → Tradeoff (resolution is advice, owned
downstream, gated by Compliance). Stage [6] itself emits no "you should."

---

## 4. RANKING — impact × confidence × safety level

When several conflicts exist, they are ranked deterministically (no LLM ordering):

```
rank_score = impact · confidence · safety_weight(level_touched)
```

- **impact** — how much the conflict moves the user's outcome (magnitude of what's at stake).
- **confidence** — the conflict's own confidence (Goal Conflict is graph-dominant: 0.40·GC + 0.25·EC +
  0.20·PQ + 0.15·DC — a weak/absent edge drops the pair, never a forced `success`). A conflict resting on a
  low `edge_confidence` ranks lower because its confidence is lower.
- **safety_weight(level)** — conflicts touching a higher level of the safety hierarchy rank above purely
  financial-optimization tensions. Safety/health/legal-exposure tensions outrank convenience tradeoffs.

Highest rank_score surfaces first. Ranking math is deterministic (`EXECUTION_ARCHITECTURE.md` §4: "conflict
ranking math" is a rules engine, not the LLM).

---

## 5. CONFIDENCE under conflict — down-weighted, never hidden

Conflict **lowers** confidence (`CONFIDENCE_PROPAGATION_MODEL.md` §6):

- combined response confidence is multiplied by `(1 − κ)`, κ ∝ conflict severity (impact × how directly
  the findings contradict).
- an **unresolved** conflict is **not** silently resolved to a number — it is **presented as an open
  tradeoff** carrying **both sides' evidence** at the down-weighted confidence. If that drops below the
  response floor (0.5), the response is framed as "here's the tradeoff and what would tip it," not an
  assertion.
- the down-weighted confidence still carries components + explanation (the explanation names the conflict).

---

## 6. Worked example — "Should I move to Texas, change jobs, and buy a house?"

Three coupled decisions; three domains disagree.

```
 FINANCE  → "yes": TX no state income tax + lower cost of living improves cash flow.
            evidence: income, cost-of-living delta (on_record).  conf 0.88
 FAMILY   → "no":  the move displaces the confirmed dependent-care / schooling goal.
            evidence: family member + care goal (user_confirmed). conf 0.82
            cited edge: move_goal --competes_for_resource--> care_goal (edge_conf 0.80)
 CAREER   → "maybe": the new job raises comp but the role is less stable (runway risk).
            evidence: offer terms (user_stated).               conf 0.71  (< 0.75 → not a success claim)
 DECISION SCIENTIST → frames it: options {do all three, stage them, status-quo};
            cross-domain link housing↔runway is asserted ONLY because a cited edge exists.
```

Stage [6] output (framed, never a verdict):

```
 RANKED TRADEOFFS
  1) [safety: family stability]  Move vs. dependent-care goal
        cited edge: move_goal ↔ care_goal (competes_for_resource, edge_conf 0.80)
        costs:   relocating disrupts the confirmed care/schooling plan
        protects: cash-flow improvement from the move
        Q: "Which matters more right now — the care plan continuity or the cash-flow gain?"
  2) [finance × career]  New job upside vs. stability/runway
        cited edge required for housing↔runway link; present ⇒ surfaced
        costs:   less stable role; buying a house thins runway
        protects: higher comp; lower TX cost of living
        Q: "How much runway do you want to keep if the role doesn't work out?"

 No verdict. The car of three decisions is staged, not chosen.
 Final response confidence: base (weighted-mean of contributors) × (1 − κ).
   conjunctive "do all three at once" claim ⇒ min(0.88, 0.82, 0.71, 0.72_frame) = 0.71,
   conflict penalty κ≈0.3 ⇒ ≈0.50 → at/near floor ⇒ presented as open tradeoffs, not an assertion.
   Critic invoked (cross-domain, high-stakes, <0.85).
```

If the Family↔move edge did **not** exist, that cross-domain conflict could **not** be claimed — Stage [6]
would surface only the within-domain finance/career tension and reason single-domain on family (citation
contract). Resolution ("do X") is never produced here; "how do I decide?" escalates to the Decision
pipeline.

---

## 7. Stage [6] contract (inputs / outputs / confidence / failure / observability)

| Field             | Contract                                                                                                                                                                                                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Inputs**        | all domain-agent envelopes (status + confidence + payload); Goal Conflict's cited conflicts; Decision Scientist's frame + cited cross-domain edges; GraphRAG `connected_pairs` (read-only) for citation                                                                                      |
| **Outputs**       | a reconciled view = ranked **framed tradeoffs** (between / costs / protects / both-sides evidence / cited_edge / clarifying_question). No verdict, no "you should", no chosen option                                                                                                         |
| **Confidence**    | aggregated and **down-weighted on conflict** `(1 − κ)`; carries components + explanation. Goal-conflict confidence is graph-dominant (edge_confidence drives it). An unresolved conflict is surfaced at the lowered confidence, both sides' evidence attached                                |
| **Failure**       | unresolvable conflict → **surface as an open tradeoff (not an error)** (`EXECUTION_ARCHITECTURE.md` stage table); missing cited edge for a cross-domain conflict → drop that conflict claim, reason single-domain; "resolve it for me" → escalate to Decision Scientist (never resolve here) |
| **Observability** | emits `conflict` event with the ranked tradeoffs, their cited edges, and the κ down-weight applied                                                                                                                                                                                           |

---

## 8. Invariants

1. The system **models** tensions; it **never decides** — Stage [6] outputs framed tradeoffs, not verdicts.
2. A cross-domain / goal-to-goal conflict requires a **cited real edge** (citation contract); no edge ⇒ no
   cross-domain conflict claim (reason single-domain).
3. Every surfaced tradeoff carries **both sides' evidence** with provenance.
4. Conflicts rank by impact × confidence × safety-level touched (deterministic math).
5. Conflict **down-weights** confidence; an unresolved conflict ⇒ open tradeoff at the lowered confidence.
6. Resolution-as-advice is **always escalated** to the Decision pipeline (Compliance-gated); never produced
   in Stage [6].
7. No agent calls another directly; Stage [6] consumes envelopes the Orchestrator routed (DAG, hop-bounded).
