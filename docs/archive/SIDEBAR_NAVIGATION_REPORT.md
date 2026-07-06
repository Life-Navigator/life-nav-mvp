# P0 SIDEBAR / NAVIGATION CLEANUP — 2026-06-11

The primary sidebar went from ~27 mixed items (metrics, experiments, gated modules, Coming-Soon clutter,
an external "Premium Desktop" download promo) to **12 grouped operating areas + Settings**, with an
executive account footer. Navigation architecture only — no engine / GraphRAG / goal-hierarchy / CRUD /
reports / finance / dashboard changes. One file: `apps/web/src/components/layout/Sidebar.tsx`.

## Sidebar Audit

Full per-item disposition (label · route · was · now · reason) + domain-tab mapping is in
**SIDEBAR_NAVIGATION_AUDIT.md**. Summary: 13 items kept/renamed to primary, 5 sub-features mapped into
their domain, 14 surfaces removed from primary (still live by direct URL), 0 routes deleted, 0 redirects.

## Routes Moved (into a domain)

Comp & Benefits → **Career** · Financial Plan → **Finance** · Family Office → **Family** ·
Health Intelligence → **Health**. (Destinations documented; the tabs themselves are domain-CRUD, out of
scope — the URLs keep working today.)

## Routes Kept (primary nav)

Core: Home `/dashboard`, My Life `/dashboard/my-life`, Advisor `/dashboard/advisor`, Life Graph
`/dashboard/life-graph`. Domains: Finance, Career, Health (`/dashboard/wellness`), Education, Family.
Intelligence: Recommendations, Reports, Documents. Account: Settings.

## Routes Hidden From Primary Nav (live by direct URL, not deleted, not redirected)

`/dashboard/readiness`, `/decision-brain`, `/life-decisions/*`, `/chat`, `/goals`, `/scenario-lab`,
`/calendar`, `/roadmap`, `/metrics`, `/military`, `/benefits`, `/planning`, `/family-office`,
`/health-intelligence`.

## Domain Tab Mapping

Finance ← Accounts/Transactions/Assets/Investments/Retirement/Insurance/Estate · Career ←
Experience/Skills/Certifications/Opportunities/Networking/Compensation · Health ←
Biometrics/Fitness/Nutrition/Labs/Medications/Insurance · Education ← Degrees/Courses/Certifications/ROI ·
Family ← Members/Dependents/Beneficiaries/Guardianship/Trusted Advisors/Estate. (Mapping only — not built.)

## Files Changed

- `apps/web/src/components/layout/Sidebar.tsx` — clean 12-item grouped `navigation` (Core / Domains /
  Intelligence / Account eyebrows via the `section` field); 3 new icons (Family=Users, My Life=Compass,
  Sign-out); flex-column shell (header `shrink-0` / nav `flex-1 min-h-0 overflow-y-auto` / footer
  `shrink-0`) so the footer never overlaps nav and nav scrolls cleanly; removed the external "Premium
  Desktop / Download" promo; new account footer (Signed in as · Active persona · Beta Sandbox · Profile ·
  real Sign out via `supabase.auth.signOut()` → `/auth`); collapsed rail keeps a sign-out icon.

## Browser Validation

Local `next dev` + prod backends, real session, fresh user, screenshots in `docs/ui-proof/`:

```
primary present:        13/13 ✓  (Home, My Life, Advisor, Life Graph, Finance, Career, Health,
                                   Education, Family, Recommendations, Reports, Documents, Settings)
group eyebrows:         Core · Domains · Intelligence · Account  (render as section headers)
moved-out leaked:       none ✓   (Scenario Lab, Decision Brain, Compare Futures, Roadmap, Goals,
                                   Comp & Benefits, Executive Dashboard, Family Office, Health Intelligence)
footer:                 Signed in as ✓ · Active persona ✓ · Beta Sandbox ✓ · Sign out ✓ · email shown ✓
domain route (Finance): ✓ /dashboard/finance   (active state highlights)
mobile drawer:          toggle present ✓ (open/close, backdrop, route preserved)
✅ 12 grouped primary items, no clutter leaked, footer shows id/persona/env/sign-out, routes work, mobile drawer toggles
```

Screenshots: `docs/ui-proof/sidebar_desktop.png` (grouped nav + footer), `sidebar_mobile_closed.png`,
`sidebar_mobile_open.png` (drawer).

## Remaining Navigation Issues

- The **military eligibility prompt** ("Are you active duty…") still renders inline at the top of the nav
  when the server flags `ask_military_question`. It's a one-time, dismissible gating question (drives
  module visibility), so I left its behavior intact — but it is the one remaining inline "card" in an
  otherwise clean nav. Could be relocated to Settings in a follow-up (would change module-gating UX, so
  out of scope here).
- Domain **sub-feature tabs** (Accounts, Transactions, Investments, Labs, etc.) are _mapped_ to their
  domains but not yet built as in-page tabs — that's domain-CRUD work, explicitly out of scope. Until
  then those surfaces are reachable by direct URL.
- `Reports` and `Documents` share a document-style glyph family; distinct enough, but a future bespoke
  Reports icon would sharpen the Intelligence group.

## Definition of Done — status

✅ Sidebar feels executive-clean (12 grouped areas, no experiments/metrics/Coming-Soon/download promo).
✅ Top-level shows only main operating areas. ✅ Sub-features mapped into domains (no route deleted).
✅ No strategic route lost (all live by direct URL). ✅ Active state correct, consistent icons, no
duplicate labels, no random badges, readable contrast. ✅ User always sees where they are, who they're
signed in as, the active persona, and the environment. ✅ Sign out works. ✅ Mobile drawer works.
