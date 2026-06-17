# Number Gate Forensics — LifeNavigator Advisor

**Date:** 2026-06-16
**Scope:** Every numeric figure the advisor can emit, how each is gated, the complete catalog of
number-validation fallbacks across V2→V6 + the Claude control run, and the safe expansions that recover
the established platform cost without weakening the "zero fabrication" guarantee.

**Sources read:**

- `apps/lifenavigator-core-api/app/services/advisor_validator.py` (`_FIN_NUM`, `_financial_numbers`, the
  invented-numbers check, `verify_derivations` integration)
- `apps/lifenavigator-core-api/app/services/advisor_context.py` (`numbers_in`, `_expand_money_forms`,
  `allowed_numbers` construction, `prompt_dict` → `numbers_you_may_reference`)
- `apps/lifenavigator-core-api/app/services/advisor_math.py` (`verify_derivations`, `expand_money`,
  `_UNIT_CONSTANTS`, `_safe_eval` AST walk, `_forms`)
- `apps/lifenavigator-core-api/app/services/advisor_orchestrator.py` (where context is built / validated)
- `raw/lifenavigator{,_v3,_v4,_v5,_v6}.json` + `raw/lifenavigator_claude_v6.json` (fallback evidence)
- `ADVISOR_V5_RESULTS.md`, `ADVISOR_V6_RESULTS.md`, `CLAUDE_CONTROL_EXPERIMENT.md`

> **Note on versions.** The prompt referenced `lifenavigator_v{2..6}.json`. There is **no `_v2` raw file**
> on disk — V2 (`2.3.0`) is the pre-instrumentation baseline (no per-turn `llm_status` capture; fallbacks
> not logged, shown as "—" in the V6 arc table). The fallback catalog below therefore spans the files that
> exist: the base run (`lifenavigator.json`, the V-series origin) and `_v3`, `_v4`, `_v5`, `_v6`, plus the
> Claude control (`lifenavigator_claude_v6.json`).

---

## 1. How the gate actually works (the mechanism in three functions)

The gate is a deterministic allow-list match over the rendered prose. It never "understands" a number; it
extracts every financial-looking token from what the user would see and rejects the turn if any token is
not in an allowed set.

**(a) Extraction — what counts as a "number" (`advisor_validator._FIN_NUM`):**

```python
_FIN_NUM = re.compile(r"\$\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?%|\b\d{3,}\b")
```

A token is "financial-looking" if it has a `$`, has a `%`, **or is a bare integer ≥ 100** (`\b\d{3,}\b`).
`_financial_numbers()` strips `$`, `%`, and commas, yielding a normalized digit string (e.g. `$45,000`
and `45000` both become `"45000"`). Note the consequence: **any 3+ digit run is scrutinized**, which is
why bare counts/ages like `220` (years×something), `401` (from "401k"), or `000` (the tail of a split
`$1,500,000` → `1,500,000` chunked oddly) can trip the gate — see the catalog.

**(b) The allow-set — what the user said (`advisor_context.numbers_in` + `_expand_money_forms`):**
`allowed_numbers` is built **only** from deterministic, user-sourced text:

```python
allowed_numbers = numbers_in(message, *prior_user_msgs, *cands, *risks, *opps, *cons,
                             panel.get("life_vision"))
```

`numbers_in` captures `$22k`/`24%`/`5,200` with k/M/B + `%` suffixes via `_NUM_RE`, and for each token
emits **both** the bare literal (`22`) **and** the magnitude/percent-expanded forms (`22000`; `24` and
`0.24` for a percent). This is the fix that killed the early k-notation false positives.
Then `prompt_dict()` surfaces `sorted(self.allowed_numbers)` to the model as
`numbers_you_may_reference` — so the model is told exactly which figures are safe to echo.

**(c) Verified derivations — computed-from-user numbers (`advisor_math.verify_derivations`, V5+):**
The model may compute via a structured `derivations` entry `{label, expression, value}`. A derivation is
kept (and its result added to the allow-set) only if **every literal operand traces to a user number or a
unit constant** AND **the arithmetic is correct** (restricted AST eval over `+ - * / ()` and `%`→`/100`,
compared to the claimed value within `tol = max(1.0, 5%)`):

```python
_UNIT_CONSTANTS = {12.0, 52.0, 365.0, 100.0}   # months/weeks/days per year, percent base
allowed_ops = user_values(allowed_numbers) | _UNIT_CONSTANTS
# operand ok if within 0.5 absolute OR 1% relative of an allowed value
```

`_forms()` then expands a verified value into the string forms it may appear as in prose (integer, 1–2dp,
and clean k/M reductions), so a verified `45000` also matches `$45k`.

**(d) The check + V6 graceful degradation:**

```python
verified_vals, kept_derivs = verify_derivations(result.get("derivations"), context.allowed_numbers)
allowed = context.allowed_numbers | verified_vals
used    = _financial_numbers(visible)            # visible = all user-facing sections concatenated
invented = {n for n in used if n not in allowed}
if invented: reasons.append(f"invented numbers not in context: {sorted(invented)}")
```

`visible` folds in every rendered field (decision_frame, tradeoffs, what_we_know, recommendation, need,
reflection, next_question, why_this_question, summary), so the gate covers all of them with one rule.
On a grounding miss the V6 orchestrator gives **one repair-retry** (drop the offending number, re-validate
against the _same_ gate); if that still fails, the **entire turn is discarded** for a generic deterministic
reply scoring ~1.7. The fallback is all-or-nothing per turn.

---

## 2. The five number paths — classification, current status, and the governing rule

| #   | Path                                                                                                                                  | Currently                    | Should be                                                                                      | Governing rule today                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | **User-provided** (in message or prior turns / context panel)                                                                         | **ALLOWED**                  | Allowed (correct)                                                                              | In `allowed_numbers` via `numbers_in(...)`, k/M/% expanded by `_expand_money_forms`. Surfaced to model as `numbers_you_may_reference`.                                                                                                                                                                                                                                                                                                             |
| B   | **Document-derived** (figures extracted from an uploaded doc — paystub, statement, offer letter)                                      | **BLOCKED**                  | **Should be ALLOWED** (it is the user's own figure, just sourced from a doc not typed in chat) | **Not in `allowed_numbers`.** `numbers_in()` only reads the chat message, prior user messages, and the conversational `panel` (vision/objective/goals/risks/opps/cons). No document field values are passed in. So a doc number the user never re-typed reads as invented.                                                                                                                                                                         |
| C   | **Tool-generated** (deterministic financial resolver / canonical finance summary — net worth, totals)                                 | **BLOCKED**                  | **Should be ALLOWED** (deterministic, authoritative, non-LLM)                                  | **Not in `allowed_numbers`.** The orchestrator builds context from the `RelationshipManager.converse()` discovery `base` only; the finance resolver / canonical-summary outputs are never threaded into `numbers_in()`. A resolver-computed `$1.35M net worth` would be rejected unless the user happened to type it.                                                                                                                              |
| D   | **Deterministically-calculated** (V5 `derivations`: a computation whose operands are user numbers + unit constants, verified correct) | **ALLOWED** (if it verifies) | Allowed (correct)                                                                              | `verify_derivations`: every operand within 0.5 abs / 1% rel of a `user_value` or `_UNIT_CONSTANTS`, AND `_safe_eval(expr)` matches claimed value within `max(1.0, 5%)`. Result added to allow-set via `_forms()`. **Fails closed** — a single non-user operand (e.g. an assumed 20% down rate, a 7% growth rate, a "6-month" multiplier the user didn't state) sinks the whole derivation, and if the prose cites that figure the turn falls back. |
| E   | **Model-invented** (benchmarks, rules-of-thumb, assumed rates, projections, "$31,200 = 6 months of expenses")                         | **BLOCKED**                  | **Mostly stays blocked** — but a _labeled-general-guidance_ lane should be allowed (see §4)    | The catch-all: `invented = {n for n in used if n not in allowed}`. Any figure not user-sourced and not verified-derived is rejected. This correctly stops fabricated _user-specific_ figures; it also over-blocks legitimately useful general benchmarks the model never claims as the user's own.                                                                                                                                                 |

**Headline:** Paths **A** and **D** are allowed and correct. Paths **B** and **C** are _wrongly_ blocked —
they are real, deterministic, non-fabricated numbers that simply never reach `allowed_numbers` because of a
wiring gap, not a policy decision. Path **E** is the genuine fabrication risk and is the _only_ one that
should remain (mostly) forbidden.

---

## 3. Complete catalog of number-validation fallbacks (all versions)

**Reason-string tally across all raw files:** 72 × `invented numbers not in context`, 2 ×
`relationship mentioned but the user's graph has no edges` (the only non-number gate that fired). Below,
every fallback turn is listed with its rejected token(s) and the _likely intended computation_ (inferred
from the scenario input — the figure the model was reaching for and could not ground).

### `lifenavigator.json` — base V-series run (5 fallbacks / 50)

| id     | rejected          | likely intended computation                                                                                                                                                                      |
| ------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| fin-05 | `7000`, `72000`   | Echoing `$7k` checking and spouse `$72k` salary — **false positive**: user's own numbers, pre-`_expand_money_forms` k-expansion bug.                                                             |
| car-09 | `25000`           | `$40k` equity ÷ 4yr vest ≈ **$10k/yr**, or annualized comp delta — an assumed split of the 409A value.                                                                                           |
| crs-03 | `40`              | Pct of pay / years-to-pension framing; bare `40` ≥ … no — actually `\b\d{3,}\b` shouldn't catch `40`; this is a `%`/`$` adorned `40` (e.g. "$40k pension delta" or "40% of"). Assumed magnitude. |
| crs-04 | `120000`, `60000` | `$120k income` echo + "cutting roughly in half" → **$120k/2 = $60k**. Intended a halving computation; `$60k` un-grounded operand.                                                                |
| crs-07 | `15`              | 4%-rule / withdrawal years; `$900k`→ assumed years of runway or a withdrawal-rate figure.                                                                                                        |

### `lifenavigator_v3.json` — expose reasoning (2 fallbacks / 50)

| id     | rejected | likely intended computation                                                                                                         |
| ------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| edu-03 | `18`     | PMP payoff: `$90k − $72k = $18k/yr` raise vs `$1,500` cost → **breakeven ≈ 1 month**; the `$18k` delta un-grounded as a bare value. |
| crs-03 | `40`     | Same as base — pension/comp magnitude.                                                                                              |

### `lifenavigator_v4.json` — grounded advice (7 fallbacks / 50)

| id     | rejected         | likely intended computation                                                                                                                                         |
| ------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| fin-07 | `220`            | `$250k` inheritance − `$30k` student loans = **$220k** remaining to deploy. A correct user-number subtraction, but emitted as prose not a derivation → un-grounded. |
| fin-08 | `45`             | `$60k` bonus − `$15k` CC debt = **$45k** to split. Same: real subtraction, no derivation.                                                                           |
| car-02 | `33`             | `$168k − $135k = $33k` raise. Real delta, un-grounded.                                                                                                              |
| car-09 | `10`, `15`, `25` | `$40k/4yr = $10k/yr` equity; comp-delta components. Assumed/derived splits.                                                                                         |
| crs-03 | `40`             | Pension/comp magnitude.                                                                                                                                             |
| crs-04 | `60`             | `$120k / 2 = $60k` halved income.                                                                                                                                   |
| crs-07 | `15`, `4`        | 4%-rule (`4`) and a derived runway/withdrawal years (`15`).                                                                                                         |

### `lifenavigator_v5.json` — grounded math verifier (12 fallbacks / 50; 11 number + 1 relation)

| id     | rejected                               | likely intended computation                                                                                                                                              |
| ------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| fin-01 | `124000`, `20`, `5`                    | **20%** down on `$620k` = **$124k**; **5%** closing — classic assumed-rate benchmark. The `20`/`5` are not user numbers → derivation rejected, prose figure un-grounded. |
| fin-03 | `2400`                                 | Employer match: `6% × $85k = $5,100`, or `50% × ...`; `$2,400` an assumed annual match/interest figure.                                                                  |
| fin-05 | _relationship_                         | Non-number gate: claimed a connection with no graph edges.                                                                                                               |
| fin-08 | `45000`                                | `$60k − $15k = $45k` (the V4 `45` now in full form) — real subtraction, emitted in prose.                                                                                |
| fin-09 | `36000`, `54000`, `76000` (+ relation) | `$130k − ($18k + 529 growth)` college-gap projections; growth/return assumptions → un-grounded operands.                                                                 |
| fin-11 | `50`                                   | `45% × $700k ≈ $315k` concentration; `50` an assumed/rounded concentration or cap-gains rate.                                                                            |
| car-07 | `72500`                                | `$145k / 2 = $72,500` for a 6-month unpaid sabbatical (half-year salary forgone). Real halving, un-grounded.                                                             |
| car-09 | `140000`                               | `$130k + $10k/yr` equity ≈ effective comp; assumed total-comp figure.                                                                                                    |
| edu-01 | `304000`                               | MBA total cost: `$140k tuition + 2 × $82k forgone income = $304k`. **Correct user-number arithmetic** emitted in prose, not as a verified derivation.                    |
| crs-03 | `40000`                                | `$200k − $160k = $40k` raise (the long-running `40`).                                                                                                                    |
| crs-07 | `1.67`                                 | Withdrawal math: `$55k / $900k ≈ 6.1%`, or runway ratio `~1.67` — a derived ratio.                                                                                       |
| crs-10 | `20000`                                | `$90k net − $110k forgone salary = −$20k`; or financing/cash-flow delta. Real subtraction.                                                                               |

### `lifenavigator_v6.json` — graceful degradation (5 fallbacks / 50; survivors after repair-retry)

| id     | rejected          | likely intended computation                                                                                                                         |
| ------ | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| fin-03 | `2550`            | Employer match `50% × 6% × $85k = $2,550` — a **correct verified-able** product, but `50%`/`6%` as bare operands + prose emission slipped the gate. |
| fin-09 | `54000`, `76000`  | College-gap projections (growth-rate assumptions).                                                                                                  |
| car-04 | `205000`, `55000` | Relocation: `$150k + $80k partner − COL`; `$25k raise → $150k`; assumed COL-adjusted figures.                                                       |
| edu-01 | `304000`          | `$140k + 2×$82k = $304k` MBA total — same correct arithmetic, repair did not convert it to a derivation.                                            |
| fam-02 | `150000`          | `$300k assets / 2 = $150k` split. Real halving, un-grounded.                                                                                        |

### `lifenavigator_claude_v6.json` — Claude inside LN pipeline (6 fallbacks / 50)

| id     | rejected               | likely intended computation                                                                                                                                                       |
| ------ | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| fin-04 | `000`, `14`, `15000`   | Retirement projection: `$1,500/mo × 12 = $18,000/yr`; `$15,000` and a `14`-yr horizon (`62 − 47 = 15`); `000` = a **tokenization artifact** of a comma'd large number → spurious. |
| fin-07 | `401`                  | **False positive** — "401k" matched `\b\d{3,}\b` as the bare number `401`. Not a financial figure at all.                                                                         |
| car-02 | `24`                   | `$168k − $135k = $33k`; `24` likely a derived % raise (`33/135 ≈ 24%`).                                                                                                           |
| edu-02 | `100`, `220`, `220000` | `$55k/yr × 4 = $220k` private-school total; `100` a rounding/percent artifact. Real ×4 multiplication, un-grounded.                                                               |
| edu-04 | `10`, `15`             | Loan payoff horizons/avalanche ordering (`5.5%`/`8.2%` → derived years).                                                                                                          |
| crs-03 | `120000`, `25`         | `$200k − $160k`; pension-value framing; `25` a derived %/years.                                                                                                                   |

### Patterns the catalog reveals

1. **The biggest single class is _correct arithmetic on the user's own numbers, emitted as prose instead
   of a `derivations` entry_** (fin-07 `220`, fin-08 `45`/`45000`, car-02 `33`, edu-01 `304000`, car-07
   `72500`, fam-02 `150000`, edu-02 `220000`, crs-04 `60`, crs-03 `40000`). These are _Path D done right_
   that the model failed to _route_ through the derivation channel. **They are recoverable with zero trust
   cost** — the math is verifiable; only the plumbing (prose vs structured derivation) failed.
2. **The second class is genuine assumed rates** (fin-01 `20`/`5` down/closing %, fin-09/fin-11 growth &
   concentration rates, fin-03 match %). These are _Path E_ — benchmarks/rules-of-thumb. Correctly blocked
   as the user's figure; candidates for the labeled-guidance lane (§4).
3. **False positives still exist** (fin-07 `401` from "401k"; fin-04 `000` tokenization; the early k-bug
   `7000`/`72000`). The `\b\d{3,}\b` rule and naive comma-stripping over-trigger.

---

## 4. Benchmark impact — the number gate is the dominant remaining platform cost

Each fallback replaces an enhanced reply (≈ **7–8**) with a generic deterministic reply (≈ **1.7**) — a
per-turn loss of ~5.5–6.5, i.e. **~0.11–0.13 on the all-50 overall** per fallback. The established findings:

- **V5** added grounded math, which _increased_ computation and therefore fallbacks **7→12**; the all-50
  score **regressed 6.29→5.83** even though **enhanced-only hit 7.28** (the best LN had produced). The
  all-or-nothing fallback converted every grounding miss into a zero-quality turn
  (`ADVISOR_V5_RESULTS.md`).
- **V6** added repair-not-reject, cutting fallbacks **12→5** and lifting all-50 to its arc high **6.66**
  with trust **8.5** — but it plateaued short of 7.5 (`ADVISOR_V6_RESULTS.md`).
- **Claude control (`CLAUDE_CONTROL_EXPERIMENT.md`):** Claude inside the identical LN pipeline scored
  **7.30** overall, but on the **44 non-fallback turns scored 8.08 — parity with raw Claude (8.00)**. The
  6 fallbacks (~1.7 each) account for essentially the entire 7.30→8.0 gap. The experiment attributes
  **"almost the entire 0.70-point platform cost to the validator's number gate"** — prompt, composer,
  compliance, and structure cost ~0 on turns that pass. **Enhanced-only parity with raw Claude is the
  proof that the number gate is the single dominant remaining platform cost.**

**The established finding, restated:** once you control for model capability, the number gate's
all-or-nothing fallback is _the_ recoverable platform suppressant. It is also a _benefit_ — the gate caught
**3 fabrications raw Claude made** (fin-01, car-06, crs-08), giving LN+Claude **0 fabrications**. So the
goal is not to remove the gate; it is to stop it from discarding _grounded_ turns.

---

## 5. Recommendations — safe expansions vs what must stay forbidden

### SAFE to allow (recovers fallbacks at zero or negative trust cost)

1. **Thread document-derived numbers into `allowed_numbers` (Path B).** When the user has uploaded docs,
   pass the extracted field _values_ (the Document/DocumentField numbers) through `numbers_in()` so the
   advisor may echo the user's _own_ paystub/statement/offer figures. These are the user's data; blocking
   them is a wiring gap, not a policy. **Trust-neutral** — same provenance class as typed numbers. Add a
   `numbers_from_documents` source to `AdvisorContextBuilder.build()` alongside `prior_user_msgs`.

2. **Thread tool/resolver-generated numbers into `allowed_numbers` (Path C).** Feed the deterministic
   finance resolver / canonical-summary outputs (net worth, account totals, monthly cash flow) into the
   allow-set and surface them in `numbers_you_may_reference`. These are deterministic, authoritative,
   non-LLM figures — strictly _more_ trustworthy than user free-text. **Trust-positive.** This also lets the
   advisor engage real account data instead of deflecting.

3. **Close the "correct arithmetic emitted as prose" gap (Path D plumbing).** The largest fallback class is
   verifiable user-number arithmetic the model wrote in prose instead of a `derivations` entry. Two fixes,
   both trust-neutral:
   - **Strengthen the V6 repair-retry to _convert_, not just _drop_:** when prose contains an un-grounded
     number that _would_ verify as a derivation from user numbers, instruct the repair pass to move it into
     `derivations` (it then passes the existing verifier). Recovers fin-07/fin-08/car-02/edu-01/car-07/
     fam-02/crs-04/crs-03/edu-02 with no policy change.
   - **Optionally, post-hoc verify prose numbers:** attempt to factor each rejected prose number as a simple
     operation over user numbers + unit constants; if it verifies, allow it. This generalizes the derivation
     verifier to un-annotated arithmetic. Trust guarantee unchanged (still must verify exactly).

4. **Widen `_UNIT_CONSTANTS` (advisor_math).** The current set `{12, 52, 365, 100}` is too narrow for
   common, _value-neutral_ financial constants. Safe additions (pure unit/time conversions, not opinions):
   `4` (quarters/yr; the 4%-rule denominator pattern shows up repeatedly in crs-07), `1000`/`1_000_000`
   (k/M scaling already handled in expansion but useful as operands), `26`/`24` (bi-weekly/semi-monthly pay
   periods). Keep these _time/unit_ constants only — they let `$5,200/mo × 12` and `$1,500/mo × 12` ground
   without admitting any opinion. **Do NOT** add rates (no 4%/7%/20%) to constants — those are Path E.

5. **Allow benchmark numbers ONLY when explicitly labeled as general guidance, never as the user's figure.**
   Add a separate output channel (e.g. `general_benchmarks: [{statement, basis}]`) rendered with a fixed
   prefix like _"As a general rule of thumb (not your specific numbers): a 20% down payment on a home of
   this price would be ~$124k."_ The gate permits numbers in this channel only when the surrounding text
   carries the guidance marker and the number is **not attributed to the user** (no "your", no "you have").
   This recovers fin-01/fin-09/fin-03-style turns where the _useful_ content is a benchmark, while keeping
   the user-specific allow-list intact. The marker is the trust boundary: a labeled rule-of-thumb is honest;
   the same number presented as the user's own would still be blocked.

6. **Fix the false positives.** Stop `\b\d{3,}\b` from matching `401` in "401k" (require the digit run not be
   immediately followed by `k`/`b`/`(c)`-style suffixes that denote account types), and fix the comma-split
   `000` artifact (tokenize full comma-grouped numbers before stripping). These are pure precision fixes —
   they remove rejections of things that were never financial figures (fin-07 `401`, fin-04 `000`).

### MUST stay forbidden (the irreducible trust core)

- **Model-invented _user-specific_ figures.** Any number attributed to the user ("you have", "your net
  worth is", "you'll save") that is neither in `allowed_numbers` (Paths A/B/C) nor a verified derivation
  (Path D) stays blocked. This is the guarantee the Claude control proved valuable (caught 3 raw-Claude
  fabrications). No relaxation here.
- **Assumed rates dressed as the user's reality.** A down-payment %, growth rate, return assumption, or
  benchmark may only appear in the _labeled general-guidance_ lane (#5) — never woven into a personalized
  projection as if it were the user's own input.
- **Derivations with non-user operands or wrong math.** The `verify_derivations` invariant
  (operands ∈ user_values ∪ unit_constants, arithmetic verified within tolerance) is the spine — keep it
  exactly. Widening unit constants (#4) must stay restricted to value-neutral time/unit factors.

### Net effect (projected)

Recovering the Path-D-plumbing fallbacks (#3) alone clears the bulk of the catalog
(9+ of the recurring turns). Adding Paths B/C (#1, #2) and the false-positive fixes (#6) removes the
remaining false rejections. Per the Claude control's own arithmetic — _"clear those [6] fallbacks and
LN+Claude is ~8.0"_ — these changes convert the proven enhanced-only parity (8.08) into the all-50 score,
**with no further trust relaxation**, because every recovered number is either the user's own,
deterministic/tool-sourced, verified arithmetic, or honestly labeled as general guidance.
