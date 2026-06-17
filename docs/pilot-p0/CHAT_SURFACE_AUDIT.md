# Chat Surface Audit (P0-2)

**Date:** 2026-06-16 · **Goal:** never show a fake chat, test copy, or internal placeholder language. Five chat surfaces exist; three were already real, two were not — both now redirect to the real advisor.

## The five surfaces

| id     | Surface                         | Route / mount                              | State (before)                                                                                                                                                                              | Action                                                          |
| ------ | ------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| CHAT-1 | Governed "AI Assistant" sidebar | `components/chat/ChatSidebar.tsx` (global) | **WORKING** — POSTs `/api/agent/chat?stream=true` (governed factory, buffered through the safety gate); already has a disclaimer                                                            | none                                                            |
| CHAT-2 | Arcana Advisor / Discovery      | `/dashboard/advisor`                       | **WORKING** — proxies the Core API discovery advisor (`/api/life/discovery-chat`), returns validated turns                                                                                  | none (P0-3 adds context-aware disclosure)                       |
| CHAT-3 | Dashboard Chat (history)        | `/dashboard/chat`                          | **WORKING** — same governed backend as CHAT-1; honest empty state                                                                                                                           | P0-3 disclosure mounted                                         |
| CHAT-4 | Roadmap multi-agent chat        | `/dashboard/roadmap/chat`                  | **PLACEHOLDER** — returned hardcoded `"This is a placeholder response… implemented soon"` via `setTimeout`; orphan route (no nav link)                                                      | ✅ **REDIRECT → /dashboard/advisor**                            |
| CHAT-5 | "Discovery" (What-What-Why)     | `/conversation`                            | **FAKE (scripted)** — client-side `ConversationEngine` returning random question templates with client-computed "confidence" scores; no LLM, no backend; **linked live from the dashboard** | ✅ **REDIRECT → /dashboard/advisor** + dashboard link repointed |

## Fixes applied

### CHAT-4 — Roadmap placeholder chat

- `app/dashboard/roadmap/chat/page.tsx` replaced with a server-component `redirect('/dashboard/advisor')`. The hardcoded placeholder reply and the five fake "agents" are gone.
- `app/dashboard/layout.tsx:18` — removed `/dashboard/roadmap/chat` from the `isImmersive` check (now only `/dashboard/advisor`).
- It was an orphan (no `href`/`router.push` anywhere pointed to it), so nothing else needed touching.

### CHAT-5 — Scripted `/conversation` fake (newly caught — not in the original audit)

- `app/conversation/page.tsx` replaced with a server-component `redirect('/dashboard/advisor')`. The scripted no-LLM engine (random templates, fabricated confidence/authenticity scores) is no longer reachable.
- The one live inbound link — the dashboard "Discovery" quick action (`components/dashboard/DashboardClient.tsx:138`) — was repointed to `/dashboard/advisor`.
- This also resolves a known UX trap: persona-activated users couldn't pass `/conversation`'s prerequisite wall (noted in `AskAdvisorButton.tsx`). They now reach the real advisor directly.

## Why redirect rather than delete

Redirecting (vs deleting) means any bookmarked/typed URL or stray internal reference lands on the **real, validated advisor** instead of a 404 — strictly better for a pilot user. The scripted engine and placeholder components remain in the tree as dead code (no route reaches them) and can be removed in post-pilot cleanup.

## Verdict

**No user-reachable fake chat remains.** Every chat entry point now leads to a real, governed, validated conversation (CHAT-1/2/3) or redirects to the canonical advisor (CHAT-4/5). No test copy or internal placeholder language is reachable.
