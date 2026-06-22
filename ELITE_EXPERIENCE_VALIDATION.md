# Elite Experience Validation — Persona × Surface Matrix

**LifeNavigator Elite Experience Sprint V2 · Validation deliverable**
Grounding date: 2026-06-22 · Surfacing-first · No new infra / models / databases.

> **Central finding (carried through every deliverable):** LifeNavigator's intelligence is
> largely _built_. The bottleneck is **visibility, trust, and experience** — the backend computes
> more than any screen renders. This validation scores what the five evaluation personas actually
> saw, then maps each weak score to a _surfacing_ fix over data that already exists (cited
> file:line), distinguishing **EXISTS-UNRENDERED** (built, hidden) from **genuinely MISSING**.

---

## 1. Persona × Surface score matrix (0–10)

| Surface                   | Family Builder | Career Maximizer | Burnout Exec | Founder / Legacy | Avg      |
| ------------------------- | -------------- | ---------------- | ------------ | ---------------- | -------- |
| Dashboard (Home)          | 6              | 7                | 6            | 7                | **6.5**  |
| Family (Family Office)    | 7              | 6                | 8            | 8                | **7.25** |
| Documents                 | 5              | 5                | 7            | 6                | **5.75** |
| Health                    | 4              | 4                | 5            | 6                | **4.75** |
| Career                    | 6              | 8                | 7            | 7                | **7.0**  |
| Education                 | 5              | 6                | 5            | 5                | **5.25** |
| Recommendations (Roadmap) | 7              | 7                | 8            | 8                | **7.5**  |
| Life Graph                | 5              | 6                | 6            | 6                | **5.75** |
| Reports                   | 6              | 5                | 7            | 7                | **6.25** |

(The fifth scored persona returned a null/blank surface payload and is excluded from surface
averages; its dimension scores are likewise excluded. Four complete personas drive the figures
below.)

**Highest-scoring surfaces:** Recommendations Roadmap (7.5), Family Office (7.25), Career (7.0) —
the three surfaces where the sprint's surfacing work is _furthest along_.
**Lowest-scoring surfaces:** Health (4.75), Education (5.25), Documents/Life Graph (5.75) — the
surfaces still rendering thin wrappers or static empty states over rich backends.

## 2. Dimension averages across personas

| Dimension             | FB  | CM  | BE  | FL  | Avg      |
| --------------------- | --- | --- | --- | --- | -------- |
| Understanding         | 6   | 8   | 7   | 8   | **7.25** |
| Trust                 | 6   | 7   | 8   | 8   | **7.25** |
| Usefulness            | 5   | 7   | 6   | 7   | **6.25** |
| Visual quality        | 6   | 6   | 8   | 7   | **6.75** |
| Advisor quality       | 6   | 7   | 7   | 8   | **7.0**  |
| Emotional resonance   | 4   | 5   | 5   | 6   | **5.0**  |
| Overall experience    | 5   | 6   | 6   | 7   | **6.0**  |
| Investor-demo quality | 5   | 6   | 6   | 7   | **6.0**  |

**The shape of the result is the thesis.** Trust (7.25) and Understanding (7.25) — the dimensions
driven by the _built_ intelligence (evidence, cited bands, deterministic scoring, honest empties) —
are the highest. Emotional resonance (5.0) and Overall experience (6.0) — the dimensions driven by
_surfacing and framing_ — are the lowest. The product is trusted but not yet _felt_. That gap is
exactly what this sprint's surfacing program closes.

## 3. What's strong (ship as-is, amplify)

1. **Recommendation Roadmap is genuinely advisor-grade.** Now/Next/Later sequencing with a _visible_
   priority formula `Impact × Confidence × Urgency × Evidence ÷ Effort`
   (`recommendations_os.py:74–84`, verified), real before/after recompute (`_recompute_retirement`,
   `protection_adequacy_*_pct`), full evidence + assumptions + confidence drawer. Every persona
   named it a standout. `apps/web/src/app/dashboard/recommendations/page.tsx` is the one surface
   that already renders the moat.
2. **Family Office 5-pillar model is intuitive and real.** Estate · Trust · Beneficiary · Survivor ·
   Legacy with G/Y/O/R scoring + missing-document list + attorney boundary, computed by
   `FamilyOfficeService` (`app/services/family_office.py`) and now **surfaced** via
   `GET /v1/family/office` → `apps/web/src/app/api/family/office/route.ts` →
   `apps/web/src/app/dashboard/family/page.tsx`. This is the Sprint-A precedent: a hidden engine made
   the centerpiece.
3. **Deterministic, source-grounded readiness.** No black box; every score traces to a real table
   with confidence and basis. `life.readiness_snapshots` (migration 163) is a _record of a computed
   result, not a second scorer_ — verified header — giving the TS scorers and the Python
   advisor/PDF one source of truth.
4. **Honest empty states everywhere — no fake zeros.** Every persona independently called this out.
   It is a trust asset, not a gap to paper over.
5. **Career intelligence is authoritative.** OEWS-cited compensation bands, 5-family recommendation
   engine, market-position analysis — `CompensationIntelligenceEngine`, `MarketPositionAnalyzer`,
   `CareerService.report_model`.

## 4. What's weak (and the EXISTS-UNRENDERED diagnosis)

| Weak surface                         | Persona pain                                                           | Diagnosis                                                                                                                                                                                                                                                                                                                                            | Evidence                                                                              |
| ------------------------------------ | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Health (4.75)**                    | "Beta shell", "echoes documents", no trends                            | **EXISTS-UNRENDERED.** 9 of 13 tabs render a _static_ `HealthTabEmpty` that never changes when data exists; the real readiness/lab UI lives on an orphan route `/dashboard/health-intelligence` that no nav links to.                                                                                                                                | `HEALTH_EXPERIENCE_REDESIGN.md`; `health_intelligence.py:48,79,81`                    |
| **Education (5.25)**                 | "Records list, no ROI verdict", "should I get this degree?" unanswered | **EXISTS-UNRENDERED + one missing input UI.** `EducationROIEngine` ranks programs with cited ROI/scenarios; `roi-analysis` & `career-alignment` tabs render inert `EducationTabEmpty` stubs; the web app can't even create `education.programs` rows the engine consumes.                                                                            | `EDUCATION_EXPERIENCE_REDESIGN.md`; `education_roi.py`; `routers/education_domain.py` |
| **Documents (5.75)**                 | "Filing cabinet, black box, no extraction preview"                     | **EXISTS-UNRENDERED.** 31-type extractor + per-field confidence + provenance (page/section/char-span, migration 165) all built; `ProvenanceBadge` exists but is not integrated; confidence bands live only in the Evidence drawer, not at first sight.                                                                                               | `DOCUMENT_INTELLIGENCE_TRUST_SPRINT.md`; `OCR_TRUST_AUDIT.md`                         |
| **Life Graph (5.75)**                | "Abstract", "empty on cold start", "art not action"                    | **EXISTS-UNRENDERED.** Every node persisted, every edge carries provenance; but the IA leads with developer telemetry (node/edge counts, avg-confidence) and never reads the composed `life_brief` narrative or per-domain `graph_integrity` (computed then _dropped_ in `build_workspace`).                                                         | `GRAPH_EXPERIENCE_REDESIGN.md`; `life_graph_workspace.py:168–221`                     |
| **Dashboard cold-start (6.5)**       | "Empty shell", "intimidating onboarding", "no aha moment"              | **Genuinely MISSING (small):** guided first-run sequence + change-visibility feed. Underlying data exists; the missing piece is the _path in_.                                                                                                                                                                                                       | `DOCUMENT_CHANGE_VISIBILITY.md`; `MCP_RENDER_AUDIT.md` fix #4                         |
| **All domain Recommendations pages** | rich cards only on the OS surface                                      | **EXISTS-UNRENDERED — the single richest waste.** Domain `*/recommendations` pages render only `title+priority+description`, silently dropping `tradeoffs_json`, `governance_verdict`, `evidence_json`, `assumptions_json`, `affected_domains`, `quantified_impact` that `career.py`/`family.py` compute per card. The career page is an empty stub. | `RECOMMENDATION_EXCELLENCE.md` (lines 21–27, 64)                                      |

## 5. The biggest hidden-intelligence finding

**`life.facts` is a fully-built, provenance-complete, idempotent write-only sink with zero readers.**
Verified: a project-wide grep finds `life.facts` read only by its own writer (`documents.py`); no
advisor, dashboard, report, or graph queries it (`MCP_RENDER_AUDIT.md`). Every document a user
uploads has its detailed values (beneficiary names, executor, trustee, premium, insurer, policy
type, every comp/financial value) extracted, confidence-scored, conflict-checked, and written here
with full provenance — and then **rendered nowhere.** Wiring a single `life.facts` reader into
`advisor_facts.py` makes every extracted value advisor-visible and citable in one change. This is
the highest-leverage surfacing move in the product.

## 6. Prioritized surfacing backlog (effort → score movement)

Ordered by leverage. Every item surfaces data that already exists — no new tables, models, or AI
calls. "Lift" is the projected average-surface-score movement.

| #         | Surfacing task                                                                                                                                  | Source spec                                                   | Effort | Moves                                        | Lift |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------ | -------------------------------------------- | ---- |
| **P0-1**  | Wire a `life.facts` reader into `advisor_facts.py` (cited, `confirmation_status != candidate`, not rejected)                                    | `MCP_RENDER_AUDIT.md` fix #1                                  | S      | Advisor quality, Trust, Documents            | High |
| **P0-2**  | Unify domain `*/recommendations` pages onto the shared OS advisor card; render `tradeoffs_json` + `governance_verdict` + evidence               | `RECOMMENDATION_EXCELLENCE.md` S1–S3                          | M      | Usefulness, Advisor quality (Family, Career) | High |
| **P0-3**  | Wire Education `roi-analysis`/`career-alignment` to `/v1/education/comparison`; add a Programs CRUD input page                                  | `EDUCATION_EXPERIENCE_REDESIGN.md` §2                         | M      | Education 5.25 → ~7                          | High |
| **P0-4**  | Health: replace static `HealthTabEmpty` per tab with `/v1/health/intelligence` slices; promote orphan readiness route into nav                  | `HEALTH_EXPERIENCE_REDESIGN.md`                               | M      | Health 4.75 → ~6.5                           | High |
| **P1-5**  | Life Graph: lead with `life_brief` headline + next move; auto-focus #1 node; pass `graph_integrity` through `build_workspace`; demote telemetry | `GRAPH_EXPERIENCE_REDESIGN.md`                                | M      | Emotional resonance, Life Graph              | Med  |
| **P1-6**  | Career: surface `/compensation` band + 5-yr value curve + Promotion Readiness panel (Option A, zero backend change)                             | `CAREER_EXPERIENCE_REDESIGN.md`; `PROMOTION_ENGINE.md`        | M      | Career, Usefulness                           | Med  |
| **P1-7**  | Documents: render confidence bands on extracted-field chips at first sight (not just drawer); integrate `ProvenanceBadge`                       | `OCR_TRUST_AUDIT.md`; `DOCUMENT_INTELLIGENCE_TRUST_SPRINT.md` | S      | Documents, Trust                             | Med  |
| **P1-8**  | Add `cost_of_inaction()` derivation + render "What happens if ignored" (inverts existing `quantified_impact`)                                   | `RECOMMENDATION_EXCELLENCE.md` S4                             | S      | Emotional resonance, Usefulness              | Med  |
| **P2-9**  | Dashboard cold-start: guided first-run + change-visibility feed (toast "Estate readiness 50→75")                                                | `DOCUMENT_CHANGE_VISIBILITY.md`                               | M      | Onboarding, Emotional resonance              | Med  |
| **P2-10** | Scanned-document dead-end → "type the values yourself" manual-entry fallback (reuses `extraction_method='manual'`)                              | `OCR_TRUST_AUDIT.md`                                          | S      | Documents (zero dead ends)                   | Low  |

**Net effect modeled:** P0 block alone moves the four weakest surfaces (Health, Education,
Documents, domain Recommendations) from the 4.75–5.75 band into the 6.5–7.5 band, and lifts
Emotional resonance (the lowest dimension) by surfacing narrative, tradeoffs, and change-visibility
that the backend already produces.

## 7. Cross-persona verdict

LifeNavigator is a **trusted advisory backbone whose intelligence outruns its interface.** Personas
consistently rate Trust and Understanding high and Emotional Resonance low — the signature of a
product where the moat is built but hidden. The backlog above is _surfacing, not building_: every
fix renders data that already exists, with honest Empty / In-Progress / Complete states and zero
dead ends. Execute P0 and the experience scores rise toward the (already-high) trust scores.
