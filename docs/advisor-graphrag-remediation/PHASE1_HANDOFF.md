# Advisor + GraphRAG Remediation — Phase 1 Handoff

**Date:** 2026-07-23 · **Branch:** `feat/advisor-goal-persistence` · **Status:** code-complete, tested, NOT deployed.

Triggered by a prod symptom: _"Let's discuss my education"_ returned a **finance** non-answer
("I can't give a dollar figure without your income/savings/expenses"). A five-agent full-system audit
(see the `advisor-graphrag-remediation-plan` memory + the plan artifact) found the root causes and produced
the plan below. This document is the runbook to ship Phase 1 and the map of what remains.

## What shipped (8 commits, 828 backend tests green)

| Commit     | Workstream | Change                                                                                                                                                                                                                                                                |
| ---------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `9aa012e5` | WS-A.1/A.2 | Domain-aware counsel fallback + per-domain prompt playbooks (education/career/health). Fixes the misframe at two layers. Prompt v6.1.0.                                                                                                                               |
| `5df9dd7b` | WS-B/F8    | Medical gate uses dose/prescription **intent** + a supplement/nutrition whitelist instead of bare substrings. Stops blocking "creatine dosage", "start taking walks", "do I have enough protein".                                                                     |
| `021a6f1d` | WS-C       | Migration `20260723000000`: `sync_queue.claimed_at` + `claim_sync_jobs` reclaims stale `processing`/`failed` (fixes 3 silent-data-loss paths); graphrag triggers on `finance.financial_planning_goals` + `life.candidate_goals`. Worker keepalive (connection-reset). |
| `11f8e07c` | WS-E       | `AdvisorContextBuilder` optional `Retriever` → `context.graph_evidence` in the prompt. DI flag `GRAPH_GROUNDING_ENABLED` (**default OFF**).                                                                                                                           |
| `b54a9601` | WS-E       | Neo4j traversal is now domain-scoped and returns real `title`/`summary`; prompt rule teaches the model to use `graph_evidence`.                                                                                                                                       |
| `9c0baec4` | WS-D       | `USE_VERTEX_CLAUDE` default aligned `claude-opus-4-1` → `claude-opus-4-8`.                                                                                                                                                                                            |

All changes are additive/backward-compatible. The flag-/None-gated ones (WS-E retriever, playbooks that
fire only on a routed topic) are inert until their condition is met.

## Runbook — make Phase 1 live (in order)

1. **Apply the WS-C migration** to prod Supabase (review first):
   `supabase db push` — or `psql "$SUPABASE_DB_URL" -f supabase/migrations/20260723000000_graphrag_queue_reliability_and_goal_triggers.sql`
2. **Baseline the eval** against current prod (the trust floor):
   ```
   printf '%s\n%s\n%s\n' "$SUPABASE_URL" "$SUPABASE_ANON_KEY" "$SUPABASE_SERVICE_ROLE_KEY" > /tmp/sweep_creds.txt
   node apps/web/advisor-eval.mjs      # expect: fabrication=0, no 5xx
   ```
3. **Merge to `main`** → `deploy-fly.yml` auto-deploys `core-api` + `ingestion-worker`.
4. **Re-run the eval** against new prod → confirm fabrication still 0, no 5xx, education case improved.
5. **(Optional) enable GraphRAG grounding** only after (4) is green: `GRAPH_GROUNDING_ENABLED=true` on Fly,
   confirm Neo4j/Qdrant reachable, re-eval.

## What remains — and why it's gated

| Item                                          | Gated on                                                                                                                                                                                           |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WS-B redact-don't-nuke (F6) + F2-subtler      | The eval harness. F2 (stop gating non-personal $) was attempted and **reverted** — it broke 4 fabrication tests. Guardrail relaxation is trust-load-bearing; unit tests are not a sufficient gate. |
| WS-C.3 embedding dimension (768 vs 3072)      | Verify the **actual Qdrant collection dims** first — a blind `outputDimensionality:768` breaks 3072 collections.                                                                                   |
| WS-A.4 discovery topic-awareness              | Careful RM state-machine work (`baseline_<domain>` keys belong to the completion-gate queue). Not the reported bug — a fresh user's discovery opener is the neutral vision question.               |
| WS-E activation + retire orphaned `/v1/chat`  | Live Neo4j/Qdrant + eval. The live advisor still grounds on Supabase only until the flag is on; the orphaned `LifeOrchestratorAgent` at `/v1/chat` is dead and can be removed once confirmed.      |
| WS-D router consolidation, vertex-boot-assert | Eval (routing affects output) / all-envs care for a fail-loud boot assert.                                                                                                                         |

## Key architectural finding (owner decision: **make GraphRAG real**)

The live advisor (`/v1/life/advisor/chat` → `AdvisorOrchestrator`) grounds on **Supabase tables only**. The
Neo4j/Qdrant retrieval code (`app/grounding/retriever.py` + `LifeOrchestratorAgent` at `/v1/chat`) is a
**second, orphaned orchestrator** the web app never calls. WS-E wires the retriever into the live path
(flag-gated); full activation + retiring the orphan is the remaining Option-A work.
