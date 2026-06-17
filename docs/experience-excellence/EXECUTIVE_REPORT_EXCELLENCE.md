# Executive Report Excellence — Audit & Design

**Sprint:** Experience Excellence (make built intelligence visible, useful, beautiful, memorable)
**Scope:** Design + audit only. No code changes here. Cheap surfacing wins are flagged.
**Hard rule:** No mock/fabricated data, ever. Honest empty states only.

---

## 1. What actually exists today (real file:line)

There **is** a real report capability. It is more complete than the UI admits.

### 1.1 The surface (frontend)

- **Reports hub page:** `apps/web/src/app/dashboard/reports/page.tsx:41` — a static grid of 6 cards
  (`full`, `financial`, `compensation`, `family`, `decision`, `education`, defined `:8-39`). Each card is
  a plain `<a href="/api/reports/{type}/pdf">` "Generate & download PDF →" link (`:54-59`).
  **There is no in-app report viewer.** The only way a user consumes a report is by downloading a PDF.
- **PDF proxy route:** `apps/web/src/app/api/reports/[type]/pdf/route.ts:13` — streams the Core API PDF
  using the user's JWT (`:23-26`). Allowed types `:11`. This is solid and trust-correct.
- **Nav entry:** `apps/web/src/components/lifeGraph/LifeGraphSidebar.tsx:35` (`Reports → /dashboard/reports`).
  Reachable, but buried in the Life Graph sidebar, not the main dashboard nav.

### 1.2 The engine (backend — this is the real asset)

- **Router:** `apps/lifenavigator-core-api/app/routers/reports.py`
  - `POST /v1/reports/generate` (`:26`) — build + store, emits analytics.
  - `GET /v1/reports/{type}/preview` (`:41`) — **returns the full report JSON** (`engine.render`). This is
    the hook a real in-app viewer would use, and it is **already built and unused by the UI.**
  - `GET /v1/reports/{type}/pdf` (`:53`) — branded PDF.
  - `POST /v1/reports/{type}/share` (`:73`), `/shares`, `/shares/{id}/revoke`, `/shares/audit` (`:94-106`)
    — governed share tokens with a consent ledger + access audit. **Also built, also unsurfaced.**
- **Universal engine:** `apps/lifenavigator-core-api/app/services/report_engine.py`
  - `REPORT_TYPES` = full / financial / education / decision / compensation / family / health (`:38`).
  - Reproducible: `content_hash` neutralizes timestamps so same inputs → same hash (`:33-64`); versioned in
    `reporting.reports` + `reporting.report_versions` (`:453-472`). This is the credibility backbone a
    CPA/attorney respects — a report that is _stable and auditable_.
  - **`build()` already assembles an advisor-grade report (`:93-117`).** Section assembly order for
    `full`/`financial`:
    1. **`_life_model_section` (`:140`)** — vision, primary objective + reasoning, themes, constraints,
       opportunities, **tradeoffs/conflicts** from `objectives_plan` (`:159`). Inserted at top (`:104`).
    2. **`_advisor_executive_section` (`:196`)** — the real "Executive Briefing": readiness score + per-domain
       progress/gap (`:199-207`), vision + primary objective (`:209-216`), top recommendations with
       quantified impact (`+$/yr`, `readiness before→after`) (`:222-242`), next-best-action (`:243`),
       risks/opportunities (`:271-272`), missing-data (`:261,273`), 90-day plan now/next/later/blocked
       (`:244-247`), and an appendix with evidence/recommendation/goal counts + avg confidence (`:275-277`).
    3. Domain sections, `_os_recommendations_section` (`:179`), `_tool_calculations_section` (`:119`) —
       every deterministic number with its calculation, assumptions, limitations (`:131-138`).
  - **Honest empties are everywhere** — e.g. `_life_model_section` returns `None` if no objectives (`:150`);
    the executive section swallows per-source failures and emits `{}` (`:206,248,257`).
- **PDF renderer:** `apps/lifenavigator-core-api/app/services/pdf_renderer.py`
  - `render_report_pdf` (`:82`) routes full/financial to the bespoke **`_full_html` "Life Briefing"** layout
    (`:90-93`), everything else to `_generic_html` (`:94`).
  - `_full_html` (`:155`) is already advisor-grade: a gradient cover with the **readiness score + objective
    confidence + the vision quote** (`:170-180`), then Executive Summary with next-best-action (`:193`),
    Life Readiness chips with status colors + bars (`:204-214`), Goal Progress bars (`:216-228`),
    **Recommendations with evidence + source citation chips + assumptions** (`:230-248`), Missing Data
    (`:250-253`), 90-Day Action Plan (`:255-262`), Appendix (`:264-272`), and a governance/disclaimer
    boundary footer (`:274-275`). Empty states are literal and honest (`:178,192,214,228,248,253`).

### 1.3 The narrative asset the report does NOT yet lead with

- **`life_brief()`** — `apps/lifenavigator-core-api/app/services/life_discovery.py:416`. This is the single
  best piece of writing in the codebase: it composes the user's situation in their own words —
  _situation → tension → stakes → next move_ (`:447-484`) — from the dominant narrative + goal portfolio +
  top risk + Recommendation OS next action. It is honest when the model is still forming (`:431-440`).
  It is surfaced on the **dashboard** (`apps/lifenavigator-core-api/app/services/my_life.py:204` via
  `my_life()`), but **the report's executive section does NOT use it.** The report leads with the
  _life-model fields_ (vision string, objective title) — structured, but not the human paragraph a VC/exec
  reads first.

---

## 2. Honest assessment — would a VC / exec / CPA / attorney respect this?

**The PDF, opened cold, is already ~80% there.** It has a cover with a headline metric, an executive
summary, evidence-cited recommendations, a readiness scorecard, and a disclaimer. That clears the bar for
"a professional document."

**But the _experience_ fails three ways that matter to that audience:**

1. **It is invisible.** There is no in-app report. A user must guess that a sidebar link in the Life Graph
   produces a downloadable PDF. The most impressive artifact in the product is the hardest to find and
   cannot be previewed before download. The `preview` endpoint that returns the full JSON
   (`reports.py:41`) is **built and wired to nothing.**

2. **It opens with structure, not story.** `_full_html` leads with a readiness _number_ and the objective
   _title_ (`pdf_renderer.py:175-178`). A VC/exec wants the one-paragraph "here is this person's life and
   the one decision that matters" — which `life_brief()` already writes (`life_discovery.py:447-484`) and
   the report does not use. The cover quotes `adv.get('vision')` (`:178`) — a single sentence — where the
   Life Brief body would land far harder.

3. **Sharing — the thing that makes it a _business_ artifact — is completely hidden.** The governed
   share + consent-ledger + audit-log stack (`reports.py:73-106`) has **zero UI.** The reports page footer
   even _tells the user_ to "open a report and use Share" (`page.tsx:64-66`) — a feature that does not
   exist in the UI. That is a broken promise on a trust surface, which is the worst possible place for one.

**Quantified-impact note:** the executive section does build quantified impact strings — `+$X/yr` and
`readiness before→after` (`report_engine.py:224-231`) — but **only when `quantified_impact` is populated**
on the recommendation. Whether those fields are reliably present is the gap that decides if the report
reads as "advisor-grade" or "generic." This needs verification against live recommendation data
(see Gaps).

---

## 3. Gaps & missing data (be honest)

| Gap                                         | Evidence                                                                               | Consequence                                                                                                    |
| ------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| No in-app report viewer                     | `dashboard/reports/page.tsx` is download-only                                          | Cannot preview, cannot screenshot, cannot demo without a PDF download; highest-value artifact is least visible |
| `preview` JSON endpoint unused              | `reports.py:41` built; no frontend caller                                              | A web report view is one fetch away and shipped on the backend                                                 |
| Share UI absent but advertised              | `reports.py:73-106` vs `page.tsx:64-66`                                                | Broken promise on a trust surface                                                                              |
| Report doesn't lead with `life_brief`       | `report_engine.py:_advisor_executive_section` uses snapshot fields, not `life_brief()` | Opens with structure, not the human story it already has                                                       |
| Quantified impact may be sparse             | `report_engine.py:224-231` is conditional on `quantified_impact`                       | If unpopulated, "advisor-grade" claim weakens — needs live audit, **do not fabricate numbers to fill it**      |
| Reports buried in nav                       | only in `LifeGraphSidebar.tsx:35`                                                      | Discoverability                                                                                                |
| No "last generated / version" shown to user | versioning exists (`report_engine.py:458`) but UI shows nothing                        | The reproducibility/audit story (a CPA-grade feature) is invisible                                             |

---

## 4. Design — the report a VC / exec / CPA / attorney respects

**Principle:** lead with the _story_, prove it with _evidence_, make it _shareable with provenance_.
Reuse the existing engine and endpoints; add a web viewer and surface what's built. Invent no data.

### 4.1 Structure (one canonical "Life Briefing" — full & financial already produce it)

```
COVER        Life Brief headline + the situation→tension→stakes paragraph (life_brief.body)
             Readiness score badge · objective-confidence %  ← already on cover
             "Generated {date} · v{n} · 100% evidence-grounded"  ← already rendered

1 SITUATION  The Life Brief in full: situation, tension, stakes, next move (life_brief)
2 GOALS &    Primary objective + reasoning; the goal portfolio (coexisting, never reduced to one);
  TENSION    the explicit tradeoffs/conflicts from objectives_plan  ← already in _life_model_section
3 READINESS  Per-domain progress + gap, status-colored  ← already in _full_html
4 TOP MOVES  Recommendations, each with: why · quantified impact (+$/yr, readiness Δ) · evidence with
             source citation · assumptions  ← already in _full_html, gated on data presence
5 90-DAY     Now / Next / Later / Blocked-needs-data  ← already rendered
6 WHAT'S     Missing data → "adding X unlocks stronger recommendations"  ← already rendered (honest)
  MISSING
7 APPENDIX   Version, generated-at, evidence/recommendation/goal counts, avg confidence, source tables
             ← already rendered; this is the CPA/attorney trust block
```

**The structure already exists.** The design work is (a) swap the cover/section-1 lead to `life_brief()`,
and (b) build the web viewer so it's seen.

### 4.2 The "this is a serious document" details (mostly already present; verify in PDF)

- Provenance on every claim: source-table citation chips on recommendations (`pdf_renderer.py:237-238`),
  evidence appendix counts (`:264-272`), governance/disclaimer footer (`:274-275`). **Keep these.**
- Reproducibility line on the cover ("v{n}, evidence-grounded") — **already there** (`:179`); surface the
  same in the web viewer.
- Honest empties as a _feature_, not a defect: "No risks identified yet," "add data so we can compute one"
  (`:192,214,248`). This is what an attorney trusts — a tool that says what it doesn't know.

---

## 5. Prioritized plan

### P0 — make the existing report visible and lead with the story

1. **Build an in-app report viewer** at `/dashboard/reports/[type]` that fetches
   `GET /v1/reports/{type}/preview` (already returns full JSON, `reports.py:41`) and renders the same
   section model as the PDF, with a "Download PDF" and (P1) "Share" action. _Cheap surfacing win — the data
   contract already ships._
2. **Lead the executive section with `life_brief()`.** In `report_engine._advisor_executive_section`
   (`:262-278`), add the composed Life Brief (`life_discovery.life_brief`, `:416`) to the `cover`/payload,
   and in `pdf_renderer._full_html` render `life_brief.body` as the cover paragraph + Section 1 instead of
   only the single-sentence vision (`:178`). _Reuses an existing, already-trusted function._
3. **Promote Reports into the main dashboard nav** (`components/layout/Sidebar.tsx`), not just the Life
   Graph sidebar. _Pure surfacing._

### P1 — make it a shareable business artifact

4. **Surface the share stack** (`reports.py:73-106`): a "Share with advisor / CPA / family" action on the
   viewer that creates a governed token, plus a "Shared with" list (`/v1/reports/shares`) and revoke. This
   closes the broken promise in `page.tsx:64-66`. _Backend complete; UI only._
5. **Show version + last-generated** in the viewer from the stored report row (`report_engine.py:458`).
   Makes the reproducibility/audit story visible — a CPA-grade signal.

### P2 — depth & polish

6. **Audit quantified-impact coverage** on live recommendations (`report_engine.py:224-231`). If
   `quantified_impact` is frequently empty, that is a _recommendation-data_ gap to log — **not** a license
   to fabricate. Where absent, the report should say "impact not yet quantified," not invent a figure.
7. **Per-section "Sources" disclosure** in the web viewer mirroring the PDF citation chips, so the web view
   is as defensible as the PDF.

---

## 6. Blockers / things to verify before building

- **Confirm `quantified_impact` population** on real recommendations (decides how "advisor-grade" the
  Top Moves section reads). Verify against live data — do not pad.
- **Confirm the share endpoints work end-to-end** (token + consent ledger + audit) before exposing the
  Share UI on a trust surface; a half-working share is worse than none.
- WeasyPrint is import-lazy and lives only in the deployed image (`pdf_renderer.py:62,85`) — the PDF path
  cannot be exercised locally without it; the **web viewer (P0) needs no WeasyPrint**, which is another
  reason to build it first.
