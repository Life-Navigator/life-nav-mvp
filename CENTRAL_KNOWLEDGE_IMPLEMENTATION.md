# Central Knowledge — Implementation (Sprint G)

The reasoning engine outgrew the knowledge base. This sprint closes
the gap with a substantive curated-knowledge expansion: **+30
provenance records, ~230 new entities, ~280 new relationships** across
all six domains, every row carrying full citation metadata.

The graph now stands at:

| Layer                            | Sprint | Entities | Relationships | Provenance records |
| -------------------------------- | ------ | -------: | ------------: | -----------------: |
| 077 bootstrap (self_authored)    | A      |       23 |            22 |                  1 |
| 078 curated v1                   | A      |      ~98 |          ~106 |                 30 |
| **083 curated v2** (this sprint) | **G**  | **~225** |      **~280** |            **+30** |
| **Total approved**               |        | **~350** |      **~410** |            **~60** |

No new schema. No engine changes. No UI. Pure knowledge population
into the existing `central.ontology_entities` /
`central.ontology_relationships` / `central.provenance_records`
tables (from migration 077). All rows: `review_status = 'approved'`.

## Verification

| Check                             | Status                                                                                                           |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Migration 083 self-test (`DO $$`) | raises if any domain has < 15 `central_curated_v2` entities                                                      |
| Provenance integrity              | every approved row has `provenance_id` (enforced by 077 CHECK + verified by §4 of `verify_083_central_seed.sql`) |
| Cross-domain edge coverage        | §8-§10 of the verifier confirm Cert → Career, Health → Productivity, Veteran → Finance/Education edges           |

```bash
psql "$DATABASE_URL" -f supabase/migrations/083_central_knowledge_v2.sql
psql "$DATABASE_URL" -f scripts/validation/verify_083_central_seed.sql
```

---

## Per-domain coverage

### Finance — ~80 new entities + ~95 new relationships

| Topic                   | Sample additions                                                                                                                                                           |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CFP framework**       | CFP Six-Step Planning Process, Fiduciary Duty (Investment Advice), Net Worth Statement, Personal Cash Flow Statement, Time Value of Money, Risk Capacity vs Risk Tolerance |
| **Retirement vehicles** | SEP-IRA, SIMPLE-IRA, Solo 401(k), 457(b), 403(b), Defined Benefit Pension, Thrift Savings Plan (TSP), Roth Conversion, 72(t) SEPP, RMD, Mega Backdoor Roth                 |
| **Social Security**     | Social Security Claiming Strategy, Full Retirement Age, PIA                                                                                                                |
| **Debt / credit**       | Debt Consolidation Loan, Balance Transfer 0% Promo, VantageScore vs FICO, Credit Mix Diversity, Account Age Average, Hard Inquiry Impact, Debt-Snowball Behavioral Lift    |
| **Mortgages**           | 15-Year Fixed, ARM, USDA Rural Development, Jumbo Loan, PMI, Mortgage Points, Front-End DTI, Back-End DTI, Mortgage Recast                                                 |
| **Tax concepts**        | 2024 brackets (MFJ + Single), Long-Term Capital Gains Rate, NIIT, Tax-Loss Harvesting, QCD, Bunching Deductions, SALT Cap, Backdoor Roth (pro-rata), Premium Tax Credit    |
| **Insurance**           | Whole Life, Indexed Universal Life, Variable Annuity, SPIA, LTCI, Auto Liability, HO-3, HO-4                                                                               |
| **HSA / FSA mechanics** | HSA Eligibility (HDHP), HSA Triple Tax Advantage, HSA Excess Contribution Penalty, FSA Carryover Limit, FSA Grace Period, DCFSA Marketplace Conflict                       |
| **Employer benefits**   | ESPP, RSU Vesting Schedule, ISO, NQSO, NQDC, Group Term Life Insurance, Commuter Benefits, Adoption Assistance                                                             |

### Career — ~25 new entities + ~25 new relationships

| Topic                                                 | Sample additions                                                                                                                                                                |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Occupations** (BLS OOH 2024)                        | Data Scientist, Cybersecurity Analyst, Marketing Manager, Physical Therapist, Mechanical Engineer, Construction Manager, Electrician                                            |
| **Certifications** (vendor catalogs + CompTIA + SHRM) | AWS Solutions Architect Associate/Pro, CompTIA Security+, CISSP, GCP Professional Cloud Architect, Azure Solutions Architect, Scrum Master (CSM), SHRM-CP, Six Sigma Green Belt |
| **Promotion + transition mechanics**                  | Manager → Director pathway, Senior IC → Staff/Principal pathway, Big Tech → Startup, Startup → Big Tech, Public Sector → Private                                                |
| **Salary mechanics**                                  | Salary Negotiation BATNA, Job Search 6:3:1 Funnel, Internal Referral Hiring Rate, Geographic Arbitrage (Remote)                                                                 |

### Education — ~15 new entities + ~18 new relationships

| Topic             | Sample additions                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Degrees**       | Associate Degree (AA/AS), Doctoral Degree (PhD), Professional Degree (MD/DDS/DPT/PharmD)                                             |
| **Tax credits**   | AOTC, LLC, Student Loan Interest Deduction                                                                                           |
| **529 mechanics** | 529 College Savings Plan, 529 to Roth Transfer (SECURE 2.0)                                                                          |
| **Aid mechanics** | FAFSA, CSS Profile, Merit Scholarship, Need-Based Aid, In-State Tuition Reciprocity, PSLF Qualifying Employment, SAVE Repayment Plan |

### Health — ~25 new entities + ~25 new relationships

| Topic                | Sample additions                                                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Nutrition**        | TDEE, BMR, Macronutrient Distribution Range, Time-Restricted Eating (TRE), Glycemic Load, DASH Eating Pattern, Whole-Food Plant-Forward, Fiber Target (28-38g/day) |
| **Exercise science** | Periodization (Linear / Block / Conjugate), HIIT, Concurrent Training Interference, Plyometric Training                                                            |
| **Recovery / sleep** | Sleep Efficiency, REM Sleep Importance, Slow-Wave Sleep (Deep), Circadian Misalignment, Active Recovery, Massage / Soft-Tissue Work                                |
| **Behavior change**  | Stages of Change Model, Tiny Habits (Fogg), Implementation Intentions, Identity-Based Habit, Environment Design                                                    |

### Estate — ~15 new entities + ~15 new relationships

| Topic                     | Sample additions                                                                                                             |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Trust vehicles**        | Pour-Over Will, Special Needs Trust, Spendthrift Trust, ILIT, QPRT, GRAT, DAF, Charitable Remainder Trust                    |
| **Federal estate tax**    | Federal Estate Tax Exemption 2024 ($13.61M sunsets 2026), Marital Deduction, Portability of DSUE, Step-Up vs Carryover Basis |
| **Beneficiary mechanics** | Per Stirpes vs Per Capita with Representation, Letter of Intent, Digital Asset Inventory (RUFADAA)                           |

### Veteran — ~15 new entities + ~14 new relationships

| Topic                | Sample additions                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Disability**       | VA Disability Compensation Table 2024, TDIU, A&A Enhancement, VA Pension (Improved Pension), VA SAH Grant  |
| **Insurance**        | S-DVI, VGLI                                                                                                |
| **Rating mechanics** | VA Schedule for Rating Disabilities (38 CFR Part 4), Combined Rating Math, PACT Act Presumptive Conditions |
| **Healthcare**       | VHA Enrollment Priority Group, State Veterans Benefits                                                     |
| **GI Bill variants** | Montgomery GI Bill (Ch 30), Chapter 35 DEA                                                                 |
| **Transition**       | BDD (Benefits Delivery at Discharge)                                                                       |

---

## Source-quality calibration

Confidence on every row reflects the source type, per the calibration
documented in Sprint A (078). For the v2 batch:

| `source_type`    | Typical confidence | New sources in 083                                                                                                                                 |
| ---------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `statute`        | 0.90–0.95          | 26 USC §§ 408A, 72(t), 125, 529, 127, 2010, 2056; 29 USC § 1001 (ERISA); 38 USC §§ 3001, 3301; Uniform Probate Code; Uniform Power of Attorney Act |
| `regulation`     | 0.90–0.95          | IRS Pubs 17, 463, 529-misc, 970, 974, 575, 560; 38 CFR Part 4                                                                                      |
| `gov_data`       | 0.85–0.95          | BLS CPS, NCES College Navigator, VA Aid & Attendance                                                                                               |
| `expert_review`  | 0.80–0.90          | CFP Board Practice Standards, SSA Retirement / SSDI, AASM Practice Standards, CFPB Student Loans, LinkedIn Workforce                               |
| `peer_reviewed`  | 0.80–0.85          | PMID: 28642676 (ISSN protein), PMID: 35001643 (AHA resistance training), PMID: 35044835 (TRE meta-analysis)                                        |
| `vendor_catalog` | 0.80–0.90          | AWS / GCP / Microsoft certification catalogs                                                                                                       |

A statutory or regulatory citation outweighs a vendor catalog in
`AdvisorReasoningService` because confidence ↑ propagates into edge
strength × edge confidence.

---

## Sample cross-domain reasoning chains now traversable

```
Skill: Python ─INCREASES_PROBABILITY_OF→ Data Scientist (SOC 15-2051)
                                            └─INCREASES→ Income
                                                          └─SUPPORTS→ Financial Independence

CISSP ─INCREASES_PROBABILITY_OF→ Cybersecurity Analyst (SOC 15-1212)
                                  └─INCREASES→ Income
                                                └─SUPPORTS→ Financial Independence

Industry Transition (Big Tech → Startup) ─SUPPORTS→ Entrepreneurship
                                          └─DECREASES→ Income (near-term)
                                          └─(equity upside dispersion 0-10x)

Macronutrient Distribution Range ─SUPPORTS→ Protein Target 1.6-2.2 g/kg
                                              └─SUPPORTS→ ACSM Resistance Training Target
                                                            └─IMPROVES→ Body Fat %
                                                            └─(secondary) Productivity → Career Progress

Sleep Efficiency ─SUPPORTS→ Sleep Duration
                              └─IMPACTS→ Productivity → Career Progress
REM Sleep Importance ─IMPACTS→ Productivity
Circadian Misalignment ─DEGRADES→ Sleep Duration

VA Disability Compensation Table 2024 ─SUPPORTS→ VA Disability Compensation
                                                  └─INCREASES→ Cash Flow Surplus + Income (tax-free)
Aid & Attendance Enhancement ─INCREASES→ VA Pension (Improved Pension)
PACT Act Presumptive Conditions ─ACCELERATES→ Service-Connected Rating
                                               └─PREREQUISITE_FOR→ VA Disability Compensation / VR&E (Ch 31)
BDD (Benefits Delivery at Discharge) ─ACCELERATES→ VA Disability Compensation

Federal Estate Tax Exemption 2024 ─RELATED_TO→ Financial Independence
Marital Deduction ─SUPPORTS→ Federal Estate Tax Exemption 2024
Portability of DSUE ─SUPPORTS→ Marital Deduction
Pour-Over Will ─SUPPORTS→ Revocable Living Trust (Settlor)

HSA Triple Tax Advantage ─SUPPORTS→ HSA (Health Savings Account)
                                     └─SUPPORTS→ Financial Independence
HSA Eligibility (HDHP) ─PREREQUISITE_FOR→ HSA (Health Savings Account)
DCFSA Marketplace Conflict ─RELATED_TO→ Dependent Care FSA

Roth Conversion ─IMPACTS→ Marginal Tax Bracket
72(t) SEPP Distribution ─SUPPORTS→ Financial Independence (pre-59½)
Social Security Claiming Strategy ─SUPPORTS→ Financial Independence
Full Retirement Age (SSA) ─PREREQUISITE_FOR→ Social Security Claiming Strategy
```

---

## How the engines benefit immediately

The `AdvisorReasoningService.loadCentralLinks()` query is unchanged —
it now resolves dramatically more matches per goal because the
ontology covers the breadth of the spec. Per-action `supporting_evidence[]`
on `RecommendationOutput` gets richer citation_reference values. The
`MarginalImpactRanker` candidate catalog can be extended to reference
these new entities by canonical_name without code changes.

The XAI surface (Sprint E) automatically benefits: WhyChain nodes
gain `grounded_in.citation_reference` strings like `"IRS Pub 590-A"`,
`"CFP Board PS"`, `"38 CFR Part 4"`, `"PMID: 35001643"` — every
"because" hop now points at a real source the user can verify.

The GraphRAG worker projects each new row into the **central** Qdrant
collection + **central** Neo4j database (per migration 077's
access_scope routing). Retrieval finds them via phrase match on
`canonical_name` + `summary`.

---

## What this sprint did NOT do

- ❌ No schema changes. All seven central tables and the access_scope
  routing came from 077.
- ❌ No engine changes. The reasoning math is unchanged.
- ❌ No new sources at the `self_authored` confidence tier. Every v2
  row links to a real citation.
- ❌ No automated curation pipeline. Future refresh is a separate
  sprint — for now, knowledge is updated by writing 084, 085, etc.

---

## Follow-up — keeping the graph fresh

The v2 batch encodes a snapshot as of 2024 publication-year sources.
Annual maintenance:

1. **IRS contribution limits** (401(k), IRA, HSA, FSA) bump each
   November for the following year. Re-run a small migration with
   updated `attributes` JSONB.
2. **Federal estate tax exemption** sunsets January 1, 2026. The
   `Federal Estate Tax Exemption 2024` entity's `attributes.sunset_2026`
   field is the marker.
3. **BLS OOH** publishes annually around September. Refresh
   median-pay numbers and projected-growth columns.
4. **VA disability compensation tables** publish in December for the
   following year.

A planned future migration adds a `central.ontology_review_cycle` table
to track when each entity was last refreshed and which calendar
trigger (statute renewal, agency annual publication, etc.) drives the
review. Out of scope for this sprint.
