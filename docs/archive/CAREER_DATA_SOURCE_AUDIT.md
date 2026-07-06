# CAREER X0 — LABOR MARKET & COMPENSATION DATA-SOURCE AUDIT

Audit of the data sources that could power LifeNavigator's Career + Education compensation/
market intelligence (COMPENSATION_INTELLIGENCE_ENGINE, JOB_MARKET_INTELLIGENCE_ARCHITECTURE).
**Audit only** — no schema/migration/implementation/deploy.

**Guiding principle (from the Finance/Health discipline):** every compensation figure must be a
**citable estimate with a source + as_of + confidence**, never a fantasy salary and never a
scraped consumer number. That rule drives the scoring below — _defensibility and licensing
outrank raw richness._

> Caveats: scores reflect each source's structural fit; exact **pricing and license terms must
> be confirmed with the vendor + legal at contract time**, and any consumer-site data acquired
> in violation of its ToS is excluded as non-defensible (it cannot be cited or relied on).

---

## PART 1 — DATA SOURCE INVENTORY (with evaluation + scores)

Dimensions scored 0–10: **Cov**erage · **Qual**ity · **Fresh**ness · **Lic**ensing-friendliness
(10 = open/public) · **API** · **Export** · **Cost** (10 = free) · **Rel**iability · **Viab**ility
(long-term). "Use" = recommended usage.

### Government sources (free, public, citable — the defensible foundation)

| Source                                                      | Cov                   | Qual | Fresh                 | Lic                   | API                                | Export         | Cost | Rel | Viab | Use                                                                                       |
| ----------------------------------------------------------- | --------------------- | ---- | --------------------- | --------------------- | ---------------------------------- | -------------- | ---- | --- | ---- | ----------------------------------------------------------------------------------------- |
| **BLS OEWS** (Occupational Employment & Wage Stats)         | 9                     | 9    | 6 (annual, ~May data) | 10 (public domain)    | 8 (BLS Public Data API)            | 9 (flat files) | 10   | 9   | 10   | **Tier 1 wage backbone** — occupation × metro/industry wage percentiles (p10–p90)         |
| **O\*NET**                                                  | 9 (skills/tasks)      | 9    | 7 (regular releases)  | 10 (open)             | 8 (Web Services API + DB download) | 9              | 10   | 9   | 10   | **Tier 1 skills/role backbone** — role→skill mapping, job zones, education typical        |
| **CPS** (Current Population Survey)                         | 8                     | 8    | 8 (monthly)           | 10                    | 7 (microdata)                      | 8              | 10   | 8   | 9    | Tier 2 — experience/earnings trends, demographics                                         |
| **ACS** (American Community Survey)                         | 9                     | 8    | 7 (annual, PUMS)      | 10                    | 8 (Census API)                     | 9              | 10   | 8   | 10   | **Tier 1** — earnings by education level & geography (credential/degree premium, geo adj) |
| **NCES / IPEDS**                                            | 9 (institutions)      | 8    | 6 (annual)            | 10                    | 7 (download/API)                   | 9              | 10   | 8   | 9    | **Tier 1 (Education)** — institution facts, completion, cost                              |
| **College Scorecard**                                       | 9 (program earnings!) | 8    | 6 (annual)            | 10 (public, open API) | 9 (Scorecard API)                  | 9              | 10   | 8   | 9    | **Tier 1 (Education ROI)** — program-level earnings, debt, completion, repayment          |
| **Registered Apprenticeship** (apprenticeship.gov / RAPIDS) | 6                     | 7    | 6                     | 9                     | 5                                  | 7              | 10   | 7   | 8    | Tier 2 — apprenticeship pathways + wage progression                                       |
| **State workforce agencies (LMI)**                          | 7 (per-state)         | 7    | 6                     | 8 (varies)            | 4 (fragmented)                     | 6              | 9    | 7   | 7    | Tier 3 — granular local wage records; integration cost high                               |

### Commercial sources (richer, but cost/licensing-gated)

| Source                                            | Cov            | Qual                 | Fresh                  | Lic                                                    | API                | Export | Cost              | Rel | Viab | Use                                                                               |
| ------------------------------------------------- | -------------- | -------------------- | ---------------------- | ------------------------------------------------------ | ------------------ | ------ | ----------------- | --- | ---- | --------------------------------------------------------------------------------- |
| **Lightcast** (merged EMSI + Burning Glass, 2021) | 10             | 9                    | 9 (real-time postings) | 5 (paid, redistribution-limited)                       | 9 (enterprise API) | 8      | 3 (enterprise $$) | 9   | 9    | **Tier 2 enterprise** — real-time demand, skills, employer/role granularity, comp |
| EMSI / Burning Glass                              | —              | —                    | —                      | —                                                      | —                  | —      | —                 | —   | —    | **Now Lightcast** (do not procure separately)                                     |
| **Payscale**                                      | 8              | 7 (crowd+model)      | 8                      | 5 (paid)                                               | 7 (enterprise)     | 7      | 4                 | 7   | 8    | Tier 2 — modeled comp incl. some premiums; license required                       |
| **Salary.com**                                    | 8              | 8 (HR-grade)         | 8                      | 5 (paid)                                               | 7                  | 7      | 4                 | 8   | 8    | Tier 2 — HR-grade comp bands; license required                                    |
| **levels.fyi**                                    | 6 (tech-heavy) | 7 (crowd)            | 8                      | 3 (no official public API; ToS)                        | 3                  | 4      | 6                 | 6   | 7    | Tier 3 — tech comp only; partner/licensed access, not scraping                    |
| **Glassdoor**                                     | 7              | 5 (self-select bias) | 7                      | 2 (API deprecated; ToS bars scraping)                  | 2                  | 3      | 5                 | 5   | 5    | **Avoid** for comp basis (non-defensible; biased)                                 |
| **ZipRecruiter**                                  | 7              | 6                    | 9                      | 4 (partner API)                                        | 6                  | 5      | 5                 | 6   | 7    | Tier 3 — postings via partner API only                                            |
| **Indeed**                                        | 9              | 6                    | 9                      | 3 (publisher API curtailed; ToS bars scraping)         | 4                  | 4      | 5                 | 6   | 6    | Tier 3 — postings only, via sanctioned access                                     |
| **Dice**                                          | 5 (tech)       | 6                    | 8                      | 4                                                      | 5                  | 5      | 5                 | 6   | 6    | Tier 3 — niche tech postings                                                      |
| **LinkedIn**                                      | 10             | 8                    | 9                      | 1 (no comp API; scraping prohibited — hiQ v. LinkedIn) | 2                  | 1      | 4                 | 7   | 5    | **Avoid** — locked down, ToS/legal risk; never scrape                             |

### University sources

| Source                                                     | Cov                 | Qual | Fresh | Lic | API            | Export | Cost | Rel | Viab | Use                                                                            |
| ---------------------------------------------------------- | ------------------- | ---- | ----- | --- | -------------- | ------ | ---- | --- | ---- | ------------------------------------------------------------------------------ |
| Program outcome / placement / employment reports           | 6 (per-school PDFs) | 7    | 6     | 7   | 2 (mostly PDF) | 4      | 9    | 7   | 7    | Tier 2 (Education) — aggregate where machine-readable; else College Scorecard  |
| Graduation reports                                         | 7                   | 8    | 6     | 8   | 3              | 5      | 9    | 8   | 8    | Covered better/at-scale by IPEDS/Scorecard                                     |
| Licensing pass-rate reports (ABA bar, NCLEX, state boards) | 7                   | 9    | 6     | 8   | 3              | 5      | 9    | 9   | 9    | **Tier 1 (licensure paths)** — bar/NCLEX/board pass rates for law/nursing/etc. |

---

## PART 3 — COMPENSATION MODEL FEASIBILITY

Can each modeled quantity be produced **defensibly** (cited, not guessed)?

| Quantity                        | Defensible from                                                                     | Confidence      | Notes                                                        |
| ------------------------------- | ----------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------ |
| **Current market value**        | OEWS (role×geo×industry percentiles) + O\*NET                                       | **High**        | the backbone; cite the OEWS band                             |
| **Geographic adjustment**       | OEWS by metro/state + ACS                                                           | **High**        | direct                                                       |
| **Industry adjustment**         | OEWS by NAICS industry                                                              | **High**        | direct                                                       |
| **Degree value**                | College Scorecard (program earnings) + ACS (earnings by education level)            | **High**        | the credential premium, citable                              |
| **Certification value**         | OEWS (licensed/certified occ. deltas) + program outcomes; Lightcast for cert demand | **Medium**      | gov gives partial; Lightcast strengthens                     |
| **Licensing premium**           | OEWS for licensed occupations + pass-rate sources                                   | **Medium-High** | strong for regulated fields                                  |
| **Promotion / seniority value** | ACS/CPS experience-earnings curves (modeled); Lightcast seniority bands             | **Medium**      | OEWS lacks clean seniority; model + flag confidence          |
| **Management premium**          | ACS/CPS (management occupations); Lightcast                                         | **Medium**      | modeled; lower confidence without commercial                 |
| **Employer adjustment**         | **commercial only** (Lightcast; levels.fyi for tech)                                | **Low-Medium**  | gov has no employer granularity; mark confidence accordingly |
| **Military premium**            | ACS veteran status + niche datasets                                                 | **Low**         | sparse; Tier 3                                               |
| **Clearance premium**           | commercial niche (e.g. clearance comp surveys)                                      | **Low**         | Tier 3, narrow                                               |

**Implication:** the Compensation Engine's `base + adjustments` decomposition (per
COMPENSATION_INTELLIGENCE_ENGINE) is fully defensible for the **high-confidence terms**
(base/geo/industry/degree); the **employer/seniority/clearance** premiums are honestly
**modeled with a stated lower confidence + wider band** until commercial data is licensed — which
is exactly what the engine's per-term confidence + band design already accommodates. No fantasy
numbers anywhere.

---

## PART 4 — RECOMMENDED DATA STRATEGY

### Tiers

- **Tier 1 (must-have, free + public + citable):** BLS **OEWS**, **O\*NET**, Census **ACS**,
  **College Scorecard**, **IPEDS**, licensing pass-rate sources (bar/NCLEX/state boards).
- **Tier 2 (nice-to-have, paid):** **Lightcast** (real-time demand, employer/role/skill
  granularity, seniority comp), Salary.com/Payscale (HR-grade bands), CPS/Apprenticeship,
  machine-readable university outcome reports.
- **Tier 3 (future / niche):** levels.fyi (licensed, tech), ZipRecruiter/Indeed (sanctioned
  postings), state LMI microdata, clearance/military comp niches.

### Stacks

- **MVP stack:** OEWS + O\*NET + ACS + College Scorecard (+ IPEDS for Education) + pass-rate
  sources. **100% free, public-domain, citable.** Produces defensible current/geo/industry/
  degree value with explicit confidence — enough to ship Career X1–X6 + Education ROI.
- **Enterprise stack:** MVP + **Lightcast** (the single highest-value add: real-time demand,
  employer/seniority granularity, skills taxonomy) + Salary.com or Payscale for HR-grade bands.
- **Ideal stack:** Enterprise + levels.fyi (licensed) for tech precision + sanctioned postings
  feeds + state LMI — diminishing returns, highest cost/integration.

### Architecture fit (JOB_MARKET_INTELLIGENCE)

All of this is **central reference data** (`ln_central`), ingested with `source` + `as_of` +
`confidence`, cited **by value** into each user's `:Evidence` nodes — never linked cross-tenant
(the ontology-standard rule). Tier-1 sources are public-domain → no redistribution constraints
on cited figures; Tier-2/3 require honoring license terms (cite/aggregate per contract).

---

## PART 5 — FINAL VERDICT

### Can LifeNavigator produce defensible compensation intelligence?

# YES

Using the **government Tier-1 stack (OEWS + O\*NET + ACS + College Scorecard + IPEDS + licensure
pass rates)** — all free, public-domain, API-accessible, and citable — LifeNavigator can produce
**defensible, auditable** compensation and education-ROI intelligence today, where every figure
carries a source band, `as_of`, and confidence. Employer/seniority/clearance precision is added
later via **Lightcast** (Tier 2) without changing the architecture (the engine already models
per-term confidence + bands). Consumer-scraped sources (LinkedIn/Glassdoor/Indeed) are
**excluded** as non-defensible and ToS/legally risky.

### Exact sources + implementation order

1. **BLS OEWS** (wage backbone) + **O\*NET** (skills/role backbone) — ingest first; they unblock
   `current_market_value`, geo, industry, and the role→skill graph.
2. **Census ACS** — earnings by education level + geography → degree premium + geo adjustment.
3. **College Scorecard + IPEDS** — program-level earnings/debt/completion → Education ROI
   inputs (also needed for the Education domain).
4. **Licensure pass-rate sources** (bar/NCLEX/state boards) — for regulated-field/licensing risk.
5. _(Enterprise, post-MVP)_ **Lightcast** — real-time demand, employer/seniority comp, skills
   taxonomy → upgrades the medium/low-confidence premiums.
6. _(Future)_ levels.fyi (licensed) + sanctioned postings + state LMI.

This becomes the input contract for **Career X1 (schema)** and the central
JOB_MARKET_INTELLIGENCE layer. No implementation performed — audit only.
