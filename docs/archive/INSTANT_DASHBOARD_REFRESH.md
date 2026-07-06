# INSTANT_DASHBOARD_REFRESH.md — Phase 1

## What's delivered

The **Impact Summary Card is the instant payoff** — it renders the real life-model change immediately in-chat, no reload. The new confirmed facts power the advisor right away and appear in the dashboard "Recently learned" strip on next load.

## Honest limit

The advisor chat page (`/dashboard/advisor`) cannot live-refresh the **dashboard page** (`/dashboard`) — they're separate routes/component trees. So the dashboard cards update on navigation, not via a push from the chat. The genuinely instant surfaces are: the Impact Card (in-chat) and the advisor's own grounding (next message cites the new facts).

## What would make it fully live

The **floating chat launcher** (compact variant) runs ON the dashboard — there, on action approval, dispatch a window event that the dashboard listens for to re-fetch its cards. That's a small, honest follow-up (a CustomEvent + a listener), and it would make the dashboard cards visibly update the moment the user approves. Not wired this sprint.
