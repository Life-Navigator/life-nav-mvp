# Goal-Centric Progress — Pilot Polish

**Sprint:** Pilot Polish — make Arcana's intelligence VISIBLE.
**Scope rule:** No new models / agents / infra / DB. Surface EXISTING data. No fabrication. Design only.
**Builds on (do not duplicate):** `docs/experience-excellence/GOAL_PROGRESS_SYSTEM.md`. This doc adds (a) the **human-named goal card** design and (b) the **critical two-store reconciliation** the prior doc did not resolve.

---

## 1. Goal: show goals the way humans think

Humans hold _Wedding, House, Promotion, Family, Masters, Fitness_ — not _Finance / Education / Health_. Today the dashboard shows goals in two architecture-shaped ways:

- `ExecutiveSummary` "Goal progress" — bars from `/api/goals` keyed by `title` (`ExecutiveSummary.tsx:392-443`).
- `life_brief.goals_held` chips — strings from the life model's `goal_portfolio` (`LifeBrief.tsx:121-137`).
- Domain readiness bars — Finance/Health/Education (`ExecutiveSummary.tsx:445-475`).

We want **one goal card per real human goal**, each showing: Status · Progress · Dependencies · Risks · Confidence · Projected Completion — with honest provenance.

---

## 2. THE CRITICAL FINDING — two different goal stores

There are **two unrelated goal datasets**, and the dashboard already renders both as if they were one truth:

### Store A — `public.goals` (the `/api/goals` route)

- Read at `apps/web/src/app/api/goals/route.ts:35-45` → `supabase.from('goals').select('*')`.
- Columns surfaced to UI (`ExecutiveSummary.tsx:59-67`): `id, title, category, status, progress_percent, target_value, current_value`.
- Has **quantitative progress** (`progress_percent`, `current/target_value`) but is a manually-created CRUD list (`POST /api/goals` → `createGoal`, `route.ts:55-103`). It is NOT derived from the life model / advisor discovery.

### Store B — `goal_portfolio` (the life model snapshot)

- Built at `apps/lifenavigator-core-api/app/services/life_discovery.py:891-893` from the `candidate_goals` table (read `life_discovery.py:887`).
- Fields per goal: `{goal, domain, confidence, status}` — where `status` defaults to `"candidate"` (`life_discovery.py:892`).
- This is what the **narrative, Life Brief, and "Why Arcana believes this"** are built from (`life_brief` reads `goal_portfolio`, `life_discovery.py:425-426`). It is the _intelligent_ store — but it has **NO progress, NO dependencies-per-goal, NO target date**.

### The mismatch

- A pilot user who told the advisor "I'm planning a wedding" gets a `goal_portfolio` entry (Store B) that drives the narrative — but it will NOT appear in the "Goal progress" card (Store A) unless they ALSO manually created a "Wedding" goal via `/goals/create`.
- Conversely, a `public.goals` row with `progress_percent` will show a progress bar that the narrative knows nothing about.
- Net: **the same goal can appear twice with different data, or appear in one place and be invisible in the other.** This is the #1 credibility risk for goal cards.

### Reconciliation design (no new DB — surface + join in the API layer)

The new goal-card endpoint composes ONE list by joining the two stores **by normalized title**, life-model store as the source of truth for _meaning_, `public.goals` as the source of _quantitative progress_:

```
for each life-model goal G in goal_portfolio:
    match = public.goals row where normalize(title) == normalize(G.goal)   # case/whitespace-insensitive
    card = {
        title:        G.goal,                       # human name from the life model
        domain:       G.domain,                     # for grouping/icon only, NOT the card label
        provenance:   G.status,                     # confirmed | candidate | inferred  (see §4)
        confidence:   G.confidence,                 # 0..1 from the life model
        progress:     match?.progress_percent ?? derive(match) ?? null,   # Store A; null if no match
        status:       match?.status ?? "tracking",  # Store A lifecycle
        linked:       Boolean(match),               # whether a tracked goal backs it
    }
for each public.goals row with NO life-model match:
    card = manual goal (provenance = "user_tracked", no narrative grounding) — shown in a separate
           "Goals you're tracking" group so it is never mislabeled as advisor-discovered.
```

- Implement as a thin composition (a new web API route OR an addition to `MyLifeService.my_life`), reading the two EXISTING stores. No schema change, no new table.
- **Decision needed (blocker):** where the join lives. The life model is in the core-api (`my_life.py`), but `public.goals` is read directly from Supabase by the web app (`api/goals/route.ts`). Cleanest is a new web route `/api/life/goal-cards` that fetches `/api/life/my-life` (for `goal_portfolio`) + `public.goals` and joins. This keeps the core-api free of the `public.goals` CRUD store.

---

## 3. Goal card — fields and where each comes from

| Card field                      | Source (real)                                                                                             | Availability                                                                                              |
| ------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Title** (human name)          | `goal_portfolio[].goal` (`life_discovery.py:891`)                                                         | ✅ exists                                                                                                 |
| **Domain/icon** (grouping only) | `goal_portfolio[].domain`                                                                                 | ✅ exists                                                                                                 |
| **Status** (lifecycle)          | matched `public.goals.status` (`route.ts`); else `"tracking"`                                             | ✅ when linked; else label "Tracking via advisor"                                                         |
| **Progress**                    | matched `public.goals.progress_percent`, or `current_value/target_value` (`ExecutiveSummary.tsx:407-410`) | ⚠️ only when a `public.goals` row matches; else **"Not yet quantified"**                                  |
| **Dependencies**                | `snapshot.open_dependencies[]` (`life_discovery.py:924`) filtered to this goal's domain                   | ⚠️ dependencies are objective-scoped, not goal-scoped — best-effort by domain match; honest "—" otherwise |
| **Risks**                       | `snapshot.top_risks[]` (`life_discovery.py:921`) filtered by domain/keyword                               | ⚠️ risks are objective-scoped — best-effort; honest "—" otherwise                                         |
| **Confidence**                  | `goal_portfolio[].confidence` (`life_discovery.py:892`)                                                   | ✅ exists (0..1; render as %)                                                                             |
| **Projected Completion**        | **DOES NOT EXIST** — see §5                                                                               | ❌ not-yet-available                                                                                      |

---

## 4. Honest provenance (confirmed vs candidate vs inferred)

The life model already distinguishes these — surface them, never flatten:

- **`goal_portfolio[].status`** is `confirmed` / `candidate` / defaults to `"candidate"` (`life_discovery.py:892`).
- The objective layer additionally exposes `candidate_objectives` (unconfirmed, `life_discovery.py:912-915`, `confirmed:False`) vs confirmed `objectives` (`life_discovery.py:916-919`). The snapshot deliberately keeps candidates separate so they are "NEVER shown as the confirmed primary" (`life_discovery.py:912`).
- **Card badge rules:**
  - `confirmed` → solid badge "Confirmed with you."
  - `candidate` → outline badge "Possible goal — not confirmed yet" + a one-tap "Confirm with advisor" link (`/dashboard/advisor`).
  - `inferred` (e.g. persona-bridge / onboarding-derived) → "Inferred from onboarding" badge. Note the vision layer already marks `objective_inferred` and `persona_bridge` provenance (`my_life.py:122-123`, `life_discovery.py:901-904`); apply the same honesty to goal cards.
- Manual `public.goals`-only cards → "You added this" (no narrative grounding claimed).

This mirrors the existing `ProvenanceBadge` pattern already used in `ExecutiveSummary.tsx:15,218`. Reuse it.

---

## 5. Projected Completion — does NOT exist; derive honestly or mark unavailable

There is **no `projected_completion`, `target_date`, `due_date`, or per-goal progress** anywhere in the life model (verified: `grep projected|completion|target_date|due_date|deadline` over `life_discovery.py` returns only narrative-text mentions, not goal fields). `goal_portfolio` goals carry only `{goal, domain, confidence, status}`.

**Options, in order of honesty:**

1. **Preferred for pilot — mark not-yet-available.** Render "Projected completion: not yet estimated" with a subtle "Add a target date to track this" link. Zero fabrication.
2. **Honest derivation ONLY when real inputs exist.** For a linked `public.goals` row that has BOTH `target_value`/`current_value` AND a recent progress delta, a naive linear projection could be shown labeled "Estimated, based on your recent pace." But `public.goals` has no time-series of progress in the read path (`route.ts` selects current state only), so a _rate_ cannot be computed honestly today. **Do not ship a projection without a real rate** — it would be fabrication. Mark as a follow-up requiring a progress-history read.
3. **Never** invent a date from the narrative's vague time language ("over the next year or two", `dominant_narrative` summaries). That is flavor text, not a commitment.

**Decision:** ship Option 1 for the pilot. Flag Option 2 as a future enhancement gated on a real progress-history source.

---

## 6. Card layout (human-first)

- Group by nothing-architectural: render goals as a row/grid of cards titled by their human name. Domain is an icon + subtle tag, never the headline.
- Each card: Title · provenance badge · Status · Progress bar (or "Not yet quantified") · Confidence % · Dependencies (chips, or "—") · Risks (chips, or "—") · Projected completion ("not yet estimated").
- **Two groups, clearly separated:** "Goals from your life story" (life-model-grounded, Store B + joined Store A) and "Goals you're tracking" (manual Store-A-only). Never silently merge — the provenance difference is the whole point.
- Honest empty state: if `goal_portfolio` is empty AND `public.goals` is empty → reuse the existing "Set your first goal" CTA (`ExecutiveSummary.tsx:432-441`).

---

## 7. Prioritized plan

**P0 (correctness / credibility):**

1. Build the **reconciliation join** (`/api/life/goal-cards`) so a goal is never shown twice or invisibly (§2). This is the gating item — goal cards must not ship before it.
2. Surface **provenance** (confirmed/candidate/inferred/user-tracked) on every card (§4). No card may imply "Arcana set this" for a manual goal, or "confirmed" for a candidate.

**P1 (the visible upgrade):** 3. Render **human-named goal cards** with Title · Status · Progress · Confidence (§3, §6), replacing the domain-bar "Goal progress" card. 4. Best-effort **Dependencies / Risks** by domain join (`open_dependencies`, `top_risks`), with honest "—" when none map (§3).

**P2:** 5. "Projected completion" as honest "not yet estimated" + add-target-date affordance (§5 Option 1). 6. Follow-up: real pace-based projection once a progress-history source exists (§5 Option 2) — explicitly NOT in pilot scope.

---

## 8. Blockers / fields flagged as not-yet-available

- **Projected completion** — no source field exists; ship "not yet estimated" (§5). Do not fabricate.
- **Per-goal progress** — only exists for `public.goals` rows (Store A); life-model goals have none. Cards backed only by Store B show "Not yet quantified," not 0%.
- **Per-goal dependencies/risks** — the model scopes these to _objectives_, not individual portfolio goals (`snapshot` dependencies/risks are objective-filtered, `life_discovery.py:872-873`). Domain-match is best-effort; be honest with "—".
- **Where the join lives** — decision needed: new web route `/api/life/goal-cards` (recommended, keeps core-api free of the `public.goals` CRUD store) vs extending `MyLifeService` (would require core-api to read `public.goals`). See §2.
