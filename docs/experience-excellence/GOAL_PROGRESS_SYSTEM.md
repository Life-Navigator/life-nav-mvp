# Goal Progress System — Design

Experience Excellence Sprint. **Design only** — no new infra, no new model/agent work, no mock data.
How goal/objective progress should be shown: goal-based, narrative-anchored, and honest about what is
confirmed vs candidate vs inferred. Grounded in fields the backend already computes.

## 1. The data we already have (no new computation needed)

From `LifeDiscoveryService.snapshot()`
(`apps/lifenavigator-core-api/app/services/life_discovery.py:795-852`):

- **`goal_portfolio`** (`:817-820, 823`) — _every_ stated goal, never collapsed to one:
  `{ goal, domain, confidence, status }`. `status` is `active` / `future_goal` / `candidate`
  (set in `analyze_statement`, `:673-685`, and defaulted `:819`).
- **`objectives`** (`:841-844`) — ranked active objectives w/ `confirmed`, `origin`, `confidence`,
  `themes`, `why_chain`, `surface_goal`.
- **`candidate_objectives`** (`:838-840`) — unconfirmed / persona-seeded; `confirmed:false`.
  Candidate-protected so they can never be presented as the primary (penalty in `score_objective`,
  `:235-237`).
- **`dominant_narrative`** (`:822`) — the life story each goal serves (`label`/`summary`/`domains`).

From `MyLifeService.my_life()` (`apps/lifenavigator-core-api/app/services/my_life.py:158-166`):

- **`life_readiness`** — per-domain `{ domain, progress, status, gap }` from the Life Readiness
  Engine. This is the only _numeric_ progress that is real today.

Separately, `/api/goals` feeds `ExecutiveSummary`'s "Goal progress" bars
(`ExecutiveSummary.tsx:403-443`) using `progress_percent` / `target_value` / `current_value`. This is
a **different store** from `goal_portfolio` — a key reconciliation point (see §5).

## 2. Core principle — narrative-anchored, honesty-graded

A goal is not a progress bar in a vacuum; it is a **commitment inside a life story**. Every goal we
show should answer three things, all from existing data:

1. **What life does it serve?** → the `dominant_narrative.label` it rolls up to.
2. **How sure are we it's yours?** → its honesty grade (below), never a single % masquerading as fact.
3. **Where does it stand?** → real progress _only where we have it_ (readiness domain / target vs
   current); otherwise an honest "not yet measurable."

### Honesty grades (drive the badge, not a fake %)

Map existing fields onto the `ProvenanceBadge` vocabulary
(`apps/web/src/components/ui/ProvenanceBadge.tsx:7-15`):

| Grade         | Source field                                                             | Badge                           |
| ------------- | ------------------------------------------------------------------------ | ------------------------------- |
| **Confirmed** | objective `confirmed:true` & `origin:"user"` (`snapshot.objectives`)     | `user_confirmed` → "Confirmed"  |
| **On record** | `goal_portfolio` item with a supporting quote, `status:"active"`         | `user_stated` → "On record"     |
| **Candidate** | `candidate_objectives` / portfolio `status:"candidate"` (persona-seeded) | `advisor_inferred` → "Inferred" |
| **Inferred**  | objective `origin != "user"` but `confirmed`                             | `advisor_inferred` → "Inferred" |

This is the trust spine: a persona-seeded "financial independence" goal must visibly read as a
_candidate_, not a confirmed commitment (consistent with the candidate-protection logic at
`life_discovery.py:806-811, 235-237`).

## 3. Progress — show ONLY what is real

Three honest progress modes, picked per goal:

1. **Quantified** — when a goal has `target_value` + `current_value` (`/api/goals`), show the bar
   exactly as today (`ExecutiveSummary.tsx:405-427`). This is the only place a % is a measurement.
2. **Domain-readiness proxy** — when a goal maps to a readiness domain (`goal_portfolio[].domain` →
   `life_readiness.domains[].progress`), show the domain's readiness as _context_ ("Family readiness
   62%"), clearly labeled as domain-level, never as the goal's own completion.
3. **Qualitative / not-yet-measurable** — when neither exists (most discovery-only goals), show the
   honesty badge + a "what would move this" prompt instead of a fabricated bar. Source the prompt from
   `what_matters_most.depends_on` (`my_life.py:148-151`) or discovery-health prompts
   (`discovery_health()`, `life_discovery.py:912-932`). **Never render a 0% bar as if measured.**

## 4. Proposed surface (composition, not new engines)

A "Your goals" section directly under the Life Brief, grouped by the narrative they serve:

```
Building a family foundation                       (dominant_narrative.label)
  • Buy a family-ready home          [Confirmed]   62% family readiness   →
  • Life insurance for dependents    [On record]   not yet measurable     →
  • Reach financial independence     [Candidate]   — possible goal, confirm with advisor
```

- Group header = `dominant_narrative.label` (the story).
- Each row = a `goal_portfolio` item (user's own words from `goal`/quote).
- Badge = honesty grade (§2). Progress = §3 mode. CTA → advisor to confirm/refine.

## 5. Cheap surfacing wins (do these first — zero new infra)

1. **Render `goal_portfolio` at all.** It's already in the `/api/life/my-life`-adjacent
   `/api/life/snapshot` payload and currently dropped. Highest-leverage win.
2. **Add the honesty badge** to each goal using the existing `ProvenanceBadge` component — no new
   component, just a field mapping (§2).
3. **Show `candidate_objectives` as an explicit "Possible goals (unconfirmed)" group** — the data and
   the `confirmed` flag already exist (`:838-840`); today they're invisible.
4. **Stop fabricating 0% bars.** In `ExecutiveSummary.tsx:405-427`, when `pct` is null, render the
   status/"not yet measurable" line instead of a width-0 gradient bar.
5. **Reconcile the two goal stores.** Decide that `goal_portfolio` (life model) is the dashboard's
   source of truth and treat `/api/goals` as the quantified-tracking overlay (it provides the only
   real numeric progress). Avoids the two-list inconsistency noted in `NARRATIVE_DASHBOARD.md` §2.

## 6. Explicitly out of scope (sprint constraints)

- No new progress-computation engine, no scoring model, no agent.
- No inventing target values where the user hasn't set them — qualitative honesty instead.
- No persisting new fields; this is pure surfacing of `snapshot` + `life_readiness` + `/api/goals`.
