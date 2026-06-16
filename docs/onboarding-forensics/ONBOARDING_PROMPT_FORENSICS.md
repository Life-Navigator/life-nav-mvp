# Onboarding Prompt & Rule Forensics

**Date:** 2026-06-16 · **Type:** evidence-only root-cause investigation. No fixes, no rewrites, no proposals. Every conclusion cites `file:line` or is marked `UNKNOWN`/`EXTERNAL` (provably not in this repo).

## Scope boundary (read this first — it determines everything)

The onboarding chat the user sees is served by a **remote, separately-deployed service**, not by code in this repository:

- The browser calls the Next proxy `apps/web/src/app/api/life/discovery-chat/route.ts:7`, which forwards to **`${CORE_API}/v1/life/discovery/chat`**.
- `CORE_API` = `https://lifenavigator-core-api.fly.dev` — `apps/web/src/app/api/life/_helper.ts:2-4`.
- The `apps/lifenavigator-core-api/` directory in THIS monorepo is a **stale snapshot** of that service (last commit touching it: `e7c288b 2026-06-11`). It is provably **behind** what is deployed (evidence E1–E4 below).

**Therefore:** the exact prompt/template/formatter/validator that produced the observed message lives in the **deployed core-api codebase, which is not present in this repository**. Where that is the case this audit states `EXTERNAL (not in this repo)` and gives the evidence of absence — it does not invent file:line for code it cannot see.

## The single highest-confidence root cause

**The production `/v1/life/discovery/chat[/stream]` endpoint is running a newer, LLM-driven advisor implementation that does not exist in this repo. The in-repo discovery implementation (`RelationshipManager.converse`) is a scripted, conversational, LLM-free, one-question-at-a-time flow that produces NONE of the observed behaviors** (no analysis sections, no tradeoffs, no "My read", no disclaimer, no consultant tone). The observed output therefore originates entirely in the deployed-but-not-in-this-repo code — its fingerprints match the benchmark-optimized "advisor-hybrid" advisor (out-of-repo context; not file:line-provable here).

## Evidence ledger (all from THIS repo)

| #   | Claim                                                              | Evidence                                                                                                                                                                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | Onboarding chat is a remote call                                   | `api/life/discovery-chat/route.ts:7` → `${CORE_API}/v1/life/discovery/chat`; `_helper.ts:2-4` `CORE_API=lifenavigator-core-api.fly.dev`                                                                                                                                                                                                  |
| E2  | In-repo discovery is **scripted & conversational**, not analytical | `services/relationship_manager.py:42-61` = the literal question bank ("what would you most like your life to look like over the next few years?", …); `:341` `assistant = f"{reflection}{opener}{nq['prompt']}{why_line}"`                                                                                                               |
| E3  | In-repo discovery makes **zero LLM calls**                         | grep for `genai/GenerativeModel/gemini/anthropic/openai/httpx.post/requests.post` in `relationship_manager.py` = **0** matches                                                                                                                                                                                                           |
| E4  | In-repo core-api is **behind** deployed                            | in-repo `routers/life.py` has **no** `/discovery/chat/stream` and **no** `conversation_id` param (`life.py:81-86`), yet the deployed frontend calls `/discovery/chat/stream` with `conversation_id`; in-repo core-api has **no** `advisor_orchestrator.py` / `advisor_*.py` / validator (file-not-found)                                 |
| E5  | The observed section headers are **absent from this repo**         | grep across `*.py/*.ts/*.tsx`: `"The tradeoffs:"`=0, `"What we know:"`=0, `"My read:"`=0, `"What would change this:"`=0                                                                                                                                                                                                                  |
| E6  | The observed **disclaimer text is absent** from this repo          | grep `"general planning guidance"`, `"confirm specifics with a licensed professional"`, `"not personalized financial"` = **0** files                                                                                                                                                                                                     |
| E7  | The observed disclaimer is **not** the frontend's                  | the only in-repo UI disclaimer is `apps/web/src/lib/advice/disclosure.ts` (text: "…not legal, tax, medical, or investment advice"), a **different** string, rendered as a **separate** component, and **not deployed** (unmerged branch). Frontend renders the backend text verbatim: `advisor/page.tsx:182` `text: t.assistant_message` |
| E8  | Stray fingerprint matches are unrelated UI                         | `"What would change this"` → `lib/decision/counterfactual-engine.ts` (decision UI); `"What we know"` → finance/decision components (`finance/page.tsx`, `finance/retirement`, `finance/investments`, `domain/framework/*`) — none in the discovery/advisor path                                                                          |

## Phase results (full detail in the companion docs)

- **Phase 1 — Prompt chain** → `PROMPT_HIERARCHY_MAP.md`. In-repo discovery has **no prompt chain** (no system/role/domain/agent/tool prompts, no LLM); it is rule/script-based (`RelationshipManager`). The deployed chain is `EXTERNAL (not in this repo)`.
- **Phase 2 — Template fingerprinting** → `ADVISOR_TEMPLATE_ORIGIN.md`. None of the four sections nor the disclaimer originate in this repo (E5–E8). Origin = `EXTERNAL` deployed advisor.
- **Phase 3 / 7 — Rule inventory & conflicts** → `RULE_SUPPRESSION_ANALYSIS.md`. The in-repo discovery rules (one-question, reflect-user's-words, extract-first) are the _opposite_ of the observed behavior; the conflicting "always provide tradeoffs / reasoning / disclaimer" rules are not in this repo.
- **Phase 4 — Assumption leak** → `DISCOVERY_MODE_GAP_ANALYSIS.md`. `"primary objective = Reach financial independence"` is **seeded by the persona the user selected** (`components/onboarding/SampleFinancialProfile.tsx`, `api/integrations/plaid/activate-persona/route.ts`) and carried in-repo as a **confidence-scored candidate** (`life_discovery.py:168,175,184,193` — base confidence 0.3+), **not** a user-typed confirmation. The elevation to a flat declarative "Your primary objective is X" is performed by the `EXTERNAL` advisor composition.
- **Phase 5 — Discovery mode** → `DISCOVERY_MODE_GAP_ANALYSIS.md`. A true Discovery Mode **exists in this repo** (`RelationshipManager`) but is **not what's running in production** on that route.
- **Phase 6 — Benchmark contamination** → `ADVISOR_TEMPLATE_ORIGIN.md`. The benchmark/advisor-V2–V6 artifacts (`docs/advisor-benchmark/`, `advisor_validator`, `advisor_orchestrator`) are **absent from this repo**; any contamination lives in the deployed repo. The in-repo discovery contains none of it.
- **Phase 8 — Live debug trace** → not executable here: this environment cannot run the deployed service or the model. The **static in-repo trace does not reproduce the behavior** (E2/E3). Runtime transformation steps in the deployed service = `UNKNOWN (EXTERNAL)`.

## Did the recent P0 / streaming frontend work cause this?

**No — proven.** The frontend renders the backend's `assistant_message` verbatim (`advisor/page.tsx:182`) and adds no analysis sections. The P0-3 disclaimer is a different string in a different component and is on an **unmerged** branch (not in production). The observed disclaimer + sections are absent from the entire repo (E5–E7). The behavior predates and is independent of the P0/streaming changes.

## What this audit could NOT prove (honest gaps)

- The exact file/class/function/line of the deployed advisor prompt, template, formatter, and validator: `UNKNOWN — EXTERNAL` (the deployed core-api source is not in this repository).
- A live, end-to-end debug trace of one onboarding response: `UNKNOWN` (cannot execute the remote service or model from here).
- Whether the deployed route wraps `RelationshipManager` in an orchestrator or replaces it: `UNKNOWN — EXTERNAL` (the in-repo orchestrator does not exist; the deployed one is not visible here).
