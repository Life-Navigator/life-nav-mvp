# ELITE ADVISOR TRUST & INTELLIGENCE — STATUS — 2026-06-11

A 14-rule, 4-phase sprint. This turn shipped the bounded **Phase-1 Rule 1 (persona transparency)** —
validated live — and honestly maps the rest, because the headline (Phase 2 advisor engine) is the deep
`relationship_manager.py` rewrite that needs a dedicated pass, not the tail of this session.

## Shipped this turn — Rule 1 (persona transparency on /auth/session) ✅

- New `GET /api/onboarding/active-persona` — returns the user's active beta persona from the latest
  `plaid_persona` activation event (`analytics_user_events`) + the personas lib: `display_name`,
  `profession`, `data_source: "Plaid Sandbox Persona"`, `selected_at`.
- `/auth/session` now shows: **Account email · Name · Onboarding status · Current persona · Data source
  (Plaid Sandbox Persona) · Selected date** + _"The financial data shown during beta is this sandbox
  persona — not your real financial data."_ Buttons: **Continue · Choose different persona** (warns
  "Changing personas replaces the current sandbox financial data" → re-picker; logs `PERSONA_CHANGED`) ·
  **Switch account · Sign out**. Logs `PERSONA_RESUMED`.
- **Validated live (prod `920fec5`):** activate persona → endpoint returns "Married Family" → interstitial
  shows Current persona + Plaid Sandbox + not-real-data note + Choose-different-persona, 0 errors.

## Phase 1 remainder (bounded, follow-ups)

- **Rule 2 (universal identity banner on every authed page)** — NOT done. Needs a small `<IdentityBanner>`
  (name/email/persona/"Beta Sandbox") in the dashboard shell, shown on dashboard/advisor/finance/career/
  health/education/family/life-graph/reports. Bounded.
- **Rule 3 (Settings → Persona Management → Change Persona)** — PARTIAL: the "Choose different persona"
  button on `/auth/session` does it with the replace-data warning; a Settings entry point is not added.
- **Rule 4 (AUTH_QA_MATRIX.md: fresh/login/resume/incognito/multi-tab/restart/reset/expired/switch/change)** —
  NOT done as an exhaustive evidence doc (core cases validated across the last two sprints).

## Phase 2 — Advisor Intelligence (Rules 5–11) — THE HEADLINE, NOT DONE

This is the deep discovery-engine rewrite (`relationship_manager.py` + `life_discovery.py`) scoped across the
V2/V3/polish sprints, with **transcript evidence** of the current gaps (see `ONBOARDING_POLISH_REPORT.md`):

- **R5 Goal preservation / R6 goal memory:** candidate_goals are extracted per-turn (v69) but **collapse to
  labels** and don't persist/accumulate across turns. Need a persisted `candidate_goals` set (verbatim user
  language) that accumulates / merges / never disappears.
- **R7 Topic coherence:** the fixed 9-step `FLOW` marches through domains — transcript proves it jumps to
  "career" mid-family. Fix = a **goal-driven next-question selector** that stays on-topic until confidence>85%.
- **R8 Clarify-before-classify:** reflection ("What I'm hearing…") is live (v68); the multi-goal confirm
  ("I'm hearing three priorities — did I capture that?") needs to gate classification.
- **R9 Goal ranking (drag-reorder + confirm):** not built.
- **R10 Contradiction engine:** not built.
- **R11 Confidence-based completion:** completion is still question-count; needs per-domain confidence thresholds.

## Phase 3 (Rules 12–14) — partially live

Life-model confirmation screen + the open-ended final question + premium handoff (top-3 priorities/risks/opps)
exist (prior sprints). The full executive-summary + edit-what-I-misunderstood flow is partial.

## Phase 4 — 10-persona transcript validation — NOT done (deep-engine dependent)

## Definition of Done — status

Trust transparency advanced (Rule 1 done + validated; the user now always sees account + persona + data
source + that it's sandbox data). The DoD's core — **"This advisor understands me," not "categorized me"** —
depends on Phase 2 (the goal preservation/memory/topic-coherence/ranking/contradiction/confidence engine),
which is the next dedicated backend sprint, scoped above with exact files + the transcript proving the gap.
