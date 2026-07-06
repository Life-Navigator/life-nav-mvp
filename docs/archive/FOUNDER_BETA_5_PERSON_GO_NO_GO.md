# FOUNDER_BETA_5_PERSON_GO_NO_GO.md — 2026-06-25 (commit b9db4a3)

## VERDICT: NO-GO for the 5-person founder beta until the EMAIL gate closes.

Every prerequisite EXCEPT live magic-link email is verified GO. The gate is one secure command away
(`EMAIL_AUTH_LAUNCH_GATE_REPORT.md`); I cannot close it without the owner-provided secrets (by rule, not in chat).

- Commit SHA: `b9db4a3` · Deployed URL: https://lifenavigator.tech · core-api: lifenavigator-core-api.fly.dev

## Verified this sprint

| Item                                                  | Result                                                                                                                                                                     |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Advisor live LLM-path regression (deployed, non-root) | ✅ PASS — enhanced, vertex_gemini/gemini-2.5-pro, provider_called=true, fallback_cause=none, ~44s                                                                          |
| advisor_turns durable persist (item 5)                | ✅ FIXED — whitelisted to table columns; rows 639→640 on a live turn; no 400 in logs                                                                                       |
| Fallback observability (causes + structured fields)   | ✅ live                                                                                                                                                                    |
| Tests                                                 | ✅ 698 core + 12 release-hardening pass                                                                                                                                    |
| Mobile basic smoke (item 4)                           | ⚠️ USABLE w/ rough edge — login ✅, dashboard ✅, advisor page ✅; nav drawer opens OVER content on first load (dismissible). No broken layout. Fix before 20-person beta. |
| Logout → login (password)                             | ✅                                                                                                                                                                         |

## BLOCKED (gate)

| Item                                       | Status                                               |
| ------------------------------------------ | ---------------------------------------------------- |
| 1. Supabase/Resend email config            | ⛔ needs owner secrets via secure env (script ready) |
| 2. Two clean non-founder magic-link logins | ⛔ depends on (1) + real inboxes the owner checks    |
| 3. 5-person signup/onboarding smoke        | ⛔ depends on (1)                                    |

## Known risks

- Advisor latency ~44s/turn (real Gemini 2.5 Pro + supervised repair); streaming masks first paint.
- Mobile nav drawer over content on first load (usability rough edge, not a blocker; follow-up before 20-person).
- Occasional finance fallback on an LLM-invented $ (trust spine working; cause-aware copy).

## Path to GO (5 founders)

1. Owner runs the secure email config command → script reports Resend verified + 2 sends OK.
2. Both test inboxes click the link → land on /dashboard (clean browser) → refresh persists → logout/login.
3. Re-run `node apps/web/scripts/advisor-live-regression.mjs` → PASS.
4. Flip this verdict to **GO for 5**. (20-person stays NO-GO until the 5 complete without major issues.)

## Follow-up issue (do not lose)

- [ ] Mobile: collapse nav drawer by default on first load (isMobile starts false → sidebar flashes open).
      Owner of layout/Sidebar.tsx. Target: before 20-person beta.
