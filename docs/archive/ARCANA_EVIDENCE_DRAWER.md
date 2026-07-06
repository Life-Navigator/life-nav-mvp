# ARCANA_EVIDENCE_DRAWER.md — Phase 1

## Delivered (live, verified)

Every Arcana answer now carries a **"Why?"** toggle (hidden by default). Expanded, it shows a clean drawer — never injected into the chat text:

- **What I weighed** — the tradeoffs the model reasoned through (`reasoning.tradeoffs`: option · benefit — but cost).
- **From what you've shared** — the grounding facts in the user's own numbers (`reasoning.what_we_know`).
- **Sources** — citations with friendly source label + confidence.

## Plumbing (frontend-only)

Backend already returned `reasoning` + `citations`. Added passthrough: `send-server.ts` → `/api/chat/advisor` (`...result`) → `client.ts` SendResult → `CommandCenter` UiMessage. No backend/routing/retrieval change.

## Verified live

Promotion question → drawer rendered "What I weighed" (income-vs-security tradeoffs) + "From what you've shared" ($192k salary, $30k bonus, $400k equity, 2 dependents, $1M life insurance, $310 medical premium…) + sources. Collapsible, hidden by default. Screenshot captured.
