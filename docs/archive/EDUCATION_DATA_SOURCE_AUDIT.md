# EDUCATION X0 — OUTCOMES & ROI DATA-SOURCE AUDIT

Audit of the data needed to build the most accurate **education-ROI + program-recommendation**
engine possible — one that evaluates programs against the user's **life outcomes**, not generic
rankings. **Audit only** — no schema/migration/implementation/deploy.

**Guiding principle (Finance/Health/Career discipline):** every outcome figure is a **citable
estimate (source + as_of + confidence)**; future salary is always **modeled as a band, never a
point**; a program with no outcome data yields a **missing-data prompt, never a guess**.

> Caveat: scores reflect structural fit; commercial/university terms confirmed at contract. The
> recurring honesty constraint for education data is **cohort-level + lagged + selection** (see
> the College Scorecard note) — disclosed as assumptions with confidence, never hidden.

---

## PART 1 — EDUCATION DATA INVENTORY (evaluation + 0–10 scores)

Dimensions: **Cov**erage · **Qual**ity · **Fresh**ness · **Gran**ularity (program-level=10,
institution=6) · **Lic**ensing (10=open) · **API** · **Cost** (10=free) · **Rel**iability ·
**Use**.

| Source                                                                           | Cov            | Qual                 | Fresh                            | Gran                     | Lic        | API              | Cost | Rel | Use                                                                                                     |
| -------------------------------------------------------------------------------- | -------------- | -------------------- | -------------------------------- | ------------------------ | ---------- | ---------------- | ---- | --- | ------------------------------------------------------------------------------------------------------- |
| **College Scorecard**                                                            | 9              | 8                    | 5 (annual; earnings lag ~3–5 yr) | **9 (field×credential)** | 10         | 9 (open API)     | 10   | 8   | **Tier 1 ROI backbone** — program-level median earnings, median debt, completion, repayment             |
| **IPEDS**                                                                        | 9              | 8                    | 6 (annual)                       | 6 (institution)          | 10         | 7 (download/API) | 10   | 8   | **Tier 1 cost backbone** — tuition/fees, **net price by income band**, grad/completion (150% time), aid |
| **NCES** (B&B, NPSAS surveys)                                                    | 7              | 8                    | 5                                | 6                        | 10         | 6                | 10   | 8   | Tier 2 — longitudinal outcomes, debt-to-earnings context                                                |
| **State education DBs / SLDS**                                                   | 7 (per-state)  | 8 (UI-wage-matched)  | 6                                | 8                        | 7 (varies) | 4 (fragmented)   | 9    | 7   | Tier 2 — wage-record-matched program earnings (excellent in some states)                                |
| **University outcome reports**                                                   | 6              | 6 (self-reported)    | 6                                | 8                        | 7          | 2 (PDF)          | 9    | 6   | Tier 2 — placement/salary (esp. MBA employment reports); methodology varies                             |
| **Bar passage (ABA 509 + state bars)**                                           | 8 (law)        | 9                    | 7                                | 9                        | 9          | 4                | 10   | 9   | **Tier 1 (law)** — ultimate bar-pass rate per school                                                    |
| **CPA pass rates (NASBA)**                                                       | 8 (accounting) | 8                    | 7                                | 8                        | 8          | 3                | 9    | 8   | **Tier 1 (accounting)** — candidate performance by jurisdiction/school                                  |
| **Nursing (NCLEX — NCSBN/state boards)**                                         | 8 (nursing)    | 9                    | 7                                | 9                        | 8          | 4                | 9    | 9   | **Tier 1 (nursing)** — NCLEX pass rate by program                                                       |
| **Engineering (NCEES FE/PE)**                                                    | 7 (eng.)       | 8                    | 6                                | 8                        | 7          | 3                | 9    | 8   | **Tier 1 (engineering)** — FE/PE pass rates by institution                                              |
| **Apprenticeship outcomes (apprenticeship.gov/RAPIDS)**                          | 6              | 7                    | 6                                | 7                        | 9          | 5                | 10   | 7   | Tier 2 — completion + wage progression (trades)                                                         |
| **Certification provider outcomes** (CompTIA/AWS/PMI…)                           | 6              | 5 (vendor/marketing) | 7                                | 7                        | 5          | 4                | 7    | 5   | Tier 3 — pass/salary surveys; lower defensibility (vendor-sourced)                                      |
| **Accreditation (US DoE DAPIP + CHEA + programmatic: ABA/LCME/ABET/CCNE/AACSB)** | 9              | 9                    | 7                                | 8                        | 9          | 6                | 10   | 9   | **Tier 1** — accreditation status (gate for licensure/quality)                                          |

---

## PART 2 — REQUIRED DATA ELEMENTS → SOURCES

| Element                           | Primary source                                            | Backup                         | Confidence                    |
| --------------------------------- | --------------------------------------------------------- | ------------------------------ | ----------------------------- |
| **tuition / fees**                | IPEDS                                                     | school catalog, Scorecard      | High                          |
| **scholarships / grants**         | IPEDS aid data                                            | school, scholarship DBs        | Medium                        |
| **net cost**                      | IPEDS **net price by income band** + Scorecard            | —                              | High                          |
| **graduation / completion rates** | IPEDS (150% time) + Scorecard                             | —                              | High                          |
| **salary outcomes**               | **College Scorecard** (program earnings)                  | State SLDS, university reports | High* (*cohort/lag/selection) |
| **placement rates**               | University reports (ABA 509 for law, MBA empl. reports)   | —                              | Medium (self-reported)        |
| **debt outcomes**                 | College Scorecard (median debt by program)                | IPEDS                          | High                          |
| **licensing outcomes**            | ABA (bar) / NASBA (CPA) / NCSBN (NCLEX) / NCEES (FE/PE)   | state boards                   | High                          |
| **accreditation status**          | DAPIP + CHEA + programmatic accreditors                   | —                              | High                          |
| **employment outcomes**           | Scorecard (earnings presence) + BLS occupation employment | university reports             | Medium-High                   |

---

## PART 3 — ROI MODEL SUPPORT

| ROI capability              | Supported?  | How (sources)                                                                                                                 |
| --------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **break-even analysis**     | **YES**     | net cost (IPEDS) + opportunity cost (Compensation Engine "during") vs earnings lift (Scorecard/ACS)                           |
| **debt burden analysis**    | **YES**     | Scorecard median debt + monthly-payment amortization (cited rate)                                                             |
| **retirement impact**       | **YES**     | via live Finance graph (debt + income trajectory → NetWorthSnapshot/retirement)                                               |
| **cash-flow impact**        | **YES**     | Finance cash-flow + reduced income during school (opportunity cost)                                                           |
| **career acceleration**     | **PARTIAL** | needs Career Compensation Engine (Program→JobTarget lift) + Scorecard earnings — cross-domain (hence Career-before-Education) |
| **certification vs degree** | **PARTIAL** | degree side strong (Scorecard/ACS); cert side weaker (vendor surveys) → lower confidence + wider band                         |

The ROI engine's `worst / most-likely / best` scenarios + sensitivity analysis
(EDUCATION_ROI_DECISION_MODEL) absorb the lag/selection limitations honestly — the answer is a
**range with stated assumptions**, never a single hero ROI number.

---

## PART 4 — DATA CONFIDENCE MODEL

### Confidence tiers

- **High** — tuition/fees/net-price (IPEDS), completion (IPEDS), program earnings/debt
  (Scorecard, federally-aided cohorts), licensure pass rates (ABA/NASBA/NCSBN/NCEES),
  accreditation (DAPIP/CHEA). _Cite directly._
- **Medium** — placement (self-reported), salary for non-Title-IV or very recent cohorts,
  employment outcomes, certification earnings, state-SLDS coverage gaps. _Cite + wider band._
- **Low** — future salary projections (always modeled), individual (vs cohort-median) outcome,
  new/small programs (suppressed n in Scorecard), vendor certification ROI. _Model + flag._

### The College Scorecard honesty note (drives much of the model)

Program earnings are **cohort-level, lagged ~3–5 years, and cover federally-aided (Title IV)
students** (a selection). LifeNavigator must (a) cite the cohort + `as_of`, (b) treat the figure
as a **median band**, not the user's guaranteed outcome, and (c) carry these as explicit
`:Assumption` nodes. Small-cohort cells are suppressed → missing-data prompt, never interpolated.

### Where assumptions are required (surfaced as `:Assumption`, confirmable)

future earnings = program-median extrapolated · completion probability = program rate adjusted ·
opportunity cost = current income forgone during enrollment · discount rate · "works during
school?" · target career (selects the earnings benchmark).

### Where user confirmation is required

budget ceiling · time horizon · willingness to relocate · work-during-school · expected
effort/completion · target career/role. (High-stakes assumptions with `user_confirmed=false`
are confirmed before driving a recommendation.)

### Where recommendations must be constrained

- **High-debt / law school / for-profit / unaccredited / low-pass-rate** programs → escalating
  `education_guidance` boundary (→ financial advisor / admissions counselor) + the risk cited.
- **No outcome data for a program** → missing-data prompt, **no recommendation**.
- Never present a cohort median as a personal guarantee; never a salary point estimate.

---

## PART 5 — FINAL VERDICT

### Can LifeNavigator produce defensible education ROI recommendations?

# YES

The free, public, citable **Tier-1 stack — College Scorecard (program-level earnings/debt/
completion) + IPEDS (cost / net price by income / graduation) + licensure pass-rate sources
(ABA/NASBA/NCSBN/NCEES) + accreditation (DAPIP/CHEA)** — supports defensible break-even, debt,
cash-flow, and retirement-impact analysis today, with every figure carrying source + as_of +
confidence. The known limitations (cohort-level, lagged, Title-IV selection, suppressed small
cells) are handled honestly by the confidence model + scenario/sensitivity ranges + explicit
assumptions, not hidden. **Career-acceleration ROI is gated on the Career Compensation Engine**
(Program→JobTarget lift), confirming the Career-before-Education sequence.

### Sources + order (feeds Education X1 + the comparison/ROI engine)

1. **College Scorecard** (program earnings/debt/completion) — the ROI backbone.
2. **IPEDS** (tuition/net-price-by-income/graduation) — the cost backbone.
3. **Accreditation** (DAPIP/CHEA + programmatic) — quality/licensure gate.
4. **Licensure pass rates** (ABA/NASBA/NCSBN/NCEES) — regulated-field risk.
5. _(Tier 2)_ State SLDS + university outcome reports — augment where machine-readable.
6. _(Tier 3)_ Certification-provider outcomes — lowest confidence, flagged.

All ingested as **central reference data** (`ln_central`), cited **by value** into per-user
`:Evidence` — never linked cross-tenant. No implementation performed — audit only.
