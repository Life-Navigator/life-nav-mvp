# In-App Executive Report Viewer — Build Record

**Sprint:** Finish Line — trust & consistency.
**Scope:** SURFACING build only. No new features/intelligence/models/agents/infra/DB. No fabricated
data — honest empty states everywhere. Builds the viewer the design doc
`docs/pilot-polish/EXECUTIVE_REPORT_VIEWER.md` specified (its P0.1–P0.4).

---

## 1. What was built (exact files + file:line)

| Change                       | File                                                                                 | Detail                                                                                                                                                                                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preview pass-through**     | `apps/web/src/app/api/reports/[type]/preview/route.ts` (new)                         | Clone of the PDF proxy `apps/web/src/app/api/reports/[type]/pdf/route.ts:1-36`. Same `TYPES` allowlist (`:11`), same session/JWT guard, `force-dynamic`; calls `GET ${CORE_API}/v1/reports/${type}/preview` and returns its JSON unchanged.                                                    |
| **In-app viewer**            | `apps/web/src/app/dashboard/reports/[type]/page.tsx` (new)                           | Client component. Fetches `/api/reports/{type}/preview`, renders the section order below, retains a **Download PDF** button → `/api/reports/{type}/pdf`. Honest empty states throughout. Brand teal `#0f766e` + `--brand-line`/`--brand-accent-soft` from `apps/web/src/app/globals.css:9-17`. |
| **Cards link into viewer**   | `apps/web/src/app/dashboard/reports/page.tsx:54-67`                                  | Each card now has **View report →** (`/dashboard/reports/{type}`) + a secondary **Download PDF**. Recolored from off-brand `indigo-600` to brand teal.                                                                                                                                         |
| **Share broken-promise fix** | `apps/web/src/app/dashboard/reports/page.tsx` footer (~`:69-72`) + header (`:45-48`) | Removed the "open a report and use **Share**" claim and the "share with an advisor" header line. See §3.                                                                                                                                                                                       |

Backend (`reports.py:41-50`, `report_engine.py`, `pdf_renderer.py`) was **read, not changed** — the
preview endpoint already returns the full report JSON; this sprint only surfaces it.

The route source for the upstream payload is `report_engine.render()`
(`apps/lifenavigator-core-api/app/services/report_engine.py:481-484`) → `{ format, report }`, where
`report` is a `ReportDefinition` (`apps/lifenavigator-core-api/app/models/report.py:56-65`).

---

## 2. Data mapping — which preview-JSON field feeds each viewer section

Two source bodies: `adv = report.sections[key=="advisor_executive"].body`
(`report_engine.py:262-279`) and `lm = report.sections[key=="life_model"].body`
(`report_engine.py:152-160`). Both are only inserted for `full`/`financial` (`report_engine.py:97-105`);
other types render via the generic Executive Summary / Sources fallbacks.

| Viewer section        | Preview-JSON field(s)                                                                                                                                             | Source line                                                                   | Empty-state behavior                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Cover (title/version) | `report.title`, `report.version`                                                                                                                                  | `report_engine.py:440`, `store():459`                                         | version line hidden if absent                                                                     |
| Cover badges          | `adv.cover.{objective,confidence_pct,readiness}`                                                                                                                  | `report_engine.py:263-264`                                                    | each chip hidden if `null` (readiness often `null` — readiness engine may be unwired, `:199-207`) |
| Executive Summary     | `adv.vision` → else generic `executive_summary` body → else empty                                                                                                 | `report_engine.py:265`, `:411-412`                                            | "Summary not yet available"                                                                       |
| **Current Narrative** | **lead:** `adv.life_brief.{headline,body,situation,tension,stakes,next_move}` → **fallback:** `adv.vision` / `lm.life_vision` / `adv.primary_objective.reasoning` | life_brief **NOT in payload today** (see §4); fallbacks at `:265-266`, `:154` | "Your story is still forming"                                                                     |
| Goals                 | `lm.primary_objective.{title,confidence,reasoning}` (or `adv.primary_objective`), `adv.goals[]`                                                                   | `report_engine.py:155`, `:254-256`                                            | "No goals captured yet"                                                                           |
| Risks                 | `adv.risks[]` ← `snapshot.top_risks`                                                                                                                              | `report_engine.py:271`                                                        | "No risks identified yet" (grounded-only — see §4)                                                |
| Opportunities         | `adv.opportunities[]` (or `lm.opportunities`) ← `snapshot.top_opportunities`                                                                                      | `report_engine.py:272`, `:158`                                                | "No opportunities identified yet" (grounded-only)                                                 |
| Constraints           | `lm.constraints[]` ← `snapshot.active_constraints`                                                                                                                | `report_engine.py:157`                                                        | "No active constraints recorded"                                                                  |
| Recommendations       | `adv.recommendations[]` (`title,priority,why,confidence,expected_impact,domains[],evidence[],assumptions[]`) + `adv.next_best_action`                             | `report_engine.py:232-243`, `:270`                                            | "No recommendations yet" (PDF-matching copy)                                                      |
| → quantified impact   | `rec.expected_impact` (pre-joined `+$X/yr · readiness a→b · benefit`)                                                                                             | `report_engine.py:224-235`                                                    | "Impact not yet quantified" — **never invented** (§4)                                             |
| → confidence/evidence | `rec.confidence`, `rec.evidence[].{statement,source}`, `rec.assumptions[].{label,value}`                                                                          | `report_engine.py:235-239`                                                    | omitted per-rec if empty                                                                          |
| Decision Tradeoffs    | `lm.tradeoffs[]` (`between,reason,focus`) ← `objectives_plan().conflicts`                                                                                         | `report_engine.py:159`                                                        | "No competing objectives to weigh yet"                                                            |
| Action Plan           | `adv.plan_90.{now,next,later,blocked[]}` + `adv.missing_data[]`                                                                                                   | `report_engine.py:244-247`, `:261,273`                                        | "No action plan yet"; missing-data block hidden if empty                                          |
| Sources & Evidence    | `adv.appendix.{evidence_count,recommendation_count,goal_count,avg_confidence_pct}` + `report.citations[]`                                                         | `report_engine.py:275-277`, `:446-447`                                        | "No source tables cited yet"                                                                      |
| Disclaimer footer     | `report.governance.disclaimer_text`                                                                                                                               | `report_engine.py:442`                                                        | hidden if absent                                                                                  |

Section order rendered (per task spec): Executive Summary → Current Narrative → Goals → Risks →
Opportunities → Constraints → Recommendations → Decision Tradeoffs → Action Plan → Sources/Evidence.

---

## 3. Share decision

**Removed the claim (design doc §4 Option B).** The footer previously told users to "open a report and
use **Share**" and the header said "download or share with an advisor" — but **no Share UI exists**.
Per the hard rule (no new features this sprint) and because a half-working Share on a trust surface is
the worst outcome, the copy was edited to describe only **view in-app / download PDF**. The backend
share/consent stack (`reports.py:73-106`, `sharing.py`) remains complete and untouched; wiring the
Share UI (Option A) is a future sprint and still gated on verifying the public `/share/{token}`
resolve page exists end-to-end (design doc §7).

---

## 4. Honest gaps (verify on live data — do NOT fabricate)

- **`life_brief` is NOT in the preview payload today.** Confirmed by grep: `life_brief` does not appear
  in `report_engine.py` or `pdf_renderer.py`. The executive payload leads with `adv.vision` /
  `primary_objective.reasoning`, not the human paragraph. The viewer's Current Narrative reads
  `adv.life_brief` **when present** and **falls back** to vision/reasoning when absent — so it ships
  today and automatically upgrades if the backend later adds `payload["life_brief"]` (design doc §3,
  marked there as a separate backend build task, intentionally NOT done this sprint).
- **Quantified impact may be sparse.** `rec.expected_impact` only carries a `+$X/yr` / `readiness a→b`
  string when the rec's `quantified_impact` was populated (`report_engine.py:224-231`). Many recs carry
  only a note/`{}`. Where absent the viewer renders "Impact not yet quantified" — **never an invented
  figure.** Audit coverage against live recs; do not pad.
- **Risks / opportunities are intentionally grounded-only** — `discover_goal` does not auto-create
  archetype risks/opps, so these lists are frequently empty for new users. The honest empty state is
  correct, not a bug.
- **Readiness badge may be absent** if the readiness engine isn't wired (`report_engine.py:199-207`
  swallows). The cover chip is conditionally rendered and simply hidden when `null`.
- **Decision tradeoffs require ≥2 conflicting active objectives**; single-objective users see the
  honest empty state.
- **WeasyPrint is deployed-image-only** (`pdf_renderer.py`), so the PDF path can't be exercised
  locally — the viewer (needs no WeasyPrint) is the right surface and was validated via type-check +
  eslint, not a local PDF render.

---

## 5. Verification

- `pnpm -C apps/web type-check` — **PASS** (clean, no errors).
- `eslint` on the 3 changed/new web files — **PASS** (no warnings or errors).
- No `package.json` / lockfile changes. No commits/pushes. No backend/DB changes.
