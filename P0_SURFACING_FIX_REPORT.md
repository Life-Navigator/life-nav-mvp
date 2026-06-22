# P0_SURFACING_FIX_REPORT.md — Phase 4

Status of the 8 P0 surfacing fixes. Grounded; honest about shipped (code) vs designed vs needs-verification.

## Shipped this sprint (code, tested)

| Fix                           | What                                                                                                                                              | Verification                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **P0-1 life.facts (backend)** | `GET /v1/life/facts` + `LifeFactsService.recent_facts` — confirmed/inferred extracted facts, render-shaped, provenance back-link, domain-scopable | `tests/test_life_facts.py` (3) + advisor reader (`advisor_facts`, prior commit `a9f3d70`); suite **598 pass** |

Combined with the prior `a9f3d70` (advisor reads life.facts), the **backend half of P0-1 is complete**: the advisor cites extracted values, and the UI now has an endpoint to render them.

## Remaining P0 (frontend — needs the app running to verify; see Credentials)

| Fix                                 | Class         | Concrete change                                                                                                           | Risk blind   |
| ----------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **P0-1 (UI)** life.facts strip      | new component | `/api/life/facts` proxy + Dashboard "recently learned" strip (LIFE_FACTS_RENDERING_MAP)                                   | med — visual |
| **P0-2** document change visibility | compose       | after-upload cluster (extracted → changed → readiness delta → rec → review) from existing data + readiness_snapshots      | med          |
| **P0-3** Family Office UI           | wire-only     | promote orphan `/dashboard/family-office` into `/dashboard/family` (proxy already exists)                                 | low          |
| **P0-4** Health Intelligence UI     | wire-only     | promote orphan `/dashboard/health-intelligence` into nav/main Health; honest empty states                                 | low          |
| **P0-5** Career intelligence        | proxy+render  | `/api/benefits` + `/api/career/compensation` proxies + cards on Career overview (promotion-readiness already in recs)     | med          |
| **P0-6** Education intelligence     | proxy+render  | `/api/education/roi` proxy + ROI/comparison/funding cards on Education overview                                           | med          |
| **P0-7** Recommendations detail     | extend        | evidence/impact/confidence/timeline/dependencies/"what-if-ignored" drawer (payload already carries the fields)            | low          |
| **P0-8** Graph pilot decision       | nav config    | remove Graph from primary nav per the NO-GO (GRAPH_GO_NO_GO); keep behind dev flag; premium "Life Map — Coming Soon" hero | low          |

## Why I stopped at the backend and did not blind-build the frontend

The remaining fixes are UI. I can write them and pass typecheck + jest, but I **cannot visually verify** that they render correctly, look premium (Phase 6), or behave for a real authenticated user (Phase 7) without **running the web app against the live backend** — which needs credentials I don't have and must not fabricate. Building 8 frontend changes blind, then claiming "surfaced," would violate the no-fabrication principle this product is built on.

## Recommended sequence once verifiable

1. P0-8 (graph nav removal) + P0-3/P0-4 (orphan promotions) — lowest risk, highest discoverability gain.
2. P0-1 UI strip + P0-2 change visibility — the "platform is working" moments.
3. P0-5/P0-6 (proxy + render) — unlock the comp/ROI engines.
4. P0-7 recommendation detail — already-rich payload.

## Credentials needed to verify + finish (asked, not assumed)

See the message accompanying this report. In short: a way to run `apps/web` against the live backend (Vercel token for `vercel env pull`, or the web env values) + a test-user login to view authenticated surfaces with real data.
</content>
