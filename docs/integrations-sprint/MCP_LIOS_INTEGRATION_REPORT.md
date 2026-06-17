# MCP ↔ LIOS Integration Report

**Date:** 2026-06-16 · How MCP-submitted data enters the life model and becomes downstream intelligence.

## The flow

```
MCP client (LLM/agent)
   → submit_* tool (schema + provenance)
   → IngestionService (validate → scope → stamp → idempotent upsert)
   → life.* canonical tables
   → snapshot() / recommendations_os / readiness  (existing read spine)
   → Life Brief, dashboard, graph, reports, advisor
```

MCP writes land in the **same canonical `life` tables** the rest of the platform already reads, so submitted
data flows into existing intelligence with no new read path:

| MCP tool → table                              | Becomes (existing consumer)                                                         |
| --------------------------------------------- | ----------------------------------------------------------------------------------- |
| `submit_goal` → `life.candidate_goals`        | `goal_portfolio` + `dominant_narrative` (via `snapshot()`), Life Brief, narrative   |
| `submit_life_fact` → `life.facts`             | retrievable life context; available to advisor/report grounding                     |
| `submit_constraint` → `life.constraints`      | `active_constraints` in `snapshot()` → Life Brief "watching", dashboard constraints |
| `submit_risk` → `life.risks`                  | `top_risks` → Life Brief "stakes"/"could_change", dashboard, reports                |
| `submit_opportunity` → `life.opportunities`   | `top_opportunities` → dashboard, reports                                            |
| `submit_relationship` → `life.relationships`  | life-graph edges (provenance-carrying)                                              |
| `submit_narrative` → `life.facts` (candidate) | a candidate signal; canonical narrative stays derived                               |

## Controlled, not uncontrolled, ingestion

- Submitted goals are **candidates** by default and are candidate-protected downstream: `snapshot()` only
  lets a **confirmed** objective become primary, and unconfirmed goals are ranking-penalized
  (`life_discovery.rank_objectives`). So an agent submission cannot hijack the user's primary objective.
- `submit_risk`/`submit_opportunity` are the **first sanctioned writers** for `life.risks`/`life.opportunities`
  (previously nothing wrote them, by a TRUST RULE blocking archetype auto-creation). MCP writes are allowed
  because they are **grounded + provenance-stamped**, unlike archetype templates.
- The canonical `dominant_narrative` remains **derived** from the goal set; `submit_narrative` cannot
  overwrite it (stored as a candidate fact).

## Reminders / recommendations

`life.facts` with `source_type=calendar` (carrying `calendar_event_id`) can seed reminders, and submitted
constraints/risks feed the Recommendation OS's grounded inputs. No MCP tool writes recommendations directly
— recs remain computed by `recommendations_os` from grounded evidence, preserving the trust spine.

## Net effect

MCP gives LIOS/agents a **safe ingestion membrane**: structured, validated, provenance-tracked, idempotent,
tenant-scoped — feeding the existing canonical model and intelligence without any uncontrolled path into the
life model.
