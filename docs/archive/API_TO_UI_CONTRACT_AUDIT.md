# API_TO_UI_CONTRACT_AUDIT.md — Phase 3

Grounded 2026-06-22. For each intelligence API: does the backend return it, is there a Next.js proxy, does the frontend call it, does a **primary** surface render it? "Orphan" = rendered only at a non-nav route.

| Intelligence                     | Backend route                                          | Next proxy                    | Primary-surface consumer                                                                        | Verdict                                                 |
| -------------------------------- | ------------------------------------------------------ | ----------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **life.facts**                   | ✅ `GET /v1/life/facts` (**shipped this sprint**)      | ❌ none yet                   | ❌ none yet                                                                                     | **BUILD proxy + dashboard strip** (endpoint now exists) |
| **Family Office**                | ✅ `GET /v1/family/office`                             | ✅ `/api/family/office`       | ❌ only orphan `/dashboard/family-office`; main `/dashboard/family` reads `summary` + CRUD only | **PROMOTE orphan → main Family**                        |
| **Health Intelligence**          | ✅ `GET /v1/health/intelligence`                       | ✅ `/api/health/intelligence` | ❌ only orphan `/dashboard/health-intelligence`; not in nav                                     | **PROMOTE orphan → nav/main Health**                    |
| **Benefits (comp engine)**       | ✅ `GET /v1/benefits`                                  | ❌ none                       | ⚠️ a few onboarding/goal components; NOT the Career page                                        | **BUILD proxy + render in Career**                      |
| **Career compensation / market** | ✅ `/v1/career/compensation`, `/market-position`       | ❌ none                       | ❌ none; Career page reads `overview/readiness/summary` only                                    | **BUILD proxy + render in Career**                      |
| **Education ROI**                | ✅ `/v1/education/roi` (+ report builder, 6 endpoints) | ❌ none                       | ❌ none; Education page reads records/certs/courses/readiness only                              | **BUILD proxy + render in Education**                   |
| **Recommendations**              | ✅ `/v1/recommendations`                               | ✅ `/api/recommendations`     | ✅ `/dashboard/recommendations` (+ graph strips)                                                | **OK — strongest surface; extend with evidence detail** |
| **My Life**                      | ✅ `/v1/life/my-life`                                  | ✅ `/api/life/my-life`        | ✅ dashboard `LifeIntelligence`                                                                 | **OK**                                                  |

## The pattern (one sentence)

The high-value engines are **computed and exposed but not wired to a primary surface** — Family Office & Health Intelligence are stranded at orphan routes; Benefits/Compensation/Education-ROI lack a proxy and a consumer entirely; only Recommendations and My-Life have clean end-to-end parity.

## Render-understandability note

Where intelligence IS rendered, it's understandable (Recommendations roadmap, My-Life). The orphan pages (`family-office`, `health-intelligence`) already render their engines competently — the failure is **discoverability** (not in nav), not render quality. So the cheapest, highest-ROI fixes are nav/composition, not new UI from scratch.

## Fix classes (cheapest first)

1. **Wire-only (nav/composition):** Family Office, Health Intelligence — promote existing orphan pages into the primary domain experience.
2. **Proxy + render:** Benefits/Compensation (Career), Education ROI — proxy exists nowhere; add a thin Next proxy + a card on the domain overview.
3. **New surface (one component):** life.facts dashboard "recently learned" strip — endpoint shipped; needs proxy + component.
4. **Extend:** Recommendations evidence/impact/"what happens if ignored" detail drawer.

See P0_SURFACING_FIX_REPORT.md for what shipped vs what remains, and the credential prerequisites for visual verification.
</content>
