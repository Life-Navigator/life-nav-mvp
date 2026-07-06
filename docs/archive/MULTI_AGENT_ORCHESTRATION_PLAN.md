# MULTI-AGENT ORCHESTRATION PLAN

**Date:** 2026-06-07 · **Status:** DESIGN ONLY. Runs inside `lifenavigator-core-api` (`app/agents/`). Builds on the existing governance stack + `agent-registry.ts` (advisor.core, optimizer.dynamic_goal, arcana.\*).

---

## 1. Agent roster (12)

| Agent                    | Role                                                 | Backed by today               | Reads                              | Emits                              |
| ------------------------ | ---------------------------------------------------- | ----------------------------- | ---------------------------------- | ---------------------------------- |
| **Life Orchestrator**    | intent classification, domain routing, fan-out/merge | arcana.orchestrator (pattern) | —                                  | routes + final synthesis           |
| **Finance Agent**        | money reasoning                                      | advisor.core (split)          | finance._ + :Finance_ graph        | facts, recs, narratives            |
| **Health Agent**         | wellness coaching (non-clinical)                     | arcana.health/longevity       | health_meta.\*                     | gated wellness recs                |
| **Career Agent**         | trajectory, skills, comp                             | (new)                         | career.\*                          | career recs                        |
| **Family Agent**         | household, protection                                | (new)                         | family.\*                          | family recs (legal/tax escalation) |
| **Education Agent**      | learning ROI                                         | (new)                         | education.\*                       | education recs                     |
| **Goal Agent**           | feasibility, probability, milestones                 | optimizer.dynamic_goal        | goals.\* + :Goal                   | probability, on-track              |
| **Risk Agent**           | tolerance, exposure, mitigation                      | (new)                         | risk_assessments + :RiskAssessment | risk flags                         |
| **Scenario Agent**       | what-if, decision analysis                           | (new)                         | scenario\_\*/:LifeScenario         | scenario outputs                   |
| **Recommendation Agent** | cross-domain rec synthesis + ranking                 | recommendations.ts (promote)  | all domain recs                    | ranked H-contract list             |
| **Memory Agent**         | conversation + preference memory                     | chat.\* (exists)              | chat.conversations/messages        | retrieved context, persistence     |
| **Trust/Safety Agent**   | governance + character + injection + boundary gate   | governance/\* (exists)        | candidate output                   | pass/block + audit                 |

Each agent is a `DomainService`-aware reasoning unit; none calls Gemini directly without passing through Trust/Safety.

---

## 2. Orchestration flow (canonical)

```
User question
   ▼
Life Orchestrator
   ├─ intent classification (which domain(s)? read vs advise vs simulate?)
   ├─ Memory Agent: retrieve conversation + preferences
   ▼
Fan-out to relevant Domain Agent(s)  [parallel]
   each Domain Agent:
      ├─ Supabase authoritative facts (system of record)
      ├─ Personal GraphRAG (Qdrant + Neo4j, user-scoped)
      └─ Central GraphRAG (ln_central methodology/governance)  [Phase 8]
   ▼
Evidence packet  (facts + missing_facts + graph_evidence + freshness + confidence)
   ▼
Recommendation Agent  (rank, dedupe, resolve cross-domain conflicts)
   ▼
Trust/Safety Agent  (constitutional + character + injection + domain boundaries
                     e.g. medical/legal/financial-advice disclaimers; red-flag escalation)
   ▼  (only on pass)
Gemini  (reason over the gated evidence packet → natural-language answer)
   ▼
Trust/Safety  (re-check generated text; buffer-then-release, no stream bypass)
   ▼
Persistence  (Memory Agent → chat.*; audit → governance.decision_governance_audit)
   ▼
Response + dashboard/update suggestions (e.g. "I logged this as a goal — review?")
```

**Two gate points:** before generation (evidence/boundary check) and after generation (output check). Mirrors today's `governed-route` buffer-then-release.

---

## 3. Evidence packet contract (agent ↔ orchestrator)

```jsonc
EvidencePacket = {
  "intent": "afford_purchase",
  "domains": ["finance","goals","risk"],
  "authoritative_facts": [ { "fact","value","source":{system,table} } ],
  "missing_facts": ["..."],
  "graph_evidence": [ { "label","entity_id","score" } ],
  "domain_findings": { "finance": {...}, "risk": {...} },
  "candidate_recommendations": [Recommendation],
  "freshness": Freshness, "confidence": Confidence
}
```

Trust/Safety decorates each recommendation with its governance verdict (the H-contract `governance` field). Gemini is prompted ONLY with the gated packet — never raw cross-user data, never ungated content.

---

## 4. Build phasing (maps to `IMPLEMENTATION_SEQUENCE_TO_FULL_PLATFORM.md`)

- **Now (already live):** advisor.core + optimizer + arcana.\* + the governance/constitutional/character/injection gate (Trust/Safety Agent foundation).
- **Phase 2–3:** Finance Agent + Recommendation Agent + Memory Agent behind `/v1/chat`.
- **Phase 4–7:** add Health/Career/Family/Education Agents as each domain lands.
- **Phase 9:** Life Orchestrator does true multi-domain fan-out/merge; Risk + Scenario Agents formalized.

**Invariant:** an agent ships only after its domain's data pipeline (tables+enum+triggers+`:Unknown`=0) is verified — a hallucination-free agent requires grounded data first.

---

## 5. Safety/quality guarantees

- No agent output reaches the user without a Trust/Safety pass (audited).
- Domain boundaries are server-enforced (medical: no diagnosis/treatment; legal/tax: escalate; financial: advice-disclaimer) — not prompt-only.
- Anti-hallucination: agents answer only from `authoritative_facts` + grounded evidence; `missing_facts` are surfaced as questions, never invented.
- Cost + latency metered per agent (`ops.llm_usage_meter`); economic budgets/circuit-breakers reused.
