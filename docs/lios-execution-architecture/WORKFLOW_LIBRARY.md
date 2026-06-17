# LIOS Workflow Library

> **Design/spec only — Phase 3.** No code, no Gemini wiring, no runtime, no Vertex, no beta change, no deploy.
> This is the canonical set of end-to-end workflows a future orchestration layer will execute; it invents no
> agent responsibility and lets nothing bypass Compliance.
>
> **Derived from:** `EXECUTION_ARCHITECTURE.md`, `ORCHESTRATION_ENGINE.md`,
> `docs/lios-agent-specifications/AGENT_INTERACTION_CONTRACTS.md`, `DECISION_LIFECYCLE.md`, and the eleven task
> prompts in `docs/lios-prompt-operating-system/tasks/*.md`. Where a workflow specializes a turn, it ties to
> exactly one task prompt; the task prompt is the source of truth for that workflow's risk posture, tools, and
> missing-data gate.

---

## 0. How to read this document

Each workflow is one **deterministic DAG** the Orchestrator sequences. Every workflow obeys the same six
inherited invariants (`EXECUTION_ARCHITECTURE.md` §5):

1. The LLM is never the source of truth; never persists; never faces the user.
2. No fabrication — allowed-numbers, citation contract, evidence-or-nothing.
3. Compliance is mandatory and unbypassable **before** any user-facing text.
4. The call graph is a DAG — no agent calls another directly; agents `escalate` and the Orchestrator routes; chains are hop-bounded.
5. Numbers come only from deterministic Tool Execution (with a `calculation_trace`) or the user's data.
6. Every stage is observable; the deterministic floor guarantees a safe response on any failure.

**Two stages are implicit in every DAG below and are not repeated in each diagram:**

- **Stage 0 — the deterministic turn** (Relationship Manager) runs _first_, before any LLM agent — the trust floor.
- **Audit** runs in parallel at every stage and bookends the turn.

Also always present (per `ORCHESTRATION_ENGINE.md` §3): Orchestrator, Memory/Context, Compliance, Response Composer.
Only the **Response Composer** (post-Compliance) emits user-facing text.

### Per-workflow template

Every workflow specifies: **Task prompt** · **Agents (the DAG, parallel groups marked `∥`)** · **Tools (deterministic, in order)** · **Graph usage (query / skip / required)** · **Compliance (risk level + boundary/caveats)** · **Outputs (assembled response shape)** · **Missing-data gate (what must be present before modeling)**.

### Risk legend

`low` · `medium` · `high` · `regulated`. **`regulated` = the advice boundary** — frame + refer, never direct.
Two domains are **refusal-first**: **medical** (clinical) and **tax/legal** (directive/interpretation/drafting).
Estate and insurance are **readiness + frame-and-refer**, not legal/insurance advice. Healthcare coverage is
**logistics/cost only — no clinical content, ever.**

---

## 1. Onboarding

> **Task prompt:** none of the eleven task prompts (these are decision/domain tasks); onboarding is the
> _Discovery Pattern_ entry — see `MULTI_AGENT_EXECUTION_PATTERNS.md` §5. It establishes the data the other
> ten workflows consume.

A first-contact / cold-start turn. Goal: establish identity, discover goals, surface the highest-value
missing data — **candidate-only, never persisting without confirmation** (the deterministic turn owns any
confirmable write).

```
det_turn ─▶ intent(discovery) ─▶ Onboarding ─▶ Goal Discovery ─▶ Goal Conflict
                                     │                              │
                                     ▼                              ▼
                                 Missing Data ───────────────▶ Compliance ─▶ Response Composer
```

- **Agents:** Onboarding → Goal Discovery → Goal Conflict (serial; Goal Conflict needs Goal Discovery's
  output) → Missing Data → Compliance → Response Composer. Memory read throughout.
- **Tools:** none required (no number/projection/write). Tool Execution is _skipped_ unless a confirmable
  outcome is staged via the deterministic turn.
- **Graph usage:** **skip** on a true cold start (empty graph → abstain from relationship claims); **query**
  read-only for a returning user to seed context.
- **Compliance:** `risk_level: low`. Boundary: never assert facts about the user that aren't on record;
  candidate goals are proposals, not stored truth.
- **Outputs:** assumptions (none invented) · missing (ranked, single most-decisive asked) · next-actions
  (the one question to advance discovery). No recommendations, no tradeoffs (nothing modeled yet).
- **Missing-data gate:** n/a for modeling (nothing is modeled). The gate _is_ the work: identify and rank
  the highest-value gap; never guess.

---

## 2. Home Purchase

> **Task prompt:** `tasks/HOME_PURCHASE_TASK.md`. A **decision** — model-not-decide.

```
det_turn ─▶ intent(decision) ─▶ ┌ Finance ──┐
                                │ Family*   │ (∥ — Family only if dependents)
                                └─────┬─────┘
                                      ▼
            Decision Scientist ─▶ Scenario ─▶ Tradeoff ─▶ Compliance ─▶ Response Composer
```

\*Family runs in parallel with Finance only when dependents exist.

- **Agents:** Finance (`∥` Family if dependents) → Decision Scientist → Scenario → Tradeoff → Compliance →
  Response Composer. Recommendation Agent runs **only if** a fully-evidenced action emerges (else not run).
- **Tools (in order):** `affordability` → `cash-flow` → `reserves` — each returns a `calculation_trace`.
  Tool chain is **serial** (data-dependent). Required-tool failure → `blocked`; never hand-compute.
- **Graph usage:** **query** for cross-domain links (housing↔retirement) — and any cross-domain link asserted
  **requires** a cited real edge (citation contract). Skip if no cross-domain claim is made.
- **Compliance:** `risk_level: regulated`. Boundary: **no directive** ("you should buy / you can afford it /
  put down X"); **no computed down-payment % in prose** (untraced → `unsupported_claims`); "not financial
  advice — a licensed CFP / mortgage professional can confirm" caveat travels with the output.
- **Outputs:** evidence (traced figures) · assumptions · missing (ranked) · tradeoffs (per option,
  costs/protects, no winner) · recommendations (only if escalated with evidence) · next-actions (the decisive
  missing input). `decision_frame`, `options[]`, `option_outcomes[]` each with `calculation_trace`.
- **Missing-data gate (before modeling, else `needs_data`):** 1 price · 2 income · 3 savings · 4 monthly
  budget/expenses · 5 existing debt. Reflect any figures given; ask the single most decisive gap; model only
  what is computable.

---

## 3. Retirement

> **Task prompt:** `tasks/RETIREMENT_TASK.md`. A **decision** — projection ≠ promise.

```
det_turn ─▶ intent(decision) ─▶ Finance ─▶ Decision Scientist ─▶ Scenario ─▶ Tradeoff
                                                                                 │
                                                       Compliance ◀──────────────┘
                                                            ▼
                                                   Response Composer
```

- **Agents:** Finance → Decision Scientist → Scenario → Tradeoff → Compliance → Response Composer (strictly
  serial — each consumes the prior).
- **Tools (in order):** `retirement projection` — given age, target age, balances, contributions, expenses,
  projects trajectory / shortfall / surplus under explicitly-stated assumptions, with a `calculation_trace`.
  The LLM never projects, compounds, or annualizes in prose. Failure → `blocked`.
- **Graph usage:** **skip** unless a cross-domain link is asserted (then a cited edge is **required**).
- **Compliance:** `risk_level: regulated`. Boundary: **projection ≠ promise** — every figure framed "under
  these assumptions," never "you will have"; assumptions (return rate, inflation) are first-class with
  provenance `assumption`. **Not advice** — never "retire at 60 / contribute more / move to bonds"; refer to
  a licensed CFP.
- **Outputs:** evidence (traced projection) · **assumptions (visible, first-class)** · missing (ranked) ·
  tradeoffs (retire-earlier vs save-more vs spend-less) · recommendations (none unless escalated with
  evidence) · next-actions. `option_outcomes[]` each carry `calculation_trace` + its `assumptions`.
- **Missing-data gate (else `needs_data`):** 1 age · 2 target age · 3 current savings/401k · 4 contribution ·
  5 expected expenses. Run nothing speculative on partial inputs.

---

## 4. Education ROI

> **Task prompt:** `tasks/EDUCATION_ROI_TASK.md`. A **decision** — ROI is a framework, not a verdict.

```
det_turn ─▶ intent(decision) ─▶ ┌ Education ──┐
                                │ Finance     │ (∥ — Finance frames cost/funding)
                                └──────┬──────┘
                                       ▼
        Decision Scientist ─▶ Scenario ─▶ Tradeoff ─▶ Compliance ─▶ Response Composer
```

- **Agents:** Education (`∥` Finance for cost/funding) → Decision Scientist → Scenario → Tradeoff →
  Compliance → Response Composer. Education names inputs; it does **not** compute ROI itself.
- **Tools (in order):** `ROI / opportunity-cost` — net cost (tuition + foregone income − funding) vs.
  expected uplift, **only when inputs are sufficient** (cost, time, a user-stated impact figure), with a
  `calculation_trace`. If insufficient, the model does not run. Failure → `blocked`.
- **Graph usage:** **skip** unless a cross-domain link (education↔career income) is asserted with a cited edge.
- **Compliance:** `risk_level: regulated`. Boundary: **framework, not verdict** — never "worth it / not worth
  it"; **no ROI/payback figure without the tool trace** (→ `unsupported_claims`); **no invented salary uplift
  or market premium** — the impact figure must be the user's stated number or a cited source.
- **Outputs:** evidence (traced) · assumptions (impact = user's expectation, not a guarantee) · missing
  (ranked) · tradeoffs (cost/time/foregone income vs expected uplift) · recommendations (none unless
  escalated) · next-actions. `options[]` = enroll / defer / alternative.
- **Missing-data gate (else `needs_data`):** 1 program · 2 cost · 3 funding · 4 time · 5 expected career
  impact. Never claim ROI without tool output; expected-impact is the decisive gap if absent.

---

## 5. Insurance Review

> **Task prompt:** `tasks/INSURANCE_NEEDS_TASK.md`. **Readiness + frame-and-refer**, not insurance advice.

```
det_turn ─▶ intent(regulated) ─▶ Family ─▶ Finance ─▶ Decision Scientist ─▶ Compliance ─▶ Response Composer
```

- **Agents:** Family (dependents, beneficiaries, guardianship, who relies on the user — with provenance) →
  Finance (income, debts, existing coverage on record, reserves — every figure traced) → Decision Scientist
  (frames "are we protected?"; **frames, never chooses a policy or amount**) → Compliance → Response Composer.
- **Tools:** `coverage-gap framing tool` (reports _presence/absence_ of coverage on record and frames the
  income-replacement _concept_ against traced income/debts/dependents, with a trace) → `cash-flow / obligation
tool`. Tools report a **gap concept**, never a recommended policy or directive amount. Error → `blocked`.
- **Graph usage:** **query** read-only for dependent/beneficiary relationships from Family records; no
  cross-domain numeric link required.
- **Compliance:** `risk_level: regulated`. Boundary: **NOT insurance advice**; surface the _gap_
  (presence/absence) and frame income-replacement _as a concept_ only; **never name a specific policy,
  product, or coverage dollar amount** as "what you should buy" (→ `unsafe_claims` → repair/block). Caveat:
  "a licensed insurance agent / CFP can size this for your situation."
- **Outputs:** state (protection picture) · known_facts[] (traced) · **gap** (presence/absence vs the concept,
  from the tool) · missing (ranked) · referral · confidence. No directive amount.
- **Missing-data gate (else `needs_data`):** 1 dependents (decisive) · 2 income · 3 existing coverage ·
  4 debts/obligations. Thin data → low confidence → `needs_data`, not a fabricated coverage number.

---

## 6. Estate Planning

> **Task prompt:** `tasks/ESTATE_PLANNING_TASK.md`. **Readiness-only + frame-and-refer**, not legal advice.

```
det_turn ─▶ intent(regulated) ─▶ Family ─▶ Decision Scientist ─▶ Compliance ─▶ Response Composer
```

- **Agents:** Family (assembles the estate picture from documents/facts on record; runs readiness checks;
  **never interprets legal sufficiency or invents instruments**) → Decision Scientist (frames any estate
  decision without deciding it) → Compliance → Response Composer. No Finance/Scenario — this is
  presence/absence readiness, not numeric.
- **Tools:** `estate / trust / beneficiary readiness checks` — presence/absence + freshness of each
  instrument (will, beneficiaries, guardianship, trust, POA). Output is a **readiness state, never a validity
  judgment, never a drafted clause.** Unavailable → `blocked`.
- **Graph usage:** **query** read-only for beneficiary/guardianship designations on record. No numeric modeling.
- **Compliance:** `risk_level: regulated`. Boundary: **NOT legal advice** (never "you must / should set up a
  trust"); **never interpret legal validity** (presence on record ≠ validity); **never draft instruments**.
  Caveat: "not legal advice; an estate attorney can confirm validity and what your situation needs."
- **Outputs:** state (`estate_readiness`, `trust_readiness`, `beneficiary_readiness`, `guardianship_readiness`,
  POA presence) · risks[] (evidenced gaps, e.g. "no will on record") · missing[] (ranked) · freshness ·
  referral · confidence (provenance-weighted: on_record > user_stated > inferred).
- **Missing-data gate (else `needs_data`):** 1 will status · 2 beneficiaries · 3 guardianship · 4 trust ·
  5 POA. Report only what the record shows; name unknowns as gaps to confirm, never invented "missing" facts.

---

## 7. Career Change

> **Task prompt:** `tasks/CAREER_CHANGE_TASK.md`. A **decision** — frame tradeoffs, never advise the choice.

```
det_turn ─▶ intent(decision) ─▶ ┌ Career ───┐
                                │ Finance*  │ (∥ — Finance only when income changes)
                                └─────┬─────┘
                                      ▼
            Decision Scientist ─▶ Tradeoff ─▶ Compliance ─▶ Response Composer
```

- **Agents:** Career (role, comp, tenure, market position on record; names missing inputs; does **not**
  compute benchmarks) `∥` Finance (income/cash-flow impact, only when income changes) → Decision Scientist →
  Tradeoff → Compliance → Response Composer.
- **Tools (in order):** `comp / compensation comparison` (current vs alternative, **only when role / level /
  region / comp exist**) → `cash-flow` via Finance (income-change impact, when comp present). No benchmark
  computed in-agent or prose. Short inputs → name the gap, don't invent a salary. Failure → `blocked`.
- **Graph usage:** **query** read-only for career-position context; cross-domain (career↔finance) link needs a
  cited edge if asserted. Otherwise skip.
- **Compliance:** `risk_level: low`/`medium` (career is not regulated-advice) — but the advice boundary still
  holds: **frame, don't direct** (never "take it / leave / stay"); **no invented market outlook** (ungrounded →
  `unsupported_claims`); **no derived comp in prose** (e.g. "that's 18% more" — must come from the tool trace).
- **Outputs:** evidence (traced comp delta if modeled) · assumptions · missing (ranked) · tradeoffs
  (comp/stability/growth/risk per option) · recommendations (none unless escalated) · next-actions.
- **Missing-data gate (else `needs_data`):** 1 current role/level · 2 current comp · 3 stability context ·
  4 the alternative · 5 timeline. No invented market figures.

---

## 8. Debt Payoff

> **Task prompt:** `tasks/DEBT_PAYOFF_TASK.md` (companion: `tasks/EMERGENCY_FUND_TASK.md` for the
> liquidity-first safety basic). A **regulated** financial task; **evidence-or-nothing** for any rec.

```
det_turn ─▶ intent(decision) ─▶ Finance ─▶ Decision Scientist ─▶ Tradeoff
                                                                    │
                                            Recommendation? ◀───────┘   (ONLY if ≥1 evidence item)
                                                  │
                                            Compliance ─▶ Response Composer
```

- **Agents:** Finance (debt facts + cash-flow; surfaces debt risks/opps) → Decision Scientist (frames
  pay-off-vs-invest) → Tradeoff (per-dimension comparison from traced outcomes; never a verdict) →
  **Recommendation (ONLY IF a concrete, fully-evidenced action emerges — mints a rec WITH basis)** →
  Compliance → Response Composer.
- **Tools (in order):** `debt-analysis tool` (totals, weighted APR, payoff orderings — avalanche/snowball as
  _framings_ — each with a trace) → `cash-flow tool` (surplus available to direct at debt vs investing).
  Never derive a payoff figure or percentage in prose. Error → `blocked`.
- **Graph usage:** **skip** (single-domain finance) unless a cross-domain link is asserted with a cited edge.
- **Compliance:** `risk_level: regulated`. Boundary: **not financial advice** caveat; **no directive** ("you
  should pay off X" → `reject`) — surface as an evidenced _risk_ or route a _recommendation with basis_
  instead; **no computed payoff numbers in prose**; a recommendation must carry ≥1 evidence item or it is
  dropped (evidence-or-nothing). Referral: "a CFP can confirm for your situation."
- **Outputs:** state (totals, weighted APR, surplus — traced) · known_facts[] · risks[] (evidenced) ·
  tradeoff (cost / risk / flexibility, no new numbers) · recommendation? (only if evidenced:
  `{rec_type, narrative, evidence[], assumptions[], missing_inputs[]}`) · missing_data[] · referral · confidence.
- **Missing-data gate (else `needs_data`):** 1 balances · 2 APRs (decisive) · 3 minimums · 4 income ·
  5 reserves (liquidity is a safety basic — name it first if unknown). Thin data → `needs_data`, not a plan.

---

## 9. Family Protection

> **Task prompt:** `tasks/FAMILY_PROTECTION_TASK.md`. **Regulated (insurance + legal)** — surface gaps,
> frame the concept, refer; readiness + frame-and-refer.

```
det_turn ─▶ intent(regulated) ─▶ ┌ Family ───┐
                                 │ Finance*  │ (∥ — Finance frames income-replacement as a concept)
                                 └─────┬─────┘
                                       ▼
             Decision Scientist ─▶ Compliance ─▶ Response Composer
```

- **Agents:** Family (dependents, beneficiaries, guardian, coverage on record; runs readiness/gap checks;
  **never gives legal/insurance advice or invents members**) `∥` Finance (frames income-replacement as a
  _concept_, not a policy rec) → Decision Scientist (frames any protection decision without deciding) →
  Compliance → Response Composer.
- **Tools:** `protection-gap analysis` — presence/absence checks (will on record? beneficiaries set? guardian
  named per minor? coverage on record?). Output is a readiness/gap state, **not a recommended amount.** If
  income-replacement is framed numerically, the income figure comes from a Finance fact/tool trace — never a
  prose-estimated "you need $X." Failure → `blocked`.
- **Graph usage:** **query** read-only for dependent/guardian/beneficiary relationships on record.
- **Compliance:** `risk_level: regulated`. Boundary: **not insurance advice** (no "buy $1M term / this
  policy / this amount") — frame income-replacement as a concept; **not legal advice** (never interpret
  designation validity); **never invent dependents or coverage** (a surfaced gap must trace to evidence).
  Caveats: "not insurance/legal advice; a licensed professional can confirm the amount/validity."
- **Outputs:** state (guardianship/estate/beneficiary/coverage readiness) · risks[] (evidenced gaps, e.g. "no
  named guardian for a minor") · opportunities[] · missing[] (ranked) · freshness · referral · confidence.
- **Missing-data gate (else `needs_data`):** 1 dependents · 2 income · 3 existing coverage · 4 beneficiaries ·
  5 guardian. Confirm coverage before any "underinsured" claim; never fabricate a dependent or figure.

---

## 10. Career Change → see §7. Healthcare Coverage (Healthcare)

> **Task prompt:** `tasks/MEDICAL_SAFETY_TASK.md`. **REFUSAL-FIRST safety task — strictest.** This workflow is
> **logistics/cost only; no clinical content, ever.**

```
det_turn ─▶ intent(regulated) ─▶ Health Agent ──(triage)──┐
                                  │ clinical? ─▶ REDIRECT ─┤
                                  │ logistics/cost ─▶ Finance/Family (non-clinical signal)
                                  └────────────────────────┘
                                              ▼
                                  Compliance ─▶ Response Composer
                  (crisis/self-harm signal ─▶ supportive + crisis_resources + flag for escalation)
```

- **Agents:** Health Agent (beta-limited, **clinical-silent**: surfaces NON-clinical readiness signals only;
  **redirects ALL clinical questions**) → for logistics/cost, routes the _cost/coverage presence_ to
  Finance/Family as a non-clinical signal → Compliance → Response Composer.
- **Tools:** non-clinical readiness checks only (coverage/preventive _presence_), each with a trace.
  **Forbidden:** any tool that interprets a clinical value or produces a diagnostic/prescriptive output —
  there is no tool that makes clinical content answerable.
- **Graph usage:** **skip** for clinical (out of scope, not a data gap); **query** read-only only for
  non-clinical coverage presence.
- **Compliance:** `risk_level: regulated` (**strictest**). Boundary: **blocked for any clinical directive or
  interpretation** (diagnosis, prescription, dosage, treatment, lab/vital/symptom interpretation →
  `unsafe_claims` category `medical` → `blocked` → deterministic safe fallback). A clinical request is
  **redirected, never answered then escalated.** "Not medical advice — consult a licensed professional"
  boundary on every output. Privacy-forward (minimum necessary). Crisis → supportive + resources + flag, no
  clinical advice.
- **Outputs:** redirect (supportive, non-alarming) · questions_to_prepare[] (non-clinical, logistics/cost
  only) · crisis_resources? (only on crisis signal) · boundary ("not medical advice") · confidence (for the
  non-clinical readiness portion only; clinical content yields no answer to score).
- **Missing-data gate:** **clinical = n/a (out of scope, not a gap)** — do not gather clinical inputs to
  "complete" a diagnosis; redirect. For logistics/cost only: may name non-clinical inputs (coverage on
  record) as `missing_data`.

---

## 11. Cross-cutting: Tax & Legal Safety overlay

> **Task prompt:** `tasks/TAX_LEGAL_SAFETY_TASK.md`. **REFUSAL-FIRST safety task — strictest.** Not a
> standalone scenario in the ten, but an **overlay** any of the above can trigger (e.g. retirement → Roth
> question; estate → "is my will valid"). Documented here so workflows route correctly.

```
det_turn ─▶ intent(regulated) ─▶ <relevant domain: Finance (tax-touching facts) / Family (estate readiness)>
                                              ▼
                                  Compliance ─▶ Response Composer
```

- **Triage:** _implication-flagging_ (allowed — note a choice has tax/legal implications, surface evidenced
  readiness gaps, frame what a CPA/attorney handles, refer with questions to ask) vs.
  _directive/interpretation/drafting_ (forbidden — **redirect to a CPA / attorney**).
- **Tools:** non-legal readiness/presence checks only (e.g. "beneficiary set?"), each with a trace.
  **Forbidden:** any tool that computes/asserts a tax position as advice or judges legal validity.
- **Compliance:** `risk_level: regulated` (**strictest**). **Blocked** for any tax/legal directive,
  interpretation, or drafting (→ `unsafe_claims` category `tax`/`legal` → `blocked`). Caveat: "not tax/legal
  advice — consult a licensed CPA / attorney."
- **Outputs:** implications (flagged, not resolved) · readiness_gaps[] (evidenced, with provenance) ·
  questions_to_ask[] · referral · boundary · confidence (readiness/implication portion only).
- **Missing-data gate:** directive/interpretation = **n/a (out of scope)** — redirect, do not gather inputs
  to "complete" a position. Readiness/implication framing only may name non-legal gaps.

---

## 12. Workflow → task-prompt → risk index

| #   | Workflow            | Task prompt                                       | Risk       | Decision?  | Refusal-first         | Recommendation stage    |
| --- | ------------------- | ------------------------------------------------- | ---------- | ---------- | --------------------- | ----------------------- |
| 1   | Onboarding          | (Discovery Pattern)                               | low        | no         | no                    | none (candidate-only)   |
| 2   | Home Purchase       | `HOME_PURCHASE_TASK.md`                           | regulated  | yes        | no                    | only if evidenced       |
| 3   | Retirement          | `RETIREMENT_TASK.md`                              | regulated  | yes        | no                    | only if evidenced       |
| 4   | Education ROI       | `EDUCATION_ROI_TASK.md`                           | regulated  | yes        | no                    | only if evidenced       |
| 5   | Insurance Review    | `INSURANCE_NEEDS_TASK.md`                         | regulated  | frame-only | readiness/refer       | none (refer)            |
| 6   | Estate Planning     | `ESTATE_PLANNING_TASK.md`                         | regulated  | frame-only | readiness/refer       | none (refer)            |
| 7   | Career Change       | `CAREER_CHANGE_TASK.md`                           | low/medium | yes        | no                    | only if evidenced       |
| 8   | Debt Payoff         | `DEBT_PAYOFF_TASK.md` (+`EMERGENCY_FUND_TASK.md`) | regulated  | yes        | no                    | **yes, if ≥1 evidence** |
| 9   | Family Protection   | `FAMILY_PROTECTION_TASK.md`                       | regulated  | frame-only | readiness/refer       | none (refer)            |
| 10  | Healthcare Coverage | `MEDICAL_SAFETY_TASK.md`                          | regulated  | no         | **clinical refusal**  | none                    |
| —   | Tax & Legal overlay | `TAX_LEGAL_SAFETY_TASK.md`                        | regulated  | no         | **directive refusal** | none                    |

---

## 13. Invariants this library preserves

1. Every workflow is a DAG sequenced by the Orchestrator; deterministic turn first, Audit always, Compliance
   before the Response Composer (`AGENT_INTERACTION_CONTRACTS.md` §6, `EXECUTION_ARCHITECTURE.md` §5).
2. Decision workflows model, never decide; every figure is a Tool Execution `calculation_trace` or a user
   fact (`DECISION_LIFECYCLE.md` §1).
3. Recommendations are minted only with ≥1 evidence item (`ORCHESTRATION_ENGINE.md` §3 — evidence-or-nothing).
4. `regulated` workflows carry their caveat and refer out; **medical and tax/legal are refusal-first;**
   estate/insurance/family-protection are readiness + frame-and-refer; **healthcare is logistics/cost only.**
5. The missing-data gate runs before any modeling; partial inputs model only the computable and rank the rest.
6. No agent faces the user or the DB; cross-domain links require a cited real edge.
