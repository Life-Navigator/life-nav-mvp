# ELITE DOMAIN FRAMEWORK — Phase 1 (Framework Built) — 2026-06-10

Rule 3 says build the framework FIRST. Done: the reusable framework exists, type-checks (0 tsc errors),
and is committed (`d75ec31`). The 4-domain _conversion_ (Career→Health→Education→Family) is the build that
applies this framework — scoped below, honestly not yet done. No backend/AI/finance changes.

## Framework Components Created (`apps/web/src/components/domain/framework/`)

| File                 | Exports                                                                                                                                | Purpose                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `types.ts`           | `DomainConfig`, `CoverageModel`, `SourceAttribution`, `DomainNavItem`, `Confidence`, `DomainStatus`                                    | the shared contract                                                             |
| `DomainLayout.tsx`   | `DomainLayout`, `DomainHeader`, `DomainActionBar`                                                                                      | the shell (sidebar + content) — mirrors `finance/layout.tsx`                    |
| `DomainSidebar.tsx`  | `DomainSidebar`                                                                                                                        | data-driven nav from `DomainConfig.nav` (active state, Beta chips)              |
| `DomainOverview.tsx` | `DomainOverview`                                                                                                                       | the 11-point standard Overview from a `CoverageModel`                           |
| `cards.tsx`          | `CoverageCard`, `ConfidenceCard`, `MissingDataCard`, `NextActionCard`, `SourceAttributionCard`, `DomainStatusCard`, `DomainMetricsRow` | shared metric cards (no orphan numbers)                                         |
| `states.tsx`         | `DomainEmptyState`, `DomainLoadingState`, `DomainErrorState`                                                                           | standard states — empty state = "we know / we still need / unlocks / next step" |
| `index.ts`           | barrel                                                                                                                                 | single import surface                                                           |

Note on filenames: the sprint listed `DomainOverview/Documents/Analysis/Recommendations/Goals/Reports/
Settings.tsx` as separate files. Overview is built (it's the keystone + reused as the contract anchor);
Documents/Analysis/Recommendations/Goals/Reports/Settings are **tab pages composed FROM the shared
primitives** (cards + states + DomainEmptyState) rather than seven near-identical wrapper components — each
domain's tab passes its data into the same primitives. The card/state primitives the sprint listed
(Coverage/Confidence/MissingData/NextAction/SourceAttribution/DomainStatus + Empty/Loading/Error) all exist
as named exports. If you want the seven tab wrappers as explicit files too, that's a thin follow-up.

## Shared Component Usage Matrix (intended — enforced by the contract)

| Component                                                          | Dashboard                              | Career    | Health | Education | Family |
| ------------------------------------------------------------------ | -------------------------------------- | --------- | ------ | --------- | ------ |
| DomainLayout/Sidebar                                               | n/a                                    | ▶ to wire | ▶      | ▶         | ▶      |
| DomainOverview                                                     | n/a                                    | ▶         | ▶      | ▶         | ▶      |
| Coverage/Confidence/MissingData/NextAction/SourceAttribution cards | ◐ (existing DomainCoverage to migrate) | ▶         | ▶      | ▶         | ▶      |
| DomainEmptyState                                                   | ▶                                      | ▶         | ▶      | ▶         | ▶      |

(▶ = apply next; ◐ = partial today; the dashboard `DomainCoverage` card predates the framework and should be re-pointed at `CoverageCard`/`MissingDataCard`.)

## Domain Conversion Progress

- **Framework: DONE** (Phase 1).
- **Career config: DONE** (`configs/career.ts` — 13-tab contract; proves a domain = config + framework).
- **Career/Health/Education/Family page wiring: NOT DONE** (the conversion build).

## Duplicate UI Removed

None yet (additive framework). The dedup target is documented: dashboard `DomainCoverage` + each domain's
ad-hoc empty/summary cards → replace with the framework primitives during conversion.

## Domain Contract Compliance

Contract = Overview/Documents/Analysis/Recommendations/Goals/Reports/Settings. Today (pre-conversion):
Finance 100% · Career 62% · Health 50% · Education 37% · Family 37% (per the prior audit). The framework
makes reaching 100% a matter of supplying a `DomainConfig` + a `CoverageModel` per tab + honest missing-states.

## Browser Validation Results

Framework type-checks (0 tsc errors); components are standard React/Tailwind matching the Finance shell.
**Not browser-validated as rendered domain pages yet** — that happens when a domain page is wired to
`DomainLayout`/`DomainOverview` (the conversion step). The framework is not yet mounted on any live route,
so prod is unchanged/safe.

## Route Validation Results

Unchanged from the prior audit (63 routes; 1 BROKEN `/dashboard/scenario-lab/[id]`). No routes were added
or altered this turn (framework is components only).

## Remaining Drift

Until the conversion runs, Career/Health/Education/Family keep their current bespoke layouts (drift). The
framework is the instrument to remove that drift; it hasn't been applied to a page yet.

## P0 / P1 / P2

- **P0:** none introduced. (Pre-existing: BROKEN `scenario-lab/[id]`.)
- **P1:** wire the 4 domains to `DomainLayout`/`DomainOverview` (Career→Health→Education→Family); migrate
  dashboard `DomainCoverage` → framework cards; add per-domain Documents/Analysis/Recommendations/Goals/
  Reports tabs from the primitives.
- **P2:** optional explicit tab-wrapper files (DomainDocuments/Analysis/…); browser-validate the 10 pages.

## Definition of Done — status

DONE: DomainLayout + the shared framework exist (type-checked, committed); the first domain config proves
the model. NOT DONE: Career/Health/Education/Family converted + browser-validated (the conversion build).
The foundation is in place so future domains (Legal/Insurance/Estate/Business/Military) need only a
`DomainConfig` + data — no new UI architecture.

## Recommended next pass

Convert **Career** end-to-end (its page exists with real `/api/career/summary` data): add
`career/layout.tsx` using `DomainLayout` + `careerDomain`, map the summary into a `CoverageModel`, render
`DomainOverview`, then browser-validate. That single conversion becomes the copy-paste template for Health,
Education, Family.
