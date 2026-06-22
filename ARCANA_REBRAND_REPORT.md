# ARCANA_REBRAND_REPORT.md — Phase 4

## Finding

The advisor displayed as **"Relationship Manager"** (header + loading state), weakening the Arcana brand. The displayed name comes from the **backend agent roster** (`/v1/life/advisor/agents`), not just the frontend — so both layers needed the change.

## Changes (shipped)

- **Backend** `advisor_agents.py:42`: orchestrator `name="Relationship Manager"` → **`"Arcana"`**; persona self-reference "You are the Relationship Manager" → **"You are Arcana"**. (Core-api deployed.)
- **Frontend** `lib/chat/agents.ts`: `AGENT_FALLBACK` name + `agentName()` default → **"Arcana"** (so the fallback matches when the backend roster isn't loaded).

Left intentionally unchanged: internal identifiers (`RELATIONSHIP_MANAGER = "relationship_manager"` id, the service file `relationship_manager.py`, code comments) — renaming those is risk with no user-facing benefit.

## Verification (live, Playwright + API)

- `/v1/life/advisor/agents` → names now `['Arcana', 'Finance Advisor', 'Career Advisor', …]` (was "Relationship Manager").
- Advisor header → **"Arcana"**; "Relationship Manager" no longer present.
- Loading state → **"Arcana is checking your documents and facts…"**.

## Consistency check

| Surface                      | Shows     |
| ---------------------------- | --------- |
| Advisor header               | ✅ Arcana |
| Chat loading state           | ✅ Arcana |
| Agent roster (dropdown)      | ✅ Arcana |
| LLM self-reference (persona) | ✅ Arcana |

## Status: REBRANDED + DEPLOYED + VERIFIED

</content>
