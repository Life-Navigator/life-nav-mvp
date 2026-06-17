# Graph Navigation Fix Report (P0-6)

**Date:** 2026-06-16 · **Goal:** every graph CTA routes to the correct working graph/evidence panel — no wrong routes, 404s, blank screens, or wrong-graph surfaces.

## Finding: nothing to fix — the flagged bug is STALE

The Elite Hardening audit flagged a wrong-route bug ("Sidebar links Life Graph to `/life-graph` instead of `/life-graph/explainable`"). **That bug does not exist in the current `origin/main` codebase** — it referenced a different/earlier code state. Verified directly:

- `components/layout/Sidebar.tsx:389` → `{ name: 'Life Graph', href: '/dashboard/life-graph', … }` — and `app/dashboard/life-graph/page.tsx` **exists** and renders the real graph (provenance/details panel is inside the page).
- There is **no** `/life-graph/explainable` route anywhere (no such dir, zero references). Repointing to it would have **created** a 404 — correctly avoided.
- There are no `components/lifeGraph/*` or `features/life-graph/*` directories in this state.
- No `/api/life-graph/workspace` vs `/api/life-graph` mismatch — neither exists; the real endpoint is `GET /api/life/graph`, which the page calls.

## Every graph entry point verified

All graph nav comes from `components/layout/Sidebar.tsx`. Each link targets an existing route whose data endpoint exists under `app/api/**` with the matching HTTP method:

| Sidebar item               | target route (exists)                 | data endpoint (exists, method matches)                              |
| -------------------------- | ------------------------------------- | ------------------------------------------------------------------- |
| Life Graph                 | `/dashboard/life-graph`               | `GET /api/life/graph`                                               |
| Decision Brain             | `/dashboard/decision-brain`           | `GET /api/decision/brain-decisions`, `GET /api/decision/brain/{id}` |
| Life Decisions (workspace) | `/dashboard/life-decisions/workspace` | `GET`/`POST /api/decision/workspace`                                |
| Decision Graph             | `/dashboard/life-decisions/graph`     | `POST /api/decision/graph`                                          |
| Scenarios                  | `/dashboard/life-decisions/scenarios` | —                                                                   |
| Scenario Lab               | `/dashboard/scenario-lab`             | `/api/scenario-lab/*`                                               |

Also verified present + endpoint-matched (reachable by direct URL, not in sidebar): `/dashboard/life-trajectory`, `/dashboard/compare-futures`. No recommendation-evidence or report-evidence link points at a graph route (grep returned none), so there are no broken evidence deep-links.

## Minor observations (P1, not blockers — no change made)

- **Discoverability:** `/dashboard/life-trajectory` and `/dashboard/compare-futures` have no sidebar entry (URL-only). They work; whether to surface them in nav is a product decision, not a defect.
- **Server-gated module:** the "Decision Graph" sidebar item is hidden entirely if the server says the `decision_graph` module isn't visible for the user — intended server-authoritative gating, not a nav bug. Confirm the module is enabled for pilot users server-side if it should appear.

## Verdict

**Graph navigation is sound as shipped.** No wrong routes, no 404s, no blank/wrong-graph surfaces. No code change required for P0-6; this report documents the verification.
