# Recommendation Card — Visual Redesign (Advisor-Grade)

**Sprint F (Recommendation Excellence) · LifeNavigator Elite Experience Sprint V2**
Surfacing-first · No new infra/models · All data cited to existing fields.

## Grounded finding

The central roadmap card (`apps/web/src/app/dashboard/recommendations/page.tsx`, `Card` 273–386 +
`Explainability` 110–257) is **already the best card in the product** — it shows the title, a
`Now → Target` delta pill, impact chips, the visible priority formula, a collapsible Why/Evidence/
Impact drawer, and lifecycle buttons. But it reads like an **analytics card**, not **advisor
counsel**: (1) the most advisor-defining field — `tradeoffs_json` ("we weighed term life vs
self-insuring") computed for every career/family/education rec (`career.py:94`, `family.py:238`) —
is **rendered nowhere**; (2) the `governance_verdict` trust boundary (legal→attorney, medical→
clinician) is dropped; (3) there is **no "what happens if you ignore this"** — the emotional spine
of advice; (4) Related Goals is hard-coded to `"none linked yet"` (page.tsx:252) even though the OS
attaches the objective title to evidence (line 404); and (5) the `calculation_trace` (the
human-readable math, `recommendations_os.py:200–204`) is computed but never shown. Meanwhile the
**domain pages are worse** — `family/recommendations/page.tsx` renders only title+priority+
description (lines 43–61) and `career/recommendations/page.tsx` is an empty stub. The redesign below
is a **single reusable card** that surfaces 100% of the existing payload and reads as guidance.

---

## Design principles

1. **Counsel, not a checkbox.** Lead with the human "why" and the stakes, not the action verb.
2. **Show the working.** The formula + `calculation_trace` are the trust moat — surface, don't hide.
3. **Considered alternatives = advisor signal.** `tradeoffs_json` is what separates advice from a TODO.
4. **Stakes on the front.** "What happens if ignored" lives above the fold, not in a drawer.
5. **Zero data dropped.** Every persisted field has a home. Honest empties (`Muted`, page.tsx:105).

---

## Card anatomy — collapsed (above the fold)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ●NOW   [ ACTION ]  ·  finance  ·  Reviewed: within advisor boundary ✓      │  ← rec_type + category + governance_verdict
│                                                                            │
│ Increase your 401(k) from 6% to 9%                                         │  ← title
│ Why this is #1: highest priority — high impact × 0.9 confidence,           │  ← why_now (lead only) 296–304
│ low effort, strong document evidence.                                      │
│                                                                            │
│   Now: 6%   →   Target: 9%      +3%                                        │  ← current/target/delta 314–325
│                                                                            │
│ Your employer matches up to 9% — you're leaving $4,200/yr on the table.    │  ← narrative.why / description
│                                                                            │
│  ↑ +$4,200/yr captured match   ·   retirement success 71% → 78%           │  ← impact chips 260–271 (incl. recomputed)
│                                                                            │
│  ⚠ If ignored: ~$4,200 of free employer money lost every year you wait.   │  ← NEW: cost_of_inaction() — derived, not new data
│                                                                            │
│  Do: Raise your 401(k) contribution to 9% to capture the full match.      │  ← recommended_action 327–331
│                                                                            │
│  comp_benefits · 90% confidence · 1 supporting datapoint · priority 5.40   │  ← source/conf/evidence/formula line 347–356
│                                                                            │
│  [ ⌄ Why, evidence & trade-offs ]                  [Accept][Start][Defer]…  │  ← drawer toggle 357–364 + lifecycle 366–383
└──────────────────────────────────────────────────────────────────────────┘
```

Changes vs today's `Card`:

- **Governance badge** added to the type row (new; from `governance_verdict.passed` + boundary text).
- **"If ignored" line** added above `Do:` (new; `cost_of_inaction()` derivation, RECOMMENDATION_EXCELLENCE.md S4).
- Everything else already renders — keep it.

---

## Card anatomy — expanded drawer (advisor detail)

Extends today's `Explainability` (110–257) with two new sections (Considered Alternatives,
What Happens If Ignored expanded) and a wired Related Goals.

```
┌── Why, evidence & trade-offs ──────────────────────────────────────────────┐
│                                                                             │
│  WHY THIS MATTERS                                                           │  ← narrative.why 128–132
│  Your employer matches up to 9%; at 6% you forgo the full match — the       │
│  highest guaranteed return available to you.                                │
│                                                                             │
│  ┌─────────────────────────────┐  ┌──────────────────────────────────────┐ │
│  │ DATA USED                    │  │ SOURCE / LINEAGE                      │ │  ← evidence 136–168
│  │ • 401(k): 6% vs 9% match     │  │ [documents:401k_statement] → this rec │ │
│  └─────────────────────────────┘  └──────────────────────────────────────┘ │
│                                                                             │
│  ┌─────────────────────────────┐  ┌──────────────────────────────────────┐ │
│  │ EXPECTED IMPACT              │  │ HOW WE CALCULATED IT                  │ │  ← impact + NEW calculation_trace
│  │ +$4,200/yr captured match    │  │ Plan @ 6% → success 71%               │ │     (recommendations_os.py:200–204)
│  │ retirement success 71%→78%   │  │ Plan @ 9% ($X/yr) → success 78%       │ │
│  │                              │  │ Finance Δ = 0.4×(progress 78−71) = 3  │ │
│  └─────────────────────────────┘  └──────────────────────────────────────┘ │
│                                                                             │
│  ┌─ CONSIDERED ALTERNATIVES ──────────────────────────────────────────────┐ │  ← NEW: tradeoffs_json (career.py:94, family.py:238)
│  │  ◉ Raise contribution now      vs    ○ Self-insure via savings          │ │
│  │     + protection/return now            + flexibility                    │ │
│  │     − reduces take-home pay            − forgoes guaranteed match        │ │
│  │  Affects: finance                                                       │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌─────────────────────────────┐  ┌──────────────────────────────────────┐ │
│  │ ASSUMPTIONS                  │  │ CONFIDENCE                            │ │  ← assumptions 189–201 + formula 204–217
│  │ Tax treatment: pre-tax       │  │ 90%   priority 5.40 =                 │ │
│  │ traditional; Roth differs —  │  │ I0.6 × C0.9 × U0.5 × E0.6 ÷ 0.2       │ │
│  │ confirm with a tax advisor.  │  │                                       │ │
│  └─────────────────────────────┘  └──────────────────────────────────────┘ │
│                                                                             │
│  ⚠ WHAT HAPPENS IF YOU IGNORE THIS                                          │  ← NEW expanded: cost_of_inaction + tradeoffs cost
│  Every year at 6% leaves ~$4,200 of guaranteed employer money on the table  │
│  and keeps your modeled retirement success ~7 pts lower.                    │
│                                                                             │
│  RELATED                                                                    │  ← NEW: wire related goals/risks/opps
│  Goals:  [ Retire by 60 → ]      Risks: [ Retirement shortfall ]            │     (objective title from evidence line 404;
│  Opportunities: [ Roth conversion window ]                                  │      conflicts by resource _conflicts 638)
│                                                                             │
│  Affected domains: [finance]        Updated 6/22/2026                       │  ← 236–254
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Impact & confidence visualization

Reuse existing numbers; no new compute.

**Confidence — labeled ring (replaces the bare "90%").** Map `confidence` to a band
(`recommendations_os.py:26` floor 0.25): `<0.25` grey "Needs more info", `0.25–0.5` amber "Tentative",
`0.5–0.75` blue "Likely", `>0.75` green "High confidence".

```
   Confidence            Priority (visible formula)
   ╭───────╮             ████████░░  5.40
   │  90%  │  High        I 0.6  C 0.9  U 0.5  E 0.6  ÷ eff 0.2
   ╰───────╯             (impact·confidence·urgency·evidence÷effort)
```

**Impact — before/after bar** when `quantified_impact` carries recomputed pairs
(`retirement_success_before_pct/after_pct` 197, `protection_adequacy_before_pct/after_pct` 287):

```
 Retirement success   71% ▓▓▓▓▓▓▓░░░  →  78% ▓▓▓▓▓▓▓▓░░   (+7 pts)
```

Falls back to the existing chip row (`impactChips` 260–271) when only a single number exists. Honest
empty ("No quantified impact recorded yet.", 231) preserved.

---

## "What happens if ignored" — derivation (no new data)

`cost_of_inaction(rec)` (pure, in `recommendations_os.py`, surfaced via `_shape()`):

| Available field                             | Rendered line                                                                                |
| ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `quantified_impact.financial_impact_annual` | "Leaving ~$X/yr unclaimed."                                                                  |
| `quantified_impact.coverage_gap`            | "Survivors remain ~$X short of replacing your income."                                       |
| `quantified_impact.success_delta_pts`       | "Retirement success stays ~N pts lower."                                                     |
| `rec_type=="DEPENDENCY"`                    | `quantified_impact.priority_reason` ("Without these, the state decides — not you", line 313) |
| `rec_type=="INFORMATION"` (health)          | **omit** — boundary: never imply consequence (line 332)                                      |
| else                                        | `tradeoffs_json` cost of the "delay/self-insure" option                                      |

Styling: rose-tinted (reuse `TYPE.RISK` palette `bg-rose-100 text-rose-700`, page.tsx:81). One line
collapsed, full sentence in drawer.

---

## Now / Next / Later layout (keep + tighten)

The roadmap structure (page.tsx:490–528) already sequences. Visual upgrade only:

- **Now** = single lead card, indigo border + shadow (`lead` 293–294) — already done. Add a left
  status rail (`●NOW`).
- **Next / Later** = same card, muted. Add a thin connector to read as a _sequence_, not a list.
- **Conflicts banner** (472–481) → move the "Order: A → B" into an inline numbered sequence badge so
  competing recs (`_conflicts` suggested_sequence 653) visibly tie to the cards.
- **Blocked-by** (531–548) — keep; it's the model In-Progress / "unlock by uploading" state.

```
  NOW ──────────────────────────────────────
   ●  [ lead advisor card #1 ]
      │
  NEXT ─────────────────────────────────────
   2  [ card ]
   3  [ card ]
  LATER ────────────────────────────────────
      [ card ] [ card ] …
  ⚠ THESE COMPETE FOR THE SAME $:  ① 401(k) match  →  ② raise coverage
  UNLOCK MORE BY UPLOADING:  Upload your 401(k) statement →
```

---

## Empty / In-Progress / Complete states (zero dead ends)

| State                    | Trigger                                                               | Visual                                                                                                                                                                |
| ------------------------ | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Empty**                | no now/next/later (page.tsx:463)                                      | Friendly card + the **specific** missing-input titles from `blocked_by` ("Add your offer letter / 401(k) / benefits to see your first action"). Never a blank screen. |
| **In-Progress / Unlock** | `rec_type=="DEPENDENCY"` w/ `unlocked_capabilities` (270)             | Amber "Unlock" card listing what becomes computable; primary button → `/dashboard/documents`. Already partly built (531–548).                                         |
| **Needs more info**      | `confidence < 0.25` (line 26) → `needs_more_information` (531)        | Grey card, "Needs more information", surfaced — not hidden.                                                                                                           |
| **Complete**             | full `current/target/quantified_impact/evidence`                      | Full advisor card above, all 10 elements present.                                                                                                                     |
| **Acted on**             | lifecycle `accepted/in_progress/completed/deferred` (set via 366–383) | Status chip on the card; completed/dismissed drop out of `active()` (recommendations_os.py:111).                                                                      |

---

## Reuse map (build nothing new)

| New visual element      | Existing data source                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Considered Alternatives | `tradeoffs_json` (`career.py:94`, `family.py:238`, `education.py`)                                                 |
| Governance badge        | `governance_verdict` + boundary (`family.py:210`, `career.py:53`)                                                  |
| Calculation trace       | `quantified_impact.calculation_trace` (`recommendations_os.py:200–204, 289`)                                       |
| If-ignored line         | derived from `financial_impact_annual` / `coverage_gap` / `success_delta_pts` / `priority_reason` (already stored) |
| Related Goals           | objective title in `evidence.statement` (line 404) + `life:dependencies.objective_id`                              |
| Related Risks/Opps      | `_conflicts` by `resource` (638) + sibling RISK/OPPORTUNITY recs sharing `finding_key`                             |
| Before/after bars       | `*_before_pct` / `*_after_pct` in `quantified_impact` (197, 287)                                                   |
| Confidence ring         | `confidence` + `_CONF_FLOOR` bands (line 26)                                                                       |
| Priority bar            | `formula.priority_score` + 5 factors (82–84)                                                                       |

**Shared component to extract:** `apps/web/src/components/recommendations/RecommendationCard.tsx`
(lift `Card` + `Explainability` out of `dashboard/recommendations/page.tsx`), then have
`family/recommendations/page.tsx` and `career/recommendations/page.tsx` render it — instantly
upgrading both domain pages from "title + priority" (or empty stub) to full advisor cards using data
the backend already computes.
