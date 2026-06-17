# Discovery Intelligence Audit

**Date:** 2026-06-16 · Evidence-only (no fixes). Why Arcana selects the wrong conversational focus. Source of truth: `main`. Companion docs: `GOAL_SELECTION_FORENSICS.md`, `DISCOVERY_PRIORITY_ANALYSIS.md`, `CHECKLIST_BEHAVIOR_REPORT.md`, `EXECUTIVE_SUMMARY.md`.

## Headline

Discovery collects the user's goals correctly, but the **conversational focus and the "primary objective" are decided by persona-seeded data and a max-confidence rule — not by the user's narrative.** Three mechanisms, all on `main`:

1. **Persona bridge seeds a `financial_independence` objective before the conversation.** `RelationshipManager.state()` calls `_bridge.sync()` first (`relationship_manager.py:194-199`); `LifeBridge` maps money keywords → `financial_independence` and **defaults everything else to it too** (`life_bridge.py:26,45` — `return "financial_independence"  # persona goals are predominantly financial`).
2. **Primary objective = highest confidence**, not user priority (`life_discovery.py:488` `max(objectives, key=confidence)`). The seeded finance objective outranks the user's stated goals.
3. **The user's explicit "which matters most" answer is discarded** — the `priority` step (`kind="context"`) has no handler in `answer()` (`relationship_manager.py:221-251`).

The result: "Reach financial independence" (the label of the `financial_independence` ROOT_OBJECTIVE, `life_discovery.py:49`) becomes the focus, and the `time_horizon` question ("…the thing that matters most", `:55`) anchors on it — even when the user's narrative was wedding/home/family/promotion/masters/fitness.

## How the focus is chosen (one diagram)

```
persona_profile.primary_goals ──▶ RM.state() ──▶ _bridge.sync()           (relationship_manager.py:194)
                                                   │  maps goals → root objective
                                                   │  DEFAULT = financial_independence (life_bridge.py:45)
                                                   ▼
                                         life.life_objectives rows (high confidence)
                                                   ▼
            snapshot(): primary = max(objectives, key=confidence)          (life_discovery.py:488)
                                                   ▼
            _context_panel.primary_objective.title = "Reach financial independence"  (relationship_manager.py:274)
                                                   ▼
            FLOW next-question (fixed order) → time_horizon                 (relationship_manager.py:55,200)
            "What timeline … for the thing that matters most?"  ← anchors on the seeded objective
   (user's "which matters most" answer would go here — but it's a no-op: relationship_manager.py:221-251)
```

## Phase 7 — Conversation quality review (the example)

User said: wedding (12 mo), buy a home, start a family, pay off debt, promotion at NVIDIA, master's degree, fitness & confidence.

- **What information was available?** Seven explicit, vivid goals across five domains, plus an explicit near-term **deadline** (wedding in 12 months) and an employer signal (NVIDIA).
- **What information was ignored?** Effectively all of the narrative for focus-selection: the count (3 goals map to family vs 1 to finance), the deadline (no recency/urgency weighting exists — `objectives_plan:546-549` ranks by confidence only), and any "which matters most" answer (discarded, `:221-251`). "Buy a home" was routed to `family` (`_DOMAIN_KW:181`), so a homeownership objective likely wasn't even created.
- **What would the ideal next question have been?** Something that engages the user's own most-salient, time-bound goal — e.g., reflecting the wedding's 12-month deadline ("You've got a lot in motion this year — the wedding's only ~12 months out; want to start there, or is something else more pressing?"). That uses available evidence (deadline + stated priority) instead of the seeded objective.
- **What opportunity was missed?** The chance to mirror the user's narrative and earn trust on turn one. Instead the focus contradicted everything the user emphasized, anchoring on a persona-seeded finance objective the user never named.

## Method note / honest scope

This is a **static code trace** of the discovery selection path on `main`, not a live capture of the exact 7-goal example. Every cited mechanism is present as referenced. A live trace (one synthetic user with that input + a financial persona) would confirm the end-to-end behavior; not run here per the "no fixes / evidence-only" scope.
