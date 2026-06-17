# Goal-Centric Dashboard — FINAL Plan (Finish Line)

**Sprint:** Finish Line. **Scope rule:** Design only — do NOT change code, do NOT commit.
Surface EXISTING data. No new models / agents / infra / DB. No fabrication. Honest empty states only.

**Consolidates (does not duplicate):**

- `docs/experience-excellence/NARRATIVE_DASHBOARD.md` — original audit; Life Brief built + promoted to top.
- `docs/experience-excellence/GOAL_PROGRESS_SYSTEM.md` — narrative-anchored, honesty-graded goal model.
- `docs/pilot-polish/NARRATIVE_FIRST_DASHBOARD.md` — the reorder/demote spine for the pilot.
- `docs/pilot-polish/GOAL_CENTRIC_PROGRESS.md` — the human-named goal card + the two-store reconciliation.

This is the **final, single** plan: lead with Life Narrative → Goals → Progress → Dependencies → Risks
→ Actions, and demote domain-percentage emphasis. It states exactly what is already shipped, the exact
reorder/demote by file:line, the real data each section reads, and the **hard blocker** that gates the
goal-progress cards.

---

## 0. Verdict in one line

The narrative already leads (Life Brief ships at the top). The remaining work is (a) **demote**
domain-percentage widgets below the fold, (b) **promote** Goals from chips/bars into one human-named
goal spine, and (c) **do not ship goal-progress cards until the two-store split is reconciled** — see §5.

---

## 1. What is ALREADY shipped (real file:line — don't redo)

Dashboard render order today (`apps/web/src/app/dashboard/page.tsx:64-88`):

1. `LifeBrief` — narrative hero, leads (`page.tsx:70-72`; component `components/dashboard/LifeBrief.tsx`).
   Reads `/api/life/my-life` `life_brief` (`LifeBrief.tsx:57-62`) + `narrative_explanation` (`:63`).
   Honest "still forming" state (`LifeBrief.tsx:83-111`). Renders headline/body, `goals_held` chips
   (`:131-147`), `watching` + `could_change` (`:151-182`), confidence + source (`:189-196`), and the
   "Why Arcana believes this" panel (`:199`, `WhyArcanaBelieves` `:207-269`). **This is correct — keep.**
2. `ExecutiveSummary` (`page.tsx:76-78`; `components/dashboard/ExecutiveSummary.tsx`) — readiness ring
   - vision + NBA + Priorities/Risks/Opps + Goal progress + Domain readiness. **Leads with metrics.**
3. `LifeIntelligence` (`page.tsx:83`) — objective + confidence + coverage % (217 lines).
4. `MissionControl` (`page.tsx:84`) — a **second** readiness index ring from a different engine.
5. `DashboardClient` (`page.tsx:86`) — domain cards (Finance/Health/Education %) + alerts + first-insight.

Backend that feeds all of the above is built and trustworthy:

- `MyLifeService.my_life()` (`apps/lifenavigator-core-api/app/services/my_life.py:81-214`) assembles
  `life_brief`, `narrative_explanation`, `life_vision`, `what_matters_most`, `life_readiness`,
  `next_best_action`, `constraints`, `recent_intelligence`, `has_discovery` — **one call**.
- Grounded-only risks/opps (no archetype labels) at `my_life.py:89-108`.
- `life_brief()` composer at `life_discovery.py:416-513` (situation/tension/stakes/next_move + V2
  watching/could_change). Honest empty state `:431-440`.

So the data spine the prior docs asked for **exists in the payload**. The remaining gap is purely
front-end ordering/weighting plus the goal-store join (§5).

---

## 2. The problem (evidence-based, still true)

Per `docs/pilot-polish/NARRATIVE_FIRST_DASHBOARD.md §1` (re-verified against current code):

- **Two readiness numbers within one screen.** `ExecutiveSummary`'s `ReadinessRing`
  (`ExecutiveSummary.tsx:78-109`, fed by `life_readiness.overall` `:213`) AND `MissionControl`'s index
  ring (`MissionControl.tsx:175-188`, fed by `/api/platform/dashboard` — a _document-driven_ engine).
  A pilot user sees two different "my readiness" scores. This is architecture leaking into the UI.
- **Domain-percentage widgets dominate.** `ExecutiveSummary` "Domain readiness" bars
  (`ExecutiveSummary.tsx:445-475`) + `DashboardClient` domain cards (Finance/Health/Education %,
  coverage from `/api/life/discovery-coverage`, `DashboardClient.tsx:123-139`). "Health 0% /
  Education 0%" reads as _"this product is empty"_ immediately after the Life Brief told a rich story.
  Domains are LifeNavigator's internal architecture, not how a human narrates a life.
- **Goals shown in three architecture-shaped ways at once:** `goal_portfolio` chips
  (`LifeBrief.tsx:131-147`), `/api/goals` progress bars (`ExecutiveSummary.tsx:392-443`), and domain
  bars (`ExecutiveSummary.tsx:445-475`). None is a human-named goal card; the two goal lists are
  disjoint stores (§5).

---

## 3. Target order — the narrative spine (FINAL)

All data already in `/api/life/my-life` (`my_life.py:81-214`) unless noted. No new endpoints except the
goal-card join in §5 (which is gated).

| #   | Section                  | Source (real field)                                                                     | Status / action                                |
| --- | ------------------------ | --------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1   | **Life Narrative**       | `life_brief` (`my_life.py:204-207`) + `narrative_explanation` (`:209`)                  | DONE — `LifeBrief.tsx`. Keep at top.           |
| 2   | **Goals (human-named)**  | `goal_portfolio` (snapshot `life_discovery.py:891-893`) joined w/ `/api/goals` (see §5) | **P1 — gated on §5 reconciliation**            |
| 3   | **Progress**             | `/api/goals` `progress_percent` / `target`/`current` (`ExecutiveSummary.tsx:405-411`)   | **P1 — only the goals that actually have it**  |
| 4   | **Dependencies**         | `what_matters_most.depends_on` (`my_life.py:149-150`) + `constraints[]` (`:190-197`)    | P1 — promote to own section                    |
| 5   | **Risks**                | `what_matters_most.risks` (grounded only, `my_life.py:102,107`)                         | DONE in payload; **demote ring above it (P0)** |
| 6   | **Actions**              | `next_best_action` (`my_life.py:168-188`)                                               | DONE — `ExecutiveSummary.tsx:298-332`          |
| —   | Domain readiness / cards | `life_readiness.domains[]` + `DashboardClient` cards                                    | **DEMOTE below the fold (P0)**                 |

---

## 4. Exact reorder / demote (file:line) — P0/P1/P2

### P0 — kill the duplicate readiness signal and demote domain percentages

These are pure ordering/visibility changes, no data dependency, lowest risk, highest credibility gain.

1. **Collapse the second readiness ring.** `MissionControl.tsx:174-206` renders a readiness index ring
   (`:175-188`) from `/api/platform/dashboard` — a different engine than `life_readiness.overall` used
   by `ExecutiveSummary.tsx:213`. **Action:** demote `MissionControl` to a doc-activation utility only.
   Either (a) remove the readiness ring block (`MissionControl.tsx:174-206`) and keep only the
   journey/gaps/missing-docs sections, or (b) move the whole component below `DashboardClient` so a
   single readiness number (the life-model one) leads. The activation empty state
   (`MissionControl.tsx:96-166`) stays — it is the genuine no-docs onboarding.
2. **Demote `ExecutiveSummary` "Domain readiness" card.** `ExecutiveSummary.tsx:445-475`. Move it out
   of the top grid into a collapsed/below-the-fold "Coverage detail" area, or behind a disclosure. It
   is internal architecture, not narrative.
3. **Demote the readiness ring as the visual lead inside `ExecutiveSummary`.** The hero is currently a
   0–100 ring (`ExecutiveSummary.tsx:208-272`, ring at `:213`). Keep the ring but shrink it / move it
   beside the vision text so the _vision sentence_ (`:220-224`) is the first thing read, not the number.
   No data change — purely the JSX order inside the hero `Card`.
4. **Domain cards in `DashboardClient`** (Finance/Health/Education %) — demote below the narrative spine
   (they already render last, `page.tsx:86`; ensure nothing percentage-heavy renders _above_ the goal
   spine after the P1 promotion).

### P1 — promote the goal spine (Goals → Progress → Dependencies → Risks)

**GATED on §5.** Until the goal-store join exists, do the non-goal parts only:

5. **Promote Dependencies to its own section.** Today `what_matters_most.depends_on` is folded into the
   "Priorities" card as grey sub-bullets (`ExecutiveSummary.tsx:346-351`) and `constraints[]` is in the
   payload (`my_life.py:190-197`) but only surfaced inside the Life Brief "watching" chips
   (`LifeBrief.tsx:151-166`). **Action:** render a dedicated "What this depends on" section between
   Goals and Risks, fed by `depends_on` + `constraints` (dedup; both already filtered of generic labels
   at `my_life.py:149-150` and via `GENERIC_*` in `my_life.py:14,105-106`).
6. **Single Risk emphasis.** Risks already render (`ExecutiveSummary.tsx:358-372`) as 1 of 3 equal cards.
   Promote the top grounded risk (`what_matters_most.risks[0]`) into the spine; keep the rest in a list.
7. **Goal cards (the human-named spine, item #2/#3 above)** — implement ONLY after §5 lands. Card fields
   per `docs/pilot-polish/GOAL_CENTRIC_PROGRESS.md`: Status · Progress · Dependencies · Risks ·
   Confidence · Projected completion, each honesty-graded (confirmed/candidate/inferred per
   `GOAL_PROGRESS_SYSTEM.md`).

### P2 — polish

8. Replace `ExecutiveSummary`'s "Priorities" card (`:336-356`) with the promoted Dependencies section
   (it currently mixes `supporting_objectives` + `depends_on`, which is confusing).
9. Fold `LifeIntelligence` (`page.tsx:83`, objective + confidence + coverage %) into the narrative —
   its objective is already in the Life Brief; the coverage % is another domain-percentage surface.
10. Provenance badges (`ProvenanceBadge`, already imported `ExecutiveSummary.tsx:15`) on each goal card.

---

## 5. THE BLOCKER — goal-store reconciliation (do NOT ship goal cards until resolved)

This is the single hard dependency. There are **two unrelated goal datasets**, and the dashboard
already renders both as if they were one truth.

### Store A — `public.goals` (the `/api/goals` route)

- Read at `apps/web/src/app/api/goals/route.ts:35-48` → `supabase.from('goals').select('*')`.
- UI columns (`ExecutiveSummary.tsx:59-67`): `id, title, category, status, progress_percent,
target_value, current_value`. Has **quantitative progress** — but is a manual CRUD list
  (`POST /api/goals` → `createGoal`, `route.ts:55-103`). NOT derived from the life model / advisor.

### Store B — `goal_portfolio` (the life-model snapshot)

- Built at `life_discovery.py:887-893` from the `candidate_goals` table. Fields per goal:
  `{goal, domain, confidence, status}`, `status` defaults to `"candidate"` (`:892`).
- This is what the **narrative, Life Brief (`goals_held`), and "Why Arcana believes this"** are built
  from (`life_brief` reads `goal_portfolio`, `life_discovery.py:425-426`, surfaced
  `LifeBrief.tsx:131-147`). It is the _intelligent_ store — but has **NO progress, NO per-goal
  dependencies, NO target date.**

### The mismatch (the #1 credibility risk for goal cards)

- A user who told the advisor "I'm planning a wedding" gets a Store B entry that drives the narrative —
  but it will **not** appear in the "Goal progress" bars (Store A) unless they _also_ manually created
  a "Wedding" goal at `/goals/create`.
- Conversely a `public.goals` row with `progress_percent` shows a bar the narrative knows nothing about.
- Net: **the same goal can appear twice with different data, or appear in one place and be invisible in
  the other.** Shipping goal cards on top of this split would make the product look like it forgot what
  the user just told it — the exact trust smell we are eliminating.

### Reconciliation design (no new DB — join in the API layer)

Per `docs/pilot-polish/GOAL_CENTRIC_PROGRESS.md §2`: a new goal-card endpoint composes ONE list by
joining the two stores **by normalized title** —

- **Store B (`goal_portfolio`) = source of truth for _meaning_** (which goal, which narrative it serves,
  confidence/honesty grade). Every goal-portfolio goal appears.
- **Store A (`public.goals`) = source of _quantitative progress_** (`progress_percent`,
  `target_value`/`current_value`), matched onto a Store B goal by normalized title; otherwise the goal
  is shown with an honest "not yet measurable" state (no fabricated bar).
- A Store A goal with no Store B match still appears (user-created), labeled as a manually tracked goal.
- Honesty grade carries through: confirmed > stated > candidate > inferred (the candidate-protect logic
  already lives in the backend, `life_discovery.py:879-885`).

**Hard rule for this sprint:** the goal-progress section (spine items #2/#3) stays behind this join.
Until it exists, the dashboard shows the `goals_held` chips (already shipped, honest) and the
Dependencies/Risks/Actions promotions (P1 items 5-6). Do not render per-goal progress bars that read
from only one store. **Cross-reference: `GOAL_SYSTEM_RECONCILIATION`** (the join contract + normalized-
title matcher must be specified/owned there before goal cards ship).

---

## 6. Honesty / trust invariants (must hold)

- Never fabricate a goal, progress %, dependency, risk, or readiness number. Every section already has
  an honest empty state (`LifeBrief.tsx:83-111`, `ExecutiveSummary.tsx:180-206,353-355,369-371,432-441`)
  — preserve them through the reorder.
- Risks/opps remain grounded-only (`my_life.py:89-108`); never surface `GENERIC_RISK_OPP_LABELS`.
- One readiness number on screen after P0.
- A goal with no measured progress shows "not yet measurable," never a 0% or invented bar.

---

## 7. Sequencing summary

- **P0 (no data dependency, ship first):** single readiness ring (items 1), demote domain percentages
  (items 2-4). Immediate credibility win.
- **P1a (no gate):** promote Dependencies + single-Risk spine (items 5-6).
- **P1b (GATED on §5 / `GOAL_SYSTEM_RECONCILIATION`):** human-named goal cards with progress (item 7).
- **P2:** absorb Priorities/LifeIntelligence, provenance badges (items 8-10).
