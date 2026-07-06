# RECOMMENDATIONS_ROOT_CAUSE.md — Sprint 1

## Correction first (own the misdiagnosis)

The validation sprint reported the Recommendations page as **"blank despite 9 stored recs — render bug."** **That was wrong.** Re-tested live with a longer wait: the page **renders fully and is advisor-grade** — "Your Roadmap" with NOW / NEXT / LATER, the priority formula, risk framing, objective linkage, Accept/Start/Complete actions, and "unlock more by uploading" prompts.

The false positive came from my validation harness: (1) a **6.5s wait** that was shorter than the page's load time, and (2) a **heading-only DOM selector** (`h1/h2/h3`) that missed the loading text ("Building your roadmap…") and the cards (which render in `div`s).

## The actual root cause: LATENCY, not a render bug

Traced the full chain `engine → DB → API → proxy → frontend`:

- **Backend:** `GET /v1/recommendations/roadmap` returns real data (`now:1, next:2, later:1, blocked_by:3`, HTTP 200) — **measured at 3.4–3.6s** per call (it computes readiness + collects across modules on read).
- **Frontend:** the page's `useEffect` ran a **slow POST sync FIRST, then the GET** (`fetch(POST).finally(load)`). So a user with a real roadmap waited **POST-sync + 3.5s GET ≈ 6–16s** on "Building your roadmap…" before anything appeared. That long loading state is what looked "blank."
- Data exists end-to-end: the 9 domain recs (finance/family/health) flow into the OS `recommendations` registry; the roadmap reads + sequences them.

## Where they "disappear"

They don't. They were just **slow to appear** — the page gated first paint on a slow sync + a 3.5s compute.

## Severity (corrected)

- Render bug: **none** (the surface is advisor-grade).
- Real issue: **load latency** — high _perceived_ severity (looks blank), medium technical severity. The page-level part is fixed (RECOMMENDATIONS_RENDER_FIX.md); the residual 3.5s roadmap-compute latency is a backend perf item → **Sprint 5 (Arcana/perf)**, same root as the advisor stall.
  </content>
