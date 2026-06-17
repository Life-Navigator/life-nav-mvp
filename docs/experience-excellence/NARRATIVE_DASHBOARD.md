# Narrative Dashboard — Audit & Redesign

Experience Excellence Sprint. Goal: make the already-built Life Model intelligence VISIBLE.
No new infra, no new models, no mock data. Every claim below is grounded in real code.

## 1. Current dashboard — what actually renders

Entry point: `apps/web/src/app/dashboard/page.tsx`. Top-to-bottom render order:

1. `LifeBrief` — **NEW this sprint** (`apps/web/src/components/dashboard/LifeBrief.tsx`), now at the very top (`page.tsx:69-75`).
2. `ExecutiveSummary` (`apps/web/src/components/dashboard/ExecutiveSummary.tsx`) — the previous hero.
3. `LifeIntelligence` (`apps/web/src/components/dashboard/LifeIntelligence.tsx`).
4. `MissionControl` + `DashboardClient` (domain cards, alerts, first-insight).

### ExecutiveSummary (pre-sprint hero) leads with METRICS, not story

- The hero is a **readiness ring** (`ExecutiveSummary.tsx:78-109, 211-213`) — a 0–100 number is the
  first thing the eye lands on.
- Vision block shows `confidence_pct` / `discovery_completion_pct` as the headline metadata
  (`ExecutiveSummary.tsx:228-237`).
- The rest is a grid of **percentage widgets**: Priorities/Risks/Opportunities lists
  (`:334-389`), Goal progress bars (`:392-443`), Domain readiness bars (`:445-475`).
- It consumes `/api/life/my-life` (`:148`) but **only** reads `life_vision`, `what_matters_most`,
  `life_readiness`, `next_best_action`, `constraints` — it does **not** read `life_brief`.

### LifeIntelligence also surfaces objective + confidence, not narrative

- Shows `primary_objective.title` + `confidence` %, themes as chips, "Also active" objectives
  (`LifeIntelligence.tsx:118-153`), and a "Life model coverage" % (`:157-173`).
- Reads `/api/life/snapshot` (`:69`) — has access to richer fields but renders the objective-centric
  view, not the life story.

**Verdict:** the dashboard answers _"how complete is your data?"_ before it answers _"what life are
you building?"_ — exactly backwards for a product whose moat is the per-user life narrative.

## 2. Intelligence that is COMPUTED but NOT surfaced

The backend `LifeDiscoveryService.snapshot()`
(`apps/lifenavigator-core-api/app/services/life_discovery.py:795-852`) computes a rich life model.
Most of it never reaches the dashboard:

| Computed field                                                                    | Where                                              | Surfaced in UI?                                                                                                     |
| --------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `dominant_narrative` (key/label/summary/domains/signals/confidence)               | `life_discovery.py:285-339`, returned `:822`       | **No** — the actual life STORY was invisible until the Life Brief                                                   |
| `goal_portfolio` (every stated goal, coexisting, w/ domain+status)                | `:817-820, 823`                                    | **No** — only goals from `/api/goals` (a different store) show in ExecutiveSummary                                  |
| `emotional_signals` (distress, burnout, money_stress, ambition…)                  | `emotional_signals()` `:254-271`, returned `:824`  | **No**                                                                                                              |
| `candidate_objectives` (unconfirmed/persona-seeded)                               | `:838-840`                                         | **No** — no "possible goals you haven't confirmed" view                                                             |
| tension / conflict between objectives                                             | `objectives_plan()._CONFLICTS` `:868-875, 896-908` | Partial — `LifeIntelligence` shows `plan.conflicts` (`LifeIntelligence.tsx:200-212`) but it's buried below the fold |
| `life_brief.tension` (≥2 competing domains; burnout/distress framing)             | `life_brief()` `:458-467`                          | **Now** via Life Brief                                                                                              |
| `narrative_question` / `narrative_step_prompt` (proof-of-understanding questions) | `:353-413`                                         | **No** — discovery-only, not reflected on dashboard                                                                 |

The composer that finally surfaces the narrative is `life_brief(snapshot, next_action, readiness)`
(`life_discovery.py:416-499`), wired into `MyLifeService.my_life()`
(`apps/lifenavigator-core-api/app/services/my_life.py:202-207`). It returns:
`{ ready, headline, body, situation, tension, stakes, next_move, readiness_line, goals_held[],
confidence_pct, source }`. When `ready=false` it returns the honest "still forming" copy
(`life_discovery.py:431-440`) — no fabricated story.

## 3. Redesign principle — lead with the story, demote the percentages

1. **Narrative first.** The top of the dashboard is the user's life _story_ in their own words
   (headline = `dominant_narrative.label`, body = composed situation+tension+stakes+next_move).
   Percentages are supporting detail, not the lede.
2. **Honest provenance, never magic.** Confidence % and source line accompany the narrative
   (`life_brief.confidence_pct` / `.source`) so it reads as grounded, not generated. Reuse the
   existing `ProvenanceBadge` vocabulary (`apps/web/src/components/ui/ProvenanceBadge.tsx`).
3. **No empty heroics.** `ready=false` → "still forming" + a CTA to the advisor. Never invent.
4. **Demote, don't delete.** The readiness ring and domain bars stay — they move _below_ the brief
   as the "how am I tracking" layer.

## 4. What I implemented this sprint (the Life Brief card)

- New component `apps/web/src/components/dashboard/LifeBrief.tsx`:
  - Fetches `/api/life/my-life` and reads the top-level `life_brief` object.
  - **Ready state:** navy→teal gradient hero (matches the brand system), headline as the life story,
    `body` as the narrative paragraph, `goals_held` as chips ("What you're holding right now"),
    `readiness_line` as a quiet line, and `confidence_pct` + `source` as a provenance footer.
  - **`ready=false`:** indigo→white "still forming" card with the backend's honest headline/body and
    a "Talk to your advisor" CTA. Renders nothing if no `life_brief` at all (degrade safe).
  - Only renders fields the API returns — zero fabrication.
- Wired in at the **top** of the dashboard: `apps/web/src/app/dashboard/page.tsx:69-75` (above
  `ExecutiveSummary`).
- `pnpm type-check` clean; `eslint` clean on both files.

## 5. Prioritized plan for the rest

### P0 (cheap, high trust impact — surfacing only)

- **Demote the readiness ring** inside `ExecutiveSummary` so the brief is unambiguously the lede
  (move ring into the "Domain readiness" row; keep the number, lose the hero placement).
- **Show `candidate_objectives`** as a clearly-labeled "Possible goals — not yet confirmed" strip
  (data already at `snapshot.candidate_objectives`, `life_discovery.py:838-840`; gated by `confirmed`).
- **Surface `goal_portfolio` with status** (confirmed / candidate / inferred) instead of (or beside)
  the `/api/goals` list, so the dashboard goals match the life model.

### P1 (small UI work)

- **Tension/conflict as a first-class card** near the brief: pull `plan.conflicts`
  (`objectives_plan`, `life_discovery.py:896-908`) up from the bottom of `LifeIntelligence`.
- **Emotional-signal-aware tone**: when `emotional_signals` contains `burnout`/`distress`, soften the
  metric-heavy cards (already reflected in `life_brief.tension`; extend to the action card copy).
- **Reconcile the two heroes**: ExecutiveSummary's vision block now duplicates the brief headline —
  collapse it into a thinner "north star + readiness" strip.

### P2 (deeper)

- **Per-goal narrative anchoring** — link each `goal_portfolio` item to the objective/narrative it
  serves (see `GOAL_PROGRESS_SYSTEM.md`).
- **"Why this brief" expander** — reveal the `signals`/`domains` that drove the narrative
  (`dominant_narrative.signals`/`.domains`) for full explainability.
