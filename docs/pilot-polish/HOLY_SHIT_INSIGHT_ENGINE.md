# Insight Of The Moment — Design

**Sprint:** Pilot Polish — make Arcana's intelligence VISIBLE.
**Scope:** Design only. No code, no commits. Deterministic rule over EXISTING computed fields.
No new model/agent/infra/DB. Grounded only — never fabricated; honest fallback.
**Distinct from:** `docs/experience-excellence/HOLY_SHIT_MOMENT_DESIGN.md` (the Life Brief reveal — "this
understands me" + "here's where I'd start"). This doc is the **complementary beat**: a single _surprising_
insight the user could not have articulated — the "how did it know that" moment — surfaced right after the
brief reveal.

---

## 1. The thesis

The Life Brief proves _comprehension_. The Insight Of The Moment proves _intelligence_: it surfaces ONE
non-obvious thing the user did not say but is true of their situation — a hidden conflict, a dependency they
hadn't connected, a future bottleneck, or an opportunity they're sitting on. We already **compute** all the
candidates; nothing new is needed. The work is a deterministic _selection rule_ — analogous to
`life_brief()` (`apps/lifenavigator-core-api/app/services/life_discovery.py:416`) — that picks the single
most surprising grounded insight and phrases it.

It must be **grounded and never fabricated.** When no candidate clears the bar, it returns an honest "still
forming" state (exactly like `life_brief` does at `:431-440`), and the UI simply doesn't show the card.

---

## 2. The candidate insights — all already computed (real file:line)

Every candidate is a field that already exists on the snapshot / plans. No engine is added; we read them.

| #   | Insight type                                     | Source field                                                                                                               | Real file:line                                                                                       | What makes it surprising                                                                                              |
| --- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| C1  | **Cross-objective conflict** (decision conflict) | `objectives_plan().conflicts[]` → `{between[2], type, reason, tradeoff, suggested_focus, suggested_sequence}`              | `life_discovery.objectives_plan` `:960-985`, `_CONFLICTS` map `:943-950`                             | Names two goals the user stated _separately_ that secretly compete for the same time/money — they didn't connect them |
| C2  | **Resource conflict among next steps**           | `reco_os.prioritize().conflicts[]` → `{type, resource, reason, competing[], tradeoff, suggested_sequence}`                 | `recommendations_os._conflicts` `:635-657`, surfaced `prioritize:533`                                | "Two of your top moves want the same dollars — do them in this order"                                                 |
| C3  | **Hidden dependency**                            | `snapshot.open_dependencies[]` → `{label, domain}` (unsatisfied only)                                                      | `life_discovery.snapshot` `:924` (filters `not satisfied`)                                           | A prerequisite the goal silently requires ("your family-stability goal needs life insurance you haven't set up")      |
| C4  | **Future bottleneck** (constraint × goal)        | `snapshot.active_constraints[]` → `{label, detail}` (e.g. "Retirement timeline appears inconsistent with current savings") | `_detect_constraints` `:586-598`, surfaced `:923`                                                    | An internal inconsistency between a stated goal and stated means — the thing a good advisor flags                     |
| C5  | **Opportunity acceleration**                     | `snapshot.top_opportunities[]` (grounded only — empty unless a real engine grounded it)                                    | `:922`; recs feed it via `reco_os` (e.g. employer match `recommendations_os.py:249`, GI Bill `:361`) | "You're leaving $X on the table you could capture now"                                                                |

Supporting context the rule can use to phrase/rank: `snapshot.dominant_narrative` (`:889,895`),
`goal_portfolio` (`:891-893,898`), `primary_objective.title` (`:908`), `reco_os.prioritize().why_ranking`
(`_why_first` `:505-522`, gives the formula factor that decided #1).

---

## 3. The deterministic selection rule

A pure function over the already-fetched snapshot + plans — **no model, no agent.** Surprise is ranked by
how much the insight connects things the user did NOT connect, gated on groundedness.

### 3.1 Priority order (most surprising → least)

```
1. C4 future bottleneck      — a stated-goal-vs-means CONTRADICTION (active_constraints) is the most
                               arresting; it's the user's own words turned into a flag.
2. C1 cross-objective conflict — two SEPARATELY-stated goals that compete (objectives_plan.conflicts);
                               requires ≥2 conflicting active objectives.
3. C2 resource conflict       — two TOP recommendations claiming the same finite resource
                               (reco_os.conflicts); requires ≥2 competing high/medium recs.
4. C3 hidden dependency       — an unsatisfied prerequisite of the primary objective
                               (open_dependencies); pick the one tied to the highest-ranked objective.
5. C5 opportunity acceleration — top_opportunities[0] WITH a quantified figure; only if grounded.
6. (none clear the bar)       — honest "still forming" → UI hides the card.
```

Rationale for the order: a **contradiction** (C4) and a **conflict the user didn't connect** (C1/C2) are
the highest-surprise, because the user supplied both halves without realizing they collide — the classic
"how did it know that." Dependencies (C3) and opportunities (C5) are valuable but more expected.

### 3.2 Groundedness gate (never fabricate)

- C4/C1/C2 only fire when their source list is **non-empty** (these lists are themselves only populated from
  the user's real statements / real recs — `_detect_constraints` reads the user's text `:586-598`; conflicts
  require ≥2 real objectives/recs).
- C5 fires only when `top_opportunities[0]` exists **and** carries a quantifiable figure (verify on live
  data — see §5); otherwise skip C5 rather than show a vague "there may be an opportunity."
- If nothing qualifies → `{ready: false}` with honest copy; **UI renders nothing** (no manufactured insight).

### 3.3 Output contract (mirror `life_brief`'s shape)

```jsonc
{
  "ready": true,
  "type": "cross_objective_conflict",      // C1..C5 key
  "headline": "Two of your goals are quietly competing.",
  "body": "Building family stability and reaching financial independence both draw on the same savings — "
          "pursuing them at full speed at once slows each. The real question is sequence, not sacrifice.",
  "tension": "money",                       // type/resource from the source
  "suggested_move": "Lead with family stability; stage financial independence behind it.",  // from suggested_focus/sequence
  "evidence": ["You named building family stability", "You named reaching financial independence"],
  "confidence_label": "High",
  "source": "Derived from your stated objectives — no new data invented"
}
```

Phrasing is **template-composed from the source fields** (like `life_brief` composes
situation→tension→stakes, `:447-484`), not generated by an LLM. Each insight type gets one template that
slots in `between[0]/between[1]/reason/suggested_focus` (C1), `competing[].title/resource/suggested_sequence`
(C2), `label/domain` + `primary_objective.title` (C3), `label/detail` (C4), `top_opportunities[0]` + figure
(C5).

---

## 4. Where it fires & how it's surfaced

- **Backend (build task, NOT implemented here):** add a pure composer
  `insight_of_the_moment(snapshot, *, objectives_plan=None, prioritization=None) -> dict` in
  `life_discovery.py`, directly analogous to `life_brief` (`:416`). It takes data the callers already fetch:
  `MyLifeService.my_life` already loads `snap` and `next_action` (`my_life.py:204`), and can additionally
  read `objectives_plan()` (`:960`) + `reco_os.prioritize()` (`:524`). Wire its output into the `my_life`
  return dict (`my_life.py:206-213`) as `"insight_of_the_moment": insight`. **No new endpoint** — it rides
  the existing `GET /v1/life/my-life` (`app/routers/life.py:127`) already proxied at
  `apps/web/src/app/api/life/my-life/route.ts`.
- **Frontend:** the post-onboarding reveal `apps/web/src/components/onboarding/DiscoveryReveal.tsx` already
  fetches `/api/life/my-life` and reveals `life_brief` (`:9,32-65`). Add a **third staged beat** after the
  brief and the next-move: _"And here's something you might not have connected →"_ then the insight
  `headline` + `body` via the existing `StreamingText` (`:29`). It carries into the dashboard's steady-state
  Life Brief card region (`apps/web/src/app/dashboard/page.tsx:71`) as a dismissible "Insight" card.
- **Honest fallback:** when `insight_of_the_moment.ready === false`, the reveal **omits the beat entirely**
  — no placeholder, no manufactured surprise (consistent with `DiscoveryReveal`'s forming-state handling
  `:9-16`).

---

## 5. Honest data caveats (verify on live data — do NOT fabricate)

- **C5 quantified opportunity may be unavailable.** `top_opportunities` is grounded-only and frequently
  empty for new users (no archetype auto-creation, `life_discovery.py:829-858`); even when present, a clean
  dollar figure isn't guaranteed. **Verify on live data;** if no figure, skip C5 — don't invent one.
- **C1 needs ≥2 conflicting active objectives** that exist in the `_CONFLICTS` map (`:943-950`); many
  single-goal pilot users won't trigger it. That's expected; the rule falls through.
- **C4 constraints are narrow today** — `_detect_constraints` only detects two patterns (early-retirement
  vs. no savings; expensive-home vs. broke, `:592-597`). High-surprise when it fires, but rare. Do not
  broaden it speculatively in this sprint; just consume what exists.
- **Most-surprising-for-everyone is not guaranteed.** For a meaningful share of pilot users only C3 (hidden
  dependency) will be available, because conflicts/constraints require richer input. C3 is still a real
  "didn't connect that" moment — acceptable. When even C3 is empty → honest fallback.

---

## 6. Prioritized plan

### P0 — the backend composer + reveal beat (the moment)

1. **Build `insight_of_the_moment(snapshot, objectives_plan, prioritization)`** in `life_discovery.py` —
   pure, deterministic, the §3 priority rule + §3.3 output contract. Honest `{ready:false}` fallback. _(Build
   task; spec complete here.)_
2. **Wire it into `my_life()`** (`my_life.py:206-213`) — fetch `objectives_plan()` + `reco_os.prioritize()`
   (both already available services) and add `"insight_of_the_moment"` to the response. No new endpoint.
3. **Add the third reveal beat** in `DiscoveryReveal.tsx` using existing `StreamingText`; omit when
   `ready:false`.

### P1 — reinforce the moment

4. **Dismissible "Insight" card** on the dashboard (near the Life Brief card, `dashboard/page.tsx:71`) so the
   moment persists into steady state, refreshed from the same `my_life` field.
5. **"Why this insight"** disclosure on the card from `evidence[]` + (for C1/C2) the
   `objectives_plan.conflicts.reason` / `reco_os.why_ranking` (`:505-522`) — proving it's derived, not
   asserted.

### P2 — coverage & tuning

6. **Audit which insight type fires** across the pilot personas; if C5's quantified figure is usually
   missing, log it as a _recommendation-data_ gap — not a reason to fabricate.
7. **(Out of sprint)** broadening `_detect_constraints` patterns would raise C4 hit-rate — note for later;
   do not do it now (new intelligence).

---

## 7. Blockers / verify before building

- **C5 figure availability** on live `top_opportunities` (§5) — decides whether the highest-value insight
  type is usable; verify, don't pad.
- **Confirm `objectives_plan()` + `reco_os.prioritize()` are cheap enough** to call inside `my_life()`
  (they're already called elsewhere per request) so the reveal stays fast.
- **The reveal already fetches `/api/life/my-life`** (`DiscoveryReveal.tsx:9`) — no new network call needed;
  confirm the added field rides that same response.
