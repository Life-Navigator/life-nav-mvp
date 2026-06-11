# P0 ONBOARDING MODEL RENDERING + GOAL MEMORY — 2026-06-11

The final Life Model now reflects what the user actually said. Goals persist across every turn, each
carries a real domain, coverage reflects the conversation (no false 0%), career stays 0 unless named,
the confirmation renders the user's own words (not a stale label), and the final open-ended answer is
processed. No GraphRAG / recommendation / dashboard / CRUD / reports / finance-calc changes.

## Root Cause

Three defects collapsed the user's goals at confirmation:

1. **Goals were never persisted or accumulated.** `analyze_statement` extracted candidate goals _per
   turn_ and returned them in the turn payload, but nothing stored them. By the confirmation step there
   was no accumulated set, so the UI fell back to `primary_objective` ("Reach financial independence") —
   a single derived label that erased the eight distinct goals.
2. **Candidate goal `domain` was always `"core"`.** The tag was read from
   `ROOT_OBJECTIVES[key]["domain"]`, a key that doesn't exist → every goal was `"core"`, so domain
   coverage had no per-domain signal to read.
3. **Coverage only looked at `life_objectives` + a few advisor answer-keys.** The advisor stopped
   force-asking `family_goal`/`health_goal` (prior sprint), so Family/Health/Education had _no path_ to
   coverage → hard 0%, even when the user clearly spoke to them.

Plus: goal extraction only ran on the dedicated `primary_goal` turn, so goals surfaced while answering
_other_ questions ("getting in better shape" during the risk question; "going back to school" as the
final open answer) were silently dropped. And the action cards recommended data for any domain `<100%`
— including career at 0%, which the user never mentioned ("Upload resume").

## Files Changed

- `app/services/life_discovery.py` — `_DOMAIN_KW` + `_goal_domain()` (real per-goal domain), `_is_future`
  - `_FUTURE_MARKERS` (P0.5 future goals), `_META_RE` (drop system/meta statements), relaxed-but-guarded
    candidate gate (keep clear domain signals, reject fragments/meta), `status` on each candidate.
- `app/services/relationship_manager.py` — `_persist_candidate_goals()` + `_load_candidate_goals()`
  (accumulate/upsert across turns, suppress rejected), extract goals from **every** answer (P0.5),
  context panel now exposes `candidate_goals` / `priorities_i_heard` / `domains_touched`.
- `app/services/discovery_coverage.py` — reads persisted `candidate_goals`; a domain with a stated goal
  is floored to "started" (≥30%) and never 0%.
- `supabase/migrations/20260611020000_life_candidate_goals.sql` — new `life.candidate_goals` table (RLS).
- `apps/web/src/components/dashboard/AdvisorOnboarding.tsx` — confirmation renders "Priorities I heard"
  from `candidate_goals` (user's words, future tagged), blank-state guard, Plaid-aware finance CTAs
  (goal-target cards first; income/401k → Coming Soon, Plaid is the source).
- `apps/web/src/app/dashboard/advisor/page.tsx` — action cards derive from _engaged_ domains (stated
  goal, 0 < coverage < 100), not domains at 0%.
- `tests/test_onboarding_model.py` (+8), `tests/validate_transcript.py` (end-to-end proof runner).

## Candidate Goal Persistence Fix (P0.1)

`life.candidate_goals` stores one row per distinct goal — `goal_text` (verbatim), `normalized_goal`
(dedupe key), `domain`, `status`, `supporting_quote`, `confidence`. Persisted on every turn via upsert
(deterministic `uuid5(user:cand:normalized)` + `on_conflict=user_id,normalized_goal`) so re-mentions are
idempotent and nothing is collapsed into a generic label. The eight transcript goals all persist
distinctly; "financial independence" is never substituted.

## Final Confirmation Rendering Fix (P0.2)

The confirmation panel now carries `candidate_goals` + `priorities_i_heard`. `LifeModelConfirmation`
renders a **"Priorities I heard"** list from those (the user's own words, in order, future goals tagged
"· later"), instead of `primary_objective` + `top_themes`. Rejected goals are filtered out at load.

## Coverage Calculation Fix (P0.3)

`coverage()` loads `candidate_goals`, builds `goal_domains`, and treats a domain the user named as
covered: `has_objective or has_goal`, floored to ≥30% ("started"). Finance/Family/Health/Education all
show > 0 when stated; a domain with **no** stated goal and no objective (career, unmentioned) stays 0%.

## Plaid-Aware CTA Fix (P0.4)

Finance action cards are reordered so **goal-target** entries lead — "Set your credit-card payoff
target", "Set your home down-payment goal", "Set an emergency-fund target" (things Plaid can't know).
Account-data entries ("Enter income", "Upload 401(k)") sink to the end as **Coming Soon** with the note
that beta financial data comes from the connected Plaid persona. Action cards now surface only for
domains the user engaged with, so an unmentioned career never yields "Upload resume".

## Final Open Question Processing Fix (P0.5)

Every substantive answer — not just the goal turn — is run through `analyze_statement`, so a goal that
surfaces while answering the risk/constraint question, or in the final open reply, is captured. "I am
also considering going back to school … a few years in the future" → an **Education** candidate with
`status = future_goal` (timing from a dropped qualifier clause is propagated onto the goal). It updates
education coverage and appears in the confirmation — it is not ignored, and the session does not end on it.

## Blank Chat Fix (P0.6)

The confirmation computes `nothingYet = no goals heard AND no vision` and renders an intelligent missing
state ("I haven't captured your goals yet — tell me in your own words…") instead of an empty block.
Goals come from a persisted store, so the section is populated from real data, not transient turn state.
All `candidate_goals` access is wrapped in try/except, so a missing table degrades to "no goals yet",
never a crash or a blank bubble.

## User Language Preservation (P0.7)

`goal_text` is the user's verbatim clause; the objective label is secondary metadata. The confirmation
shows the clause ("Paying down credit cards", "Build a down payment for a larger house"), never the
collapsed "Reach financial independence."

## Tests Added (8 in `test_onboarding_model.py`; 333 core-api total pass)

`_goal_domain` classifies each domain · `analyze_statement` tags real domains (not core) · coverage
reflects stated goals (finance/family/health/education > 0) · career stays 0 without mention · goals
persist across turns + panel renders them · open-ended school answer → education future_goal · no blank
advisor message · user language preserved (not "financial independence").

## Before / After Transcript

Run live through the real engine: `python -m tests.validate_transcript` (in-memory Supabase).

**Before** (the reported failure): Primary objective = "Reach financial independence"; Family 0% /
Health 0% / Education 0%; CTAs = Upload 401(k), Enter income, Upload resume; the school goal ignored.

**After** (this build):

```
Priorities I heard (persisted candidate_goals):
  • Paying down credit cards                              (finance)
  • Get a better travel rewards card for all spending     (finance)
  • I don't carry any revolving debt anymore              (finance)
  • Build a down payment for a larger house               (finance)
  • Start building a family                               (family)
  • Build a solid foundation for my family … security      (family)
  • Removing the revolving credit … focus on saving        (finance)
  • Also interested in getting in better shape            (health)
  • Also considering going back to school                 (education) [future]

Domain coverage:   Financial 100%   Family 30%   Health 30%   Education 30%   Career 0%
domains_touched:   finance, family, health, education
✅ no career invented · family/health/education > 0 · school = future · user words preserved
```

## Remaining Risks

- **Migration not yet applied to prod** (blocking, needs your Supabase Management token). The
  `life.candidate_goals` table must exist for persistence to function live. Apply with:
  `SUPABASE_ACCESS_TOKEN=sbp_… ./apply_candidate_goals_migration.sh`. The code is migration-safe — until
  the table exists, goals simply don't persist (no crash), and live validation of persistence is pending.
- Domain classification is keyword-based; an unusually phrased goal could land in `core` (kept only if it
  also has a canonical objective/deps). The meta/fragment filter is heuristic.
- Coverage floors a stated goal at 30% ("started") — intentionally conservative; it reflects intent
  captured, not data completeness.

## Definition of Done — status

✅ Final review reflects what the user said. ✅ No stated goal disappears (8/8 persist). ✅ No unstated
goal appears (career stays 0). ✅ Domain coverage reflects the conversation (Finance/Family/Health/
Education > 0). ✅ Recommended actions match the user's goals + Plaid data (goal targets, not "enter
income"). ⏳ Live end-to-end validation pending the one migration apply (token-blocked) — proven through
the real engine in-memory (`validate_transcript.py`), 333 tests green.
