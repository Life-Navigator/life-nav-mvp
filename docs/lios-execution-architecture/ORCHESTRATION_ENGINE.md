# LIOS Orchestration Engine

> How the Orchestrator decides which agents run, in what order, what may parallelize, when to escalate, and
> the confidence thresholds — as **deterministic rules**, not LLM intuition. Design only; no code.
> Derived from `ORCHESTRATOR_AGENT.md`, `AGENT_INTERACTION_CONTRACTS.md`, `AGENT_ESCALATION_MODEL.md`,
> `EXECUTION_ARCHITECTURE.md`.

---

## 1. Principle: the Orchestrator routes by rule, not by vibe

The Orchestrator never "decides with the model" which agents to run. Intent may be _classified_ with LLM
help, but the mapping intent → agents → order → parallel groups is a **deterministic rule table**. This is
what makes execution reproducible, testable, and safe.

## 2. Inputs the engine uses

- `intent` (from Intent Detection, with a deterministic default) + `risk_level` ∈ {low, medium, high,
  regulated}.
- `domains_implicated` (which of finance/family/career/education/health/decision are in scope).
- the user's data availability signals (from the deterministic turn / Memory: which domains have data).
- the conversation state (discovery vs. returning user).

## 3. Selection rules (which agents run / do not run)

```
ALWAYS:    Orchestrator, Relationship Manager (deterministic turn), Memory/Context, Audit.
ALWAYS before user-facing text:  Compliance, Response Composer.
Advisor:   runs for any conversational/discovery intent.
Domain agent D: runs IFF (D ∈ domains_implicated) AND (D has data OR the intent needs D's missing-data list).
GraphRAG:  runs IFF the plan needs relationships/evidence (else skipped — see GRAPHRAG_RETRIEVAL_MODEL).
Tool Execution: runs IFF a number/projection/write is required (see TOOL_EXECUTION_MODEL).
Missing Data: runs IFF an agent returns needs_data OR the highest-value gap is unclear.
Decision pipeline (Decision Scientist → Scenario → Tradeoff → Recommendation → Decision Explanation):
           runs IFF intent = decision OR ≥2 domains conflict.
Recommendation Agent: runs IFF there is ≥1 evidenced finding to mint from (else NOT run — no rec without evidence).
Critic:    runs IFF risk_level ∈ {high, regulated} OR the output is a decision recommendation/cross-domain claim.
An agent does NOT run if its ownership is irrelevant to the intent — silence is cheaper than a no-op call.
```

## 4. Execution order (the DAG)

The order is fixed by dependency, not preference:

```
det_turn → intent → selection → [graph_plan ∥ tool_plan] → agent_execution
        → conflict_resolution → recommendation → critic? → compliance (→ repair loop) → response_assembly → audit
```

- `graph_plan` and `tool_plan` may be computed in parallel (both feed agent execution).
- Agent execution parallelizes independent domain agents (see `PARALLELIZATION_MODEL.md`).
- Recommendation, Critic, Compliance, Response Assembly are strictly sequential and downstream of all agent
  output (a recommendation cannot precede the evidence it cites; Compliance cannot precede the content it
  gates).

## 5. Parallel-execution opportunities (deterministic)

- **Parallel-safe:** independent domain agents (Finance ∥ Career ∥ Family ∥ Education ∥ Health), and
  graph_plan ∥ tool_plan, and independent tool calls with no data dependency.
- **Must be serial:** anything that consumes another agent's output — Conflict Resolution (needs all domain
  outputs), Recommendation (needs evidenced findings), Critic (needs the claim), Compliance (needs the
  candidate), Response Assembly (needs the validated output). Tool chains with data dependencies are serial
  (e.g. affordability → mortgage → cash-flow).

## 6. Escalation logic (mediated, acyclic, bounded)

- An agent returns `escalated{to, reason, blocking}`; the Orchestrator routes to `to` (it never lets agents
  call each other).
- **Cycle guard:** the Orchestrator rejects any route that would revisit an agent already on the current
  chain (DAG enforcement).
- **Hop cap:** a chain may not exceed N hops (config; default small, e.g. 8). Exceeding N → terminate at the
  deterministic fallback + Audit flag.
- **Blocking vs advisory:** `blocking:true` escalations must resolve before the caller continues;
  `blocking:false` may be parallelized.
- Escalate for **ownership**, not **uncertainty** — uncertainty resolves via `needs_data`/`needs_confirmation`.

## 7. Confidence thresholds (deterministic gates)

Using the global confidence model (`AGENT_CONFIDENCE_MODEL.md`):

- An agent may return `success` only at confidence ≥ 0.75; below that it returns a non-success state.
- The Orchestrator **invokes the Critic** when a high-stakes claim's confidence is below a review threshold
  (e.g. < 0.85) OR risk_level ∈ {high, regulated}, regardless of confidence.
- A **decision** is "modelable" only if Decision Scientist reports required-inputs present (else
  `needs_data`); the Orchestrator does not force a low-confidence decision through.
- Final-response confidence below a floor (e.g. < 0.5) downgrades the response toward "here's what I'd need"
  rather than an assertion. (Aggregation in `CONFIDENCE_PROPAGATION_MODEL.md`.)

## 8. What the engine outputs (the route plan)

```json
{
  "turn_id": "",
  "intent": "",
  "risk_level": "",
  "selected_agents": [],
  "pipeline": [
    ["det_turn"],
    ["intent"],
    ["graph_plan", "tool_plan"],
    ["finance", "family"],
    ["conflict"],
    ["recommendation"],
    ["critic"],
    ["compliance"],
    ["compose"],
    ["audit"]
  ],
  "parallel_groups": [["finance", "family", "career"]],
  "graph_required": false,
  "tools_required": [],
  "critic_required": false,
  "compliance_required": true,
  "missing_data_path": ""
}
```

(See `schemas`/`ORCHESTRATOR_OUTPUT_SCHEMA.md` in the Prompt OS.) JSON only — the Orchestrator never emits
user prose.

## 9. Failure handling

LLM intent classifier unavailable → deterministic default (discovery). Any agent `blocked` on a branch →
that branch degrades; the deterministic floor still answers. Unroutable/cyclic/over-long → fallback. The
Orchestrator's prime directive remains: **always return a safe, governed response.**

## 10. Invariants

1. Selection/order/parallelization/escalation are deterministic rules; only intent classification may use
   the LLM (with a deterministic fallback).
2. Deterministic turn first; Compliance before Composer; Audit always.
3. No cycles; hop-bounded; no direct agent-to-agent calls.
4. No recommendation without evidence; no agent run that would violate its spec or bypass Compliance.
