# Fact Confidence Guard Report (Step 4)

**Date:** 2026-06-16 · How discovery mode prevents candidate/inferred facts from being stated as confirmed.

## The rule

- **Confirmed** facts (the user typed/affirmed them) may be stated directly.
- **Inferred / candidate** facts (persona-seeded, or model-inferred with a confidence score) must be **qualified** ("it sounds like…", "should I treat that as a goal?").
- **Unknown** facts must not be stated.

## Where the leak was (advisor mode)

On the deployed branch, the advisor path injects the stored objective into the prompt as a confirmed fact and the LLM restates it declaratively:

- `app/services/advisor_context.py:322-323` adds `primary_objective` to confirmed facts with `source:"user_message"`, **dropping the confidence** that `life_discovery.py:149-201` originally attached.
- The advisor prompt's "what_we_know"/recommendation sections then surface it as "Your primary objective is …" — rendered by `_compose` (`advisor_orchestrator.py`).

This path is **only reached by `_enhance`**, i.e. advisor mode.

## How discovery mode guards it

1. **Structural:** discovery mode **skips `_enhance`** entirely, so `advisor_context.build` and the advisor prompt never run for onboarding. The persona-seeded objective is therefore never elevated to a declarative fact in a discovery turn.
2. **Source of truth stays qualified:** the conversational `RelationshipManager` reflects the user's **own words** and asks whether to treat a surfaced item as a goal (candidate framing). It reads the objective only as a panel value, never asserting it (`relationship_manager.py:_context_panel`).
3. **Tripwire:** `discovery_contract_violations()` flags `"your primary objective is"` (and the advisor section/disclaimer markers); `_enforce_discovery_contract()` logs a warning if a discovery turn ever contains it. (Non-mutating.)

## Tests

- `test_discovery_mode_does_not_state_candidate_goal_as_fact` — a base whose conversational reply offers to treat a surfaced item as a goal ("…want me to treat that as one of your goals?") passes discovery mode unchanged and contains no "your primary objective is".
- `test_discovery_contract_violations_detects_advisor_artifacts` — the guard catches the fact-assertion phrase.
- `test_advisor_mode_still_renders_six_section_template` — confirms the fact-asserting path still exists for advisor mode (so the guard is specifically about _discovery_, not a global removal).

## Honest limit

The guard is **mode-structural + tripwire**, not a natural-language fact-classifier. It guarantees the _known_ leak paths (advisor composition) cannot run in discovery, and alarms on the _known_ phrasings. It does not parse arbitrary RM text for novel fact-assertions — but the RM is deterministic and reflective by construction (it does not assert inferred facts), so the residual risk is low and observable via the logged tripwire.
