# Recommendation Consistency Report

Sprint: Finish Line · READ-ONLY AUDIT · 2026-06-16
Question: Is the SAME top recommendation, with the same rationale / evidence / confidence / ranking, shown across Dashboard, Reports, Advisor, Life Brief, and Graph?

## Headline verdict: PARTIAL

The Recommendation OS (`recommendations_os.py`) is a genuinely single source of truth for the _content_ of a recommendation (title, why, evidence, confidence, formula). Every surface that renders a recommendation pulls from that one table. **But the surfaces do not all read the same RANKED VIEW**: they split across three different access methods — `prioritize()`, `roadmap()`, and `active()` — and one consumer (Mission Control "Needs Attention") is reading the wrong shape entirely and silently dropping all RISK alerts. So the _#1 recommendation_ is consistent between Dashboard hero, Reports, and Advisor-chat, but the Roadmap page can disagree on ordering vs. the dashboard, the Graph shows an unranked superset, and one feed is broken.

## The one backend, three different read paths

| Method            | File:line                   | What it returns                                                                                 | Ranked?                | Deduped?                  | Formula / why_number_one?             |
| ----------------- | --------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------- | ------------------------- | ------------------------------------- |
| `prioritize(top)` | `recommendations_os.py:524` | `top_actions[]` (ACTION/RISK/OPP only) + `why_ranking` + `needs_more_information` + `conflicts` | yes                    | yes (`_dedup_by_finding`) | yes                                   |
| `roadmap()`       | `recommendations_os.py:537` | `now`(1) / `next`(2) / `later`(rest) + `blocked_by` + `why_now`                                 | yes (same `_rankable`) | yes                       | partial (`why_now` only, no per-pair) |
| `active()`        | `recommendations_os.py:102` | every non-dismissed/-completed row, raw                                                         | **no**                 | **no**                    | n/a                                   |

`prioritize` and `roadmap` both call `self._rankable(recs, learning_factors)` (lines 527 / 540), so for a given user at a given moment they rank identically. `active()` does neither.

## Surface-by-surface trace

| Surface                                               | Component / service                                           | Endpoint actually called      | OS method                                                                                      | Result                                                                                                                 |
| ----------------------------------------------------- | ------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Dashboard hero ("Next best action")                   | `ExecutiveSummary.tsx:148` → `/api/life/my-life`              | `/v1/life/my-life`            | `my_life.py:94` `prioritize(top=6)`                                                            | top ACTION/OPP from prioritized list ✔                                                                                 |
| Dashboard "Needs Attention"                           | `NeedsAttention.tsx:44` → `/api/life/attention`               | `/v1/life/attention`          | `my_life.py:35` `attention()`                                                                  | **BROKEN — see Defect 1**                                                                                              |
| Mission Control ("Top move")                          | `MissionControl.tsx:76` → `/api/platform/dashboard`           | `/v1/platform/dashboard`      | `guidance.py:73` `prioritize(top=1)`                                                           | top action ✔ (but a 2nd network call, can lag)                                                                         |
| Recommendations / Roadmap page                        | `recommendations/page.tsx:390` → `/api/recommendations` (GET) | `/v1/recommendations/roadmap` | `roadmap()`                                                                                    | Now/Next/Later ✔ but a DIFFERENT view than the dashboard hero                                                          |
| Reports (exec briefing)                               | `report_engine.py:221`                                        | (server-side)                 | `roadmap()`                                                                                    | uses roadmap order ✔                                                                                                   |
| Reports ("Prioritized Next Steps")                    | `report_engine.py:181`                                        | (server-side)                 | `prioritize(top=5)`                                                                            | a SECOND recs section in the SAME report, built from a different call — can disagree with the briefing's roadmap order |
| Advisor chat ("what should I do next / biggest risk") | `orchestrator.py:118` `_answer_from_os`                       | n/a (in-process)              | `prioritize(top=3)`                                                                            | same #1 ✔; explicitly says "same prioritized answer you'll see on your dashboard" (`orchestrator.py:276`)              |
| Hybrid Advisor (LLM six-section turn)                 | `advisor_llm.py` + `advisor_context.py`                       | `/v1/.../advisor`             | **none**                                                                                       | **Does NOT read the OS at all — see Defect 2**                                                                         |
| Life Brief (dashboard)                                | `LifeBrief.tsx` → `/api/life/my-life`                         | `/v1/life/my-life`            | `my_life.py:204` `life_brief(next_action=...)` where `next_action` is from `prioritize(top=6)` | next_move = top action ✔                                                                                               |
| Graph (`/life-graph/explainable`)                     | `lifeGraphApi.ts` → `/api/life-graph`                         | `/v1/life-graph/...`          | `life_graph.py:33` `reco.active(ctx)`                                                          | **unranked, undeduped superset — see Defect 3**                                                                        |

## Defects

### Defect 1 (P0) — Mission Control "Needs Attention" silently drops every RISK alert

`my_life.attention()` (`my_life.py:34-39`) does:

```python
active = await self._os.active(ctx)
for r in (active.get("recommendations") or []):
    if r.get("classification") == "RISK":
```

But `active()` returns a **list**, not a dict (`recommendations_os.py:102-116`), so `active.get(...)` raises `AttributeError`, is swallowed by the bare `except` at `my_life.py:40`, and the loop never runs. Even if it returned a dict, recommendations use the field `rec_type` ("RISK"), not `classification`. Net effect: the high-severity RISK alerts that should headline the attention feed are never emitted. The feed only ever shows missing-input / discovery / document alerts. The dashboard therefore under-reports risk relative to the Recommendations page and the Graph.

- Fix: `for r in await self._os.active(ctx):` and `if r.get("rec_type") == "RISK":` (and read `r.get("title")`, `r.get("description")`). Surfacing-only.

### Defect 2 (P1) — the LLM Advisor doesn't read the Recommendation OS

The hybrid advisor's guardrail context (`AdvisorContext.prompt_dict`, `advisor_context.py:231-265`) contains vision, objective, goals, risks, opportunities, constraints, numbers, and graph edges — but **no recommendations and no prioritized "next best action."** So in an open advisory turn the LLM forms its own Section-4 "recommendation" from raw facts, which can name a different top move than the OS #1 shown on the dashboard. The deterministic shortcut `_answer_from_os` (orchestrator) only fires for the narrow phrasings in `_is_next_action_query` (`orchestrator.py:102-108`, e.g. "what should I do next", "biggest risk"). Any other advisory question bypasses the spine.

- Fix: add the OS top 3 (`prioritize(top=3)` → title / why / confidence) into `AdvisorContext` as a read-only `current_recommendations` guardrail with an instruction "when the user asks what to do, align with these; do not invent a different priority." No new infra; reuses `prioritize`.

### Defect 3 (P2) — Graph shows an unranked, undeduped superset

`/v1/life-graph` builds recommendation lineage from `reco.active(ctx)` (`life_graph.py:33`), i.e. _every_ live rec including DEPENDENCY/INFORMATION and duplicate-finding rows that `prioritize/roadmap` collapse via `_dedup_by_finding` (`recommendations_os.py:454`). The node payload carries `rank_score` (`life_graph_workspace.py:128`) but no `formula`/`why_number_one`, and the canvas does not sort by it. Consequence: a recommendation that is deduped-away or below the confidence floor on every other surface still appears as a first-class node in the graph, and there is no visual "this is #1." Not wrong data, but a different set + no shared ordering.

- Fix: either feed the graph from `prioritize(top=N)`'s deduped ranked list, or tag each node with its rank and mark the #1; reuse the existing `prioritize` output. Surfacing-only.

### Defect 4 (P2) — Reports contain two independently-built recommendation sections

`report_engine.build()` adds an Executive-Briefing recs block from `roadmap()` (`report_engine.py:221`) AND a separate "Your Prioritized Next Steps" section from `prioritize(top=5)` (`report_engine.py:181`). Because Now/Next/Later (roadmap) and top_actions (prioritize) are sliced differently, the same report can present two orderings of the same recommendations. Same data, two views, in one document — reads as inconsistency.

- Fix: build both sections from a single `prioritize()` call passed down, or drop the duplicate section. Surfacing-only.

### Defect 5 (P3) — field-drop in the Reports "Prioritized Next Steps" section

`_os_recommendations_section` (`report_engine.py:187-194`) maps each action to `{title, why, action, priority, confidence, expected_benefit, source}` and **omits `evidence`, `assumptions`, `quantified_impact`, and `formula`** that `prioritize()._shape` actually returns (`recommendations_os.py:488-502`). The Recommendations _page_ drawer shows all of these (`recommendations/page.tsx:106-253`); this report section does not. (The Executive-Briefing block at `report_engine.py:232-242` does carry evidence/assumptions/impact, so the data is available — this is a per-section drop.)

- Fix: include `evidence`/`assumptions`/`quantified_impact` in the section body. Surfacing-only.

## What IS consistent (credit where due)

- One write path, one table: `RecommendationOS.write` is "the ONLY way a recommendation enters the platform" (`recommendations_os.py:55-100`) and refuses any rec without evidence (line 67-69). No surface invents recommendations.
- The visible formula (`Impact × Confidence × Urgency × Evidence ÷ Effort`) is computed once at write (`recommendations_os.py:81`) and re-scored uniformly via `_score` (`recommendations_os.py:446-452`).
- Dashboard hero, Mission Control top-move, Advisor next-action, and the Reports executive briefing all derive from `prioritize`/`roadmap` → same #1.
- The Advisor chat literally tells the user it is the "same prioritized answer you'll see on your dashboard" — and for the next-action intent, it is.

## Recommended fix order (surfacing-only)

1. Defect 1 (broken RISK feed) — one-line correctness fix, highest user-visible impact.
2. Defect 2 (advisor reads OS) — biggest consistency win across the most-used surface.
3. Defect 4 + 5 (collapse report to one prioritize call, stop dropping fields).
4. Defect 3 (rank/dedupe the graph or mark #1).
