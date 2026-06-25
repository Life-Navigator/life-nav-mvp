# BETA_20_PERSON_GO_NO_GO.md — 2026-06-25

## VERDICT: NO-GO for beta invites until the EMAIL gate closes. Everything else is GO.

The product is ready; the only thing between you and inviting 5 users is magic-link email delivery
(needs your Supabase Management PAT + Resend key — `EMAIL_AUTH_LAUNCH_GATE_REPORT.md`, one command).

## Readiness matrix (item 6 smoke)

| Area                                          | Status                   | Evidence                                                    |
| --------------------------------------------- | ------------------------ | ----------------------------------------------------------- |
| Advisor — Health                              | ✅ live enhanced         | 17-suite H1–H4 enhanced; web Health enhanced (44s)          |
| Advisor — Finance                             | ✅ (1 valid trust-block) | F6/F7 enhanced; F5 correctly gates an invented $            |
| Advisor — Career                              | ✅ live enhanced         | C8 (reported failure) web-enhanced 43s; C9/C10 enhanced     |
| Advisor — Education                           | ✅ live enhanced         | E11/E12 enhanced                                            |
| Advisor — Family                              | ✅ live enhanced         | Fam13/Fam14 enhanced                                        |
| Advisor — Cross-domain briefing               | ✅ live enhanced         | X15 full UI synthesis                                       |
| Advisor LLM path (non-root, live)             | ✅ regression PASS       | provider_called=true, vertex_gemini/gemini-2.5-pro          |
| Fallback telemetry / causes                   | ✅ live                  | advisor_turn log carries cause/route/provider fields        |
| Onboarding loop (no trap)                     | ✅                       | proxy safety net + 64-user backfill (prior sprint)          |
| Dashboard / finance overview / recs render    | ✅                       | prior smoke: 0 console errors; honest empty + persona data  |
| Profile / global console errors               | ✅ fixed                 | prior sprint (theme/400/404/crash)                          |
| Logout → login again (password)               | ✅                       | password session verified repeatedly                        |
| **Signup / magic-link login (clean browser)** | ⛔ BLOCKED               | email gate — needs PAT + Resend key                         |
| Mobile basic check                            | ⚠️ not verified          | desktop verified; quick mobile pass recommended after email |

## Risks / honest limitations

- **Advisor latency ~43s/turn** (Gemini 2.5 Pro + supervised repair). Streaming masks first paint; the new
  `fast` route tier trims trivial turns. Consider a faster tier or lighter repair if users complain.
- Occasional finance fallback when the model invents a derived $ (trust spine working; cause-aware copy now).
- advisor_turns DB persist returns 400 (stale table schema) — **observability is via structured LOGS**, which
  are complete; the durable table is a nice-to-have, not a blocker.
- Mobile not formally smoke-tested.

## Path to launch

1. Close email gate (run `scripts/configure-auth-email.sh` with your secrets) → verify 2 non-founder logins.
2. Quick mobile pass on dashboard + advisor.
3. Invite **5** beta users → watch `advisor_turn` logs (fallback_cause should be empty/trust-block, never
   infrastructure_auth) → fix what they surface → invite the next 15.

## Constraints honored this sprint

Trust spine intact · no fabricated $ · safety gates intact · routing never lowers safety · live web path
verified (not a root shell) · every commit summarized changed files + tests + risks.
