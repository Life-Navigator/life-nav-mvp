# ADVISOR INTELLIGENCE HARDENING — 2026-06-11

Live on Core API **v75** + prod `e7c288b`. Clean clause-splitting, persisted rejected goals (cross-session),
and evidence-tagged goals — all validated live. No GraphRAG/recommendation/dashboard/CRUD/auth/routing changes.

## Files Changed

- `app/services/life_discovery.py` — `analyze_statement` clause-splitting + `_clean_clause`; `THEME_OBJECTIVE`
  (adventure/achievement no longer → career); `_DEP_SIGNALS` debt (credit-card/pay-down/revolving); evidence (`supporting_quotes`).
- `app/services/relationship_manager.py` — `_REJECTED_PHRASE_RE` + persist-on-correction; `_rejected_norms` + cross-session suppression.
- `supabase/migrations/*_life_rejected_goals.sql` — new `life.rejected_goals` table.
- `tests/test_advisor_intelligence.py` (+8 tests), `tests/test_relationship_manager.py` (updated).

## Persistence Model

`life.rejected_goals` (RLS `user_id = auth.uid()`, granted authenticated/service_role/anon). On a correction,
the rejected concept is persisted; on every discovery turn, candidate goals are filtered against it — so a
rejected goal never returns, even in a future session.

## Candidate Goals (P0.1/P0.5/P0.6)

Each candidate carries: `goal` (user's verbatim clause — shown first), `objective` (label, secondary),
`objective_key`, `confidence`, **`supporting_quotes` (the quote — no quote, no goal)**, `dependencies`, `domain`.
Reflection lists the user's `goal` text, never the label; labels appear only after confirmation.

## Rejected Goals Schema

`id, user_id, tenant_id, session_id, rejected_goal, normalized_goal, reason, rejected_by_user_quote,
source_turn_id, created_at`.

## Sentence Splitting Logic (P0.4)

`analyze_statement` splits on `. ; , and then once after "so that" "in order to" because plus "as well as"
"i want to" "i'd like to" "we want to"`; `_clean_clause` strips leading filler ("I am currently", "the current
one will be", "my fiancée and", subject/intent prefixes) **keeping the verb**, drops <2-word fragments, and
title-cases. The incident run-on → 5 clean goals (paying down credit cards / travel rewards / don't carry
revolving debt / down payment for a larger house / start a family).

## Correction Handling Logic (P0.2/P0.3)

`_CORRECTION_RE` detects pushback → apologize, do not classify/advance, ask to restate. `_REJECTED_PHRASE_RE`
extracts the rejected concept (e.g. "the down payment for a house") → persisted. `_rejected_norms(ctx)` loads
the phrase + significant words (e.g. "career") and any candidate matching one is dropped — across sessions.

## Tests Added (8 in `test_advisor_intelligence.py`; 326 core-api total pass)

no-forced-career-FLOW · debt+house+family ≠ career · candidate goals preserve wording · analyze never defaults
to career · correction regex detects pushback · long answer → ≥4 clean goals (no career) · every goal has a
supporting quote · travel-rewards ≠ career.

## Incident Transcript Re-run (live, v75)

> "I am currently paying down credit cards … travel rewards … emergencies. Once I don't carry revolving debt I
> want to build a down payment for a larger house. My fiancée and I want to start a family after the wedding…"

**Advisor:** "I'm hearing a few priorities — 1) Paying down credit cards; 2) Get a better travel rewards card
for all spending; 3) I don't carry any revolving debt anymore; 4) Build a down payment for a larger house;
[5) Start building a family]. Did I capture that correctly?" — **no career**, user's words, asks to confirm.

## Cross-Session Validation (live)

Session 1: reject "the down payment for a house" → persisted (`rejected_goals` row confirmed). Session 2 (new):
"…build a down payment for a house, and also improve my fitness" → candidate goals = `["Also improve my
fitness"]` — **the down-payment was suppressed across the session**; fitness kept. ✅

## Remaining Risks

- The rejected-phrase extraction is heuristic (regex on the correction text); an unusually phrased rejection
  could capture an imperfect span. The full candidate_goals accumulation/merge/split lifecycle (P0.1 in full)
  is partly in place (per-turn capture + persisted rejections); a per-session candidate_goals table that
  accumulates/merges across turns is the next increment.
- Clause splitting is heuristic — most run-ons split cleanly; deeply nested sentences may still merge two ideas.

## Definition of Done — status

✅ The advisor remembers what the user rejected (persisted, cross-session). ✅ Preserves user goals in the
user's own words. ✅ Long answers split into clean candidate goals. ✅ Rejected goals do not come back across
sessions (validated). ✅ No unsupported objective is surfaced (evidence-tagged; no invented career). The
advisor listens and learns.
