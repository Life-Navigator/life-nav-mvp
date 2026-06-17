# In-App Executive Report Viewer — Design

**Sprint:** Pilot Polish — make Arcana's intelligence VISIBLE.
**Scope:** Design only. No code, no commits. Surface EXISTING data. No fabrication, ever.
**Builds on:** `docs/experience-excellence/EXECUTIVE_REPORT_EXCELLENCE.md` (the audit of the engine).
This doc is the **viewer implementation spec** that companion doc called for (its P0.1) — it does not
re-audit the engine; it specifies the web surface, the exact data mapping, and the Share fix.

---

## 0. One-paragraph problem statement

The most impressive artifact in the product — an advisor-grade, evidence-cited, reproducible Life
Briefing — is **download-only and buried.** `apps/web/src/app/dashboard/reports/page.tsx:41` renders six
cards whose only action is `<a href="/api/reports/{type}/pdf">` (`:54-59`). There is no in-app view, no
preview before download, nothing to screenshot in a demo. Meanwhile the backend already returns the entire
report as JSON at `GET /v1/reports/{type}/preview` (`apps/lifenavigator-core-api/app/routers/reports.py:41`)
— **built and wired to nothing.** And the page footer (`page.tsx:63-66`) tells users to "open a report and
use **Share**" — a feature that has **zero UI**, though the backend share/consent stack is complete
(`reports.py:73-106`). This is a broken promise on a trust surface. This doc fixes both.

---

## 1. What's already shipped (real file:line) — do not rebuild

| Asset                                | Location                                                                                                                                                                                                                 | State                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| Preview JSON endpoint                | `reports.py:41-50` → `engine.build()` then `engine.render()` (`report_engine.py:481-484`, returns `{format, report}`)                                                                                                    | ✅ built, **unused by UI**                 |
| PDF endpoint + web proxy             | `reports.py:53-70`; `apps/web/src/app/api/reports/[type]/pdf/route.ts:13` (user-JWT proxy)                                                                                                                               | ✅ working                                 |
| Advisor-grade section assembly       | `report_engine.build()` `:93-117`: inserts `_life_model_section` (`:140`) then `_advisor_executive_section` (`:196`) at top for `full`/`financial`                                                                       | ✅ built                                   |
| Executive Briefing payload           | `_advisor_executive_section` `:196-279` — cover, vision, primary objective, readiness, goals, recommendations (w/ quantified impact `:222-242`), next_best_action, risks, opportunities, missing_data, plan_90, appendix | ✅ built                                   |
| Share + consent ledger + audit       | `reports.py:73-106`; `sharing.py` (`AUDIENCES` `:21`, `create_share` `:54`, returns `share_path=/share/{token}` `:77`, `list_shares`, `revoke`, `audit_log`)                                                             | ✅ backend complete, **no UI**             |
| Reproducibility/versioning           | `report_engine.store()` `:453-472` (content_hash neutralizes timestamps `:33-64`, versioned rows)                                                                                                                        | ✅ built, version invisible to user        |
| `life_brief()` — the human paragraph | `life_discovery.py:416-513` (situation→tension→stakes→next_move; honest forming-state `:431-440`)                                                                                                                        | ✅ built; **report does NOT lead with it** |

**Bottom line:** the report is ~80% there as a PDF. The missing 20% is _experience_: a viewer, a story-first
lead, and the Share UI. No new intelligence, models, agents, infra, or DB. Pure surfacing.

---

## 2. The viewer — design

### 2.1 Route & data contract

- New page: `apps/web/src/app/dashboard/reports/[type]/page.tsx` (client component).
- New proxy: `apps/web/src/app/api/reports/[type]/preview/route.ts` — **exact clone** of the existing PDF
  proxy (`apps/web/src/app/api/reports/[type]/pdf/route.ts`), but `fetch(${CORE_API}/v1/reports/${type}/preview)`
  and `return NextResponse.json(...)`. Same `TYPES` allowlist (`:11`), same session/JWT guard (`:17-22`),
  same `force-dynamic`. (Mirror the `_helper.token()` pattern used by `api/life/my-life/route.ts:2,5` for
  brevity.)
- Response shape: `{ format: "json", report: <ReportDefinition> }` (`report_engine.render` `:481-484`).
  `report.sections` is an array of `{key, title, ord, body, evidence[], assumptions[], charts[], recommendations[]}`;
  `report.version`, `report.title`, `report.charts`, `report.citations`, `report.governance` are top-level.

The cards on `reports/page.tsx:54-59` change from `<a href=.../pdf>` to a link into the viewer
(`/dashboard/reports/{type}`); the viewer keeps a **"Download PDF"** button pointing at the existing
`/api/reports/{type}/pdf` proxy. Nothing about the PDF path changes.

### 2.2 Section order — LEAD WITH THE NARRATIVE

The viewer renders one canonical "Life Briefing" layout for `full`/`financial` (the types whose `build()`
produces `advisor_executive` + `life_model`), and a generic section-loop for the rest. The web layout
mirrors `pdf_renderer._full_html` (`pdf_renderer.py:155-277`) so the web view and the PDF are the same
document. Order:

```
COVER       headline + the situation→tension→stakes paragraph
            readiness badge · objective-confidence % · "v{n} · evidence-grounded"
1 SITUATION the Life Brief in full (situation / tension / stakes / next move)
2 GOALS     primary objective + reasoning · goal portfolio (coexisting) · explicit tradeoffs/conflicts
3 OPPORTUNITIES   top opportunities (grounded only)
4 RISKS     top risks (grounded only)
5 DECISION TRADEOFFS   the competing-objective conflicts + suggested sequence
6 ACTION PLAN   Now / Next / Later / Blocked-needs-data, each rec with why · impact · evidence · assumptions
7 WHAT'S MISSING   missing_data → "adding X unlocks stronger recommendations"
8 APPENDIX   version · generated-at · evidence/recommendation/goal counts · avg confidence · source tables
```

This reorders the _display_ (Opportunities + Risks + Decision Tradeoffs become first-class sections, before
the action plan) — the prompt's requested family-office order. The underlying data already exists in the
`advisor_executive` body and `life_model` body; the viewer just lays it out this way.

### 2.3 EXACT data sources per section (real fields)

All from `report.sections[key=="advisor_executive"].body` (call it `adv`) and
`report.sections[key=="life_model"].body` (call it `lm`), produced at `report_engine.py:262-278` and `:152-160`.

| Viewer section                 | Field(s)                                                                                                                                      | Source line                                                      | Preview JSON provides it?                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Cover headline + paragraph** | `life_brief.headline`, `life_brief.body`                                                                                                      | **GAP — not in payload today** (see §3)                          | ❌ today: cover only has `adv.vision` (`:263-266`) and `cover.objective`/`cover.confidence_pct` (`:263-264`) |
| Cover readiness badge          | `adv.cover.readiness`                                                                                                                         | `:263`                                                           | ✅ (if `readiness` engine wired `:199-207`; honest `null` else)                                              |
| Cover confidence %             | `adv.cover.confidence_pct`                                                                                                                    | `:264`                                                           | ✅                                                                                                           |
| Cover version line             | `report.version`                                                                                                                              | `report_engine.store():459` (top-level on definition)            | ✅                                                                                                           |
| **1 Situation**                | `life_brief.situation/tension/stakes/next_move`                                                                                               | **GAP**                                                          | ❌ today (see §3) — _interim:_ `adv.vision` + `adv.primary_objective.reasoning` (`:265-266`)                 |
| **2 Goals**                    | `lm.primary_objective.{title,confidence,reasoning}`, `adv.goals[]` (`title,status,progress,category,target_value,current_value`), `lm.themes` | `:155,254-256,156`                                               | ✅                                                                                                           |
| Goal tradeoffs                 | `lm.tradeoffs[]` (`between,reason,focus`)                                                                                                     | `:159` ← `objectives_plan().conflicts` (`life_discovery.py:984`) | ✅ (empty list when <2 conflicting objectives — honest)                                                      |
| **3 Opportunities**            | `adv.opportunities[]`                                                                                                                         | `:272` ← `snapshot.top_opportunities` (`life_discovery.py:922`)  | ✅ (often empty — grounded-only by design; honest empty state)                                               |
| **4 Risks**                    | `adv.risks[]`                                                                                                                                 | `:271` ← `snapshot.top_risks` (`life_discovery.py:921`)          | ✅ (often empty — grounded-only; honest)                                                                     |
| **5 Decision Tradeoffs**       | `lm.tradeoffs[]` (same as goal tradeoffs)                                                                                                     | `:159`                                                           | ✅                                                                                                           |
| **6 Action Plan**              | `adv.plan_90.{now,next,later,blocked[]}` (titles) + `adv.recommendations[]` for detail                                                        | `:244-247`, `:232-242`                                           | ✅                                                                                                           |
| Rec detail                     | per rec: `title, priority, why, confidence, expected_impact, domains[], evidence[{statement,source}], assumptions[{label,value}], unlocks[]`  | `:232-242`                                                       | ✅                                                                                                           |
| `next_best_action` callout     | `adv.next_best_action`                                                                                                                        | `:243,270`                                                       | ✅                                                                                                           |
| **7 What's missing**           | `adv.missing_data[]`                                                                                                                          | `:261,273` ← `quantified_impact.unlocked_capabilities`           | ✅                                                                                                           |
| **8 Appendix**                 | `adv.appendix.{evidence_count,recommendation_count,goal_count,avg_confidence_pct}` + `report.citations`                                       | `:275-277`, `report_engine.py:446-447`                           | ✅                                                                                                           |
| Governance/disclaimer footer   | `report.governance.disclaimer_text`                                                                                                           | `:442` (full report) / `_full_html:274` fallback string          | ✅                                                                                                           |

**Net:** every requested section is already in the preview JSON **except the Life Brief narrative
paragraph** (the cover headline + situation/tension/stakes). That is the one real backend change (§3).

### 2.4 Trust details to render (already in the data)

- **Source citation chips** on each recommendation from `evidence[].source` (mirror `pdf_renderer.py:237-238`).
- **Assumptions** line per rec from `assumptions[].{label,value}` (`pdf_renderer.py:239`).
- **Honest empties as a feature**: when `risks`/`opportunities`/`recommendations` are empty, render the same
  literal copy the PDF uses ("No risks identified yet," "add data so we can compute one" —
  `pdf_renderer.py:192,197,200,248`). This is what a CPA/attorney trusts.
- **Version + generated-at** visible (the reproducibility/audit story is invisible today).

---

## 3. The one real backend gap: lead with `life_brief()`

The executive payload leads with the _vision string_ and _objective title_, not the human paragraph
`life_brief()` already writes. To make the cover/Section-1 lead with the story:

- In `report_engine._advisor_executive_section` (`:262-278`), import and call
  `life_discovery.life_brief(snap, next_action=nba, readiness=readiness)` (signature `life_discovery.py:416`)
  — it takes the same `snap` already fetched at `:209-214` and the `nba`/`readiness` already computed
  (`:243`, `:199-207`) — and add the returned dict under `payload["life_brief"]`. **Reuses an existing,
  already-trusted function; no new intelligence.**
- In `pdf_renderer._full_html` (`:155-178`), render `life_brief.body` as the cover paragraph + Section 1
  instead of only the single-sentence `adv.get('vision')` (`:178`). Honest forming-state already handled by
  `life_brief` (`ready:false` → "still forming" copy, `life_discovery.py:431-440`).

This is a small backend edit (mark as a **build task**, not done here). The web viewer should read
`adv.life_brief` when present and **fall back** to `adv.vision` + `adv.primary_objective.reasoning` when
absent, so the viewer ships even before this backend change lands.

---

## 4. The Share broken promise — fix it (pick ONE)

`page.tsx:63-66` literally instructs the user to "open a report and use Share." No Share UI exists.
The backend is complete: `POST /v1/reports/{type}/share` (`reports.py:73-91`, body `{audience, expires_in_days, purpose}`,
`audience ∈ ("advisor","cpa","attorney","parent","spouse")` `sharing.py:21`), `GET /v1/reports/shares`
(`:94`), `POST /v1/reports/shares/{id}/revoke` (`:99`), `GET /v1/reports/shares/audit` (`:104`).
`create_share` returns `{share_id, token, audience, report_type, share_path:"/share/{token}", expires_at}`
(`sharing.py:76-78`).

### Option A (preferred, P1) — wire the existing share stack

- New proxies (clone the JWT-proxy pattern): `api/reports/[type]/share` (POST), `api/reports/shares` (GET),
  `api/reports/shares/[id]/revoke` (POST).
- On the viewer: a **"Share with advisor / CPA / attorney / family"** action → audience picker (the 5
  `AUDIENCES`) + expiry → calls share → shows the resulting `share_path`/link to copy.
- A **"Shared with"** list (from `/shares`) with **Revoke** per row, and an access count from
  `/shares/audit`. This turns the report into a _business_ artifact and closes the broken promise.
- **Blocker before exposing (§7):** the public token-resolve route `/share/{token}` (consumer of
  `ShareService.resolve` `sharing.py:98`) — verify a recipient page exists or is built; a Share button that
  produces a dead link is worse than no button.

### Option B (fallback, P0 if A can't be verified in time) — remove the claim

Edit `page.tsx:63-66` to drop "and use Share" — describe only download. Honest until the share UI ships.
**A half-working Share on a trust surface is the worst outcome**; if Option A can't be verified end-to-end,
ship Option B now and Option A next.

---

## 5. Honest data caveats (verify on live data — do NOT fabricate)

- **Quantified impact may be sparse.** The `+$X/yr` / `readiness before→after` strings (`report_engine.py:224-231`)
  render **only when `quantified_impact` is populated** on a rec. Many recs carry `quantified_impact`
  (e.g. 401k match `recommendations_os.py:250`, life coverage `:286`) but others carry only a note/`{}`
  (`:259-260`, `:268`). **Audit coverage against live recs.** Where absent, render "impact not yet
  quantified," never an invented figure.
- **Risks/opportunities are intentionally grounded-only** — `discover_goal` does NOT auto-create archetype
  risks/opps (`life_discovery.py:829-858`), so `top_risks`/`top_opportunities` are frequently empty for new
  users. The viewer's honest empty state is correct, not a bug.
- **Readiness may be `{}`** if the readiness engine isn't wired (`report_engine.py:199-207` swallows). Cover
  badge must handle `null`.
- **Decision tradeoffs require ≥2 conflicting active objectives** in the `_CONFLICTS` map
  (`life_discovery.py:943-950`); single-objective users see an empty tradeoffs section (honest).

---

## 6. Prioritized plan

### P0 — make it visible, story-first (frontend-only except 6.2)

1. **Preview proxy** `api/reports/[type]/preview/route.ts` (clone PDF proxy).
2. **Viewer page** `dashboard/reports/[type]/page.tsx` rendering the §2.2 order from the preview JSON, with
   "Download PDF" retained. Falls back to `adv.vision` for the lead if `life_brief` not yet in payload.
3. **Cards link into the viewer**, not straight to PDF (`reports/page.tsx:54-59`).
4. **Fix the Share footer now** via Option B (remove the claim) — unblocks the trust issue immediately even
   if full Share (P1) slips.

### P1 — story lead + shareable business artifact

5. **Backend: add `life_brief` to the executive payload** (§3) + render it on cover/Section-1 (PDF + viewer).
6. **Share UI** (§4 Option A): proxies + audience picker + "Shared with" list + revoke + access count —
   _after_ verifying the public `/share/{token}` resolve path end-to-end.
7. **Show version + last-generated** in the viewer (reproducibility/audit signal, `report_engine.py:459`).

### P2 — depth & polish

8. **Audit quantified-impact coverage** on live recs (§5) — log gaps, do not pad.
9. **Per-section "Sources" disclosure** in the viewer mirroring the PDF citation chips.
10. **Promote Reports into main nav** (`components/layout/Sidebar.tsx`), not just the Life Graph sidebar.

---

## 7. Blockers / verify before building

- **Public share-resolve page** (`/share/{token}` consuming `ShareService.resolve` `sharing.py:98`) must
  exist/work before exposing the Share button (§4A). If unverified → ship §4B.
- **Quantified-impact population** on live recs (§5) decides how "advisor-grade" Section 6 reads — verify,
  don't fabricate.
- **WeasyPrint is import-lazy, deployed-image-only** (`pdf_renderer.py:62,85`): the PDF path can't run
  locally — another reason the **viewer (needs no WeasyPrint)** is the right P0.
- Confirm `readiness` engine wiring in the deployed engine (`report_engine.py:201`) so the cover badge isn't
  always empty in the pilot.
