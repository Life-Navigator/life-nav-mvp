# User Truth Model

The contract for how LifeNavigator distinguishes **what it knows** from **what it guesses**. Every
fact, goal, risk, opportunity, objective, recommendation, preference, and life-model element carries
provenance so the platform never confuses an assumption with a fact.

## 1. Provenance fields

Every truth-bearing record should expose:

| Field             | Meaning                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| `source`          | The concrete origin (e.g. "Advisor Discovery", "401(k) statement", "Plaid", "Recommendation OS"). |
| `confidence`      | 0–1. How sure we are. Omitted → unknown, never assume 1.0.                                        |
| `created_at`      | When first recorded.                                                                              |
| `updated_at`      | When last changed/confirmed.                                                                      |
| `provenance_type` | One of the eight types below.                                                                     |

## 2. Provenance types (the source hierarchy)

Ordered most-trusted → least-trusted. Higher rank may overwrite lower; lower must NEVER silently
overwrite higher.

1. **`user_confirmed`** — the user explicitly confirmed it ("Yes, that's right"). Highest trust.
2. **`user_stated`** — the user said it in their own words (advisor chat, a form they filled). Trusted.
3. **`document_extracted`** — pulled from a document the user uploaded (offer letter, 401(k) statement). Trust = extraction confidence.
4. **`connected_account`** — synced from a linked account (Plaid). Trusted for the value, scoped to the connection.
5. **`system_calculated`** — deterministically computed from grounded inputs (net worth from accounts, readiness score). Trust = inputs' trust.
6. **`recommendation_generated`** — produced by Recommendation OS with evidence + assumptions. A _suggestion_, not a fact.
7. **`advisor_inferred`** — the LLM/rules inferred it from context (an inferred primary objective). A _hypothesis_ — must be labeled inferred, never shown as confirmed.
8. **`assumption`** — a default applied because data is missing (assumed retirement age). The weakest; must be visibly labeled "assumed".

## 3. Persistence rules

- **Nothing truth-bearing is persisted without a provenance_type.** If a writer can't name one, it's a bug.
- **Objectives do NOT auto-create risks/opportunities.** Risks/opportunities exist only when one of:
  (A) user_stated/user_confirmed, (B) system_calculated with sufficient inputs, (C) recommendation_generated
  with evidence, (D) a validated risk engine with source+confidence+evidence+rationale. Otherwise the risk
  is not created. (Enforced: `life_discovery.discover_goal` no longer decomposes archetype risks/opps.)
- **Assumptions are persisted as `assumption`, never as fact.** They may inform calculations but are flagged.
- **Recommendations never auto-become goals.** A goal is created only by an explicit user action
  (`POST /api/goals` with a title) or the user's own discovered surface-goal. (Verified: no rec→goal path.)
- **Rejected goals are permanent.** A rejected goal/interpretation is stored in `life.rejected_goals` and
  suppressed forever — never re-surfaced by discovery, the advisor, or recommendations. (Enforced:
  `relationship_manager._rejected_norms` + `advisor_validator`.)
- **Inferred ≠ confirmed.** An `advisor_inferred` objective/vision is stored with its low confidence and is
  only promoted to a confirmed north star when the user authors/confirms it (vision_authored +
  confidence ≥ 60% + discovery ≥ 40%).

## 4. Display rules

- **Show the provenance on every truth item.** A user can see: where it came from (`source`), who/what
  created it (`provenance_type`), when it was last updated (`updated_at`), and whether it is
  **confirmed / inferred / calculated / assumed** (derived from `provenance_type`).
- **Never render an inferred or assumed item as a plain fact.** Inferred → "(inferred)" / "still forming";
  assumed → "(assumed)"; recommendation → framed as a suggestion, not a done deal.
- **Confidence is visible** when < high (a calculated/inferred value shows its %; a confirmed value may omit it).
- **Empty is honest.** No grounded item → say so ("No grounded risks identified yet"), never fill with a template.
- Status → label mapping:
  - user_confirmed → **Confirmed** (green)
  - user_stated / document_extracted / connected_account → **On record** (neutral, source shown)
  - system_calculated → **Calculated** (neutral, inputs/% shown)
  - recommendation_generated → **Suggested** (amber, evidence available)
  - advisor_inferred → **Inferred** (amber)
  - assumption → **Assumed** (amber, the weakest)

## 5. Update rules

- **`updated_at` moves on every change or re-confirmation.**
- **A higher-trust source upgrades a lower one** (a user-confirmed value replaces an assumption; a
  document_extracted value replaces an advisor_inferred guess) — and the provenance_type upgrades with it.
- **A lower-trust source never silently overwrites a higher one.** It may propose (as a candidate), but the
  higher-trust value stands until the user confirms the change.
- **Confirming an inferred item upgrades it** advisor_inferred → user_confirmed (and bumps confidence).
- **Rejection is terminal** — see persistence rules.

## 6. Current coverage (see PROVENANCE_AUDIT.md for the full table)

- Rich provenance: `recommendations.recommendations` (source_module + confidence + evidence + assumptions),
  `documents.*` (source_name + confidence), `career.career_profiles` / `family.insurance_profiles`
  (source + confidence), `life.life_objectives` (confidence + reasoning), `life.life_vision`
  (prompts.source → authored vs persona_bridge), `life.candidate_goals` (confidence + supporting_quote).
- The Life Graph edges carry `provenance` (persisted_edge / computed_connection / shared_node) + citation.
- Gaps (follow-on): no single `provenance_type` column yet (it is derived in the API layer today);
  `life.goals`/`life.risks`/`life.opportunities`/`life.dependencies` lack source/confidence columns; not
  every dashboard surface renders a provenance badge yet.

## 7. Definition of done (target)

A user can inspect any item and see where it came from, who created it, when it was last updated, and
whether it is confirmed, inferred, calculated, or assumed — and the platform never confuses an assumption
with a fact. The `/api/life/my-life` feed now returns a `provenance` block per life-model element, and the
reusable `<ProvenanceBadge>` surfaces it; extending the badge to every domain card + adding the
`provenance_type` column to the remaining `life.*` tables is the tracked follow-on.
