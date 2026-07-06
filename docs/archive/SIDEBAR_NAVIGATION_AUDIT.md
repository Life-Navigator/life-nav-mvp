# SIDEBAR NAVIGATION AUDIT — 2026-06-11

Navigation architecture only. No engine / GraphRAG / goal-hierarchy / CRUD / reports / dashboard /
finance changes. **No route was deleted** — items removed from primary nav stay reachable by direct URL
and (where applicable) belong inside their domain's own tabs. The primary sidebar went from ~27 mixed
items to **12 grouped operating areas + Settings**.

## New Primary Sidebar (grouped, ≤12 + Settings)

| Group        | Item            | Route                        |
| ------------ | --------------- | ---------------------------- |
| Core         | Home            | `/dashboard`                 |
| Core         | My Life         | `/dashboard/my-life`         |
| Core         | Advisor         | `/dashboard/advisor`         |
| Core         | Life Graph      | `/dashboard/life-graph`      |
| Domains      | Finance         | `/dashboard/finance`         |
| Domains      | Career          | `/dashboard/career`          |
| Domains      | Health          | `/dashboard/wellness`        |
| Domains      | Education       | `/dashboard/education`       |
| Domains      | Family          | `/dashboard/family`          |
| Intelligence | Recommendations | `/dashboard/recommendations` |
| Intelligence | Reports         | `/dashboard/reports`         |
| Intelligence | Documents       | `/dashboard/documents`       |
| Account      | Settings        | `/dashboard/settings`        |

Footer: **Signed in as** {email} · **Active persona** {persona} · **Environment** Beta Sandbox ·
Profile · Sign out.

## Per-Item Disposition (old sidebar → new)

| Label (old)            | Route                                 | Was                     | Now                                      | Reason                                                             |
| ---------------------- | ------------------------------------- | ----------------------- | ---------------------------------------- | ------------------------------------------------------------------ |
| Dashboard              | `/dashboard`                          | top-level               | **kept** → renamed **Home** (Core)       | the OS landing                                                     |
| Life Readiness         | `/dashboard/readiness`                | top-level               | **hidden from primary** (direct URL ok)  | a metric surface, not an OS area — belongs under My Life / Reports |
| Life Graph             | `/dashboard/life-graph`               | top-level               | **kept** (Core)                          | core OS area                                                       |
| Recommendations        | `/dashboard/recommendations`          | top-level               | **kept** (Intelligence)                  | core intelligence output                                           |
| Decision Brain         | `/dashboard/decision-brain`           | top-level               | **hidden from primary**                  | advanced/experimental surface — direct URL only                    |
| Documents              | `/dashboard/documents`                | top-level               | **kept** (Intelligence)                  | core data layer                                                    |
| Life Decisions         | `/dashboard/life-decisions/workspace` | top-level               | **hidden from primary**                  | decision tooling — reachable by URL; future grouped "Decisions"    |
| Reports                | `/dashboard/reports`                  | top-level               | **kept** (Intelligence)                  | core output                                                        |
| Finance                | `/dashboard/finance`                  | top-level               | **kept** (Domains)                       | domain                                                             |
| Career                 | `/dashboard/career`                   | top-level               | **kept** (Domains)                       | domain                                                             |
| Comp & Benefits        | `/dashboard/benefits`                 | top-level (gated)       | **moved → inside Career** (Compensation) | a Career sub-feature                                               |
| Financial Plan         | `/dashboard/planning`                 | top-level (gated)       | **moved → inside Finance**               | a Finance sub-feature                                              |
| Family                 | `/dashboard/family`                   | top-level               | **kept** (Domains)                       | domain                                                             |
| Family Office          | `/dashboard/family-office`            | top-level (gated)       | **moved → inside Family**                | a Family sub-feature                                               |
| Health & Wellness      | `/dashboard/wellness`                 | top-level               | **kept** → renamed **Health** (Domains)  | domain canonical route                                             |
| Health Intelligence    | `/dashboard/health-intelligence`      | top-level (gated)       | **moved → inside Health**                | a Health sub-feature                                               |
| Education              | `/dashboard/education`                | top-level (Coming Soon) | **kept** (Domains), un-greyed            | domain                                                             |
| SquaredAway (Military) | `/dashboard/military`                 | top-level (gated)       | **hidden from primary**                  | persona-gated module — surfaced contextually, not core nav         |
| Chat                   | `/dashboard/chat`                     | top-level               | **hidden from primary**                  | the Advisor IS the chat — duplicate entry removed                  |
| Goals & Assessment     | `/dashboard/goals`                    | top-level               | **hidden from primary**                  | belongs under My Life / domains; direct URL ok                     |
| Scenario Lab           | `/dashboard/scenario-lab`             | top-level               | **hidden from primary**                  | advanced planning tool — direct URL; future grouped "Planning"     |
| Decision Graph         | `/dashboard/life-decisions/graph`     | top-level (gated)       | **hidden from primary**                  | advanced surface — direct URL                                      |
| Compare Futures        | `/dashboard/life-decisions/scenarios` | top-level (gated)       | **hidden from primary**                  | advanced surface — direct URL                                      |
| Calendar               | `/dashboard/calendar`                 | top-level (Coming Soon) | **hidden from primary**                  | not core; removes Coming-Soon clutter                              |
| Roadmap                | `/dashboard/roadmap`                  | top-level (Coming Soon) | **hidden from primary**                  | reachable via Advisor/My Life; removes clutter                     |
| Executive Dashboard    | `/dashboard/metrics`                  | top-level (gated)       | **hidden from primary**                  | a metrics surface — direct URL                                     |
| Settings               | `/dashboard/settings`                 | top-level               | **kept** (Account)                       | account                                                            |
| Profile                | `/dashboard/profile`                  | child of Settings       | **moved → footer** (Profile button)      | account identity belongs with sign-out                             |

## Domain Tab Mapping (where the moved sub-features belong)

Per the sprint's domain model — these are the destinations; **building the tabs themselves is out of
scope** (domain CRUD). The sub-features keep working at their existing URLs today.

- **Finance** ← Accounts, Transactions, Assets, Investments, Retirement, Insurance, Estate, Financial Plan
- **Career** ← Experience, Skills, Certifications, Opportunities, Networking, Compensation (Comp & Benefits)
- **Health** ← Biometrics, Fitness, Nutrition, Labs, Medications, Insurance, Health Intelligence
- **Education** ← Degrees, Courses, Certifications, ROI Analysis
- **Family** ← Members, Dependents, Beneficiaries, Guardianship, Trusted Advisors, Estate, Family Office

## Routes Hidden From Primary Nav (still live by direct URL — no redirect, no deletion)

`/dashboard/readiness`, `/dashboard/decision-brain`, `/dashboard/life-decisions/*`, `/dashboard/chat`,
`/dashboard/goals`, `/dashboard/scenario-lab`, `/dashboard/calendar`, `/dashboard/roadmap`,
`/dashboard/metrics`, `/dashboard/military`, `/dashboard/benefits`, `/dashboard/planning`,
`/dashboard/family-office`, `/dashboard/health-intelligence`.

## No Redirects Added

No legacy route was a confusing duplicate, so no redirects were introduced — every bookmark still
resolves to the same page. (`Dashboard`→`Home` and `Health & Wellness`→`Health` are label-only renames;
the routes `/dashboard` and `/dashboard/wellness` are unchanged.)
