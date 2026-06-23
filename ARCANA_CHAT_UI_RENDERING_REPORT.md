# ARCANA_CHAT_UI_RENDERING_REPORT.md — Phase 5

## Current state

- The advisor chat (CommandCenter) renders `assistant_message` via `StreamingText`. With the backend change, that message is now **clean conversational prose** (paragraphs + one question) — no `##` headers, no `**bold**` section labels, no JSON. So it renders cleanly as-is; there are no raw-markdown walls to sanitize anymore.
- The backend now also returns `reasoning` (tradeoffs / what_we_know / what_we_still_need) and `citations` as structured fields.

## Backend-ready, frontend follow-up (honest)

The data for the requested rich UI is now available on every advisor response:

- **Sources expander** ← `citations[]` (kind/domain/label/value/sourceTable/recordId/confidence).
- **"Why / evidence" drawer** ← `reasoning` (tradeoffs as a small card, what_we_know / what_we_still_need as lists).
- **Goal/risk chips** ← `candidate_goals` + context_panel risks.

Wiring these into CommandCenter (an expandable `<details>` "Why Arcana suggests this" + a citations popover) is a **frontend-only** follow-up — no backend change needed. It is NOT yet rendered; the chat currently shows the clean conversational message + the existing citation affordance.

## Net

The P0 "no markdown report wall" is resolved (message is clean prose). The richer card/chip/drawer UI is unblocked (backend fields exist) and is the next frontend increment.
