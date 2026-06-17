# Dashboard Excellence Report — Elite 20-Person Pilot

**Verdict:** A trust-disciplined life cockpit with a genuinely strong server-rendered hero — undermined by stub domain pages, redundant stacked heroes, and consumer-grade chrome ("Choose Sandbox Persona", emoji voting) that a skeptical exec will read as a demo. **Score: 6/10.**

Scope: code-level audit of `apps/web/src` dashboard surfaces. Every claim is cited to `file:line` with quoted code. No mock data was assumed — flagged below where stubs or placeholder copy exist.

---

## 1. First impression — cockpit or template?

**Mixed.** The main dashboard (`app/dashboard/page.tsx`) is well-architected: it server-computes a deterministic recommendation set and renders `ExecutiveSummary` → `LifeIntelligence` → `MissionControl` → `DashboardClient` (page.tsx:63-81). The Executive Summary hero (readiness ring + north star + next-best-action gradient card) is legitimately premium and trust-first.

But the page stacks **three competing heroes** that each re-render readiness, vision, and next-best-action:

- `ExecutiveSummary` renders a 128px readiness ring + vision + NBA gradient card (ExecutiveSummary.tsx:208-332).
- `LifeIntelligence` renders vision + primary objective + "Life model coverage %" again (LifeIntelligence.tsx:98-174).
- `MissionControl` renders a _third_ readiness ring + a _second_ "next best move" card (MissionControl.tsx:171-206).

An elite user scrolls past the same readiness score and the same "next best move" three times in the first viewport region. That reads as un-edited accretion (Sprint 23 + Sprint 35 + P4 all left in place), not a designed cockpit.

The bottom of the dashboard then drops to clearly consumer-grade chrome: a 6-tile emoji Quick Actions grid (DashboardClient.tsx:1054-1067, icons `🎨 🎯 💭 📊 🧮 👨‍👩‍👧‍👦`) and a "Help Shape the Future" feature-voting widget with Habit Tracker / Social Network / AI Life Coach (DashboardClient.tsx:1070-1116). A VC or attorney will not vote on a "Milestone Celebrations" feature; this belongs in a beta feedback panel, not the primary cockpit.

## 2. Information hierarchy — is the #1 thing obvious in 3 seconds?

**Partially.** The intended #1 thing is the **next best action** (the indigo→violet gradient card, ExecutiveSummary.tsx:299-332) — good choice, well-styled. But it competes for "most important" with the readiness ring directly to its left and is then _duplicated_ by MissionControl's "Your next best move" (MissionControl.tsx:191-205). Because three heroes each claim primacy, the eye has no single anchor. A true Bloomberg-grade screen has one unmistakable focal point; this has three.

Also note: `DashboardClient` re-introduces a large `Welcome back, {userName}!` H1 + "Here's your life overview for today" (DashboardClient.tsx:530-535) _below_ the executive summary — a second page title mid-scroll, pushing the metric grid further down.

## 3. Data integrity — every number real and traceable?

**Strong. The net-worth unification held.** This is the standout. Three independent surfaces all read the single canonical endpoint:

- Dashboard Financial Overview card: `/api/finance/canonical-summary` (DashboardClient.tsx:453-458), explicitly commented as "the SAME canonical endpoint as the Financial Overview page".
- Finance Overview page tiles: same source via `useFinanceData()` → `/api/finance/canonical-summary` (FinanceDataContext.tsx:35-39; finance/overview/page.tsx:21-52).
- Server `/api/dashboard/summary` route: locally sums accounts as a _fallback only_, then overrides with the canonical `/v1/finance/canonical-summary` whenever reachable (summary/route.ts:86-115), with an inline note that the prior bug "produced a net worth that contradicted the resolver/canonical summary by ~$1M". The net-worth definition is now identical everywhere (`total assets − all liabilities incl. mortgage`, summary/route.ts:65-71).
- `NetWorthSummary` renders an **honest MISSING state, never a fabricated $0** when no canonical summary exists (NetWorthSummary.tsx:36-45).

Provenance is surfaced: the finance card prints a source label (Plaid Sandbox Persona / User Entered / Uploaded Document / Deterministic Tool) plus last-updated date (DashboardClient.tsx:607-621), and `ExecutiveSummary`/`LifeIntelligence` gate against archetype-template risks/opps so generic labels are never shown as personalized (LifeIntelligence.tsx:28-50, 92-95).

**One integrity smell:** the source label literally renders **"Plaid Sandbox Persona"** to the user (DashboardClient.tsx:613). For a pilot of VCs/physicians, "Sandbox" telegraphs "this is fake/demo money" — correct for honesty, terrible for the wow bar. Same word in the empty state: "No financial data yet. Choose a sandbox persona to get started." (DashboardClient.tsx:650).

`studyStreak` is hardcoded to `0` in the summary route (summary/route.ts:286) — honest (not fabricated) but means the Education card's "Study Streak: 0 days" is dead weight.

## 4. Empty-state honesty + quality

**Honesty: excellent. Quality: uneven.**

- Genuinely inviting empty states: `ExecutiveSummary` no-discovery card ("Let's build your life model… Nothing here is generated until it's grounded in what you tell us", ExecutiveSummary.tsx:180-205); `MissionControl` activation state with a "Preview with sample data" loop and an explicit "This is illustrative" disclaimer (MissionControl.tsx:96-163); `DomainCoverage` replaces generic empty cards with coverage % + missing input + unlocks + CTA (DomainCoverage.tsx:38-87).
- **Broken-feeling:** the entire **Health Overview** page (`healthcare/overview/page.tsx`) mounts `HealthScore` and `VitalsTrends`, both of which have their fetch **commented out** and _always_ `setData(null)` (HealthScore.tsx:29-35; VitalsTrends.tsx:46-52). The page can never show data — it is two permanent "Connect Device" empty cards plus a real `MedicationTracker`. For a physician this is the most damning surface in the app.

## 5. Cross-domain coherence — one life model or 5 modules?

**Leans toward "one model" at the top, fragments at the domain layer.** The top of the dashboard is explicitly life-first: `LifeIntelligence` is documented as "the dashboard begins with the user's LIFE MODEL, not domains" (LifeIntelligence.tsx:3-5), and each domain card carries a "Working toward: {objective} · Source: Advisor Discovery" line tying it back to the life model (DashboardClient.tsx:55-65). Readiness, My Life, and Family Office all read shared canonical models.

But the **domain overviews are inconsistent in maturity**, which breaks the illusion of one coherent system:

- Finance Overview: rich, real, single-source (finance/overview/page.tsx).
- Health Overview: two non-functional stubs (above).
- Career Overview: a bare `redirect('/dashboard/career')` (career/overview/page.tsx:1-5).
- Education Overview: a hardcoded **"Education Dashboard Coming Soon"** marketing page with a fake email capture that only `console.log`s and never hits an API (education/overview/page.tsx:7-17, 28-35) — comment literally says "In a real app, you would send this to your API". This violates the "no placeholder" bar outright.
- Family Office: genuinely strong (estate/trust/beneficiary/survivor pillars with G/Y/O/R + attorney boundary disclaimer, family-office/page.tsx:99-147).

Five domains at five different maturity levels = reads as five modules, not one product.

## 6. Visual / interaction polish gaps a skeptical exec notices

- Two page titles (ExecutiveSummary hero, then "Welcome back, {userName}!" H1, DashboardClient.tsx:530).
- Emoji as primary UI: Quick Actions icons (DashboardClient.tsx:1061), notification icons `ℹ️✅⚠️❌⏰` (DashboardClient.tsx:940-946), empty-state `🔔 🎯 💪 ❤️` (DashboardClient.tsx:926,1008; HealthScore.tsx:61; VitalsTrends.tsx:76). Acceptable in a consumer app, off-brand for a family-office tool.
- Triplicated readiness ring/NBA (sections 1-2).
- `userName` falls back to the raw email address (DashboardClient.tsx:247,261) — an exec may see "Welcome back, jsmith@sequoiacap.com!".
- "Help Shape the Future" voting and "Join Desktop Waitlist" CTA (education page:97-102) are growth-hack surfaces inside the cockpit.
- Feature-vote button stores votes only in local component state (DashboardClient.tsx:469-479) — clicking "Vote" persists nothing; honest (no fake totals) but a dead interaction.

---

## Top 5 issues (ranked)

1. **Education Overview is a fake "Coming Soon" page with a no-op email form.** `app/dashboard/education/overview/page.tsx:7-35` — placeholder marketing copy + `handleSubmit` that only `console.log`s ("In a real app, you would send this to your API", line 13-16). Direct violation of the no-placeholder rule. **Fix:** either redirect to `/dashboard/education` (like career/overview does) or render the real `DomainCoverage` + canonical education summary. Delete the email form.

2. **Health Overview page can never show data — two stubbed components.** `components/health/overview/components/HealthScore.tsx:29-35` and `VitalsTrends.tsx:46-52` have fetch commented out and hardcode `setData(null)`. **Fix:** wire to a real `/api/health/score` + `/api/health/vitals` (or the `health_meta` signals already read in summary/route.ts:172), or remove the page and route `/healthcare/overview` to the working healthcare landing. A physician must not land on permanent "Connect Device" stubs.

3. **Three stacked heroes duplicate readiness + next-best-action.** ExecutiveSummary.tsx:208-332, LifeIntelligence.tsx:98-174, MissionControl.tsx:171-206 all render overlapping vision/readiness/NBA. **Fix:** collapse to one hero. Keep `ExecutiveSummary` as the single cockpit hero; demote `MissionControl` to the journey-progress + gaps strip only (drop its ring + NBA card, MissionControl.tsx:174-206); fold `LifeIntelligence`'s unique pieces (themes, competing objectives, coverage %) into ExecutiveSummary or a single secondary row.

4. **"Sandbox Persona" / "sandbox" language shown to elite users.** DashboardClient.tsx:613 ("Plaid Sandbox Persona") and :650 ("Choose a sandbox persona to get started"). **Fix:** map the source label to neutral language ("Connected accounts (sandbox)" only in a tooltip, or "Linked via Plaid"); change the empty CTA to "Connect your accounts" / "Add your finances". Never surface the word "sandbox" as the headline value source.

5. **Consumer chrome in the cockpit: emoji Quick Actions + feature-voting widget.** DashboardClient.tsx:1049-1116. **Fix:** replace emoji tiles with lucide icons matching the rest of the app, and move "Help Shape the Future" voting into a dismissible beta-feedback panel (or `/dashboard/settings`), not the primary surface.

## Top 3 highest-leverage "wow" upgrades

1. **One unmistakable focal point.** Make the next-best-action card the single, full-width hero with the quantified impact pulled forward (the data already exists: `qi.financial_impact_annual`, `retirement_success_before/after` in my-life/page.tsx:133-138 and MissionControl sample:149-154). "Your single highest-leverage move this quarter: +$X/yr, retirement success 72%→88%" — one number, one action, evidence link. That is the Bloomberg-terminal moment.

2. **Provenance as a feature, not fine print.** The app already tracks source + last-updated + confidence everywhere (DashboardClient.tsx:607-621; ProvenanceBadge in ExecutiveSummary.tsx:218). Elevate it: every headline number gets a hover citation ("Net worth $X — from 4 linked accounts, updated 2h ago"). Elite users trust what they can audit; this is a genuine differentiator already 80% built.

3. **A real cross-domain "Life Readiness" tape across the top.** The per-domain readiness data is already canonical (readiness/page.tsx, ExecutiveSummary domain readiness:445-475). Render it once as a single horizontal G/Y/O/R strip (Finance · Health · Career · Education · Family · Estate) at the very top — one glance, whole life. This replaces three rings with one coherent instrument and finally makes it feel like ONE life model.

## What's genuinely excellent

- **Net-worth single-source-of-truth is rock solid** and well-documented — the prior ~$1M contradiction fix held across all four surfaces (summary/route.ts:86-115; DashboardClient.tsx:453-458; FinanceDataContext.tsx:35-39; NetWorthSummary.tsx:36-45).
- **Trust discipline is real, not cosmetic:** archetype-template risk/opp gating (LifeIntelligence.tsx:28-95), honest MISSING states over fabricated zeros (NetWorthSummary.tsx:36-45), per-section source labels on My Life (my-life/page.tsx:55-57, 119-121), and the "Plaid Sandbox" honesty itself.
- **Family Office** is a legitimately premium, family-office-grade surface (G/Y/O/R pillars, weakest-pillar guidance, attorney boundary disclaimer — family-office/page.tsx:99-147).
- **Resilience:** the dashboard never blocks on the insight (page.tsx:59-61) and finance card distinguishes loading/error/empty so it never flashes "no data" mid-fetch (DashboardClient.tsx:120-122, 630-659).
