# LifeNavigator Intelligence Operating System (LIOS) — Architecture

> **Status of this document:** architecture specification. No code, no runtime changes. It describes both
> what exists today (marked **[live]**), what exists partially (**[partial]**), and what LIOS adds
> (**[planned]**). A new engineer should be able to read this and the five companion documents and
> understand exactly how LifeNavigator intelligence is meant to work before any implementation.

Companion documents:

- `AGENT_INTERACTION_DIAGRAM.md` — how the agents call, hand off to, and escalate to one another.
- `DATA_FLOW_DIAGRAM.md` — how data moves from ingestion → truth → retrieval → response → telemetry.
- `TRUTH_AND_PROVENANCE_MODEL.md` — the User Truth Layer, fact lifecycle, approved save paths.
- `COMPLIANCE_AND_SAFETY_FLOW.md` — review-before-output, hallucination prevention, escalation.
- `PROMPT_OPERATING_SYSTEM_PLAN.md` — the 4-layer prompt stack (constitution → subsystem → domain → task).

---

## 1. What LIOS is

LIOS is the intelligence tier that sits **between** the user-facing surfaces (web app, advisor chat,
dashboard, reports) and the **systems of record** (Supabase relational truth, Neo4j personal graph, Qdrant
vectors, deterministic engines). It is a **governed multi-agent system** whose job is to turn a user's
real, owned data into trustworthy guidance — and to make every step explainable.

LIOS is not "an LLM with tools." It is a **deterministic spine with LLM leaves**:

> **First principle — Rules guide; the LLM leads; the LLM never writes.**
> Deterministic engines own persistence, math, and truth. The LLM leads the _conversation_ and _reasoning_
> within guardrails it cannot escape. Anything the LLM proposes is gated by a deterministic validator before
> the user sees it, and is only ever persisted by a deterministic save path after explicit confirmation.

This principle is already the backbone of the live advisor (`app/services/advisor_orchestrator.py`:
`RelationshipManager.converse` is deterministic and owns persistence; `GeminiAdvisorLLM` only proposes;
`advisor_validator.validate` gates output). LIOS generalizes it to every domain.

### Design invariants (non-negotiable, enforced, not aspirational)

1. **No fabrication.** No invented goals, risks, opportunities, recommendations, relationships, or financial
   numbers. A number may be shown only if it is in the user's own data; a relationship only if it is a real
   graph edge; a recommendation only if it cites evidence. (`advisor_validator`, `recommendations_os`.)
2. **The LLM never persists.** Only deterministic write paths (`RelationshipManager`, `RecommendationOS`,
   domain writers) touch the database, and only after confirmation. Validators force `should_persist=false`.
3. **Evidence-or-nothing.** A recommendation/risk/opportunity with empty evidence is dropped, not shown.
4. **Citation contract.** "No cited edge ⇒ no claim." Graph reasoning must reference a real edge.
5. **Honest empty states.** When the system doesn't know, it says so. Never mock data, never a guessed %.
6. **Provenance on every fact.** Every surfaced fact carries a provenance type, source, and confidence.
7. **Review before output.** Every LLM-authored response passes the Compliance gate before the user sees it;
   on failure it falls back to safe deterministic text.
8. **Everything is observable.** Every agent decision is logged with enough detail to answer "why did it say
   that?" after the fact.

---

## 2. The tiers (where every agent lives)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  SURFACES        web app · advisor chat · dashboard · reports · emails          │
└───────────────▲───────────────────────────────────────────────▲───────────────┘
                │ request                                          │ governed response
┌───────────────┴──────────────────────────────────────────────────────────────┐
│  GOVERNANCE TIER                                                                │
│    Orchestrator  ·  Compliance  ·  Critic  ·  Audit / Observability             │
│    (routing, safety gate, adversarial check, logging — mostly deterministic)    │
├────────────────────────────────────────────────────────────────────────────────┤
│  CONVERSATION TIER                                                              │
│    Relationship Manager / Advisor  ·  Onboarding  ·  Response Composer          │
├────────────────────────────────────────────────────────────────────────────────┤
│  REASONING / LIFE-MODEL TIER                                                    │
│    Life Model  ·  Goal Discovery  ·  Goal Conflict  ·  Missing Data             │
├────────────────────────────────────────────────────────────────────────────────┤
│  DOMAIN TIER                                                                    │
│    Finance · Family · Career · Education · Health · Decision Intelligence        │
├────────────────────────────────────────────────────────────────────────────────┤
│  KNOWLEDGE TIER                                                                 │
│    Memory / Context  ·  GraphRAG  ·  Document Intelligence                       │
├────────────────────────────────────────────────────────────────────────────────┤
│  EXECUTION TIER                                                                 │
│    Tool Execution (deterministic calculators, resolvers, writers)               │
└────────────────────────────────────────────────────────────────────────────────┘
                │                                                  │
┌───────────────▼──────────────────────────────────────────────────────────────┐
│  SYSTEMS OF RECORD   Supabase (relational truth + RLS) · Neo4j (personal graph) │
│                      · Qdrant (vectors) · deterministic engines · object store  │
└────────────────────────────────────────────────────────────────────────────────┘
```

**LLM-backed agents** (reason in natural language, always gated): Advisor, Goal Discovery, the domain
reasoning agents, Critic. **Deterministic agents** (rules/math/IO, authoritative): Orchestrator core,
Relationship Manager persistence, Life Model aggregation, Goal Conflict, Missing Data, Memory/Context,
Tool Execution, Compliance, Audit, Response Composer, Recommendation engine, GraphRAG retrieval.

> The trust property comes from keeping the **authoritative** work deterministic and confining the LLM to
> _language and prioritization_, never to _facts or writes_.

---

## 3. The request lifecycle (one advisor turn, end to end)

This is the live path (`AdvisorOrchestrator.converse` / `converse_stream`), generalized. See
`AGENT_INTERACTION_DIAGRAM.md` for the sequence diagram.

1. **Surface → Orchestrator.** A user message (or a domain request) arrives with the authenticated user
   context (JWT-derived `user_id`; never trusted from the body).
2. **Orchestrator routes.** Determines intent + which agents are needed (conversation? a domain question? a
   decision simulation?). For discovery it runs the deterministic turn first.
3. **Deterministic turn (Relationship Manager).** Persists any confirmable outcomes from the _previous_
   step, computes the safe fallback text, and assembles the deterministic context panel. **This is the
   trust floor — even if everything downstream fails, this is a correct, safe response.**
4. **Memory / Context assembly.** The Context agent builds the bounded guardrail context: discovery scores,
   the user's real graph edges, allowed numbers, classified facts, domain priorities. (`AdvisorContextBuilder`.)
5. **Plan / routing constraints.** Deterministic `build_constraints` turns the context + base into a plan
   (intent, temperature, what the LLM may and may not do this turn).
6. **Domain / reasoning agents (as needed).** GraphRAG retrieval, domain summaries, decision calculators,
   recommendation lookups feed the LLM — all as _read-only context_, never as authority the LLM can mutate.
7. **LLM leads.** The relevant LLM agent (Advisor / Goal Discovery / domain) produces a structured proposal
   (reflection, one question, candidate facts/goals, cited relationships) — **never free prose, never a
   write.**
8. **Compliance gate.** The validator checks the proposal against every safety + anti-fabrication rule.
   Output is **accepted**, **repaired** (e.g. trim a second question), or **rejected** (→ fallback).
9. **Critic (planned, for high-stakes turns).** An independent adversarial check that tries to _refute_ the
   proposal before it ships.
10. **Response Composer.** Merges the validated, human-facing text with the deterministic outcomes (only the
    text changes; all persisted/structured outcomes stay deterministic).
11. **Audit / Observability.** One row per turn is logged (status, validator result, fallback reason, stage
    latency, tokens, retrieval counts, provenance used) → `analytics.advisor_turns` + metrics view.
12. **Surface ← governed response.** Streaming variant emits a fast deterministic `ack` first, then the
    validated `final`.

---

## 4. Agent roster

Every agent is specified with the same contract: **Role · Inputs · Outputs · Allowed tools · Forbidden ·
Escalation · Confidence · Compliance · Relationships · Maps to (code)**. Status: **[live] / [partial] /
[planned]**.

### 4.1 Governance tier

#### Orchestrator **[partial — exists as `AdvisorOrchestrator`; LIOS generalizes to multi-domain routing]**

- **Role:** the single entry point for intelligence requests. Classifies intent, selects the agent path,
  enforces ordering (deterministic-first), owns the per-turn telemetry envelope, and guarantees a response
  even on total downstream failure.
- **Inputs:** authenticated `UserContext`, user message or domain request, optional `conversation_id`,
  optional dev `trace` flag.
- **Outputs:** a governed response object (assistant message + structured outcomes + status) and a turn
  telemetry record.
- **Allowed tools:** Relationship Manager, Memory/Context, the LLM agents, Compliance, Critic, Response
  Composer, Audit. (It _coordinates_; it does not compute facts itself.)
- **Forbidden:** writing to the database directly; generating user-facing language itself; bypassing
  Compliance; trusting `user_id` from the request body.
- **Escalation:** any unhandled error → deterministic fallback text + `llm_status=fallback:error`; never an
  exception to the user.
- **Confidence:** N/A (router); it records the confidence reported by leaf agents.
- **Compliance:** must route every LLM output through Compliance before Response Composer.
- **Relationships:** calls every other agent; is called only by surfaces. Is the _only_ agent allowed to
  sequence the others.
- **Maps to:** `app/services/advisor_orchestrator.py` (`converse`, `converse_stream`, `_enhance`, `_finish`).

#### Compliance **[live — `advisor_validator`]**

- **Role:** the deterministic trust gate over every LLM output. Decides accept / repair / reject.
- **Inputs:** the LLM proposal (structured), the bounded context (allowed numbers, real graph pairs,
  rejected goals).
- **Outputs:** `(ok, safe_proposal, reasons)`; `safe_proposal` always has `should_persist=false`, dropped
  rejected goals, facts filtered to `source=user_message`, and only valid graph citations.
- **Allowed tools:** pure functions only (regex, set membership, graph-pair matching). No IO, no LLM.
- **Forbidden:** calling the LLM; network/DB IO; weakening a safety rule to make output pass.
- **Escalation:** on reject → caller uses deterministic fallback. Repeated rejects for a user/turn-type are
  surfaced to Audit as a quality signal.
- **Confidence:** deterministic verdict (not probabilistic).
- **Compliance:** _is_ the compliance authority for output. See `COMPLIANCE_AND_SAFETY_FLOW.md`.
- **Relationships:** invoked by the Orchestrator after every LLM agent and before the Response Composer.
- **Maps to:** `app/services/advisor_validator.py`.

#### Critic **[planned]**

- **Role:** independent adversarial reviewer for high-stakes proposals (e.g. a decision recommendation, a
  cross-domain tradeoff). Tries to **refute** the proposal; defaults to "refuted" when uncertain.
- **Inputs:** the validated proposal + the evidence/citations it relied on.
- **Outputs:** a verdict (`real` / `refuted`, with reason). Majority-refute kills the claim.
- **Allowed tools:** read-only retrieval to check claims; a separate LLM call with a skeptic prompt.
- **Forbidden:** writing; "improving" the proposal (it judges, it does not author).
- **Escalation:** refuted high-stakes claim → drop to a safe, lower-confidence response + Audit flag.
- **Confidence:** emits a refutation confidence; the Orchestrator down-weights accordingly.
- **Compliance:** runs _after_ Compliance, only for flagged high-stakes turns (cost control).
- **Relationships:** optional stage between Compliance and Response Composer.
- **Maps to:** none yet (design in `COMPLIANCE_AND_SAFETY_FLOW.md`).

#### Audit / Observability **[live — turn logging + metrics]**

- **Role:** record one durable, queryable record per agent decision; expose rollups.
- **Inputs:** the per-turn telemetry envelope (status, validator result, repairs, fallback reason, stage
  latencies, tokens, graph edges available, relationships referenced, confidence).
- **Outputs:** `analytics.advisor_turns` rows (service-role only, no PII to logs) + the
  `analytics.advisor_turn_metrics` rollup behind `GET /v1/admin/advisor-metrics`.
- **Allowed tools:** best-effort durable write (non-blocking), structured metadata logging, LLM cost meter.
- **Forbidden:** blocking the request path; putting full message/response/raw output in application logs
  (only the controlled table holds content, service-role only).
- **Escalation:** persistence failure is swallowed (logging still works); never breaks a turn.
- **Confidence:** N/A.
- **Compliance:** privacy — stores only what diagnostics require; RLS service-role only.
- **Relationships:** invoked by the Orchestrator at the end of every turn; read by ops/QA.
- **Maps to:** `advisor_orchestrator._finish` + `_persist`, `analytics` schema, `cost_meter.py`.

### 4.2 Conversation tier

#### Relationship Manager / Advisor **[live]**

- **Role:** two faces of one tier. The **Relationship Manager** is the _deterministic_ engine that owns
  persistence, the safe fallback, and the context panel. The **Advisor** is the _LLM_ that leads the
  conversation within the guardrails (one strong question, why it matters, grounded reflection).
- **Inputs:** user message, pending key, the user's truth + graph + discovery state.
- **Outputs (RM):** persisted candidate/rejected goals, canonical writes, the safe assistant text, the
  context panel. **Outputs (Advisor):** a structured proposal (reflection, one `next_question`,
  `why_this_question`, candidate facts/goals, `relationships_referenced`, `should_persist:false`).
- **Allowed tools (RM):** the deterministic save paths, discovery state. **Allowed (Advisor):** the bounded
  guardrail context, the generation model.
- **Forbidden (Advisor):** writing to the DB; inventing numbers/goals/relationships; giving final
  financial/legal/medical/tax advice; asking more than one question (multi-question is _repaired_, not
  shown); persisting.
- **Escalation:** Advisor unavailable / rejected → RM's deterministic text is served unchanged.
- **Confidence:** Advisor may report a confidence; RM outcomes are certain (they are records of what the
  user said/confirmed).
- **Compliance:** every Advisor turn is gated by Compliance; RM output is safe by construction.
- **Relationships:** the Orchestrator runs RM first, then Advisor, then Compliance, then Composer.
- **Maps to:** `relationship_manager.py`, `advisor_llm.py` (`GeminiAdvisorLLM`, `ADVISOR_SYSTEM`),
  `advisor_context.py`.

#### Onboarding **[live as a flow; LIOS formalizes it as an agent]**

- **Role:** the first-run experience. Chat-native — onboarding _is_ the advisor discovery, not a separate
  wizard. Establishes the initial Life Model (vision, primary objective, domains touched) and the
  onboarding gate (`profiles.setup_completed` / `onboarding_completed`).
- **Inputs:** new user context, the discovery conversation.
- **Outputs:** the seed Life Model facts (as user-stated, confirmable), onboarding completion state, and the
  first Next Best Action.
- **Allowed tools:** Advisor, Goal Discovery, Life Model, the deterministic save paths (via RM).
- **Forbidden:** asking for data the user already gave; fabricating a profile; marking onboarding complete
  without the gate conditions.
- **Escalation:** if discovery stalls, hand to Missing Data to name the highest-value gap.
- **Confidence:** inherits the Advisor's; seed facts are `user_stated`.
- **Compliance:** same gates as the Advisor.
- **Relationships:** a specialization of the Advisor turn with onboarding-specific task prompt + goals.
- **Maps to:** advisor discovery flow (`/v1/life/discovery/*`), `RelationshipManager`, profile gate.

#### Response Composer **[live — `_compose`]**

- **Role:** assemble the final user-facing text from the _validated_ proposal, merging only language while
  preserving all deterministic outcomes. Light, non-semantic cleanup (balance quotes, single question).
- **Inputs:** the validated `safe_proposal` + the deterministic base.
- **Outputs:** the final `assistant_message` (+ display-only fields like `missing_data`,
  `relationships_referenced`).
- **Allowed tools:** string assembly only.
- **Forbidden:** adding any claim, number, or recommendation not already in the validated proposal; calling
  the LLM; writing.
- **Escalation:** empty composition → fallback.
- **Confidence:** N/A (it renders, it does not assert).
- **Compliance:** operates only on already-validated content.
- **Relationships:** last stage before the response leaves the Orchestrator.
- **Maps to:** `advisor_orchestrator._compose`.

### 4.3 Reasoning / Life-Model tier

#### Life Model **[live — `MyLifeService`]**

- **Role:** the canonical aggregation of "who this user is and where they stand" across the six domains —
  vision, what matters most, readiness, constraints, next best action, recent intelligence — each carrying
  provenance.
- **Inputs:** the User Truth Layer + domain summaries + the recommendation ledger.
- **Outputs:** the grounded Life Model object (with provenance blocks and honest `insufficient` states).
- **Allowed tools:** read domain summaries, recommendation engine, truth layer; deterministic aggregation.
- **Forbidden:** inventing risks/opportunities/a north star; emitting a fabricated percentage; surfacing
  archetype/template content as if it were the user's.
- **Escalation:** insufficient data → honest "not started / insufficient" state, never a guess.
- **Confidence:** each element carries source + confidence from its provenance.
- **Compliance:** generic-label gates (no template risks/opps leaking in).
- **Relationships:** read by the dashboard, the Advisor (as context), and reports.
- **Maps to:** `my_life.py`, `life_discovery.py` (`snapshot`).

#### Goal Discovery **[live — within discovery; LIOS names it]**

- **Role:** identify and propose **candidate goals** from the conversation, mapped to a domain, with a
  reason — for the user to confirm. Never auto-creates goals.
- **Inputs:** user messages this session, existing goals, rejected goals, discovery coverage.
- **Outputs:** candidate goals (`title`, `domain`, `reason`, `confidence`) — proposals only.
- **Allowed tools:** Advisor reasoning, discovery coverage.
- **Forbidden:** persisting goals; resurrecting a previously rejected goal; inventing a goal the user did
  not express.
- **Escalation:** ambiguous goal → ask one clarifying question (via Advisor) rather than guess.
- **Confidence:** per-candidate confidence; low confidence ⇒ ask, don't propose.
- **Compliance:** rejected-goal suppression is enforced by Compliance.
- **Relationships:** feeds Goal Conflict and the RM persistence path (on confirmation).
- **Maps to:** `life_discovery.discover_goal`, candidate-goal handling in the validator/RM.

#### Goal Conflict **[partial — dependencies/constraints exist; explicit conflict detection planned]**

- **Role:** detect tensions/tradeoffs _between the user's real goals_ (e.g. liquidity vs. down payment) and
  surface them as questions or framed tradeoffs — only when backed by real graph edges.
- **Inputs:** confirmed goals + the personal graph (connected pairs) + constraints.
- **Outputs:** identified tradeoffs/dependencies with citations; never an instruction on how to resolve them.
- **Allowed tools:** GraphRAG retrieval, deterministic constraint logic.
- **Forbidden:** asserting a relationship without a real edge (citation contract); recommending a resolution
  (that is advice).
- **Escalation:** no supporting edge ⇒ stay single-goal; no conflict claim.
- **Confidence:** edge-backed = high; otherwise not surfaced.
- **Compliance:** the relationship-citation gate in Compliance applies verbatim.
- **Relationships:** consumes Goal Discovery output + GraphRAG; feeds the Advisor's tradeoff questions.
- **Maps to:** `advisor_context` connected pairs + `_check_relationships` in the validator (the citation gate).

#### Missing Data **[partial — `missing_data` field + coverage exist; LIOS formalizes it]**

- **Role:** compute the **highest-value missing inputs** — what, if known, would most improve guidance — and
  name them for THIS question/decision.
- **Inputs:** discovery coverage scores, domain priorities, the current question/decision.
- **Outputs:** ranked `missing_data` items (`field`, `why_it_matters`) — display + routing signal.
- **Allowed tools:** `DiscoveryCoverageService`, domain `missing` envelopes.
- **Forbidden:** fabricating a value for the missing field; persisting.
- **Escalation:** drives the Advisor's next question and Onboarding's next step.
- **Confidence:** N/A (it measures absence).
- **Compliance:** none beyond honest representation.
- **Relationships:** advises the Advisor, Onboarding, and domain agents on what to ask next.
- **Maps to:** `discovery_coverage.py`, `missing_data` in advisor output, domain `missing` field.

### 4.4 Knowledge tier

#### Memory / Context **[live — `AdvisorContextBuilder`]**

- **Role:** assemble the **bounded, read-only guardrail context** handed to every LLM agent: classified
  facts (confirmed vs candidate vs assumption — kept separate), allowed numbers, the real graph edges +
  connected pairs, discovery scores, domain priorities, rejected goals, safety constraints.
- **Inputs:** the user's truth layer + graph + discovery state (concurrent reads).
- **Outputs:** the `AdvisorContext` / `prompt_dict` — the ONLY context the LLM may reason from.
- **Allowed tools:** Supabase reads, GraphRAG retrieval, discovery coverage.
- **Forbidden:** handing raw DB rows or secrets to the LLM; merging fact categories; including numbers not
  the user's own.
- **Escalation:** empty graph ⇒ `relationships_available=false` (advisor must not claim relationships).
- **Confidence:** surfaces per-fact provenance/confidence into the context.
- **Compliance:** the allowed-numbers + real-edges sets it builds are what Compliance later checks against.
- **Relationships:** feeds every LLM agent; sourced from GraphRAG, Document Intelligence, truth layer.
- **Maps to:** `advisor_context.py` (`build`, `prompt_dict`, `connected_pairs`, `allowed_numbers`).

#### GraphRAG **[live — 3-store retrieval + citation contract]**

- **Role:** retrieve the user's **real** knowledge — graph edges (Neo4j), vector-similar evidence (Qdrant),
  relational facts (Supabase) — and return them with provenance so claims can be cited.
- **Inputs:** a query/intent + `user_id`.
- **Outputs:** label-resolved real edges, connections, connected pairs, evidence with `source_table`.
- **Allowed tools:** Neo4j (Aura Query API v2), Qdrant, Supabase, the embedding model.
- **Forbidden:** inventing nodes/edges; returning edges to unknown nodes; crossing tenant boundaries.
- **Escalation:** no edges ⇒ return empty (the advisor then abstains from relationship claims).
- **Confidence:** edges carry a confidence; vectors carry similarity.
- **Compliance:** enforces the citation contract at the source ("no cited edge ⇒ no claim").
- **Relationships:** feeds Memory/Context, Goal Conflict, domain agents, Decision Intelligence.
- **Maps to:** `clients/neo4j_client.*`, `clients/qdrant*`, `advisor_context` graph build, the worker's
  ontology registry; see the 3-store alignment in the semantic-graph work.

#### Document Intelligence **[live — documents schema + extractor]**

- **Role:** turn uploaded documents into structured, cited facts — the data-acquisition layer. Classifies
  document type (26-type taxonomy), extracts fields, links them into the graph as `Document` /
  `DocumentField` nodes with provenance back to the source document.
- **Inputs:** an uploaded document (object store) + `user_id`.
- **Outputs:** `documents` rows, extracted `document_fields`, graph nodes/edges, candidate facts for the
  truth layer.
- **Allowed tools:** parser/extractor, the LLM for extraction (gated), graph + relational writers.
- **Forbidden:** asserting an extracted value as confirmed truth without provenance; persisting a field with
  no source document; cross-tenant access.
- **Escalation:** low-confidence extraction ⇒ candidate fact requiring confirmation, not a confirmed fact.
- **Confidence:** per-field extraction confidence; everything traceable to the source doc.
- **Compliance:** extracted facts enter the truth layer as proposals (provenance `on-record`/`document`),
  not as user-confirmed truth.
- **Relationships:** feeds GraphRAG, the truth layer, domain agents (e.g. a 401k statement → Finance).
- **Maps to:** `documents` schema + Document/DocumentField graph + extractor (Document Intelligence Platform).

### 4.5 Domain tier

The five life domains plus Decision Intelligence share **one contract**. Each is a bounded reasoning agent
over its own data, returning the standard domain envelope (`domain`, `user_id`, `generated_at`, `freshness`,
`confidence`, `data`, `recommendations`, `missing`). All are **[live] as summary services; LIOS formalizes
their reasoning-agent role.**

**Shared domain-agent contract:**

- **Role:** summarize the user's state in the domain, surface evidence-backed recommendations, and name
  missing inputs — grounded only in the user's data.
- **Inputs:** the user's domain data (Supabase), relevant documents, GraphRAG context.
- **Outputs:** the domain envelope (state + recommendations + missing + confidence + freshness).
- **Allowed tools:** domain calculators/resolvers, GraphRAG, the Recommendation engine (evidence-or-nothing),
  the LLM for explanation (gated).
- **Forbidden:** final advice ("you should buy/sell/invest…"); invented figures; recommendations without
  evidence; writing outside approved paths.
- **Escalation:** insufficient data ⇒ honest empty state + a `missing` list (no guess).
- **Confidence:** per-summary + per-recommendation confidence.
- **Compliance:** the advice/medical/legal/tax boundary applies; finance carries the "not financial advice"
  disclaimer, family/estate the "not legal advice" boundary.
- **Relationships:** read by Life Model, Advisor (as context), Decision Intelligence, reports.

| Domain agent              | Specifics                                                                                                                                                                                    | Maps to                                                                                            |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Finance**               | net worth, cash flow, debt, investments, retirement projection; Plaid + manual + document sources; APR config-sourced                                                                        | `/v1/finance/*`, `FinancialInputResolver`, `CompensationBenefitsEngine`, canonical finance summary |
| **Family**                | members, pets, guardianship, estate/trust/beneficiary readiness, survivor planning                                                                                                           | `/v1/family/*`, family-office overview                                                             |
| **Career**                | compensation, market position, growth                                                                                                                                                        | `/v1/career/*`                                                                                     |
| **Education**             | planning, comparison, ROI framing (not advice)                                                                                                                                               | `/v1/education/*`                                                                                  |
| **Health**                | readiness signals (privacy-sensitive; no diagnosis ever)                                                                                                                                     | `/v1/health/*`, `/v1/life/health`                                                                  |
| **Decision Intelligence** | scenario compare, decision brain; returns `calculation_trace` / `tool_calculations` so every number is traceable; never returns "the answer," returns the modeled tradeoffs + missing inputs | decision brain / scenario compare                                                                  |

### 4.6 Execution tier

#### Tool Execution **[live as engines; LIOS formalizes the boundary]**

- **Role:** run **deterministic** calculations, resolvers, and approved writes on behalf of agents. This is
  the only tier (besides RM/RecommendationOS) permitted to mutate data, and only through approved paths.
- **Inputs:** a typed tool request from an agent (calculate X, resolve Y, write Z-after-confirmation).
- **Outputs:** a typed result with a calculation trace; or a write receipt.
- **Allowed tools:** finance calculators, resolvers, the recommendation writer, domain writers, the graph/
  vector writers.
- **Forbidden:** running an LLM; performing a write the LLM "requested" without a deterministic
  confirmation/precondition; unbounded or untyped operations.
- **Escalation:** precondition failure ⇒ return an error to the calling agent, never a silent partial write.
- **Confidence:** deterministic results are exact; it reports assumptions used.
- **Compliance:** every write carries provenance + source; see `TRUTH_AND_PROVENANCE_MODEL.md`.
- **Relationships:** invoked by domain/decision agents and by RM/RecommendationOS for writes.
- **Maps to:** finance engines, `recommendations_os.py` (`RecommendationOS.write`), domain writers,
  `cost_meter.py` for LLM metering.

---

## 5. The four prompt layers (every LLM agent)

Every LLM-backed agent receives a **composed prompt** assembled from four layers (full spec in
`PROMPT_OPERATING_SYSTEM_PLAN.md`):

1. **Base Constitution** — the invariants in §1, identical for every agent (no fabrication, never write,
   evidence-or-nothing, citation contract, honest empty states, advice boundaries).
2. **Subsystem prompt** — the agent's tier behavior (e.g. "you are a discovery agent; lead, ask exactly one
   question; you propose, you never persist").
3. **Domain prompt** — domain knowledge + boundaries (e.g. Finance: how to frame numbers, the not-advice
   line; Health: never diagnose).
4. **Task prompt** — the specific turn: the bounded context (`prompt_dict`), the user message, the plan/
   constraints, and the required structured output schema.

The live advisor today is a single `ADVISOR_SYSTEM` (`advisor-hybrid-2.2.0`) that already encodes layers
1–3 inline; LIOS factors these into reusable layers so every agent inherits the constitution and so prompts
are versioned and governed centrally.

---

## 6. Mapping LIOS to today (so no one over-claims)

| LIOS agent                             | Today                                                                       |
| -------------------------------------- | --------------------------------------------------------------------------- |
| Orchestrator                           | `AdvisorOrchestrator` (discovery only) → generalize to multi-domain routing |
| Relationship Manager / Advisor         | **live** (hybrid advisor 2.2.0, streaming)                                  |
| Onboarding                             | **live** as the discovery flow → formalize as an agent                      |
| Life Model                             | **live** (`MyLifeService`)                                                  |
| Goal Discovery                         | **live** within discovery                                                   |
| Goal Conflict                          | **partial** (dependencies/constraints + citation gate)                      |
| Missing Data                           | **partial** (`missing_data` + coverage)                                     |
| Memory / Context                       | **live** (`AdvisorContextBuilder`)                                          |
| Tool Execution                         | **live** engines → formalize the typed boundary                             |
| Audit / Observability                  | **live** (turn log + metrics)                                               |
| Compliance                             | **live** (`advisor_validator`)                                              |
| Critic                                 | **planned**                                                                 |
| Response Composer                      | **live** (`_compose`)                                                       |
| Finance/Family/Career/Education/Health | **live** summary services → formalize reasoning-agent contract              |
| Document Intelligence                  | **live** (documents platform)                                               |
| Decision Intelligence                  | **live** (decision brain / scenario compare)                                |
| GraphRAG                               | **live** (3-store + citation contract)                                      |

---

## 7. Definition of done (for the architecture phase)

A new engineer, after reading these six documents, can answer:

- How does a request become a governed response? (§3 + interaction diagram)
- Which agents exist, what may each do, and what may each never do? (§4)
- Where does truth come from and how is it persisted safely? (truth + data-flow docs)
- How is the user protected from hallucination and bad advice? (compliance doc)
- How is every agent's behavior shaped and versioned? (prompt-OS doc)
- What is real today vs. what LIOS adds? (§6)

No implementation, no Vertex, no Claude, no changes to beta surfaces — this is the blueprint that precedes
prompts and code.
