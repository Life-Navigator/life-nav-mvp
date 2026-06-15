# Memory Agent — Specification

> Agent specification. Specification only — no code, no prompts, no runtime. Inherits the shared contracts
> (`AGENT_FAILURE_BEHAVIOR.md`, `AGENT_CONFIDENCE_MODEL.md`, `AGENT_ESCALATION_MODEL.md`,
> `AGENT_INTERACTION_CONTRACTS.md`, `AGENT_OUTPUT_SCHEMAS.md`). **DETERMINISTIC, LIVE** as the
> `AdvisorContextBuilder`. Maps to `app/services/advisor_context.py` (`build`, `prompt_dict`).

---

## 1. Identity

- **Agent Name:** Memory (Advisor Context Builder)
- **Mission:** Assemble the bounded, read-only guardrail context that every LLM agent reasons inside — so the
  LLM leads but can only ground in the user's real, classified truth.
- **Purpose:** Be the deterministic gatekeeper of context: pull the user's facts (kept in SEPARATE buckets —
  confirmed vs candidate vs assumption), the user's own `allowed_numbers`, their REAL graph edges +
  `connected_pairs`, discovery scores, domain priorities, rejected goals, safety constraints, and a
  `relationships_available` flag — and hand them out as one typed, bounded object. Nothing leaves except
  what an LLM is allowed to see.
- **Primary Responsibilities:**
  1. Retrieve and classify the user's facts into separate buckets (never merged).
  2. Build the `allowed_numbers` set — only the user's own numbers — that Compliance later checks against.
  3. Surface the user's real relationship edges + `connected_pairs` (via GraphRAG) with provenance.
  4. Include discovery scores, domain priorities, rejected goals, and safety constraints.
  5. Emit one bounded, read-only `bounded_context` envelope; never write; never reveal raw rows or secrets.

---

## 2. Ownership

**Owns:**

- the bounded, read-only context object handed to every LLM agent
- the classification of facts into confirmed / candidate / assumption buckets
- the `allowed_numbers` set (the user's own numbers) — the basis Compliance checks against
- the assembled real-edge set + `connected_pairs` + `relationships_available` flag
- discovery scores, domain priorities, rejected goals, and safety constraints as packaged context

**Does NOT own:**

- the truth of facts themselves (owned by the truth layer / writers via Tool Execution)
- creating or persisting edges (→ GraphRAG read; projection/sync is separate)
- recommendations (→ Recommendation Agent)
- user-facing language (→ Response Composer)
- calculations (→ Tool Execution)
- compliance verdicts (→ Compliance)

---

## 3. Boundaries (prohibited)

- Cannot write anything — Memory is strictly read-and-assemble.
- Cannot hand raw DB rows or any secret/credential to the LLM (only the bounded, typed projection).
- Cannot merge fact categories — confirmed, candidate, and assumption buckets stay separate, always.
- Cannot include a number that is not the user's own in `allowed_numbers` (no derived/illustrative numbers).
- Cannot include an edge to an unknown node or a fabricated relationship (real edges only).
- Cannot answer the user directly or call another agent directly.
- Cannot cross tenants — context is scoped to the JWT `user_id` (RLS).

---

## 4. Inputs (allowed sources)

- User Truth Layer (classified facts with provenance) — read.
- GraphRAG (the user's real edges, connections, `connected_pairs`) — read-only referral.
- Discovery state (scores, domain priorities, rejected goals) — read.
- Safety constraints registry (the user's stated constraints/limits) — read.
- The authenticated `UserContext` (JWT-derived `user_id`) for tenant scoping.

---

## 5. Outputs (schema)

Wrapped in the common envelope (`AGENT_OUTPUT_SCHEMAS.md`); the Memory `payload`:

```json
{
  "bounded_context": {
    "classified_facts": {
      "confirmed": [
        { "label": "", "value": "", "provenance_type": "", "source": "", "confidence": 0.0 }
      ],
      "candidate": [
        { "label": "", "value": "", "provenance_type": "", "source": "", "confidence": 0.0 }
      ],
      "assumption": [
        { "label": "", "value": "", "provenance_type": "", "source": "", "confidence": 0.0 }
      ]
    },
    "numbers_you_may_reference": [{ "label": "", "value": 0.0, "source": "" }],
    "relationship_edges": [{ "from": "", "to": "", "rel": "", "edge_confidence": 0.0 }],
    "connected_pairs": [{ "a": "", "b": "" }],
    "discovery_scores": {},
    "domain_priorities": [{ "domain": "", "rank": 1 }],
    "rejected_goals": [{ "title": "", "reason": "" }],
    "relationships_available": false,
    "safety_constraints": [{ "label": "", "value": "" }]
  }
}
```

`numbers_you_may_reference` (= `allowed_numbers`) contains only the user's own numbers; `relationship_edges`
contains only real cited edges. These two sets are exactly what Compliance later enforces against.

---

## 6. Cognitive Framework (how it reasons)

```
Step 1  Bind tenant            — take user_id from the JWT; scope every read (RLS).
Step 2  Retrieve facts         — pull the user's facts from the truth layer with provenance.
Step 3  Classify into buckets  — split into confirmed / candidate / assumption; NEVER merge.
Step 4  Build allowed_numbers  — extract only the user's own numbers; nothing derived or illustrative.
Step 5  Retrieve real edges    — ask GraphRAG for real edges + connected_pairs; set relationships_available.
Step 6  Attach discovery state — scores, domain_priorities, rejected_goals.
Step 7  Attach safety          — safety_constraints the LLM must respect.
Step 8  Bound + redact         — drop raw rows/secrets; emit only the typed projection.
Step 9  Report confidence      — input quality of the assembled context (deterministic; no fabrication).
```

The agent **assembles** the guardrail; it never reasons over content, never computes, never writes.

---

## 7. Tool Rules

- **Allowed:** read the truth layer; referral-read to GraphRAG for real edges/connections.
- **Required:** tenant scoping on every read; bucket separation; redaction of raw rows + secrets before emit.
- **Forbidden:** any DB write; any LLM call; including derived/illustrative numbers; merging fact categories.

---

## 8. GraphRAG Rules

- **May:** request the user's real edges, connections, and `connected_pairs` (read-only) and pass them
  through with provenance + `edge_confidence`.
- **May not:** create, infer, or persist edges; include an edge to an unknown node; set
  `relationships_available: true` when no real edges exist (then it is `false` and the advisor abstains).

---

## 9. Memory Rules

- **Can access:** the user's classified facts, allowed numbers, real edges, discovery scores, priorities,
  rejected goals, and safety constraints — all read-only, all tenant-scoped.
- **Cannot access:** another tenant's data, raw DB rows beyond the bounded projection, or any secret. It is
  the producer of bounded context; it never persists or mutates memory.

---

## 10. Confidence Model

Uses the global formula (`AGENT_CONFIDENCE_MODEL.md`) with Memory weights (deterministic assembly — reports
the _quality of the context it assembled_, not a claim):

| Weight                   | Value                  | Rationale                                               |
| ------------------------ | ---------------------- | ------------------------------------------------------- |
| wDC (data completeness)  | 0.45                   | the whole job is "how complete is the user's context?"  |
| wPQ (provenance quality) | 0.30                   | confirmed > candidate > assumption drives context trust |
| wGC (graph)              | 0.15 (N/A if no edges) | only counts when real edges are included                |
| wEC (evidence coverage)  | 0.10                   | facts carry their own provenance; coverage is light     |
| wTA (tool availability)  | usually N/A            | assembly uses reads, not deterministic calculators      |

`confidence = renormalize(0.45·DC + 0.30·PQ + 0.15·GC + 0.10·EC)` with TA dropped (N/A) and GC dropped when
no edges exist. No `success` below 0.75; a near-empty context is reported honestly (low DC) rather than
padded — the assembly succeeds even when the user is thin, but its confidence reflects that thinness.

---

## 11. Escalation Rules (via Orchestrator)

| Trigger                                | → To                         |
| -------------------------------------- | ---------------------------- |
| Needs real edges/connections           | GraphRAG (read)              |
| Needs structured facts from a document | Document Intelligence (read) |
| A required source store is unreachable | `blocked` (not escalation)   |

Memory is largely a leaf provider; it rarely escalates. Uncertainty about completeness is reported as low DC,
not an escalation. It never escalates to itself and never resolves domain questions.

---

## 12. Failure Behavior

Standard states (`AGENT_FAILURE_BEHAVIOR.md`):

- `success` — bounded context assembled; buckets separated; allowed_numbers + real edges set.
- `needs_data` — effectively empty context; reports the user has no usable facts yet (honest empty state).
- `needs_confirmation` — N/A for Memory itself (it carries candidates, but confirmation is the advisor's turn).
- `blocked` — a source store (truth layer / graph) is unreachable; safe stop, deterministic fallback context.
- `escalated` — rare; only to GraphRAG/Doc Intel for reads.
- `compliance_rejected` — set after the gate if the projection ever leaked a non-allowed number/raw row.
  No guessing — a thin user yields a thin-but-honest context, never invented facts or numbers.

---

## 13. Compliance Requirements

- Allowed-numbers integrity: `numbers_you_may_reference` contains only the user's own numbers — this is the
  set Compliance enforces every downstream claim against.
- Bucket separation: confirmed / candidate / assumption are never merged (a candidate must never appear as
  confirmed truth).
- Real-edges-only: `relationship_edges` are real cited edges; `relationships_available` is truthful.
- No raw rows / no secrets ever cross into the LLM-visible projection.
- No persistence; tenant isolation (RLS) on every read.

---

## 14. Example Scenarios

**Positive (5):**

1. Data-rich user: confirmed facts + allowed_numbers + several real edges + `relationships_available:true` →
   `success`, high DC/PQ.
2. User with confirmed income but a candidate balance from a document → both buckets populated separately;
   candidate not promoted → `success`.
3. User with real home↔savings edge → edge included with `edge_confidence`; advisor may cite it.
4. User who rejected a "buy a boat" goal → `rejected_goals` carries it so the advisor won't re-surface it.
5. Brand-new user → near-empty context returned honestly with low DC → `needs_data`.

**Negative (5) — must NOT happen:**

1. Merging a candidate balance into the confirmed bucket (→ forbidden; buckets stay separate).
2. Adding an illustrative "$1M retirement target" the user never stated into allowed_numbers (→ forbidden).
3. Handing a raw `financial_accounts` row (with account tokens) to the LLM (→ forbidden; redact).
4. Setting `relationships_available:true` with zero real edges (→ forbidden; advisor would over-claim).
5. Returning another tenant's facts because of an unscoped read (→ RLS violation).

**Edge cases (5):**

1. Truth layer up but graph store down → facts returned, `relationships_available:false`, note the gap.
2. A fact has conflicting confirmed + candidate values → keep BOTH in their buckets; do not pick.
3. Discovery scores absent → omit the field; do not fabricate scores.
4. A number appears only inside a document candidate → it is a candidate, NOT yet an allowed_number.
5. Empty everything → honest empty context, `needs_data`, advisor abstains rather than invents.

---

## 15. Unit Test Matrix

| Class           | Test                      | Expected                                                                        |
| --------------- | ------------------------- | ------------------------------------------------------------------------------- |
| Happy path      | data-rich user            | `success`; three buckets separate; allowed_numbers = user's own; real edges set |
| Missing data    | brand-new user            | `needs_data`; honest empty context; no fabricated facts/numbers                 |
| Separation      | candidate balance present | candidate bucket only; never appears as confirmed                               |
| Allowed-numbers | only user numbers         | allowed_numbers excludes every derived/illustrative value                       |
| Graph           | zero real edges           | `relationships_available:false`; `relationship_edges` empty                     |
| Graph           | real edge present         | edge carries `edge_confidence`; available flag true                             |
| Security        | raw row / secret          | never present in the bounded projection (redacted)                              |
| Security        | cross-tenant read         | only JWT `user_id` data returned (RLS)                                          |
| Block           | graph store down          | `blocked` or facts-only with available=false; safe fallback context             |
| Confidence      | components present        | DC/PQ (+GC if edges, EC light, TA n/a) + explanation; no `success` <0.75        |
