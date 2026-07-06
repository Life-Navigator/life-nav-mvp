# ADVISOR_COMPETITIVE_BENCHMARK.md — Phase 6

## Scope note (honesty)

A fresh side-by-side calling ChatGPT and Claude live needs their API access in this environment, which isn't configured here. This combines (a) the committed in-repo 3-way benchmark, (b) what materially changed since it, and (c) the live Arcana outputs from this sprint, plus a runbook to complete the formal A/B.

## Prior 3-way (committed, `docs/advisor-benchmark/`)

50 real scenarios, 5-judge panel: **Claude Opus 8.2 · ChatGPT 6.2 · LifeNavigator 5.8.** Claude won 48/50, LN 0/50. LN's losses were concentrated in **actionability (−5.5), decision framing (−4.1), insight (−3.8)** — i.e. exactly the _policy_ dimensions this sprint targets — while LN tied on **trust (8.3)**.

## What changed since that benchmark (all policy/model, no architecture)

1. Model `gemini-2.5-flash → gemini-2.5-pro` via Vertex (registry: 6.66 → 7.60).
2. Number gate → 3-tier (finance answers now survive).
3. Medical regex narrowed (wellness answers survive).
4. Answer-first (no forced interrogation).

These attack the exact axes LN lost on (actionability/framing/initiative), not trust (which it already won).

## This sprint's live Arcana outputs (Vertex gemini-2.5-pro)

6/6 critical conversations now produce concrete, ChatGPT-shaped answers that take a position and give a plan (see CRITICAL_CONVERSATION_REPLAY.md) — a qualitative leap from the prior "intake/decision-memo" feel. Arcana retains its differentiators ChatGPT lacks: grounded citations, provenance, no fabricated personal numbers, approval-gated writes.

## Expected standing (hypothesis, to confirm)

On actionability/initiative/naturalness, Arcana should now be **competitive with ChatGPT** and closing on Claude; Claude likely still leads on raw reasoning depth. Arcana wins trust/explainability. **Not yet formally re-scored** — do not claim a number.

## Runbook to finish Phase 6

1. Reuse `apps/web/advisor-eval.mjs` + the prior judge panel.
2. Three arms, identical context: live Arcana (Vertex gemini-2.5-pro) · ChatGPT · Claude (Vertex or API).
3. Same 6 prompts (Phase 5 set), score usefulness/specificity/initiative/naturalness/trustworthiness/actionability.
4. Optionally add a 4th arm: Arcana on Vertex **Claude** (`USE_VERTEX_CLAUDE=true`) — note this faces the SAME gates, so the lift would be reasoning depth, not gate behavior.

## Verdict

Direction strongly positive on the dimensions LN was losing; formal re-score pending live ChatGPT/Claude access.
