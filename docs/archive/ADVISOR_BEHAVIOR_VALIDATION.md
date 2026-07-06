# ADVISOR_BEHAVIOR_VALIDATION.md — Phase 4

Live, on Vertex `gemini-2.5-pro`, real advisor pipeline (prompt → validator → compose).

## Answer-first: measured

Across the 6 critical conversations (CRITICAL*CONVERSATION_REPLAY.md), **every** turn led with a substantive recommendation (`answered_first = True` 6/6). Each also offered ONE refining question — but as \_refine-second*, after delivering the answer (not as a blocking opener). None opened by interrogating the user.

## Before vs after

| Behavior                                   | Before                           | After                   |
| ------------------------------------------ | -------------------------------- | ----------------------- |
| Opens with a question instead of answering | common (mandatory next_question) | none in replay          |
| Concrete request → full plan delivered     | often blocked/deferred           | 6/6 delivered           |
| Finance answer survives the gate           | ~no (number gate)                | yes (3-tier)            |
| Wellness answer survives the regex         | intermittent                     | yes                     |
| Trailing question                          | always (forced)                  | optional, refine-second |

## Trust still protected (not lowered to gain initiative)

- 631 unit tests pass, incl. fabricated-personal-number blocks + wrong-derivation guard.
- Tier-1 fabrications, legal/tax/product directives, clinical medical directives, ungrounded graph claims: still blocked.
- Model fallbacks remain loud (provider/model/reason on the turn).

The advisor now behaves like an advisor that answers, while keeping the deterministic trust floor.
