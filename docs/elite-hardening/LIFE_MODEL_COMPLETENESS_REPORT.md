# LifeNavigator Life-Model Completeness Audit — Elite 20-Person Pilot

**Date:** 2026-06-16
**Scope:** Code-level audit of how much of a complex life the model can capture and use.
**Method:** Read schema (`supabase/migrations`), ontology (`apps/ingestion-worker/src/ontology.rs`, `entities.rs`), core-api domain services (`apps/lifenavigator-core-api/app/domains`), onboarding (`apps/web/src/app/onboarding`), and integrations. Every claim is cited; nothing invented.

---

## 1-Line Verdict + Score

**Verdict:** A genuinely _broad_ multi-domain schema (7 first-class domains, ~80 entity types) wrapped around a _finance-deep / everything-else-shallow_ reality — with a star-topology graph that captures domains but not the cross-domain relationships that define an elite life. **It catalogs your life; it does not yet model how the pieces interact.**

**Score: 5.5 / 10** for elite-life completeness. (Breadth scores ~8; depth-within-domain ~5; cross-domain linkage ~3; elite-specific assets like equity/trusts/private holdings ~2.)

---

## Per-Domain Maturity Table

Legend: **First-class** = dedicated schema + service + UI + capture; **Shallow** = schema exists but thin columns / weak capture; **Stub** = mostly a checklist or placeholder; **Missing** = no model.

| Domain                          | Maturity                              | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finance — core**              | First-class                           | `031_finance_domain.sql`: `financial_accounts`, `transactions`, `assets`, `investment_holdings`, `retirement_plans`, `tax_profiles`, `employer_benefits`. `117_finance_elite_schema.sql`: `liabilities`, `debts`, `cash_flow_snapshots`, `net_worth_snapshots`, `budget_categories`, `income_sources`. Service `app/domains/finance.py` (605 lines) computes net worth (line 157), cash/debt classification (line 134). 17 finance dashboard subpages (`dashboard/finance/{accounts,assets,investments,retirement,tax,budget,risk,...}`).                                                                                                                                                                            |
| **Finance — elite assets**      | **Shallow→Missing**                   | `assets.asset_type` is only `real_estate, vehicle, crypto, collectible, other` (`031_finance_domain.sql:77`). **No equity-comp model at all**: grep for `rsu / stock_option / vesting / grant_date / strike_price / deferred_comp / espp / carried_interest` across schema + services finds only a `has_espp` boolean (`069_intake_logs_and_benefit_profile.sql:177`) and one example string `equity_grant` as a free-text extractable field key (`143_documents_platform.sql:26`). `investment_holdings.asset_class` = `stock, bond, etf, mutual_fund, crypto, reit` (`031:asset_class`) — no private equity / LP interests / pre-IPO. No trust entity (estate "trust" exists only as a document _type_ + boolean). |
| **Health & Wellness**           | First-class                           | `119_health_schema.sql`: 16 tables — `health_profiles, health_goals, vitals, lab_markers, body_metrics, sleep_logs, nutrition_logs, supplement_logs, workout_logs, health_insurance_plans, health_spending_accounts (HSA/FSA), medical_expenses, benefit_deadlines`. Service `app/domains/health.py`. Onboarding `health/page.tsx` is the one section with real inline UI (280 lines).                                                                                                                                                                                                                                                                                                                               |
| **Career**                      | First-class                           | `122_career_schema.sql`: 17 tables — `career_profiles, experience_records, skills, user_skills, skill_gaps, credentials, certifications, degrees, resumes, job_targets, job_applications, interviews, compensation_records, compensation_projections`. Service `app/domains/career.py` + `services/compensation.py`. Real connectors: LinkedIn sync + Credly badges (see Integrations).                                                                                                                                                                                                                                                                                                                              |
| **Education**                   | First-class (light)                   | `127_education_schema.sql`: `education_profiles, learning_paths, schools, programs, program_comparisons`. Service `app/domains/education.py` + `services/education_roi.py`. Onboarding `EducationIntakeSection.tsx` (384 lines). Fewer entity types than career/health but coherent.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Family / Estate**             | **Shallow**                           | `131_family_schema.sql`: `dependents, spouse_profiles, guardianship_plans, estate_plans, insurance_profiles, college_planning`. BUT depth is thin: `dependents` = only `relationship, birth_year, guardianship_plan_id` (no name, no SSN, no special-needs, no cost) (`131_family_schema.sql`). `estate_plans` is a **3-boolean checklist**: `has_will, has_poa, has_beneficiaries, status` (`131_family_schema.sql`). No trust corpus, no asset titling, no executor/trustee entities, no estate-tax exposure. `20260610...beneficiaries_advisors.sql` adds contacts/beneficiaries/advisors. Service `app/domains/family.py` is the _best_ cross-domain reader (pulls finance debts + career value).                |
| **Decision Engine**             | First-class (process, not life-state) | `134_decision_schema.sql`: `decisions` + scenario fan-out. Models _deliberations_, not standing life facts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Documents (capture layer)**   | First-class                           | `143_documents_platform.sql`: `documents, document_fields, document_recommendations`; storage bucket (`145`); triggers (`144`). 24 document types in `DocumentIntelligence.tsx` (Finance/Career/Education/Health/Family groups). Generic field extraction `field_key` (any fact, incl. `equity_grant`, `vested_balance`).                                                                                                                                                                                                                                                                                                                                                                                            |
| **Benefits**                    | Shallow                               | Router `app/routers/benefits.py` + `services/comp_benefits.py`; `employer_benefits` (031), `benefit_profile` (069 with `has_espp`). UI `dashboard/benefits/page.tsx` (214 lines). No structured equity/RSU benefit linkage.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Military**                    | Stub                                  | Router `app/routers/military.py`; `dashboard/military/page.tsx` (164 lines). No dedicated schema migration; thin.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Property / Real Estate**      | **Shallow**                           | Only `assets.asset_type='real_estate'` (a value + name + location, `031:77`) and `asset_loans` / mortgage as a liability. No property entity with address, valuation history, rental income, or title.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Insurance**                   | Shallow                               | `family.insurance_profiles` + health insurance plans + `insurance` doc types. Onboarding `InsuranceSection.tsx` (311 lines). No structured per-policy model (coverage limits, riders, beneficiaries linked to assets).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Calendar / Planning / Goals** | Shallow→Process                       | `dashboard/{calendar(420),planning(254),goals(290)}/page.tsx` exist; goals are first-class per-domain (`*_goals` tables) but a unified life-goal cross-link is absent.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Tax (elite)**                 | Shallow                               | `tax_profiles` (031) + `dashboard/finance/tax`. No multi-state, no AMT/equity-tax, no entity (LLC/S-corp) modeling.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

---

## Cross-Domain Linkage — the structural finding

The Neo4j ontology (`apps/ingestion-worker/src/ontology.rs`) is a **star topology**: ~80 entity types, but nearly every declared edge is `user("HAS_X")` — anchored to the user, not to each other. Of the handful of `PayloadFk` (entity→entity) edges, **all are intra-domain**:

- `transaction → financial_account` (`ontology.rs:95`)
- `investment_holding → financial_account` (`ontology.rs:101`)
- `interview → job_application` (`ontology.rs:191`)
- `program → school` (`ontology.rs:213`)
- `dependent → guardianship_plan` (`ontology.rs:228`)
- `document_field → document` (`ontology.rs:253`)

The exact elite cross-domain links the pitch implies are **explicitly NOT in the graph** — the code comments admit it repeatedly:

- "_Cross-domain links (FamilyGoal FUNDED_BY FinancialGoal, CollegePlanning -> Education cost, ProtectionItem ADDRESSES InsuranceNeed) are documented extension points … NOT faked here_" (`ontology.rs:222-224`)
- "_cross-domain IMPACTS/AFFECTS_CASHFLOW/SUPPORTS_GOAL … documented extension points … NOT faked here_" (`ontology.rs:170-172`)
- "_Program QUALIFIES_FOR JobTarget, Program FUNDED_BY FinancialGoal … extension points_" (`ontology.rs:204-206`)

So the canonical "**dependent → 529 → education goal → finance**" chain does **not** exist as graph edges. (Honest nuance: it _partially_ exists in **SQL** — `college_planning.dependent_id` is an FK and `app/domains/family.py:95` reads finance debts at the service layer. The relational + service layers do some cross-domain joins the graph does not.)

**Implication:** "explainable life graph" traversal can answer "what does the user own" but cannot traverse "which goal does this account fund / which dependent does this 529 cover / how does a job change cascade to cash flow."

---

## Capture Mechanisms — what actually populates the model

Three mechanisms, in descending real-world yield:

1. **Plaid (finance only)** — the one deep automated connector. Full route set: `api/integrations/plaid/{link-token, exchange, accounts, transactions, personas, activate-persona, disconnect}`. This is why finance feels alive and everything else feels manual.
2. **Document ingestion** — `documents` platform + 24-type taxonomy + generic `document_fields` extraction. Genuinely powerful and domain-spanning; can capture an `equity_grant` or `vested_balance` as a _fact_ even though no structured table holds it.
3. **Structured onboarding forms** — `onboarding/sections/*` render real components: `FinancialSection (482)`, `EducationIntakeSection (384)`, `InsuranceSection (311)`, `FamilyLifestyleSection (276)`, `CareerExtendedSection (276)`, plus inline `health/page.tsx (280)`. Solid breadth, but finance capture is coarse (Income, Annual income, Spouse income, Debts/Current balance — no asset/equity/account detail in the form itself).
4. **Chat extraction** — exists (`advisor_turns`, normalizer) but per repo memory the LLM never writes the DB directly.

**Other connectors are thin or auth-only:** LinkedIn (`sync` only), Credly (badges), Google/Microsoft (OAuth + calendar/email disconnect, no deep ingest). The integrations UI lists 19 "live" providers (`lib/integrations/providers.ts comingSoon:false`) including Tesla/Sonos/Hue/Alexa — but **only Plaid, LinkedIn, Credly, Google, Microsoft, Stripe have backend routes** (`api/integrations/*`). The other ~13 "live" flags have no backend. For an elite finance/estate user this is overstated availability.

---

## 5 Ranked Completeness Gaps

### 1. No equity-compensation model (RSUs / options / vesting / ESPP) — **CRITICAL for elite**

Elite users at tech/finance firms hold most of their net worth in equity comp. There is **zero structured model**: no grant, vesting schedule, strike, 409A, or ESPP table (only `has_espp` boolean, `069:177`). Net worth (`finance.py:157`) silently excludes it → the headline number is wrong for the target user.
**Fix:** `finance.equity_grants` table (grant_type, shares, grant_date, vest_schedule jsonb, strike, fmv) + vesting projection in `compensation.py` + include vested value in net worth + graph edges `equity_grant -[GRANTED_BY]-> employer`, `-[CONTRIBUTES_TO]-> net_worth`.
**Effort:** M (1 migration, 1 service, net-worth wiring, 1 UI tab).

### 2. Estate is a boolean checklist, not a model — **CRITICAL for elite**

`estate_plans` = `has_will/has_poa/has_beneficiaries` (`131_family_schema.sql`). No trust corpus, trustee/executor entities, asset titling, beneficiary→asset mapping, or estate-tax exposure. An elite user with a revocable trust gets a yes/no checkbox.
**Fix:** Promote estate to entities: `trusts`, `estate_assets` (titling + beneficiary FK), `fiduciaries` (executor/trustee/POA agent). Link `asset → titled_in → trust`, `beneficiary → inherits → asset`.
**Effort:** M–L.

### 3. Cross-domain edges are absent from the graph — **HIGH (it's the moat)**

The differentiating "life graph" has no inter-domain edges (`ontology.rs` star topology; comments at 170-172, 204-206, 222-224 admit it). Can't traverse goal↔account, dependent↔529↔education, job-change↔cashflow.
**Fix:** Add outgoing-edge support in `merge_cypher_for` (currently incoming-only, `ontology.rs:13`) and declare the already-documented edges: `FinancialGoal FUNDS education_goal`, `college_planning COVERS dependent`, `compensation AFFECTS cash_flow`. The FKs/data partly exist; the graph emitter is the blocker.
**Effort:** M (worker change + ontology rows; data largely present).

### 4. Property / private & alternative assets are too coarse — **HIGH**

Real estate is one `assets` row (name + value + location, `031:77`). No address, valuation history, rental income/expense, mortgage linkage as a structured pair, or private holdings (LP/LLC/pre-IPO/angel). `investment_holdings.asset_class` excludes private/alts.
**Fix:** `finance.properties` (address, est_value, rental_income, linked liability_id) + extend asset/holding types with `private_equity, llc_interest, lp_interest, angel`.
**Effort:** M.

### 5. Dependents & family detail too thin to plan around — **MEDIUM**

`dependents` = `relationship, birth_year, guardianship_plan_id` only (`131_family_schema.sql`). No name, no special-needs flag, no per-child cost, no college timeline beyond `college_planning`. Hard to credibly advise a parent of 3 with disparate ages/needs.
**Fix:** Enrich `dependents` (name, special_needs, projected costs) + link `dependent → college_planning → education_goal → financial_goal` end-to-end.
**Effort:** S–M.

---

## Top 3 Highest-Leverage Additions for Elite Credibility

1. **Equity-comp + private-asset model wired into net worth.** Single biggest "it gets me" lever — without it the headline number is wrong for the exact pilot cohort. (Gap #1 + #4.)
2. **Turn the graph from a star into a web** by emitting the already-documented cross-domain edges (Gap #3). Cheapest path to the differentiated "explainable life graph" because the FKs and service-layer joins partly exist; only the Neo4j emitter is missing.
3. **Real estate-planning entities (trusts/titling/fiduciaries/beneficiary→asset).** Estate is the table-stakes elite domain currently reduced to 3 booleans (Gap #2).

---

## What's Genuinely Excellent

- **Schema breadth is real and disciplined.** 7 first-class domains, ~80 entity types, each with schema + GraphRAG triggers + API exposure migrations (e.g., `122/124/125` for career). This is a serious foundation, not a finance app with stickers.
- **Finance core is deep and live.** Net worth, cash-flow, budget, retirement, tax profiles, _and_ Plaid automation — the full set of routes exists and the service computes real numbers (`finance.py:134-171`).
- **Document Intelligence is a genuine multi-domain capture engine.** Generic `document_fields` extraction means even un-modeled facts (equity grants, policy limits) can enter the model as evidence — a smart escape hatch.
- **Trust discipline is exemplary and rare.** The ontology _refuses to fabricate_ cross-domain edges and labels them "extension points … NOT faked here" (`ontology.rs:90, 172, 224`). Better to under-claim the graph than hallucinate relationships — exactly right for a fiduciary-adjacent product.
- **Family service is the cross-domain template.** `app/domains/family.py` already reads finance + career to answer "is my estate plan sufficient?" — proof the cross-domain pattern works at the service layer and just needs to reach the graph.

---

## 10-Line Summary

1. **Score 5.5/10** for elite-life completeness — broad catalog, finance-deep, everything-else-shallow.
2. **Breadth is real:** 7 first-class domains, ~80 entity types, each with schema + triggers + API (e.g. `119_health_schema.sql`, `122_career_schema.sql`).
3. **Finance core is genuinely strong + Plaid-automated;** net worth/cash-flow computed in `finance.py`.
4. **But no equity-comp model exists** (no RSU/option/vesting/ESPP tables; only `has_espp` boolean) — net worth is wrong for the exact pilot cohort.
5. **Estate is a 3-boolean checklist** (`has_will/has_poa/has_beneficiaries`), not a trust/titling/fiduciary model.
6. **The graph is a star, not a web:** ~all edges are `user HAS_X`; cross-domain links (goal↔account, dependent↔529↔education) are explicitly "NOT faked here."
7. **Real estate & private/alt assets are one coarse `assets` row;** no property, LP/LLC, or pre-IPO modeling.
8. **Capture leans manual** except finance — only Plaid is a deep connector; LinkedIn/Credly are thin; ~13 "live" integrations have no backend.
9. **Excellent trust discipline:** the model under-claims rather than fabricates relationships — the right call.
10. **Verdict:** a real multi-domain _catalog_ with a thin _finance-plus_ depth profile; the moat (cross-domain life graph) is designed but not emitted. Three fixes — equity/private assets in net worth, cross-domain edges, estate entities — would move it from "broad but doesn't get my situation" to credibly elite.
