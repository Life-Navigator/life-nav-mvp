# Career Experience Redesign

**Grounded finding.** The Career domain has the widest gap in the product between _intelligence computed_ and _intelligence shown_. The route tree (`apps/web/src/app/dashboard/career/`) has 18 pages — overview, compensation, skills, certifications, opportunities, experience, goals, resume, networking, analysis, recommendations, documents — yet the overview (`page.tsx`) renders only a coverage bar, a readiness card, raw counts, and a flat recommendation list. Meanwhile the backend computes cited OEWS market-value bands (`CompensationIntelligenceEngine`, `/v1/career/compensation`), a full benefits/5-year-value/retirement/insurance/FSA-HSA analysis (`CompensationBenefitsEngine`, `/v1/benefits`), market position (`MarketPositionAnalyzer`, `/v1/career/market-position`), a structured intelligence report (`CareerService.report_model`, `/v1/career/report`), and a 7-component deterministic readiness score (`scoreCareer`, `career.ts`). **None of the compensation, benefits, market-position, or report intelligence reaches the career UI.** The redesign is surfacing-first: connect existing endpoints, restructure the IA around advancement, and add three presentational compositions (Promotion panel, Compensation curve, Timeline) over data that already flows.

---

## Information architecture: before → after

### Before (admin-shaped)

```
/dashboard/career (overview)
  ├─ coverage bar (known/missing strings)
  ├─ ReadinessCard (score)
  ├─ DomainSnapshot (counts: positions, volunteer, projects, certs, goals)
  ├─ flat recommendation bullets
  └─ "manage documents" link
  + 17 sibling pages the user must discover on their own
```

The overview answers "how complete is my data?" — a form-completion question. It never answers "am I paid fairly? am I ready to advance? what's my next move?"

### After (advancement-shaped)

```
/dashboard/career (Command Center)
  ├─ HERO: current role + cited market-value band + next-move chip      [/compensation, /overview]
  ├─ PROMOTION READINESS panel (labeled, evidence chips)                [/recommendations]
  ├─ COMPENSATION INTELLIGENCE: bands + 5-yr value curve + benefits     [/compensation, /benefits]
  ├─ MARKET BENCHMARK strip (demand/percentile, honest unknowns)        [/market-position]
  ├─ SKILL GAPS → closure plan (severity + cited comp lift)             [/summary]
  ├─ CAREER TIMELINE (chronological roles + volunteer + projects)       [/summary lists]
  ├─ RECOMMENDATIONS grouped Advance / Earn / Grow                      [/recommendations]
  └─ READINESS detail + data-completeness (demoted, still present)      [/readiness]
```

The overview now answers the three questions a career advisor would. Sibling pages become drill-downs from these cards, not a flat menu.

---

## Surfacing changes (endpoint → surface)

| Existing endpoint (already built)       | Currently rendered? | New surface                                                               |
| --------------------------------------- | ------------------- | ------------------------------------------------------------------------- |
| `/v1/career/summary`                    | Yes (counts only)   | Hero role + skill-gap list + timeline data                                |
| `/v1/career/compensation`               | **No**              | Hero market band + Compensation card + scenario lift                      |
| `/v1/career/market-position`            | **No**              | Market Benchmark strip                                                    |
| `/v1/benefits` (`comp_benefits.py`)     | **No**              | 5-yr value curve, benefit valuation, retirement, FSA/HSA net-worth effect |
| `/v1/career/report` (`report_model`)    | **No**              | "Download Career Intelligence Report" + report viewer                     |
| `/v1/career/recommendations`            | Yes (flat)          | Promotion panel + grouped Advance/Earn/Grow                               |
| `/api/career/readiness` (`scoreCareer`) | Yes                 | Demoted to detail; feeds Promotion signal checklist                       |

New Next.js proxy routes to add (mirror `apps/web/src/app/api/career/summary/route.ts`): `/api/career/compensation`, `/api/career/market-position`, `/api/career/report`, `/api/benefits`. **No backend work** — the Python endpoints exist.

---

## Coverage table (EXISTS / SURFACED / MISSING)

| Command Center element           | Backend EXISTS                     | Currently SURFACED | Action                                   |
| -------------------------------- | ---------------------------------- | ------------------ | ---------------------------------------- |
| Current Position                 | Yes (`career_profiles`)            | Partial (snapshot) | Promote to hero                          |
| Market Value band                | Yes (`/compensation`)              | **No**             | Wire to hero                             |
| Total comp + 5-yr value          | Yes (`/benefits`)                  | **No**             | New card                                 |
| Retirement / insurance / FSA-HSA | Yes (`comp_benefits.py`)           | **No**             | New card sections w/ missing-doc prompts |
| Promotion Readiness              | Yes (`promotion_readiness` family) | **Buried**         | New labeled panel                        |
| Market Benchmark                 | Yes (`/market-position`)           | **No**             | New strip                                |
| Skill Gaps                       | Yes (`skill_gaps`)                 | Count only         | Promote to list                          |
| Career Timeline                  | Data yes, view no                  | **No**             | New presentational component             |
| Certifications (ROI)             | Yes (`certification_roi`)          | Separate page      | Surface in Grow group                    |
| Career Report                    | Yes (`report_model`)               | **No**             | Download + viewer                        |
| Next Career Move                 | Composable                         | **No**             | Hero chip                                |

---

## Emotional + visual design

**Theme: advancement, momentum, fair reward.** The platform's navy+teal system (per email brand system) should make Career feel like a wealth/strategy console.

- **Trust chips everywhere.** Every number carries its `source` ("BLS OEWS"), `as_of`, and `confidence` from the payload as a small chip — this is the moat made visible (cited bands, never fantasy salaries). Reuse the existing source/confidence pattern already in `toCoverageModel` (`page.tsx:113-118`).
- **The 5-year value curve** is the signature visual — it reframes Career from "job tracker" to "lifetime earnings engine." Pure render over `five_year_value.by_year`.
- **Timeline as a spine** — a vertical chronology of roles makes years of history feel like accumulated capital, not rows in a table.
- **Promotion panel** uses progress framing ("4 of 6 signals present"), not a verdict — momentum, not judgment.
- **Honest missing states are first-class**, never apologetic dead-ends: the benefits engine literally emits "Upload your 401(k) statement to model retirement impact" — render these as opportunities ("Unlock retirement impact →"), each linking to `/dashboard/career/documents`.

---

## Empty / In-Progress / Complete (page-level)

- **Empty** (no profile): Hero CTA "Add your current role to see your market value" → `/dashboard/career/add`. Promotion + Compensation cards show locked-with-reason states ("Add your role + a target to unlock"), never blank boxes. No fabricated salaries or scores.
- **In-Progress** (role known, docs/goals partial): Hero shows role + market band; Compensation shows total comp with a `missing_documents` checklist; Promotion shows "2 of 6 signals present." Each gap is a labeled next action.
- **Complete** (role + target + comp doc + benefits): full Command Center — band, 5-yr curve, net-worth effect, promotion-in-range panel, grouped recommendations, downloadable report.

---

## Definition of Done

1. Overview reads `/compensation`, `/market-position`, `/benefits`, `/report`, `/recommendations` (proxies added; no backend change).
2. Hero shows current role + cited market-value band + next-move chip, with source/confidence chips.
3. Promotion Readiness rendered as a labeled panel (Option A from `PROMOTION_ENGINE.md`), with evidence chips and the honest performance assumption.
4. Compensation card renders total comp, the 5-year value curve, and benefit/retirement/insurance/FSA-HSA sections, each citing `source_documents` and surfacing `missing_documents` as CTAs.
5. Market Benchmark renders demand/percentile with honest "insufficient data" when bands are absent.
6. Skill Gaps render as a severity list linked to closure recommendations.
7. Career Timeline renders chronologically from experience + volunteer + side-project records.
8. Recommendations grouped Advance / Earn / Grow, each carrying evidence, assumptions, risks, and the `career_guidance` boundary.
9. Every Empty/In-Progress state has a labeled CTA — **zero dead ends**.
10. No new tables, migrations, models, or AI calls; `tsc` clean; no fabricated numbers anywhere.

**Out of scope (no infra):** new compensation models, scraping, promotion-probability ML, any new database object.
