# CTA Audit Report (P0-1)

**Date:** 2026-06-16 · **Goal:** no dead clicks, no fake buttons, no placeholder experiences on landing/home/dashboard before the pilot.

## The blocker (FIXED)

**The single most important conversion path was a silent dead-end.** All four "Request Beta Invite" CTAs pointed at `/auth?mode=magic`, which renders the magic-link form calling `signInWithOtp({ shouldCreateUser: false })`. A brand-new beta user who entered their email got a "Check your email" success screen — but **no email was ever sent and no account created**, because `shouldCreateUser:false` silently no-ops for unknown emails and the error is swallowed.

**Fix:** routed all four CTAs to `/auth?mode=create` (the real account-creation form, which `resolveMode` supports). A "Request Beta Invite" click now lands on a form that actually provisions the user.

| id    | CTA                                  | file:line                            | before → after                           | status   |
| ----- | ------------------------------------ | ------------------------------------ | ---------------------------------------- | -------- |
| CTA-1 | Request Beta Invite (hero)           | `components/site/HeroScene.tsx:89`   | `/auth?mode=magic` → `/auth?mode=create` | ✅ FIXED |
| CTA-2 | Request Beta Invite (navbar desktop) | `components/marketing/Navbar.tsx:61` | `/auth?mode=magic` → `/auth?mode=create` | ✅ FIXED |
| CTA-3 | Request Beta Invite (navbar mobile)  | `components/marketing/Navbar.tsx:93` | `/auth?mode=magic` → `/auth?mode=create` | ✅ FIXED |
| CTA-4 | Request Beta Invite (beta section)   | `app/page.tsx:529`                   | `/auth?mode=magic` → `/auth?mode=create` | ✅ FIXED |

## Secondary fixes (P1, also addressed — "no fake buttons")

| id     | CTA                              | file:line                                      | issue → fix                                                                                                                                                    | status   |
| ------ | -------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| CTA-5  | "Risk Assessment" quick action   | `components/dashboard/DashboardClient.tsx:139` | label/route mismatch (pointed at `/dashboard/goals`) → relabeled **"Goals & Assessment"** to match its real destination                                        | ✅ FIXED |
| CTA-7  | "Premium Desktop / Download now" | `components/layout/Sidebar.tsx` (removed)      | off-brand external link to `nexlevel-intelligence.com` (no desktop app ships for the beta) → **removed** the promo block (and the now-unused `ArrowRightIcon`) | ✅ FIXED |
| (P0-2) | "Discovery" quick action         | `components/dashboard/DashboardClient.tsx:138` | pointed at the scripted `/conversation` fake chat → repointed to `/dashboard/advisor` (see CHAT_SURFACE_AUDIT)                                                 | ✅ FIXED |

## Consciously left as-is (documented, not a blocker)

- **CTA-8 — "Help Shape the Future" feature vote** (`DashboardClient.tsx` ~922–968): the vote toggles local state only (not persisted), but it is **honestly labeled and shows no fabricated vote counts** (there's an explicit code comment that no aggregate is shown). It is an interest-signal affordance, not a data-integrity violation. Wiring it to a real endpoint is post-pilot polish; left intentionally to avoid overbuilding.
- **CTA-6 — Roadmap "notify" form** (`app/dashboard/roadmap/page.tsx`): the Roadmap route is already gated `comingSoon:true` in the sidebar (non-clickable). Low pilot exposure; its console-log-only email field is noted for post-pilot cleanup.

## Cleared (verified real — NOT defects)

All sidebar nav targets resolve to real pages; quick actions (Benefits Discovery, Create Goal, Calculators + all 7 subroutes, Family), dashboard domain cards, "Choose Sandbox Persona", "View details", top-recommendation, MissionControl links, and marketing nav (`/product`, `/how-it-works`, `/trust`, `/security`, `/pricing`) all route to working experiences. `Education`/`Calendar`/`Roadmap` are correctly gated `comingSoon`.

## Verdict

**No dead clicks remain on the primary funnel.** The landing→signup path now provisions accounts; the off-brand desktop promo and the mislabeled quick action are gone.
