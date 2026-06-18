# Monday Go / No-Go

**Date:** 2026-06-18 · Verdict: **BLOCKED** — on exactly two fast owner items. Everything code-side is GO.

This is honest, not pessimistic: the platform is built, tested, deployed, and the edge trust-breaks found in the journey audit were fixed this sprint. Two things stand between here and launch, and both take under ~30 minutes total — but until they're done, the truthful answer is BLOCKED (no middle ground).

## The 10 questions

| #   | Question                                 | Answer                                                                                                                                                                               |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Can a new user complete onboarding?      | ✅ Yes — magic-link → advisor discovery → reveal → dashboard (verified in code; needs the live smoke to confirm visually).                                                           |
| 2   | Does Arcana understand them?             | ✅ Yes — narrative-first discovery, 5/5 personas validated.                                                                                                                          |
| 3   | Does the data persist?                   | ✅ Yes — goals/objective/constraint/narrative/risk-profile persist; migrations applied; live write validated.                                                                        |
| 4   | Does the dashboard reflect reality?      | ✅ Yes — canonical `/v1/life/my-life` contract; hero now shows quantified impact + confidence + why-#1 (was 4.5→~8/10).                                                              |
| 5   | Are recommendations valuable?            | ⚠️ Good, not perfect — ~8/10 after the hero fix; "time horizon/cost-of-inaction" aren't fields (would need new intelligence). Not a blocker.                                         |
| 6   | Is the report useful?                    | ⚠️ ~7/10 — in-app viewer leads with the narrative; impact-key fixed. PDF-narrative-lead + tool-calculations are P1 (week 1). Not a blocker.                                          |
| 7   | Is the graph understandable?             | ⚠️ ~6/10 — honest + provenance-rich, but ontology-styled; readiness read fixed. Legibility redesign is P1. Not a blocker (graph is secondary).                                       |
| 8   | Are integrations stable?                 | ✅ Yes for the pilot — calendar now **degrades gracefully** (no dead-ends, no raw JSON, no 404) whether or not OAuth creds are provisioned; email + health are honest "Coming soon". |
| 9   | Is analytics capturing feedback?         | ✅ Wired end-to-end with honest empty states; **verify a real write stores in the live smoke** (silent-loss caveat).                                                                 |
| 10  | Would you personally invite a VC Monday? | **Yes — once the keys are rotated and the 10-min smoke passes.** Not before (security).                                                                                              |

## What blocks launch (exactly two — both owner, both fast)

1. 🔴 **Rotate the exposed Supabase PAT + service-role/anon keys.** Security — the PAT can run admin DDL on prod; it must die before real users' data is in play. (~minutes.)
2. 🟠 **One 10-minute live UI smoke** with a magic-link test user (onboarding → reveal → dashboard → recommendations → report → feedback → confirm in `/dashboard/pilot-analytics`). Confirms the full live path + that feedback actually persists.

## NOT blockers (resolved this sprint or optional)

- Edge trust-breaks (`/settings/integrations` 404, OAuth raw-JSON, stray `/email`, weak hero, graph readiness, report impact-key) — **fixed**.
- Google/Microsoft OAuth creds — **optional**; calendar degrades gracefully. Provision when ready; add pilot users as test users if enabling.
- Recommendation/report/graph not hitting the aspirational 9/9/8 — improved + honest; the residual gaps need new intelligence/redesign (out of scope), not launch.

## When it flips to GO — top 5 to monitor in week 1

1. **Narrative accuracy** — the pilot feedback instrument; is the dominant narrative right per user? (target >8.5)
2. **Feedback actually storing** — watch `pilot_feedback` row count vs sessions; the silent-loss path means a zero-growth count is a red flag.
3. **Advisor latency / intermittent 502** on the discovery opener — the known flaky path; watch for empty-chat starts.
4. **Recommendation grounding** — any rec without evidence, or a number that looks off, to a CFP/CPA's eye.
5. **Trust + return intent + NPS** — the headline pilot signals; any detractor comment triaged within a day.

## Verdict: **BLOCKED** (rotate keys + run the 10-min smoke → then GO)
