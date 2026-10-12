# Financial Engine — Build-Out Roadmap

> **The bar (owner, 2026-10-11): better than MoneyGuidePro / eMoney.** Not a calculator suite.
>
> This supersedes the sequencing scattered across `BUILD_PLAN.md`, `TAX_TREATMENT_LAYER.md` and
> `PLANNING_ENGINE_GAP.md`. Those keep the design detail; this is the order of work and why.

## 0. Where we actually are (measured 2026-10-12)

|                                      | Count                                       |
| ------------------------------------ | ------------------------------------------- |
| Calculators registered               | **34**                                      |
| Treatment rules (Phase B2)           | **11**                                      |
| Reachable by the advisor             | **17 wired**, 3 ready, 11 blocked on inputs |
| Treatment rules wired to the advisor | **0 of 11**                                 |
| Tests                                | **1,765**                                   |
| Commits unpushed from `origin/main`  | **70**                                      |

Shipped: **A** (primitives, versioned data, consolidation), **B** (8 tax calculators, 29 states,
2026 data sourced from the IRS), **B2-a/b** (account wrappers, debt-interest tracing), **P** (the
year-by-year household ledger), plus the structural work that made any of it reachable.

### The honest read

The differentiation — non-financial domains in one model, provenance on every figure, the treatment
layer's traps, document intelligence, the advisor itself — **is real and is not the math**. The math
is table stakes, and it is roughly half built. The spine exists, which is what makes most of what
follows a readout rather than new arithmetic.

---

## 1. Gate 0 — three things that block everything (do first)

These are not phases. Nothing below ships until they are resolved.

**0.1 Push and get CI green.** 70 commits have never been through CI. Largest untested delta in the
project.

**0.2 Resolve the Fly deploy branch.** The workflow deploys on push to `main`; core-api has been
deploying from `advisor/p0-upgrade-2.3.0`; `main` contains **none** of A/B/B2/P. Until this is
settled, "merged" and "deployed" are different things and nobody knows which.

**0.3 Decide: Python or TypeScript for the canonical engine.** Five live instances of the fork:
`tax.ts`/`tax.py`, `projector.ts`/`planning.ledger`, the seven `/dashboard/calculators` pages,
`comp_benefits.py`'s hardcoded caps, and `recommendations.ts`. Recommendation on record: **Python in
core-api** — a planning engine must be where the tax rules are; the web tier renders, it should not
compute. Every phase below assumes that answer; if it is TypeScript instead, most of this plan is
wrong and should be rewritten before starting.

**Parallel owner/CPA track** (no engineering dependency): verify `tax_tables/2026` credits, the 2024
credits section, `tax_parameters` dependent-care FSA + RMD age, 20 state rates — and replace NJ's and
MD's **copied** joint schedules, which are marked `WRONG` in the file. Flipping two
`_meta.verified` flags then switches everything from 2024 to 2026 law.

---

## 2. The sequence

Ordered by _what the product can do afterwards_, with dependencies respected. Relative sizing only —
S/M/L — because estimates I invent are worth less than the ordering.

### Milestone 1 — "Does my plan work?" (the signature output)

| #   | Work                                | Size | Why here                                                                                                                                                                                                                                                                                                          |
| --- | ----------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 | **K — Monte Carlo over the ledger** | M    | The signature output of this product class. A wrapper, not new math: re-run `project()` with sampled returns. Turns "you'll have $34M" into "92% chance of funding your goals", which is a categorically different statement. Measured: 2.2 ms/path, so 500–1,000 paths is 1–2 s of CPU — see the Fly note below. |
| 1.2 | **Stress tests**                    | S    | Sequence-of-returns at retirement, longevity, spousal death, inflation spike, an LTC event. Each is a ledger re-run with one input changed. Cheap once 1.1 exists.                                                                                                                                                |
| 1.3 | **Side-by-side what-ifs**           | M    | Retire two years later, save $500 more, spend 10% less. `generator.ts` + `hierarchy-aware-evaluator.ts` already do variant generation and ranking in TS — port under 0.3.                                                                                                                                         |

**After this milestone the product can do the thing MoneyGuidePro is bought for.**

> **Fly sizing:** core-api runs `shared-cpu-1x`/512MB. Monte Carlo is CPU-bound and _will_ throttle
> on shared CPU. Either move the plan endpoint to `performance-1x`, run it as a background job, or
> cap at ~250 paths (still a usable band). Memory is a non-issue at 13 MB.

### Milestone 2 — "What should I do about it?" (ledger readouts)

All of Phase F, and all of it is a readout rather than a formula.

| #   | Work                                                                                                                                | Size |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 2.1 | `withdrawal_sequencing` — compare ledgers under different orders; the machinery exists                                              | M    |
| 2.2 | `roth_conversion_ladder` — fill brackets to the top each year against the ledger's own tax                                          | M    |
| 2.3 | Social Security claiming (62 / FRA / 70, spousal + survivor)                                                                        | M    |
| 2.4 | `expense_ratio_drag`, real-vs-nominal toggle, `lump_sum_vs_dca`                                                                     | S    |
| 2.5 | RMD refinement (real uniform-lifetime table; the ledger currently approximates), pension lump sum vs annuity, withdrawal guardrails | M    |

### Milestone 3 — the advisor can actually say it

Largest gap between _built_ and _useful_: **0 of 11 treatment rules reach the advisor**, and 11
calculators are blocked on inputs.

| #   | Work                                                                                                                                       | Size | Unlocks                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---- | ----------------------------------------- |
| 3.1 | Wire `TreatmentResult` into the advisor packet (a `treatments` section — determinations are prose + an amount, not just a number)          | M    | all 11 B2 rules                           |
| 3.2 | Resolver: `monthly_debts` + `debt_minimum_payments` — needs a **migration** (`finance.financial_accounts` has no `minimum_payment` column) | S    | `debt.payoff_plan`, both `housing.*`      |
| 3.3 | Resolver: education inputs (tuition, years, salary before/after)                                                                           | M    | 3 `education.*`                           |
| 3.4 | Per-turn inputs parsed from the message: `monthly_rent`, `capital_gain`, `itemized_deductions`, `down_payment`                             | S    | 4 calculators                             |
| 3.5 | Wire the 3 `ready_to_wire` (`debt.total_interest`, `money.future_value`, `tax.tax_credits`)                                                | S    | —                                         |
| 3.6 | **Persistence** — nothing stores a computed plan or calculation today, so every turn recomputes and the answer cache has nothing to key on | M    | plan-vs-actual, the answer cache, latency |

### Milestone 4 — the acquisition engine (Phase L)

B2-b is done, so `after_tax_cost_of_debt` already exists — the bridge that makes this correct.

| #   | Work                                                                                                                                                                               | Size |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 4.1 | L1 credit & capacity — `credit_tier`, `rate_quote`, `borrowing_capacity`, `qualification_check`, **`credit_improvement_value`** (what a FICO delta is worth _on this purchase_)    | M    |
| 4.2 | L2 asset models — vehicle depreciation, land carrying cost, commercial NOI/cap rate/DSCR, business DSCR                                                                            | L    |
| 4.3 | L3 financing structures — cash (opportunity cost), secured, mortgage, HELOC, pledged-asset, SBA 7(a)/504, seller note, lease, promotional 0% (the deferred-interest trap), blended | L    |
| 4.4 | L4 decisions — `purchase_worth_it`, `financing_optimizer`, `acquisition_impact`                                                                                                    | M    |

**Needs data:** `rate_tables/<year>.json` by product × FICO band. This is the one dataset with no
free authoritative source — likely a vendor feed.

### Milestone 5 — the remaining domains

| #   | Work                                                                                                                                             | Size |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| 5.1 | **C** — `paycheck_net` (removes the `_parse_monthly` guess-from-chat-text path), cash-flow forecast, sinking funds                               | M    |
| 5.2 | **D** — snowball, refinance break-even, revolving minimums, DTI, student-loan IDR/PSLF                                                           | M    |
| 5.3 | **E** — total cost of ownership, PMI, closing costs, ARM resets, HELOC capacity                                                                  | M    |
| 5.4 | **G** — life insurance need (DIME), disability gap, **`hdhp_vs_ppo_total_cost`** (also a J2 input), LTC projection                               | M    |
| 5.5 | **B2-c** — activity character: the STR **7-day rule**, LTR passive losses, SE + QBI, equity comp (ISO/AMT, 83(b), QSBS)                          | L    |
| 5.6 | **H** — net price, aid estimate, 529 projection, loan burden, opportunity cost, completion risk                                                  | M    |
| 5.7 | **I** — equity grant valuation, total-comp NPV, COL adjustment, relocation, `k401_match_value` (real tiered formulas + true-up), `benefit_value` | L    |

### Milestone 6 — the composites

Last because they are integrations. `offer_impact` depends on ~14 calculators across B, C, F, G, I.

| #   | Work                                                                                                                                                                                                                                                                                                                                                                 | Size |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 6.1 | **J1 `college_comparison`** — NPV, IRR, payback, lifetime net-worth delta, loan burden vs starting salary, risk-adjusted for completion                                                                                                                                                                                                                              | M    |
| 6.2 | **J2 `offer_impact`** — the owner's own example. Real spendable delta net of tax _and_ COL; **tax-advantaged capacity captured** (HSA incl. employer seed + payroll FICA exclusion, limited-purpose FSA, real 401k match); net-worth delta; which goal dates move; relocation break-even; **and the deciding variable**, so the advisor explains rather than asserts | M    |

### Milestone 7 — the product around the engine

| #   | Work                                                                            | Size |
| --- | ------------------------------------------------------------------------------- | ---- |
| 7.1 | Goals as first-class funded objects in the UI, with needs/wants/wishes priority | M    |
| 7.2 | Plan-vs-actual tracking (needs 3.6) — the retention hook                        | M    |
| 7.3 | The presentable plan deliverable                                                | M    |
| 7.4 | Estate flow modelling, charitable strategy, wash-sale/TLH, §1031, §121, step-up | L    |
| 7.5 | CPA-referral path for pre-2018 questions (owner: ~10-year history is enough)    | S    |

---

## 3. Decisions the plan needs, and when

| Decision                                                                                                               | Needed by  | Default if unanswered                                               |
| ---------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------- |
| **Python or TypeScript canonical engine**                                                                              | **Gate 0** | Python/core-api; `projector.ts` becomes a port and `tax.ts` retires |
| Monte Carlo path count + where it runs                                                                                 | 1.1        | 500 paths, background job                                           |
| Web calculator pages: remove / repoint / keep                                                                          | any time   | deferred, as recorded                                               |
| `minimum_payment` migration                                                                                            | 3.2        | blocks 3 calculators until done                                     |
| Rate-table data vendor                                                                                                 | 4.1        | L1 cannot ship without it                                           |
| COL index source                                                                                                       | 5.7        | blocks `col_adjustment`, so blocks J2                               |
| Earnings-by-major source (IPEDS is free but coarse)                                                                    | 5.6        | blocks J1's risk adjustment                                         |
| Treatment-layer disclosure posture (a determination is closer to tax advice than a projection is to investment advice) | 3.1        | `diligence` tier on every B2 output + CPA-referral line             |
| Who owns the January data refresh                                                                                      | ongoing    | gates fail every January by design                                  |

---

## 4. What I would NOT build

- **A second projection engine.** If 0.3 lands on TypeScript, port the Python ledger; do not keep both.
- **EITC until sourced and CPA-checked.** Fully refundable, lowest-confidence parameters, and it
  lands on the filers least able to absorb an error. Gated off deliberately.
- **Business valuation.** Multiples are industry- and size-specific and the data is licensed. Ship
  L2's business model as DSCR-and-structure only; a confident company valuation off public multiples
  is the kind of number that destroys trust when it is wrong.
- **Pre-2018 tax years.** Owner decision: ~10 years of history, then refer to a CPA.
- **More calculators before Milestone 3.** The engine is already ahead of what the advisor can
  reach: 34 calculators, 17 wired, 0 of 11 treatment rules. Building more widens that gap.

---

## 5. The discipline that has been catching things

Worth keeping, because it is what has found the real bugs — not code review:

- **Independent verification, never self-consistency.** Simulation, hand-derivation, inverse
  round-trips, published worked examples. This caught the annuity-due convention, the IRR interior
  roots, the gross-up fixed point.
- **Drift gates (10 so far).** Each exists because a specific silent-wrongness already happened.
  They have caught: a stale-year table, an inventory/code mismatch **twice**, a false positive in
  one of my own gates, and a registry that returned 11 calculators instead of 34 because
  `__init__.py` was missing eight modules.
- **Refuse rather than default.** Silent zeros, assumed filing status, assumed ages, unverified tax
  data, a one-item "payoff plan". Every one of these produced a confident wrong answer before it was
  made to raise.
- **Say which figures are the user's own.** STRICT vs SCENARIO is load-bearing, not decorative.

---

_Measured from source 2026-10-12. Counts verified after fixing a registry bug that had
`base.available()` reporting 11 instead of 34._
