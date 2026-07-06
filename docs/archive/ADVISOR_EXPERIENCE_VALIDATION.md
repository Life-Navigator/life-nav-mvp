# Advisor Experience Validation

**LifeNavigator Elite Pilot Sprint · Final persona validation**
Grounding date: 2026-06-22 · 5 of 5 personas returned · No fabrication · Every claim traces to real code or to a returned persona score.

## Method

Five evaluation personas (Family Builder, Career Maximizer, Burnout Executive, Financial Stress,
Founder / Legacy Builder) each scored the nine product surfaces (Discovery, Advisor, Documents,
Family, Career, Education, Health, Recommendations, Reports) on a 0–10 scale, plus eight experience
dimensions. **All five returned**, so the averages below are over the full panel, not a subset.

This validation is read against the just-shipped/just-designed work: **Sprint B (`life.facts`
reader) SHIPPED** in `app/services/advisor_facts.py`, and **Sprint A (Arcana Advisor OS) DESIGNED**
across four specs. Where a persona gap is already closed or addressed by that work, it is flagged.

## Persona × surface matrix (score 0–10)

| Surface             | Family Builder | Career Maximizer | Burnout Exec | Financial Stress | Founder/Legacy | **Avg** |
| ------------------- | -------------- | ---------------- | ------------ | ---------------- | -------------- | ------- |
| **Discovery**       | 8              | 8                | 7            | 8                | 8.5            | **7.9** |
| **Advisor**         | 7              | 6                | 8            | 7                | 7.5            | **7.1** |
| **Documents**       | 8              | 8                | 7            | 6                | 7              | **7.2** |
| **Family**          | 7              | 6                | 6            | 7                | 7              | **6.6** |
| **Career**          | 7              | 9                | 6            | 7                | 7              | **7.2** |
| **Education**       | 7              | 7                | 5            | 6                | 6.5            | **6.3** |
| **Health**          | 7              | 5                | 6            | 5                | 6.5            | **5.9** |
| **Recommendations** | 8              | 9                | 8            | 8                | 8              | **8.2** |
| **Reports**         | 7              | 6                | 7            | 6                | 6              | **6.4** |

**Surface ranking (best → weakest):** Recommendations 8.2 · Discovery 7.9 · Documents 7.2 ·
Career 7.2 · Advisor 7.1 · Family 6.6 · Reports 6.4 · Education 6.3 · Health 5.9.

## Dimension averages (over all 5 personas)

| Dimension                 | Avg     | Read                                                                                                     |
| ------------------------- | ------- | -------------------------------------------------------------------------------------------------------- |
| **Trust**                 | **7.6** | Highest. The moat. No fabrication, cited numbers, honest empties — every persona named it as a standout. |
| **Understanding**         | **7.3** | Strong. Discovery's "need behind the need" + live coverage % lands.                                      |
| **Visual quality**        | **7.1** | Clean/functional. "Utilitarian Tailwind," not signature.                                                 |
| **Advisor quality**       | **7.1** | Good chat + grounding; capped by _read-only_ advisor (sees facts, doesn't act).                          |
| **Usefulness**            | **7.0** | Solid; capped by data gaps and gated domains.                                                            |
| **Investor demo quality** | **6.9** | Weakest-but-one. Gated Career/Education + stub Reports + hidden reasoning.                               |
| **Emotional resonance**   | **6.3** | Lowest. Intake/fact-gathering excels; the _felt_ "this changed my life" payoff is thin.                  |

The shape is unchanged from V2 and diagnostic: **dimensions driven by built intelligence (Trust
7.6, Understanding 7.3) lead; dimensions driven by surfacing/framing (Emotional 6.3, Investor 6.9)
lag.** That is the signature of a product whose backend outruns its interface.

## What is strong (consensus across personas)

1. **Recommendations OS (8.2).** The single highest-scoring surface, praised by all five. Visible
   priority formula `Impact × Confidence × Urgency × Evidence ÷ Effort` (verified
   `recommendations_os.py:74–84`), quantified impact chips, evidence lineage (`source_table → recommendation`),
   confidence %, blocked-by dependencies. "Investor demo gold" (Career Maximizer).
2. **Discovery (7.9).** Chat-native intake with live coverage % per domain and an honest "still
   forming" state. Every persona: "feels like an advisor asking, not a form."
3. **Trust spine (7.6).** No fake zeros, no fabricated insight, missing-data renders as "add this"
   not as a placeholder metric. Named a standout strength by every persona.
4. **Compensation intelligence (Career 9 for the Career Maximizer).** OEWS-grounded bands, cited
   `ln_central.compensation_bands`, role-transition comp lift, zero fantasy salaries — when the
   persona's needs hit the built depth, the score spikes to 9.

## What is weak (consensus across personas)

1. **Health (5.9) — the weakest surface.** Document-intake only; passive/read-only; "shallow without
   integrated wellness recommendations." Burnout Exec and Financial Stress both flag no action
   follow-up. Matches `HEALTH_EXPERIENCE_REDESIGN.md`: real readiness/lab-flag intelligence exists
   on an orphan route; 9/13 tabs render a static empty state ignoring real data.
2. **Education (6.3).** `EducationROIEngine` ranks programs with cited ROI/scenarios, but the
   ROI/career-alignment tabs are inert stubs and the web can't create the `programs` rows the engine
   needs (`EDUCATION_EXPERIENCE_REDESIGN.md`, `EDUCATION_DECISION_CENTER.md`). Personas see a catalog,
   not a decision tool.
3. **Reports (6.4).** Six report types promised; several personas could not verify working PDF
   output from code inspection ("wireframes only," "CSV-level templates"). Trust model for report
   accuracy untested.
4. **Advisor is read-only (7.1, depressed).** Every persona noticed the advisor _reads_ `life.facts`
   but cannot _act_: "no visible negotiation guidance," "knowledge is mostly read-only," "no
   life-scenario modeling." This is exactly the gap **Sprint A (Arcana Advisor OS) is designed to
   close** — the state-a-change → impact → approval → model-update loop.
5. **Emotional resonance (6.3).** No "hero moment." Sparse early-onboarding readiness (honest but
   fragile for first-time UX); no cohesive single "Here's your life model" view tying vision →
   objectives → daily action.

## Prioritized surfacing backlog

Ordered by (persona-consensus severity × proximity to the investor demo path). All are
**rendering/orchestration over existing data — no new infra, models, or DB.**

| #        | Surface             | Action                                                                                                                      | Why (persona evidence)                                                                                      | Status                                                                    |
| -------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **P0-1** | Advisor             | Ship the **Arcana Advisor OS loop** (state-change → impact → approval card → MCP write → show-what-changed)                 | All 5: advisor is read-only; "one-time intake, not ongoing coach." Closes the #1 advisor gap.               | **DESIGNED** (Sprint A: `ARCANA_ADVISOR_OS.md` + 3 specs) — build pending |
| **P0-2** | Documents/Dashboard | Render the SHIPPED `life.facts` reader user-facing ("recently learned" strip)                                               | Extracted values are advisor-citable now but invisible to the user post-upload (`FACT_VISIBILITY_AUDIT.md`) | Advisor reader **SHIPPED**; user-facing render **designed**               |
| **P0-3** | Health              | Wire the 9 static tabs to `/v1/health/intelligence`; add action follow-up                                                   | Weakest surface (5.9); orphan route; static empties ignore real data                                        | **DESIGNED** (`HEALTH_EXPERIENCE_REDESIGN.md`)                            |
| **P0-4** | Education           | Education Decision Center + Programs input so the ROI engine is reachable                                                   | Inert stubs; can't create `programs` rows (6.3)                                                             | **DESIGNED** (`EDUCATION_DECISION_CENTER.md`)                             |
| **P1-5** | Reports             | Verify/finish working PDF output + citation rendering; test report-accuracy trust                                           | "Wireframes only" (6.4); investor-grade output unproven                                                     | Partial / verify                                                          |
| **P1-6** | Recommendations     | Extend roadmap coverage to Career/Education (today finance/family-centric)                                                  | Burnout Exec: "roadmap is finance-biased"                                                                   | Build over existing engine                                                |
| **P2-7** | Cross-domain        | Surface existing `affected_domains` / `blocked_by` as dependency + scenario links (e.g. life-insurance gap → Family Office) | 4/5: "domains feel disconnected," no orchestration                                                          | Data exists; surfacing                                                    |
| **P2-8** | Advisor (ongoing)   | Live life-model context panel in steady-state advisor (parity with onboarding)                                              | Founder/Legacy: ongoing advisor lacks the immersive context panel                                           | Reuse onboarding panel                                                    |
| **P3-9** | Visual              | Hero moment / signature visual on dashboard landing                                                                         | Emotional resonance 6.3; "no aspirational polish"                                                           | Design                                                                    |

## Bottom line

The validation confirms the sprint thesis with hard numbers: **Trust 7.6 / Understanding 7.3 lead;
Emotional 6.3 / Investor 6.9 lag** — built intelligence outruns its surfacing. The two highest-ROI
moves are already in flight: **Sprint B SHIPPED** the `life.facts` reader (advisor can now cite
extracted document values), and **Sprint A DESIGNED** the Advisor OS that converts the read-only
advisor into an action loop. Closing Health/Education dead-ends and verifying Reports removes the
demo soft spots. None of the top-9 backlog items require new infrastructure.
