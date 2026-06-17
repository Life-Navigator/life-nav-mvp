# Prompt Hierarchy Map (Phase 1)

**Evidence-only.** Traces every layer from user message → final response. `EXTERNAL` = provably not in this repo (deployed core-api). `UNKNOWN` = cannot be determined from this repo.

## The request path (in-repo, provable)

```
Browser (advisor page)
  apps/web/src/app/dashboard/advisor/page.tsx:189  fetch('/api/life/discovery-chat')        [active]
        ↓
Next proxy (pass-through; no transformation of model content)
  apps/web/src/app/api/life/discovery-chat/route.ts:7  fetch(`${CORE_API}/v1/life/discovery/chat`)
  apps/web/src/app/api/life/_helper.ts:2-4  CORE_API = https://lifenavigator-core-api.fly.dev
        ↓   ==================  REPO BOUNDARY  ==================
Deployed core-api  (NOT in this repo)
  POST /v1/life/discovery/chat  →  <advisor implementation>  →  assistant_message
        ↓
Browser renders assistant_message verbatim
  apps/web/src/app/dashboard/advisor/page.tsx:182  text: t.assistant_message
```

The proxy and the browser perform **no** prompt assembly, system prompts, or output formatting of the model text. The browser only maps response fields to UI (`page.tsx:180-186`).

## Layer-by-layer

| Layer                     | File · class · function                        | Prompt/template text                                             | Order | Modifies output?            | Active?   | Conditional?                                                       |
| ------------------------- | ---------------------------------------------- | ---------------------------------------------------------------- | ----- | --------------------------- | --------- | ------------------------------------------------------------------ |
| User message              | `advisor/page.tsx:188-194` `AdvisorPage.send`  | none                                                             | 1     | no                          | yes       | opens with empty message on mount (`page.tsx:82` `send('', null)`) |
| Client transport          | `api/life/discovery-chat/route.ts:4-15` `POST` | none                                                             | 2     | no (verbatim proxy)         | yes       | no                                                                 |
| **Orchestrator**          | `EXTERNAL`                                     | `EXTERNAL`                                                       | 3     | `UNKNOWN`                   | `UNKNOWN` | `UNKNOWN`                                                          |
| **System prompt**         | `EXTERNAL`                                     | `EXTERNAL`                                                       | 4     | `UNKNOWN`                   | `UNKNOWN` | `UNKNOWN`                                                          |
| **Role prompt**           | `EXTERNAL`                                     | `EXTERNAL`                                                       | 5     | `UNKNOWN`                   | `UNKNOWN` | `UNKNOWN`                                                          |
| **Domain prompt**         | `EXTERNAL`                                     | `EXTERNAL`                                                       | 6     | `UNKNOWN`                   | `UNKNOWN` | `UNKNOWN`                                                          |
| **Agent prompt**          | `EXTERNAL`                                     | `EXTERNAL`                                                       | 7     | `UNKNOWN`                   | `UNKNOWN` | `UNKNOWN`                                                          |
| **Tool prompts**          | `EXTERNAL`                                     | `EXTERNAL`                                                       | 8     | `UNKNOWN`                   | `UNKNOWN` | `UNKNOWN`                                                          |
| **Safety layer**          | `EXTERNAL`                                     | `EXTERNAL`                                                       | 9     | `UNKNOWN`                   | `UNKNOWN` | `UNKNOWN`                                                          |
| **Compliance/disclaimer** | `EXTERNAL`                                     | the observed disclaimer string is **absent from this repo** (E6) | 10    | `UNKNOWN` (adds disclaimer) | `UNKNOWN` | `UNKNOWN`                                                          |
| **Formatting layer**      | `EXTERNAL`                                     | the 4 section headers are **absent from this repo** (E5)         | 11    | `UNKNOWN` (adds sections)   | `UNKNOWN` | `UNKNOWN`                                                          |
| **Validator layer**       | `EXTERNAL`                                     | `EXTERNAL` (no `advisor_validator` in repo)                      | 12    | `UNKNOWN`                   | `UNKNOWN` | `UNKNOWN`                                                          |
| **Post-processor**        | `EXTERNAL`                                     | `EXTERNAL`                                                       | 13    | `UNKNOWN`                   | `UNKNOWN` | `UNKNOWN`                                                          |
| Final response render     | `advisor/page.tsx:180-186` `apply()`           | none                                                             | 14    | no                          | yes       | no                                                                 |

## The in-repo implementation of this exact route (for contrast)

If the deployed service ran THIS repo's code, the chain would be **rule-based with no model and no formatting**:

| Layer                              | File · function                                                           | What it does                                                          | Prompt text                                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Route handler                      | `apps/lifenavigator-core-api/app/routers/life.py:81-86` `discovery_chat`  | `return await svc.converse(_ctx(user), message, pending_key or None)` | none                                                                                                                     |
| Discovery engine                   | `services/relationship_manager.py:227-344` `RelationshipManager.converse` | answer pending question → write to life model → reflect → ask next    | composes `assistant_message = reflection + opener + next_question + why_line` (`:341`)                                   |
| Question bank                      | `services/relationship_manager.py:42-61`                                  | 7 fixed discovery questions                                           | e.g. `:42` "Let's start with the big picture — what would you most like your life to look like over the next few years?" |
| Reflection                         | `services/relationship_manager.py:296-314`                                | short echo of the user's own words                                    | e.g. `:300-314` (no analysis, no tradeoffs)                                                                              |
| Context panel                      | `services/relationship_manager.py:212-220` `_context_panel`               | exposes `primary_objective` (title) from the canonical snapshot       | none                                                                                                                     |
| LLM / system prompt                | —                                                                         | **none exists** (E3: 0 model calls)                                   | none                                                                                                                     |
| Formatter / validator / disclaimer | —                                                                         | **none exists**                                                       | none                                                                                                                     |

**Conclusion:** the in-repo chain has no system/role/domain/agent/tool/safety/compliance/format/validator layers at all — it is deterministic and conversational. Every layer that produced the observed output is `EXTERNAL`.
