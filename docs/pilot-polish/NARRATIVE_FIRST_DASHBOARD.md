# Narrative-First Dashboard — Pilot Polish

**Sprint:** Pilot Polish — make Arcana's intelligence VISIBLE.
**Scope rule:** No new models / agents / infra / DB. Surface EXISTING data. No fabrication. Design only — do not change code in this doc.
**Builds on (do not duplicate):** `docs/experience-excellence/NARRATIVE_DASHBOARD.md`, `docs/experience-excellence/LIFE_BRIEF_ENGINE.md`, `docs/experience-excellence/GOAL_PROGRESS_SYSTEM.md`. This doc is the concrete _reorder + demote_ plan for the pilot; the Life Brief engine is already built and shipping.

---

## 1. The problem (real, evidence-based)

The dashboard renders, top to bottom (`apps/web/src/app/dashboard/page.tsx:64-88`):

1. `LifeBrief` — narrative hero (GOOD, already leads)
2. `ExecutiveSummary` — readiness ring + vision + NBA + priorities/risks/opps + goal progress + **domain readiness**
3. `LifeIntelligence` — snapshot/plan/health
4. `MissionControl` — document-readiness index + journey + gaps
5. `DashboardClient` — alerts + domain cards (Finance 25% / Health 0% / Education 0%)

Two intelligence layers are competing and the _architecture_ leaks through the UI:

- **Two readiness scores rendered within ~one screen.** `ExecutiveSummary`'s `ReadinessRing` (`ExecutiveSummary.tsx:78-108`, fed by `life_readiness.overall`) AND `MissionControl`'s readiness index ring (`MissionControl.tsx:175-188`, fed by `/api/platform/dashboard` — a _different_ document-driven engine). A pilot user sees two different numbers for "my readiness."
- **Domain-percentage widgets dominate the bottom** (Finance 25% / Health 0% / Education 0% in `DashboardClient`, plus the "Domain readiness" card in `ExecutiveSummary.tsx:445-475`). These are LifeNavigator's _internal architecture_ (domains), not how a human narrates their life. Health 0% / Education 0% reads as "this product is empty," undercutting the rich narrative the Life Brief just told.
- **The genuinely impressive intelligence is buried or split:** Active Constraints (`my_life.py:190-197`) is computed but only surfaced inside the Life Brief's "watching" chips; Biggest Risk / Biggest Opportunity live mid-page in 3 equal-weight cards (`ExecutiveSummary.tsx:334-389`); Top Goals as humans name them never appear (only domain bars + the separate `/api/goals` list).

**Verdict:** the narrative ALREADY leads (Life Brief). The fix is (a) collapse the duplicate readiness signal, (b) **promote** Current Narrative → Top Goals → Active Constraints → Biggest Opportunity → Biggest Risk → Recommended Actions → Goal Progress into one coherent spine, and (c) **demote** the domain-percentage widgets below the fold.

---

## 2. Target order (the narrative spine)

All data already exists in `/api/life/my-life` (`my_life.py:81-214`) unless noted. No new endpoints.

| #   | Section                             | Source (real field)                                                                                            | Status                                             |
| --- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 1   | **Current Narrative**               | `life_brief` (`my_life.py:204-207`, `life_discovery.py:498-513`) + `narrative_explanation` (`my_life.py:209`)  | DONE — `LifeBrief.tsx`                             |
| 2   | **Top Goals**                       | `goal_portfolio` (snapshot `life_discovery.py:891-893`) → surfaced today only as `life_brief.goals_held` chips | NEEDS PROMOTION (see GOAL_CENTRIC_PROGRESS.md)     |
| 3   | **Active Constraints**              | `constraints[]` (`my_life.py:190-197`)                                                                         | EXISTS in payload, NOT rendered as its own section |
| 4   | **Biggest Opportunity**             | `what_matters_most.opportunities[0]` (`my_life.py:103,108`)                                                    | rendered, but as 1 of 3 equal cards                |
| 5   | **Biggest Risk**                    | `what_matters_most.risks[0]` (`my_life.py:102,107`)                                                            | rendered, but as 1 of 3 equal cards                |
| 6   | **Recommended Actions**             | `next_best_action` (`my_life.py:168-188`)                                                                      | DONE — `ExecutiveSummary.tsx:298-332`              |
| 7   | **Goal Progress**                   | `/api/goals` (separate store) — see reconciliation in GOAL_CENTRIC_PROGRESS.md                                 | rendered `ExecutiveSummary.tsx:392-443`            |
| —   | **Domain readiness / domain cards** | `life_readiness.domains[]` + `DashboardClient` cards                                                           | **DEMOTE below the fold**                          |

---

## 3. What's already done (do not rebuild)

- **Current Narrative leads.** `LifeBrief` is first on the page (`dashboard/page.tsx:70-72`) and is a true narrative hero: headline = life story, body = situation/tension/stakes/next-move, `goals_held` chips, `watching` + `could_change`, confidence + source provenance, honest "still forming" state (`LifeBrief.tsx:75-103`). It reads 100% real data from `/api/life/my-life life_brief`.
- **"Why Arcana believes this"** explainability is shipped (`LifeBrief.tsx:197-259`, fed by `narrative_explanation`).
- **Recommended Action** (NBA) with honest "insufficient" state is shipped (`ExecutiveSummary.tsx:274-332`; backend `my_life.py:168-188` already degrades to `kind:"insufficient"` rather than inventing an action).
- **Honest empty states everywhere** — no fabrication. Keep this invariant.

---

## 4. What to reorder / demote (concrete)

### 4.1 Collapse the duplicate readiness signal — P0

- **Keep** the `ExecutiveSummary` `ReadinessRing` (`ExecutiveSummary.tsx:213`) — it is fed by the _life model_ (`life_readiness.overall`, `my_life.py:158-166`) which is what the narrative spine is about.
- **Demote** `MissionControl`'s readiness index ring + status card (`MissionControl.tsx:174-206`) out of the hero zone. `MissionControl` is the _document-acquisition_ journey (`/api/platform/dashboard`); it belongs below the fold as "Document readiness," not as a second hero. Its activation empty state (`MissionControl.tsx:97-166`) is valuable for zero-document users — keep that path, but when documents exist render it as a compact "Documents & gaps" strip, not a second readiness hero.
- **Net effect:** exactly ONE readiness number above the fold.

### 4.2 Promote Active Constraints to its own section — P0

- The `constraints[]` array (`my_life.py:190-197`) merges advisor-discovery constraints, red/orange readiness gaps, and missing-discovery areas — each with a `source`. Today it is only echoed into Life Brief "watching" chips.
- Render a dedicated **"What's standing in your way"** card directly under the narrative, listing `constraints[].label` + `.detail` + a small source tag (`.source`). Honest empty state: render nothing (omit the card) when `constraints` is empty — never "No constraints!" (absence ≠ clear path).

### 4.3 Re-weight Risk / Opportunity — P1

- Replace the 3-equal-column grid (`ExecutiveSummary.tsx:334-389`) with a **Biggest Opportunity** + **Biggest Risk** emphasis: lead with `opportunities[0]` and `risks[0]` as two prominent cards; collapse the remaining `risks[1..]` / `opportunities[1..]` into a "more" disclosure. These are already grounded-only (the Recommendation OS supplies them; generic archetype labels are filtered at `my_life.py:104-108`). Keep the honest empty copy already at `ExecutiveSummary.tsx:370,386`.
- "Priorities" (the third column today) becomes part of the Top Goals section (§2 of the spine), not a peer of Risk/Opportunity.

### 4.4 Demote domain percentages below the fold — P0

- Move the **"Domain readiness"** card (`ExecutiveSummary.tsx:445-475`) and the `DashboardClient` domain cards (Finance 25% / Health 0% / Education 0%) into a single collapsed **"By area"** section at the bottom, under a heading like "Detail by life area." Rationale: 0% on Health/Education is technically honest but narratively destructive when shown above grounded narrative + goals + constraints.
- Do NOT delete them — power users and the readiness engine still need them; just stop letting architecture-shaped widgets out-rank the life story.

### 4.5 Page assembly — P1

- Reorder `dashboard/page.tsx:64-88` so the JSX order is: `LifeBrief` → (new) Top Goals → (new) Active Constraints → Opportunity/Risk → Recommended Action → Goal Progress → (demoted) `MissionControl` document strip → (demoted) domain "By area" → `LifeIntelligence`/`DashboardClient` detail.
- `ExecutiveSummary` is the natural host for §3-§7 since it already fetches `/api/life/my-life` once; split its render into the spine order rather than its current hero/grid/grid layout. One fetch, reordered render — no new network cost.

---

## 5. Exact data contract per section (all real)

```
Current Narrative      life_brief.{headline, body, situation, tension, stakes, next_move,
                         goals_held, watching, could_change, confidence_pct, source, ready}
                       narrative_explanation.{why, contributing_goals, evidence_signals,
                         confidence_pct, confidence_label, source}
Top Goals              goal_portfolio[].{goal, domain, confidence, status}   (snapshot)
                         status ∈ confirmed | candidate | inferred  ← provenance, see goal doc
Active Constraints     constraints[].{label, detail, source}
Biggest Opportunity    what_matters_most.opportunities[0]   (string; grounded-only)
Biggest Risk           what_matters_most.risks[0]           (string; grounded-only)
Recommended Action     next_best_action.{kind, label, title, why, recommended_action,
                         expected_benefit, needed_to_act, confidence_pct}
                         kind ∈ action | priority_issue | insufficient  ← render honestly
Goal Progress          /api/goals (public.goals): {title, category, status,
                         progress_percent, target_value, current_value}
Domain (DEMOTED)       life_readiness.{overall, status, domains[].{domain,progress,status,gap}}
```

**Fabrication guardrails (keep):**

- `next_best_action.kind === "insufficient"` → render the "not enough info" card (`ExecutiveSummary.tsx:274-296`), never a fake action.
- `life_brief.ready === false` → "still forming" state, never a manufactured narrative.
- Empty `risks` / `opportunities` / `constraints` → omit or render honest copy; never generic placeholders. The backend already strips `GENERIC_RISK_OPP_LABELS` / `GENERIC_DEPENDENCY_LABELS` (`my_life.py:104-108,149-150`); do not re-introduce them in the UI.

---

## 6. Prioritized plan

**P0 (pilot-blocking — the "architecture is showing" problems):**

1. Collapse duplicate readiness — demote `MissionControl` readiness ring out of the hero zone (§4.1).
2. Promote **Active Constraints** to its own section under the narrative (§4.2).
3. Demote domain-percentage widgets (incl. Health 0% / Education 0%) below the fold into "By area" (§4.4).

**P1 (visible polish):** 4. Re-weight to Biggest Opportunity + Biggest Risk; collapse the rest (§4.3). 5. Reassemble the page into the narrative spine order (§4.5). 6. Promote **Top Goals** as human-named goal cards (full design in GOAL_CENTRIC_PROGRESS.md).

**P2 (nice-to-have):** 7. Single "as of <timestamp>" + source line for the whole spine so provenance is felt once, not repeated per card. 8. Smooth the two activation paths (no-discovery vs no-documents) so a brand-new user sees one coherent "let's start" flow, not Executive empty state + Mission Control empty state stacked.

---

## 7. Blockers / open questions

- **Top Goals provenance** depends on `goal_portfolio.status` semantics (confirmed/candidate/inferred) — detailed in GOAL_CENTRIC_PROGRESS.md §provenance.
- **Goal Progress (§7) reads a different store** (`/api/goals` = `public.goals`) than the life model's `goal_portfolio` — reconciliation is the central finding of GOAL_CENTRIC_PROGRESS.md. The dashboard reorder should not ship the Goal Progress card next to Top Goals until that reconciliation is resolved, or pilot users will see the same goal twice with different data.
