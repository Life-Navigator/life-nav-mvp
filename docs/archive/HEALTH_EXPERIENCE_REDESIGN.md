# Health Experience Redesign — Sprint C

**Grounded finding.** The current Health experience _feels_ like a beta shell: 9 of 13 tabs (`Biometrics, Fitness, Nutrition, Labs, Medications, Documents, Analysis, Recommendations, Goals`) are 6–7-line files that render `HealthTabEmpty` (`apps/web/src/components/domain/health/HealthTabEmpty.tsx`) — a polished but _static_ empty state that never changes when the user actually has data. Meanwhile the backend already computes a readiness score, lab-marker flags, and evidence-backed wellness recommendations, surfaced only on an orphan route (`/dashboard/health-intelligence/page.tsx`) that no nav links to. The redesign is therefore a **surfacing + emotional-framing** exercise, not a rebuild: connect existing intelligence to the canonical tabs, lead with a readiness narrative, and make health feel calm, private, and trustworthy — a "personal health office," not a medical app.

---

## IA: before → after

### Before (today)

```
/dashboard/healthcare              Overview (real, /api/health/summary, beta banner)
  ├ /biometrics    HealthTabEmpty (static)
  ├ /fitness       HealthTabEmpty (static)
  ├ /nutrition     HealthTabEmpty (static)
  ├ /labs          HealthTabEmpty (static)
  ├ /medications   HealthTabEmpty (static)
  ├ /insurance     REAL (387 lines)
  ├ /documents     HealthTabEmpty (static)
  ├ /analysis      HealthTabEmpty (static)
  ├ /recommendations HealthTabEmpty (static)
  ├ /goals         HealthTabEmpty (static)
  ├ /reports       REAL (PDF pipeline)
  └ /settings      REAL (1086 lines, monitoring prefs)
/dashboard/health-intelligence     ORPHAN — the real readiness/lab UI, not in nav
add page POSTs to 3 non-existent endpoints (medications/appointments/vitals)
```

### After (surfacing-first, no new infra)

```
/dashboard/healthcare              Command Center hero: Readiness ring + Risk flags + Sleep
  ├ /readiness     NEW tab = orphan health-intelligence component (GET /v1/health/intelligence)
  ├ /biometrics    reads /summary + /intelligence (sleep, body metrics, vitals)
  ├ /fitness       reads /intelligence.fitness (+ activity rec)
  ├ /nutrition     reads /intelligence.nutrition (+ nutrition rec)
  ├ /labs          reads /intelligence.labs (marker table, range flags)
  ├ /medications   reads /intelligence (meds + supplements, record-only)
  ├ /insurance     REAL (unchanged)
  ├ /documents     reads extracted doc-types; upload deep-link
  ├ /recommendations reads /v1/health/recommendations (real evidence-backed recs)
  ├ /goals         lists /v1/health/goals + add via existing write
  ├ /reports       REAL (unchanged)
  └ /settings      REAL (unchanged)
add page restricted to supported writes; dead lib/api/health.ts retired
```

Net change: **0 new tables, 0 new models, 0 new infra.** Two thin Next proxies (`/api/health/recommendations`, `/api/health/goals`) mirroring `api/health/summary/route.ts`, plus one optional `body` read added to `_LISTS` in `health_domain.py:55`.

---

## Concrete surfacing changes (mapped to existing data)

1. **Overview hero becomes a readiness narrative.** `healthcare/page.tsx` already converts the summary into a `CoverageModel` (`toCoverageModel`). Augment the hero with the readiness ring from `GET /v1/health/intelligence` (`readiness.score`, `readiness.status` band at `health_intelligence.py:81`). One sentence: "Your health picture is N% organized — X of 5 key inputs in place."
2. **Risk flags above the fold.** Outside-range lab markers (`health_intelligence.py:79`) render as a calm amber "worth discussing with your clinician" strip — never red-alarm, never a diagnosis (`labs.note` + `ideal` range).
3. **Each stub tab reads its slice.** Replace the static `HealthTabEmpty tab="X"` with a thin component that fetches `/intelligence` (labs/fitness/nutrition/meds) or `/summary` (sleep/vitals) and falls back to the _same_ `DomainEmptyState` copy when the slice is absent. The marker-table, supplements/medications cards, fitness, and nutrition layouts already exist in `health-intelligence/page.tsx` — reuse them.
4. **Recommendations tab shows real recs.** Wire to `GET /v1/health/recommendations` (`domains/health.py:135`). Each rec already has `why_it_matters`, evidence, and a medical AdviceBoundary — render the evidence + boundary badge.
5. **Promote / retire the orphan.** Move `/dashboard/health-intelligence` into a nav `Readiness` (or `Analysis`) tab.
6. **Fix dead ends.** Restrict `healthcare/add/page.tsx` to write targets that exist; retire the unused `lib/api/health.ts` endpoints.

---

## Emotional & visual design (premium, calm, private)

- **Tone: a personal health office, not a clinic.** Health data is sensitive; the experience should feel _organized and reassuring_, not diagnostic. Keep the existing PHI privacy notice (`HealthTabEmpty.tsx:106`) and the medical-safety footer (`:119`) on every surface — these are trust assets, surface them as quiet confidence, not legalese walls.
- **Readiness ring as the emotional anchor.** Reuse the score-ring visual language already established for Career/Education readiness rings (Phase 9). Color bands map to `_status()` (`health_intelligence.py:48`): green ≥80, yellow ≥60, orange ≥30, red <30 — calm palette, no alarm red unless truly empty.
- **"What we know / what's missing" framing** (already in `CoverageModel.known/missing`) makes gaps feel like a checklist to complete, not a failure. Each missing item is a single tappable action.
- **Never fabricate.** Honor the "No mock data — ever" rule: absent metrics are `null` and show as honest prompts (`domains/health.py:96` comments "never fake 0"). No sample charts, no placeholder vitals.
- **Beta honesty.** Keep the `BetaSafety` banner (`healthcare/page.tsx:99`) but soften: "Health organizes your information for planning — full analysis is expanding." Avoid "Coming soon" (the codebase already bans it, `HealthTabEmpty.tsx:1`).
- **Privacy as a feature.** Surface "You can remove any document at any time" and the wellness-only boundary as deliberate, premium trust signals.

---

## Definition of done

- No tab renders a static placeholder that ignores existing data; each has working Empty / In-Progress / Complete states driven by real endpoints.
- Readiness score + lab risk flags are reachable from the canonical nav and visible on the Overview hero.
- Recommendations and Goals tabs show real data from `/v1/health/recommendations` and `/v1/health/goals`.
- Add form: zero failing submissions; `lib/api/health.ts` dead calls removed.
- Medical-safety boundary + PHI privacy notice present on every health surface.
- Zero fabricated health data; all absent values render as honest, actionable gaps.
- The experience reads as a calm, private "health office" — readiness-led, never alarmist, never diagnostic.
