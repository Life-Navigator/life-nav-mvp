# P0 Pilot Blockers Report

**Sprint:** Fix Product Dead-Ends, Trust Breakers, and Pilot-Killing UX · **Branch:** `platform/pilot-p0-blockers` · **Date:** 2026-06-16

**Goal:** remove the issues that make a VC / executive / advisor / power-user think _"cool demo, brittle product."_ No new architecture, no LIOS runtime, no new agents, no model experiments — just fix the visible walls.

## Status of the seven P0s

| P0   | Item                     | Outcome                                                                                                                                                                                               |
| ---- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0-1 | Landing CTA dead-end     | ✅ **FIXED** — 4 "Request Beta Invite" CTAs repointed from the swallowing magic-link path to the real account-creation flow; 2 P1 cleanups (off-brand desktop promo removed, mislabeled quick action) |
| P0-2 | Placeholder chat         | ✅ **FIXED** — the roadmap placeholder chat and a newly-caught scripted `/conversation` fake both now redirect to the real advisor                                                                    |
| P0-3 | Advice disclaimer        | ✅ **DONE** — context-aware disclosure (none/subtle/explicit/formal); silent in discovery, escalates on finance/health/legal/tax/estate; reports' formal tier already existed                         |
| P0-4 | Supabase token rotation  | ✅ **RECORDED** — `DEFERRED_UNTIL_AFTER_CURRENT_WORK`; see `SECURITY_TOKEN_ROTATION_NOTE.md`. Not rotated (still in use for dev), not blocking; owner: Timothy                                        |
| P0-5 | Health / Education stubs | ✅ **FIXED** — 14 orphaned stub files deleted (incl. fake-health-score, fake-vitals, data-losing appointment form, 2 dead sidebars); the one in-nav offender (Courses) made an honest empty state     |
| P0-6 | Graph nav wrong route    | ✅ **VERIFIED** — the flagged bug is stale; current graph nav is sound (no fix needed). See `GRAPH_NAVIGATION_FIX_REPORT.md`                                                                          |
| P0-7 | Premium model posture    | ✅ **DOCUMENTED** — `PREMIUM_MODEL_POSTURE.md`: Gemini-only, router off, health-safety on, premium gated on durable Vertex auth. No premium routing enabled                                           |

Detailed per-area reports: `CTA_AUDIT_REPORT.md`, `CHAT_SURFACE_AUDIT.md`, `ADVICE_DISCLOSURE_REPORT.md`, `HEALTH_EDUCATION_STUB_REPORT.md`, `GRAPH_NAVIGATION_FIX_REPORT.md`, `PREMIUM_MODEL_POSTURE.md`, `SECURITY_TOKEN_ROTATION_NOTE.md`.

## What changed (code)

- **Repointed CTAs:** `HeroScene.tsx`, `Navbar.tsx` (×2), `app/page.tsx` → `/auth?mode=create`.
- **Redirects:** `app/conversation/page.tsx` and `app/dashboard/roadmap/chat/page.tsx` → `redirect('/dashboard/advisor')`; cleaned `dashboard/layout.tsx` immersive check; repointed the dashboard "Discovery" quick action.
- **Disclosure:** new `lib/advice/disclosure.ts` + `components/advice/AdviceDisclaimer.tsx`; mounted in `dashboard/chat` and `dashboard/advisor`.
- **Stubs:** deleted 14 orphaned health/education files; fixed `education/courses` empty state.
- **Sidebar:** removed off-brand desktop promo + its now-unused icon.
- **Docs:** this `docs/pilot-p0/` set.

## Validation

| Check                               | Result                                                                                                                                                                                                                                                                                    |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Typecheck** (`tsc --noEmit`)      | **0 errors introduced.** 3 remaining are pre-existing in `finance/investments/page.tsx` (untouched). Stale `.next` route-types referencing deleted pages clear on rebuild.                                                                                                                |
| **Unit tests** (`jest`, full suite) | **1410 passed.** 10 failures in 4 suites (`auth-flows`, `proxy`, `LoginForm`, `RegisterForm`) — **verified pre-existing**: they fail identically on clean `origin/main` with this sprint's changes stashed. **Zero regressions.**                                                         |
| **New tests**                       | `lib/advice/disclosure.test.ts` — 7/7 pass.                                                                                                                                                                                                                                               |
| **Reference integrity**             | No surviving page links to any deleted route (the only inbound links to deleted routes came from other deleted routes); no test imports a deleted module; deleted components confirmed isolated.                                                                                          |
| **Route smoke**                     | Code-level: all routes compile; the two fakes are server-component redirects to the real advisor; deleted routes are orphaned (URL-only, now 404 by design). **Runtime click-through was not executed** (no dev server in this environment) — recommended as part of the frontend review. |

## Final verdict

### READY_FOR_PILOT_FRONTEND_REVIEW: **YES**

All seven P0 blockers are resolved at the code level with no regressions. The product no longer drops new signups, shows fake chat, renders fake health data, or hosts dead/off-brand CTAs on the main paths.

**Remaining non-blocking polish (post-pilot):**

- Feature-vote affordance toggles local state only (honestly labeled, no fake counts) — wire to a real endpoint or remove.
- Roadmap "notify" email field is console-log-only (route already `comingSoon`-gated).
- Surface `/dashboard/life-trajectory` and `/dashboard/compare-futures` in nav, or leave URL-only (product decision).
- Remove the now-dead scripted-conversation engine + placeholder components from the tree.

**Reminders before external users are invited:**

- 🔑 **Token rotation:** rotate the Supabase token (`SECURITY_TOKEN_ROTATION_NOTE.md`) before the pilot / before any external user.
- 🗄️ **Migration:** apply the pending pilot migration(s) per the broader go-live checklist.
- 🤖 **Premium routing auth:** keep Opus off until a durable Vertex service-account (auto-refresh) + usage ledger are in place (`PREMIUM_MODEL_POSTURE.md`).
- ▶️ **Runtime smoke:** do one live click-through of register → onboarding → advisor → dashboard → chat (finance topic → disclaimer) → a domain page as the final human gate.
