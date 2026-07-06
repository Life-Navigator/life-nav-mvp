# Sprint Sequence: 5 → 20 Users

## Wave 0 — P0 BLOCKERS (must clear before any new user invites)

Ships the fixes that strand or mislead a no-operator user in the first 90 seconds. All are code-local.

- **W0-A Routing/contradiction:** Fix #1 (CTA off /conversation → ChatSidebar), #2 (financial summary reads finance.\*), #11 (upsert setup_completed + non-200 on error).
- **W0-B Trust copy/links:** Fix #3 (footer 404s), #5 (security delete/export copy honest), #10 (advice disclaimer), #12 (Sample data banner), #25 (SOC2/SLA qualify + remove fake votes).
- **W0-C Chat reliability:** Fix #4 (guard+retry thrown errors, add timeouts), #7 (deterministic fallback instead of 502), #6 (record 502/429 so the bug is countable).
- **W0-D Activation integrity:** Fix #8 (kill persona-merge), #9 (real reco body or remove dead call), #19 (hide dynamic_transactions).
- Dependencies: #6 depends on nothing; #7 depends on #4 landing first. #8 should land with #2 (both touch finance read/write consistency).

**GATE 0 → invite first 10 (of 20):** Manually run all 9 verified personas end-to-end on prod. Assert: (a) dashboard Financial card and First Insight agree (no "$X / No data"), (b) "Ask your advisor" opens the governed advisor and returns an answer OR a deterministic fallback — never a bare 502 — across 10 consecutive chats, (c) footer Privacy/Terms resolve 200, (d) switching from persona A to persona B shows ONLY B's data, (e) no onboarding redirect loop after activation. Chat success (incl. fallback) must be 100% user-visible; raw-502-to-user rate = 0.

## Wave 1 — P1 QUALITY & MEASURABILITY (during first-10 cohort)

- **W1-A Insight quality:** Fix #14 (rewrite Rule 5 quantified), #18 (render metric).
- **W1-B Chat grounding:** Fix #15 (persona into chat context), #22 (SSE parse fix).
- **W1-C Onboarding:** Fix #16 (confirm → financial-profile), #17 (notifications page honest), #23 (Plaid retry).
- **W1-D Observability:** Fix #13 (first_chat_message), #20 (profile_selected), #21 (signup event). Confirm migration 109 applied in prod.
- Dependencies: #15 should land after #4/#7 so chat is stable before adding context; #22 independent.

**GATE 1 → invite remaining 10 (full 20):** From analytics.user_events alone, you can answer: signups, select→activate drop-off, time-to-first-chat, and chat failure count. Across the first-10 cohort: activation success ≥ 90%, raw-502-to-user = 0, zero "merged persona" or redirect-loop reports, at least one specific (non-generic) insight per persona. Declare **READY_FOR_20_USERS** here.

## Wave 2 — P2 RETENTION & POLISH (full cohort live)

- Fix #24 (per-visit-varying brief + day-N line), goals progress strip on dashboard, persona card picker, login redirect param.
- Outbound channel stays MANUAL (founder emails) for all 20 — do NOT build email/cron infra at this scale.

**Gate criteria summary to declare READY_FOR_20_USERS:** Wave 0 + Wave 1 complete, both gates passed on prod with real persona runs, chat never surfaces a bare 502, finance surfaces never contradict, all trust claims honest, and the funnel (signup→select→activate→first_insight→first_chat) is fully queryable from one analytics stream.
