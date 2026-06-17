# Discovery Priority Analysis (Phases 4 & 6)

**Date:** 2026-06-16 · Evidence-only. Paths under `apps/lifenavigator-core-api/app/services/`.

## Phase 4 — Why the next question was "What timeline are you targeting…"

That prompt is the **`time_horizon`** FLOW step (`relationship_manager.py:55`). It won because:

1. **Question selection is fixed-order, first-unanswered:** `state()` does `nxt = next((s for s in FLOW if s["key"] not in done), None)` (`relationship_manager.py:200`). FLOW order = vision → primary_goal → priority → financial_goal → **time_horizon** → risk → constraint (`:41-64`).
2. **Earlier steps were auto-marked "done"** by `_answered_keys` presence backstops (`:178-190`): the persona bridge writes a `life_vision` (`life_bridge.py:116-123`, `source=persona_bridge`) → `vision` done; persona goals create objectives so `primary_goal`/`financial_goal` get marked answered via `discovery_answered` and presence. With vision + goal steps satisfied from persona data, the **first remaining** step is `time_horizon`.
3. **Its prompt references the primary objective:** "…for **the thing that matters most**" — i.e., the max-confidence `primary_objective` = the persona-seeded `financial_independence` (see GOAL_SELECTION_FORENSICS Phase 1). So the question both _won by checklist order_ and _anchored on the seeded objective_.

Trace targets:

- question bank: `relationship_manager.py:41-64` (`FLOW`).
- relationship manager: `state()` `:192-211`, `_answered_keys` `:178-190`.
- discovery engine / ontology: `life_discovery.py` objectives + `snapshot` `:478-505`.
- prompt: the static `prompt` string on the FLOW step (`:55`) — no LLM.
- prioritization rules: fixed FLOW order + presence backstops (no salience/recency/deadline input).

## Phase 6 — What is discovery optimizing for?

| Option                            | Verdict                              | Evidence                                                                                                                                                                                                                                                                                    |
| --------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Understanding the person**   | **Weakly / intended-but-overridden** | FLOW comment `relationship_manager.py:38-40` _intends_ narrative capture ("we do NOT march through domains"); the `primary_goal` step is open-ended. BUT the user's priority answer is discarded (`:221-251` no `context` branch) and the primary is chosen by confidence, not by the user. |
| **B. Completing the ontology**    | **Strong**                           | Objectives map to `ROOT_OBJECTIVES` with fixed cross-domain `dependencies` (`life_discovery.py:32-86`); motivation themes are forced into 7 canonical roots (`THEME_OBJECTIVE` `:132-138`).                                                                                                 |
| **C. Filling missing fields**     | **Strong**                           | `_answered_keys` presence backstops (`:178-190`) treat discovery as "fill these slots from any source"; the bridge pre-fills them from persona (`life_bridge.py:72-128`).                                                                                                                   |
| **D. Domain coverage**            | **Moderate**                         | `_DOMAIN_KW` (`:143-159`) + per-objective dependencies frame "what's missing" by domain; `discovery_coverage` tracks per-domain %.                                                                                                                                                          |
| **E. Goal-dependency completion** | **Moderate**                         | Each `ROOT_OBJECTIVE` carries a dependency checklist (`:32-86`) that downstream surfaces drive toward.                                                                                                                                                                                      |
| **F. Benchmark behavior**         | **Not in discovery**                 | The benchmark six-section advisor format is gated to advisor mode and is **not** invoked in discovery (it returns the RM output verbatim — see the discovery-mode fix). No benchmark formatting in this path.                                                                               |

**Conclusion:** discovery is optimizing predominantly for **B/C (ontology + field completion) seeded from persona**, with the user-narrative path (A) present in design but **overridden** by (1) the persona-bridge seed, (2) max-confidence primary selection, and (3) the discarded "which matters most" answer. It is not optimizing for the user's stated, time-salient narrative.

## The ranking, concretely

- Objectives are ranked **only by `confidence`** in two places: `snapshot` primary (`life_discovery.py:488`) and `objectives_plan` (`:546-549`).
- There is **no** weighting for: user-stated priority, recency, emotional salience, or deadline (e.g., the wedding's 12-month horizon has zero ranking effect).
