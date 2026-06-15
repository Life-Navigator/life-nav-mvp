# Prompt Conflict Audit

> Checks the Prompt OS for contradictions, role overlap, unsafe autonomy, and the anti-fabrication
> invariants. Validation — no code. Method: cross-read every prompt + a positive-claim sweep (excluding
> negatives) over the whole directory.

---

## 1. Audit checklist

| Check                                                      | Result                       | Evidence                                                                                                                                      |
| ---------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Contradiction between prompts                              | ✅ none                      | every prompt opens with "operate under the Constitution + all base rules; nothing below overrides them" — base wins by construction           |
| Role overlap                                               | ✅ none                      | each prompt's ownership maps 1:1 to its agent spec §2; see the coverage matrix ownership                                                      |
| Unsafe autonomy                                            | ✅ none                      | no prompt authorizes user-facing output except the Response Composer (post-Compliance); no prompt self-routes                                 |
| **Direct database-write permission**                       | ✅ none (1 by-design writer) | only `RELATIONSHIP_MANAGER_PROMPT` (deterministic approved writer) sets `should_persist:true`, via approved paths — see §2                    |
| Domain agents answering users                              | ✅ none                      | every domain prompt forbids facing the user; output routes through Compliance → Composer                                                      |
| Recommendation generation outside the Recommendation Agent | ✅ none                      | only the Recommendation role (in DECISION_INTELLIGENCE) mints; all others say "no recommendation creation / escalate to Recommendation Agent" |
| Risk generation without evidence                           | ✅ none                      | domain prompts require evidence-backed risks/opps (evidence-or-nothing); LLM never mints risks                                                |
| GraphRAG edge fabrication                                  | ✅ none                      | every graph-touching prompt enforces the citation contract; no prompt creates edges                                                           |
| Missing compliance routing                                 | ✅ none                      | ORCHESTRATOR_PROMPT mandates Compliance before the Composer on every user-facing path                                                         |

**Overall: no conflicts. The Prompt OS is internally consistent and safe.**

## 2. The one intentional "write" — clarified (not a violation)

The positive-claim sweep surfaced `should_persist: true` only in `RELATIONSHIP_MANAGER_PROMPT`. This is
**correct by design**, not a conflict:

- The Relationship Manager is the **deterministic approved writer** for conversational state (confirmed
  goals/vision/rejected goals). It is one of the three approved writers (with RecommendationOS and the
  domain writers) and it persists only **confirmed** state, via approved paths, through Tool Execution.
- Every **LLM** agent (Advisor, Onboarding, domains, decision agents) forces `should_persist: false`. The
  distinction — deterministic writer persists confirmed state; LLM never persists — is exactly the
  architecture's first principle, not a contradiction.

No other prompt claims a write. No LLM prompt claims persistence.

## 3. Boundary cross-checks (spot audit)

| Potential overlap               | Resolution in the prompts                                                                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Advisor vs Onboarding           | Onboarding _specializes_ the Advisor for first-run (seed Life Model + gate); same 15-section behavior, no duplication of authority             |
| Advisor vs Relationship Manager | Advisor = LLM proposer (no writes); Relationship Manager = deterministic writer + safe floor. Two faces, one tier, disjoint authority          |
| Domains vs Recommendation Agent | domains _surface_ evidenced risks/opps + state; only the Recommendation Agent _mints_ recommendations                                          |
| Decision agents vs Domains      | domains provide facts/state; Decision Scientist _frames_; Scenario _models_ (Tool Execution); Tradeoff _compares_; none decides                |
| Compliance vs Critic            | Critic refutes high-stakes claims (before Compliance); Compliance is the deterministic gate authority. Sequential, not overlapping             |
| Memory vs GraphRAG              | Memory assembles the bounded context (may call GraphRAG, read-only); GraphRAG retrieves real edges/evidence. Memory composes; GraphRAG fetches |
| Response Composer vs Advisor    | Advisor proposes language (gated); Composer renders the _validated_ text. Only the Composer faces the user                                     |

## 4. Unsafe-autonomy scan (explicit prohibitions verified present)

Every prompt that could be dangerous carries the matching prohibition:

- No prompt lets an LLM compute a financial number in prose (Tool Execution + allowed-numbers).
- No prompt lets an LLM assert a relationship without a cited edge (citation contract).
- No prompt lets an agent call another agent directly (escalate via Orchestrator).
- No prompt lets a domain/decision agent face the user (Composer-only, post-Compliance).
- The two regulated SAFETY tasks (medical, tax/legal) are refusal-first (block clinical/tax/legal
  directives; frame + refer).

## 5. Residual notes (not conflicts)

- Goal Discovery / Goal Conflict behavior is embedded rather than in dedicated files (see coverage matrix);
  no conflict, but a future split would make their boundaries more explicit.
- The 5 decision agents share `DECISION_INTELLIGENCE_PROMPT`; the Recommendation Agent's evidence-or-nothing
  boundary is stated there and in `RECOMMENDATION_AGENT.md` — a dedicated prompt could harden it further.

## Verdict

No contradictions, no role overlaps, no unsafe autonomy, no unauthorized writes, no recommendation/risk/edge
fabrication paths, no missing compliance routing. The Prompt OS is safe to take into the orchestration phase
once reviewed.
