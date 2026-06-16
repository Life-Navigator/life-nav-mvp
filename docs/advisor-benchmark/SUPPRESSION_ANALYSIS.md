# Suppression Analysis — LifeNavigator Advisor

**Question:** Trace _Model Output → Validator → Compliance → Composer → User_ and show
exactly where content the model generated is **removed** before the user sees it, how much
that suppression costs (or saves) on the benchmark, and which rule is responsible.

**Evidence:** `CLAUDE_CONTROL_EXPERIMENT.md`, `ADVISOR_V5_RESULTS.md`, `ADVISOR_V6_RESULTS.md`;
raw turns `raw/lifenavigator_v5.json`, `raw/lifenavigator_v6.json`,
`raw/lifenavigator_claude_v6.json`, raw reference `raw/claude.json`. Pipeline code:
`app/services/advisor_validator.py`, `advisor_orchestrator.py` (`_enhance`, `_is_repairable`,
`_compose`), `advisor_math.py` (`verify_derivations`).

---

## 1. Pipeline trace — where content is removed

```
                              ┌─────────────────────────────────────────────────────────┐
                              │  MODEL OUTPUT (Gemini-2.5-flash, or Claude behind flag)   │
                              │  JSON: decision_frame, tradeoffs[], what_we_know[],       │
                              │  recommendation, what_we_still_need[], next_question,      │
                              │  why_this_question, summary, derivations[],                │
                              │  relationships_referenced[], candidate_goals/facts        │
                              └───────────────────────────┬─────────────────────────────┘
                                                          │  (None on transient fail → 1 retry; still None → fallback:unavailable)
                                                          ▼
   ┌──────────────────────────────────────────────────────────────────────────────────────────┐
   │  VALIDATOR  validate(result, context)  — the single deterministic trust gate                │
   │  Builds `visible` = frame + tradeoffs + know + recommendation + need + reflection           │
   │                     + next_question + why_question + summary   (EVERY rendered field)        │
   │                                                                                             │
   │  GATE 1  ADVICE/COMPLIANCE  _ADVICE regex over `visible`                                     │
   │          medical / legal / tax / named-product → reason "contains advice…"                  │
   │          (strategic life/finance advice is ALLOWED since V4)                                 │
   │  GATE 2  NUMBER GROUNDING  _financial_numbers(visible) ∉ allowed_numbers                     │
   │          allowed = user's own numbers  ∪  verify_derivations() (advisor_math.py)             │
   │          any $ / % / 3+ digit number not user-supplied and not a verified                    │
   │          computation → reason "invented numbers not in context: [...]"                       │
   │  GATE 3  QUESTION PRESENT  no next_question AND no summary → reason                           │
   │  GATE 4  RELATIONSHIP GROUNDING  _check_relationships()                                      │
   │          cited pair not a real graph edge, or relation asserted with no edge → reason        │
   └───────────────────────────┬───────────────────────────────────┬─────────────────────────┘
                               │ reasons == []                     │ reasons != []
                               ▼ (ACCEPT path)                     ▼ (REJECT path)
   ┌───────────────────────────────────────────┐   ┌──────────────────────────────────────────┐
   │  IN-PLACE REPAIRS (kept content, trimmed)  │   │  _is_repairable(reasons)?                 │
   │  • should_persist → False (always)         │   │  TRUE  if only number/relationship miss   │
   │  • multi-question → keep FIRST "?" only     │   │  FALSE if advice/medical/legal present     │
   │  • drop candidate_goals matching rejected   │   │                                            │
   │  • drop facts whose source ≠ user_message   │   │  TRUE → V6 REPAIR-RETRY: re-ask model to   │
   │  • relationships_referenced → valid edges   │   │   strip the offending number/relationship, │
   │  • derivations → only verified-correct      │   │   re-run SAME gate. Pass → ACCEPT.         │
   └───────────────────────┬───────────────────┘   │  FALSE or repair fails → FALL BACK.        │
                           │                        └────────────────────┬─────────────────────┘
                           ▼                                             │ WHOLE TURN DISCARDED
   ┌───────────────────────────────────────────┐                        ▼
   │  COMPOSER  _compose(safe)                  │   ┌──────────────────────────────────────────┐
   │  Renders the surviving sections as 5-6     │   │  GENERIC DETERMINISTIC FALLBACK            │
   │  markdown blocks. Sections absent → not    │   │  "Let's build your plan together — I'll    │
   │  rendered. Adds scope disclaimer iff a     │   │   ask a few quick questions… what would    │
   │  recommendation survived.                  │   │   you most like your life to look like…?"  │
   │  empty → fallback:empty                    │   │  Scores ~1.7 on the 5-judge rubric.        │
   └───────────────────────┬───────────────────┘   └────────────────────┬─────────────────────┘
                           ▼                                             ▼
   ┌──────────────────────────────────────────────────────────────────────────────────────────┐
   │                                          USER                                               │
   └──────────────────────────────────────────────────────────────────────────────────────────┘
```

**Two distinct kinds of removal:**

1. **Surgical (accept-path) removal** — the turn survives, but specific elements are stripped:
   extra questions trimmed, fabricated-source facts dropped, unsupported relationship citations
   removed, unverified derivations dropped. The user still gets a real, composed answer minus
   the offending fragment. _This is where the validator catches a fabrication yet keeps the
   counsel_ (the beneficial cases below).
2. **Total (reject-path) removal** — one un-repairable rejection discards the **entire** model
   turn and replaces it with the generic opener (~1.7). All of the model's tradeoffs, framing,
   and recommendation are lost over a single offending number. **This is the only material
   suppression cost on the benchmark** (the number gate). It is _all-or-nothing_: the validator
   does not strip the one bad number and keep the rest — `reasons != []` → whole turn dropped
   (unless V6's repair-retry rescues it).

The two-layer trace (`CLAUDE_CONTROL_EXPERIMENT.md` Q3/Q4) proves the cost is localized:
on the 44 non-fallback turns LN+Claude scores **8.08 ≈ raw Claude 8.00**, i.e. the composer,
compliance gate, and response structure cost ~nothing on turns they let through. **~all of the
~0.70 platform drag is the number-gate fallback.**

---

## 2. Concrete suppression cases (from raw fallback / repaired turns)

"Before" = what the model produced and the gate removed; "After" = what the user actually saw.
Number lists are the exact `invented numbers not in context` from each turn's `llm_status`.

| #   | Scenario                                | What the model tried (llm_status reason)                   | Before (removed content)                                                                             | After (user saw)      | Reason                                                                                                                        | Responsible rule                                                                 | Impact                                                                  |
| --- | --------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | **fin-01** (V5) Buy a house             | `invented numbers: ['124000','20','5']`                    | Computed a **20% down = $124k** plan and a ~5-yr reserve figure from the $620k home price            | Generic opener (~1.7) | 20% rate and the $124k/5 derived from it are **not user numbers** and were not in a verified `derivations` entry              | GATE 2 number grounding + `verify_derivations` rejected the assumed-rate operand | **High** — model had all the inputs; high-value Finance turn zeroed     |
| 2   | **fin-03** (V6) Debt vs invest          | `invented numbers: ['2550']`                               | A computed employer-match / payoff figure (**$2,550**) derived from $85k salary × 50% × 6%           | Generic opener (~1.7) | Computed value reached prose but its `derivations` entry didn't verify (operand/rounding mismatch) → not added to allowed set | GATE 2 + `verify_derivations` (operand-trace / tolerance)                        | **High** — survived V5→V6 as a fallback; the canonical recoverable case |
| 3   | **fin-09** (V6) College savings         | `invented numbers: ['54000','76000']`                      | Projected 529 shortfall math (**$54k / $76k**) against $130k projected tuition                       | Generic opener (~1.7) | Projection needs an assumed growth/inflation rate → operand not user-supplied → derivation rejected                           | GATE 2 + `verify_derivations`                                                    | **High** — exactly the "needs an assumed number" class V5 flagged       |
| 4   | **car-04** (V6) Relocation              | `invented numbers: ['205000','55000']`                     | Combined-income / COL-adjusted figures (**$205k**, **$55k**) from $150k + $80k and the 30% COL delta | Generic opener (~1.7) | $205k=150k+80k is verifiable, but $55k (COL adjustment) used a derived/assumed operand → whole turn dropped                   | GATE 2 (one bad operand sinks the turn)                                          | **High** — even a partly-correct derivation is all-or-nothing           |
| 5   | **edu-01** (V5+V6) MBA                  | `invented numbers: ['304000']`                             | Total MBA cost-of-attendance (**$304k** = $140k tuition + ~2×$82k forgone income)                    | Generic opener (~1.7) | Forgone-income total combined user figures but the summed value wasn't presented via a verifying derivation                   | GATE 2 + `verify_derivations`                                                    | **High** — persisted across two versions; clearly recoverable           |
| 6   | **fam-02** (V6) Divorce                 | `invented numbers: ['150000']`                             | Post-split asset figure (**$150k** = half of the $300k marital assets)                               | Generic opener (~1.7) | $300k/2 is trivially groundable, but reached prose without a verified `derivations` entry                                     | GATE 2 + `verify_derivations`                                                    | **Med-High** — sensitive turn; arithmetic is exact yet suppressed       |
| 7   | **crs-07** (V5) FIRE                    | `invented numbers: ['1.67']`                               | A withdrawal-rate / runway ratio (**1.67%** or ×) from $900k vs $55k spend                           | Generic opener (~1.7) | The ratio is a computation that wasn't verified through `derivations`; bare number flagged                                    | GATE 2 + `verify_derivations`                                                    | **Med** — single derived ratio sank an otherwise strong turn            |
| 8   | **car-09** (V5) Equity vs salary        | `invented numbers: ['140000']`                             | A blended-comp figure (**$140k**) reconciling $130k salary + ~$40k equity / 4yr vest                 | Generic opener (~1.7) | Annualized-equity operand assumed; derivation rejected                                                                        | GATE 2 + `verify_derivations`                                                    | **Med** — recoverable with a clean derivation                           |
| 9   | **fin-05** (V5) Emergency fund          | `relationship mentioned but the user's graph has no edges` | Asserted a link between emergency-fund sizing and another goal                                       | Generic opener (~1.7) | User has **no graph edges**; any relationship claim is rejected                                                               | GATE 4 `_check_relationships` (`pairs` empty)                                    | **Med** — recovered in V6 (repair-retry strips the relation claim)      |
| 10  | **crs-03** (Claude V6) Leave stable job | `invented numbers: ['120000','25']`                        | Pension-value / opportunity-cost figures (**$120k**, **25%**) from the $160k→$200k move              | Generic opener (~1.7) | Pension valuation needs assumed multiplier/discount rate → non-user operand                                                   | GATE 2 + `verify_derivations`                                                    | **High** — Claude's reasoning was strong; gate still zeroed it          |

### Beneficial suppression — the validator caught a fabrication (net-positive)

These are **accept-path** (surgical) removals: in the LN+Claude run the turn was rendered
`enhanced`, but the validator stripped a number Claude **fabricated** that is **not in the user
input**. Result: LN+Claude shipped **0 fabrications** vs raw Claude's **3**
(`CLAUDE_CONTROL_EXPERIMENT.md` §4).

| #   | Scenario                               | What raw Claude fabricated (verify vs user input)                                                                                                                                                              | What the gate did                                                                                            | Reason                                                                   | Responsible rule        | Impact                                                                                               |
| --- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ----------------------- | ---------------------------------------------------------------------------------------------------- |
| 11  | **fin-01** (Claude V6) Buy a house     | Raw Claude (`claude.json`) invented **"~$70k reserves"**, **"~28% DTI"**, **"6.5% rates"** — none are in the user's input (income $185k, $95k cash, $40k brokerage, $210k retirement, $2,900 rent, $620k home) | Number gate flagged the invented figures; turn re-run/stripped so only grounded content shipped (`enhanced`) | Each figure is a fabricated `$`/`%` number absent from `allowed_numbers` | GATE 2 number grounding | **Net-positive** — removed 3 fabricated figures, prevented false precision on a high-stakes decision |
| 12  | **car-06** (Claude V6) Counteroffer    | Raw Claude invented the statistic **"50–80% of people who accept counteroffers leave within a year"** — an unsupported quantitative claim, no user/graph source                                                | Gate flagged the **50/80** as numbers not in context; suppressed before user                                 | Fabricated percentages not in `allowed_numbers`                          | GATE 2 number grounding | **Net-positive** — blocked a fabricated external statistic presented as fact                         |
| 13  | **crs-08** (Claude V6) Layoff + family | Raw Claude introduced budget/coverage numbers beyond the user's stated $40k saved, $60k spouse income, 2-month severance                                                                                       | Gate stripped the ungrounded figures; grounded prioritization survived (`enhanced`)                          | Numbers absent from `allowed_numbers`                                    | GATE 2 number grounding | **Net-positive** — kept the actionable steps, dropped invented quantities                            |

> Note: GATE 1 (advice/medical/legal/tax/product) and GATE 3 (must ask a question) fired **~0
> times** across these runs — Claude's strategic advice passed (allowed since V4) and turns
> carried questions. The compliance layer is present and load-bearing for safety, but on this
> benchmark it suppressed nothing measurable. **All suppression observed is GATE 2 (numbers) and
> a little GATE 4 (relationships).**

---

## 3. Net-negative vs net-positive suppression

### Net-NEGATIVE — recoverable number-gate fallbacks (cost the score)

- **What it is:** GATE 2 (and the `verify_derivations` operand/rounding check) rejects a number,
  `_is_repairable` is TRUE, but the repair-retry can't salvage it — so the **whole turn** is
  discarded for the generic ~1.7 opener (cases 1–10).
- **Why it's a loss not a safety win:** in almost every case the rejected figure is a _correct
  computation from the user's own numbers_ that simply wasn't packaged in a verifying
  `derivations` entry, or used one assumed operand (a growth rate, a down-payment %, a COL
  adjustment, a pension multiplier). The math isn't wrong; it's _unverifiable as structured_.
  The all-or-nothing discard then throws away the framing, tradeoffs, and recommendation too.
- **Magnitude:**
  - V5: **12 fallbacks** (6 of 12 in Finance) dragged all-50 to **5.83**; enhanced-only was
    **7.28**. (`ADVISOR_V5_RESULTS.md`)
  - V6 graceful degradation (repair-retry) cut fallbacks **12 → 5**, lifting all-50 to **6.66**
    at trust **8.5**. (`ADVISOR_V6_RESULTS.md`)
  - LN+Claude: **6 fallbacks**, each ~1.7. Remove them and the 44 passed turns score **8.08 ≈
    raw Claude 8.00**. The entire 7.30-vs-8.00 shortfall **is** these fallbacks.
    (`CLAUDE_CONTROL_EXPERIMENT.md`)
- **Verdict:** This is the dominant, **net-negative** suppression — ~0.7 pt of platform drag,
  **fully recoverable** by better degradation (strip the one number / qualitative-ize it and
  keep the validated remainder, instead of discarding the turn) and by getting the model to emit
  groundable derivations. It is an **engineering** problem, not a trust-policy one.

### Net-POSITIVE — fabrication blocks (improved trust, kept the answer)

- **What it is:** the same GATE 2 catching numbers the model _invented_ (cases 11–13 — Claude's
  $70k/28%/6.5%, the 50–80% counteroffer stat, crs-08's budget figures). Here suppression is
  surgical: the offending figure is removed and the rest ships (`enhanced`).
- **Magnitude:** raw Claude shipped **3 fabrications**; LN+Claude shipped **0** at essentially
  equal trust (8.2 vs 8.2) and **no measurable quality drag on those turns**
  (`CLAUDE_CONTROL_EXPERIMENT.md` §4). The platform made a frontier model **safer** for free.
- **Verdict:** **Net-positive.** This is the gate doing its job — the guarantee that _no number
  reaches the user that isn't the user's own or a verified computation from it._ Keep it.

### One thing to NOT relax

`ADVISOR_V5_RESULTS.md` shows LifeNavigator's first trust flag (fin-10) was a _conceptual_ error
("mortgage paydown is a tax-free return") that the number gate **cannot** catch — and Claude was
flagged the same way. So the lever is **not** further loosening the number gate (that lowered
the net score and dropped trust below target in V5). The fix is **graceful degradation** of the
net-negative fallbacks while **keeping** the fabrication-block behavior intact.

**Bottom line:** the validator's number gate is doing two opposite things through the same
mechanism — _helping_ by surgically stripping ~3 fabricated figures (net-positive, keep), and
_hurting_ by discarding ~5–12 whole turns over a single unverifiable-but-correct figure
(net-negative, recoverable). All other layers — compliance, composer, response structure —
suppress nothing measurable on the benchmark.
