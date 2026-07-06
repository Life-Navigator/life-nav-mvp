# Promotion-Readiness: Surface, Don't Build

**Grounded finding.** Promotion-readiness logic _already exists_ and fires today — it is the `promotion_readiness` recommendation family in `apps/lifenavigator-core-api/app/domains/career.py:304-317`. It triggers when the user has an `advancement` career goal **and** `years_of_experience >= 3`, and it carries cited evidence (`years_experience` from `career.career_profiles`, `goal_type` from `career.career_goals`) plus a flagged assumption that performance supports the case (confidence 0.5). It is returned by `/v1/career/recommendations` and persisted by `/v1/career/recommendations/generate`. **The gap is not logic — it is presentation.** Today this intelligence is collapsed into a single unlabeled bullet (`page.tsx:243-247`) indistinguishable from "upload your resume." There is NO standalone promotion engine, NO promotion table, and we will build neither. We compose a Promotion Readiness _view_ from signals that already exist across three systems.

---

## Signals that already exist (no new data)

| Signal                            | Weight intent                       | Real source                                                                                           | Currently used by                              |
| --------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **Tenure**                        | "long enough to be considered"      | `public.career_profiles.years_of_experience`                                                          | `career.py:305` gate (≥3y)                     |
| **Advancement intent**            | "you actually want this"            | `career.career_goals.goal_type == 'advancement'`, `target_role`, `target_date`                        | `career.py:306` gate                           |
| **Comp gap to target**            | "there's headroom above you"        | `CompensationIntelligenceEngine.scenario().median_lift` (OEWS, cited)                                 | `role_transition`/`certification_roi` families |
| **Below-market pay**              | "you're underpaid at current level" | `compensation_growth` family, `career.py:288`                                                         | comp recommendation                            |
| **Skill readiness**               | "you can do the next role"          | `career.skill_gaps` (fewer/lower-severity = more ready)                                               | `skill_gap_closure` family                     |
| **Experience depth + leadership** | "track record"                      | `scoreCareer` components `experience`, `current_role`, `volunteer` (leadership regex, `career.ts:61`) | readiness snapshot                             |
| **Credentials**                   | "qualified on paper"                | `scoreCareer` `credentials` component (certs + licenses)                                              | readiness snapshot                             |
| **Goal alignment**                | "dated, specific plan"              | `scoreCareer` `goals` component (target role + date)                                                  | readiness snapshot                             |

Every one of these is already computed and already carries a `source` + `confidence`. A promotion-readiness view is a **read-only composition** of them.

---

## The lightest possible surfacing (no new engine/model)

### Option A — Recommendation-driven (zero backend change, ship first)

The `promotion_readiness` recommendation already returns title, description, evidence chips, assumptions, tradeoffs, and the `career_guidance` boundary. The frontend simply:

1. Pulls the rec where `recommendation_type === 'promotion_readiness'` from `/api/career/recommendations`.
2. Renders it as a **labeled Promotion Readiness panel** with its evidence as chips ("3 yrs tenure", "advancement goal") and its assumption surfaced honestly ("Assumes performance supports the case — confirm with your manager").
3. **Empty state** (rec not fired): explain _why_ — "Set an advancement goal and we'll assess your readiness" → `/dashboard/career/goals`. Or "You need ~3 years of tenure on record" if the goal exists but tenure is short.

This is shippable with **no Python change at all**.

### Option B — Readiness-component reuse (still no new model)

For a richer "X of N signals" gauge, the frontend composes a **promotion readiness checklist** from data already in existing payloads — counting present signals, not inventing a score:

| Checklist item             | Present when                                           | Payload field (already available) |
| -------------------------- | ------------------------------------------------------ | --------------------------------- |
| Tenure ≥ 3 yrs             | `current_state.years_experience >= 3`                  | `/api/career/summary`             |
| Advancement goal set       | a goal with `goal_type=advancement` + `target_role`    | `/api/career/goals`               |
| Headroom above current pay | `scenario.median_lift > 0`                             | `/api/career/compensation`        |
| Skills aligned             | `skill_gaps.length === 0` or all low-severity          | `/api/career/summary`             |
| Credentials on record      | `scoreCareer.components.credentials.score > 0`         | `/api/career/readiness`           |
| Leadership signal          | `scoreCareer.components.volunteer` mentions leadership | `/api/career/readiness`           |

Render as "**4 of 6 promotion signals present**" with each item showing its evidence and its source. This is **counting existing booleans**, fully consistent with the platform's deterministic, no-fabrication rule (`scoreCareer` uses exactly this present/absent counting style, `career.ts:226-235`). It is a _view_, not a scorer — same posture as `life.readiness_snapshots` being "a record of a computed result, not a second scorer" (migration 163 header).

**Recommendation: ship Option A now, layer Option B as the gauge.** Neither adds a table, model, or AI call.

---

## Honest states

- **Empty** — No advancement goal: "We assess promotion readiness once you tell us you're aiming for a step up." CTA → `/dashboard/career/goals`. Never show a fabricated readiness percentage.
- **In-Progress** — Goal set, signals partial: "Building toward it — 2 of 6 signals present. Add comp + tenure to sharpen this." Show which signals are missing and the link to add each.
- **Complete** — Rec fired: render "You're in range for a promotion push" with cited tenure + goal evidence and the honest performance assumption. Link to the role-transition scenario for the comp upside.

---

## Trust guardrails (already enforced — preserve them)

- Every signal cites a real table; no signal is invented (`career.py` evidence rows carry `source_table` + `confidence`).
- The performance assumption stays visible (confidence 0.5, `user_confirmed: false`) — promotion is never asserted as a guarantee.
- The `career_guidance` boundary (`career.py:58`) renders on the panel: "Career coaching grounded in cited market data — not a guarantee of promotion."

## What we explicitly do NOT do

- No promotion-probability ML model.
- No new `promotion_readiness` table or migration.
- No performance/manager-sentiment data we don't have — the case is framed as "evidence you can take to your manager," not a verdict.
