# HIGH_PRIORITY_GAPS.md

Top 10 verified blockers to 95+/100, ranked by leverage. Every gap was observed live (Playwright, prod, real users) — not theorized. Columns: Severity · User impact · Investor impact · Fix complexity · Est. score gain.

| #   | Gap (verified)                                                                                                      | Sev              | User | Investor                     | Complexity                              | +Score |
| --- | ------------------------------------------------------------------------------------------------------------------- | ---------------- | ---- | ---------------------------- | --------------------------------------- | ------ |
| 1   | **Recommendations page renders BLANK** despite the user having 9 stored recs (finance 1, family 5, health 3)        | 🔴 High          | High | High                         | **Low–Med** (render/wiring)             | +2–3   |
| 2   | **Advisor unresponsive** — "thinking…" 12s+ with no visible reply; no streaming/progress                            | 🔴 High          | High | **Critical** (a demo stalls) | Med                                     | +2–3   |
| 3   | **Recommendations not generated platform-wide** — only 1 of 182 users has any                                       | 🔴 High          | High | High                         | Med (trigger generation on data change) | +1–2   |
| 4   | **Dashboard "still forming"** Life Brief even with 52 life.facts; sparse feel                                       | 🟠 Med-High      | Med  | High                         | Med                                     | +1     |
| 5   | **Career comp/benefits not surfaced** on the Career page (engine exists at /v1/benefits)                            | 🟠 Med           | Med  | Med                          | **Low** (proxy + card)                  | +1     |
| 6   | **Advisor is read-only** — can't act (no state-change → approval → MCP write); the Sprint-C vision                  | 🔴 High (vision) | High | High                         | **High** (real build)                   | +2     |
| 7   | **Advisor branding "Relationship Manager"** instead of Arcana; inconsistent voice                                   | 🟡 Low           | Low  | Med                          | Low                                     | +0.5   |
| 8   | **Health overview thin** — the rich intelligence lives in a sub-tab, not the main Health page                       | 🟡 Med           | Med  | Med                          | Low–Med                                 | +0.5   |
| 9   | **Education empty** for no-data users — no decision-center seeding/surfacing                                        | 🟡 Med           | Med  | Med                          | Med                                     | +0.5   |
| 10  | **Per-domain life.facts value rendering** — Family pillars/Career don't cite the extracted trustee/beneficiary/comp | 🟡 Med           | Med  | Med                          | Med                                     | +0.5   |

## The 5 highest-leverage VERIFIED fixes (the answer to "what's actually remaining")

1. **Fix the Recommendations render** (#1) — a core surface is blank for a user who _has_ recs. Likely a wiring bug; biggest quick win.
2. **Make the Advisor responsive** (#2) — visible streaming/progress + faster first token; the advisor is the product's headline and currently stalls.
3. **Trigger recommendation generation for all users** (#3) — so recs aren't empty platform-wide.
4. **Surface Career comp/benefits** (#5) + **fix the Dashboard "still forming"** (#4) — two cheap, high-visibility wins.
5. **Build the Advisor action loop** (#6) — the Sprint-C build; the largest single mover toward the "advisor OS" vision (do this after 1–4 verify).

## Sequencing logic

Fixes 1, 2, 5 are **low/medium complexity, high impact** — do them first (likely +5–7 points, clearing the 95 bar for the surfacing dimensions). Fix 6 (Advisor OS) is the big build and should follow once the cheaper wins are verified, because it's what turns "trusted but passive" into "advisor that acts."
</content>
