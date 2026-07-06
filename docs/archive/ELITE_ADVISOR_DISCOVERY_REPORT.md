# ELITE ADVISOR — DISCOVERY ENGINE (Rules 1/2/7 shipped) — 2026-06-10

Core API live on Fly (`lifenavigator-core-api` v68); frontend reveal label on main `f69fb58`.
Discovery is **rule-based** (theme matching + objective map) — NOT an LLM — so the conversation style
is changed deterministically. No GraphRAG/recommendation/decision/scenario/finance changes.

## What changed

- `app/services/relationship_manager.py` `converse()`:
  - **Rule 1 (hypothesize, never declare):** reflection changed from
    `"Got it. The real objective behind that looks like **X** — I've mapped what it depends on."`
    → `"What I'm hearing is that **X** may be part of what's driving this — did I understand that
right, or is something else behind it?"` (risk likewise softened to "It sounds like you'd … — tell
    me if that's not quite right.").
  - **Rule 7 (explain why):** each question now appends a brief `_Why I ask: {why}_` line.
- `apps/web/.../advisor/page.tsx`: reveal label `"The real objective:"` → `"What I'm hearing (does this sound right?):"`.
- 41 Core API tests pass; deployed via `flyctl deploy` (authenticated session).

## Live validation — 3 discovery sessions vs the DEPLOYED Core API (full transcripts captured)

Driven with the success-criterion multi-goal opener ("build my net worth, improve my fitness, buy a
bigger house, increase my income"). Per persona: **0 declarations** of "the real objective is/behind",
**5 hypotheses** ("What I'm hearing … did I understand that right?"), **why-line on every question**.

Representative turns (young_professional):

```
[ADVISOR] …what would you most like your life to look like over the next few years?
          _Why I ask: Your vision anchors every recommendation we make._
[USER]    I want to build my net worth, improve my fitness, buy a bigger house, and increase my income
[ADVISOR] Thanks — got it. What's the one thing you'd most like to make progress on right now…?
          _Why I ask: We find what's really behind the goal, then map what it depends on._
[USER]    Live freely and not depend on anyone
[ADVISOR] What I'm hearing is that **Reach financial independence** may be part of what's driving this —
          did I understand that right, or is something else behind it? …
```

**Success criterion MET:** the multi-goal answer does NOT produce "The real objective is Build Family
Stability." It is offered as a hypothesis to confirm.

(Counts: young_professional / married_family / high_income_executive each → declarations=0, hypotheses=5,
why-lines=9 on the re-validated run.)

## Rules — status

| Rule                                    | Status                                                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 Hypothesize, never declare            | ✅ shipped + live-validated                                                                                                                      |
| 2 Reflect before asking                 | ⚠️ partial — reflection+confirmation precedes the next question, but in the SAME turn (a separate confirm turn is a state-machine change, below) |
| 7 Explain why questions are asked       | ✅ shipped (why-line per question)                                                                                                               |
| 10 Life-model review                    | ✅ frontend richer review already shipped (prior sprint)                                                                                         |
| 3 Multiple goals / candidate_goals[]    | ❌ structural (data model) — see below                                                                                                           |
| 4 Goal-prioritization phase             | ❌ structural (state machine + UI)                                                                                                               |
| 5 Confidence-threshold completion       | ❌ structural (currently question-count: `complete = all FLOW answered`)                                                                         |
| 8 Per-domain progress (vs 6/9)          | ⚠️ partial — per-domain coverage exists at `/v1/life/discovery/coverage`; the chat `progress` is still answered/total                            |
| 6 Action cards only after understanding | ✅ frontend phase-gate (≥3 answers) shipped prior sprint                                                                                         |
| 9 Final open question                   | ✅ frontend-orchestrated prior sprint                                                                                                            |

## Remaining (structural — the deeper "rebuild", next backend pass on the discovery service)

These need data-model + state-machine changes in `relationship_manager.py` + `life_discovery.py`
(`analyze()` returns one `primary_objective`; `discover_goal()` persists one objective; `state()`
completes on question count):

- **Rule 3:** have `analyze()` return `candidate_objectives[]` (the `alternatives` are already computed
  but collapsed to one) and persist candidates.
- **Rule 4:** add a goal-ranking turn after discovery ("I've heard several things… which matters most?").
- **Rule 5:** complete on `overall_confidence >= threshold` (+ continue weak domains) instead of
  `all FLOW answered`; surface per-domain confidence in the chat `progress`.
- **Rule 2 (full):** make reflection→confirmation its own turn before advancing.
- Minor: soften the primary_goal `why` text ("the real objective behind the goal" reads as a process
  description; harmless but could be reworded).

## Definition of Done — status

Headline criterion met: the advisor **hypothesizes and asks for confirmation** instead of declaring a
conclusion, and explains why it asks — live-validated with real transcripts across 3 personas. The
multi-goal candidate ranking + confidence-based completion (the deeper engine rebuild) are scoped above
as the next discovery-service pass.
