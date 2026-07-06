# ADVISOR_GRAPHRAG_TRACE.md — Phase 1

The exact advisor retrieval path, traced in code (apps/lifenavigator-core-api/app/).

## Request path

```
POST /v1/life/advisor/chat            routers/life.py:145
  → AdvisorOrchestrator.converse()    services/advisor_orchestrator.py:372
    → RelationshipManager.converse()  (deterministic turn — goal persistence, safe fallback)
    → _health_safety_check()          (urgent-care net, pre-LLM)
    → AdvisorContextBuilder.build()   services/advisor_context.py:353   ← THE retrieval
        asyncio.gather(
          _rejected(ctx)              life.rejected_goals          (SQL)
          _scores(ctx)                DiscoveryCoverageService     (per-domain coverage)
          _relationships(ctx)         LifeDiscoveryService.personal_graph()  (GRAPH edges)
          _facts(ctx)                 build_fact_packet()          (SQL facts + life.facts)
        )
    → domains_for(agent, message) = route_domains(message)   (domain hint; fact filter for DIRECT agents only)
    → GeminiAdvisorLLM.generate(prompt_dict)   services/advisor_llm.py:230
    → AdvisorValidator.validate()      (number gate, relationship gate, advice gate)
    → citations stamped               advisor_orchestrator.py:286 (_citations_from_context)
  → response {assistant_message, citations[], relationships_referenced, ...}
```

## Data sources (what actually loads)

| Source                              | Schema/table                                                                              | Retrieval type      | Citations                               |
| ----------------------------------- | ----------------------------------------------------------------------------------------- | ------------------- | --------------------------------------- |
| Document/domain facts               | career._, education._, finance.financial_accounts, family.dependents, documents.documents | **SQL**             | ✅ sourceTable+recordId+confidence      |
| Extracted document facts            | **life.facts** (confirmed/inferred only)                                                  | **SQL**             | ✅                                      |
| Graph relationships                 | **personal_graph** (LifeDiscoveryService) — persisted nodes/edges, 2-hop primary links    | **GRAPH traversal** | edge confidence (not cited to response) |
| Goals / risks / constraints         | base context_panel (RelationshipManager)                                                  | derived             | —                                       |
| Rejected goals / discovery coverage | life.rejected_goals, DiscoveryCoverageService                                             | SQL                 | —                                       |

## What is NOT in the path (proven by absence)

- **No semantic/vector retrieval** — no Qdrant / embedding / vector call anywhere in `build()` or `_facts()`.
- **No ontology engine** — no concept registry / taxonomy expansion; domains come from the keyword router.
- **life.relationships table** — not read (and currently empty: 0 rows). Graph edges come from `personal_graph`.

## Prompt payload to the LLM (advisor_context.prompt_dict)

`confirmed_facts`, `domain_facts` (with provenance), `relationship_edges`, `graph_connections`, `relationships_available`, `goals/risks/constraints`, `agent_domains` (the routed-domain hint), `numbers_you_may_reference`, `conversation_so_far`, `safety_constraints`.
</content>
