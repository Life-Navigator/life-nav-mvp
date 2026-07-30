# Multi-Agent Semantic Architecture

**Status:** Designed · **Date:** 2026-07-30 · Parent: `SEMANTIC_PLATFORM_ARCHITECTURE.md`

Covers brief Phases 10 and 14. **Hard-blocked on C-2** — see §1.

---

## 1. The blocking dependency

> _"Every agent should operate under explicit semantic permissions. No agent should infer unrestricted
> graph access."_

This is not implementable today, and the reason is structural rather than incidental.

`relationship_catalog.rs` declares `permitted_contexts` and `permitted_principals` (150 sites). The
exported manifest carries **neither**. The Python planner — the tier that serves retrieval — reads a
single boolean meaning _personal-advisor-traversable_.

Therefore: **any second agent consuming the current manifest inherits the personal advisor's
permissions.** There is no field in which to express a different answer. A compliance agent, a provider
agent, and a support tool would all read `traversable: true` and all receive identical access.

The system currently has one principal, so this is latent rather than active. **It becomes a breach the
day a second agent ships.** Adding agents before fixing the export is adding principals to a system
with no concept of a principal.

**Nothing in this document may be built before `SEMANTIC_GOVERNANCE.md` §7 steps 1–2 land.**

---

## 2. The graph as shared memory

The graph is the substrate agents share; it is **not** a message bus. Agents communicate by making
assertions with provenance, and every assertion records which agent made it (`asserted_by`).

This has a property that matters more than it first appears: **inter-agent communication is
automatically auditable**, because it is indistinguishable from ordinary knowledge writing. There is no
separate channel to instrument, no side path that escapes provenance. An agent that wants to tell
another agent something must write an assertion, and that assertion is governed like any other.

The corollary is a prohibition: **no agent may pass unattributed context to another agent.** If it
matters enough to share, it matters enough to attribute.

---

## 3. Principals and capability grants

```rust
pub struct AgentPrincipal {
    agent_id:        AgentId,
    agent_class:     AgentClass,          // planner | retrieval | compliance | domain | workflow | simulation
    permitted_domains:      &[Domain],
    permitted_contexts:     &[Context],
    permitted_actions:      &[Action],    // traverse | cite | reason_over | export | mutate
    permitted_privacy:      &[PrivacyClass],
    max_traversal_depth:    u8,
    max_node_budget:        u32,
    may_write_assertions:   bool,
    may_approve_mutations:  bool,         // almost always false — see §5
}
```

Every field defaults to **empty/false**. A grant is enumerated, never inherited, never wildcarded.
There is no `*` and no "all domains" — an agent needing every domain lists every domain, which makes
the grant visible in review rather than hidden behind a glyph.

### 3.1 Proposed agent roster

| Agent      | Domains           | Actions                     | Privacy classes     | Notes                                  |
| ---------- | ----------------- | --------------------------- | ------------------- | -------------------------------------- |
| Planner    | all               | traverse                    | metadata only       | plans; never reads content             |
| Retrieval  | per request       | traverse, cite              | per request         | executes plans                         |
| Compliance | all               | traverse, reason_over       | all incl. PHI/LEGAL | **never** cite to end users            |
| Legal      | legal, family     | traverse, cite              | LEGAL, FAMILY       | citation requires reviewed provenance  |
| Financial  | financial         | traverse, cite, reason_over | FINANCIAL           | no PHI                                 |
| Health     | health            | traverse, cite, reason_over | PHI                 | **no FINANCIAL** — see §4              |
| Career     | career, education | traverse, cite, reason_over | PII                 |                                        |
| Education  | education         | traverse, cite, reason_over | PII                 |                                        |
| Provider   | provider          | traverse, cite              | PROVIDER            | **never personal**                     |
| Workflow   | per workflow      | traverse, mutate (gated)    | per workflow        | approval-gated writes only             |
| Simulation | per scenario      | traverse, reason_over       | per scenario        | hypothetical overlays, never persisted |

**The Planner reading metadata only** is deliberate: a planner needs the _shape_ of available knowledge
(which domains, which relationship types, how many hops) to plan, not the content. This is the
least-privilege reading of what planning actually requires, and it means the highest-frequency agent
holds the weakest grant.

---

## 4. Cross-domain isolation

Health agents must not read financial data and vice versa — not because of a technical constraint, but
because cross-domain inference over sensitive classes is where the most damaging inferences live
(medical condition inferred from pharmacy transactions; employment risk inferred from health decline).

Cross-domain reasoning is a **capability, not a default**. It requires:

1. an explicit grant naming both domains,
2. a declared purpose recorded on every resulting assertion,
3. `inference_status = derived` so the conclusion is never mistaken for an observation,
4. an audit entry.

The general-purpose personal advisor legitimately needs cross-domain reasoning — that is the product.
It receives that grant explicitly, with the audit trail that comes with it, rather than by default.

---

## 5. Mutation

`may_approve_mutations` is false for essentially every agent. The established pattern — approval-gated
life-change actions writing through the ingestion service, never silently — is correct and generalizes.

Rules:

1. Agents **propose**; humans (or an explicitly authorized workflow) **approve**.
2. Every applied mutation is an assertion with `asserted_by` = the proposing agent **and** the
   approving principal. Both are recorded; neither is inferred.
3. No agent may approve its own proposal. Ever.
4. Mutation proposals derived solely from third-party document content are refused — the
   privileged-sink rule already established for injection defense.

**Rule 3 is the one that prevents autonomous drift.** An agent that can propose and approve is an agent
that can rewrite the knowledge base unattended, and the provenance trail will faithfully record that it
was authorized.

---

## 6. Protocol readiness (brief Phase 14)

| Protocol                       | Readiness                                                                             | Gap                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **MCP**                        | Partial — a schema/provenance/tenant-enforced MCP server exists with submission tools | Needs the principal model above; today it enforces tenant, not principal                     |
| **A2A**                        | Not ready                                                                             | No agent identity, no capability grants, no inter-agent audit — all defined here, none built |
| **Tool calling**               | Ready                                                                                 | Retrieval and submission surfaces are already tool-shaped                                    |
| **Reasoning/planning models**  | Blocked on measurement                                                                | Needs the retrieval baseline before any planner can be evaluated                             |
| **Simulation / digital twins** | Blocked on temporal                                                                   | Counterfactuals require `as_of` + hypothetical overlays (`TEMPORAL_MODEL.md` §4.1)           |
| **Autonomous workflows**       | Blocked on policy                                                                     | Requires §5 mutation gating enforced, not conventional                                       |

**The honest summary:** the platform is well positioned for MCP-style tool exposure and poorly
positioned for agent-to-agent autonomy. The gap is not model capability or orchestration
infrastructure — it is that **agent identity does not exist as a concept in the serving tier**. Every
Phase 14 capability reduces to the same prerequisite as Phase 10.

---

## 7. Per-recommendation assessment

**Principal model + capability grants**
_Benefit:_ makes multi-agent operation safe and auditable; unblocks every Phase 14 item.
_Complexity:_ Medium — the model is straightforward; threading principal through retrieval is the work.
_Risk:_ Medium — a policy bug denies legitimate access (outage) or grants illegitimate access (breach).
Mitigated by shadow mode (`SEMANTIC_GOVERNANCE.md` §7 step 5).
_Scalability:_ grants are static data, cacheable, negligible cost at any scale.
_Evaluation:_ per-agent access matrix property-tested; every agent × every privacy class × every action
asserted explicitly, so a widened grant fails a test rather than passing silently.
_Migration:_ define the personal advisor as principal #1 with exactly today's effective permissions;
verify zero behavioural change; then add agents.
_Rollback:_ single principal, current behaviour.
_Enterprise value:_ "which agent accessed which data, under what authority, when" is the first question
in any enterprise security review. This is the answer.
_Extensibility:_ new agent = new grant row. No code change.

---

## 8. Evaluation

| Metric                                | Gate                                                         |
| ------------------------------------- | ------------------------------------------------------------ |
| Agents with wildcard grants           | **0 — hard gate**                                            |
| Agents with undeclared privacy access | **0 — hard gate**                                            |
| Self-approved mutations               | **0 — hard gate**                                            |
| Cross-domain inference without grant  | **0 — hard gate**                                            |
| Provider→personal traversal           | **0 — hard gate**                                            |
| Unattributed inter-agent context      | **0 — hard gate**                                            |
| Per-agent denial rate                 | baseline + anomaly alert                                     |
| Grant/usage divergence                | grants never exercised — flagged for least-privilege pruning |

The last one closes the loop: a grant that is never used is over-provisioning, and finding it
automatically is how least privilege stays true after the first review.
