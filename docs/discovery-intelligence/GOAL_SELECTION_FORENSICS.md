# Goal Selection Forensics (Phases 1–3)

**Date:** 2026-06-16 · Evidence-only. Files on `main` (production source of truth). Paths under `apps/lifenavigator-core-api/app/services/`.

## Phase 1 — The exact path that selected "Reach financial independence"

"Reach financial independence" is the `label` of the `financial_independence` ROOT_OBJECTIVE (`life_discovery.py:49-56`). It became the conversational focus via this chain:

| #   | Step                                                     | File · line                                                                    | What happens                                                                                                                                                                                                                                   |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Persona seed**                                         | (data) `public.user_persona_profile.primary_goals`                             | Persona/sandbox activation populates the user's `primary_goals` (sandbox personas are financial). `activate-persona/route.ts` itself only sets `setup_completed` — the goals live in `user_persona_profile`.                                   |
| 2   | **Bridge runs before every turn**                        | `relationship_manager.py:194-199` (`state()` → `await self._bridge.sync(ctx)`) | The RM folds persona/setup-wizard data into the canonical model **before** computing discovery state.                                                                                                                                          |
| 3   | **Bridge projects persona goals → objectives**           | `life_bridge.py:72-96` (`sync()`)                                              | For each `persona.primary_goals` phrase, calls `LifeDiscoveryService.discover_goal(...)` → writes a `life_objectives` row.                                                                                                                     |
| 4   | **Bridge defaults everything to financial_independence** | `life_bridge.py:24-45`                                                         | Money keywords → `financial_independence` (`:26`); and the catch-all **`return "financial_independence"  # persona goals are predominantly financial`** (`:45`). So persona goals become a high-confidence `financial_independence` objective. |
| 5   | **Primary = highest confidence**                         | `life_discovery.py:488`                                                        | `primary = max(objectives, key=lambda o: float(o.get("confidence") or 0))`. The persona-seeded `financial_independence` wins by confidence — **not** by the user's narrative or count of goals.                                                |
| 6   | **Surfaced to the conversation**                         | `relationship_manager.py:274-277` (`_context_panel`)                           | Exposes `primary_objective.title` = "Reach financial independence".                                                                                                                                                                            |
| 7   | **Question anchored on it**                              | `relationship_manager.py:55` (`time_horizon` step)                             | Prompt: "What timeline are you targeting for **the thing that matters most**?" — "the thing that matters most" = the primary_objective.                                                                                                        |

**Source classification of the selection:**

- source node: a `life.life_objectives` row (root `financial_independence`).
- source goal: the persona's `primary_goals` (not a conversational goal).
- source persona: `public.user_persona_profile` (financial sandbox persona).
- source candidate goal: n/a — it was promoted from the persona bridge, not from conversational candidate goals.
- source ranking algorithm: `snapshot()` max-by-confidence (`life_discovery.py:488`).
- source prompt: none — selection is **code/data**, not an LLM prompt (discovery mode runs no LLM).

## Phase 2 — Reconstructed user input (the example) + classification

Stated goals: wedding (12 mo), buy a home, start a family, pay off debt, promotion at NVIDIA, master's degree, fitness & confidence.

How the code would classify each via `_goal_domain` (`life_discovery.py:143-159`, first-match priority order **education → health → finance → family → career**) → root objective:

| User goal                        | Domain matched (kw)            | Likely root objective                | Class                                            | Notes                                                                                      |
| -------------------------------- | ------------------------------ | ------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Wedding (12 mo)                  | family (`wedding`)             | family_stability                     | Confirmed (if stated in the `primary_goal` step) | strongest near-term deadline; no time-priority weighting exists                            |
| Buy a home                       | **family** (`home` kw, `:181`) | family_stability (NOT homeownership) | Confirmed                                        | comment `:143` "ambiguous 'house' → family" — homeownership objective likely never created |
| Start a family                   | family (`family`)              | family_stability                     | Confirmed                                        |                                                                                            |
| Pay off debt                     | finance (`debt`,`pay off`)     | financial_independence               | Confirmed                                        | reinforces the persona-seeded objective                                                    |
| Promotion at NVIDIA              | career (`promotion`)           | career_growth                        | Confirmed                                        |                                                                                            |
| Master's degree                  | education (`master`)           | education_advancement                | Confirmed                                        |                                                                                            |
| Fitness & confidence             | health (`fitness`)             | health_longevity                     | Confirmed                                        |                                                                                            |
| **Reach financial independence** | —                              | financial_independence               | **Persona/System goal** (not user-stated)        | seeded by the bridge (Phase 1)                                                             |

Confidence/priority/rank: every objective is ranked **only by `confidence`** (`life_discovery.py:488`, `objectives_plan:546-549`). There is **no narrative-priority, recency, or deadline weighting**. The persona-seeded `financial_independence` carries a high seeded confidence; the user's stated goals get per-goal confidence from `reason()` (`life_discovery.py:225-285`, base ~0.55–0.92).

## Phase 3 — Why wedding/home/family/promotion/masters/fitness did NOT win

1. **They are scored only by confidence, and the persona-seeded `financial_independence` already exists at high confidence before the user speaks** (Phase 1, steps 2–5). `snapshot` picks `max(confidence)` (`life_discovery.py:488`) — count of goals and emotional/temporal salience are ignored.
2. **The user's "which matters most" answer is discarded.** The `priority` FLOW step (`relationship_manager.py:47-50`, `kind="context"`) has **no branch** in `answer()` (`relationship_manager.py:221-251` handles only vision/goal/risk/time_horizon/constraint). The priority answer is marked answered (`:253 _mark_answered`) but **never written and never re-ranks** the primary objective.
3. **"Buy a home" is routed to `family`, not homeownership/finance** (`_DOMAIN_KW` `:181`), so a distinct homeownership objective is likely never created.
4. **Motivation themes collapse toward finance.** `THEME_OBJECTIVE` (`life_discovery.py:132-138`) maps `freedom`, `wealth_creation`, `achievement`, `adventure` → `financial_independence`, concentrating weight there even when the user's words are about family/career.
5. **No time/deadline weighting.** The wedding's explicit 12-month deadline has no effect on ranking — there is no urgency signal in the selection (`objectives_plan:546-549` ranks by confidence only).

**Net:** the winner is decided by _persona-seed confidence + max-confidence selection_, with the user's explicit priority dropped — so the user's narrative goals cannot overtake the seeded `financial_independence`.

> Method note: this is a **code trace** of how the pipeline selects the focus given a financial persona seed; it was not re-run as a live capture of the exact 7-goal example. The mechanisms (bridge default, max-confidence, discarded priority) are present in `main` as cited.
