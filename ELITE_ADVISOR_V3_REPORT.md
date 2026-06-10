# ELITE ADVISOR DISCOVERY ENGINE V3 — Increment 1 — 2026-06-10

Core API live on Fly **v69**; main `d81c354`. Additive engine change — **317/317 Core API tests pass**.
Discovery is rule-based (no LLM), so this is deterministic Python. No GraphRAG/recommendation/dashboard changes.

## Shipped this turn (built, tested, deployed, live-validated)

- **Sprint 2 — Candidate Goal Engine:** `life_discovery.analyze_statement()` splits a single answer into
  clauses and returns `candidate_goals[]` — each `{goal, objective, confidence, supporting_statements,
dependencies, domain}`. Goals are **never collapsed to one**. `relationship_manager.converse()` reflects
  them as a list ("I'm hearing a few distinct things — 1)… 2)… did I capture those?") and returns
  `candidate_goals` in the response.
- **Sprint 8 — Conversation-derived dependencies:** dependencies come from the user's OWN words
  (`_DEP_SIGNALS`: italy→Vacation fund; business→Business cash flow + Owner replacement plan;
  security/family→Emergency reserve + Life insurance + Survivor income plan; income→Income growth; …) —
  not a generic per-objective template.
- **Sprint 4 — Plaid awareness:** if the user has connected financial accounts, the opener acknowledges it
  and says it won't re-ask balances/income (`_has_financial_data`).
- (Already live from v68: Rule 1/2/7 hypothesize-not-declare + "Why I ask".)

## Live validation — exact required scenario, against the DEPLOYED engine

Input: _"My wife supported me while I left corporate America to build my business. I want to save enough
money to take her to Italy and create long-term security for our family."_

### Transcript

```
[ADVISOR opener] I can already see your financial picture from your connected persona, so I won't
  re-ask about balances or income — I'd rather understand what those numbers mean to you. Let's build
  your plan together… what would you most like your life to look like over the next few years?
  Why I ask: Your vision anchors every recommendation we make.
[USER] Freedom and security for my family
[ADVISOR] …What's the one thing you'd most like to make progress on right now…?
[USER] My wife supported me while I left corporate America to build my business. I want to save enough
  money to take her to Italy and create long-term security for our family.
[ADVISOR] I'm hearing a few distinct things here — 1) …take her to Italy; 2) Build family stability.
  Did I capture those, or did I miss something? Tell me a little about your family…
```

### Candidate goals output

| goal                                             | confidence | dependencies (conversation-derived)                                             |
| ------------------------------------------------ | ---------- | ------------------------------------------------------------------------------- |
| …save money to take her to Italy (business/wife) | 0.30       | Vacation fund, Business cash flow, Owner replacement plan, Survivor income plan |
| Build family stability                           | 0.55       | Emergency reserve, Life insurance, Survivor income plan                         |

### Pass/fail against the required criteria

| Criterion                                            | Result                                                                                       |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Advisor never says "Advance your career" (this turn) | ✅ (no career/objective assertion)                                                           |
| Acknowledges existing Plaid data                     | ✅                                                                                           |
| Preserves multiple goals (candidate_goals)           | ✅ (2 captured)                                                                              |
| Conversation-derived dependencies                    | ✅ (Vacation fund, Business cash flow, Owner replacement, Emergency reserve, Life insurance) |
| Reflects/validates before classifying                | ✅ ("did I capture those?")                                                                  |

## NOT yet done — honest remaining scope (the deeper engine, next pass)

These are larger state-machine / persistence changes I did NOT cram in (each needs its own tested+deployed pass):

- **Sprint 1 — advisor_memory persistence:** candidate_goals are captured + returned per turn but not yet
  PERSISTED + accumulated across turns into a maintained memory set.
- **Sprint 3 — full topic coherence:** the reflection no longer asserts a wrong domain, but the underlying
  FLOW still progresses through domains (it will still ask the career question later in the conversation).
  True "stay on the topic until confidence > 85%" requires replacing the fixed 9-step FLOW with a
  goal-driven next-question selector — the biggest remaining change.
- **Sprint 5 — confidence-based completion:** completion is still question-count (`all FLOW answered`),
  not per-domain confidence thresholds. (Per-domain confidence is DISPLAYED in the advisor UI from
  `/api/life/discovery-coverage`, but does not yet drive completion.)
- **Sprint 6 — goal ranking phase** (reorder/confirm before unlock): not built.
- **Sprint 7 — contradiction engine** (timeline/resource/priority conflicts): not built.
- **Sprint 9 — assembled final life model** from candidate_goals + ranking + conflicts: the frontend
  confirmation screen exists, but it isn't yet fed the candidate_goals/ranking/conflict outputs.

## Definition of Done — status

The user "feels understood before analyzed" for the opening exchange: the advisor reflects multiple goals,
derives dependencies from their words, and acknowledges existing data instead of re-interrogating —
validated live with the required scenario + transcript + candidate_goals + derived-dependency output.
The deeper engine (memory persistence, full topic coherence, confidence-completion, ranking, contradiction,
assembled life model) is scoped above as the next pass — each tractable now that the multi-goal + deploy
path is proven.
