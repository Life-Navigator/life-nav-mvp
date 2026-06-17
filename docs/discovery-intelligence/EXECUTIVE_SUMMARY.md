# Discovery Intelligence — Executive Summary

**Date:** 2026-06-16 · Evidence-only (no fixes). Source of truth: `main`. Detail in `DISCOVERY_INTELLIGENCE_AUDIT.md`, `GOAL_SELECTION_FORENSICS.md`, `DISCOVERY_PRIORITY_ANALYSIS.md`, `CHECKLIST_BEHAVIOR_REPORT.md`.

## The 8 questions

1. **Why did Arcana focus on financial independence?** Because a `financial_independence` objective is **seeded from the persona before the conversation** and then **selected as primary by a max-confidence rule** — independent of the user's narrative. Bridge default: `life_bridge.py:45` (`return "financial_independence"  # persona goals are predominantly financial`); primary selection: `life_discovery.py:488` (`max(objectives, key=confidence)`); surfaced at `relationship_manager.py:274-277`.

2. **Which component made that decision?** Two, in series: **`LifeBridge.sync()`** (`life_bridge.py:72-128`, esp. the root mapping `:24-45`) seeds the objective; **`LifeDiscoveryService.snapshot()`** (`life_discovery.py:488`) picks it as primary. `RelationshipManager.state()` triggers the bridge (`relationship_manager.py:194-199`) and surfaces the result. No LLM/prompt is involved (discovery mode runs no model).

3. **Is discovery following a checklist?** **Yes.** A fixed 7-step `FLOW` (`relationship_manager.py:41-64`) advanced by first-unanswered order (`:200`), with presence backstops that auto-complete steps from persona/bridge data (`_answered_keys:178-190`).

4. **Is ontology completion influencing conversation?** **Yes.** Goals are forced into 7 canonical `ROOT_OBJECTIVES` with fixed cross-domain dependencies (`life_discovery.py:32-86`), and motivation themes collapse toward finance (`THEME_OBJECTIVE:132-138`). Discovery optimizes more for ontology/field completion than for narrative (see DISCOVERY_PRIORITY_ANALYSIS Phase 6).

5. **Is persona seeding overweighted?** **Yes — decisively.** The persona bridge writes objectives **before** the user speaks, defaults them to `financial_independence` (`life_bridge.py:45`), and those seeded objectives win the max-confidence primary selection. A persona vision is also written (`life_bridge.py:116-123`) which auto-marks the `vision` step done.

6. **Is goal ranking wrong?** **It is mis-specified for discovery.** Ranking is **confidence-only** (`life_discovery.py:488`, `:546-549`) — there is no weighting for user-stated priority, recency, emotional salience, or deadline. The wedding's explicit 12-month deadline has zero ranking effect. And the one place the user could set priority — the "which matters most" step — is a **no-op** (`relationship_manager.py:221-251` has no `context` handler).

7. **What is the highest-confidence root cause?** **Persona-seeded objectives + a confidence-only primary-selection rule override the user's narrative, and the user's explicit priority answer is discarded.** Concretely: `life_bridge.py:45` (default → financial_independence) → `life_discovery.py:488` (primary = max confidence) → `relationship_manager.py:221-251` (priority answer not handled).

8. **Which files control discovery prioritization?**
   - `apps/lifenavigator-core-api/app/services/life_bridge.py` — persona→objective seeding + default to financial_independence (`:24-45`, `:72-128`).
   - `apps/lifenavigator-core-api/app/services/life_discovery.py` — objective inference (`reason()` `:225-285`), root taxonomy + theme mapping (`:32-138`), domain keyword routing (`:143-159`), **primary selection** (`snapshot:488`), plan ranking (`objectives_plan:546-549`).
   - `apps/lifenavigator-core-api/app/services/relationship_manager.py` — the FLOW checklist (`:41-64`), question selection (`state:192-211`), presence backstops (`_answered_keys:178-190`), the bridge call (`:194-199`), the discarded priority step (`answer:221-251`), and surfacing (`_context_panel:267-277`).
   - `apps/lifenavigator-core-api/app/services/discovery_coverage.py` — per-domain coverage tracking (secondary).

## One-line root cause

Discovery focus is set by **persona-seeded objectives chosen via max-confidence**, while the user's stated goals and explicit "which matters most" answer carry **no ranking weight** (the priority answer is literally a no-op) — so onboarding talks about the seeded `financial_independence` instead of the user's wedding/home/family narrative.

_(No fixes proposed, per scope.)_
