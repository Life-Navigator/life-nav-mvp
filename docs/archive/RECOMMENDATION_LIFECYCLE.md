# LIOS — Recommendation Lifecycle

> The complete lifecycle of a **recommendation** in LifeNavigator: generation, evidence, ranking, surfacing,
> user action, outcome/feedback, and expiry. Validation review against the LIOS architecture. Architecture
> review only — no code, no prompts.

A "recommendation" is the single durable unit of guidance. Risks and opportunities are recommendation
subtypes (`rec_type` RISK/OPPORTUNITY) and share this lifecycle; see `RISK_LIFECYCLE.md` for risk specifics.
`rec_type` ∈ {ACTION, RISK, OPPORTUNITY, DEPENDENCY, INFORMATION}.

---

## 1. The generation contract (live, enforced)

`RecommendationOS.write` is the **single write path** and enforces:

- **No recommendation without evidence.** Empty `evidence` ⇒ returns null, nothing persisted. This is the
  core anti-fabrication rule for guidance.
- Every row carries: `source_module` (which engine produced it), `rec_type`, `confidence`,
  `evidence` (`[{statement, source_table}]`), `assumptions` (`[{label, value}]`), `impacted_domains`,
  `rank_score`, `narrative` (current / target / delta / why), `created_at` / `updated_at`.
- Because the dashboard sources risks/opps from this engine only, a surfaced item is — by construction —
  evidence-backed.

> The recommendation is where LLM and determinism meet correctly: an LLM may help _phrase_ a recommendation's
> narrative (gated), but the recommendation only **exists** because a deterministic engine produced it from
> evidence. The LLM cannot create a recommendation.

---

## 2. States

| State           | Meaning                                                | Visible?           |
| --------------- | ------------------------------------------------------ | ------------------ |
| `generated`     | an engine produced a candidate                         | no                 |
| `evidenced`     | has ≥1 evidence statement (else dropped)               | eligible           |
| `ranked`        | scored + ordered (`rank_score`)                        | eligible           |
| `surfaced`      | shown (dashboard / next-best-action / advisor context) | yes                |
| `viewed`        | user has seen it                                       | yes                |
| `accepted`      | user adopts it (e.g. converts to a goal/action)        | yes                |
| `in_progress`   | linked action underway                                 | yes                |
| `completed`     | the action was taken; delta realized                   | yes (history)      |
| `dismissed`     | user declined                                          | hidden (tombstone) |
| `superseded`    | a better/updated rec replaces it                       | history            |
| `expired/stale` | evidence/inputs aged                                   | re-generate        |

---

## 3. State transitions

```
 engine ─▶ generated ─(evidence?)─▶ evidenced ─▶ ranked ─▶ surfaced ─▶ viewed ─▶ accepted ─▶ in_progress ─▶ completed
              │ none                                          │           │ dismiss        (linked goal/action/doc)      │
              ▼                                               │           ▼                                              │ outcome
           DROPPED                                            │       dismissed                                          ▼
        (no rec w/o evidence)                                 │      (tombstone)                                     feedback/learning
                                                              │ inputs change
                                                              ▼
                                                          superseded / stale ──re-generate──▶ generated
```

| Transition                               | Trigger                | Owning agent                            | Guard                                                        |
| ---------------------------------------- | ---------------------- | --------------------------------------- | ------------------------------------------------------------ |
| → `generated`                            | engine pass            | Domain agent · Decision Intelligence    | a candidate from real data                                   |
| `generated` → `evidenced`                | attach evidence        | **RecommendationOS**                    | **≥1 evidence w/ source_table (else DROP)**                  |
| `evidenced` → `ranked`                   | scoring                | RecommendationOS                        | deterministic `rank_score`                                   |
| `ranked` → `surfaced`                    | render                 | Life Model / Next-Best-Action / Advisor | not generic; passes display gate; domain disclaimer attached |
| `surfaced` → `accepted`                  | user adopts            | RelationshipManager (goal) / domain     | explicit user action                                         |
| `accepted` → `in_progress` → `completed` | linked work proceeds   | domain writers                          | a real linked entity                                         |
| `surfaced` → `dismissed`                 | user declines          | domain writer                           | tombstone                                                    |
| any → `superseded`/`stale`               | inputs/evidence change | RecommendationOS re-gen                 | new evidence or freshness elapsed                            |

**Invariant:** `generated → evidenced` is the chokepoint; everything visible is evidence-backed. The LLM
never advances a recommendation through these states.

---

## 4. Ranking & prioritization

- `rank_score` is deterministic (impact × confidence × urgency, normalized), so ordering is explainable.
- The **Next Best Action** is the single highest-ranked, currently-actionable recommendation — surfaced on
  the dashboard and offered by the advisor/activation flow. When nothing qualifies, the honest state is
  `insufficient` (no fabricated "do this").
- Conflicts between recommendations (e.g. "pay down debt" vs "invest") are surfaced as a framed tradeoff,
  not silently ordered — see `DECISION_LIFECYCLE.md`.

---

## 5. The advice boundary applies

A recommendation is **guidance with evidence and provenance**, not a directive. It is rendered with its
basis (evidence + assumptions + confidence) and the domain disclaimer (finance: not financial advice;
family/estate: not legal advice; health: never clinical). The advisor may _reference_ a surfaced
recommendation but must not restate it as "you should" in a way that crosses the advice boundary; final
"do exactly this" remains the user's decision, informed by the modeled basis.

---

## 6. Feedback & learning

- `accepted` / `dismissed` / `completed` are the feedback signals: which recommendations users adopt, which
  they reject, and which produce the projected delta.
- This closes the loop: dismissals suppress re-surfacing; completion records the realized outcome; adoption
  rates become a quality metric for each `source_module`.
- Learning never bypasses the contract: a "learned" recommendation still needs evidence to be shown.

---

## 7. Observability

- Generation telemetry: candidates generated vs. dropped-for-no-evidence (proves no fabrication).
- Each surfaced rec is fully traceable: source_module, evidence, assumptions, confidence, rank, provenance.
- Adoption/dismissal/completion tracked per rec and aggregated per module.

---

## 8. Invariants (recommendation-specific)

1. No recommendation without evidence (the core guard).
2. The LLM may phrase a narrative (gated) but never _create_ a recommendation.
3. Every recommendation carries evidence + assumptions + confidence + impacted_domains + provenance.
4. Recommendations never auto-become goals; adoption is an explicit user action.
5. Ordering (`rank_score`) is deterministic and explainable.
6. Dismissed recs are not re-surfaced without materially new evidence.
7. Domain disclaimers travel with the recommendation.

---

## 9. Failure / escalation

| Failure                        | Handling                                                                  |
| ------------------------------ | ------------------------------------------------------------------------- |
| Candidate with no evidence     | dropped                                                                   |
| No qualifying next-best-action | honest `insufficient` state                                               |
| Conflicting recs               | surface as a framed tradeoff (Decision Intelligence), don't silently pick |
| Stale inputs                   | re-generate; flag staleness                                               |

---

## 10. Validation review

| Requirement                                             | Today                                                         | Verdict / gap                                                                             |
| ------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| No rec without evidence                                 | live (RecommendationOS)                                       | ✅ holds                                                                                  |
| Evidence + assumptions + confidence + narrative         | live                                                          | ✅ holds (expert-grade structure)                                                         |
| Deterministic ranking                                   | live (`rank_score`)                                           | ✅ holds                                                                                  |
| Next-best-action + honest insufficient                  | live (my_life)                                                | ✅ holds                                                                                  |
| Explicit `missing_inputs` per rec                       | partial (implicit via unlocked_capabilities + conversational) | ⚠️ **gap: a first-class `missing_inputs` field**                                          |
| Adoption/dismissal/completion feedback loop             | partial                                                       | ⚠️ **gap: a formal feedback/outcome lifecycle + per-module adoption metrics**             |
| Coverage (how many high-value recs for data-rich users) | unmeasured                                                    | ⚠️ **gap: data-rich eval personas to measure coverage, not just empty-state correctness** |
| Which recs the advisor referenced per turn              | partial                                                       | ⚠️ **gap: persist rec references on the turn (observability)**                            |

**Open questions:**

1. Should `missing_inputs` be the bridge that turns a low-confidence rec into the advisor's next question?
2. How is "completion delta realized vs. projected" measured and fed back into confidence?
3. What's the re-generation cadence — on data change, on a schedule, or both?

---

## 11. Live vs planned

- **Live:** evidence-or-nothing; full rec structure; deterministic ranking; next-best-action; honest empties.
- **Planned:** first-class `missing_inputs`; the adoption/dismissal/completion feedback loop + per-module
  metrics; data-rich coverage eval; per-turn rec-reference logging.
