# INVESTOR_IMPACT_VALIDATION.md

## What an investor sees in the action loop

1. User tells the advisor a real life change ("I got promoted to Director at $185k").
2. Advisor detects it and shows an **approval-gated ActionCard** (no silent writes — a trust signal).
3. User approves → a polished **✓ Update complete** card appears in-chat with the **real facts** (currency-formatted) and the **impact areas** they touch.
4. The advisor cites those facts on the next turn; the dashboard "Recently learned about you" strip shows them on next load.

## Why this is the right thing to demo

- **It's the moat, made visible:** a per-user life model that grows from conversation, with provenance and approval — not a chatbot transcript.
- **It's honest:** the card shows what actually changed (facts + affected areas). It deliberately does **not** show a fabricated "Readiness 69→74" because a `life.facts` write does not move readiness (verified 69→69). Honest beats impressive-but-fake in a diligence setting.

## The one caveat to frame, not hide

Readiness/recommendation **numbers** don't jump from an action yet, because those are computed from domain tables (and behavioral/connected-account data), not from `life.facts` (see DOMAIN*WRITE_GAP_AUDIT.md). The story to tell: *"the life model updates instantly and grounds the advisor; the scored projections refresh as the domain data behind them fills in."\_ If you want one **real** numeric jump for the demo, the cheapest honest path is New Child → `family.dependents` (DOMAIN_WRITE_DECISION.md) — ~0.5–1 day, flag-gated.

## Verification basis

- Backend facts-only write: unit-tested (`tests/test_advisor_actions.py`), single endpoint (`POST /v1/life/advisor/action/apply`).
- 14 facts written live, `confirmation_status=confirmed`, `submitted_by=arcana-action-loop` (prior session).
- Honesty (no fake deltas): enforced by what the card renders — facts + areas only. No readiness/recommendation diff is computed or shown.
