# The Planning-Engine Gap — what "better than MoneyGuidePro / eMoney" requires

> **Owner framing, 2026-10-11:** the calculators being built are the financial-planning engine, and
> the bar is better than MoneyGuidePro or eMoney — not a calculator suite.

A note on sourcing: the competitor capabilities below are described at the level of **what this class
of product does** — goal-based planning with a probability of success, a lifetime household ledger,
what-if comparison, stress testing, tax-aware distribution planning. They are not claims about any
specific product's internals, which I have not inspected. The gap analysis against **our own code**
is read from source and is exact.

## 1. The finding: we have a spine, and it is on the wrong side of the wall

`apps/web/src/lib/trajectory/projector.ts` is **532 lines of month-by-month simulation**, running to
a 720-month (60-year) horizon. It already models:

- cash, taxable investments, retirement balance, HSA balance, home equity
- a list of debts, each with balance, APR and **minimum payment**, amortized monthly
- avalanche application of extra payments
- income growth, inflation, and separate return assumptions for taxable vs retirement
- health premiums and expected out-of-pocket
- decisions applied at a given month, with an event log and per-month metric snapshots

Plus `generator.ts` (170 lines, scenario variants) and `hierarchy-aware-evaluator.ts` (304 lines,
ranking). **That is the beginning of the right architecture.** A planning engine is not a bag of
calculators; it is a year-by-year household ledger from which every displayed number is derived.
Confidence levels, withdrawal sequencing, Roth conversion ladders, stress tests and side-by-side
what-ifs are all _readouts of a ledger_, not separate formulas.

### And here is the problem

|                                                               | Where it lives           | Can the advisor reach it? |
| ------------------------------------------------------------- | ------------------------ | ------------------------- |
| Simulation spine (`projector.ts`)                             | **TypeScript, web tier** | **No**                    |
| Calculation engine (Phases A/B/B2, 37 calculators + 11 rules) | Python, core-api         | Yes (17 wired)            |
| Tax engine (`tax.py`)                                         | Python, core-api         | Yes                       |
| Tax engine (`tax.ts`, stale 2024)                             | TypeScript, web tier     | No                        |

**The spine and the engine are in different languages, on different tiers, and do not know about each
other.** That reframes structural gap #3 entirely: the TS/Python fork is not a tidiness issue to
clean up later — **it is the single thing standing between this and a planning engine**, because
tax-aware multi-year planning requires the ledger and the tax rules in the same process.

Two symptoms of the split, both read from source:

- `projector.ts` expects each debt to carry a `minimum_payment`, while
  `finance.financial_accounts` **has no such column** — which is also why `debt.payoff_plan` is
  blocked. The TS side assumes data the schema does not store.
- `projector.ts` uses `expected_real_return_pct` (real returns) while `assumptions.py`
  `investment_return` is **nominal** — the exact divergence `calculators/base.py` was written to
  document, still live across the boundary.

## 2. Capability gap against the planning-software bar

| Capability                                                                                           | This class of product   | Us today                                                                                      |
| ---------------------------------------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------- |
| **Probability of success** (Monte Carlo, percentile outcomes)                                        | the signature output    | **missing** — single deterministic path; Phase K is last in the plan                          |
| **Lifetime household ledger**                                                                        | the core data structure | partial — exists in TS, unreachable, single-person                                            |
| **Household / couple modelling** (two earners, two ages, survivor)                                   | table stakes            | **missing entirely** — everything we have is single-person                                    |
| **Goals as funded objects** with priority (needs / wants / wishes) and funding order                 | core                    | partial — `candidate_goals` exist but are not funded _in a ledger_                            |
| **Side-by-side what-if comparison**                                                                  | core                    | partial — `generator.ts` + evaluator exist, in TS                                             |
| **Tax-aware withdrawal sequencing**                                                                  | core                    | **missing** — inherently multi-year and order-dependent; needs ledger + tax engine co-located |
| **Multi-year Roth conversion optimization** (fill brackets to the top each year)                     | core                    | **missing** — same requirement                                                                |
| **Social Security claiming optimization** incl. spousal/survivor                                     | core                    | **missing** (Phase F)                                                                         |
| **Stress tests** (sequence-of-returns at retirement, longevity, spousal death, inflation spike, LTC) | core                    | **missing**                                                                                   |
| **Insurance / survivor needs analysis**                                                              | core                    | **missing** (Phase G)                                                                         |
| **Estate flow modelling**                                                                            | eMoney strength         | **missing**                                                                                   |
| **Account aggregation**                                                                              | eMoney strength         | **have it** — Plaid                                                                           |
| **Plan vs actual tracking over time**                                                                | the retention hook      | **missing** — nothing persists a computed plan                                                |
| **Presentable plan deliverable**                                                                     | the sale                | partial — report engine exists                                                                |

### Where we are genuinely ahead, and it is worth being precise about it

These are not features on their roadmap that we got to first; they are **structurally different**:

1. **Non-financial domains in the same model.** Health, career, education and family sit in one life
   graph with finance. MGP and eMoney are finance-only, so a career change is an input you type in;
   here it is a modelled object with its own evidence.
2. **Provenance on every number.** Strict vs scenario tiering, assumption citations, statutory
   authority on determinations. An advisor using planning software reconstructs "what assumptions
   were used" by hand; our figures carry it.
3. **The treatment layer with traps.** Planning software gives you the number. It does not tell you
   that depreciation recapture at 25% is coming, that the pro-rata rule will tax your backdoor Roth,
   or that funding the HSA under the last-month rule starts a 13-month testing period.
4. **Document intelligence.** The plan populates itself from uploads instead of a two-hour intake.
5. **The advisor.** Their output is a plan a human explains. Ours explains itself.

The honest summary: **our differentiation is real and it is not the math.** The math is the table
stakes we do not yet have.

## 3. What this changes in the plan

### A new phase, and it is not optional

**Phase P — the Planning Spine.** Port the month-by-month ledger into Python, co-located with the
tax engine, and make it the substrate every multi-year answer is derived from:

- `LedgerState` — household (not person): two earners, two ages, joint and individual accounts
- year-by-year (and month-by-month where it matters) projection with **tax computed per year by the
  Phase B engine**, not by an assumed flat rate
- goal outflows funded in priority order, so a goal that cannot be funded shows as unfunded rather
  than silently absorbed
- account-type awareness (taxable / tax-deferred / Roth / HSA) so withdrawal ORDER is expressible
- an event log, because "what changed and when" is the explanation

Then `Phase K` (Monte Carlo) is a wrapper over the spine rather than a late add-on, and
`withdrawal_sequencing`, `roth_conversion_ladder`, Social Security optimization and every stress
test become readouts rather than new formulas.

### Re-sequencing

| Was                          | Now                                                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| K (Monte Carlo) last         | **P (spine) then K** — probability of success is the signature output, and it is a wrapper over the ledger |
| #3 TS/Python fork = tidiness | **#3 = the blocking architectural decision**; the spine port IS the resolution                             |
| F (retirement) as formulas   | F becomes ledger readouts — sequencing and conversions are multi-year by nature                            |
| Household modelling          | **new, and ahead of F/J** — single-person math cannot be retrofitted to couples                            |

### The decision this forces

The `tax.ts` port question I flagged in Phase B was the small version of a bigger one: **does the
canonical financial engine live in Python (core-api) or TypeScript (web)?** It cannot be both. Four
instances of the fork are now live — `tax.ts` vs `tax.py`, `projector.ts` vs `money.py`, the seven
`/dashboard/calculators` pages with their own inline `Math.pow`, and `comp_benefits.py`'s hardcoded
HSA/FSA caps.

My recommendation: **Python, in core-api.** The tax engine, the treatment rules, the assumption
registry, the verification gates and the advisor all already live there, and a planning engine must
be where the tax rules are. The web tier renders; it should not compute. That makes `projector.ts`
a port rather than a parallel implementation, and it retires `tax.ts` rather than maintaining two.

---

_Our-code findings read from source 2026-10-11: `projector.ts` 532 lines, `generator.ts` 170,
`hierarchy-aware-evaluator.ts` 304; the `minimum_payment` and real-vs-nominal divergences are live._
