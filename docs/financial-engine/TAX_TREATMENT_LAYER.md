# Phase B2 — The Tax Treatment Layer

> **Owner ask, 2026-10-11:** "more detailed rules for taxes need to be included such as HSA, 401K,
> HDHP, 7(a) loans, securities based lending, HELOC, short term rentals, etc."

## 1. This is a rules engine, not another rate table

Everything in Phase B answers **"how much?"** by walking a rate schedule. What is missing answers a
different question — **"what is the treatment?"** — and it does not reduce to a number:

| Question                              | Phase B              | Phase B2                                |
| ------------------------------------- | -------------------- | --------------------------------------- |
| What do I owe on $150k?               | `federal_income_tax` | —                                       |
| Is my HELOC interest deductible?      | —                    | **tracing rule**                        |
| Does my HSA contribution escape FICA? | —                    | **cafeteria-plan rule**                 |
| Is my short-term rental passive?      | —                    | **7-day + material participation test** |
| Can I deduct margin interest?         | —                    | **§163(d) net-investment-income limit** |

A rate table cannot express any of the right-hand column. These are **determinations**: a yes/no or
a character, decided by a test, carrying a limit and usually a trap. They need their own contract.

### The defect that proves the gap

`app/services/comp_benefits.py:23-25`:

```python
FSA_CAP = 3300
HSA_CAP_INDIVIDUAL = 4300
HSA_CAP_FAMILY = 8550
```

Hardcoded annual contribution limits, in source, in the web-facing benefits service — the same
defect class as `BRACKETS_2024`, and invisible to the tax engine. The platform knows some of the
numbers and none of the rules.

## 2. The load-bearing insight: rules are stable, parameters are annual

This is what makes B2 tractable despite the verification problem that gates Phase B.

- **Rules** are statutory structure. §163(d) has limited investment interest to net investment
  income for decades. The HELOC tracing rule has been in place since TCJA. The 7-day short-term
  rental rule is in the regulations. HSA triple-advantage is the design of the account. **These can
  be encoded now, with high confidence, and they do not need annual re-verification.**
- **Parameters** are the dollar amounts bolted onto those rules: contribution limits, HDHP minimum
  deductibles, the acquisition-debt cap, the passive-loss allowance and its phase-out. **These change
  annually and need the same verification gate as the rate tables.**

So B2 splits cleanly: `tax_rules.py` (logic, confident, testable now) over
`data/tax_parameters/<year>.json` (amounts, gated by `require_verified`). A determination can
therefore be _correct about the rule_ and _explicit that the limit is unverified_ — which is far
more useful than refusing to answer, and strictly more honest than a number with no rule behind it.

## 3. The contract: `TreatmentResult`

`CalcResult` carries one figure and one tier. A determination needs more, because **the test that
decided it is the advice**:

```python
@dataclass(frozen=True)
class TreatmentResult:
    rule: str                   # "debt_interest.heloc"
    determination: str          # DEDUCTIBLE | NOT_DEDUCTIBLE | PARTIAL | EXCLUDED |
                                # TAXABLE | DEFERRED | PASSIVE | NON_PASSIVE | INELIGIBLE
    amount: Optional[float]     # the deductible/excludable amount, when quantifiable
    character: Optional[str]    # ordinary | capital_short | capital_long | passive | se_income
    authority: str              # "IRC §163(h)(3)" — what makes this true
    tests: tuple[Test, ...]     # each: name, passed, why, the input that decided it
    binding_limit: Optional[str]# which cap actually bound, when one did
    traps: tuple[str, ...]      # the thing that bites later
    parameters_verified: bool    # False ⇒ the RULE holds, the AMOUNT is unverified
```

Two properties matter more than the rest:

**`tests` is the explanation.** "Your HELOC interest is not deductible" is a dead end. "Not
deductible, because the proceeds went to credit-card payoff rather than improving the residence
(§163(h)(3) tracing) — if you had used it for the kitchen renovation it would have been" is advice
the user can act on, and it is the same computation.

**`traps` is the differentiator.** Every rule in this layer has a delayed cost that generic advice
omits: depreciation recapture at 25% on the rental you were told to depreciate, the pro-rata rule
on the backdoor Roth you were told to do, AMT on the ISO you were told to exercise early, the
testing period on the HSA you funded under the last-month rule. **These are where real money is
lost, and they are invisible at the moment of the decision.** Surfacing them is the single highest-
value output of this layer.

## 4. Taxonomy

### B2-a. Account wrappers — contribution, growth, withdrawal

Each needs: eligibility test, contribution limit, deduction/exclusion treatment, growth treatment,
withdrawal treatment, penalty + exceptions, and the traps.

| Wrapper                    | Rules that must be modelled                                                                                                                                                                                                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **HSA**                    | HDHP eligibility test; limits + 55+ catch-up; **payroll contributions escape FICA, direct ones do not** (a ~7.65% difference nothing in the platform knows); qualified vs non-qualified withdrawal; **last-month rule + 13-month testing period**; no Medicare enrolment; spousal/family coordination; HSA as a retirement vehicle after 65 |
| **HDHP**                   | minimum deductible + max OOP thresholds that define it; the premium-vs-deductible trade that decides HSA access at all                                                                                                                                                                                                                      |
| **FSA**                    | health vs dependent-care vs **limited-purpose** (the only one compatible with an HSA); use-it-or-lose-it + grace period/carryover; no FICA                                                                                                                                                                                                  |
| **401(k)/403(b)**          | elective deferral limit vs **§415(c) total** (employer match does not consume the elective limit but does consume 415(c)); 50+ and **60-63 super catch-up**; pre-tax vs Roth deferral; after-tax → **mega-backdoor**; HCE/ADP testing; loans; **rule of 55**; §72(t); NUA on employer stock; RMDs                                           |
| **Traditional/Roth IRA**   | deductibility phase-out when covered by a plan; contribution phase-out; **backdoor Roth + the pro-rata rule** (the single most commonly botched manoeuvre in personal finance); 5-year rules — _two different ones_; conversion ladders; QCD at 70½                                                                                         |
| **529**                    | state deduction (varies, often recapturable); qualified expenses incl. the K-12 cap; **SECURE 2.0 Roth rollover** + its 15-year/5-year conditions; non-qualified withdrawal = earnings taxed + 10%; superfunding via 5-year gift election                                                                                                   |
| **Solo 401(k)/SEP/SIMPLE** | self-employed contribution base (net SE income less half of SE tax — not gross), limits, deadlines                                                                                                                                                                                                                                          |

### B2-b. Debt interest — deductible, or not, and why

The tracing rules are the whole game here, and they are **purpose-based, not instrument-based**.
The same HELOC is deductible or not depending on what the money bought.

| Instrument                            | Rules                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Mortgage**                          | §163(h)(3) acquisition debt; **$750k cap** (pre-2018 grandfathering at $1M); points; refinance limits                                                                                                                                                                                                                                                                                                  |
| **HELOC**                             | **deductible ONLY if proceeds buy/build/substantially improve the residence securing it** — post-TCJA. Shares the $750k cap. Tracing is by use, so a HELOC that paid off credit cards is not deductible even though it is secured by the home                                                                                                                                                          |
| **Securities-based lending / margin** | **§163(d): investment interest deductible only up to net investment income**, excess carries forward; must itemize; **not deductible at all if proceeds funded personal consumption**. Separately, the reason SBL exists: **borrowing against appreciated stock is not a realization event**, so it defers capital gains indefinitely — and the trap is a margin call forcing a sale at the worst time |
| **SBA 7(a) / 504**                    | business interest, generally deductible; **§163(j) limitation** (30% of adjusted taxable income) with a small-business exception; guarantee fee treatment; owner-occupied CRE allocation between business and investment use                                                                                                                                                                           |
| **Student loans**                     | above-the-line deduction up to a cap, with its own AGI phase-out; MFS ineligible                                                                                                                                                                                                                                                                                                                       |
| **Business/personal mixed use**       | allocation and tracing; a single loan can have interest in three different characters                                                                                                                                                                                                                                                                                                                  |

### B2-c. Activity character — passive, non-passive, or a trade or business

This is where short-term rentals sit, and it is the most consequential and least understood area in
the whole plan.

| Activity                | Rules                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Short-term rental**   | **the 7-day rule**: average stay ≤7 days is NOT a rental activity under Reg. §1.469-1T(e)(3), so with material participation the losses are **non-passive and can offset W-2 income** — the reason STRs are a tax strategy at all. But: Schedule C vs E determines **self-employment tax** exposure; substantial services push it to C; **depreciation recapture at 25%** on exit; the **14-day Augusta exclusion**; QBI eligibility; cost segregation to accelerate depreciation; no §121 exclusion on the rental portion |
| **Long-term rental**    | passive by default; **$25k allowance phasing out from $100k–$150k AGI**; real-estate-professional status (750 hours + more than half of working time); 27.5-year depreciation; §1250 recapture; suspended losses released on disposition; NIIT on net rental income                                                                                                                                                                                                                                                        |
| **Self-employment**     | SE tax on net earnings; half deductible above the line; **QBI §199A 20%** with SSTB limits and W-2/UBIA tests; home office; QJV election                                                                                                                                                                                                                                                                                                                                                                                   |
| **Equity compensation** | RSU at vest = ordinary; **ISO exercise = AMT preference** (the trap that has bankrupted people); NSO spread at exercise; **§83(b) 30-day window**; **QSBS §1202** exclusion; ESPP qualified vs disqualified disposition                                                                                                                                                                                                                                                                                                    |

### B2-d. Cross-cutting, and strongly requested by the shape of the other asks

SALT cap (and the OBBBA change); charitable AGI limits (60/30/20), DAF, bunching, QCD;
**wash-sale rule** and tax-loss harvesting; **§1031 exchange** and its strict timelines;
opportunity zones; **§121 primary-residence exclusion** ($250k/$500k) and the 2-of-5-year test;
**step-up in basis at death** (which inverts most "sell now" advice); annual gift exclusion and
lifetime exemption; estimated-tax safe harbours and underpayment penalties.

## 5. How this composes into the phases already planned

B2 is not an add-on; several planned calculators are **not correct without it**:

- `offer_impact` (J2) — the owner's own example was "HSA with HDHP and limited FSA". Valuing that
  offer requires the HDHP eligibility test, the limited-purpose FSA compatibility rule, and the
  payroll-FICA exclusion. Without B2 it can only add up premiums.
- `financing_optimizer` (L4) — ranking cash vs HELOC vs SBL vs 7(a) by cost of capital is **wrong
  without after-tax cost**, and after-tax cost is entirely a B2 determination. A HELOC at 8%
  deductible can beat a margin loan at 7% non-deductible.
- `purchase_worth_it` (L4) for a rental — the answer turns on activity character, depreciation, and
  recapture, not on the payment.
- `roth_vs_traditional`, `withdrawal_sequencing`, `roth_conversion_ladder` (F) — all pure B2 rules
  sitting on Phase B's marginal rate.
- `college_comparison` (J1) — 529 treatment and the AOTC/LLC interaction.

**Revised sequencing:** B2-a and B2-b should land **before** F and L rather than after, because F
and L consume them. B2-c can follow, since the rental and equity work lands in L and I.

## 6. Scale and honesty

Roughly **35–45 rules**, each with its tests and traps. Larger than Phase B, and higher confidence
in the logic than Phase B had in its data — because statutory structure is stable where dollar
amounts are not.

What I can encode reliably: the rules, the tests, the ordering, the traps, the authority citations.
What still needs sourcing: every dollar threshold, and in particular the OBBBA-era changes (SALT
cap, the child credit, the senior deduction, the 2026 limits), which is exactly where Phase B's
verification gap already sits.

**One posture to settle before building.** A determination like "your HELOC interest is not
deductible because the proceeds paid off credit cards" is closer to tax advice than "your projected
balance is $1.2M" is to investment advice. The settled disclosure posture (subscription, no custody,
no advice fee, diligence disclosure) was decided for _projections_. It should be re-confirmed
explicitly for _determinations_, with the `diligence` tier applied to every B2 output and a
CPA-referral line on anything that turns on a test the user could get wrong. The engine states the
rule and the test; it does not certify the user's facts.

---

_Grounded in the code as of 2026-10-11. The `comp_benefits.py` hardcoded-caps finding was read from
source._
