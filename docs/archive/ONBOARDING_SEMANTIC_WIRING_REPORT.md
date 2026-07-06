# ONBOARDING_SEMANTIC_WIRING_REPORT.md — 2026-06-25 (commit 85615f2)

The LLM semantic interpreter was good, but the reveal panel / dependencies / next-question still used the
objective-ranking template (collapsing the plan into "Advance your career" + generic career deps). This pass
makes the semantic object the single source of truth through to the UI. NO change to LLM extraction; NO
legacy fragment splitting reintroduced.

## What changed

- **Interpreter** (\_interpret_plan): now also returns `main_priority` + plan-SPECIFIC `dependencies`, and is
  steered so a MEANS domain ("career is for the financial foundation") is a supporting lever, never the main
  goal; and next_question advances the MAIN priority in measurable terms (not a lever's step).
- **Reveal** ("What I learned"): `we_discovered` = the plan synthesis/north star (not the template label);
  `dependencies` = the plan's real levers; surfaces Main priority + Deprioritized.
- **Side panel**: `primary_objective` renders the persisted north star; adds Main priority + Deprioritized.
- **Response**: synthesis sentence + clean domain-labeled bullets — no "1) …; 2) …;".
- Persist `north_star` + `main_priority` each plan turn (panel/reveal stay correct across turns).
- Frontend (advisor/page.tsx): reveal label "What I learned:", Main priority + Deprioritized rows, panel
  north-star/main-priority/deprioritized rows.

## Live production verification (deployed 85615f2)

Two-turn conversation through the deployed RM + the live UI:

**Turn 1** — assistant (natural):
"It sounds like your north star is to build a wonderful foundation for your marriage and future family. We can
focus on strengthening your financial position as the main priority, with your career and health goals acting
as key supports…" + clean bullets (Family & home / Health & performance / Financial security / Career
momentum / Education — deprioritized). mechanical "1)…;" phrasing: **absent**.

- reveal.we_discovered = the synthesis above (NOT "Advance your career").
- reveal.dependencies = **Wedding budget, Home down-payment target, Monthly cash flow, Emergency fund,
  Promotion / income path, Health routine & recovery, Family-planning timeline** (zero career-template items).
- reveal.main_priority = finance · panel north_star set · main_priority = finance · deprioritized = [education].

**Turn 2** — "the strong financial foundation is the main one… career is for that purpose…":

- assistant: "…your central focus is on building a strong financial foundation. You're wisely positioning your
  career as the engine for this…" then asks what a strong financial foundation means.
- panel main_priority = finance (stays finance) · pivots_to_career_step = **False** · asks financial readiness = **True**.

**Live UI smoke** (browser, fresh user): "Advance your career" as the summary = **absent**; plan-specific deps
rendered; generic career deps **absent**; "Main priority" + "7 actions unlocked" rendered; North star in panel.

## Tests

- `test_two_turn_finance_primary_not_career_collapse` (finance stays primary, career is a lever, deps
  plan-specific, no career-step pivot, natural phrasing). Reveal test updated to the semantic contract.
  **708 tests pass.**

## Definition of done

Natural strategic response ✅ · panel summarizes the multi-domain plan ✅ · plan-specific dependencies ✅ ·
finance stays primary after clarification ✅ · career = lever, health = support, education deprioritized ✅ ·
regression test blocks the career collapse ✅ · production UI smoke confirmed ✅.
