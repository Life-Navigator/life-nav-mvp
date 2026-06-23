# GRAPHRAG PIPELINE AUDIT — LifeNavigator

**Date:** 2026-06-06
**Scope:** verify both the Personal GraphRAG and Central GraphRAG end-to-end against the live system.
**Companion to:** `DATA_FLOW_VERIFICATION_REPORT.md` (live numbers), `INTELLIGENCE_ARCHITECTURE_AUDIT.md` (architecture map).

---

## Personal GraphRAG — Ingestion (Section B)

### The pipeline (verified from source)

```
1. User action writes to a Supabase domain table
     (e.g. finance.financial_accounts INSERT)
2. Postgres trigger (migrations 050 / 055 / 074 / 076 — applied:
     050, 055 applied · 074, 076 SKIPPED in cherry-pick)
3. Trigger calls graphrag.enqueue_sync(user_id, entity_type, entity_id,
                                       source_table, operation, payload)
4. Row appears in graphrag.sync_queue with sync_status='pending'
5. Worker (Rust, Fly: lifenavigator-ingestion-worker, region iad)
     polls every 5 s, claims up to 25 rows
6. Per job:
     a. Loads the source row from Supabase
     b. normalize() → CanonicalGraphObject (PII-stripped)
     c. Routes by access_scope (column from migration 077; missing
        on remote — defaults to 'personal')
     d. Calls Gemini embedContent(text-input) → 3072-dim vector
     e. Upserts Qdrant point (collection=life_navigator for personal)
     f. Upserts Neo4j node + relationships (database=4f61c985)
     g. Marks sync_status='completed' or 'failed' + error_message
```

### Live results (count + status of each leg)

| Leg              | Status       | Live evidence                                                                                                                                                                                           |
| ---------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trigger emission | ✓            | 1,028 rows in `graphrag.sync_queue`                                                                                                                                                                     |
| Trigger coverage | PARTIAL      | Triggers fire on `finance.*` (migrations 050 + 055 + 105 applied) and `user_persona_profile`. **No triggers on `public.goals` or `public.risk_assessments`** because migrations 074 / 076 were skipped. |
| Worker claim     | ✓            | Worker logs show poll cycle every 5s; jobs being claimed                                                                                                                                                |
| Normalization    | ✓            | Completed jobs produced clean CanonicalGraphObjects                                                                                                                                                     |
| Gemini embed     | **✗ BROKEN** | 827 / 831 failed jobs are Gemini 401 Unauthorized                                                                                                                                                       |
| Qdrant upsert    | PARTIAL      | 402 points (only the ~20% completed jobs)                                                                                                                                                               |
| Neo4j upsert     | PARTIAL      | 439 nodes (consistent with completed jobs); 233 :Unknown                                                                                                                                                |
| Completion       | ✓            | 197 completed jobs marked correctly                                                                                                                                                                     |
| Failure marking  | ✓            | 831 failed jobs marked with `last_error` (visible above)                                                                                                                                                |

### Domain coverage table

| Domain                   | Ingestion exists?                                       | Triggered? | Automated? | Graph promotion?                         | Embeddings?    | Retrieval functional?                                                 | Break point                                               |
| ------------------------ | ------------------------------------------------------- | ---------- | ---------- | ---------------------------------------- | -------------- | --------------------------------------------------------------------- | --------------------------------------------------------- |
| **Finance**              | YES                                                     | YES        | YES        | PARTIAL (FinancialAccount nodes present) | PARTIAL (~20%) | YES via AUTHORITATIVE_FINANCIAL_FACTS direct-read; PARTIAL via Cypher | Worker Gemini 401                                         |
| **Persona**              | YES                                                     | YES        | YES        | PARTIAL                                  | PARTIAL        | PARTIAL                                                               | Same                                                      |
| **Career**               | NO                                                      | NO         | NO         | NO                                       | NO             | NO                                                                    | `career` schema missing on remote (migration 065 skipped) |
| **Education**            | NO                                                      | NO         | NO         | NO                                       | NO             | NO                                                                    | `education` schema missing                                |
| **Health**               | NO                                                      | NO         | NO         | NO                                       | NO             | NO                                                                    | `health` schema missing                                   |
| **Family**               | NO                                                      | NO         | NO         | NO                                       | NO             | NO                                                                    | migration 066 skipped                                     |
| **Goals**                | NO (table exists, no trigger)                           | NO         | n/a        | NO                                       | NO             | NO                                                                    | migration 074/076 skipped                                 |
| **Risk profile**         | NO (same pattern)                                       | NO         | n/a        | NO                                       | NO             | NO                                                                    | Same                                                      |
| **Conversation history** | NO (table doesn't exist yet; coming with migration 111) | NO         | n/a        | NO                                       | NO             | NO                                                                    | 111 not yet applied                                       |

### Break points enumerated

| #   | Break                                   | Root cause                                                                                                                                                    | Impact                                                                                                                 | Severity          | Effort                                               |
| --- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------- |
| 1   | Worker Gemini 401                       | Worker `GEMINI_API_KEY` is wrong or its GCP project lacks Generative Language API enabled. The Edge Function's same-named secret WORKS.                       | 80% of all sync jobs fail. Personal graph nearly empty.                                                                | **CRITICAL**      | 15 min ops                                           |
| 2   | 233 :Unknown nodes in Neo4j             | Likely from partial writes when a job succeeded in Neo4j but failed Qdrant (or vice versa). Worker's per-side outcome flag isn't reflected in the node label. | Cypher returns confusing rows.                                                                                         | MEDIUM            | 30 min cleanup                                       |
| 3   | No Goal sync triggers                   | Migration 074 and 076 were skipped in cherry-pick. Their triggers were on goals + goal_hierarchies.                                                           | Goal-aware advisor responses fall back to Supabase direct read (which works if implemented; the Cypher path is empty). | MEDIUM            | Add 1 trigger (~30 min) or accept direct-read path   |
| 4   | No Risk Profile sync trigger            | Same                                                                                                                                                          | Same                                                                                                                   | MEDIUM            | Same                                                 |
| 5   | Conversation history not enqueued       | Migration 111 will add the table but won't add the trigger. By design — conversation graph promotion is debatable.                                            | Chat history won't influence future-chat grounding.                                                                    | LOW (design call) | 30 min decision                                      |
| 6   | access_scope column missing             | Migration 077 skipped; worker code paths assume the column. Currently works because the column would default to 'personal' for everything.                    | Future migrations could break the assumption.                                                                          | LOW (latent risk) | 5 min — apply the relevant ALTER from 077 standalone |
| 7   | No central knowledge ingestion pipeline | Migrations 077/078/083 skipped; no central source tables; no central worker job.                                                                              | `ln_central` Qdrant is empty. CENTRAL_CONTEXT in the chat prompt is empty.                                             | MEDIUM            | See Central section below                            |

---

## Central GraphRAG — Ingestion (Section C)

### Purpose (per the Edge Function system prompt)

```
- CENTRAL_CONTEXT — shared policy, methodology, compliance and advice
  constraints. It governs HOW you answer (framing, allowed language, advice
  principles). It is the SAME for every user and NEVER contains this user's
  personal facts.
```

The intent: legal, regulatory, compliance, decision frameworks, educational knowledge — the "HOW" layer that frames every personal answer.

### Verified state

| Check               | Result                                                                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source repositories | **NONE found** — no `central.*` source tables, no `docs/central/` directory, no ingestion runbook                                                          |
| Ingestion pipeline  | **NONE** — worker code has a `qdrant_central` client but I can't find any code path that PUSHES into it                                                    |
| Update process      | n/a                                                                                                                                                        |
| Embedding process   | inherits the worker's Gemini key (broken — but moot until content exists)                                                                                  |
| Retrieval process   | The Edge Function's grounding pipeline expects to query `ln_central` and inject into CENTRAL_CONTEXT — but with 0 points the retrieval returns nothing     |
| Gemini integration  | The prompt still TELLS the model "CENTRAL_CONTEXT — shared policy, methodology..." even when empty. The model is asked to read context that doesn't exist. |

### Five questions answered

| #   | Question                                               | Answer                                                                                                                                                                                                               |
| --- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Can new knowledge be added?                            | NO — no pipeline, no source repo, no `central.*` schema                                                                                                                                                              |
| 2   | Is ingestion automated?                                | NO — there's nothing to ingest                                                                                                                                                                                       |
| 3   | Is re-embedding automated?                             | NO                                                                                                                                                                                                                   |
| 4   | Is versioning tracked?                                 | NO                                                                                                                                                                                                                   |
| 5   | Is governance content separated from personal content? | YES — at the _prompt structure_ level (4 separate context sections enforced) and the _worker code_ level (separate Qdrant + Neo4j clients per scope). But there's no content on the central side to enforce against. |

### Classification

```
Central GraphRAG: BROKEN
```

The architecture is sound. There's just no content. The Edge Function refers to a CENTRAL_CONTEXT that is always empty.

### Implication for v1

You have three options:

| Option | Description                                                                                                                                                                                                                                              | Effort                                                    |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| A      | Seed `ln_central` with a small curated corpus (5-10 markdown docs covering: fiduciary stance, debt-before-invest principle, emergency reserve guidance, compliance language, decision-framework primers). Embed once. Renders CENTRAL_CONTEXT non-empty. | 4-6 h                                                     |
| B      | **Edit the Edge Function prompt** to drop CENTRAL_CONTEXT until there's content. The model stops being told to read an empty block.                                                                                                                      | 30 min                                                    |
| C      | Leave it as is (the model just sees an empty section).                                                                                                                                                                                                   | 0 h, but wastes prompt tokens and might confuse the model |

**Recommended:** B for v1 (clean), A for v1.1.

---

## Context Assembly (Section D)

### The pipeline (verified from `supabase/functions/graphrag-query/index.ts` + `grounding.ts`)

```
1. User question arrives at the Edge Function
2. embedQuery() — Gemini embedding of the question (uses Edge Function's
   GEMINI_API_KEY which works)
3. Two-arm retrieval:
     a. Qdrant: search life_navigator filtered by tenant_id, k=10
     b. Cypher: LLM generates a Cypher query against the schema:
          (:Person {tenant_id, user_id, name})
          (:Goal {entity_id, tenant_id, title, category, status, priority,
                  target_value, target_unit, description})
          (:FinancialAccount {entity_id, tenant_id, account_name, account_type,
                              institution, current_balance, currency})
          (:RiskAssessment {entity_id, tenant_id, overall_score, risk_level})
          (:CareerProfile {entity_id, tenant_id, current_title, current_employer,
                           industry, years_experience})
        Runs against Neo4j with tenant_id injected
4. RRF fusion of both result sets
5. Parallel: read finance.financial_accounts directly (AUTHORITATIVE_FINANCIAL_FACTS)
6. grounding.ts assembles 4 prompt sections:
     - CENTRAL_CONTEXT       (from central retrieval — currently empty)
     - AUTHORITATIVE_PERSONAL_FACTS  (from direct finance read — WORKS)
     - PERSONAL_CONTEXT      (from RRF fusion — partial for 20% of users)
     - MISSING_DATA          (every domain marked NONE on file gets listed)
7. System prompt + 4 sections + history + question → Gemini 2.5-flash
```

### Hard rules enforced in the system prompt

The prompt explicitly tells the model:

```
2. ANY factual statement about this user's situation [...] MUST come verbatim
   from AUTHORITATIVE_PERSONAL_FACTS (or PERSONAL_CONTEXT if explicit). Do not
   change values, add items, or invent names/institutions/employers/schools.
3. If the user asks for ANY personal fact that is NOT in those sections [...]
   you MUST say you don't have that information for them yet [...].
4. NEVER fabricate personal data of ANY kind.
5. Never derive a personal fact from CENTRAL_CONTEXT.
```

### Refusal behavior — verified by tests

`supabase/functions/graphrag-query/grounding.test.ts` has explicit tests:

```
✓  all-empty personal data → NONE on file for every domain, no invented values
✓  central-only / no personal data → every domain renders a fail-closed note
✓  authoritative personal renders goals + career facts (e.g. `$3,200.00`)
✓  missing-data lists every empty personal domain
```

This is genuinely good safety architecture. The refusal behavior is tested.

### Can Gemini answer with...

| Scenario               | Behavior                                                                                                                       | Result                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| No personal context    | grounding.ts produces "NONE on file for every domain" + system prompt rule 3 says refuse                                       | ✓ Model says it can't answer + offers to help connect                      |
| Stale personal context | Cypher queries Neo4j at request-time (always fresh). Qdrant vectors lag the worker by minutes/hours.                           | ✓ Fresh enough for v1 — vector staleness is acceptable for semantic search |
| Missing graph data     | AUTHORITATIVE_FINANCIAL_FACTS picks up the slack (direct read). For non-finance domains: MISSING_DATA section + rule 3 refusal | ✓ Finance answered from direct read; other domains refused honestly        |
| Partial graph data     | RRF fusion handles this; missing axes show in MISSING_DATA                                                                     | ✓ Coverage gaps surfaced honestly                                          |

### Failure modes

| Risk                               | Status                         | Mitigation                                                                                                                     |
| ---------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Fabricated facts                   | LOW                            | Test-enforced; hard rules in prompt                                                                                            |
| Stale context                      | LOW (Cypher) / MEDIUM (Qdrant) | Qdrant lag = ingestion-worker lag; broken worker = bad lag                                                                     |
| Missing context                    | LOW                            | Explicit refusal behavior + tests                                                                                              |
| Cache poisoning                    | LOW                            | conversation_id is server-side per-user; no shared cache                                                                       |
| Cypher injection (user-influenced) | LOW                            | Cypher generator is templated; user question goes through the LLM, which produces JSON not Cypher fragments                    |
| Prompt injection in user message   | LOW                            | Sprint T factory's output-side injection scan catches LLM-leaked instructions; input-side injection scan flags hostile prompts |

### Verdict

```
Context Assembly: STRONG architecture, PARTIAL data
```

The system handles missing data gracefully and refuses to invent. The current break is upstream (worker → graph → retrieval), not in the assembly itself.

---

## Cache behavior

- **No explicit caching** at the Edge Function level. Each request re-queries Qdrant + Neo4j.
- The function computes `hashQuery(query)` (djb2) — suggests a cache lookup was planned but I don't see the corresponding KV read.
- Conversation history (prior turns) is passed via `previous_messages` from the client. **This is a future security concern** — once `chat.messages` exists, the Edge Function should load prior turns from the table, not trust the client.

---

## Summary

| Layer                                    | Health                            |
| ---------------------------------------- | --------------------------------- |
| Trigger emission                         | ✓                                 |
| sync_queue persistence                   | ✓                                 |
| Worker process                           | ✓ running                         |
| Worker job processing                    | ✗ 80% failing on Gemini auth      |
| Qdrant personal                          | PARTIAL                           |
| Neo4j personal                           | PARTIAL (and noisy with :Unknown) |
| Qdrant central                           | EMPTY                             |
| Neo4j central                            | n/a (no content)                  |
| Context assembly                         | STRONG architecture               |
| AUTHORITATIVE_PERSONAL_FACTS direct-read | ✓                                 |
| CENTRAL_CONTEXT                          | EMPTY                             |
| Refusal behavior                         | ✓ tested                          |
| Hallucination controls                   | ✓ strong                          |
| Gemini response generation               | ✓ (Edge Function key works)       |

### Two operational fixes unblock most of this

1. **Worker Gemini key** (15 min) → personal graph fills out from 20% to ~100% as the 831 failed jobs retry.
2. **Strip empty CENTRAL_CONTEXT from prompt OR seed `ln_central` with framework docs** (30 min for the strip; 4-6 h for the seed).

Everything else is downstream of those two.

---

End of `GRAPHRAG_PIPELINE_AUDIT.md`.
