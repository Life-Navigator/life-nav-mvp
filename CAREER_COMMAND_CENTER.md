# The Career Command Center

**Grounded finding.** The Career backend is far richer than the Career UI. Three production-grade engines already compute investor-grade intelligence that _no career surface reads_: (1) `CompensationBenefitsEngine` (`apps/lifenavigator-core-api/app/services/comp_benefits.py`) turns uploaded offer letters / 401(k) / HSA / insurance docs into total comp, a 5-year value curve, benefit valuation, retirement projection, insurance-gap analysis, and FSA/HSA tax optimization — exposed at `/v1/benefits` and consumed by nothing in `apps/web/src/app/dashboard/career/*`; (2) `CompensationIntelligenceEngine` + `MarketPositionAnalyzer` (`compensation.py`, `market_intelligence.py`) produce cited OEWS market-value bands and a before/during/after role-change scenario, exposed at `/v1/career/compensation` and `/v1/career/market-position`; (3) a deterministic 7-component `scoreCareer` readiness model (`apps/web/src/lib/readiness/career.ts`) recorded to `life.readiness_snapshots` (migration 163) that already drives the Phase 7 PDF and advisor. The current overview page (`apps/web/src/app/dashboard/career/page.tsx`) renders only a coverage bar, a readiness card, raw counts, and a flat recommendation list — it reads `/api/career/summary`, `/overview`, `/readiness` and **never touches `/compensation`, `/market-position`, `/report`, or `/v1/benefits`.** Promotion-readiness logic _does_ exist (as the `promotion_readiness` recommendation family, `career.py:304-317`) but is buried inside an unlabeled bullet list. The job is surfacing, not building.

---

## EXISTS vs MISSING (audited)

| Command Center section             | Status                        | Source of truth (real path)                                                                                       |
| ---------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Current Position                   | EXISTS, surfaced thinly       | `public.career_profiles` (note: NOT `career` schema — `career.py:95`); `career.experience_records` (`is_current`) |
| Promotion Readiness                | EXISTS, **buried**            | `promotion_readiness` family, `career.py:304-317` (tenure ≥3y + advancement goal + cited comp lift)               |
| Skill Gaps                         | EXISTS                        | `career.skill_gaps`; rendered as a count only in `page.tsx:91`                                                    |
| Compensation Intelligence          | EXISTS, **unwired**           | `/v1/career/compensation` → `CompensationIntelligenceEngine.market_value` (cited OEWS band)                       |
| Total Comp / Benefits / 5-yr value | EXISTS, **unwired**           | `/v1/benefits` → `CompensationBenefitsEngine.analyze` (`comp_benefits.py:75`)                                     |
| Market Benchmark                   | EXISTS, **unwired**           | `/v1/career/market-position` → `MarketPositionAnalyzer.position`                                                  |
| Career Risks                       | PARTIAL                       | derived from below-market comp (`compensation_growth` family, `career.py:288`) + readiness `gaps[]`               |
| Career Opportunities               | EXISTS                        | `role_transition` + `skill_gap_closure` families (`career.py:262-328`); `/dashboard/career/opportunities`         |
| Career Timeline                    | EXISTS (data), MISSING (view) | `career.experience_records` with `start_date`/`end_date` — no chronological visual                                |
| Recommended Certifications         | EXISTS                        | `certification_roi` family (`career.py:276`); `/dashboard/career/certifications`                                  |
| Next Career Move                   | EXISTS, **buried**            | composite of `job_targets` + `scenario.median_lift` + top recommendation                                          |
| Career Readiness score             | EXISTS                        | `scoreCareer` (`career.ts`), recorded `life.readiness_snapshots`                                                  |

**Genuinely MISSING (build NOTHING new — these are composition gaps):** a chronological **Career Timeline** view, a labeled **Promotion Readiness** panel, and a single **Next Move** hero. All three are _compositions of data that already exists_.

---

## The Command Center layout (advancement, not admin)

The page must read like a chief-of-staff briefing on your career, not a data-entry form. Top-to-bottom:

### 1. Hero — "Where you stand, where you're going"

- **Current role** (`career_profiles.current_title @ current_company`, `years_of_experience`) — already in `/api/career/overview` snapshot.
- **Estimated market value band** from `/v1/career/compensation` → `current_estimated_market_value` `{low, median, high}` with the `source` (`BLS OEWS`) and `confidence` cited inline. This is the single most credible number on the page and it is currently invisible.
- **Next move chip**: target role (`job_targets.role_title`) + `scenario.median_lift` ("+$X median toward Senior Engineer").
- States: **Empty** → "Add your current role to see your market value" CTA to `/dashboard/career/add`. **In-Progress** → role known, no comp band ("We have your role; market band needs a recognized title or geography"). **Complete** → role + band + target.

### 2. Promotion Readiness panel (NEW SURFACE, existing logic)

Compose from signals that already exist — see `PROMOTION_ENGINE.md`. Renders a labeled readiness statement with its evidence (tenure, goal type, comp lift) pulled straight from the `promotion_readiness` recommendation's `evidence` array. No new engine.

- **Empty** → "Set an advancement goal to assess promotion readiness" → `/dashboard/career/goals`.
- **In-Progress** → "You're building toward it: 2 of 4 signals present" (tenure yes, goal yes, comp-gap unknown, performance unconfirmed).
- **Complete** → "You're in range for a promotion push" with the cited evidence chips.

### 3. Compensation Intelligence card

Wire `/v1/career/compensation` (current + target bands + `scenario`) and `/v1/benefits` (`total_compensation`, `five_year_value`, `benefit_valuation`, `retirement_impact`, `fsa_hsa.annual_net_worth_effect`). Show the **5-year value curve** (`five_year_value.by_year`) — a chart that makes the platform feel like a wealth tool, not a job board. Every figure carries its `source_documents` citation; `missing_documents[]` becomes honest "Upload your 401(k) to model retirement impact" prompts (the engine already emits these literal strings).

- **Empty** → no comp doc on file: render `confidence.basis = "no compensation document on file"` and a CTA to `/dashboard/career/documents`.
- **In-Progress** → comp doc present, benefit docs missing: show total comp + the `missing_documents` checklist.
- **Complete** → full benefit picture with `annual_net_worth_effect`.

### 4. Market Benchmark strip

`/v1/career/market-position` → demand level + percentile context. Honest "unknown / insufficient data" when no reference band exists (the analyzer already returns this, never invents).

### 5. Skill Gaps → Closure plan

Promote `career.skill_gaps` from a count to a list with severity, each linked to the `skill_gap_closure` recommendation and its cited comp lift. CTA `/dashboard/career/skills`.

### 6. Career Timeline (NEW SURFACE, existing data)

Chronological render of `career.experience_records` (`title`, `employer`, `start_date`, `end_date`, `is_current`) plus `volunteer_records` and `side_projects` (migration 162). A visual spine that makes years of history feel like an asset. Empty → "Add your roles to build your timeline."

### 7. Recommendations (relabeled, not flat)

Group the 5 families by intent — Advance (promotion/role_transition), Earn (compensation_growth), Grow (skill_gap_closure/certification_roi) — instead of one bullet list. Each carries its existing `evidence`, `assumptions`, `risks`, and the `career_guidance` boundary.

---

## Wiring checklist (surfacing-only, no new infra)

1. Add `/api/career/compensation`, `/api/career/market-position`, `/api/career/report`, `/api/benefits` Next.js proxies (mirror existing `/api/career/summary/route.ts`). The Python endpoints already exist.
2. `page.tsx` `useEffect` already does parallel fetches — add three more reads; render into the new cards.
3. Read promotion signals from the recommendation whose `recommendation_type === 'promotion_readiness'` (already returned by `/api/career/recommendations`).
4. Timeline + benefits-curve are pure presentational components over data already in the responses.

**No new tables, models, endpoints, or AI calls.** Every number on this page already has a `source` and `confidence` in its originating payload — surface them as trust chips.
