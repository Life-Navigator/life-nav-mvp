# Recommendation Excellence — Surfacing Spec

**Sprint F (Recommendation Excellence) · LifeNavigator Elite Experience Sprint V2**
Grounding date: 2026-06-22 · Surfacing-first · No new infra / models / databases.

## Grounded finding

LifeNavigator runs **two parallel recommendation systems**, both already richer than any
screen renders. (1) The **Recommendation OS** (`apps/lifenavigator-core-api/app/services/recommendations_os.py`)
is a genuine advisor engine: it writes recommendations with a **visible priority formula**
(`Impact × Confidence × Urgency × Evidence ÷ Effort`, lines 74–84), recomputes **real
before/after outcomes** for retirement and life-insurance adequacy (`_recompute_retirement`
lines 175–205; `protection_adequacy_before_pct/after_pct` lines 280–290), classifies every rec
(`ACTION/RISK/OPPORTUNITY/DEPENDENCY/INFORMATION`), de-dupes by finding, ages by decay, and
produces a **Now/Next/Later roadmap** with conflict detection (`roadmap()` 537–555, `_conflicts`
635–655). Its `/dashboard/recommendations` page (`apps/web/src/app/dashboard/recommendations/page.tsx`)
is the **one genuinely advisor-grade surface** in the product. (2) Separately, each **domain
agent** (`app/domains/career.py`, `family.py`, `education.py`, `finance.py`, `health.py`) emits a
`Recommendation` contract (`app/models/common.py:91`) carrying fields the OS does _not_ have:
`tradeoffs_json`, `governance_verdict`, `risks`, `action_steps`, `revisit_date`, `escalation`.
**The biggest hidden-intelligence finding:** the domain `*/recommendations` pages **throw almost
all of this away** — `apps/web/src/app/dashboard/family/recommendations/page.tsx` renders only
`title + priority + description` (lines 43–61), silently dropping the `tradeoffs_json`,
`governance_verdict`, `evidence_json`, `assumptions_json`, `affected_domains`, and
`quantified_impact` that `family.py` (lines 204–304) carefully computes for every card — and the
career page (`apps/web/src/app/dashboard/career/recommendations/page.tsx`) renders an **empty stub**
while `career.py` (lines 207–327) produces fully-evidenced, trade-off-bearing recommendations.

---

## The two payloads (cite-first)

### A. Recommendation OS row — `_shape()` output (`recommendations_os.py:488–502`)

Persisted columns: `148_recommendation_os.sql` + `151_findings_and_roadmap.sql`.

| Field                                                                                                                                                 | Source        | Carried?                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------ |
| `title`, `rec_type`, `category`, `priority`, `confidence`                                                                                             | write() 56–65 | ✅                       |
| `current_state` / `target_state` / `delta`                                                                                                            | 248, 284, 307 | ✅                       |
| `quantified_impact` (`financial_impact_annual`, `coverage_gap`, `success_delta_pts`, `calculation_trace`, `unlocked_capabilities`, `priority_reason`) | 238–290       | ✅                       |
| `narrative` (`why`, `current`, `target`, `delta`, `expected_impact`, `action`)                                                                        | 71–73         | ✅                       |
| `evidence` `[{statement, source_table}]`                                                                                                              | 252, 292, 333 | ✅                       |
| `assumptions` `[{label, value}]`                                                                                                                      | 250           | ✅                       |
| `formula` (priority_score + 5 factors)                                                                                                                | 82–84         | ✅                       |
| `impacted_domains`                                                                                                                                    | 253, 293, 366 | ✅                       |
| `merged_from` (de-dup lineage)                                                                                                                        | 468           | ✅                       |
| **tradeoffs**                                                                                                                                         | —             | ❌ OS has none           |
| **governance_verdict**                                                                                                                                | —             | ❌ OS has none           |
| **related_goals / related_risks / related_opportunities (as links)**                                                                                  | —             | ❌ implicit only         |
| **what_happens_if_ignored**                                                                                                                           | —             | ❌ derivable, not stored |

### B. Domain `Recommendation` contract (`models/common.py:91–109`)

Emitted by `career.py:207`, `family.py:186`, etc.

| Field                                                                                         | Carried? | Rendered anywhere?                               |
| --------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------ |
| `why_it_matters`                                                                              | ✅       | partial (as `description`)                       |
| `evidence: list[Evidence]` (metric_name, metric_value, source_table, observed_at, confidence) | ✅       | ❌ dropped by domain pages                       |
| `assumptions`                                                                                 | ✅       | ❌ dropped                                       |
| `confidence`                                                                                  | ✅       | ❌ dropped                                       |
| `affected_domains`                                                                            | ✅       | ❌ dropped                                       |
| `action_steps: [ActionStep]`                                                                  | ✅       | ❌ dropped                                       |
| `risks` (`career.py:40` "Market estimates are cited bands…")                                  | ✅       | ❌ dropped                                       |
| `tradeoffs_json` (`option_a/option_b/benefit/cost/affected_domains`)                          | ✅       | ❌ **dropped — the single richest unused field** |
| `governance_verdict` + boundary (legal→attorney, medical→clinician)                           | ✅       | ❌ dropped                                       |
| `revisit_date`, `escalation`                                                                  | ✅       | ❌ dropped                                       |

---

## Required element → payload field map

Each recommendation must surface ten elements. Below, each maps to a **real field** and is tagged
**EXISTS-RENDERED**, **EXISTS-UNRENDERED** (built, hidden — the surfacing job), or **MISSING**
(genuinely absent; can be derived from existing data with no new infra).

| #   | Element                     | OS field                                                                                                                                                                             | Domain field                                                                | State                                                                                                                                  |
| --- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Why**                     | `narrative.why` / `description` (72, 326)                                                                                                                                            | `why_it_matters`                                                            | EXISTS-RENDERED (OS) / EXISTS-UNRENDERED (domain pages)                                                                                |
| 2   | **Evidence**                | `evidence[]` + `source_table` (252, 292)                                                                                                                                             | `evidence: Evidence[]`                                                      | EXISTS-RENDERED (OS drawer 136–168) / EXISTS-UNRENDERED (domain)                                                                       |
| 3   | **Impact**                  | `quantified_impact` + `calculation_trace` (238, 286, 200–204)                                                                                                                        | `quantified_impact`                                                         | EXISTS-RENDERED (chips 260–271, drawer) / EXISTS-UNRENDERED (domain)                                                                   |
| 4   | **Confidence**              | `confidence` + `formula` (80–84)                                                                                                                                                     | `confidence: Confidence`                                                    | EXISTS-RENDERED (OS 204–217) / EXISTS-UNRENDERED (domain)                                                                              |
| 5   | **Timeline**                | `estimated_effort` + `time_sensitive` (63, 77)                                                                                                                                       | `revisit_date`, `action_steps[].effort`                                     | EXISTS-UNRENDERED (effort never shown as time; `revisit_date` dropped)                                                                 |
| 6   | **Dependencies**            | `rec_type=="DEPENDENCY"` → `roadmap().blocked_by` (543, 551)                                                                                                                         | `unlocked_capabilities` (270)                                               | EXISTS-RENDERED (OS "Unlock by uploading" 531–548)                                                                                     |
| 7   | **Related Goals**           | `impacted_domains` + `finding_key=="lifedep:..."` linked to `life_objectives` (393–405)                                                                                              | `affected_domains`                                                          | EXISTS-UNRENDERED — page hard-codes `"Affected goals: none linked yet"` (252) **even though the objective title is in evidence (404)** |
| 8   | **Related Risks**           | OS RISK recs share `finding_key`/`resource`; `_conflicts` competition (635–655)                                                                                                      | `risks: list[str]`                                                          | EXISTS-UNRENDERED — `risks` dropped; conflicts rendered but not linked per-card                                                        |
| 9   | **Related Opportunities**   | OS OPPORTUNITY recs (255, 356) co-ranked                                                                                                                                             | —                                                                           | EXISTS-UNRENDERED — never cross-linked on a card                                                                                       |
| 10  | **What Happens If Ignored** | derivable: invert `quantified_impact` (uncaptured $/yr → "$X lost per year", `coverage_gap` → "$X survivor shortfall", `success_delta_pts` → "retirement success stays N pts lower") | `tradeoffs_json.cost` (the "delay" option already names the cost: 253, 270) | **MISSING as a labeled element — but every input already exists.** No new compute.                                                     |

---

## What is genuinely MISSING vs present-but-unrendered

**Present-but-unrendered (the bulk of the work — surface, do not build):**

- `tradeoffs_json` — computed for _every_ career/family/education rec, rendered **nowhere**. This is
  the most advisor-defining field (it shows the rec considered alternatives) and it is 100% wasted.
- `governance_verdict` + domain boundary (legal/medical/tax/financial) — computed, never shown as a
  trust badge. (`family.py:210` family_boundary, `career.py:53` career_boundary.)
- Domain `risks` / `action_steps` / `revisit_date` — computed in `career.py`/`family.py`, dropped by
  every domain `recommendations/page.tsx`.
- Related Goals — the OS already attaches the objective title to evidence (`"You told us your
objective is '{title}', which requires…"`, line 404) and stores `objective_id` in
  `life:dependencies`; the page literally prints `"Affected goals: none linked yet"` (page.tsx:252).
- `calculation_trace` — the human-readable math (`recommendations_os.py:200–204, 289–290`) is in
  `quantified_impact` but the OS card only shows the formula string, not the trace.

**Genuinely MISSING (small, derivable additions — no new infra):**

- **What Happens If Ignored** as a first-class, labeled element. Today it's implicit in
  `quantified_impact` (the upside) and `tradeoffs_json.cost` (the delay cost). Spec: add a pure
  derivation `cost_of_inaction(rec)` in `recommendations_os.py` (alongside `impactChips`) that
  inverts the already-computed numbers — **no new data, no model call**.
- **Per-card related-risk / related-opportunity links.** The OS already groups by `resource`
  (`_conflicts` 638–643) and `finding_key`; expose those links inside `_shape()` rather than only in
  the page-level `conflicts` banner.

---

## Surfacing spec (the work)

### S1 — Unify the domain pages onto the OS card (highest leverage)

`family/recommendations/page.tsx` and the stubbed `career/recommendations/page.tsx` should render the
**same advisor card** the OS page uses (extract `Card`/`Explainability` from
`apps/web/src/app/dashboard/recommendations/page.tsx` into a shared
`apps/web/src/components/recommendations/RecommendationCard.tsx`). Map the domain
`Recommendation` contract → the card props:
`why_it_matters→why`, `evidence→evidence`, `assumptions→assumptions`, `tradeoffs_json→tradeoffs`
(new card section), `risks→relatedRisks`, `affected_domains→impacted_domains`,
`governance_verdict→trust badge`. **Net: zero data dropped.**

### S2 — Render `tradeoffs_json` (the defining advisor signal)

Add a "Considered alternatives" block to the card: `option_a` vs `option_b`, with `benefit`/`cost`.
This is what makes a rec feel like _counsel_ ("we weighed X against Y") rather than a task. Data is
already in every domain card (`career.py:94`, `family.py:238`).

### S3 — Surface the governance boundary as a trust badge

Render `governance_verdict.passed` + the boundary text (legal→attorney, medical→clinician, tax→CPA)
as a small "Reviewed: within counsel boundary" chip. Reuses `family.py:210` / `career.py:53` output.

### S4 — Add `cost_of_inaction()` + render "What happens if ignored"

Pure function in `recommendations_os.py`, surfaced in `_shape()`; rendered as a red-tinted line on
the card. Inversion rules (all from existing fields):

- `quantified_impact.financial_impact_annual` → "Leaving ~$X/yr unclaimed."
- `quantified_impact.coverage_gap` → "Survivors remain ~$X short."
- `quantified_impact.success_delta_pts` → "Retirement success stays N pts lower."
- DEPENDENCY → `priority_reason` (e.g. "Without these, the state decides — not you", line 313).
- else → `tradeoffs_json.cost` of the "delay/self-insure" option.

### S5 — Wire Related Goals

Replace the hard-coded `"Affected goals: none linked yet"` (page.tsx:252) with the objective titles
the OS already attaches (evidence `statement` for `finding_key` starting `lifedep:`/`liferisk:`, and
`life:dependencies.objective_id`). Link to `/dashboard/goals/{id}`.

---

## Empty / In-Progress / Complete states (every surface, zero dead ends)

| State                | Trigger                                                                                                      | Render                                                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Empty**            | `roadmap()` returns no `now/next/later` (page.tsx:463)                                                       | Keep existing honest CTA ("upload an offer letter / 401(k) / benefits") — add the _specific_ DEPENDENCY rec titles from `blocked_by` so the empty state tells the user exactly what to add. |
| **In-Progress**      | rec exists but a required input is missing → `rec_type=="DEPENDENCY"` with `unlocked_capabilities` (270–271) | Render as an "Unlock" card listing what becomes computable; never a dead end — link to `/dashboard/documents`. (Already partly done, 531–548.)                                              |
| **Complete**         | rec has `current_state/target_state/quantified_impact` + evidence                                            | Full advisor card: Why · Evidence · Impact (+trace) · Confidence (+formula) · Timeline · Dependencies · Tradeoffs · Related Goals/Risks · What-Happens-If-Ignored · Lifecycle actions.      |
| **Confidence floor** | `confidence < 0.25` (`_CONF_FLOOR`, line 26)                                                                 | Already routed to `needs_more_information` (524–532). Surface these in domain pages too, labeled "Needs more information", never silently hidden.                                           |

---

## Trust invariants (do not break)

- **No evidence → no recommendation** (`write()` 67–69). Keep. Every card must show its evidence.
- **The formula stays visible** (82–84, page.tsx:210–217). It is the product's credibility.
- **Boundaries are type-enforced**: health = INFORMATION only (318–334), estate = DEPENDENCY only
  (audit gate 596), military OPPORTUNITY must be personalized (600). Surfacing must never re-label.
- **No fabrication** — every new element (cost-of-inaction, related goals) derives from a field that
  already exists. Honest empties everywhere (existing `Muted` pattern, page.tsx:105).

## Out of scope (explicitly)

No new tables (148/151 schema is sufficient), no new model calls, no new recommendation _generation_.
This sprint **renders the intelligence that already exists**.
