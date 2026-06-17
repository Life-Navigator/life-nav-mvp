# Number Gate Refinement Plan — LifeNavigator Advisor

**Date:** 2026-06-15
**Owner:** Advisor platform
**Status:** Engineering plan — ready to sequence

**Goal:** Recover the benchmark quality the number gate currently suppresses **while keeping the
zero-fabrication trust guarantee fully intact**. We do **not** relax the guarantee: no fabricated
user-specific figure, and no wrong math, ever reaches the user. We close _wiring gaps_ (real numbers that
never reach the allow-set), generalize the _verifier_ so the model needn't perfectly self-record, and make
the gate _strip-not-reject_ so one bad number can't nuke an otherwise-validated turn.

**Why this is the highest-ROI work (the established economics):**

- The Claude control proved the gate is the single dominant remaining platform cost: on the **44
  non-fallback turns LN+Claude scored 8.08 — parity with raw Claude (8.00)**. The whole 7.30→8.0 gap is
  the ~6 fallbacks (`CLAUDE_CONTROL_EXPERIMENT.md`). Enhanced-only parity is the proof of headroom.
- Each fallback swaps an enhanced reply (≈7–8) for a generic deterministic reply (≈1.7): **~0.11–0.13 on
  the all-50 overall per fallback**, i.e. **~6 fallbacks ≈ ~0.7 pt** (`NUMBER_GATE_FORENSICS.md` §4;
  `TOP_25_RULES_BY_IMPACT.md` #1).
- V6 already cut fallbacks 12→5 via repair-not-reject and lifted all-50 to 6.66; it plateaued because
  repair only _drops_ numbers and because Paths B/C/D-plumbing are still closed. This plan removes those.

---

## The five number paths (recap — see `NUMBER_GATE_FORENSICS.md` §2)

| Path | Source                                                        | Today                | Target                                                              |
| ---- | ------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------- |
| A    | **User-provided** (message / prior turns / context panel)     | ALLOWED              | Keep — unchanged                                                    |
| B    | **Document-derived** (paystub/statement/offer field values)   | BLOCKED (wiring gap) | ALLOWED with provenance                                             |
| C    | **Tool-generated** (finance resolver / canonical-summary)     | BLOCKED (wiring gap) | ALLOWED, surfaced to model                                          |
| D    | **Deterministically-calculated** (V5 `derivations`, verified) | ALLOWED if recorded  | Keep + auto-extract candidates server-side                          |
| E    | **Model-invented** (benchmarks, assumed rates, projections)   | BLOCKED              | Stays BLOCKED as user-fact; ALLOWED only in a labeled-guidance lane |

The trust spine is unchanged for every path: a number is shown only if it is **the user's own (A/B/C),
verified arithmetic over the user's own (D), or honestly labeled as general guidance and not attributed to
the user (E-lane)**.

---

## Workstream 1 — Thread document numbers into `allowed_numbers` (Path B)

**Change.** Add a `numbers_from_documents` source to `AdvisorContextBuilder.build()`. Fetch the extracted
`DocumentField` numeric _values_ for the user's uploaded docs (paystub/statement/offer letter), run them
through `numbers_in(...)` exactly like typed numbers, and union into `allowed_numbers`. Surface them in
`prompt_dict()` under a distinct key (e.g. `numbers_from_your_documents`) so the model is told these are
safe, _and_ so we keep provenance visible (a doc figure is the user's own — just not re-typed in chat).

**Where (files / functions):**

- `advisor_context.py`: `AdvisorContextBuilder.build()` — add an async `_document_numbers(ctx)` read
  alongside the existing `asyncio.gather` (rejected/scores/relationships); union its output into the
  `numbers_in(...)` call (`advisor_context.py:348`). Add `numbers_from_documents` to the dataclass and to
  `prompt_dict()` (`advisor_context.py:257`).
- New read: the Document/DocumentField store (the documents schema; values already extracted by the
  ingestion extractor). Read-only; degrade to empty on any error (same pattern as `_relationships`).

**Per-source handling.** Treated identically to typed user numbers — same provenance class (the user's own
data), so the same matching/expansion (`_expand_money_forms`) applies. No special verification needed.

**Expected fallback reduction.** Low in the _current_ benchmark (the 50 scenarios are typed-input, not
doc-backed) — ~0 on the existing harness, but it removes a real production false-rejection class for the
beta cohort who upload docs. Add 2–3 doc-backed scenarios to the harness to measure.
**Expected benchmark improvement.** ~0 on the current 50; unlocks personalization on doc-driven turns
(real beta value). Tag it a production-correctness fix, not a benchmark mover.
**Trust impact.** None — guarantee preserved. A `DocumentField` value is the user's own figure with
_stronger_ provenance than free-text (it was extracted deterministically from their document); admitting it
narrows nothing in the fabrication boundary.
**Effort.** Medium (~0.5 day) — the read + plumbing exist conceptually; main work is the documents-store
query and degradation handling.

---

## Workstream 2 — Thread tool/resolver numbers into `allowed_numbers` (Path C)

**Change.** Feed the deterministic finance resolver / canonical-summary outputs (net worth, account
totals, monthly cash flow) into `allowed_numbers` and surface them as `numbers_from_your_accounts` in
`prompt_dict()`. These are non-LLM, deterministic, authoritative figures — _more_ trustworthy than typed
free-text.

**Where (files / functions):**

- `advisor_orchestrator.py`: the orchestrator already has the user context; add a finance-summary read
  before `self._ctx.build(...)` (`advisor_orchestrator.py:192`) and pass the resolved figures into
  `build(...)` as a new `tool_numbers` arg, OR inject the resolver into `AdvisorContextBuilder.__init__`
  (mirrors how `coverage`/`life` services are injected) and read inside `build()`.
- `advisor_context.py`: accept `tool_numbers`, union into `numbers_in(...)`, expose in the dataclass +
  `prompt_dict()`. Keep the canonical-summary as the single source (per the net-worth canonicalization
  work) so the advisor and the dashboard quote the same figure.

**Per-source handling.** Identical matching to user numbers, but flag provenance in the prompt so the model
attributes them correctly ("your accounts show ~$X"). No verification beyond what the resolver already
guarantees.

**Expected fallback reduction.** ~0 on the current harness (scenarios don't carry live account data);
production value is high. If we add account-grounded scenarios it directly removes Path-C rejections.
**Expected benchmark improvement.** ~0 on the current 50; large qualitative production gain (advisor
engages real account data instead of deflecting).
**Trust impact.** None — guarantee preserved, and arguably trust-_positive_: deterministic resolver
outputs are the strongest provenance class we have.
**Effort.** Medium (~0.5–1 day) — depends on resolver call shape; reuse the canonical-summary endpoint the
finance widgets already read.

---

## Workstream 3 — Server-side auto-extraction of candidate computations (Path D plumbing) — **top benchmark lever**

**The problem (largest fallback class).** Per the forensics §3 pattern #1, the biggest recoverable class
is **correct arithmetic on the user's own numbers, emitted as prose instead of a `derivations` entry**:
fin-07 `220` (`250k−30k`), fin-08 `45`/`45000` (`60k−15k`), car-02 `33` (`168k−135k`),
edu-01 `304000` (`140k+2×82k`), car-07 `72500` (`145k/2`), fam-02 `150000` (`300k/2`),
crs-04 `60` (`120k/2`), crs-03 `40000` (`200k−160k`), edu-02 `220000` (`55k×4`). The math is verifiable;
only the _plumbing_ (prose vs structured derivation) failed. **Zero trust cost to recover.**

**Change.** Add a deterministic **prose-number factoriser** in `advisor_math.py` that, for each rejected
prose number, attempts to express it as a simple operation over the user's allowed values + unit constants
and _verifies it exactly_ (same AST eval, same tolerance as `verify_derivations`). If it verifies, the
number is admitted (and recorded as a synthetic derivation for telemetry). This generalizes
`verify_derivations` from _annotated_ derivations to _un-annotated_ arithmetic — the model no longer has to
perfectly self-record.

- Candidate operations to try (bounded, deterministic): `a±b`, `a/2`, `a/4`, `a×k` for small integer k
  (vesting years, child counts, pay periods), `a−b` over all user-value pairs, and `a × unit_constant`.
  This is a tiny combinatorial search over the (small) allowed-value set — cap pair-count and depth to
  keep it O(n²) and fast.
- Implement as `factor_number(target, allowed_numbers) -> Optional[derivation]`; the validator calls it
  for each member of `invented` before failing.

**Where (files / functions):**

- `advisor_math.py`: new `factor_number(...)`, reusing `user_values`, `_UNIT_CONSTANTS`, `_safe_eval`,
  `_forms`. Same tolerance (`max(1.0, 5%)`).
- `advisor_validator.py`: in `validate()` step 2 (`advisor_validator.py:179-184`), after computing
  `invented`, attempt `factor_number` on each; drop any that verifies, add its `_forms` to `allowed`.
- **Widen `_UNIT_CONSTANTS`** (`advisor_math.py:23`) with value-neutral time/unit factors only:
  add `4` (quarters/yr; the recurring crs-07 4%-rule denominator), `26`/`24` (bi-weekly/semi-monthly pay),
  `1000`/`1_000_000` (k/M scaling as operands). **Do NOT add rates** (no 4%/7%/20% — those are Path E).

**Per-source handling.** This is Path D: only computations whose operands all trace to user numbers (A) +
unit constants and whose arithmetic is exactly correct are admitted. Identical invariant to the existing
verifier — just applied to prose the model forgot to structure.

**Expected fallback reduction.** Largest single lever — recovers the ~9 recurring arithmetic turns above;
realistically clears **most of the 5–6 surviving V6/Claude fallbacks** that are real user-number math.
**Expected benchmark improvement.** This is where the ~0.7pt headroom lives. Clearing ~5–6 fallbacks ≈
**~0.6–0.7 pt on all-50**, moving LN+Claude from ~7.30 toward the proven enhanced-only ~8.08.
**Trust impact.** None — guarantee preserved. The factoriser admits a number _only_ when it verifies
exactly against the user's own values, identical to `verify_derivations`. A fabricated or mis-computed
figure cannot verify, so it is never admitted.
**Effort.** Medium-High (~1–1.5 days) — the factoriser search + unit tests for false-admission (must prove
an assumed-rate figure like `124000` from `620k×0.20` does NOT verify because `0.20` isn't a user value).

---

## Workstream 4 — STRIP-NOT-REJECT (extend V6 repair so one bad number doesn't nuke the turn)

**The problem.** Today rule #1 (`TOP_25_RULES_BY_IMPACT.md`) is all-or-nothing: any single visible number
not in `allowed`/verified → the **whole turn** is discarded (after one LLM repair-retry) for a ~1.7
deterministic reply. After Workstreams 1–3, the residue is genuine Path-E numbers (assumed rates,
benchmarks) sitting inside an otherwise-validated 6-section answer.

**Change.** Add a **deterministic server-side strip pass** in the validator (no extra LLM round-trip):
when, after Path-A/B/C/D admission, a _small_ set of numbers remains invented, **remove or qualitative-ize
just those tokens in `visible`** (replace `$124,000` → "a larger down payment", `6 months` → "several
months") and **keep the rest of the validated turn**. The strip is a literal token substitution over the
rendered sections, then a re-run of the gate on the stripped text (which now passes). Bound it: strip only
if ≤2 offending tokens remain (more than that signals a genuinely ungrounded reply → fall back as today).

- This is the _deterministic_ analogue of the existing LLM repair-note (which asks the model to qualitative-
  ize). Doing it server-side removes the second LLM call's failure mode and converts the ~6 surviving
  fallbacks into passes.
- Keep the existing single LLM repair-retry as a _first_ attempt (it produces better prose); the strip pass
  is the deterministic _floor_ so a second LLM miss no longer means fallback.

**Where (files / functions):**

- `advisor_validator.py`: after step 2, if `invented` is non-empty and small, run `_strip_numbers(safe,
invented)` across all rendered fields (the same fields concatenated into `visible` at
  `advisor_validator.py:169`), then recompute the gate. Add the stripped tokens to `safe["_repairs"]` for
  telemetry (e.g. `number_stripped`).
- `advisor_orchestrator.py`: `_enhance` already prefers `repaired_retry`; wire the strip outcome as
  `validator_result = "stripped"` so we can measure it separately (`advisor_orchestrator.py:230-238`).

**Per-source handling.** Strip applies only to residual Path-E user-specific figures (everything A–D was
already admitted upstream). The qualitative replacement makes the claim honest ("a larger down payment")
rather than fabricated.

**Expected fallback reduction.** Converts **~6 fallbacks/50 into passes** (the explicit target).
**Expected benchmark improvement.** **~0.7 pt** on all-50 (each recovered fallback ≈ +5.5–6.5 raw
→ ~0.11–0.13 overall; ~6 of them ≈ ~0.7). Combined with WS3 this is the bulk of the headroom; the two
overlap (WS3 prevents the strip from firing on real arithmetic), so count the _combined_ WS3+WS4 ceiling
at ~0.7–0.8 pt, not additive.
**Trust impact.** None — guarantee preserved. Stripping makes the turn _more_ conservative than today's
gate: instead of showing the number, it removes/qualitative-izes it. No fabricated figure can survive a
strip pass because the offending token is deleted before the text is shown.
**Effort.** Medium (~1 day) — the token-substitution map (number → qualitative phrase by magnitude/%
context) plus the ≤2-token bound and re-gate; unit tests proving stripped output contains no invented
token.

---

## Workstream 5 — Labeled general-guidance lane for benchmarks (Path E, narrowly opened)

**Change.** Add a dedicated output channel `general_benchmarks: [{statement, basis}]` rendered with a fixed
prefix, e.g. _"As a general rule of thumb (not your specific numbers): a 20% down payment on a home this
price would be roughly $124k."_ The gate permits a number in this channel **only** when (a) it is rendered
with the guidance marker, and (b) it is **not attributed to the user** (no "your", "you have", "you'll
save" adjacent). The marker is the trust boundary: a labeled rule-of-thumb is honest; the same number
presented as the user's own stays blocked.

**Where (files / functions):**

- `advisor_validator.py`: in `validate`, exclude `general_benchmarks` numbers from the `invented` set _only_
  when the entry text carries the marker and contains no first/second-person possessive near the number.
  Add a `_is_user_attributed(text)` guard (regex for "your"/"you have"/"you'll" within N chars of the
  token). Render the channel in `_compose` with the fixed prefix.
- Keep `general_benchmarks` numbers OUT of `allowed_numbers` for all other sections — they must not leak
  into the personalized prose.

**Per-source handling.** This is the _only_ admission of model-generated figures, and only as explicitly
labeled general guidance, never as the user's figure. Recovers the fin-01 (`20`/`5`), fin-09, fin-03 style
turns where the _useful_ content is a benchmark.
**Expected fallback reduction.** Recovers the genuine-benchmark subset (≈2–3 of the assumed-rate fallbacks
in fin-01/fin-03/fin-09) that WS3/WS4 would otherwise only qualitative-ize (losing the helpful number).
**Expected benchmark improvement.** ~0.2–0.3 pt incremental on top of WS3/WS4 (turns where a _labeled_
benchmark scores better than a stripped qualitative phrase), and an actionability gain (rule #2).
**Trust impact.** None — guarantee preserved. The number is explicitly _not_ the user's figure; the marker

- no-attribution guard is the boundary. A benchmark woven into a personalized projection as the user's own
  still fails (caught the 3 raw-Claude fabrications — that gate is untouched).
  **Effort.** Medium (~1 day) — new channel, prompt instruction for when to use it, attribution guard,
  compose rendering, and adversarial tests (a benchmark mislabeled as the user's own must still reject).

---

## Workstream 6 — False-positive precision fixes (zero policy change)

**Change.** Two pure-precision fixes to `_FIN_NUM` / `_financial_numbers`:

1. Stop `\b\d{3,}\b` matching `401` in "401k" / `403` in "403b" — require the digit run not be immediately
   followed by an account-type suffix (`k`, `b`, `(c)`). (fin-07 `401`.)
2. Fix the comma-split `000` artifact — tokenize full comma-grouped numbers _before_ stripping commas, so
   `$1,500,000` never yields a spurious `000` chunk. (fin-04 `000`.)

**Where:** `advisor_validator.py:84` (`_FIN_NUM`) and `:94-98` (`_financial_numbers`).
**Per-source handling.** N/A — these tokens were never financial figures; the fix removes wrong matches.
**Expected fallback reduction.** ~1–2 (fin-07 `401`, fin-04 `000`) plus latent k-notation edge cases.
**Expected benchmark improvement.** ~0.1–0.2 pt.
**Trust impact.** None — guarantee preserved. These are precision-only: they stop the gate flagging
non-numbers; they never admit a real fabricated figure.
**Effort.** Low (~0.25 day) — regex change + targeted unit tests on "401k"/"403b"/comma-grouped values.

---

## Sequencing

Order by ROI-per-effort and dependency. WS3 and WS4 are the benchmark movers; WS6 is a cheap quick win
that also de-noises measurement; WS1/WS2 are production-correctness (low current-harness impact) so they
go later unless beta needs them sooner; WS5 layers on last because it has the most adversarial-test surface.

| Step | Workstream                                                 | Why this order                                                                                      | Effort   | Benchmark Δ (all-50)        |
| ---- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------- | --------------------------- |
| 1    | **WS6** false-positive fixes                               | Cheapest; removes noise so later measurements are clean                                             | Low      | +0.1–0.2                    |
| 2    | **WS3** server-side auto-extraction + widen unit constants | Largest single lever; clears the biggest fallback class                                             | Med-High | (combined w/ S3)            |
| 3    | **WS4** strip-not-reject                                   | Converts the ~6 residual fallbacks into passes; depends on WS3 to avoid stripping real math         | Med      | +0.7–0.8 (WS3+WS4 combined) |
| 4    | **WS5** labeled-guidance lane                              | Recovers the genuine-benchmark subset WS4 would only qualitative-ize                                | Med      | +0.2–0.3                    |
| 5    | **WS1 + WS2** doc / tool numbers                           | Production correctness for the beta cohort; ~0 on current 50 — add doc/account scenarios to measure | Med ×2   | ~0 now; high prod value     |

**Projected end state.** WS3+WS4+WS5+WS6 target the proven enhanced-only parity (≈8.08) becoming the
all-50 score — i.e. LN+Claude from ~7.30 toward ~8.0 — **with no trust relaxation**, because every
recovered number is the user's own (A/B/C), verified arithmetic over the user's own (D), or honestly
labeled general guidance never attributed to the user (E-lane).

## Guardrails that DO NOT change (the irreducible trust core)

- **Model-invented user-specific figures stay blocked.** Any number attributed to the user that isn't in
  `allowed_numbers` (A/B/C) or a verified derivation (D) is rejected/stripped. This caught 3 raw-Claude
  fabrications — untouched.
- **Assumed rates dressed as the user's reality stay blocked.** A rate/benchmark may appear ONLY in the
  labeled-guidance lane (WS5), never woven into a personalized projection.
- **`verify_derivations` invariant is the spine.** Operands ∈ user_values ∪ unit_constants, arithmetic
  verified within tolerance. WS3's factoriser and the widened unit constants stay strictly within
  value-neutral time/unit factors — no rates ever.

## Validation plan

- Re-run the 50-scenario harness after each step; track fallback count, all-50, enhanced-only, and trust.
- **Adversarial tests are mandatory for WS3/WS4/WS5:** assert that a non-user-operand figure (e.g.
  `124000` from `620k×0.20`) does NOT verify; that a stripped turn contains no invented token; that a
  benchmark mislabeled as the user's own still rejects. Trust score must hold at ≥8.5.
