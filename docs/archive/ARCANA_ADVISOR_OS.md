# ARCANA_ADVISOR_OS.md — Sprint A

The design for turning Arcana from a chat surface into a true advisor that manages life over time. **Surfacing + orchestration over existing primitives — no new model, no new DB.**

## Grounded finding

The pieces already exist, unconnected as an "operating system":

- **Write primitives:** `IngestionService` exposes provenance/tenant-enforced `submit_life_fact / goal / constraint / risk / opportunity / narrative / relationship` (the MCP tools). These are the ONLY sanctioned writers into the life model.
- **Advisor invariant (already enforced):** the hybrid advisor's LLM _leads_ but **never writes the DB** — rules guardrail, validator gates output (`advisor_validator.validate`), `advisor_facts` grounds. (memory: hybrid-advisor-layer.)
- **Grounding:** `advisor_facts.build_fact_packet` (now incl. `life.facts`, Sprint B) gives the advisor cited facts to reason over.

What's missing is the **loop** that connects "user states a life change" → "model updates" through an explicit approval gate. That loop is the Advisor OS.

## The two-experience boundary (hard rule)

- **Discovery** = intake. Builds the Life Model; ends when "I understand your life well enough to begin helping you." Not redesigned here.
- **Advisor** = manage life over time. The primary interface. This document is only about the Advisor.
  The Advisor OS must detect when a message is a _life change to record_ (advisor action) vs a _question to answer_ (advisor reasoning) vs _intake_ (route to Discovery if the model is incomplete).

## The Advisor OS loop (the product)

For an utterance like _"We moved our wedding from September to March"_:

1. **Understand** — classify intent = life-change; extract the changed entity (wedding date) + new value (March). Grounded in the fact packet.
2. **Explain impact** — compute what's affected by traversing existing relationships/recommendations (wedding timeline, home-purchase timing, family-planning timeline, savings targets). Read-only.
3. **Propose updates** — a concrete, itemized diff: which `life.*` rows would change, to what, with confidence + reasoning. Nothing written yet.
4. **Request approval** — present `[Review] [Approve]`. The advisor stops here. **Never silently update.**
5. **Execute via MCP** — on approval only, call the `submit_life_*` tools (the sanctioned writers). The LLM still never writes directly; the approved action object is executed by the deterministic MCP layer with provenance `source='user_message'`, `submitted_by='advisor'`, `conversation_id`.
6. **Show what changed** — render the applied diff + downstream recompute (readiness deltas, updated recommendations) via the change-visibility surface.

## Why this respects every guardrail

- **No silent writes:** approval gate is mandatory between propose (4) and execute (5). Matches the existing "LLM never writes DB" invariant — the LLM only ever produces a _proposed_ action; execution is deterministic + user-gated.
- **No new infra:** writes go through existing `IngestionService` tools into existing `life.*` tables; impact analysis reads existing relationships/recommendations.
- **Provenance preserved:** every applied change carries source + confidence + conversation_id, exactly like document/MCP facts — so it's later citable and reversible.
- **Trust:** proposed changes show confidence + reasoning; low-confidence extractions ask a clarifying question instead of proposing a write (reuse the validator's fallback-on-ambiguity behavior).

## Companion specs

- **ADVISOR_ACTION_FRAMEWORK.md** — the change taxonomy + impact-analysis model (steps 1–3).
- **APPROVAL_AND_CHANGE_SYSTEM.md** — the approve/review/diff/show-what-changed UX (steps 4 + 6).
- **MCP_ADVISOR_INTEGRATION.md** — how approved actions map to `IngestionService` tools (step 5), with the never-silent-write enforcement.

## Definition of done (design milestone)

A user can state any of the 6 example life-changes (promotion, wedding move, home purchase, trust finished, weight loss, master's intent), see a correct impact analysis + itemized proposed diff, approve, and see the model update with provenance and a visible change summary — all through existing write primitives, with an enforced approval gate.
</content>
