# Live Discovery Fix Verification

**Date:** 2026-06-16 · **Directive:** fastest safe production fix — merge `platform/discovery-mode-fix` into the deployed advisor branch, deploy to Fly, run live production smoke. **Main consolidation NOT started** (deferred per directive).

## What was done

1. **Merged** `platform/discovery-mode-fix` → `advisor/p0-upgrade-2.3.0` (fast-forward to `1e32954`) and pushed.
2. **Deployed** `lifenavigator-core-api` to Fly from the advisor branch — **release v115** (prior live was v114), both machines healthy, DNS verified, `healthz` 200 in ~0.25s. New image `deployment-01KV9BRARX396W7ZNRWHAN3T5G`.
3. **Ran authenticated live smoke** against `https://lifenavigator-core-api.fly.dev` (throwaway Supabase users minted + cleaned up; harness `apps/web/discovery-smoke.mjs`).

## Smoke results — 4/4 PASS

| #   | Test                                                                                               | Result  | Evidence (live)                                                                                                                                                                                                                                                                                                                                                                            |
| --- | -------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `/v1/life/discovery/chat` ← "Reach financial independence"                                         | ✅ PASS | `status=200`, `llm_status=discovery`, violations=`[]`. Response: _"Let's build your plan together — I'll ask a few quick questions. Let's start with the big picture — what would you most like your life to look like over the next few years?"_ — conversational; **no** "The tradeoffs / What we know / My read / What would change this", **no** disclaimer, **no** objective-as-fact. |
| 2   | `/v1/life/discovery/chat/stream` ← same                                                            | ✅ PASS | `status=200`, frames `["ack","final"]`, `llm_status=discovery`, violations=`[]`. Same conversational content.                                                                                                                                                                                                                                                                              |
| 3   | Finance question on the chat route ("Should I move my 401k into an index fund to retire earlier?") | ✅ PASS | `status=200`, `llm_status=discovery`, violations=`[]` — the advisor six-section template is **not** leaked; the route stays conversational for substantive topics.                                                                                                                                                                                                                         |
| 4   | Health urgent ("I have chest pain on and off for a week, what should I do?")                       | ✅ PASS | `status=200`, `llm_status=safety_fallback`. Response: _"What you're describing (chest pain) can be a sign of a serious medical emergency … **Please seek medical care now** — call **911** …"_ — deterministic safety net wins, in discovery mode.                                                                                                                                         |
| 5   | No test regression                                                                                 | ✅ PASS | `pytest tests/test_advisor_hybrid.py` → **51 passed** on the deployed tip `1e32954`.                                                                                                                                                                                                                                                                                                       |

## Confirmation: the ugly six-section onboarding is gone

Every discovery turn now returns `llm_status=discovery` with **zero** advisor-template markers. Before the fix, `/v1/life/discovery/chat` returned the six-section consultant block (tradeoffs / what we know / my read / what would change this) + disclaimer + objective-as-fact. **Verified eliminated in production (v115).**

## Honest notes

- **Test 3 ("advisor mode preserved"):** advisor mode (the six-section decision turn) is **no longer reachable on any live HTTP route** — `/discovery/chat[/stream]` were the only orchestrator callers and now run discovery mode. Advisor mode is **preserved in code** (default `mode="advisor"`) and **verified by unit test** (`test_advisor_mode_still_renders_six_section_template`), ready for a future advisor/decision surface. The live test confirms a finance question stays conversational and does not crash or leak the template — i.e. no regression — rather than exercising advisor mode (which has no route).
- **Smoke fidelity:** the fresh smoke users have no persona seed, so each first turn returns the standard opening question. That still proves the contract (no six-section / disclaimer / fact). The persona-seeded "objective-as-fact" path is additionally covered by the unit test `test_discovery_mode_does_not_state_candidate_goal_as_fact`.
- **Rollback:** the change is additive (`mode` defaults to advisor). To revert, redeploy the prior image (v114) via `flyctl` or revert the two route lines + redeploy.

## Security reminder

The live smoke used the dev Supabase service-role key from `/tmp/sweep_creds.txt`. Per `docs/pilot-p0/SECURITY_TOKEN_ROTATION_NOTE.md`, rotate the Supabase keys before inviting external pilot users.

## Final status

### PROD_DISCOVERY_FIXED

Onboarding discovery is conversational in production (v115); advisor template + disclaimer + objective-as-fact eliminated from the discovery routes; streaming follows discovery mode; health-urgent safety fallback intact; 51 unit tests pass. Main consolidation remains deferred (`MAIN_CONSOLIDATION_PLAN.md`).
