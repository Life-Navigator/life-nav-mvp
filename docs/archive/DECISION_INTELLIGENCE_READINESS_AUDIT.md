# DECISION INTELLIGENCE — READINESS AUDIT

Feasibility of true **cross-domain decision intelligence** across Finance · Health · Career ·
Education · Family, given the current platform. Audit only — no implementation.

**State of the world (grounding):** Finance **live (15/15)**, Health **live (15/15)** — both with
evidence graphs, recommendation framework, governance, chat grounding. Career/Education/Family
are **fully architected** (Phase-3 docs) + **X0 data-source audited**, not built. The
**Decision Engine** + **cross-domain ontology** are documented (DECISION_ENGINE_ARCHITECTURE,
CAREER_EDUCATION_FAMILY_ONTOLOGY); the engine **service** + central data are not yet built.

---

## PART 1 — CROSS-DOMAIN QUESTIONS: can the system answer them?

| Question                                    | Needs                                                         | Answerable today? | Unlocks after               |
| ------------------------------------------- | ------------------------------------------------------------- | ----------------- | --------------------------- |
| Should I go back to school?                 | Education ROI + Finance afford/retirement                     | **No**            | Education                   |
| Should I pursue an MBA?                     | Education ROI + Career comp lift + Finance                    | **No**            | Career + Education          |
| Should I switch employers?                  | Career comp/market delta + Finance cash-flow                  | **No**            | Career                      |
| Can I afford law school?                    | Education cost/debt + bar pass + Finance capacity             | **No**            | Education                   |
| Should I move to another city?              | geo across Finance(COL) + Career(market) + Education + Family | **No**            | Career + Education + Family |
| Which certification best advances my goals? | Career skill-gap + cert→role + comp lift                      | **No**            | Career                      |
| Should one parent leave the workforce?      | Family household + Finance survivor/income scenario           | **No**            | Family                      |
| How does a degree impact retirement?        | Education cost/debt + Finance retirement trajectory           | **No**            | Education                   |

**Reading:** none of the eight are fully answerable today — **all require Career/Education/
Family**. But the **infrastructure to answer them is proven** (evidence graph, recommendation +
decision-engine pattern, cross-domain edge model, two live domains). Building the domains lights
these up **without architectural redesign** — that is the whole point of the framework.

---

## PART 2 — REQUIRED DATA FLOWS (edge status)

`live` = emitted in prod · `ready` = endpoint exists, awaits domain/FK · `arch` = designed,
domain unbuilt · `ext` = reverse-direction extension point (needs outgoing-edge support).

| Flow                    | Edge(s)                                                                                                                                   | Status   | Gating                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------- |
| **Career → Finance**    | CareerGoal IMPROVES_COMPENSATION CompensationRecord; JobTarget IMPACTS IncomeSource; CompensationRecord AFFECTS_CASHFLOW CashFlowSnapshot | **arch** | Career build; Finance `income_sources`/`cash_flow_snapshots` tables exist but unpopulated |
| **Education → Career**  | Program QUALIFIES_FOR JobTarget; Certification CLOSES_SKILL_GAP Skill; Degree IMPROVES_JOB_READINESS CareerGoal                           | **arch** | Career + Education                                                                        |
| **Education → Finance** | Program IMPACTS CashFlow/NetWorthSnapshot; Program FUNDED_BY FinancialGoal                                                                | **arch** | Education (Finance side live)                                                             |
| **Health → Career**     | WellnessGoal → productivity/readiness (new bridge)                                                                                        | **arch** | Career; bridge not yet in ontology standard                                               |
| **Family → Finance**    | FamilyGoal FUNDED_BY FinancialGoal; Dependent IMPACTS ExpenseCategory                                                                     | **arch** | Family                                                                                    |
| **Family → Education**  | FamilyGoal(college) FUNDED_BY FinancialGoal / Education cost                                                                              | **arch** | Family + Education                                                                        |
| **Benefits → Health**   | HealthInsurancePlan COVERED_BY EmployerBenefit                                                                                            | **ext**  | reverse-direction; health/finance tables exist                                            |
| **Benefits → Finance**  | MedicalExpense ELIGIBLE_FOR_HSA_FSA HealthSpendingAccount                                                                                 | **ext**  | reverse-direction; health tables exist                                                    |

**Finance↔Health (live today):** finance internal edges + Health user-anchor edges are emitted;
the Health→Finance benefit bridges are extension points. So the _cross-domain machinery_ is
proven on Finance internally; cross-DOMAIN edges await the new domains + outgoing-edge support.

---

## PART 3 — MISSING INFRASTRUCTURE

- **Graph nodes:** all Career nodes (CareerProfile/Role/JobTarget/CompensationRecord/SkillGap/
  Opportunity…), Education nodes (School/Program/ProgramOutcome/EducationROIModel/Tuition…),
  Family nodes (Household/Dependent/ProtectionItem/InsuranceNeed…), and **central** nodes
  (CompensationBand/MarketDemand/Role/Credential). (Some labels exist in the worker enum from
  legacy variants but have no schema/registry mapping.)
- **Relationships:** the cross-domain typed edges (QUALIFIES_FOR, IMPROVES_COMPENSATION,
  cross-domain FUNDED_BY/IMPACTS) — defined in the ontology standard, **not in the worker
  registry / not emitted**. Plus **outgoing-edge support in `merge_cypher_for`** for the
  reverse-direction edges (SECURED_BY/COVERED_BY/ELIGIBLE_FOR_HSA_FSA/ADDRESSES).
- **Recommendation types:** all Career/Education/Family families (specced, unbuilt).
- **Data sources:** the **central reference layers** — JOB_MARKET_INTELLIGENCE (OEWS/O\*NET/ACS)
  and Education (Scorecard/IPEDS/licensure/accreditation): **X0-audited, not ingested**; plus
  the **Compensation Engine** service.
- **Simulations:** the cross-domain **scenario engine** (LifeScenario PROJECTS NetWorthSnapshot;
  what-if degree/job/move/parent-exits/death), **Finance snapshot population**
  (`net_worth_snapshots`/`cash_flow_snapshots` tables exist but are **empty — no snapshot job**),
  retirement projection.
- **Probability models:** completion / employment / promotion probabilities + outcome
  distributions (the honest band inputs).
- **The decision-engine SERVICE:** DECISION_ENGINE_ARCHITECTURE is a **doc** — the leverage
  scoring / conflict arbitration / evidence aggregation **code** does not exist yet.

---

## PART 4 — DECISION ENGINE READINESS

Readiness = % of the **cross-domain decision-intelligence capability** (answering the Part-1
questions, end-to-end, evidence-grounded). Distinct from per-domain completeness.

| Milestone                                                                       | Readiness | What it adds                                                                                                          |
| ------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------- |
| **Current** (Finance+Health live, full architecture, X0 audits, proven pattern) | **~35%**  | platform + 2/5 domains + decision-engine _design_; 0/8 cross-domain questions                                         |
| **After Career**                                                                | **~60%**  | comp engine + job-market layer + Career→Finance; unlocks "switch employer?", "which cert?", partial "back to school?" |
| **After Education**                                                             | **~85%**  | flagship ROI + Education→Career/Finance; unlocks "MBA?", "law school?", "degree→retirement?", "back to school?"       |
| **After Family**                                                                | **~95%**  | household + survivor/income scenarios + Family→Finance/Education; unlocks "parent leave workforce?", "move?"          |

**Honest residual (~5% after Family):** the cross-domain **decision-engine service**, the
**scenario + probability models**, **Finance snapshot population**, and **central-data depth**
are **cross-cutting** — they are _not_ delivered by domain rollout alone and should be built
alongside (Compensation Engine + Job-Market with Career; scenario engine + snapshot job as a
shared sprint). Treat "100%" as: all five domains + decision-engine service + scenario/
probability models + central data live, all at 15/15.

---

## PART 5 — TOP 10 MOAT CAPABILITIES (ranked by impact)

1. **Cross-domain decision intelligence** — one personal graph that answers "what's the
   highest-leverage move across my _whole life_?" No single-domain competitor (a budgeting app,
   a salary site, a college-ranking site) can do this. _The category-defining moat._
2. **Evidence-grounded, graph-traceable answers** — every recommendation cites the facts behind
   it (anti-hallucination gate + provenance). Trust + defensibility competitors can't retrofit.
3. **The compounding personal knowledge graph** — a typed, tenant-safe life graph per user that
   gets more valuable with every datum; a data asset, not a feature.
4. **Explainable scoring (no black box)** — every score decomposes into evidence + assumptions +
   tradeoffs. The trust/regulatory moat; enables advice in regulated spaces.
5. **Governance & safety framework** — medical/legal/financial boundaries + escalation let
   LifeNavigator operate in **regulated domains** (health, law-school debt, estate) that
   competitors avoid; a barrier-to-entry moat.
6. **Defensible data foundation** — cited public-source bands (OEWS/Scorecard/IPEDS), **no
   fantasy or scraped numbers**; legal + accuracy defensibility (the X0 audits encode this).
7. **Reproducible, replayable, versioned recommendations** — persisted + deterministic; enables
   auditability and **regenerable advisor-grade reports** (the Education PDF).
8. **The Domain Framework** — new domains are _configuration, not re-architecture_ (Health
   proved it end-to-end); a speed-to-market moat that compounds across Career/Education/Family
   and beyond (Housing, Legal, Benefits).
9. **Cross-domain scenario + probability simulation** — what-if (degree/job/move/parent-exits/
   death) projected across finance/health/career/family; the "see your future" capability.
10. **Advisor/parent shareable, governed reporting** — consented, redacted, evidence-backed
    report views open a **B2B2C distribution wedge** (advisors, schools, employers) on top of
    the same engine.

**Ranking logic:** #1–#4 are _architectural_ moats (hard to copy, compounding, already partly
built and proven on Finance/Health). #5–#7 are _trust/defensibility_ moats that unlock regulated
markets. #8–#10 are _velocity/distribution_ moats that turn the architecture into reach.

---

## FINAL VERDICT

**Cross-domain decision intelligence is feasible on the current architecture** — the hard part
(evidence graph, recommendation framework, ontology registry, governance, decision-engine
design, two live domains proving the pattern) is **done**. Readiness is **~35% today, ~60% after
Career, ~85% after Education, ~95% after Family**, with a cross-cutting ~5–10% (decision-engine
service + scenario/probability models + central data + snapshot population) to build alongside.
No architectural redesign is required — only execution of the proven domain checklist plus the
shared decision-engine/scenario layer. The moat is the **whole-life, evidence-grounded,
explainable, governed decision graph** — defensible and compounding in a way single-domain
tools cannot match. Audit only; no implementation performed.
