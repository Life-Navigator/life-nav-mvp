# DOCUMENT_VERIFICATION_REPORT.md — Sprint A

**Method:** live Playwright + admin magic-link session against prod, as a real onboarded user (`0a291b09`, persona `beta-journey-…-9@lifenav.test`) who has documents + 52 backfilled `life.facts`. No assumptions.

## What is VISIBLE today (verified live)

| Surface                                      | Result                                                                                                                                                                              |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard "Recently learned about you" strip | ✅ **Renders real extracted facts**: "Base salary: 185000 from your offer letter · pending your confirmation", "Signing bonus: 25000 …", etc. Shows $185,000 and $1,000,000 values. |
| Family → Estate tab (Family Office)          | ✅ Renders the estate/trust/beneficiary/survivor/legacy **pillars**.                                                                                                                |
| Documents page                               | ✅ Live: "Document Intelligence — Add a document — LifeNavigator extracts the facts and tracks what's missing. Nothing is invented."                                                |
| Advisor citation of doc facts                | ✅ backend reader shipped (`advisor_facts` reads `life.facts`); facts are confirmed/inferred-gated, number-gate-eligible.                                                           |

## The pipeline is wired end-to-end (verified at each stage)

Upload → OCR/extraction → `documents.document_fields` (provenance: page/section/char-span, migration 165) → `life.facts` (via `_bridge → submit_life_fact`) → `advisor_facts` reader (commit `a9f3d70`) + `LifeFactsService`/`GET /v1/life/facts` → dashboard `RecentlyLearned` strip. Confirmed by: 58-row backfill (live), the strip rendering those rows, and the advisor reader gate.

## Polish fixed this sprint

- **Currency formatting:** money-like facts now render `$185,000` instead of `185000` (guarded heuristic: money label + numeric ≥ 1000). Commit `1149138`.
- **Dark mode:** the "Recently learned" strip had `text-slate-900`/`bg-white` (white-on-white in dark mode); added `dark:` variants.

## Honest residual gaps (not yet built)

1. **Real-time "what changed after THIS upload" cluster** — the _persistent_ recently-learned view exists, but the magical step-by-step on upload (✓ Document received → ✓ OCR → ✓ Trust identified → ✓ Estate readiness 50→75 → ✓ Recommendation updated) is partial (`UploadResult` shows extraction, not the full downstream-delta cluster).
2. **Per-domain rendering of extracted values** (Family pillars citing the specific extracted trustee/beneficiary/coverage; Career rendering the offer-letter comp) — `life.facts` exist; surfacing them inside each domain card is the LIFE_FACTS_RENDERING_MAP backlog.

## Verdict

Sprint A's trust foundation is **built and live**: a user _can_ see what was learned from their documents, with provenance and honest "pending confirmation." The remaining work is **experience richness** (the upload-moment delta cluster + per-domain value rendering), not missing infrastructure.

## Test-data note

To verify richly, I set `onboarding_completed=true` on the synthetic `@lifenav.test` persona `0a291b09` (it had 52 backfilled facts but was stuck pre-onboarding). It remains onboarded to support ongoing Playwright validation.
</content>
