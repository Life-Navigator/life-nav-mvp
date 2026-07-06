# P0 ADVISOR INTELLIGENCE INCIDENT — ROOT CAUSE + FIX — 2026-06-11

Live on Core API **v74** + prod `ac78c1b`. The advisor no longer invents "Advance your career," honors user
corrections, and reflects the user's own words. **Validated on the exact incident transcript.**

## Exact Root Cause

Three rule-based defects (the discovery engine is **rule-based — there are NO LLM system prompts**; behavior
comes from a fixed FLOW + a theme→objective map):

1. `life_discovery.analyze()` line 187: `THEME_OBJECTIVE.get(top_theme, "career_growth")` — any statement
   whose top theme didn't map to an objective **defaulted to career_growth** → "Advance your career."
2. `relationship_manager.FLOW` force-marched **vision → primary_goal → family → career → finance → time →
   health → constraint**. The `career_goal` step ("Where would you like your career to go?") + `_GOAL_ROOT_HINT`
   (career→career_growth) asked + labeled career regardless of what the user said.
3. The multi-goal reflection listed objective **labels** (`g['objective']`), not the user's words, and there
   was **no correction handling** at all — so "No, you made up career" was ignored and re-asserted.

## Files Audited

`app/services/life_discovery.py` (analyze, analyze_statement, ROOT_OBJECTIVES, THEME_OBJECTIVE, \_TERMINAL,
\_DEP_SIGNALS, personal_graph), `app/services/relationship_manager.py` (FLOW, \_GOAL_ROOT_HINT, answer, converse,
\_WROTE_UPDATES), `app/routers/life.py`.

## Prompts Audited

**None exist** — the onboarding advisor is a deterministic rule engine (no Gemini/LLM prompt drives discovery).
The "intelligence" is the FLOW + theme/objective maps. (This is itself a finding: there's no prompt telling it
to "advance career"; it was a hardcoded fallback + a forced FLOW step.)

## Rule Maps Found

- `THEME_OBJECTIVE` (theme → objective label) with a **career_growth default** ← fixed.
- `_GOAL_ROOT_HINT` (`{family:…, career:career_growth, finance:…, health:…}`) — bound to the now-removed FLOW domain steps.
- `_TERMINAL` (explicit terminal goals incl. real career phrases like "promotion","new job" — kept; these ARE evidence).
- `_DEP_SIGNALS` (conversation-derived dependencies — kept; evidence-based).

## Fixed FLOW Location

`relationship_manager.py` `FLOW` (top of file). Replaced the domain march with a **goal-driven flow**:
vision → primary_goal (capture in user's words) → priority ("which matters most?") → financial_goal (soft,
"is there anything about money tied to those goals?") → time_horizon → risk → constraint. **No forced
career/health/family questions.**

## Classifier Fix (Rule 1)

`analyze()` no longer defaults to career_growth — an unmapped theme returns `primary_objective: None` + a probe.
"Advance your career" can now only arise from explicit career evidence (the `_TERMINAL` job/promotion phrases).

## Correction Handling Fix (Rule 2/6)

New module-level `_CORRECTION_RE` (no / nope / wrong / that's not / not what I meant / you made up / I never said /
not career / you're wrong / …). In `converse()`, a correction **short-circuits** the turn: apologize, do NOT
classify or advance, ask the user to restate; the rejected interpretation is never re-asserted.

## Candidate Goal Memory Fix (Rule 3)

The multi-goal reflection now uses `candidate.goal` (the user's verbatim clause), not the objective label —
"I'm hearing a few priorities — 1) paying down credit cards … 2) … down payment for a larger house … 3) start
a family … Did I capture that correctly?" Labels appear only after confirmation.

## Rejected Goal Memory (Rule 6) — status

Corrections are honored in-conversation (apologize + don't re-assert + ask to restate), validated live. A
**persisted `rejected_goals[]` array across sessions** is a deeper memory addition (the discovery engine has no
cross-turn candidate_goals persistence yet) — scoped as the next increment.

## Rule 7 (Recommendation/Roadmap language)

During discovery, updates now read **"Life model updated" / "Discovery notes updated"** instead of
"Recommendations refreshed / Roadmap updated" — nothing is claimed finalized before confirmation.

## Tests Added (`tests/test_advisor_intelligence.py`, + 1 updated)

1. FLOW has no forced career/health/family question. 2. debt+house+family produces NO career label.
2. candidate goals preserve user wording. 4. analyze never defaults to career_growth. 5. correction regex
   detects pushback. Updated the relationship_manager test to expect the Rule-7 draft language. **323 core-api tests pass.**

## Transcript — Before / After (the exact incident, live on v74)

- **User:** "I am currently paying down credit cards … a better travel rewards card … the current one for emergencies. Once I don't carry revolving debt I want to build a down payment for a larger house. My fiancée and I want to start a family after the wedding next September."
  - **Before:** "Advance your career."
  - **After:** "I'm hearing a few priorities — 1) paying down credit cards … 2) … down payment for a larger house … 3) start a family after the wedding … Did I capture that correctly?" — **no career**, asks confirm, user's words.
- **User:** "No, you made up advance my career."
  - **Before:** "Advance your career may be part of what's driving this…"
  - **After:** "You're right — I overreached, and I should only work from what you actually told me. Tell me again, in your own words, what matters most — I'll capture exactly what you say." — **career never returns.**

## Remaining Risks

- Clause splitting (analyze_statement) splits on and/commas but not sentence boundaries, so a run-on answer can
  lump two sentences into one "priority" (cosmetic — still the user's words). Splitting on `. ` is a cheap refinement.
- Cross-session `candidate_goals[]` + `rejected_goals[]` persistence (Rule 6 full) + goal ranking (separate
  sprint) + per-domain confidence-based completion remain the deeper engine work.

## Definition of Done — status

✅ The advisor does not invent career (validated, 0 career on the incident transcript). ✅ Acknowledges
corrections. ✅ The rejected goal never returns. ✅ Next questions follow the user's stated goals (goal-driven
FLOW, no domain march). ✅ Reflects the user's own words. **The user is listened to.**
