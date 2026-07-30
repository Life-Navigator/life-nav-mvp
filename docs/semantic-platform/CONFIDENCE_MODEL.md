# Confidence Model

**Status:** Designed · **Date:** 2026-07-30 · Parent: `SEMANTIC_PLATFORM_ARCHITECTURE.md`

Covers brief Phase 4. Requirement: _"Never collapse them into one score."_

---

## 1. Starting point

No confidence exists on any relationship in production (0/3,208). Document Intelligence carries
extractor confidence with review bands on `DocumentField` — the only real confidence signal in the
system, and the pattern to generalize.

The retrieval layer has `weight` per relationship type in the catalog. **`weight` is not confidence.**
It is a static, type-level statement of _how informative this kind of edge is_ — `HAS_EVIDENCE` (0.9)
outranks `RELATED_TO` (low) regardless of instance. Confidence is _how sure we are about this specific
instance_. Conflating them is the error the brief's Phase 4 is guarding against, and both are needed:
ranking multiplies them.

---

## 2. The confidence vector

Seven components, stored separately, never pre-collapsed (invariant I-6).

```rust
pub struct ConfidenceVector {
    source:         f32,  // trust in the originating system (Plaid ≠ scanned PDF ≠ user memory)
    extractor:      f32,  // OCR/LLM/parser certainty for this datum
    entity:         f32,  // certainty this is the right entity (resolution/linking confidence)
    relationship:   f32,  // certainty the predicate holds between these entities
    path:           Option<f32>,  // traversal-derived; null for directly asserted
    answer:         Option<f32>,  // computed per response, not stored on the assertion
    recommendation: Option<f32>,  // computed per recommendation
}
```

Each is independently sourced, independently revisable, and independently explainable. Storing a single
0.72 destroys the ability to answer _"why are you unsure?"_ — which is the question that matters. "The
OCR was clear but I'm not certain this is your account" and "I'm sure it's your account but the scan
was poor" are opposite problems with opposite remedies, and a scalar erases the difference.

### 2.1 Source confidence is catalog data

Per `source_system` (`SEMANTIC_DATA_MODEL.md` §2), not per instance:

| Source                                 | Prior | Rationale                                 |
| -------------------------------------- | ----- | ----------------------------------------- |
| `VerifiedDB` (Plaid, institution APIs) | 0.98  | authoritative, machine-read               |
| `UserStated` (explicit, structured)    | 0.90  | authoritative on intent, fallible on fact |
| `DocumentExtraction` (reviewed)        | 0.92  | human-confirmed                           |
| `DocumentExtraction` (unreviewed)      | 0.60  | gated below citation threshold            |
| `AdvisorInferred`                      | 0.50  | must never self-reinforce — see §5        |
| `Synthetic`                            | n/a   | excluded from evidence entirely           |

---

## 3. Combination

**Within an assertion** — components are _not_ multiplied into a stored scalar. Consumers request a
projection appropriate to their question:

- _May this be cited?_ → `min(source, extractor, entity)` — citation is bounded by the weakest link in
  attribution. A confident relationship over a misidentified entity is a confidently wrong citation.
- _May this influence a recommendation?_ → weighted geometric mean, policy-gated.
- _How should this rank?_ → `catalog_weight × relationship × recency × reinforcement`.

**Across a path** — path confidence degrades multiplicatively with an explicit floor:

```
path_confidence = Π hop_confidence(i)   over hops
```

A 3-hop path at 0.9 per hop yields 0.73. This is correct and important: it makes long inferential
chains naturally lose authority, which is the behaviour that prevents the classic knowledge-graph
failure of confidently asserting a conclusion assembled from five weak links.

Traversal prunes paths below `min_path_confidence` (catalog-configurable, default 0.5) — a
**correctness** bound as much as a performance one.

**Bayesian combination** is used only for _independent corroboration_: two genuinely independent
sources asserting the same fact raise confidence via noisy-OR. Independence is determined from the
provenance graph — two assertions sharing a `Source` are **not** independent. Without a provenance
layer, independence is unknowable, which is why this is sequenced after `PROVENANCE_MODEL.md`.

---

## 4. Answer and recommendation confidence

Computed per response, never stored on assertions:

```
answer_confidence = f(min evidence confidence,
                      evidence count,
                      evidence agreement,
                      coverage of the question,
                      temporal freshness)
```

Deliberately includes **coverage** — an answer built on impeccable evidence that addresses only part of
the question is not a confident answer. This is the mechanism by which the system can say _"I'm
confident about your savings rate but I don't have your debt picture"_ rather than emitting a single
misleading number.

Recommendation confidence is bounded above by answer confidence, which is bounded above by evidence
confidence. **Confidence can only decrease as it propagates upward.** No stage may manufacture
certainty its inputs do not support.

---

## 5. The self-reinforcement prohibition

An assertion with `source_system = AdvisorInferred` **may not raise the confidence of any assertion it
was derived from**, and may not corroborate a sibling derived from the same evidence.

Without this rule the graph develops feedback loops: the advisor infers X from Y, X is stored, X is
later retrieved as corroboration for Y, both scores climb, and the system becomes progressively more
confident about something no external evidence ever supported. This is how knowledge graphs
hallucinate at the _data_ layer rather than the model layer — a far harder failure to detect, because
every individual step looks principled.

Enforced structurally: noisy-OR corroboration walks the provenance graph and rejects any pair with a
shared ancestor. **This is only possible with the provenance layer**, and is the strongest argument for
sequencing L1 before confidence-aware ranking.

---

## 6. Migration

| Step | Action                                                                                              | Rollback        |
| ---- | --------------------------------------------------------------------------------------------------- | --------------- |
| 1    | `ConfidenceVector` on `Assertion`; new writes populate from catalog priors + extractor output       | stop populating |
| 2    | Declare `confidence_default` per catalog row                                                        | revert manifest |
| 3    | Backfill: document tier from existing `DocumentField` confidence; financial tier from source priors | leave null      |
| 4    | Legacy edges → `unknown_legacy`, confidence **null, not zero**                                      | —               |
| 5    | Confidence-aware ranking behind `CONFIDENCE_RANKING`, measured on golden set                        | disable flag    |
| 6    | Citation threshold enforcement behind `CONFIDENCE_CITATION_GATE`                                    | disable flag    |

**Null, never zero, never a default.** A missing confidence means _unknown_; zero means _known to be
worthless_. Defaulting unknown to a number — 0.5 being the tempting choice — invents information and
lets unmeasured assertions rank against measured ones as if they had been assessed. Consumers must
handle null explicitly.

---

## 7. Evaluation

| Metric                       | Definition                                          | Gate                             |
| ---------------------------- | --------------------------------------------------- | -------------------------------- |
| Confidence completeness      | % assertions with a non-null vector                 | ratchets upward                  |
| Calibration                  | predicted vs observed correctness, per source class | Brier score, tracked per release |
| Component independence       | correlation between components                      | flag if > 0.9 (signals collapse) |
| Path degradation correctness | multi-hop confidence ≤ min hop                      | 100%, property test              |
| Monotonicity                 | recommendation ≤ answer ≤ evidence confidence       | 100%, property test              |
| Self-reinforcement           | corroborating pairs sharing a provenance ancestor   | **0, hard gate**                 |

**Calibration is the metric that makes confidence honest.** A confidence model that is never checked
against outcomes is decoration. Per-source-class Brier scores, recomputed each release against the
retrieval golden set and the human review loop, are what turn these numbers from assertions into
measurements.
