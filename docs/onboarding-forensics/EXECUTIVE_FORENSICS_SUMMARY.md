# Executive Forensics Summary

**Date:** 2026-06-16 · Evidence-only. Answers the 10 final questions. `EXTERNAL` = provably not in this repository (the deployed `lifenavigator-core-api` service); `UNKNOWN` = not determinable from this repo.

## The one-line conclusion

The onboarding message was **not** produced by any code in this repository. The browser proxies onboarding to a **remote deployed service** (`lifenavigator-core-api.fly.dev/v1/life/discovery/chat`); this repo's copy of that service is an **older snapshot** whose discovery implementation is a **scripted, conversational, LLM-free flow that produces none of the observed behavior**. Every observed element (tradeoffs, "What we know", "My read", "What would change this", the disclaimer, the consultant tone, the fact-framing) is `EXTERNAL`.

## The 10 questions

1. **What exact prompt generated this behavior?** `EXTERNAL — UNKNOWN`. No discovery/advisor prompt that yields this output exists in this repo (the in-repo discovery uses no prompt/LLM — `relationship_manager.py`, 0 model calls). The generating prompt lives in the deployed core-api repo, not here.

2. **What exact rule generated this behavior?** `EXTERNAL — UNKNOWN`. The in-repo rules mandate the _opposite_ (one question at a time, reflect the user's words: `relationship_manager.py:227-344`, `:296-314`). The "always analyze / always disclaim" rules are not in this repo.

3. **What exact template generated this behavior?** `EXTERNAL`. All four section headers and the disclaimer string are **absent from this repo** (greps = 0). Same-named strings here belong to unrelated finance/decision UI (`finance/*`, `lib/decision/counterfactual-engine.ts`, `domain/framework/*`).

4. **What exact component converted assumptions into facts?** The **`EXTERNAL` advisor composition**. The objective is persona-seeded (`api/integrations/plaid/activate-persona/route.ts`, `components/onboarding/SampleFinancialProfile.tsx`) and carried in-repo as a **confidence-scored candidate** (`services/life_discovery.py:149-201`). Nothing in this repo restates it as a flat fact; that elevation happens in the deployed service.

5. **Is onboarding running the wrong advisor mode?** **Yes (high confidence).** A correct conversational Discovery Mode exists in-repo (`RelationshipManager`) but is **not** what production runs on `/v1/life/discovery/chat`; the live output is the **advisor** format, not the discovery format. The exact external mode label is `UNKNOWN — EXTERNAL`.

6. **Is benchmark logic contaminating discovery?** **Not in this repo** (no benchmark/advisor-hybrid artifacts here — `docs/advisor-benchmark/`, `advisor_orchestrator`, `advisor_validator`, `advisor_llm` all ABSENT). The observed format is the benchmark/advisor format, so contamination is occurring in the **deployed** service (`EXTERNAL`), not in this codebase.

7. **Which files must change to fix it?** Per audit scope this is location-evidence only, not a fix design: the change must occur in the **deployed `lifenavigator-core-api` repository** (the implementation behind `/v1/life/discovery/chat[/stream]` and its advisor composition/formatter/disclaimer) — **none of which is in this monorepo**. No file in this repo needs to change to alter the observed behavior.

8. **Which files must NOT change?** The in-repo conversational discovery is correct and should be left alone: `apps/lifenavigator-core-api/app/services/relationship_manager.py`, `services/life_discovery.py`, `services/discovery_coverage.py`, `routers/life.py:81-86`. Also unrelated to the cause: the frontend advisor render (`apps/web/src/app/dashboard/advisor/page.tsx:182`, renders verbatim) and the P0-3 disclosure component (`apps/web/src/lib/advice/disclosure.ts` — different text, unmerged, not the observed disclaimer).

9. **Single highest-confidence root cause?** **Route-level implementation mismatch:** production `/v1/life/discovery/chat` executes a deployed advisor implementation that is newer than and different from this repo's `RelationshipManager`; the conversational discovery rules in this repo are not executed in production at all.

10. **What evidence proves it?**
    - Proxy to remote service: `api/life/discovery-chat/route.ts:7` + `_helper.ts:2-4` (`CORE_API=lifenavigator-core-api.fly.dev`).
    - In-repo discovery is scripted/conversational/LLM-free: `relationship_manager.py:42-61` (question bank), `:341` (assembly), 0 model calls.
    - In-repo copy is behind deployed: `routers/life.py:81-86` has no `/stream` and no `conversation_id`; `advisor_orchestrator.py`/`advisor_*.py`/validator file-not-found; last in-repo core-api commit `e7c288b 2026-06-11`.
    - Observed fingerprints absent here: section headers = 0, disclaimer text = 0.
    - Not the frontend's doing: `advisor/page.tsx:182` renders `assistant_message` verbatim; the only in-repo disclaimer (`lib/advice/disclosure.ts`) is different text and unmerged.

## Did the recent P0 / streaming work cause this?

**No (proven).** The behavior's source strings are absent from the entire repo, the frontend renders the backend text verbatim, and the P0-3 disclaimer is a different string on an unmerged branch. The cause predates and is independent of those changes.

## Honest limits of this audit

- The deployed core-api source is **not in this repository**; the exact external prompt/template/formatter/validator lines are `UNKNOWN — EXTERNAL`.
- A **live end-to-end debug trace (Phase 8)** could not be executed here (no ability to run the remote service or the model). The static in-repo trace does not reproduce the behavior. To obtain the runtime trace, instrument the **deployed** core-api (raw model output → validator → compliance → formatter → final) — outside this repo.

## Companion documents

`ONBOARDING_PROMPT_FORENSICS.md` (master + evidence ledger) · `PROMPT_HIERARCHY_MAP.md` (Phase 1) · `ADVISOR_TEMPLATE_ORIGIN.md` (Phase 2 + 6) · `RULE_SUPPRESSION_ANALYSIS.md` (Phase 3 + 7) · `DISCOVERY_MODE_GAP_ANALYSIS.md` (Phase 4 + 5).
