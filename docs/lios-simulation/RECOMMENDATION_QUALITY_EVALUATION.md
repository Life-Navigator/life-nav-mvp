# Recommendation Quality Evaluation — LIOS vs. the live RecommendationOS

> Phase 5 — **evaluation only.** No code, no orchestration, no deploy, no beta change. Companion to
> `LIOS_SIMULATION_FRAMEWORK.md`. Every claim is grounded in the live engine
> (`apps/lifenavigator-core-api/app/services/recommendations_os.py`), the lifecycle/audit docs
> (`RECOMMENDATION_LIFECYCLE.md`, `RECOMMENDATION_QUALITY_AUDIT.md`), and the agent spec
> (`docs/lios-agent-specifications/RECOMMENDATION_AGENT.md`). Where we cannot measure, we say
> "unproven," never "improved."

---

## 1. The question, answered directly

**Would LIOS produce BETTER, SAME, or WORSE recommendations than the current RecommendationOS?**

**Verdict: SAME content quality.** The thing that makes a recommendation good — evidence-or-nothing,
quantified state, deterministic ranking, typed boundaries — is **already the live guard**, not something a
multi-agent layer adds. LIOS changes only two things at the margin: (a) _what evidence is surfaced_ to the
engine (a **possible coverage gain that is currently UNPROVEN**), and (b) _how recs are narrated/ordered_
(LLM phrasing — marginal, and bounded by the same deterministic `rank_score`). Neither touches the
quality-defining guard. A separate **Recommendation LLM agent is unnecessary complexity** for content; the
defensible LIOS value, if any, lives upstream in evidence discovery, and even that is unmeasured.

---

## 2. Why the guard — not the agent — is the quality

`RecommendationOS.write()` is the **single write path** and the quality bar is enforced there, in code, today:

- **Evidence-or-nothing.** `ev = evidence or []; if not ev: return None` (lines 67–69). An empty-evidence
  candidate produces _nothing_. No LLM, no agent, no orchestrator can bypass this — they all write _through_
  this method (`RECOMMENDATION_AGENT.md` §3, §7: "Cannot persist directly — writes only via Tool Execution →
  RecommendationOS"). The anti-fabrication property is structural.
- **Deterministic rank.** `priority_score = impact × confidence × urgency × evidence ÷ effort` (lines 76–84),
  stored on the row, then aged by `_decay` and nudged down-only by learned behaviour (`_score`, lines 446–452;
  `_learning_factors` "never fabricates — only down-weights," lines 158–173). Ordering is explainable
  (`_why_first`, lines 504–522) and reproducible. An LLM cannot reorder it.
- **Typed boundaries are in the engine, not in a prompt.** Health is `INFORMATION` only with a "not a
  diagnosis" boundary (lines 318–334); estate is a `DEPENDENCY` ("see an attorney" is structurally
  forbidden, lines 295–316); military is personalized-OPPORTUNITY-or-DEPENDENCY, never a generic "up to 36
  months" (lines 336–379). The `audit()` reviewer gates (CFP/CPA/estate_attorney/physician/VSO, lines
  577–628) assert these properties _deterministically_.
- **Honest empties.** `RECOMMENDATION_QUALITY_AUDIT.md`: 12 fresh personas with no data produced **zero**
  recommendations — the correct trust-preserving default. The engine "shuts up gracefully."

So the recommendation _content_ is already deterministic + evidence-gated. The LLM's only legitimate role is
_phrasing a narrative_ (`RECOMMENDATION_LIFECYCLE.md` §1: "an LLM may help phrase a recommendation's narrative
(gated), but the recommendation only exists because a deterministic engine produced it"). That is a real but
**marginal** lever — and it is also where a fabrication risk would _enter_, not leave.

---

## 3. What a multi-agent LIOS could actually change (and what it can't)

| LIOS surface                                                                     | Can it change the recommendation?                 | Honest assessment                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Evidence **surfaced** to the engine (per-domain agents finding more cited facts) | Indirectly — more evidence ⇒ more recs _can_ mint | **Possible coverage gain, UNPROVEN.** Coverage is `UNMEASURED` (`RECOMMENDATION_LIFECYCLE.md` §10, framework §1). The deterministic collector (`sync`, lines 207–433) _already_ mines 401(k), insurance, estate, health, military, and life-objectives evidence. The marginal evidence an LLM domain agent adds over these engines is unquantified. |
| **Narration** of a rec (current/target/delta/why)                                | Phrasing only                                     | Marginal. The `narrative` is already built deterministically (lines 71–73) from the same fields. An LLM rewrite is nicer prose, same content, same `rank_score`.                                                                                                                                                                                    |
| **Prioritization** / "what's #1"                                                 | No                                                | `rank_score` is deterministic and stored at write (lines 81, 94). LIOS reads the same list (`prioritize`, lines 524–534). An LLM that reorders would _violate_ the deterministic-ranking invariant (`RECOMMENDATION_LIFECYCLE.md` §8.5).                                                                                                            |
| Cross-rec **conflict** surfacing                                                 | No                                                | `_conflicts` already detects same-resource competition and emits a framed tradeoff + sequence (lines 635–655). A Goal-Conflict LLM agent restates this; the detection is already deterministic.                                                                                                                                                     |
| The evidence **gate** itself                                                     | No                                                | Structural; lives in `write()`. Untouchable by design.                                                                                                                                                                                                                                                                                              |

The single honest "could be better" cell is **evidence surfaced** — and it is exactly the cell the framework
flags as the unproven, expensive part (framework §3, §5). Everything else is SAME-or-worse.

---

## 4. Unnecessary complexity (be ruthless)

**4.1 A separate Recommendation LLM agent is redundant for content.** `RECOMMENDATION_AGENT.md` itself
concedes this: §1 "Maps to `recommendations_os.py` — the single write path"; §6 Step 6 "Compute rank_score —
**deterministic**"; §5 "`rank_score` is deterministic." The spec's agent _mints, types, evidences, ranks_ —
but the engine already does all four. The only steps left for an LLM are "assign rec_type" and "build
narrative," both of which the deterministic `sync()` already does per source (e.g. lines 245–253 set
`rec_type="ACTION"`, narrative, type, evidence in one deterministic emit). **Adding an LLM call here buys
phrasing and costs ~7–8s / ~3k tokens** (framework §1) for output the guard already constrains. Recommend:
**no Recommendation LLM agent** — keep `write()` as the authority; let an LLM _optionally_ re-narrate a rec
_after_ it exists, gated, never to create or rank one.

**4.2 Per-domain LLM agents to "find evidence" largely duplicate live deterministic engines.** The collector
already calls `comp.analyze`, `planning.plan`, `family_office.assess`, `health.assess`, `military.assess`,
and reads `life_objectives`/`dependencies`/`risks` (lines 217–415). These are the same domain summaries
`H3` proposes keeping deterministic (framework §4, H3). A Finance/Family/Health _LLM_ agent on top adds +1
LLM call **each** (framework §3) for "deeper reasoning" whose recommendation-coverage gain is **unproven**,
while the evidence it would feed must _still_ pass `write()`'s gate to matter. Recommend: keep domains
deterministic (H3); only consider an LLM domain agent where a deterministic engine demonstrably _cannot_
surface an evidenced candidate — and prove that gap before building it.

**4.3 An LLM Conflict/Tradeoff agent for recommendations duplicates `_conflicts`.** Lines 635–655 already
produce typed conflicts (money/time), the competing set, the tradeoff statement, and a suggested sequence —
deterministically, from `readiness_impact.resource`. The Goal-Conflict spec's _recommendation-level_
contribution is already shipped. (Its _goal_-to-_goal_ edge-cited tradeoffs are a distinct, onboarding-side
question — see `ONBOARDING_QUALITY_EVALUATION.md`.)

**4.4 The two real, cheap gaps are not multi-agent at all.** `RECOMMENDATION_LIFECYCLE.md` §10 and
`RECOMMENDATION_QUALITY_AUDIT.md` §"Gaps" name them: (1) a first-class `missing_inputs` field — today implicit
in `quantified_impact.unlocked_capabilities` (lines 268–271, 309–313); (2) the adoption/dismissal/completion
feedback loop + per-module metrics. Both are **deterministic schema/observability work**, achievable without a
single added LLM call. They would improve _inspectability and learning_, not the evidence gate.

---

## 5. The coverage hypothesis — the only path to BETTER, and how to test it honestly

The one place LIOS _could_ beat today is **coverage**: how many high-value, evidenced recs the system mints
for a _data-rich_ user. This is `UNMEASURED` (audit §"This run"; lifecycle §10). The test must be honest:

1. **Measure the baseline first.** Seed the data-rich personas the audit already recommends (finance
   accounts + a 401(k)/insurance/estate document set) and run `sync()` → count evidenced recs per source,
   per `audit()` thresholds (lines 620–625). This is the missing denominator.
2. **Then, and only then,** ask whether an LLM domain agent surfaces _additional cited evidence_ the
   deterministic engine misses — additional evidence that _passes `write()`'s gate_ (i.e. real
   `{statement, source_table}`, not prose). Count incremental evidenced recs.
3. **Net it against cost.** Each domain LLM agent = +1 call ≈ 7–8s / ~3k tokens (framework §1). A coverage
   gain of "+1 marginal rec for +6 LLM calls per turn" is a **worse** product (latency/cost), not a better
   one. The bar is _materially more evidenced recs per added serial LLM call._

Until step 1 exists, "LIOS improves recommendations" is an **unproven** claim. The framework's stated bias
(§6) holds here: the cheap deterministic parts carry the value; the expensive LLM fan-out is the unproven part.

---

## 6. Where LIOS could make recommendations WORSE

- **Fabrication surface.** Today the LLM cannot create a rec (lifecycle §8.2). Any LIOS design that lets an
  LLM agent _mint_ (rather than re-narrate a gated rec) reopens the exact hole the guard closes. The spec is
  careful here (§3), but it is a regression risk to police.
- **Non-determinism in ordering.** An LLM that "prioritizes" breaks the explainable `rank_score` /
  `_why_first` contract (lines 504–522) and the audit's `executive_ai` gate (line 601).
- **Latency/cost without content gain.** +N domain agents + a Recommendation agent + a Critic on a rec that
  was already evidence-gated turns a near-free deterministic `sync` into a multi-call turn (framework §3) for
  the _same_ content quality. That is strictly worse on the measured axes (cost, latency).

---

## 7. Conclusion

| Dimension                                   | LIOS vs. today                                  | Basis                         |
| ------------------------------------------- | ----------------------------------------------- | ----------------------------- |
| Evidence gate / anti-fabrication            | **SAME** (structural; in `write()`)             | recommendations_os.py:67–69   |
| Rec content (state/delta/quantified impact) | **SAME** (deterministic `sync` + gate)          | lines 207–415, 71–84          |
| Deterministic ranking / explainability      | **SAME** (LLM would only risk it)               | lines 81, 446–522             |
| Typed boundaries (health/estate/military)   | **SAME** (engine + audit gates)                 | lines 318–379, 577–628        |
| Narration / phrasing                        | marginally nicer, gated                         | lifecycle §1                  |
| Coverage for data-rich users                | **POSSIBLY better — UNPROVEN**                  | unmeasured; audit §"This run" |
| Cost / latency                              | **WORSE** if domain+Rec+Critic LLM agents added | framework §1, §3              |

**Bottom line:** LIOS produces the **SAME** recommendation _content_ quality (the evidence-or-nothing guard
_is_ the quality), with a **possible, currently unproven** coverage gain at real added latency/cost.
**Recommendation:** do **not** build a Recommendation LLM agent or per-domain LLM evidence agents on faith;
keep `RecommendationOS.write()` as the sole authority; ship the two cheap deterministic gaps (`missing_inputs`
field + feedback loop); and gate any LLM domain agent behind a _measured_ data-rich coverage baseline that
proves materially more evidenced recs per added serial LLM call.
