# TOP 50 BETA FIXES

**Date:** 2026-06-04
**Scope:** the full current experience (marketing → register → onboarding → activation → dashboard → chat), audited against a 5→20→public beta.
**Priority:** **P0** = blocks/breaks the core beta journey · **P1** = materially hurts activation/trust/conversion · **P2** = polish/conversion lift · **P3** = nice-to-have.

> Context: the _infrastructure_ is solid (governed chat live, persona activation live, graph promotion fixed). The gaps are now **experience, legibility, and first-run value.**

---

## P0 — must fix before 5 users (blocks the journey or the wow)

1. **Dashboard must render the activated persona's financial data.** Data lands in `finance.*`, but the dashboard read routes (`/api/integrations/plaid/accounts|transactions`) still target the non-existent `public` schema → the dashboard can show empty. Point them at persisted `finance.*`. _(Without this, activation → empty dashboard = no wow.)_
2. **First-run dashboard must show a real insight, not a blank/loading grid.** Server-render one true, persona-specific sentence on first paint (see ACTIVATION step 7).
3. **Remove the 10-section intake from the critical path.** Today register → "Set up LifeNavigator" (10 sections) buries value behind ~30 min of forms. Route new users straight to _Select Life Scenario → Activate → Dashboard_; collect deep data progressively.
4. **Verify the production deploy pipeline is stable for the cohort.** Vercel production branch is still `main` while the app lives on `mvp` (deploys are manual one-offs). Set Production Branch → `mvp` so a stray `main` push can't ship stale code mid-beta.
5. **Auth happy-path must be airtight** (register → verify → land on activation). Eliminate any verify-email dead-ends, redirect loops, or "Set up" detours before first value.
6. **Activation failure must never show a stack trace.** Confirm the friendly 503/error copy paths on Plaid/Supabase/model hiccups (we added them) across the whole activate→dashboard chain.
7. **First recommendation/chat must survive a transient model error.** (Gemini retry is in — confirm it's exercised on the web path, not just the Edge Function.)
8. **"Sample data / no real bank" reassurance must appear at the activate step** (it does in the component — verify it's prominent; it's the #1 objection at peak friction).

## P1 — fix before 20 users (activation, trust, conversion)

9. **Reposition above the fold** to the family-office category (POSITIONING_AUDIT) — current "Navigate your life with confidence" reads generic.
10. Replace freemium "Get Started Free" with beta-appropriate **"Request access"** (premium + exclusivity).
11. Add the **trust band** (3 pillars) directly under the hero.
12. Add a **"How it thinks"** (AI Architecture) section — our biggest hidden differentiator.
13. Surface the **governance/"why" affordance** on recommendations and chat answers (we built the audit + why-chain; it's invisible).
14. Add seeded, data-specific **chat starters** (blank chat box = drop-off).
15. Design the **"Setting up your office…" activation state** (micro-steps, not a spinner).
16. Add a **"Today's brief"** on return visits (a reason to come back → retention).
17. Make the persona dropdown feel like **"try a life,"** with a recommended default highlighted.
18. **Security/Governance page** with plain-language depth + an anonymized real governance verdict.
19. **Data export + delete** in settings (+ footer link) — control = trust.
20. Tabular numerals for **all money figures** (financial credibility; currently default font).
21. Fix the remaining broken Plaid read routes (`accounts/transactions/disconnect` → `finance` schema) so real-Plaid (post-beta) works and the dashboard is consistent.
22. **Persona-aware dashboard differences must be visible** (a Young Professional and an Executive must clearly look different — the data supports it; the UI must show it).
23. **Mobile pass** on hero, onboarding, dashboard, chat (sticky CTA, single column).
24. **Empty/zero states** designed everywhere (no bare grids/blank panels).
25. **Loading skeletons** that match final layout (perceived speed).
26. Add a **comparison block** (vs ChatGPT / vs budgeting app).
27. Clarify the **"not a licensed advisor"** framing wherever money advice appears (trust, compliance).
28. **Pricing page** with a premium anchor + "founding member" beta framing.
29. **Onboarding progress + "skip for now"** everywhere (no forced long forms).
30. **Error toasts are human** ("We couldn't reach your accounts — try again" not error codes).
31. **Daily-brief / change-detector** job (the retention engine).
32. **Analytics/event instrumentation** on the funnel (we have `analytics.user_events` now — confirm key steps fire: registered, scenario_selected, activated, first_insight_viewed, first_recommendation, first_chat).

## P2 — conversion + polish

33. Hero **"brief" proof artifact** (typing animation) instead of a static screenshot.
34. Number **roll-up** animation on money figures.
35. **Persona switch cross-fade** ("watch the advice change").
36. Section **reveal-on-scroll** (subtle), reduced-motion respected.
37. Replace cyan→sky gradient with the **warm-paper + single-accent** system (DESIGN_SYSTEM_V3).
38. **Monoline icon set** + one glyph per advisory desk.
39. The **personal-graph signature visual** in the AI section + faint hero backdrop.
40. **FAQ** section (objection-killers).
41. **Footer** rebuild (institutional-calm; Product/Trust/Company/Legal).
42. **Status/uptime** link (operational seriousness).
43. **"Founding cohort"** social proof (no fake testimonials).
44. **Dashboard density toggle** (calm ↔ detailed).
45. **Scenario Lab** entry from the dashboard (the "see your next 5 years" hook).
46. **Keyboard + a11y** pass (focus rings, contrast, reduced motion).
47. **OG/meta/share cards** (the site looks premium when shared).
48. **Performance budget** (Lighthouse ≥ 90; the build is green — verify runtime).

## P3 — later

49. Dark mode polish (true-dark, lifted neutrals).
50. Micro-delight: the "governed" check that draws on first view; a tasteful first-recommendation celebration.

---

## The 8 that actually gate a _good_ 5-user beta

P0 #1–#8. If only those eight ship, a new user reaches a **populated, persona-specific dashboard with a real first insight and a working governed conversation in < 5 minutes**, with no dead ends — which is the bar. Everything else raises _conversion_ and _premium feel_ for the 20-user and public phases.
