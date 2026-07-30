# ADR-010 — Minimal Stored Confidence Model

**Status:** Proposed · **Date:** 2026-07-30 · **Decision deadline:** with ADR-002 schema
**Owners:** AI/Retrieval · **Reviewers:** Graph Platform, Security, Data Platform
**Related findings:** REVIEW §1.3 (self-correction) · Depends on ADR-002; consumed by ADR-005, ADR-006

---

## Context

`CONFIDENCE_MODEL.md` (2026-07-30) specified a seven-component stored vector with Bayesian noisy-OR
combination. The final review rejected it as unnecessary sophistication. This ADR replaces it.

## Measured evidence

_Measured facts._ Production 2026-07-30: **0 of 3,208** relationships carry any property, therefore zero
carry confidence. `DocumentField` = 53 nodes; the Document Intelligence work established extractor
confidence with review bands on those fields — **the only real confidence signal in the system**.
Catalog `weight` exists per relationship type (`ontology_manifest.json`, 147 rows, field `weight`).

_Design inference._ Catalog `weight` is **type-level informativeness** (`HAS_EVIDENCE` 0.9 vs
`ANALYZED_BY_PROVIDER` 0.25), not instance certainty. It is not confidence and must not be merged with
it; ranking multiplies the two.

_Design inference._ Designing a seven-component probabilistic model atop one measured signal is
speculative. Four of the seven (`path`, `answer`, `recommendation`, and evidence aggregate) are
**computed per request** and have no meaning as stored properties of a knowledge object.

_Unresolved assumption._ Whether entity-resolution will produce a usable numeric confidence, or only a
match/no-match decision (OQ-8).

## Problem statement

Confidence must be expressible without inventing precision the system cannot justify, and without
collapsing distinguishable kinds of uncertainty into one misleading scalar.

## Forces and constraints

Never collapse to a single stored score · null ≠ zero · computed values must not be persisted · no
probabilistic machinery without calibration data.

## Decision drivers

Truthfulness about what is actually measured · explainability of _why_ uncertain · extensibility.

## Options considered

1. Seven stored components (prior design).
2. One scalar.
3. **Three stored components.**
4. Full probabilistic model (Bayesian network).
5. No stored confidence.

## Comparative decision matrix

| Criterion            | 1 Seven | 2 Scalar | 3 Three | 4 Full prob. | 5 None   |
| -------------------- | ------- | -------- | ------- | ------------ | -------- |
| Correctness          | 3       | **2 HB** | 5       | 4            | 2        |
| Security             | 4       | 4        | 4       | 4            | 3        |
| Privacy              | 4       | 4        | 4       | 4            | 4        |
| Tenant safety        | 4       | 4        | 4       | 4            | 4        |
| Semantic fidelity    | 4       | 1        | 5       | 5            | **1 HB** |
| Impl. complexity     | 2       | 5        | 4       | **1 HB**     | 5        |
| Migration complexity | 2       | 5        | 4       | 1            | 5        |
| Ops complexity       | 3       | 5        | 4       | 1            | 5        |
| Scalability          | 3       | 5        | 4       | 2            | 5        |
| Reversibility        | 3       | 4        | 5       | 2            | 5        |
| Observability        | 4       | 2        | 5       | 4            | 1        |
| Cost                 | 3       | 5        | 4       | 1            | 5        |
| Maintainability      | 2       | 3        | 5       | 1            | 3        |

**Hard blockers.** Option 2: a scalar destroys the ability to answer _why_ uncertain — "the OCR was
clear but I'm unsure this is your account" and the inverse are opposite problems with opposite remedies.
Option 5: without confidence, citation gating and the privileged-sink rule (ADR-005) cannot be
enforced. Option 4: a Bayesian network with no calibration data is unfalsifiable machinery.

## Decision

**Adopt Option 3 — three stored components; everything else computed and traced.**

**Stored on the assertion (ADR-002):**
| Field | Source | Available |
| --- | --- | --- |
| `source` | catalog prior per `source_system` | now |
| `extractor` | extractor/OCR/LLM output | now (document tier) |
| `resolution` | entity-linking confidence | with ADR-006 |

**Computed per request, never persisted:** `evidence`, `path`, `answer`, `recommendation`.

## Detailed design

**Source priors (catalog data, not code):** `verified_db` 0.98 · `user_stated` 0.90 ·
`document_reviewed` 0.92 · `document_unreviewed` 0.60 · `inferred` 0.50 · `synthetic` excluded.

**Combination rules (projections, not a stored scalar):**

- _Citation eligibility:_ `min(source, extractor, resolution)` — bounded by the weakest link in
  attribution; a confident relationship over a misidentified entity is a confidently wrong citation.
- _Ranking:_ `catalog_weight × source × recency × reinforcement`.
- _Path:_ `Π hop_confidence`, pruned below `min_path_confidence` (default 0.5, catalog-configurable) —
  a correctness bound, not merely a performance one.
- _Monotonicity (invariant):_ `recommendation ≤ answer ≤ evidence`. **No stage may manufacture
  certainty its inputs do not support.** Property-tested.

**Missing values:** `null` means _unknown_; `0.0` means _known worthless_. **Never default unknown to a
number** — a default lets unassessed assertions rank against assessed ones as if they had been judged.
Consumers must handle null explicitly; a null in a citation projection means not citable.

**Self-reinforcement prohibition (invariant):** an assertion with `source_system = inferred` may not
raise the confidence of any assertion it derives from, and two assertions sharing a provenance ancestor
may not corroborate each other. Enforced by walking the ADR-002 provenance chain. Without this the
graph becomes progressively more confident about claims no external evidence supports — hallucination
at the data layer, where every individual step looks principled.

**Entity-resolution firewall (with ADR-006):** `resolution` expresses _which entity this is_, never
_whether the claim is true_. No projection may multiply `resolution` into a truth score.

**Trace output:** every answer emits the three stored components per evidence item plus each computed
value and the projection used, so a confidence number is always attributable to a formula.

**Bayesian combination is deferred**, not rejected forever. Re-entry requires (a) two genuinely
independent sources, provable via the provenance graph, and (b) calibration data.

## Security / Privacy / Tenant-isolation implications

Confidence gates citation and the privileged-sink path (ADR-005), so it is a security control, not only
a quality signal. No tenant implications.

## Data-model implications

Three nullable floats on the assertion row. Not on graph edges.

## Scalability / Cost implications

Negligible.

## Operational implications

Calibration (Brier score per source class) recomputed per release against ADR-004.

## Developer-experience implications

Three fields with clear provenance beats seven with speculative semantics.

## Migration plan

1. Add three fields to the ADR-002 assertion schema.
2. Populate `source` from catalog priors for all new writes.
3. Populate `extractor` from the document tier.
4. Add `resolution` with ADR-006.
5. Enable confidence-aware ranking behind `CONFIDENCE_RANKING`, measured on the golden set.
6. Enable citation gating behind `CONFIDENCE_CITATION_GATE`.

## Backfill plan

`source` is deterministically derivable from `source_system` for recoverable assertions. Legacy edges
remain **null**, never zero, never defaulted.

## Compatibility strategy

Nullable and additive; consumers treat null as unknown.

## Rollback strategy

Disable the ranking and citation flags; fields become inert.

## Observability requirements

Confidence completeness · calibration (Brier) per source class · component correlation (flag if > 0.9,
signalling the components have collapsed into one) · self-reinforcement violations.

## Evaluation plan

Property tests for monotonicity and path degradation; calibration tracked per release; zero
self-reinforcing pairs as a hard gate.

## Falsification criteria

If the three components prove correlated above 0.9, they are not independent and the model should
collapse toward fewer. If entity resolution yields no numeric signal (OQ-8), `resolution` becomes
boolean and the model reduces to two components plus a flag.

## Acceptance criteria

No stored scalar collapse · monotonicity 100% · 0 self-reinforcing pairs · null handled explicitly
everywhere · calibration reported.

## Non-goals

No Bayesian combination. No stored path/answer/recommendation confidence. Not replacing catalog `weight`.

## Risks accepted

Three components may prove insufficient for some future reasoning need. Accepted: adding a fourth is a
schema addition, not a redesign.

## Residual uncertainty

OQ-8 (resolution signal shape). Calibration data does not yet exist for any component.

## Consequences

Confidence becomes honest and measurable rather than elaborate and unvalidated.

## Follow-up work

Calibration harness; Bayesian re-entry review once independence is provable.

## Superseded documents

**Supersedes `CONFIDENCE_MODEL.md` §2 (seven components), §3 (Bayesian combination as a near-term
mechanism), and the `ConfidenceVector` struct.** Retains §3 projection logic, §4 monotonicity, §5
self-reinforcement prohibition, §6 null-not-zero, §7 calibration.

## Approval record

| Reviewer  | Role          | Verdict | Date |
| --------- | ------------- | ------- | ---- |
| _pending_ | AI/Retrieval  | —       | —    |
| _pending_ | Data Platform | —       | —    |
