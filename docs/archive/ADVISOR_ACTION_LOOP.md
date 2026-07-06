# ADVISOR_ACTION_LOOP.md

## What it is

Five explicit, **approval-gated** life-change actions. Arcana detects a change, proposes the impact + the fields to collect, the user approves, and ONLY THEN does it write — through the existing MCP/IngestionService path. Not a generic framework, not an autonomous agent, not a workflow engine.

## The flow (no silent writes, ever)

```
user says something
  → POST /v1/life/advisor/action/detect   (deterministic, NO write) → {action, impact[], fields[]}
  → ActionCard renders: impact chips + editable fields + Approve/Cancel
  → user clicks "Approve & update"
  → POST /v1/life/advisor/action/apply     (THE write — only here)
       → advisor_actions.apply() → IngestionService.submit_life_fact() per field
         (tenant-scoped from JWT, confirmation_status="confirmed", provenance submitted_by="arcana-action-loop",
          idempotency_key="action:{type}:{fact_type}")
  → result summary: what was saved + what refreshes
  → confirmed life.facts surface in the dashboard "Recently learned" strip + advisor citations on next read;
    readiness recomputes on read; recommendations sync on the recommendations page load
```

## The 5 actions (all verified writing to life.facts)

| Action            | Trigger e.g.                     | Domain    | Facts written                                  |
| ----------------- | -------------------------------- | --------- | ---------------------------------------------- |
| Promotion         | "I got promoted"                 | career    | title, base_salary, annual_bonus, equity_grant |
| New child         | "we're having a baby"            | family    | expecting_child, child_due_date, child_name    |
| Home purchase     | "we bought a house"              | finance   | purchase_price, down_payment, mortgage_balance |
| Degree enrollment | "I enrolled in the MS"           | education | enrollment, tuition, program_duration          |
| Health goal       | "lose 30 lbs before the wedding" | health    | goal, goal_target_date                         |

## Files

- `app/services/advisor_actions.py` — the 5 actions (detect/proposal/apply). Writes ONLY via IngestionService.
- `app/routers/life.py` — `POST /v1/life/advisor/action/{detect,apply}`.
- `apps/web/src/app/api/chat/action/route.ts` — auth proxy.
- `apps/web/src/components/chat/CommandCenter.tsx` — `ActionCard` + approval wiring.
- `tests/test_advisor_actions.py` — 7 tests (detection, no silent writes, ingestion-only, idempotency).

## Guarantees

- **Approval required**: `apply` is a separate explicit call; `detect`/`proposal` never write.
- **MCP-only writes**: facts go through `IngestionService.submit_life_fact` (validated, tenant-scoped, provenance-stamped). No direct DB writes.
- **Idempotent**: re-approving the same change is a safe upsert (deterministic id), not a duplicate.
